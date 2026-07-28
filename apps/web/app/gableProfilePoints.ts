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

/** Selectable standard roof pitches (rise:12 run) for the Elevation
 * sidebar's Shed/Centered Peak dropdowns. */
export const ROOF_PITCH_OPTIONS_IN12 = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Rise (ft, rounded to the nearest inch) for a given pitch over a given
 * run — shared by the Shed dropdown (run = the wall's own full width) and
 * the Centered Peak dropdown (run = half the wall's width, since a
 * centered peak splits the rise symmetrically). `heelOffsetIn` (default 0)
 * adds a flat energy-heel amount on top of the sloped portion's own rise —
 * see `resolveHeelSeat`, which callers use to derive both this and the
 * run they pass in. */
export function computeRiseFtForPitch(pitchIn12: number, runIn: number, heelOffsetIn = 0): number {
  return (Math.round(runIn * (pitchIn12 / 12)) + heelOffsetIn) / 12;
}

/**
 * How much an energy-heel truss seat (`heelHeightIn`) shortens a side's own
 * real sloped run, and raises its own starting height, when picking a pitch
 * from the Shed/Centered Peak dropdowns — mirrors gableTiledRow.ts's own
 * `resolveAnchors` "does the seat fit" check exactly (`heelFits`), so a
 * dropdown-picked pitch always matches what the real tiled roofline (and
 * the per-side slope labels reading off it) will actually show, instead of
 * the naive corner-to-peak figure. `cornerCount` is 1 for a Shed pitch (only
 * the far, non-snapped corner is heel-eligible — the snapped/near corner is
 * claimed by the point itself) or 2 for a Centered Peak pitch (a re-centered
 * peak's own position is never "explicit", so neither corner ever
 * shed-claims — see resolveAnchors). Returns zero offsets if heel is
 * disabled, or the wall is too narrow to fit the seat(s) needed. */
export function resolveHeelSeat(
  wallWidthIn: number,
  standardWidthIn: number,
  heelHeightIn: number,
  cornerCount: 1 | 2,
): { runOffsetIn: number; heelOffsetIn: number } {
  const seatWidthNeededIn = cornerCount * standardWidthIn;
  const heelFits = heelHeightIn > 0 && seatWidthNeededIn > 0 && seatWidthNeededIn <= wallWidthIn;
  return heelFits ? { runOffsetIn: standardWidthIn, heelOffsetIn: heelHeightIn } : { runOffsetIn: 0, heelOffsetIn: 0 };
}

/** Reverse lookup: does a real rise/run ratio land on one of the
 * dropdown's own selectable pitches (within half an inch of rise, to
 * absorb the rounding computeRiseFtForPitch already applies)? Used by the
 * Elevation diagram's per-side slope labels to show "4/12" instead of a
 * raw degree figure once a dragged peak's own actual slope happens to
 * match a standard pitch again. */
export function matchStandardPitchIn12(riseIn: number, runIn: number): number | null {
  if (runIn <= 0) return null;
  const pitchIn12 = (riseIn * 12) / runIn;
  const rounded = Math.round(pitchIn12);
  if (rounded < ROOF_PITCH_OPTIONS_IN12[0]! || rounded > ROOF_PITCH_OPTIONS_IN12.at(-1)!) return null;
  return Math.abs(riseIn - (rounded / 12) * runIn) < 0.5 ? rounded : null;
}
