import { describe, expect, it } from "vitest";
import { computeGableTiledRow, GABLE_SHED_SNAP_THRESHOLD_IN } from "./gableTiledRow";

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

  describe("adjustable peak position", () => {
    it("places the peak off-center when a peakPositionIn is given", () => {
      // 200in wall, peak at 50in (not the 100in midpoint): near run 50in, far run 150in.
      const panels = computeGableTiledRow(200, 120, 192, 40, 50);
      const peakIn = 50;
      expect(panels.some((p) => Math.abs(p.xEndIn - peakIn) < 1e-6 && Math.abs(p.rightHeightIn - 192) < 1e-6)).toBe(
        true,
      );
      expect(panels.some((p) => Math.abs(p.xStartIn - peakIn) < 1e-6 && Math.abs(p.leftHeightIn - 192) < 1e-6)).toBe(
        true,
      );
    });

    it("defaults to the exact midpoint when peakPositionIn is omitted (backward compatible)", () => {
      const withDefault = computeGableTiledRow(160, 120, 192, 40);
      const explicit = computeGableTiledRow(160, 120, 192, 40, 80);
      expect(withDefault).toEqual(explicit);
    });

    it("snaps to a pure shed (single slope) when the peak is within the threshold of the start edge", () => {
      const panels = computeGableTiledRow(200, 120, 192, 40, GABLE_SHED_SNAP_THRESHOLD_IN - 1);
      // High edge (ridge) at x=0, sloping down to the eave at x=wallWidthIn — no boundary at the peak.
      expect(panels[0]!.leftHeightIn).toBeCloseTo(192, 6);
      expect(panels[panels.length - 1]!.rightHeightIn).toBeCloseTo(120, 6);
      for (const p of panels) expect(p.leftHeightIn).toBeGreaterThan(p.rightHeightIn);
    });

    it("snaps to a pure shed (single slope) when the peak is within the threshold of the end edge", () => {
      const panels = computeGableTiledRow(200, 120, 192, 40, 200 - (GABLE_SHED_SNAP_THRESHOLD_IN - 1));
      // Eave at x=0, sloping up to the high edge (ridge) at x=wallWidthIn.
      expect(panels[0]!.leftHeightIn).toBeCloseTo(120, 6);
      expect(panels[panels.length - 1]!.rightHeightIn).toBeCloseTo(192, 6);
      for (const p of panels) expect(p.rightHeightIn).toBeGreaterThan(p.leftHeightIn);
    });

    it("treats an exact 0 or wallWidthIn peak position the same as a snapped shed", () => {
      const atStart = computeGableTiledRow(200, 120, 192, 40, 0);
      const atEnd = computeGableTiledRow(200, 120, 192, 40, 200);
      expect(atStart[0]!.leftHeightIn).toBeCloseTo(192, 6);
      expect(atStart[atStart.length - 1]!.rightHeightIn).toBeCloseTo(120, 6);
      expect(atEnd[0]!.leftHeightIn).toBeCloseTo(120, 6);
      expect(atEnd[atEnd.length - 1]!.rightHeightIn).toBeCloseTo(192, 6);
    });

    it("clamps an out-of-range peakPositionIn to the wall's own bounds", () => {
      const negative = computeGableTiledRow(200, 120, 192, 40, -50);
      const beyond = computeGableTiledRow(200, 120, 192, 40, 500);
      expect(negative[0]!.leftHeightIn).toBeCloseTo(192, 6);
      expect(beyond[beyond.length - 1]!.rightHeightIn).toBeCloseTo(192, 6);
    });
  });

  describe("insetIn", () => {
    it("starts and ends panels at the inset boundary, not the raw wall corner", () => {
      const panels = computeGableTiledRow(160, 120, 192, 40, undefined, 10);
      expect(panels[0]!.xStartIn).toBeCloseTo(10, 6);
      expect(panels[panels.length - 1]!.xEndIn).toBeCloseTo(150, 6);
    });

    it("sizes panels off the usable (inset) width, not the raw wall width", () => {
      // 160in wall, 10in inset -> 140in usable, ceil(140/40) = 4 panels of 35in each
      const panels = computeGableTiledRow(160, 120, 192, 40, undefined, 10);
      expect(panels).toHaveLength(4);
      for (const p of panels) expect(p.widthIn).toBeCloseTo(35, 6);
    });

    it("keeps height interpolation anchored to the true (uninset) half-width", () => {
      // 160in wall, 80in true half-width, 10in inset: at the inset boundary
      // (x=10) the height should reflect 10/80 up the true half-run, not
      // 0/70 up the usable sub-run (which would wrongly read back as eave).
      const panels = computeGableTiledRow(160, 120, 192, 40, undefined, 10);
      const expectedAtInset = 120 + (192 - 120) * (10 / 80);
      expect(panels[0]!.leftHeightIn).toBeCloseTo(expectedAtInset, 6);
    });

    it("applies no inset at all once the peak snaps to a shed — the run spans the full true wall width", () => {
      const insetIn = 10;
      const wallWidthIn = 200;
      const snapped = computeGableTiledRow(wallWidthIn, 120, 192, 40, GABLE_SHED_SNAP_THRESHOLD_IN - 1, insetIn);
      expect(snapped[0]!.xStartIn).toBeCloseTo(0, 6);
      expect(snapped[snapped.length - 1]!.xEndIn).toBeCloseTo(wallWidthIn, 6);
      expect(snapped[0]!.leftHeightIn).toBeCloseTo(192, 6);
      expect(snapped[snapped.length - 1]!.rightHeightIn).toBeCloseTo(120, 6);
      for (const p of snapped) expect(p.leftHeightIn).toBeGreaterThan(p.rightHeightIn);
    });

    it("the shed-snap threshold itself is never shifted by insetIn — snapping only depends on the raw wall corner distance", () => {
      const insetIn = 10;
      const wallWidthIn = 200;
      // Just inside the RAW threshold -> snaps, regardless of insetIn.
      const snapped = computeGableTiledRow(wallWidthIn, 120, 192, 40, GABLE_SHED_SNAP_THRESHOLD_IN - 1, insetIn);
      expect(snapped[0]!.leftHeightIn).toBeCloseTo(192, 6);
      // Just outside the RAW threshold -> does not snap, still has a real
      // peak boundary (some panel rising, not just uniformly falling), and
      // the inset still applies since this is a genuinely peaked roof.
      const notSnapped = computeGableTiledRow(wallWidthIn, 120, 192, 40, GABLE_SHED_SNAP_THRESHOLD_IN + 1, insetIn);
      expect(notSnapped.some((p) => p.leftHeightIn < p.rightHeightIn)).toBe(true);
      expect(notSnapped[0]!.xStartIn).toBeCloseTo(insetIn, 6);
      expect(notSnapped[notSnapped.length - 1]!.xEndIn).toBeCloseTo(wallWidthIn - insetIn, 6);
    });

    it("insets both true corners for a genuinely peaked (non-snapped) roof, off-center peak included", () => {
      const insetIn = 5.5;
      const wallWidthIn = 200;
      for (const peakIn of [60, 100, 140, 165]) {
        const panels = computeGableTiledRow(wallWidthIn, 120, 192, 40, peakIn, insetIn);
        expect(panels[0]!.xStartIn).toBeCloseTo(insetIn, 6);
        expect(panels[panels.length - 1]!.xEndIn).toBeCloseTo(wallWidthIn - insetIn, 6);
      }
    });

    it("returns an empty result (no crash) when the inset consumes the whole wall", () => {
      const panels = computeGableTiledRow(20, 120, 192, 40, undefined, 15);
      expect(panels).toEqual([]);
    });

    it("defaults to insetIn=0, matching the pre-inset behavior exactly", () => {
      const withDefault = computeGableTiledRow(160, 120, 192, 40);
      const explicitZero = computeGableTiledRow(160, 120, 192, 40, undefined, 0);
      expect(withDefault).toEqual(explicitZero);
    });
  });
});
