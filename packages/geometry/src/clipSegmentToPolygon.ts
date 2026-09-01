import { isPointInPolygon } from "./pointInPolygon";
import type { Point } from "./types";

/** Coincidence tolerance in FEET — two positions along the segment closer
 * than this are the same position, and a point this close to the polygon's
 * boundary is ON it. Same magnitude and same reasoning as
 * `floorMembranePolygons.ts`'s own `POINT_TOLERANCE_FT`: the inputs here are
 * exact arithmetic on footprint corner coordinates, so real floating-point
 * noise sits many orders below this, and no real building feature is a
 * billionth of a foot. Purely numerical, not a building value. */
const POINT_TOLERANCE_FT = 1e-9;

/** One maximal run of a segment that lies inside the polygon. Endpoints are
 * in the same coordinate space as the inputs (feet, for footprint space). */
export interface ClippedSpan {
  start: Point;
  end: Point;
}

const cross = (ax: number, ay: number, bx: number, by: number): number => ax * by - ay * bx;

function distanceToSegmentFt(p: Point, a: Point, b: Point): number {
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const lenSq = ex * ex + ey * ey;
  if (lenSq <= 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.y - a.y) * ey) / lenSq));
  return Math.hypot(p.x - (a.x + ex * t), p.y - (a.y + ey * t));
}

function isOnPolygonBoundary(p: Point, polygon: Point[]): boolean {
  for (let i = 0; i < polygon.length; i++) {
    if (distanceToSegmentFt(p, polygon[i]!, polygon[(i + 1) % polygon.length]!) <= POINT_TOLERANCE_FT) return true;
  }
  return false;
}

/**
 * The parts of ONE line segment that lie inside a closed polygon — zero, one
 * or SEVERAL disjoint spans (a segment crossing a U-shaped polygon's notch
 * comes back as two).
 *
 * WHY NOT `clipRingToHalfPlane` (floorMembranePolygons.ts): that clips a RING
 * against a half-plane and its job is to come back with area. A segment has
 * no area, so running it through a polygon-clipper would collapse it. This is
 * the 1-D analogue and is deliberately built as one: gather every parameter
 * along the segment where it could possibly change from inside to outside,
 * then let the polygon itself classify each resulting interval by its
 * midpoint.
 *
 * That midpoint classification is what makes this IMMUNE to the degeneracy
 * class `clipRingToHalfPlane` has an open item for (a footprint edge lying
 * exactly on a clip boundary produces a collinear "spike" in the returned
 * ring, which `dropRepeatedPoints` can't see because the points aren't
 * repeated). Here a collinear polygon edge or a vertex merely grazing the
 * line contributes extra BREAKPOINTS, never extra output: an interval is
 * emitted only if its own midpoint tests inside, adjacent kept intervals are
 * merged back into one span, and intervals shorter than the coincidence
 * tolerance are dropped. So a breakpoint that doesn't actually change
 * inside/outside is absorbed rather than turning into a doubled or
 * zero-length span.
 *
 * BOUNDARY COUNTS AS INSIDE. The polygon is treated as closed, so a segment
 * running exactly along one of its edges is kept in full. This is not a
 * tie-breaking nicety — it is load-bearing for the caller: field framing's
 * outermost lines sit exactly on the inset polygon's own edge on every
 * rectangle, and treating the boundary as outside would silently delete them.
 *
 * `polygon` is a closed ring's vertices in order, first point NOT repeated at
 * the end (the same convention `isPointInPolygon` and
 * `computeFootprintAreaSqFt` use). Winding doesn't matter.
 */
export function clipSegmentToPolygon(start: Point, end: Point, polygon: Point[]): ClippedSpan[] {
  if (polygon.length < 3) return [];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthFt = Math.hypot(dx, dy);
  if (lengthFt <= POINT_TOLERANCE_FT) return [];
  // Tolerances converted into the segment's own 0..1 parameter space, so a
  // "1e-9 ft" tolerance means the same physical distance on a 4ft segment and
  // on a 60ft one.
  const tTol = POINT_TOLERANCE_FT / lengthFt;

  const params: number[] = [0, 1];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const edgeLen = Math.hypot(ex, ey);
    if (edgeLen <= POINT_TOLERANCE_FT) continue; // degenerate edge
    const denom = cross(dx, dy, ex, ey);
    const wx = a.x - start.x;
    const wy = a.y - start.y;
    // |denom| = |d||e|sin(theta): comparing it against the tolerance scaled by
    // both lengths makes this an angle test rather than a magnitude test, so
    // it behaves the same on a 2ft polygon and a 200ft one.
    if (Math.abs(denom) <= POINT_TOLERANCE_FT * lengthFt * edgeLen) {
      // Parallel. Only a COLLINEAR edge can bound an inside/outside change
      // along this line; a merely-parallel one never touches it.
      if (Math.abs(cross(wx, wy, dx, dy)) > POINT_TOLERANCE_FT * lengthFt) continue;
      const lenSq = dx * dx + dy * dy;
      params.push((wx * dx + wy * dy) / lenSq);
      params.push(((b.x - start.x) * dx + (b.y - start.y) * dy) / lenSq);
      continue;
    }
    const t = cross(wx, wy, ex, ey) / denom;
    const s = cross(wx, wy, dx, dy) / denom;
    const sTol = POINT_TOLERANCE_FT / edgeLen;
    if (s < -sTol || s > 1 + sTol) continue; // crossing is off the end of this edge
    params.push(t);
  }

  const sorted = params
    .map((t) => (t < 0 ? 0 : t > 1 ? 1 : t))
    .sort((a, b) => a - b)
    .filter((t, i, arr) => i === 0 || t - arr[i - 1]! > tTol);
  if (sorted.length < 2) return [];

  const at = (t: number): Point => ({ x: start.x + dx * t, y: start.y + dy * t });

  // Classify each interval between consecutive breakpoints, then merge runs
  // of kept ones — a breakpoint that didn't actually change inside/outside
  // (a grazed vertex, the end of a collinear edge) must not split a span.
  const kept: { from: number; to: number }[] = [];
  for (let i = 0; i + 1 < sorted.length; i++) {
    const from = sorted[i]!;
    const to = sorted[i + 1]!;
    const mid = at((from + to) / 2);
    if (!isPointInPolygon(mid, polygon) && !isOnPolygonBoundary(mid, polygon)) continue;
    const last = kept[kept.length - 1];
    if (last && from - last.to <= tTol) last.to = to;
    else kept.push({ from, to });
  }

  return kept.filter((span) => span.to - span.from > tTol).map((span) => ({ start: at(span.from), end: at(span.to) }));
}
