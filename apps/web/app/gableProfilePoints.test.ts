import { describe, expect, it } from "vitest";
import { GABLE_SHED_SNAP_THRESHOLD_IN, resolveGableProfilePoints } from "./gableProfilePoints";

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
