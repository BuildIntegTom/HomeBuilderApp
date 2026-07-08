import type { Point } from "./types";

/**
 * Standard ray-casting point-in-polygon test: counts how many times a
 * horizontal ray from `point` to +infinity crosses the polygon's edges —
 * odd means inside, even means outside. `polygon` must be a closed ring's
 * vertices in order (not repeating the first point at the end); works for
 * any simple polygon, convex or not (e.g. an octagon's clipped corners, or
 * a bump-out's notch).
 */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i]!;
    const pj = polygon[j]!;
    const crosses =
      pi.y > point.y !== pj.y > point.y &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x;
    if (crosses) inside = !inside;
  }
  return inside;
}
