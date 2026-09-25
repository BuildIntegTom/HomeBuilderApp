import { describe, expect, it } from "vitest";
import {
  bigHeaderBeamWidthInRange,
  columnMinWidthIn,
  fabricationMinPanelWidthIn,
  cornerPanelWidthIn,
  panelHeightInRange,
  panelThicknessInRange,
  panelWidthInRange,
  sillDefaultHeightIn,
  sillHeaderHeightInRange,
  sillMinWidthIn,
  looseDensePackWidthIn,
  looseDensePackDefaultThicknessIn,
  looseDensePackThicknessOptionsIn,
  squareBalePanel,
  standardPanelHeightIn,
  standardWindowWidthsIn,
  bigHeaderWidthInRange,
  windowHeaderWidthInRange,
} from "./data";
import { SAFETY_GAP_THICKNESS_IN } from "./safetyGapMembers";

// Confirms the mfr spec sheet's metric values (translated to the app's own
// nearest-1/8in convention) and Tommy's two approved ceiling raises.
describe("panel size-limit ranges", () => {
  it("panelThicknessInRange matches the mfr spec sheet (300-400mm)", () => {
    expect(panelThicknessInRange.minIn).toBeCloseTo(11.75, 3);
    expect(panelThicknessInRange.maxIn).toBeCloseTo(15.75, 3);
  });

  it("panelWidthInRange's min matches the mfr spec sheet, max is Tommy's raised ceiling", () => {
    expect(panelWidthInRange.minIn).toBeCloseTo(15.75, 3);
    expect(panelWidthInRange.maxIn).toBe(48);
  });

  it("panelHeightInRange's min matches the mfr spec sheet, max is Tommy's raised ceiling", () => {
    expect(panelHeightInRange.minIn).toBeCloseTo(15.75, 3);
    expect(panelHeightInRange.maxIn).toBe(144);
  });

  it("columnMinWidthIn matches the mfr spec sheet (424mm) and Column's real built width already satisfies it", () => {
    expect(columnMinWidthIn).toBeCloseTo(16.75, 3);
    expect(cornerPanelWidthIn.value).toBeGreaterThanOrEqual(columnMinWidthIn);
  });

  it("bigHeaderBeamWidthInRange matches the mfr spec sheet (400-3000mm)", () => {
    expect(bigHeaderBeamWidthInRange.minIn).toBeCloseTo(15.75, 3);
    expect(bigHeaderBeamWidthInRange.maxIn).toBeCloseTo(118.125, 3);
  });

  it("sillHeaderHeightInRange matches the mfr spec sheet (424-850mm) and the sill default already fits", () => {
    expect(sillHeaderHeightInRange.minIn).toBeCloseTo(16.75, 3);
    expect(sillHeaderHeightInRange.maxIn).toBeCloseTo(33.5, 3);
    expect(sillDefaultHeightIn.value).toBeGreaterThanOrEqual(sillHeaderHeightInRange.minIn);
    expect(sillDefaultHeightIn.value).toBeLessThanOrEqual(sillHeaderHeightInRange.maxIn);
  });

  it("sillMinWidthIn follows the 2ft rule, and still carries the mfr figure it supersedes", () => {
    // Moved 23.625 -> 24 on 2026-09-24: Building Integrity's own shop
    // minimum, superseding the manufacturer's 600mm. The older, sourced
    // figure has to SURVIVE the change — a superseded provenance that gets
    // deleted is indistinguishable from a number nobody ever sourced.
    expect(sillMinWidthIn.value).toBe(24);
    expect(sillMinWidthIn.status).toBe("confirmed");
    expect(sillMinWidthIn.note).toContain("600mm");
    expect(sillMinWidthIn.note).toContain("23.622");
    expect(sillMinWidthIn.note).toContain("2026-09-24");
    // His words and his axis, not a restatement of "24".
    expect(sillMinWidthIn.note).toContain("left to right elevation view");
    // A sill is a short Standard Panel, so the two minimums are one rule.
    expect(sillMinWidthIn.value).toBe(fabricationMinPanelWidthIn.value);
  });

  it("fabricationMinPanelWidthIn is Tommy's 24in shop minimum, recorded beside the mfr floor rather than over it", () => {
    expect(fabricationMinPanelWidthIn.value).toBe(24);
    expect(fabricationMinPanelWidthIn.status).toBe("confirmed");
    // The note has to carry the AXIS, which is the part that was misread
    // once, and it has to be his words rather than a restatement of 24.
    expect(fabricationMinPanelWidthIn.note).toContain("left to right elevation view");
    expect(fabricationMinPanelWidthIn.note).toContain("2026-09-24");
  });

  it("leaves panelWidthInRange.minIn alone — two differently-sourced facts, both kept", () => {
    // The manufacturer's 400mm floor and Building Integrity's working
    // minimum are separate facts. If this ever reads 24, a sourced number
    // has been overwritten to record an unrelated one.
    expect(panelWidthInRange.minIn).toBeCloseTo(15.75, 3);
    expect(panelWidthInRange.note).toContain("Mfr spec sheet");
    expect(fabricationMinPanelWidthIn.value).toBeGreaterThan(panelWidthInRange.minIn);
    expect(fabricationMinPanelWidthIn.value).toBeLessThan(panelWidthInRange.maxIn);
  });

  // -------------------------------------------------------------------------
  // THE ABSORB POLICY'S WHOLE FOUNDATION, ASSERTED DIRECTLY.
  //
  // The tiler (packages/geometry/src/tiling.ts) resolves a leftover one of two
  // ways:
  //   * SPLIT it across two panels — legal only if the parts total >= 2 x the
  //     fabrication minimum, since the smaller part is floor(total / 2);
  //   * ABSORB it into one wider panel — legal only if that panel is <= the
  //     catalog's width ceiling.
  // Those two conditions are complementary **only because the ceiling is
  // exactly twice the floor**. They overlap at precisely 48in and leave no
  // gap, which is why every wall length has a legal tiling and why Tommy's
  // "don't refuse the wall length" is survivable — there is no case left to
  // refuse.
  //
  // THE MARGIN IS ZERO. Raise the minimum to 25in, or lower the maximum to
  // 46in, and a band of wall lengths becomes genuinely untileable: neither
  // branch is legal and the tiler can only emit a panel the shop cannot
  // build. That failure is silent — it produces a plausible-looking cut list.
  // So the coupling is asserted here rather than trusted to a comment, and if
  // either number moves this test is the thing that fails.
  // -------------------------------------------------------------------------
  it("the width ceiling is at least twice the fabrication minimum — the absorb policy is total only because of this", () => {
    expect(panelWidthInRange.maxIn).toBeGreaterThanOrEqual(2 * fabricationMinPanelWidthIn.value);
  });

  it("spells out the complementarity: every leftover total is legal to split, to absorb, or to both", () => {
    // Walk every eighth from nothing up to twice the ceiling and check that at
    // least one of the two branches is available. This is the sweep form of
    // the assertion above — it fails for the same reasons, but it names the
    // first wall-length band that would have had no legal answer.
    const floorIn = fabricationMinPanelWidthIn.value;
    const ceilingIn = panelWidthInRange.maxIn;
    const orphans: number[] = [];
    for (let eighths = 0; eighths <= Math.round(2 * ceilingIn * 8); eighths++) {
      const totalIn = eighths / 8;
      const splitIsLegal = Math.floor(eighths / 2) / 8 >= floorIn;
      const absorbIsLegal = totalIn <= ceilingIn;
      // A total under the floor itself has nothing to absorb INTO either —
      // that is the residual case the plan sends to the Review Log, not a
      // hole in the policy.
      if (totalIn >= floorIn && !splitIsLegal && !absorbIsLegal) orphans.push(totalIn);
    }
    expect(orphans.slice(0, 5)).toEqual([]);
  });

  it("every ADU panel width is at or above the fabrication minimum — none of them trips it", () => {
    // Rogers-Sehorn ADU (job 26024), the acceptance test for Smearforn: the
    // real widths off the cut list. The 24in limit must not fire anywhere on
    // this job, and every width must be a whole eighth so it is typeable.
    const aduWidthsIn = [43, 41.5, 37.5, 35, 31.5, 30, 29.5, 28.5, 25.5, 24, 48];
    for (const widthIn of aduWidthsIn) {
      expect(widthIn).toBeGreaterThanOrEqual(fabricationMinPanelWidthIn.value);
      expect(widthIn).toBeLessThanOrEqual(panelWidthInRange.maxIn);
      expect(Math.abs(widthIn * 8 - Math.round(widthIn * 8))).toBeLessThan(1e-9);
    }
  });

  it("every range has a real, non-inverted min/max", () => {
    for (const range of [panelThicknessInRange, panelWidthInRange, panelHeightInRange, bigHeaderBeamWidthInRange, sillHeaderHeightInRange]) {
      expect(range.minIn).toBeLessThan(range.maxIn);
    }
  });
});

// ---------------------------------------------------------------------------
// The 1/8in grid's own premise, asserted rather than assumed.
//
// The wall panelizer quantizes every length onto a 1/8in grid so that a wall's
// panel widths sum exactly to the wall (see packages/geometry/src/eighths.ts).
// That guarantee silently degrades if any catalog dimension it builds on stops
// being a whole eighth — a value like 16.7in would put a fixed-width slot off
// the grid and there is no rounding rule downstream that can recover it. Every
// one of these was already a whole eighth before the grid existed; this is here
// so that stays true rather than being rediscovered later.
//
// Deliberately checked with an inline predicate rather than geometry's own
// `isWholeEighthIn`: packages/panel-catalog has no package dependencies and
// this assertion is not worth giving it one.
// ---------------------------------------------------------------------------
describe("catalog dimensions sit on the 1/8in grid", () => {
  const isWholeEighth = (valueIn: number) => Math.abs(valueIn * 8 - Math.round(valueIn * 8)) < 1e-9;

  const values: [string, number][] = [
    ["cornerPanelWidthIn", cornerPanelWidthIn.value],
    ["looseDensePackWidthIn (the 40in standard)", looseDensePackWidthIn.value],
    ["squareBalePanel.widthIn", squareBalePanel.widthIn],
    ["squareBalePanel.thicknessIn", squareBalePanel.thicknessIn],
    ["standardPanelHeightIn", standardPanelHeightIn.value],
    ["sillDefaultHeightIn", sillDefaultHeightIn.value],
    ["sillMinWidthIn", sillMinWidthIn.value],
    ["columnMinWidthIn", columnMinWidthIn],
    ["fabricationMinPanelWidthIn", fabricationMinPanelWidthIn.value],
    ["looseDensePackDefaultThicknessIn", looseDensePackDefaultThicknessIn.value],
    ["panelWidthInRange.minIn", panelWidthInRange.minIn],
    ["panelWidthInRange.maxIn", panelWidthInRange.maxIn],
    ["panelThicknessInRange.minIn", panelThicknessInRange.minIn],
    ["panelThicknessInRange.maxIn", panelThicknessInRange.maxIn],
    ["panelHeightInRange.minIn", panelHeightInRange.minIn],
    ["panelHeightInRange.maxIn", panelHeightInRange.maxIn],
    ["bigHeaderBeamWidthInRange.minIn", bigHeaderBeamWidthInRange.minIn],
    ["bigHeaderBeamWidthInRange.maxIn", bigHeaderBeamWidthInRange.maxIn],
    ["sillHeaderHeightInRange.minIn", sillHeaderHeightInRange.minIn],
    ["sillHeaderHeightInRange.maxIn", sillHeaderHeightInRange.maxIn],
    // Both of these bound an actual SLOT width, so they bear directly on the
    // sum invariant rather than only on validation messages.
    ["bigHeaderWidthInRange.minIn", bigHeaderWidthInRange.minIn],
    ["bigHeaderWidthInRange.maxIn", bigHeaderWidthInRange.maxIn],
    ["windowHeaderWidthInRange.minIn", windowHeaderWidthInRange.minIn],
    ["windowHeaderWidthInRange.maxIn", windowHeaderWidthInRange.maxIn],
  ];

  it.each(values)("%s is a whole number of eighths", (_name, valueIn) => {
    expect(isWholeEighth(valueIn)).toBe(true);
  });

  it("every selectable wall thickness is a whole eighth", () => {
    // These are subtracted from a wall's tiling length at a butt joint, so an
    // off-grid thickness would knock the whole wall's budget off the grid.
    for (const thicknessIn of looseDensePackThicknessOptionsIn) {
      expect(isWholeEighth(thicknessIn)).toBe(true);
    }
  });

  it("every standard window width is a whole eighth", () => {
    // A window is a fixed-width reservation the plain budget is measured
    // around; off-grid here means off-grid for every panel on that wall.
    for (const widthIn of standardWindowWidthsIn.value) {
      expect(isWholeEighth(widthIn)).toBe(true);
    }
  });

  it("the safety-gap board is a whole eighth, and matches tiling.ts's own copy", () => {
    // packages/geometry duplicates this as SAFETY_GAP_WIDTH_IN rather than
    // importing it (geometry has no dependency on panel-catalog).
    expect(SAFETY_GAP_THICKNESS_IN).toBe(0.75);
    expect(isWholeEighth(SAFETY_GAP_THICKNESS_IN)).toBe(true);
  });
});
