import { describe, expect, it } from "vitest";
import {
  buildOctagonFootprint,
  buildRectangleFootprint,
  footprintSpanAndRun,
  simpleRoofPlanes,
  type Footprint,
} from "@building-integrity/geometry";
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

  it("⚠ the eave cap lands ON the truss plate — the several-inch gap, closed", () => {
    /* > *"I also see that the gable ends sit directly on the wall panel top
       > plates, while there is a several inch gap under where the roof panels
       > bear."* — Tommy
       The gap was real and it was 15 1/2in wide by `depth x pitch/12` tall
       (5 1/6in at 4:12), running the whole length of every eave. A roof panel
       is cut back to a LEVEL seat so it can bear on a level plate, and the L
       that fills the space under that seat was built at {0,0,0} and never
       placed — so the view drew the panel floating and left the cap out.

       This walks the cap's corners all the way out into the world, through
       the very anchor and tilt `Building3DView` uses, and checks the bottom
       of it sits on the plate: the eave height the takeoff was handed. */
    const eaveHeightFt = 10 + 2.25 / IN_PER_FT; // wall top + the truss plate's own 2 1/4in
    const takeoff = computeDeckPanelTakeoff(input({ roofEaveHeightFt: eaveHeightFt }));
    const roof = takeoff.instances.filter((i) => i.kind === "roof");
    expect(roof.length).toBeGreaterThan(0);

    const byKey = new Map(takeoff.groups.map((g) => [g.key, g]));
    let checked = 0;
    for (const instance of roof) {
      const group = byKey.get(instance.groupKey)!;
      expect(group.capMembers.length).toBeGreaterThan(0);
      const tilt = instance.world.tiltRad;
      /* The view tips the panel by (90deg - pitch) about X, so a member's
         (depth, span) lands in the world as (out from the eave, up). */
      const anchorYIn = instance.world.anchorYFt * IN_PER_FT;
      const plateTopIn = eaveHeightFt * IN_PER_FT;
      for (const m of group.capMembers) {
        for (const c of m.position.sectionCornersIn!) {
          const vIn = anchorYIn - (c.yIn * Math.cos(tilt) - c.zIn * Math.sin(tilt));
          /* Never below the plate, and never more than the void is tall. */
          expect({ id: m.memberId, onPlate: vIn >= plateTopIn - 1e-6 }).toEqual({ id: m.memberId, onPlate: true });
        }
        checked++;
      }
      /* And the cap really does reach DOWN to the plate rather than hovering:
         its lowest corner is the plate's own top. */
      const lowest = Math.min(
        ...group.capMembers.flatMap((m) =>
          m.position.sectionCornersIn!.map((c) => anchorYIn - (c.yIn * Math.cos(tilt) - c.zIn * Math.sin(tilt))),
        ),
      );
      expect(lowest).toBeCloseTo(plateTopIn, 6);
    }
    expect(checked).toBeGreaterThan(0);
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

describe("⚠ the floor deck is cut to the building it sits on", () => {
  /**
   * > *"can we have the roof be basically cut to fit the raised octagon gable
   * > perimeter?"* — Tommy, 2026-11-15, choosing **mitred ends** over a
   * > stepped edge or keeping the overhang as an eave, and asking for the
   * > floor to get the same treatment.
   *
   * Measured on the live code before any of it was written: on an octagon the
   * deck was laid across the bounding SQUARE, so it claimed **20.7%** more
   * than the building — 256.0 sq ft against 212.05 on the 16ft tile, and
   * 1024.0 against 848.22 on the 32ft.
   */
  const octagonInput = (ft: number): DeckPanelTakeoffInput => ({
    footprint: buildOctagonFootprint(ft, ft),
    depthIn: 15.5,
    roofForm: "shed",
    roofPitchIn12: 4,
    roofEaveHeightFt: 10,
    roofGableEndInsetIn: 0,
  });

  it("⚠ a BOX is untouched, down to its panel widths", () => {
    /* THE safety property: every rectangle building in the app goes through
       this code, and the cut must be invisible to it. 15.5in edge panels,
       24in field panels and a 17in redistributed tail — his own module and
       his own tail rule, unchanged. */
    const takeoff = computeDeckPanelTakeoff(input());
    const floor = takeoff.instances.filter((i) => i.kind === "floor");
    expect(takeoff.coverageSqFt.floor).toBeCloseTo(40 * 20, 6);
    /* His own module and his own tail rule: 15.5in edge panels, 24in field
       panels, and a 17in redistributed tail. Unchanged by the cut. */
    expect([...new Set(floor.map((i) => Number(i.widthIn.toFixed(4))))]).toEqual([15.5, 24, 17]);
    expect(floor).toHaveLength(21);
    for (const g of takeoff.groups.filter((g) => g.kind === "floor")) {
      expect(g.options.mitreIn, "a box has no mitred panel").toBeUndefined();
    }
  });

  it("⚠ an octagon's floor deck is the OCTAGON's area, not its bounding square", () => {
    for (const [ft, cut, box] of [
      [16, 212.05, 256],
      [32, 848.22, 1024],
    ] as const) {
      const takeoff = computeDeckPanelTakeoff(octagonInput(ft));
      expect(takeoff.floorRefusal).toBeNull();
      expect(takeoff.coverageSqFt.floor, `${ft}ft octagon`).toBeCloseTo(cut, 1);
      /* And the overhang this removes, which is the number he was looking
         at on screen. */
      expect(box - takeoff.coverageSqFt.floor).toBeCloseTo(box - cut, 1);
    }
  });

  it("⚠ every corner of the building lands ON a panel joint", () => {
    /* Without this a panel straddles a corner, its end is five-sided, and
       the trapezoid the clipper describes cuts INSIDE the wall there. */
    const takeoff = computeDeckPanelTakeoff(octagonInput(16));
    const floor = takeoff.instances.filter((i) => i.kind === "floor");
    const joints = [0, ...floor.map((i) => i.atIn + i.widthIn)];
    /* The 16ft Octagon's own two interior corners, in inches along the run:
       the leg is (16 − 6.625)/2 = 4.6875ft. */
    for (const cornerIn of [4.6875 * 12, (16 - 4.6875) * 12]) {
      expect(
        joints.some((j) => Math.abs(j - cornerIn) < 1e-6),
        `corner at ${cornerIn}in is not a joint`,
      ).toBe(true);
    }
  });

  it("⚠ a mitred panel is its OWN panel — the group key carries the cut", () => {
    /* The defect this pins, measured when the cut was first wired: ten floor
       panels collapsed into THREE groups, because the key knew the width and
       the span but not the bite the building takes out of the panel. A group
       builds one member set for all its copies, so the panels over the far
       corner were fabricated from the near corner's cut. */
    const takeoff = computeDeckPanelTakeoff(octagonInput(16));
    const floorGroups = takeoff.groups.filter((g) => g.kind === "floor");
    const mitred = floorGroups.filter((g) => g.options.mitreIn);
    expect(takeoff.instances.filter((i) => i.kind === "floor")).toHaveLength(10);
    expect(mitred).toHaveLength(6);
    expect(floorGroups).toHaveLength(7);
    /* Each mitred group is exactly one panel; only the square middle shares. */
    for (const g of mitred) expect(g.instances).toHaveLength(1);
    expect(floorGroups.find((g) => !g.options.mitreIn)!.instances).toHaveLength(4);
  });

  it("⚠ a mitred panel's members really are cut back, not just labelled", () => {
    const takeoff = computeDeckPanelTakeoff(octagonInput(16));
    const mitred = takeoff.groups.filter((g) => g.kind === "floor" && g.options.mitreIn);
    expect(mitred.length).toBeGreaterThan(0);
    for (const g of mitred) {
      const joists = g.members.filter((m) => m.memberId.startsWith("joist-"));
      expect(joists, g.key).toHaveLength(4);
      /* Bevelled in the X-Z plane, which is what a plan mitre is. */
      for (const j of joists) expect(j.position.trapezoidCornersIn, `${g.key} ${j.memberId}`).toHaveLength(4);
      /* And shorter than the envelope they sit in. */
      expect(Math.max(...joists.map((j) => j.actualDimsIn.lengthIn))).toBeLessThan(g.spanIn);
    }
  });

  it("⚠ the ROOF deck is NOT cut yet, and says so rather than looking cut", () => {
    /* His ask was the roof first. A roof panel's tall end is plumb-cut and
       its eave is cut back — both in the Y-Z plane — and a mitre is a cut in
       the X-Z plane, which `MemberPosition` states are mutually exclusive. So
       the roof is still laid across its bounding box, and the reason is
       carried in code rather than left to be discovered. */
    const takeoff = computeDeckPanelTakeoff(octagonInput(16));
    for (const g of takeoff.groups.filter((g) => g.kind === "roof")) {
      expect(g.options.mitreIn, "the roof must not claim a mitre it cannot build").toBeUndefined();
    }
  });
});

describe("⚠ which SIDE of the panel the cut lands on", () => {
  /**
   * ⚠ **The span's local Z runs BACKWARDS on one of the two run orientations,
   * and no shape the app can draw today would show it.**
   *
   * `deckPanelPlacements` lays a run two ways. With `axis === "y"` the panel
   * is anchored at `(minX, minY)` unrotated, so its local Z counts up from
   * `minY` — the same direction the clipper measures. With `axis === "x"` the
   * panel is anchored at **maxX** and yawed 90°, so its local Z counts DOWN
   * from `maxX` while the clip still measures up from `minX`.
   *
   * ⚠ **An octagon cannot catch this.** It is symmetric across the span as
   * well as along the run, so swapping a panel's two ends is a no-op on every
   * panel of one — which a mutation confirmed: reversing the flag left all 23
   * tests above green. So the shape below is built by hand: a 16ft × 20ft box
   * with ONE corner chamfered, which is asymmetric across the span and runs
   * on the `axis === "x"` orientation. Get the flip wrong and its deck is cut
   * into the opposite wall at the right area.
   */
  const chamferedTallBox = (): Footprint => {
    /* 16ft across, 20ft deep, with the (16, 20) corner cut off. */
    const points = [
      { x: 0, y: 0 },
      { x: 16, y: 0 },
      { x: 16, y: 16 },
      { x: 12, y: 20 },
      { x: 0, y: 20 },
    ];
    const corners = points.map((point, i) => ({ id: String(i), point }));
    const walls = corners.map((corner, i) => {
      const next = corners[(i + 1) % corners.length]!;
      return {
        id: `${corner.id}${next.id}`,
        startCorner: corner.id,
        endCorner: next.id,
        lengthFt: Math.hypot(next.point.x - corner.point.x, next.point.y - corner.point.y),
      };
    });
    return { corners, walls };
  };

  it("⚠ the cut is on the chamfered side of the building, not its mirror", () => {
    const fp = chamferedTallBox();
    /* Depth beats width, so the run goes along Y and this is the reversed
       orientation — the one the flip exists for. */
    expect(footprintSpanAndRun(fp).axis).toBe("x");

    const takeoff = computeDeckPanelTakeoff({
      footprint: fp,
      depthIn: 15.5,
      roofForm: "shed",
      roofPitchIn12: 4,
      roofEaveHeightFt: 10,
      roofGableEndInsetIn: 0,
    });
    expect(takeoff.floorRefusal).toBeNull();

    /* The LAST panels along the run are the ones over the chamfer: the corner
       runs from (16, 16) to (12, 20), so it is at the far end of the run and
       takes material off the HIGH-x side.

       ⚠ **And the high-x side is the panel's own START**, because local Z
       counts DOWN from `maxX` on this orientation. That is the whole content
       of the flip, and it reads backwards until you work it through: at
       y = 20 the building spans x = 0..12, which is local z = 48..192, so
       48in is missing from the panel's START. */
    const floor = takeoff.instances.filter((i) => i.kind === "floor");
    const last = floor.at(-1)!;
    const group = takeoff.groups.find((g) => g.key === last.groupKey)!;
    const mitre = group.options.mitreIn;
    expect(mitre, "the panel over the chamfer must be mitred").toBeDefined();
    /* ⚠ THE ASSERTION THAT CATCHES THE FLIP. The 4ft chamfer is 48in, and it
       is the panel's FAR edge (the one deeper into the run) that loses all of
       it. Reverse the flag and the whole cut moves to the END, mirroring the
       deck into the opposite wall at exactly the same area. */
    expect(mitre!.startFarIn).toBeCloseTo(48, 6);
    expect(mitre!.endNearIn).toBeCloseTo(0, 6);
    expect(mitre!.endFarIn).toBeCloseTo(0, 6);
    /* The chamfer is a 45° line, so the pull-back grows exactly one inch per
       inch along the run — 15.5in of panel, 15.5in of extra set-back. */
    expect(mitre!.startFarIn - mitre!.startNearIn).toBeCloseTo(last.widthIn, 6);
  });

  it("and the area is the chamfered building's, either way", () => {
    /* Which is exactly why the area alone cannot be the test: 320 less the
       chamfer's 8 sq ft is 312 whichever side it is taken off. */
    const takeoff = computeDeckPanelTakeoff({
      footprint: chamferedTallBox(),
      depthIn: 15.5,
      roofForm: "shed",
      roofPitchIn12: 4,
      roofEaveHeightFt: 10,
      roofGableEndInsetIn: 0,
    });
    expect(takeoff.coverageSqFt.floor).toBeCloseTo(16 * 20 - (4 * 4) / 2, 1);
  });
});

describe("⚠ the standard width reaches the MITRED deck runs too (2026-11-19)", () => {
  /* A cut-to-footprint roof does not use `planFloorRoofPanelWidthsIn` at all:
     it forces its widths through `planDeckRunWidths`, which takes the module
     as its own ceiling. That call site had the 24in constant hardcoded, so on
     an octagon the roof would have stayed on the old module while every box
     building followed the dial — the one shape where the feature silently
     did nothing. */
  const octagonAt = (fieldPanelWidthIn: number): DeckPanelTakeoffInput => ({
    footprint: buildOctagonFootprint(32, 32),
    depthIn: 15.5,
    fieldPanelWidthIn,
    roofForm: "shed",
    roofPitchIn12: 4,
    roofEaveHeightFt: 10,
    roofGableEndInsetIn: 0,
    roofCutToFootprint: true,
  });

  it("lays a mitred octagon's decks at the module it is given", () => {
    const wide = computeDeckPanelTakeoff(octagonAt(24));
    const narrow = computeDeckPanelTakeoff(octagonAt(12));
    const widthsOf = (t: ReturnType<typeof computeDeckPanelTakeoff>, kind: "floor" | "roof") =>
      t.instances.filter((i) => i.kind === kind).map((i) => Number(i.widthIn.toFixed(4)));

    for (const kind of ["floor", "roof"] as const) {
      const a = widthsOf(wide, kind);
      const b = widthsOf(narrow, kind);
      expect(a.length, `${kind} at 24in`).toBeGreaterThan(0);
      /* A narrower module cuts more, narrower panels — on BOTH decks. */
      expect(b.length, `${kind}: 12in module must make more panels`).toBeGreaterThan(a.length);
      expect(Math.max(...b), `${kind}: 12in module must make narrower panels`).toBeLessThanOrEqual(
        Math.max(...a),
      );
    }
  });
});
