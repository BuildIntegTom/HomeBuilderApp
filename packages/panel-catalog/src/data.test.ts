import { describe, expect, it } from "vitest";
import {
  bigHeaderBeamWidthInRange,
  columnMinWidthIn,
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

  it("sillMinWidthIn matches the mfr spec sheet (600mm)", () => {
    expect(sillMinWidthIn).toBeCloseTo(23.625, 3);
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
    ["sillMinWidthIn", sillMinWidthIn],
    ["columnMinWidthIn", columnMinWidthIn],
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
