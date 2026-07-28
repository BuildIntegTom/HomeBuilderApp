import { GABLE_SHED_SNAP_THRESHOLD_IN } from "@building-integrity/geometry";

export { GABLE_SHED_SNAP_THRESHOLD_IN };

/** Default along-wall position for a profile point that hasn't been
 * explicitly customized — the single midpoint for a peaked (1-point)
 * profile, or a symmetric flat run spanning the middle third for a
 * flat-top (2-point) profile. */
function defaultPointXIn(pointIndex: number, pointCount: number, wallWidthIn: number): number {
  return pointCount === 1 ? wallWidthIn / 2 : ((pointIndex + 1) * wallWidthIn) / 3;
}

export interface ResolvedGableProfilePoints {
  pointCount: number;
  resolvedPointXsIn: number[];
  pointIsExplicit: boolean[];
  pointIsSnapped: boolean[];
  isShedRoof: boolean;
}

/**
 * Resolves each roof profile point's own along-wall position, whether it's
 * explicitly stored or defaulted, and whether it's snapped to a single-slope
 * shed — the one piece of gable-profile math both the Elevation diagram
 * (drag handle placement) and the Elevation sidebar controls (slider/input
 * values, "snapped to shed" text) need identically, so it's a single shared
 * function rather than two independently-maintained copies that could drift.
 * Mirrors page.tsx's own gableTilesByWallId resolution exactly.
 */
export function resolveGableProfilePoints(
  roofProfilePointHeightsFt: number[],
  gableProfilePositionsIn: (number | null)[],
  wallWidthIn: number,
): ResolvedGableProfilePoints {
  const pointCount = roofProfilePointHeightsFt.length;
  const resolvedPointXsIn = roofProfilePointHeightsFt.map((_, i) => {
    const stored = gableProfilePositionsIn[i];
    return Math.min(Math.max(stored ?? defaultPointXIn(i, pointCount, wallWidthIn), 0), wallWidthIn);
  });
  // Snap decision is always against the raw wall ends, never inset-adjusted
  // — whether a point snaps to a shed doesn't depend on insetIn (see
  // computeGableTiledRow's own doc comment). Only an explicitly-positioned
  // point (a real stored value, not the auto-default) can snap.
  const pointIsExplicit = roofProfilePointHeightsFt.map((_, i) => gableProfilePositionsIn[i] != null);
  const pointIsSnapped = resolvedPointXsIn.map(
    (xIn, i) => pointIsExplicit[i] && (xIn < GABLE_SHED_SNAP_THRESHOLD_IN || xIn > wallWidthIn - GABLE_SHED_SNAP_THRESHOLD_IN),
  );
  const isShedRoof = pointIsSnapped.some(Boolean);
  return { pointCount, resolvedPointXsIn, pointIsExplicit, pointIsSnapped, isShedRoof };
}
