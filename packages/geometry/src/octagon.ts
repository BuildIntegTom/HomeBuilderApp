import { quantizeFootprint } from "./eighths";
import type { Corner, Footprint } from "./types";
import { MIN_DIMENSION_FT } from "./footprint";

/**
 * Ratio that clips a square's corners into a *regular* octagon: for a side
 * of length S, clip = S / (2 + sqrt(2)) = S * (1 - 1/sqrt(2)). A non-square
 * bounding box still gets all 45deg/135deg corners, just elongated.
 */
export const CLIP_RATIO = 1 - 1 / Math.SQRT2;
// Exported since 2026-10-20 so `octagonSize.ts` can SOLVE for the box
// rather than keep a second copy of the ratio. Two copies of a shape
// constant is how a sizing control and the shape it sizes drift apart.

/**
 * Clips the 4 corners of a widthFt x depthFt bounding box at 45deg to form
 * an 8-sided footprint. Corners are numbered "0".."7" clockwise starting
 * from the clip point nearest the box's top-left corner (mirroring
 * `buildRectangleFootprint`'s A=(0,0) top-left origin). Every wall — the 4
 * straight sides and the 4 diagonal clips — owns its own corner panels at
 * both ends (Tommy: octagon corners are mitered, each wall contributes its
 * own 24" corner panel), unlike the rectangle's short/long asymmetric rule.
 *
 * **The octagon is the one shape the 1/8in grid cannot fully contain, and
 * that is mathematics rather than a bug to fix.** `quantizeFootprint` puts
 * all 8 corners on the grid (so repeated edits don't drift, and the 4
 * straight sides come out as exact eighths), but a 45deg wall between two
 * grid points has an irrational length — no rounding rule makes both the
 * corners and the diagonals exact. Snapping the clip corners also moves
 * them by up to 1/16in, so the 8 sides are no longer bit-identically equal
 * (the tests here assert that at 1/16in rather than at 1e-6 for exactly
 * this reason). The residual is absorbed at the mitered corner joint, which
 * is what the safety/gap panel is for. Deliberately NOT done: distorting
 * the octagon to force grid-exact diagonals, which would break the
 * equal-side shape `snapOctagonBoxPx` exists to preserve. See
 * `wallFabricationLengthIn`.
 */
export function buildOctagonFootprint(widthFt: number, depthFt: number): Footprint {
  const width = Math.max(widthFt, MIN_DIMENSION_FT);
  const depth = Math.max(depthFt, MIN_DIMENSION_FT);
  const clip = Math.min(width, depth) * CLIP_RATIO;

  const points = [
    { x: clip, y: 0 },
    { x: width - clip, y: 0 },
    { x: width, y: clip },
    { x: width, y: depth - clip },
    { x: width - clip, y: depth },
    { x: clip, y: depth },
    { x: 0, y: depth - clip },
    { x: 0, y: clip },
  ];

  const corners: Corner[] = points.map((point, i) => ({ id: String(i), point }));

  const walls = corners.map((corner, i) => {
    const next = corners[(i + 1) % corners.length]!;
    const lengthFt = Math.hypot(next.point.x - corner.point.x, next.point.y - corner.point.y);
    return {
      id: `${corner.id}${next.id}`,
      startCorner: corner.id,
      endCorner: next.id,
      lengthFt,
    };
  });

  return quantizeFootprint({ corners, walls });
}
