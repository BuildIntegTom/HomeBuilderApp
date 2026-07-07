import type { Corner, Footprint } from "./types";
import { MIN_DIMENSION_FT } from "./footprint";

/**
 * Ratio that clips a square's corners into a *regular* octagon: for a side
 * of length S, clip = S / (2 + sqrt(2)) = S * (1 - 1/sqrt(2)). A non-square
 * bounding box still gets all 45deg/135deg corners, just elongated.
 */
const CLIP_RATIO = 1 - 1 / Math.SQRT2;

/**
 * Clips the 4 corners of a widthFt x depthFt bounding box at 45deg to form
 * an 8-sided footprint. Corners are numbered "0".."7" clockwise starting
 * from the clip point nearest the box's top-left corner (mirroring
 * `buildRectangleFootprint`'s A=(0,0) top-left origin). Every wall — the 4
 * straight sides and the 4 diagonal clips — owns its own corner panels at
 * both ends (Tommy: octagon corners are mitered, each wall contributes its
 * own 24" corner panel), unlike the rectangle's short/long asymmetric rule.
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

  return { corners, walls };
}
