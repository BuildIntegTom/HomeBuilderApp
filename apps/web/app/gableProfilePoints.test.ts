import { describe, expect, it } from "vitest";
import {
  capGableTileHeights,
  computeRiseFtForPitch,
  GABLE_SHED_SNAP_THRESHOLD_IN,
  matchStandardPitchIn12,
  resolveGableProfilePoints,
  resolveHeelSeat,
} from "./gableProfilePoints";

describe("resolveGableProfilePoints", () => {
  it("defaults a 1-point (peaked) profile to the wall's midpoint, not explicit, not snapped", () => {
    const result = resolveGableProfilePoints([16], [null], 240);
    expect(result.pointCount).toBe(1);
    expect(result.resolvedPointXsIn).toEqual([120]);
    expect(result.pointIsExplicit).toEqual([false]);
    expect(result.pointIsSnapped).toEqual([false]);
    expect(result.isShedRoof).toBe(false);
  });

  it("defaults a 2-point (flat-top) profile to a symmetric middle-third split", () => {
    const result = resolveGableProfilePoints([16, 16], [null, null], 240);
    expect(result.pointCount).toBe(2);
    expect(result.resolvedPointXsIn).toEqual([80, 160]);
    expect(result.pointIsExplicit).toEqual([false, false]);
    expect(result.isShedRoof).toBe(false);
  });

  it("respects an explicit stored position, clamped to [0, wallWidthIn]", () => {
    const inRange = resolveGableProfilePoints([16], [50], 240);
    expect(inRange.resolvedPointXsIn).toEqual([50]);
    expect(inRange.pointIsExplicit).toEqual([true]);

    const belowRange = resolveGableProfilePoints([16], [-10], 240);
    expect(belowRange.resolvedPointXsIn).toEqual([0]);

    const aboveRange = resolveGableProfilePoints([16], [300], 240);
    expect(aboveRange.resolvedPointXsIn).toEqual([240]);
  });

  it("snaps only an explicitly-positioned point within the threshold of either end", () => {
    const atLeftEdge = resolveGableProfilePoints([16], [GABLE_SHED_SNAP_THRESHOLD_IN - 1], 240);
    expect(atLeftEdge.pointIsSnapped).toEqual([true]);
    expect(atLeftEdge.isShedRoof).toBe(true);

    const justOutsideLeft = resolveGableProfilePoints([16], [GABLE_SHED_SNAP_THRESHOLD_IN + 1], 240);
    expect(justOutsideLeft.pointIsSnapped).toEqual([false]);
    expect(justOutsideLeft.isShedRoof).toBe(false);

    const atRightEdge = resolveGableProfilePoints([16], [240 - (GABLE_SHED_SNAP_THRESHOLD_IN - 1)], 240);
    expect(atRightEdge.pointIsSnapped).toEqual([true]);

    const exactlyAtThreshold = resolveGableProfilePoints([16], [GABLE_SHED_SNAP_THRESHOLD_IN], 240);
    expect(exactlyAtThreshold.pointIsSnapped).toEqual([false]); // strictly-less-than, the boundary itself doesn't snap
  });

  it("never snaps a defaulted (non-explicit) position, even if it lands within the snap threshold", () => {
    // A narrow wall where the default midpoint itself falls inside the snap zone.
    const result = resolveGableProfilePoints([16], [null], 30);
    expect(result.resolvedPointXsIn).toEqual([15]);
    expect(result.pointIsExplicit).toEqual([false]);
    expect(result.pointIsSnapped).toEqual([false]);
    expect(result.isShedRoof).toBe(false);
  });

  it("isShedRoof is true if ANY point is snapped, in a multi-point profile", () => {
    const oneSnapped = resolveGableProfilePoints([16, 16], [5, 120], 240);
    expect(oneSnapped.pointIsSnapped).toEqual([true, false]);
    expect(oneSnapped.isShedRoof).toBe(true);
  });
});

describe("computeRiseFtForPitch", () => {
  it("computes rise for a shed run (full wall width)", () => {
    // 20ft wall (240in), 4/12 pitch -> 240 * 4/12 = 80in = 6.6666...ft, rounded to the nearest inch.
    expect(computeRiseFtForPitch(4, 240)).toBeCloseTo(80 / 12, 6);
  });

  it("computes rise for a centered-peak run (half the wall width)", () => {
    // 20ft wall, centered peak run = 120in, 12/12 pitch -> 120in rise = 10ft exactly.
    expect(computeRiseFtForPitch(12, 120)).toBe(10);
  });

  it("rounds the rise to the nearest inch", () => {
    // 100in run, 6/12 pitch -> 50in exactly -> 50/12ft.
    expect(computeRiseFtForPitch(6, 100)).toBeCloseTo(50 / 12, 6);
  });

  it("adds a flat heel offset on top of the sloped portion's own rise", () => {
    // 100in run, 6/12 pitch -> 50in sloped rise, +6in heel -> 56/12ft.
    expect(computeRiseFtForPitch(6, 100, 6)).toBeCloseTo(56 / 12, 6);
  });
});

describe("resolveHeelSeat", () => {
  it("returns zero offsets when heel is disabled", () => {
    expect(resolveHeelSeat(240, 40, 0, 1)).toEqual({ runOffsetIn: 0, heelOffsetIn: 0 });
  });

  it("returns a one-seat offset for a shed's own single (far) eligible corner", () => {
    // Mirrors gableTiledRow.ts's resolveAnchors: cornerCount=1 -> seatWidthNeededIn = 40, fits in a 240in wall.
    expect(resolveHeelSeat(240, 40, 6, 1)).toEqual({ runOffsetIn: 40, heelOffsetIn: 6 });
  });

  it("returns a two-seat offset for a centered peak's own two eligible corners", () => {
    expect(resolveHeelSeat(240, 40, 6, 2)).toEqual({ runOffsetIn: 40, heelOffsetIn: 6 });
  });

  it("falls back to zero offsets when the seat(s) needed wouldn't fit the wall", () => {
    // cornerCount=2 needs 2*40=80in of seat; a 60in wall can't fit it.
    expect(resolveHeelSeat(60, 40, 6, 2)).toEqual({ runOffsetIn: 0, heelOffsetIn: 0 });
  });
});

describe("capGableTileHeights", () => {
  it("passes true heights through untouched when the taller edge already fits under the cap", () => {
    expect(capGableTileHeights(60, 90, 96)).toEqual({ leftEdgeHeightIn: 60, rightEdgeHeightIn: 90 });
  });

  it("stays sloped at the exact boundary — tallerIn === capHeightIn does not trigger flattening", () => {
    expect(capGableTileHeights(60, 96, 96)).toEqual({ leftEdgeHeightIn: 60, rightEdgeHeightIn: 96 });
  });

  it("flattens both edges to the cap when both true edges are above it", () => {
    // Both 100 and 110 exceed 96 -> flat at 96, gaps are each edge's own overflow.
    const result = capGableTileHeights(100, 110, 96);
    expect(result.leftEdgeHeightIn).toBe(96);
    expect(result.rightEdgeHeightIn).toBe(96);
    expect(result.verticalGapIn).toEqual({ leftIn: 4, rightIn: 14 });
  });

  it("flattens a straddling tile to its own shorter TRUE edge, not the cap — one gap is exactly 0", () => {
    // Left (80) is under the 96 cap, right (110) is over it. Flattening to
    // 80 (not 96) never makes the panel stick up past the true roofline on
    // the left, where the roof is only 80in — flattening to 96 would.
    const result = capGableTileHeights(80, 110, 96);
    expect(result.leftEdgeHeightIn).toBe(80);
    expect(result.rightEdgeHeightIn).toBe(80);
    expect(result.verticalGapIn).toEqual({ leftIn: 0, rightIn: 30 });
  });

  it("straddling case, mirrored (right edge is the shorter true one)", () => {
    const result = capGableTileHeights(110, 80, 96);
    expect(result.leftEdgeHeightIn).toBe(80);
    expect(result.rightEdgeHeightIn).toBe(80);
    expect(result.verticalGapIn).toEqual({ leftIn: 30, rightIn: 0 });
  });

  it("an already-flat tile above the cap flattens to the cap itself, same as the general 2-edges-over case", () => {
    expect(capGableTileHeights(120, 120, 96)).toEqual({
      leftEdgeHeightIn: 96,
      rightEdgeHeightIn: 96,
      verticalGapIn: { leftIn: 24, rightIn: 24 },
    });
  });

  it("an already-flat tile under the cap passes through with no gap", () => {
    expect(capGableTileHeights(60, 60, 96)).toEqual({ leftEdgeHeightIn: 60, rightEdgeHeightIn: 60 });
  });
});

describe("matchStandardPitchIn12", () => {
  it("matches an exact pitch", () => {
    expect(matchStandardPitchIn12(80, 240)).toBe(4); // 80/240*12 = 4
  });

  it("matches within half an inch of rise (rounding tolerance)", () => {
    expect(matchStandardPitchIn12(80.3, 240)).toBe(4);
    expect(matchStandardPitchIn12(79.7, 240)).toBe(4);
  });

  it("returns null when rise is not close to any standard pitch", () => {
    expect(matchStandardPitchIn12(85, 240)).toBeNull(); // 5in off from the nearest (4/12 = 80in)
  });

  it("returns null when the nearest pitch falls outside the 2-12/12 selectable range", () => {
    expect(matchStandardPitchIn12(5, 240)).toBeNull(); // ~0.25/12, below the 2/12 floor
    expect(matchStandardPitchIn12(260, 240)).toBeNull(); // 13/12, above the 12/12 ceiling
  });

  it("returns null for a non-positive run", () => {
    expect(matchStandardPitchIn12(80, 0)).toBeNull();
    expect(matchStandardPitchIn12(80, -10)).toBeNull();
  });
});
