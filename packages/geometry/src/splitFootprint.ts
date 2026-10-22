import { quantizeFootprint } from "./eighths";
import { computeFootprintAreaSqFt } from "./footprintArea";
import { isPointInPolygon } from "./pointInPolygon";
import type { Corner, Footprint, Point, Wall } from "./types";

/**
 * DRAWING A WALL ACROSS A BUILDING, AND KEEPING ONE SIDE.
 *
 * Tommy, 2026-10-20, on how a trapezoid gets made:
 *
 * > *"if a user makes new wall tool and adds an enclosed space - so they can
 * > delete the other wall and have a trapezoid building"*
 *
 * and on 2026-10-21, choosing between the two ways of giving him that:
 *
 * > *"For number one I like your suggestion there."*
 *
 * So: a wall drawn from one corner to another cuts the ring into **two closed
 * regions**, the app offers both, and the one he does not keep is discarded
 * whole.
 *
 * ⚠ **The result is always a valid closed ring, by construction rather than by
 * checking afterwards.** The footprint was a closed ring before the cut; each
 * arc between the two corners plus the chord is closed again. The alternative —
 * delete a wall and re-close the hole — can leave an open ring, parallel
 * neighbours that never meet, or a self-intersecting shape the rest of the app
 * has never seen. That is why this is first and a true delete tool is second.
 *
 * ⚠ **PANELS SURVIVE THE CUT.** Every wall in a kept region is the same wall it
 * was, so `wallIdMap` carries old id -> new id and the caller feeds that to the
 * same shape-change path a bump-out uses. Only the chord is new, and a new wall
 * having no panels yet is correct rather than a loss. Without the map the ids
 * renumber and every wall in the building silently loses its windows, doors and
 * hand-set widths.
 */

/** Corners are renumbered `"0".."n-1"` in ring order, the convention
 * `insertBumpOut` and `buildOctagonFootprint` already use for any shape that is
 * no longer a plain lettered rectangle. */
const renumbered = (index: number): string => String(index);

export interface SplitRegion {
  footprint: Footprint;
  /**
   * The old wall id each wall in this region came from, keyed by its NEW id.
   * `null` for the chord, which is new and has no panels to inherit.
   */
  wallIdMap: Record<string, string | null>;
  /** The chord's id in this region. Both regions have one; they are different
   * walls with opposite winding. */
  chordWallId: string;
  areaSqFt: number;
}

export type SplitRefusal =
  | { reason: "same-corner" }
  | { reason: "adjacent-corners" }
  | { reason: "not-on-footprint"; cornerId: string }
  | { reason: "chord-outside" }
  | { reason: "chord-crosses-a-wall"; wallId: string };

export interface SplitResult {
  /** Always exactly two, in the order the ring was walked: the region from A
   * round to B first, then the region from B round to A. The caller sorts or
   * labels them for the user; this does not assume which is wanted. */
  regions: [SplitRegion, SplitRegion];
}

const pointOf = (fp: Footprint, id: string): Point | null => fp.corners.find((c) => c.id === id)?.point ?? null;

/** The walls in ring order starting at the wall that LEAVES `cornerId`. */
function ringFrom(fp: Footprint, cornerId: string): Wall[] | null {
  const first = fp.walls.find((w) => w.startCorner === cornerId);
  if (!first) return null;
  const out: Wall[] = [first];
  let cursor = first;
  for (let guard = 0; guard < fp.walls.length + 1; guard++) {
    const next = fp.walls.find((w) => w.startCorner === cursor.endCorner);
    if (!next || next.id === first.id) return out;
    out.push(next);
    cursor = next;
  }
  return null; // not a closed ring
}

/**
 * Do segments AB and CD properly cross — sharing an endpoint does not count.
 *
 * Exported since 2026-10-22 so `offsetFootprint` can ask the same question
 * rather than keep a second copy. A geometric predicate with two
 * implementations is one that will eventually disagree with itself about an
 * edge case, and both callers use it to decide whether a shape is valid.
 */
export function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const side = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const EPS = 1e-9;
  const shares = (p: Point, q: Point) => Math.abs(p.x - q.x) < EPS && Math.abs(p.y - q.y) < EPS;
  if (shares(a, c) || shares(a, d) || shares(b, c) || shares(b, d)) return false;
  const d1 = side(a, b, c);
  const d2 = side(a, b, d);
  const d3 = side(c, d, a);
  const d4 = side(c, d, b);
  return ((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) && ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS));
}

/** Build a closed footprint from an ordered list of points. */
function footprintFromPoints(points: Point[], sourceWallIds: (string | null)[]): {
  footprint: Footprint;
  wallIdMap: Record<string, string | null>;
} {
  const corners: Corner[] = points.map((point, i) => ({ id: renumbered(i), point }));
  const wallIdMap: Record<string, string | null> = {};
  const walls: Wall[] = corners.map((corner, i) => {
    const next = corners[(i + 1) % corners.length]!;
    const id = `${corner.id}${next.id}`;
    wallIdMap[id] = sourceWallIds[i] ?? null;
    return {
      id,
      startCorner: corner.id,
      endCorner: next.id,
      lengthFt: Math.hypot(next.point.x - corner.point.x, next.point.y - corner.point.y),
    };
  });
  return { footprint: quantizeFootprint({ corners, walls }), wallIdMap };
}

/**
 * Cut a footprint along the chord between two of its corners.
 *
 * @returns the two regions, or a refusal naming what is wrong with the chord.
 *   Refusals are returned rather than thrown because every one of them is
 *   something a user can do with the pointer, and the editor shows them as
 *   guidance rather than as errors.
 */
export function splitFootprintByChord(
  footprint: Footprint,
  cornerIdA: string,
  cornerIdB: string,
): SplitResult | SplitRefusal {
  if (cornerIdA === cornerIdB) return { reason: "same-corner" };
  const pa = pointOf(footprint, cornerIdA);
  const pb = pointOf(footprint, cornerIdB);
  if (!pa) return { reason: "not-on-footprint", cornerId: cornerIdA };
  if (!pb) return { reason: "not-on-footprint", cornerId: cornerIdB };

  const ring = ringFrom(footprint, cornerIdA);
  if (!ring || ring.length !== footprint.walls.length) return { reason: "not-on-footprint", cornerId: cornerIdA };

  const splitAt = ring.findIndex((w) => w.endCorner === cornerIdB);
  if (splitAt < 0) return { reason: "not-on-footprint", cornerId: cornerIdB };

  /* Each arc must carry at least TWO walls. One wall plus the chord is a
     two-sided region enclosing nothing — which is what adjacent corners give,
     since the chord would simply retrace the wall between them. */
  const arcAtoB = ring.slice(0, splitAt + 1);
  const arcBtoA = ring.slice(splitAt + 1);
  if (arcAtoB.length < 2 || arcBtoA.length < 2) return { reason: "adjacent-corners" };

  /* ⚠ The chord has to stay INSIDE the building. On a convex shape every chord
     does; on one with a bump-out a chord can leave through the notch and come
     back, which would produce two regions that overlap and a building that is
     not the shape anyone drew. Checked two ways, because neither alone is
     enough: the midpoint must be inside, and the chord must not properly cross
     any wall. A chord can cross a wall with its midpoint still inside, and it
     can leave through a reflex notch without crossing anything. */
  const polygon = footprint.corners.map((c) => c.point);
  const midpoint = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
  if (!isPointInPolygon(midpoint, polygon)) return { reason: "chord-outside" };
  for (const wall of footprint.walls) {
    const ws = pointOf(footprint, wall.startCorner)!;
    const we = pointOf(footprint, wall.endCorner)!;
    if (segmentsCross(pa, pb, ws, we)) return { reason: "chord-crosses-a-wall", wallId: wall.id };
  }

  const region = (arc: Wall[]): SplitRegion => {
    /* The arc's corners in order, then the chord closes it: the arc runs from
       its first wall's start to its last wall's end, and the chord goes back. */
    const points = arc.map((w) => pointOf(footprint, w.startCorner)!);
    points.push(pointOf(footprint, arc[arc.length - 1]!.endCorner)!);
    // One source wall per edge, and `null` for the closing chord.
    const sources: (string | null)[] = [...arc.map((w) => w.id), null];
    const built = footprintFromPoints(points, sources);
    const chordWallId = Object.keys(built.wallIdMap).find((id) => built.wallIdMap[id] === null)!;
    return {
      footprint: built.footprint,
      wallIdMap: built.wallIdMap,
      chordWallId,
      areaSqFt: computeFootprintAreaSqFt(built.footprint),
    };
  };

  return { regions: [region(arcAtoB), region(arcBtoA)] };
}

/** Narrowing helper, so call sites read as a question rather than a cast. */
export function isSplitRefusal(result: SplitResult | SplitRefusal): result is SplitRefusal {
  return "reason" in result;
}

/** What to tell the user about a refused chord — one sentence, no jargon. */
export function splitRefusalMessage(refusal: SplitRefusal): string {
  switch (refusal.reason) {
    case "same-corner":
      return "Pick two different corners — a wall needs two ends.";
    case "adjacent-corners":
      return "Those corners already have a wall between them. Pick two that are further apart.";
    case "not-on-footprint":
      return "That point isn't a corner of this building.";
    case "chord-outside":
      return "That wall would run outside the building. Pick two corners the wall can reach across.";
    case "chord-crosses-a-wall":
      return `That wall would cross wall ${refusal.wallId}. Pick two corners with a clear line between them.`;
  }
}
