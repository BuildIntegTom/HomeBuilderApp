import { describe, expect, it } from "vitest";
import { buildRectangleFootprint, simpleRoofPlanes } from "@building-integrity/geometry";
import { roofTopAboveRooflineIn } from "@building-integrity/panel-catalog";
import { computeDeckPanelTakeoff, type DeckPanelTakeoffInput } from "./deckPanelTakeoff";

/**
 * ⚠ **THE JUNCTION, not either side of it.**
 *
 * There were two floor-and-roof plans and they disagreed: the 3D view laid
 * the roof on its real planes, inset at the gable walls, spanning the real
 * slope, and gave the floor its girts; the Shop Fabrication pages planned one
 * flat, girtless run off the footprint's own span. Both were tested. Both
 * passed. Neither test could see the other plan.
 *
 * So these tests are about the thing a sheet and a drawing have to AGREE on —
 * that a panel named on a sheet is a panel the building has, at the width,
 * span and member count it is drawn at — rather than about either consumer's
 * own arithmetic.
 */

const IN_PER_FT = 12;
const DEPTH_IN = 15.5;

const input = (over: Partial<DeckPanelTakeoffInput> = {}): DeckPanelTakeoffInput => ({
  footprint: buildRectangleFootprint(40, 20),
  depthIn: DEPTH_IN,
  roofForm: "peaked",
  roofPitchIn12: 4,
  roofEaveHeightFt: 10,
  roofGableEndInsetIn: DEPTH_IN,
  ...over,
});

describe("one takeoff, so a sheet and a drawing describe the same panel", () => {
  it("every placed panel belongs to exactly one group, and that group is its own width and span", () => {
    const takeoff = computeDeckPanelTakeoff(input());
    expect(takeoff.instances.length).toBeGreaterThan(0);

    const grouped = takeoff.groups.flatMap((g) => g.instances.map((i) => i.id));
    expect(grouped.slice().sort()).toEqual(takeoff.instances.map((i) => i.id).sort());
    expect(new Set(grouped).size).toBe(takeoff.instances.length);

    for (const group of takeoff.groups) {
      for (const i of group.instances) {
        expect({ id: i.id, w: i.widthIn, s: i.spanIn, k: i.kind }).toEqual({
          id: i.id,
          w: group.widthIn,
          s: group.spanIn,
          k: group.kind,
        });
      }
    }
  });

  it("⚠ every group's members were built from the options the group reports", () => {
    /* The defect this replaces was a group whose options said one thing and
       whose members were built from another. A group that carries both can be
       checked against itself. */
    const takeoff = computeDeckPanelTakeoff(input());
    for (const group of takeoff.groups) {
      expect({ key: group.key, w: group.options.widthIn, l: group.options.lengthIn, d: group.options.depthIn }).toEqual({
        key: group.key,
        w: group.widthIn,
        l: group.spanIn,
        d: DEPTH_IN,
      });
      expect(group.members.length).toBeGreaterThan(0);
      for (const m of group.members) {
        expect({ key: group.key, id: m.memberId, neg: Object.values(m.actualDimsIn).some((v) => v < 0) }).toEqual({
          key: group.key,
          id: m.memberId,
          neg: false,
        });
      }
    }
  });

  it("⚠ a unique panel is a unique sheet: 61 panels on this building, a handful of parts", () => {
    const takeoff = computeDeckPanelTakeoff(input());
    expect(takeoff.instances.filter((i) => i.kind === "floor")).toHaveLength(21);
    /* Both roof planes are the same length, so their 20 panels are 20 of the
       same parts — and because the two planes produce identical options they
       collapse into the SAME groups rather than two parallel sets. */
    expect(takeoff.instances.filter((i) => i.kind === "roof")).toHaveLength(40);
    expect(takeoff.groups.length).toBeLessThan(10);
    expect(takeoff.groups.filter((g) => g.kind === "roof").every((g) => g.instances.length % 2 === 0)).toBe(true);
  });

  it("⚠ every panel name is unique, across both roof planes", () => {
    /* Each plane's own run restarts at R1, so without the facing suffix a
       shop sheet would list two different panels under one name. */
    const takeoff = computeDeckPanelTakeoff(input());
    const names = takeoff.instances.map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
    // Both planes have a first panel, and they are told apart by their facing.
    expect(names.filter((n) => n.startsWith("R1 ")).sort()).toEqual(["R1 (N)", "R1 (S)"]);
  });
});

describe("the roof the takeoff plans is the roof the building has", () => {
  it("⚠ a roof panel spans the real SLOPE, not the ground it covers", () => {
    /* The second plan used the footprint's own span. On a 20ft building at
       4:12 that is 2 wrong in every 100 — on every roof panel, on every
       sheet, in every price. */
    const takeoff = computeDeckPanelTakeoff(input());
    const roof = simpleRoofPlanes(buildRectangleFootprint(40, 20), {
      form: "peaked",
      pitchIn12: 4,
      eaveHeightFt: 10,
    });
    const slopeIn = roof.planes[0]!.slopeFt * IN_PER_FT;
    expect(slopeIn).toBeGreaterThan(10 * IN_PER_FT);
    for (const i of takeoff.instances.filter((i) => i.kind === "roof")) {
      expect({ id: i.id, span: i.spanIn }).toEqual({ id: i.id, span: slopeIn });
    }
  });

  it("⚠ the roof row starts one gable wall in and ends one short, and never overruns the eave", () => {
    const takeoff = computeDeckPanelTakeoff(input());
    for (const run of takeoff.runs.filter((r) => r.kind === "roof")) {
      const panels = takeoff.instances.filter((i) => i.runIndex === run.index);
      expect(panels[0]!.atIn).toBe(0);
      const covered = panels.reduce((a, i) => a + i.widthIn, 0);
      // His standing rule: the parts sum to the whole, exactly.
      expect({ run: run.index, covered }).toEqual({ run: run.index, covered: run.runIn });
      // And the whole is the eave less a gable wall at each end.
      expect({ run: run.index, runIn: run.runIn }).toEqual({ run: run.index, runIn: 40 * IN_PER_FT - 2 * DEPTH_IN });
    }
  });

  it("a roof panel's anchor clears the roof plane by the panel's own plumb thickness", () => {
    /* The same number the gable's lift reads — see `gableTileRoofTopLiftIn`.
       If these two ever stop agreeing, the gable row and the roof it meets
       part company at the junction, which is the bug that cost four passes
       on 2026-10-31. */
    const takeoff = computeDeckPanelTakeoff(input());
    const roof = simpleRoofPlanes(buildRectangleFootprint(40, 20), {
      form: "peaked",
      pitchIn12: 4,
      eaveHeightFt: 10,
    });
    const liftFt = roofTopAboveRooflineIn(DEPTH_IN, 4) / IN_PER_FT;
    for (const i of takeoff.instances.filter((i) => i.kind === "roof")) {
      const plane = roof.planes[i.planeIndex!]!;
      expect(i.world.anchorYFt).toBeCloseTo(plane.lowHeightFt + liftFt, 9);
    }
  });

  it("⚠ no pitch, no roof panels — and that is not an error", () => {
    const takeoff = computeDeckPanelTakeoff(input({ roofPitchIn12: undefined }));
    expect(takeoff.instances.filter((i) => i.kind === "roof")).toEqual([]);
    expect(takeoff.roofRefusal).toBeNull();
    // The floor is unaffected: it does not need a roof to exist.
    expect(takeoff.instances.filter((i) => i.kind === "floor")).toHaveLength(21);
  });

  it("⚠ a building narrower than its own two gable walls says so, in words", () => {
    const takeoff = computeDeckPanelTakeoff(input({ roofGableEndInsetIn: 400 }));
    expect(takeoff.roofRefusal).toContain("gable walls");
    expect(takeoff.instances.filter((i) => i.kind === "roof")).toEqual([]);
  });
});

describe("the floor the takeoff plans is the floor the building has", () => {
  it("⚠ a floor panel carries a girt at each span end; a roof panel carries none", () => {
    const takeoff = computeDeckPanelTakeoff(input());
    for (const group of takeoff.groups) {
      const girts = group.members.filter((m) => m.memberId.startsWith("structural-girt-"));
      if (group.kind === "roof") expect({ key: group.key, girts: girts.length }).toEqual({ key: group.key, girts: 0 });
      else expect(girts.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("⚠ the floor panels under a ridge column carry the column's extra girts, and get their own sheet", () => {
    /* *"one under each side of the panel resting above it."* The old shop
       sheet knew nothing about these, so a builder cutting from it built a
       floor panel that could not carry the column landing on it. */
    const takeoff = computeDeckPanelTakeoff(input());
    const withExtra = takeoff.groups.filter(
      (g) => g.kind === "floor" && (g.options.extraStructuralGirtsAtIn ?? []).length > 0,
    );
    expect(withExtra.length).toBeGreaterThan(0);
    for (const group of withExtra) {
      const girts = new Set(group.members.filter((m) => m.memberId.startsWith("structural-girt-")).map((m) => m.memberId));
      // Two ends plus at least one column girt, all of them distinct parts.
      expect(girts.size).toBeGreaterThan(2);
    }
    // And a panel with a column on it is NOT grouped with a plain neighbour.
    const plain = takeoff.groups.filter((g) => g.kind === "floor" && (g.options.extraStructuralGirtsAtIn ?? []).length === 0);
    expect(plain.length).toBeGreaterThan(0);
    for (const a of withExtra) for (const b of plain) expect(a.key).not.toBe(b.key);
  });

  it("⚠ a shed has no ridge, so no floor panel carries a column girt", () => {
    const takeoff = computeDeckPanelTakeoff(input({ roofForm: "shed" }));
    expect(takeoff.instances.filter((i) => i.kind === "roof").length).toBeGreaterThan(0);
    for (const group of takeoff.groups.filter((g) => g.kind === "floor")) {
      expect({ key: group.key, extra: (group.options.extraStructuralGirtsAtIn ?? []).length }).toEqual({
        key: group.key,
        extra: 0,
      });
    }
  });

  it("the floor fills the footprint exactly, and the coverage is what a $/sqft rate would charge for", () => {
    const takeoff = computeDeckPanelTakeoff(input());
    const covered = takeoff.instances
      .filter((i) => i.kind === "floor")
      .reduce((a, i) => a + (i.widthIn / IN_PER_FT) * (i.spanIn / IN_PER_FT), 0);
    expect(covered).toBeCloseTo(40 * 20, 9);
    expect(takeoff.coverageSqFt.floor).toBeCloseTo(40 * 20, 9);
    /* ⚠ The roof's coverage is its SLOPED area, which is what is bought and
       hung — bigger than the ground it shades. */
    expect(takeoff.coverageSqFt.roof).toBeGreaterThan(40 * 20 * 0.9);
  });

  it("no footprint, no panels, and nothing pretends otherwise", () => {
    const takeoff = computeDeckPanelTakeoff(input({ footprint: null }));
    expect(takeoff.instances).toEqual([]);
    expect(takeoff.groups).toEqual([]);
    expect(takeoff.runs).toEqual([]);
    expect(takeoff.coverageSqFt).toEqual({ floor: 0, roof: 0 });
  });
});

describe("⚠ the eave cap is on the sheet and not in the model, deliberately", () => {
  it("a pitched roof panel carries cap members, apart from its own", () => {
    const takeoff = computeDeckPanelTakeoff(input());
    const roofGroups = takeoff.groups.filter((g) => g.kind === "roof");
    expect(roofGroups.length).toBeGreaterThan(0);
    for (const group of roofGroups) {
      expect(group.capMembers.length).toBeGreaterThan(0);
      // Kept OUT of `members`, which is what the 3D view draws.
      expect(group.members.some((m) => m.memberId.startsWith("cap-"))).toBe(false);
      /* And this is WHY: every cap piece is still at the panel's end, so
         drawing them would stack three members in one place. When the L
         becomes real geometry this assertion is the one to delete. */
      const zs = new Set(group.capMembers.map((m) => m.position.zIn));
      expect(zs).toEqual(new Set([0]));
    }
  });

  it("a floor panel has no cap at all", () => {
    const takeoff = computeDeckPanelTakeoff(input());
    for (const group of takeoff.groups.filter((g) => g.kind === "floor")) {
      expect({ key: group.key, caps: group.capMembers.length }).toEqual({ key: group.key, caps: 0 });
    }
  });
});
