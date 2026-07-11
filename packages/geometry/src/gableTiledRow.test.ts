import { describe, expect, it } from "vitest";
import { computeGableTiledRow } from "./gableTiledRow";

describe("computeGableTiledRow", () => {
  it("tiles an evenly-divisible wall width into whole panels at the target width", () => {
    const panels = computeGableTiledRow(160, 120, 192, 40);
    expect(panels).toHaveLength(4);
    for (const p of panels) expect(p.widthIn).toBeCloseTo(40, 6);
    expect(panels[0]!.xStartIn).toBeCloseTo(0, 6);
    expect(panels[3]!.xEndIn).toBeCloseTo(160, 6);
  });

  it("ceils to a uniform pitch (not a short leftover panel) when the width doesn't divide evenly", () => {
    const panels = computeGableTiledRow(150, 120, 192, 40);
    // ceil(150/40) = 4 panels, evenly re-split to 37.5in each
    expect(panels).toHaveLength(4);
    for (const p of panels) expect(p.widthIn).toBeCloseTo(37.5, 6);
  });

  it("starts and ends every panel row at the eave height", () => {
    const panels = computeGableTiledRow(160, 120, 192, 40);
    expect(panels[0]!.leftHeightIn).toBeCloseTo(120, 6);
    expect(panels[panels.length - 1]!.rightHeightIn).toBeCloseTo(120, 6);
  });

  it("peaks at the ridge height exactly at the midpoint", () => {
    // 2 panels of 80in each meet exactly at the 80in midpoint of a 160in wall
    const panels = computeGableTiledRow(160, 120, 192, 80);
    expect(panels).toHaveLength(2);
    expect(panels[0]!.rightHeightIn).toBeCloseTo(192, 6);
    expect(panels[1]!.leftHeightIn).toBeCloseTo(192, 6);
  });

  it("rises linearly on the near half and falls linearly on the far half", () => {
    const panels = computeGableTiledRow(160, 120, 192, 20);
    // panel 0: x 0-20, near half, rising
    expect(panels[0]!.leftHeightIn).toBeCloseTo(120, 6);
    expect(panels[0]!.rightHeightIn).toBeCloseTo(120 + (192 - 120) * (20 / 80), 6);
    // last panel: x 140-160, far half, falling back to eave
    const last = panels[panels.length - 1]!;
    expect(last.leftHeightIn).toBeCloseTo(120 + (192 - 120) * (20 / 80), 6);
    expect(last.rightHeightIn).toBeCloseTo(120, 6);
  });

  it("handles a flat roofline (eave == ridge) as a constant height across every panel", () => {
    const panels = computeGableTiledRow(160, 120, 120, 40);
    for (const p of panels) {
      expect(p.leftHeightIn).toBeCloseTo(120, 6);
      expect(p.rightHeightIn).toBeCloseTo(120, 6);
    }
  });

  it("falls back to 2 panels (one per half, meeting at the ridge) when the target width exceeds each half", () => {
    const panels = computeGableTiledRow(30, 120, 150, 40);
    expect(panels).toHaveLength(2);
    expect(panels[0]!.widthIn).toBeCloseTo(15, 6);
    expect(panels[0]!.leftHeightIn).toBeCloseTo(120, 6);
    expect(panels[0]!.rightHeightIn).toBeCloseTo(150, 6);
    expect(panels[1]!.leftHeightIn).toBeCloseTo(150, 6);
    expect(panels[1]!.rightHeightIn).toBeCloseTo(120, 6);
  });

  it("never straddles the ridge peak inside a single flat-topped panel (regression)", () => {
    // A naive "just divide the full width by the target" tiling of a 200in
    // wall at 40in panels gives 5 panels — an odd count whose middle panel
    // (80-120) straddles the 100in ridge, sampling equal (flat) heights at
    // its own edges despite the real roofline peaking above its middle.
    // Tiling each half independently guarantees a boundary lands exactly
    // on the ridge instead, so every panel is a strict rise or fall.
    const panels = computeGableTiledRow(200, 120, 192, 40);
    const ridgeIn = 100;
    expect(panels.some((p) => Math.abs(p.xEndIn - ridgeIn) < 1e-6)).toBe(true);
    expect(panels.some((p) => Math.abs(p.xStartIn - ridgeIn) < 1e-6)).toBe(true);
    for (const p of panels) expect(p.leftHeightIn).not.toBeCloseTo(p.rightHeightIn, 3);
  });
});
