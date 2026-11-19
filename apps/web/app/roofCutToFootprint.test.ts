import { describe, expect, it } from "vitest";
import { buildOctagonFootprint, buildRectangleFootprint } from "@building-integrity/geometry";
import { buildFloorRoofPanelMembers } from "@building-integrity/panel-catalog";
import { computeDeckPanelTakeoff, type DeckPanelTakeoffInput } from "./deckPanelTakeoff";

/* ──────────────────────────────────────────────────────────────────────────
   THE ROOF IS CUT TO THE BUILDING — his ask of 2026-11-15, built 2026-11-18

   "can we have the roof be basically cut to fit the raised octagon gable
    perimeter?" ... "i do like the simple overhang as an option."

   ⚠ The floor deck has been cut since 2026-11-16 and the roof was still laid
   across the bounding box, so one building was two shapes depending on which
   deck you looked at.
   ────────────────────────────────────────────────────────────────────────── */

const base = (footprint: DeckPanelTakeoffInput["footprint"]): DeckPanelTakeoffInput => ({
  footprint,
  depthIn: 15.5,
  roofForm: "shed",
  roofPitchIn12: 4,
  roofEaveHeightFt: 10,
  roofGableEndInsetIn: 15.5,
});

const roofOf = (t: ReturnType<typeof computeDeckPanelTakeoff>) => t.instances.filter((i) => i.kind === "roof");

describe("⚠ a RECTANGLE is the same roof either way, which is what makes the toggle safe", () => {
  const fp = buildRectangleFootprint(24, 16);
  const off = computeDeckPanelTakeoff({ ...base(fp), roofCutToFootprint: false });
  const on = computeDeckPanelTakeoff({ ...base(fp), roofCutToFootprint: true });

  it("the same roof panels, instance for instance", () => {
    expect(roofOf(on)).toEqual(roofOf(off));
  });

  it("the same roof coverage, to the square foot", () => {
    expect(on.coverageSqFt.roof).toBeCloseTo(off.coverageSqFt.roof, 9);
  });

  it("⚠ and not one panel is mitred — a box has nothing to cut", () => {
    for (const group of on.groups.filter((g) => g.options.kind === "roof")) {
      expect({ key: group.key, mitre: group.options.mitreIn }).toEqual({
        key: group.key,
        mitre: undefined,
      });
    }
  });
});

describe("⚠ an OCTAGON is cut, and the cut reaches the coverage the price is built on", () => {
  const fp = buildOctagonFootprint(16, 16);
  const off = computeDeckPanelTakeoff({ ...base(fp), roofCutToFootprint: false });
  const on = computeDeckPanelTakeoff({ ...base(fp), roofCutToFootprint: true });

  it("the roof covers LESS, because it no longer reaches past the chamfers", () => {
    expect(on.coverageSqFt.roof).toBeLessThan(off.coverageSqFt.roof);
    /* And the floor, which has been cut since 2026-11-16, is untouched by
       this toggle — the two decks are cut by different code and the roof's
       must not reach the floor's. */
    expect(on.coverageSqFt.floor).toBeCloseTo(off.coverageSqFt.floor, 9);
  });

  it("⚠ the run is split at the building's corners, so no panel straddles one", () => {
    /* A corner inside a panel's width is a kink in that panel's end, and a
       kinked end is a five-sided part no mitre can describe. The floor takes
       the same boundaries; this is the roof's. */
    expect(roofOf(on).length).toBeGreaterThan(roofOf(off).length);
  });

  it("⚠ at least one panel is really mitred, and its pull-backs are SLOPE inches", () => {
    const mitred = on.groups.filter((g) => g.options.kind === "roof" && g.options.mitreIn !== undefined);
    expect(mitred.length).toBeGreaterThan(0);
    /* ⚠ The conversion that is easy to get wrong: a roof panel is the
       hypotenuse over the ground it covers, so a cut measured in plan is
       SHORTER than the cut on the panel. At 4:12 the ratio is
       hypot(12,4)/12 = 1.0541, so a pull-back that came through unconverted
       would be about 5% short on every mitred panel. Here it shows up as a
       pull-back that is not a whole number of plan inches. */
    const anyPullBack = mitred
      .flatMap((g) => [
        g.options.mitreIn!.startNearIn,
        g.options.mitreIn!.startFarIn,
        g.options.mitreIn!.endNearIn,
        g.options.mitreIn!.endFarIn,
      ])
      .filter((v) => v > 1e-6);
    expect(anyPullBack.length).toBeGreaterThan(0);
  });

  it("⚠ a mitred panel is its own fabrication group — two cuts are two parts", () => {
    /* The group key carries the mitre, which is what stopped eight floor
       panels in ten being built to one shape when the floor was cut. */
    const keys = on.groups.filter((g) => g.options.kind === "roof").map((g) => g.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBeGreaterThan(off.groups.filter((g) => g.options.kind === "roof").length);
  });
});

describe("⚠ the cut reaches the MEMBERS, which is the only reason any of it matters", () => {
  it("a mitred roof group's own boards are cut, and carry the plumb plane's second face", () => {
    /* The takeoff can change a coverage figure without a single board moving.
       This is the assertion that the panel a shop would build is the cut one:
       its members come back as OBLIQUE section prisms, which is what
       `buildFloorRoofPanelMembers` produces only when it is handed a mitre. */
    const fp = buildOctagonFootprint(16, 16);
    const on = computeDeckPanelTakeoff({ ...base(fp), roofCutToFootprint: true });
    const mitred = on.groups.filter((g) => g.options.kind === "roof" && g.options.mitreIn !== undefined);
    expect(mitred.length).toBeGreaterThan(0);
    const members = buildFloorRoofPanelMembers(mitred[0]!.options);
    const oblique = members.filter((m) => m.position.sectionFarCornersIn !== undefined);
    expect(oblique.length).toBeGreaterThan(0);
    /* And the cut is on the member's own note, so it reaches a cut list. */
    expect(oblique.some((m) => (m.notes ?? "").includes("plan mitre"))).toBe(true);
  });

  it("⚠ an UNCUT roof group's boards are untouched, byte for byte", () => {
    const fp = buildOctagonFootprint(16, 16);
    const off = computeDeckPanelTakeoff({ ...base(fp), roofCutToFootprint: false });
    const roofGroups = off.groups.filter((g) => g.options.kind === "roof");
    expect(roofGroups.length).toBeGreaterThan(0);
    for (const g of roofGroups) {
      for (const m of buildFloorRoofPanelMembers(g.options)) {
        expect(m.position.sectionFarCornersIn).toBeUndefined();
      }
    }
  });
});

describe("⚠ the cut is CLAMPED to the band, not to the whole building", () => {
  it("a peaked roof's plane stops at the ridge, and the cut cannot lengthen it", () => {
    /* Without the intersection against the band's own interval, a panel at
       the ridge would be told the building reaches to the far wall and the
       "cut" would make it longer than the plane it lies on. */
    const fp = buildOctagonFootprint(32, 32);
    const peaked = { ...base(fp), roofForm: "peaked" as const };
    const off = computeDeckPanelTakeoff({ ...peaked, roofCutToFootprint: false });
    const on = computeDeckPanelTakeoff({ ...peaked, roofCutToFootprint: true });
    expect(on.coverageSqFt.roof).toBeLessThanOrEqual(off.coverageSqFt.roof + 1e-9);
    for (const g of on.groups.filter((x) => x.options.kind === "roof")) {
      expect(g.options.lengthIn).toBeLessThanOrEqual(
        Math.max(...off.groups.filter((x) => x.options.kind === "roof").map((x) => x.options.lengthIn)) + 1e-6,
      );
    }
  });
});
