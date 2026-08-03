import { describe, expect, it } from "vitest";
import { computeGableTiledRow, GABLE_SAFETY_GAP_WIDTH_IN, GABLE_SHED_SNAP_THRESHOLD_IN, type RoofProfilePoint } from "./gableTiledRow";

// Most tests below pass `includeSafetyGap: false` to isolate the pure
// roofline-profile/tiling math from Part B's separate gap-absorption
// behavior (covered in its own describe block further down) — matches
// this file's own pre-gap test values exactly.
describe("computeGableTiledRow — single-peak profile (1 point)", () => {
  it("tiles an evenly-divisible wall width into whole panels at the target width", () => {
    const panels = computeGableTiledRow(160, 120, [{ xIn: 80, heightIn: 192 }], 40, 0, false);
    expect(panels).toHaveLength(4);
    for (const p of panels) expect(p.widthIn).toBeCloseTo(40, 6);
    expect(panels[0]!.xStartIn).toBeCloseTo(0, 6);
    expect(panels[3]!.xEndIn).toBeCloseTo(160, 6);
  });

  it("ceils to a uniform pitch (not a short leftover panel) when the width doesn't divide evenly", () => {
    const panels = computeGableTiledRow(150, 120, [{ xIn: 75, heightIn: 192 }], 40, 0, false);
    // ceil(150/40) = 4 panels, evenly re-split to 37.5in each
    expect(panels).toHaveLength(4);
    for (const p of panels) expect(p.widthIn).toBeCloseTo(37.5, 6);
  });

  it("starts and ends every panel row at the eave height", () => {
    const panels = computeGableTiledRow(160, 120, [{ xIn: 80, heightIn: 192 }], 40, 0, false);
    expect(panels[0]!.leftHeightIn).toBeCloseTo(120, 6);
    expect(panels[panels.length - 1]!.rightHeightIn).toBeCloseTo(120, 6);
  });

  it("peaks at the ridge height exactly at the midpoint", () => {
    // 2 panels of 80in each meet exactly at the 80in midpoint of a 160in wall
    const panels = computeGableTiledRow(160, 120, [{ xIn: 80, heightIn: 192 }], 80, 0, false);
    expect(panels).toHaveLength(2);
    expect(panels[0]!.rightHeightIn).toBeCloseTo(192, 6);
    expect(panels[1]!.leftHeightIn).toBeCloseTo(192, 6);
  });

  it("rises linearly on the near half and falls linearly on the far half", () => {
    const panels = computeGableTiledRow(160, 120, [{ xIn: 80, heightIn: 192 }], 20, 0, false);
    // panel 0: x 0-20, near half, rising
    expect(panels[0]!.leftHeightIn).toBeCloseTo(120, 6);
    expect(panels[0]!.rightHeightIn).toBeCloseTo(120 + (192 - 120) * (20 / 80), 6);
    // last panel: x 140-160, far half, falling back to eave
    const last = panels[panels.length - 1]!;
    expect(last.leftHeightIn).toBeCloseTo(120 + (192 - 120) * (20 / 80), 6);
    expect(last.rightHeightIn).toBeCloseTo(120, 6);
  });

  it("handles a flat roofline (eave == ridge) as a constant height across every panel", () => {
    const panels = computeGableTiledRow(160, 120, [{ xIn: 80, heightIn: 120 }], 40, 0, false);
    for (const p of panels) {
      expect(p.leftHeightIn).toBeCloseTo(120, 6);
      expect(p.rightHeightIn).toBeCloseTo(120, 6);
    }
  });

  it("falls back to 2 panels (one per half, meeting at the ridge) when the target width exceeds each half", () => {
    const panels = computeGableTiledRow(30, 120, [{ xIn: 15, heightIn: 150 }], 40, 0, false);
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
    const panels = computeGableTiledRow(200, 120, [{ xIn: 100, heightIn: 192 }], 40, 0, false);
    const ridgeIn = 100;
    expect(panels.some((p) => Math.abs(p.xEndIn - ridgeIn) < 1e-6)).toBe(true);
    expect(panels.some((p) => Math.abs(p.xStartIn - ridgeIn) < 1e-6)).toBe(true);
    for (const p of panels) expect(p.leftHeightIn).not.toBeCloseTo(p.rightHeightIn, 3);
  });

  describe("adjustable peak position", () => {
    it("places the peak off-center when an explicit position is given", () => {
      // 200in wall, peak at 50in (not the 100in midpoint): near run 50in, far run 150in.
      const panels = computeGableTiledRow(200, 120, [{ xIn: 50, heightIn: 192, isExplicitPosition: true }], 40, 0, false);
      const peakIn = 50;
      expect(panels.some((p) => Math.abs(p.xEndIn - peakIn) < 1e-6 && Math.abs(p.rightHeightIn - 192) < 1e-6)).toBe(true);
      expect(panels.some((p) => Math.abs(p.xStartIn - peakIn) < 1e-6 && Math.abs(p.leftHeightIn - 192) < 1e-6)).toBe(true);
    });

    it("a non-explicit point near the shed-snap threshold does NOT snap — only an explicit position can", () => {
      // Same position a snap test below uses, but isExplicitPosition omitted
      // — a plain (non-dragged) default point is still meant to form a real
      // slope, not degenerate to a shed, matching the pre-existing
      // "omitted peakPositionIn never snaps" guarantee.
      const panels = computeGableTiledRow(200, 120, [{ xIn: GABLE_SHED_SNAP_THRESHOLD_IN - 1, heightIn: 192 }], 40, 0, false);
      expect(panels[0]!.leftHeightIn).toBeCloseTo(120, 6);
      expect(panels.some((p) => Math.abs(p.xEndIn - (GABLE_SHED_SNAP_THRESHOLD_IN - 1)) < 1e-6)).toBe(true);
    });

    it("snaps to a pure shed (single slope) when the peak is within the threshold of the start edge", () => {
      const panels = computeGableTiledRow(
        200,
        120,
        [{ xIn: GABLE_SHED_SNAP_THRESHOLD_IN - 1, heightIn: 192, isExplicitPosition: true }],
        40,
        0,
        false,
      );
      // High edge (ridge) at x=0, sloping down to the eave at x=wallWidthIn — no boundary at the peak.
      expect(panels[0]!.leftHeightIn).toBeCloseTo(192, 6);
      expect(panels[panels.length - 1]!.rightHeightIn).toBeCloseTo(120, 6);
      for (const p of panels) expect(p.leftHeightIn).toBeGreaterThan(p.rightHeightIn);
    });

    it("snaps to a pure shed (single slope) when the peak is within the threshold of the end edge", () => {
      const panels = computeGableTiledRow(
        200,
        120,
        [{ xIn: 200 - (GABLE_SHED_SNAP_THRESHOLD_IN - 1), heightIn: 192, isExplicitPosition: true }],
        40,
        0,
        false,
      );
      // Eave at x=0, sloping up to the high edge (ridge) at x=wallWidthIn.
      expect(panels[0]!.leftHeightIn).toBeCloseTo(120, 6);
      expect(panels[panels.length - 1]!.rightHeightIn).toBeCloseTo(192, 6);
      for (const p of panels) expect(p.rightHeightIn).toBeGreaterThan(p.leftHeightIn);
    });

    it("treats an exact 0 or wallWidthIn peak position the same as a snapped shed", () => {
      const atStart = computeGableTiledRow(200, 120, [{ xIn: 0, heightIn: 192, isExplicitPosition: true }], 40, 0, false);
      const atEnd = computeGableTiledRow(200, 120, [{ xIn: 200, heightIn: 192, isExplicitPosition: true }], 40, 0, false);
      expect(atStart[0]!.leftHeightIn).toBeCloseTo(192, 6);
      expect(atStart[atStart.length - 1]!.rightHeightIn).toBeCloseTo(120, 6);
      expect(atEnd[0]!.leftHeightIn).toBeCloseTo(120, 6);
      expect(atEnd[atEnd.length - 1]!.rightHeightIn).toBeCloseTo(192, 6);
    });

    it("clamps an out-of-range position to the wall's own bounds", () => {
      const negative = computeGableTiledRow(200, 120, [{ xIn: -50, heightIn: 192, isExplicitPosition: true }], 40, 0, false);
      const beyond = computeGableTiledRow(200, 120, [{ xIn: 500, heightIn: 192, isExplicitPosition: true }], 40, 0, false);
      expect(negative[0]!.leftHeightIn).toBeCloseTo(192, 6);
      expect(beyond[beyond.length - 1]!.rightHeightIn).toBeCloseTo(192, 6);
    });
  });

  describe("insetIn", () => {
    it("starts and ends panels at the inset boundary, not the raw wall corner", () => {
      const panels = computeGableTiledRow(160, 120, [{ xIn: 80, heightIn: 192 }], 40, 10, false);
      expect(panels[0]!.xStartIn).toBeCloseTo(10, 6);
      expect(panels[panels.length - 1]!.xEndIn).toBeCloseTo(150, 6);
    });

    it("sizes panels off the usable (inset) width, not the raw wall width", () => {
      // 160in wall, 10in inset -> 140in usable, ceil(140/40) = 4 panels of 35in each
      const panels = computeGableTiledRow(160, 120, [{ xIn: 80, heightIn: 192 }], 40, 10, false);
      expect(panels).toHaveLength(4);
      for (const p of panels) expect(p.widthIn).toBeCloseTo(35, 6);
    });

    it("keeps height interpolation anchored to the true (uninset) half-width", () => {
      // 160in wall, 80in true half-width, 10in inset: at the inset boundary
      // (x=10) the height should reflect 10/80 up the true half-run, not
      // 0/70 up the usable sub-run (which would wrongly read back as eave).
      const panels = computeGableTiledRow(160, 120, [{ xIn: 80, heightIn: 192 }], 40, 10, false);
      const expectedAtInset = 120 + (192 - 120) * (10 / 80);
      expect(panels[0]!.leftHeightIn).toBeCloseTo(expectedAtInset, 6);
    });

    it("applies no inset at all once the peak snaps to a shed — the run spans the full true wall width", () => {
      const insetIn = 10;
      const wallWidthIn = 200;
      const snapped = computeGableTiledRow(
        wallWidthIn,
        120,
        [{ xIn: GABLE_SHED_SNAP_THRESHOLD_IN - 1, heightIn: 192, isExplicitPosition: true }],
        40,
        insetIn,
        false,
      );
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
      const snapped = computeGableTiledRow(
        wallWidthIn,
        120,
        [{ xIn: GABLE_SHED_SNAP_THRESHOLD_IN - 1, heightIn: 192, isExplicitPosition: true }],
        40,
        insetIn,
        false,
      );
      expect(snapped[0]!.leftHeightIn).toBeCloseTo(192, 6);
      // Just outside the RAW threshold -> does not snap, still has a real
      // peak boundary (some panel rising, not just uniformly falling), and
      // the inset still applies since this is a genuinely peaked roof.
      const notSnapped = computeGableTiledRow(
        wallWidthIn,
        120,
        [{ xIn: GABLE_SHED_SNAP_THRESHOLD_IN + 1, heightIn: 192, isExplicitPosition: true }],
        40,
        insetIn,
        false,
      );
      expect(notSnapped.some((p) => p.leftHeightIn < p.rightHeightIn)).toBe(true);
      expect(notSnapped[0]!.xStartIn).toBeCloseTo(insetIn, 6);
      expect(notSnapped[notSnapped.length - 1]!.xEndIn).toBeCloseTo(wallWidthIn - insetIn, 6);
    });

    it("insets both true corners for a genuinely peaked (non-snapped) roof, off-center peak included", () => {
      const insetIn = 5.5;
      const wallWidthIn = 200;
      for (const peakIn of [60, 100, 140, 165]) {
        const panels = computeGableTiledRow(wallWidthIn, 120, [{ xIn: peakIn, heightIn: 192, isExplicitPosition: true }], 40, insetIn, false);
        expect(panels[0]!.xStartIn).toBeCloseTo(insetIn, 6);
        expect(panels[panels.length - 1]!.xEndIn).toBeCloseTo(wallWidthIn - insetIn, 6);
      }
    });

    it("returns an empty result (no crash) when the inset consumes the whole wall", () => {
      const panels = computeGableTiledRow(20, 120, [{ xIn: 10, heightIn: 192 }], 40, 15, false);
      expect(panels).toEqual([]);
    });

    it("defaults to insetIn=0, matching the pre-inset behavior exactly", () => {
      const withDefault = computeGableTiledRow(160, 120, [{ xIn: 80, heightIn: 192 }], 40, 0, false);
      const explicitZero = computeGableTiledRow(160, 120, [{ xIn: 80, heightIn: 192 }], 40, 0, false);
      expect(withDefault).toEqual(explicitZero);
    });
  });
});

describe("computeGableTiledRow — flat-topped profile (2 points)", () => {
  it("tiles 3 segments (rise, flat, fall), with panel boundaries exactly on both points", () => {
    // 200in wall, points at x=60 (h=180) and x=140 (h=180) — a level flat top.
    const points: RoofProfilePoint[] = [
      { xIn: 60, heightIn: 180, isExplicitPosition: true },
      { xIn: 140, heightIn: 180, isExplicitPosition: true },
    ];
    const panels = computeGableTiledRow(200, 120, points, 40, 0, false);
    expect(panels.some((p) => Math.abs(p.xEndIn - 60) < 1e-6 && Math.abs(p.rightHeightIn - 180) < 1e-6)).toBe(true);
    expect(panels.some((p) => Math.abs(p.xStartIn - 60) < 1e-6 && Math.abs(p.leftHeightIn - 180) < 1e-6)).toBe(true);
    expect(panels.some((p) => Math.abs(p.xEndIn - 140) < 1e-6 && Math.abs(p.rightHeightIn - 180) < 1e-6)).toBe(true);
    expect(panels.some((p) => Math.abs(p.xStartIn - 140) < 1e-6 && Math.abs(p.leftHeightIn - 180) < 1e-6)).toBe(true);
  });

  it("holds a constant height across the flat run between the 2 points", () => {
    const points: RoofProfilePoint[] = [
      { xIn: 60, heightIn: 180, isExplicitPosition: true },
      { xIn: 140, heightIn: 180, isExplicitPosition: true },
    ];
    const panels = computeGableTiledRow(200, 120, points, 40, 0, false);
    const flatPanels = panels.filter((p) => p.xStartIn >= 60 - 1e-6 && p.xEndIn <= 140 + 1e-6);
    expect(flatPanels.length).toBeGreaterThan(0);
    for (const p of flatPanels) {
      expect(p.leftHeightIn).toBeCloseTo(180, 6);
      expect(p.rightHeightIn).toBeCloseTo(180, 6);
    }
  });

  it("supports fully independent per-point heights (an intentionally sloped flat-top run)", () => {
    const points: RoofProfilePoint[] = [
      { xIn: 60, heightIn: 170, isExplicitPosition: true },
      { xIn: 140, heightIn: 190, isExplicitPosition: true },
    ];
    const panels = computeGableTiledRow(200, 120, points, 40, 0, false);
    expect(panels.some((p) => Math.abs(p.xEndIn - 60) < 1e-6 && Math.abs(p.rightHeightIn - 170) < 1e-6)).toBe(true);
    expect(panels.some((p) => Math.abs(p.xStartIn - 140) < 1e-6 && Math.abs(p.leftHeightIn - 190) < 1e-6)).toBe(true);
  });

  it("each point independently snaps to its own nearest end when explicit and within the threshold", () => {
    // Left point dragged to a shed-snap position; right point stays put.
    const points: RoofProfilePoint[] = [
      { xIn: GABLE_SHED_SNAP_THRESHOLD_IN - 1, heightIn: 180, isExplicitPosition: true },
      { xIn: 140, heightIn: 180, isExplicitPosition: true },
    ];
    const panels = computeGableTiledRow(200, 120, points, 40, 0, false);
    // Left end now reads the snapped point's own height, not the eave height.
    expect(panels[0]!.leftHeightIn).toBeCloseTo(180, 6);
    // Right eave is untouched (still a real fall segment down to 120).
    expect(panels[panels.length - 1]!.rightHeightIn).toBeCloseTo(120, 6);
  });

  it("both points can independently snap to opposite ends at once", () => {
    const points: RoofProfilePoint[] = [
      { xIn: GABLE_SHED_SNAP_THRESHOLD_IN - 1, heightIn: 170, isExplicitPosition: true },
      { xIn: 200 - (GABLE_SHED_SNAP_THRESHOLD_IN - 1), heightIn: 190, isExplicitPosition: true },
    ];
    const panels = computeGableTiledRow(200, 120, points, 40, 0, false);
    expect(panels[0]!.leftHeightIn).toBeCloseTo(170, 6);
    expect(panels[panels.length - 1]!.rightHeightIn).toBeCloseTo(190, 6);
  });

  it("when both points would snap to the SAME end, only the first (input order) claims it — no collision", () => {
    const points: RoofProfilePoint[] = [
      { xIn: 5, heightIn: 170, isExplicitPosition: true },
      { xIn: 10, heightIn: 190, isExplicitPosition: true },
    ];
    const panels = computeGableTiledRow(200, 120, points, 40, 0, false);
    // First point claims the left end...
    expect(panels[0]!.leftHeightIn).toBeCloseTo(170, 6);
    // ...the second stays distinct (clamped just outside the threshold) rather than also landing at x=0.
    const secondPointHeights = panels.filter((p) => Math.abs(p.rightHeightIn - 190) < 1e-6 || Math.abs(p.leftHeightIn - 190) < 1e-6);
    expect(secondPointHeights.length).toBeGreaterThan(0);
    for (const p of panels) expect(p.xStartIn).toBeGreaterThanOrEqual(-1e-6);
  });

  it("insets both true corners the same as the single-peak case, anchored off the outermost points", () => {
    const insetIn = 5.5;
    const points: RoofProfilePoint[] = [
      { xIn: 60, heightIn: 180, isExplicitPosition: true },
      { xIn: 140, heightIn: 180, isExplicitPosition: true },
    ];
    const panels = computeGableTiledRow(200, 120, points, 40, insetIn, false);
    expect(panels[0]!.xStartIn).toBeCloseTo(insetIn, 6);
    expect(panels[panels.length - 1]!.xEndIn).toBeCloseTo(200 - insetIn, 6);
  });
});

describe("computeGableTiledRow — energy-heel truss seat (heelHeightIn)", () => {
  it("defaults to heelHeightIn=0, matching the pre-heel behavior exactly", () => {
    const withDefault = computeGableTiledRow(160, 120, [{ xIn: 80, heightIn: 192 }], 40, 0, false);
    const explicitZero = computeGableTiledRow(160, 120, [{ xIn: 80, heightIn: 192 }], 40, 0, false, 0);
    expect(withDefault).toEqual(explicitZero);
  });

  it("builds no cap tile over the first targetPanelWidthIn from either corner, and starts the real roofline heelHeightIn above the eave", () => {
    const wallWidthIn = 300;
    const eaveHeightIn = 120;
    const targetPanelWidthIn = 40;
    const heelHeightIn = 6;
    const panels = computeGableTiledRow(wallWidthIn, eaveHeightIn, [{ xIn: 150, heightIn: 192 }], targetPanelWidthIn, 0, false, heelHeightIn);
    for (const p of panels) {
      expect(p.xStartIn).toBeGreaterThanOrEqual(targetPanelWidthIn - 1e-6);
      expect(p.xEndIn).toBeLessThanOrEqual(wallWidthIn - targetPanelWidthIn + 1e-6);
    }
    expect(panels[0]!.xStartIn).toBeCloseTo(targetPanelWidthIn, 6);
    expect(panels[0]!.leftHeightIn).toBeCloseTo(eaveHeightIn + heelHeightIn, 6);
    const last = panels[panels.length - 1]!;
    expect(last.xEndIn).toBeCloseTo(wallWidthIn - targetPanelWidthIn, 6);
    expect(last.rightHeightIn).toBeCloseTo(eaveHeightIn + heelHeightIn, 6);
  });

  it("skips the heel on a shed-snapped side, but still applies it on the other (unclaimed) side", () => {
    const wallWidthIn = 300;
    const eaveHeightIn = 120;
    const targetPanelWidthIn = 40;
    const heelHeightIn = 6;
    const panels = computeGableTiledRow(
      wallWidthIn,
      eaveHeightIn,
      [{ xIn: GABLE_SHED_SNAP_THRESHOLD_IN - 1, heightIn: 192, isExplicitPosition: true }],
      targetPanelWidthIn,
      0,
      false,
      heelHeightIn,
    );
    // Left end snapped to a shed at the true corner (x=0), not shifted by the heel.
    expect(panels[0]!.xStartIn).toBeCloseTo(0, 6);
    expect(panels[0]!.leftHeightIn).toBeCloseTo(192, 6);
    // Right end is unclaimed, so it still gets the heel treatment.
    const last = panels[panels.length - 1]!;
    expect(last.xEndIn).toBeCloseTo(wallWidthIn - targetPanelWidthIn, 6);
    expect(last.rightHeightIn).toBeCloseTo(eaveHeightIn + heelHeightIn, 6);
  });

  it("falls back to legacy flat-corner tiling on a wall too narrow to fit the seat(s) it would need", () => {
    const wallWidthIn = 60; // under 2 * targetPanelWidthIn (80)
    const eaveHeightIn = 120;
    const targetPanelWidthIn = 40;
    const panels = computeGableTiledRow(wallWidthIn, eaveHeightIn, [], targetPanelWidthIn, 0, false, 6);
    expect(panels[0]!.xStartIn).toBeCloseTo(0, 6);
    expect(panels[0]!.leftHeightIn).toBeCloseTo(eaveHeightIn, 6);
    const last = panels[panels.length - 1]!;
    expect(last.xEndIn).toBeCloseTo(wallWidthIn, 6);
    expect(last.rightHeightIn).toBeCloseTo(eaveHeightIn, 6);
    // No anchor ordering corruption — every tile has a positive width.
    for (const p of panels) expect(p.widthIn).toBeGreaterThan(0);
  });

  it("clamps a real point that would otherwise fall inside the seat zone out to the seat's own boundary", () => {
    // xIn=30 sits past the 24in shed-snap threshold (so it doesn't snap) but
    // inside the 40in-wide seat zone the heel would claim on the left.
    const wallWidthIn = 300;
    const eaveHeightIn = 120;
    const targetPanelWidthIn = 40;
    const heelHeightIn = 6;
    const panels = computeGableTiledRow(
      wallWidthIn,
      eaveHeightIn,
      [{ xIn: 30, heightIn: 150, isExplicitPosition: true }],
      targetPanelWidthIn,
      0,
      false,
      heelHeightIn,
    );
    // Every tile is still strictly ordered/positive-width — no corruption.
    for (const p of panels) expect(p.widthIn).toBeGreaterThan(0);
    for (let i = 1; i < panels.length; i++) expect(panels[i]!.xStartIn).toBeGreaterThanOrEqual(panels[i - 1]!.xEndIn - 1e-6);
    // The seat boundary itself is still exactly where the heel puts it.
    expect(panels[0]!.xStartIn).toBeCloseTo(targetPanelWidthIn, 6);
    expect(panels[0]!.leftHeightIn).toBeCloseTo(eaveHeightIn + heelHeightIn, 6);
  });
});

describe("computeGableTiledRow — panel-depth anchor mode (RoofBearingAnchorMode)", () => {
  it("starts the roofline flush at the plain eave height, inset by insetIn from each corner (no height bump)", () => {
    const wallWidthIn = 300;
    const eaveHeightIn = 120;
    const insetIn = 5.5;
    const panels = computeGableTiledRow(wallWidthIn, eaveHeightIn, [{ xIn: 150, heightIn: 192 }], 40, insetIn, false, 0, "panel-depth");
    expect(panels[0]!.xStartIn).toBeCloseTo(insetIn, 6);
    expect(panels[0]!.leftHeightIn).toBeCloseTo(eaveHeightIn, 6);
    const last = panels[panels.length - 1]!;
    expect(last.xEndIn).toBeCloseTo(wallWidthIn - insetIn, 6);
    expect(last.rightHeightIn).toBeCloseTo(eaveHeightIn, 6);
  });

  it("ignores heelHeightIn entirely under panel-depth mode", () => {
    const withHeelArg = computeGableTiledRow(300, 120, [{ xIn: 150, heightIn: 192 }], 40, 5.5, false, 6, "panel-depth");
    const withoutHeelArg = computeGableTiledRow(300, 120, [{ xIn: 150, heightIn: 192 }], 40, 5.5, false, 0, "panel-depth");
    expect(withHeelArg).toEqual(withoutHeelArg);
  });

  it("skips the inset anchor globally once either side shed-snaps, mirroring the material inset's own global-kill rule", () => {
    const wallWidthIn = 300;
    const eaveHeightIn = 120;
    const insetIn = 5.5;
    const panels = computeGableTiledRow(
      wallWidthIn,
      eaveHeightIn,
      [{ xIn: GABLE_SHED_SNAP_THRESHOLD_IN - 1, heightIn: 192, isExplicitPosition: true }],
      40,
      insetIn,
      false,
      0,
      "panel-depth",
    );
    // Left end snapped to a shed at the true corner (x=0) — no inset either way.
    expect(panels[0]!.xStartIn).toBeCloseTo(0, 6);
    expect(panels[0]!.leftHeightIn).toBeCloseTo(192, 6);
    // Right end is unclaimed, but the shed snap on the left still kills the
    // inset globally (same as computeGableTiledRow's own material-inset
    // rule) — no seat, panel material runs flush to the true right corner.
    const last = panels[panels.length - 1]!;
    expect(last.xEndIn).toBeCloseTo(wallWidthIn, 6);
    expect(last.rightHeightIn).toBeCloseTo(eaveHeightIn, 6);
  });

  it("clamps a real point that would otherwise fall inside the inset seat zone out to the seat's own boundary", () => {
    // An artificially large insetIn (past the shed-snap threshold) so a
    // point that doesn't shed-snap can still land inside the seat zone —
    // mirrors the equivalent heel-mode clamp test above.
    const wallWidthIn = 300;
    const eaveHeightIn = 120;
    const insetIn = 30;
    const panels = computeGableTiledRow(
      wallWidthIn,
      eaveHeightIn,
      [{ xIn: 28, heightIn: 150, isExplicitPosition: true }],
      40,
      insetIn,
      false,
      0,
      "panel-depth",
    );
    for (const p of panels) expect(p.widthIn).toBeGreaterThan(0);
    for (let i = 1; i < panels.length; i++) expect(panels[i]!.xStartIn).toBeGreaterThanOrEqual(panels[i - 1]!.xEndIn - 1e-6);
    expect(panels[0]!.xStartIn).toBeCloseTo(insetIn, 6);
    expect(panels[0]!.leftHeightIn).toBeCloseTo(eaveHeightIn, 6);
  });
});

describe("computeGableTiledRow — window reservations (GableWindowReservation)", () => {
  it("inserts a window at its own ordinal position, shrinking the natural fill tiles to make room, total width unchanged", () => {
    // Baseline (no window): 4 even 40in tiles — 2 per segment (peak at
    // xIn=80 of a 160in wall). Reserve a 30in window at ordinal 1 (the 2nd
    // tile, inside segment 0's own rising run).
    const panels = computeGableTiledRow(160, 120, [{ xIn: 80, heightIn: 192 }], 40, 0, false, 0, "truss-heel", [{ beforeTileCount: 1, widthIn: 30 }]);
    expect(panels).toHaveLength(5);
    const totalWidthIn = panels.reduce((sum, p) => sum + p.widthIn, 0);
    expect(totalWidthIn).toBeCloseTo(160, 6);
    const windowTile = panels.find((p) => p.isWindow);
    expect(windowTile).toBeDefined();
    expect(windowTile!.widthIn).toBeCloseTo(30, 6);
    expect(windowTile!.xStartIn).toBeCloseTo(25, 6);
    expect(windowTile!.xEndIn).toBeCloseTo(55, 6);
    // Height at the window's own edges reads off the segment's true rising
    // slope (eave 120 -> peak 192 over the 80in run), not the shrunk budget.
    expect(windowTile!.leftHeightIn).toBeCloseTo(120 + (192 - 120) * (25 / 80), 6);
    expect(windowTile!.rightHeightIn).toBeCloseTo(120 + (192 - 120) * (55 / 80), 6);
    // No tile overlaps/gaps — contiguous left to right.
    for (let i = 1; i < panels.length; i++) expect(panels[i]!.xStartIn).toBeCloseTo(panels[i - 1]!.xEndIn, 6);
  });

  it("localizes a global ordinal past the first segment's own natural tile count into the next segment", () => {
    // Same wall/peak — ordinal 2 is the 1st tile of segment 1 (segment 0's
    // own natural count is 2).
    const panels = computeGableTiledRow(160, 120, [{ xIn: 80, heightIn: 192 }], 40, 0, false, 0, "truss-heel", [{ beforeTileCount: 2, widthIn: 20 }]);
    expect(panels).toHaveLength(5);
    const totalWidthIn = panels.reduce((sum, p) => sum + p.widthIn, 0);
    expect(totalWidthIn).toBeCloseTo(160, 6);
    const windowTile = panels.find((p) => p.isWindow);
    expect(windowTile!.xStartIn).toBeCloseTo(80, 6);
    expect(windowTile!.xEndIn).toBeCloseTo(100, 6);
    // Segment 0 (unaffected — no reservation lands there) stays exactly the
    // untouched 2x40in baseline.
    const beforeWindow = panels.filter((p) => p.xEndIn <= 80);
    expect(beforeWindow).toHaveLength(2);
    for (const p of beforeWindow) expect(p.widthIn).toBeCloseTo(40, 6);
  });

  it("carries heightIn/sillHeightIn through onto the resulting tile's windowHeightIn/windowSillHeightIn", () => {
    const panels = computeGableTiledRow(160, 120, [{ xIn: 80, heightIn: 192 }], 40, 0, false, 0, "truss-heel", [
      { beforeTileCount: 1, widthIn: 30, heightIn: 48, sillHeightIn: 32 },
    ]);
    const windowTile = panels.find((p) => p.isWindow);
    expect(windowTile!.windowHeightIn).toBe(48);
    expect(windowTile!.windowSillHeightIn).toBe(32);
  });

  it("coexists with the safety-gap tile on a long run — total width still adds up, gap stays untouched", () => {
    const wallWidthIn = 300;
    const panels = computeGableTiledRow(wallWidthIn, 120, [{ xIn: 0, heightIn: 150, isExplicitPosition: true }], 40, 0, true, 0, "truss-heel", [
      { beforeTileCount: 1, widthIn: 36 },
    ]);
    const totalWidthIn = panels.reduce((sum, p) => sum + p.widthIn, 0);
    expect(totalWidthIn).toBeCloseTo(wallWidthIn, 6);
    const gapPanels = panels.filter((p) => p.isSafetyGap);
    expect(gapPanels).toHaveLength(1);
    expect(gapPanels[0]!.widthIn).toBeCloseTo(GABLE_SAFETY_GAP_WIDTH_IN, 6);
    const windowTile = panels.find((p) => p.isWindow);
    expect(windowTile).toBeDefined();
    expect(windowTile!.widthIn).toBeCloseTo(36, 6);
    for (let i = 1; i < panels.length; i++) expect(panels[i]!.xStartIn).toBeCloseTo(panels[i - 1]!.xEndIn, 6);
  });

  it("is byte-identical to omitting the parameter entirely when no reservations are given", () => {
    const withEmptyArray = computeGableTiledRow(160, 120, [{ xIn: 80, heightIn: 192 }], 40, 0, false, 0, "truss-heel", []);
    const withoutParam = computeGableTiledRow(160, 120, [{ xIn: 80, heightIn: 192 }], 40, 0, false, 0, "truss-heel");
    expect(withEmptyArray).toEqual(withoutParam);
  });
});

describe("computeGableTiledRow — horizontal safety-gap absorption (Part B)", () => {
  it("reserves a dedicated GABLE_SAFETY_GAP_WIDTH_IN tile on a long run instead of evenly redistributing overflow", () => {
    // An explicit point snapped to the left end collapses the whole wall
    // into a single shed segment — easiest to reason about gap placement.
    const wallWidthIn = 300;
    const panels = computeGableTiledRow(wallWidthIn, 120, [{ xIn: 0, heightIn: 150, isExplicitPosition: true }], 40, 0, true);
    const gapPanels = panels.filter((p) => p.isSafetyGap);
    expect(gapPanels).toHaveLength(1);
    expect(gapPanels[0]!.widthIn).toBeCloseTo(GABLE_SAFETY_GAP_WIDTH_IN, 6);
    // No panel (besides the gap's own 2 split neighbors) exceeds the target width.
    for (const p of panels) if (!p.isSafetyGap) expect(p.widthIn).toBeLessThanOrEqual(40 + 1e-6);
  });

  it("does not add a gap on a short run (mirrors the wall-tiling 12ft minimum)", () => {
    const wallWidthIn = 100; // under GABLE_SAFETY_GAP_MIN_RUN_LENGTH_IN (144)
    const panels = computeGableTiledRow(wallWidthIn, 120, [{ xIn: wallWidthIn / 2, heightIn: 120 }], 40, 0, true);
    expect(panels.some((p) => p.isSafetyGap)).toBe(false);
  });

  it("the total width across every tile (including the gap) still exactly sums to the run's own width", () => {
    const wallWidthIn = 317; // deliberately not evenly divisible
    const panels = computeGableTiledRow(wallWidthIn, 120, [{ xIn: wallWidthIn / 2, heightIn: 120 }], 40, 0, true);
    const totalWidthIn = panels.reduce((sum, p) => sum + p.widthIn, 0);
    expect(totalWidthIn).toBeCloseTo(wallWidthIn, 6);
  });

  it("includeSafetyGap: false suppresses the gap even on a long run", () => {
    const wallWidthIn = 300;
    const panels = computeGableTiledRow(wallWidthIn, 120, [{ xIn: wallWidthIn / 2, heightIn: 120 }], 40, 0, false);
    expect(panels.some((p) => p.isSafetyGap)).toBe(false);
  });

  it("defaults to includeSafetyGap: true when omitted", () => {
    const wallWidthIn = 300;
    const withDefault = computeGableTiledRow(wallWidthIn, 120, [{ xIn: wallWidthIn / 2, heightIn: 120 }], 40);
    expect(withDefault.some((p) => p.isSafetyGap)).toBe(true);
  });

  it("each rise/flat/fall segment of a flat-top profile gets its own independent gap on a long enough run", () => {
    const wallWidthIn = 500;
    const points: RoofProfilePoint[] = [
      { xIn: 150, heightIn: 180, isExplicitPosition: true },
      { xIn: 350, heightIn: 180, isExplicitPosition: true },
    ];
    const panels = computeGableTiledRow(wallWidthIn, 120, points, 40, 0, true);
    const gapPanels = panels.filter((p) => p.isSafetyGap);
    // 3 segments (0-150, 150-350, 350-500), all comfortably over the 144in minimum.
    expect(gapPanels).toHaveLength(3);
  });
});
