import type { Footprint, Point } from "./types";

function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** True if any 2 non-adjacent walls cross — a sign a footprint-editing
 * operation (bump-out, drag-wall, ...) sent a wall shooting off in the
 * wrong direction instead of staying a simple (non-self-intersecting)
 * polygon. Originally a private test-only helper in bumpOut.test.ts (used
 * to fuzz-test chained bump-outs); promoted here so `dragWall`'s own
 * bounding guard (`dragWallBounded`) can reuse the same check live,
 * rather than only in tests. */
export function isSelfIntersecting(fp: Footprint): boolean {
  const cornersById = new Map(fp.corners.map((c) => [c.id, c.point]));
  for (let i = 0; i < fp.walls.length; i++) {
    for (let j = i + 1; j < fp.walls.length; j++) {
      const w1 = fp.walls[i]!;
      const w2 = fp.walls[j]!;
      if ([w1.startCorner, w1.endCorner].some((id) => id === w2.startCorner || id === w2.endCorner)) continue;
      if (
        segmentsIntersect(
          cornersById.get(w1.startCorner)!,
          cornersById.get(w1.endCorner)!,
          cornersById.get(w2.startCorner)!,
          cornersById.get(w2.endCorner)!,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}
