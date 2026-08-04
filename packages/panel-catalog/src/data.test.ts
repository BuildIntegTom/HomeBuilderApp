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
} from "./data";

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
