import type { Corner, Footprint, Point } from "./types";
import { quantizeFootprint } from "./eighths";

/**
 * The consistent winding order every footprint in this app is built and
 * maintained in (`buildRectangleFootprint`/`buildOctagonFootprint`'s own
 * comments: corners "clockwise" on screen — Y increasing downward) means a
 * wall's outward normal is always this fixed -90deg rotation of its own
 * direction vector, for ANY wall on ANY valid (non-self-intersecting)
 * polygon, convex or not — a polygon's winding is a global, not local,
 * property, so this never depends on the shape's overall geometry. This
 * replaced an earlier centroid-based heuristic (checking which side of the
 * footprint's own vertex-average a wall's midpoint fell on) that broke down
 * after a few bump-outs: a notch or addition clusters several new corners
 * tightly in one spot, which skews a plain arithmetic mean far more than it
 * skews the shape's true interior, and once skewed enough it can flip which
 * side reads as "outward" for an unrelated wall elsewhere on the building —
 * sending that wall's own new bump-out shooting off in the wrong direction
 * (Tommy: "it sends a shorter wall onto the other side of the perimeter").
 * Mirrored in apps/web/app/canvasGeometry.ts's `signedDepthFt` (the live
 * drag preview) — keep both in sync.
 */
export function outwardNormal(dir: Point): Point {
  return { x: dir.y, y: -dir.x };
}

const MARGIN_FT = 2; // Tommy: never leave a remainder wall shorter than 2ft (defensive floor — the UI layer snaps to this same rule before calling in)
// The bump-out's depth becomes the length of its 2 new perpendicular walls,
// and both ends of each of those walls own a corner panel (they're always
// the locally-shortest wall at their own corners) — too shallow a depth
// wouldn't leave room for 2 corner panels side by side. This geometry
// layer doesn't know the actual confirmed corner panel width (that's a
// panel-catalog/page-level concern), so 5ft is a conservative floor rather
// than an exact fit; `tileWall` also clamps defensively in case a caller
// ever passes an unusually wide corner panel anyway.
const MIN_DEPTH_FT = 5;
const MAX_INWARD_FRACTION = 0.8; // notches can't cross past 80% of the way to the centroid

function footprintCentroid(footprint: Footprint): Point {
  return {
    x: footprint.corners.reduce((sum, c) => sum + c.point.x, 0) / footprint.corners.length,
    y: footprint.corners.reduce((sum, c) => sum + c.point.y, 0) / footprint.corners.length,
  };
}

/**
 * "Push/pull an edge" polygon operation: replaces one wall with up to 5 —
 * shortened original-direction segment, 2 new perpendicular segments, a new
 * parallel segment (the bump-out's far wall, or the notch's back wall), and
 * the other shortened remainder — turning it into a small jog with its own
 * (still 90deg) corners.
 *
 * `spanStartFt`/`spanEndFt` are distances along the wall from its start
 * corner (order doesn't matter). Each end is snapped to either flush (0
 * remainder) or held back a minimum margin — never a tiny sliver in
 * between. A flush end drops its remainder segment entirely: the jog
 * merges straight into whichever wall used to meet the original wall at
 * that corner (that corner's point just moves outward/inward by `depthFt`,
 * extending the adjoining wall) instead of leaving a zero-length nub. So
 * this replaces one wall with 5 walls when neither end is flush, 3 when
 * one end is, or 2 when both are (the whole wall shifts by `depthFt` with
 * no new corners at all).
 *
 * `depthFt`'s sign picks the direction: positive pulls the span outward
 * (an addition), negative pushes it inward (a notch) — clamped so a notch
 * can't cross past most of the way to the footprint's centroid, which
 * would otherwise cut through the opposite side of the building.
 *
 * Corners come back renumbered "0".."n-1" (matching `buildOctagonFootprint`'s
 * convention for a non-lettered shape) rather than trying to preserve the
 * old ids — same as every other footprint-changing operation, this
 * discards existing openings/tiling and the caller should do a full retile.
 * A no-op (returns `footprint` unchanged) if `wallId` doesn't exist.
 */
export interface InsertBumpOutResult {
  footprint: Footprint;
  /** `primaryCornerIds`, remapped through the renumbering — see the param doc. */
  primaryCornerIds: Set<string>;
}

/**
 * `primaryCornerIds` tracks which of the *input* footprint's corners are
 * "original" (as opposed to introduced by an earlier bump-out) — since
 * every call renumbers corners "0".."n-1" from scratch, an unchanged
 * corner's id can still shift, so this is remapped through that
 * renumbering and returned for the caller to carry forward across repeated
 * bump-outs. Whichever corners this call introduces are never primary (a
 * flush end introduces none of its own — see below). This is also what a
 * wall's "originality" is derived from elsewhere (a wall
 * counts as original if at least one of its two endpoints is primary) —
 * see `apps/web/app/page.tsx`'s corner-ownership rule.
 */
export function insertBumpOut(
  footprint: Footprint,
  wallId: string,
  spanStartFt: number,
  spanEndFt: number,
  depthFt: number,
  primaryCornerIds: Set<string>,
): InsertBumpOutResult {
  const wall = footprint.walls.find((w) => w.id === wallId);
  if (!wall) return { footprint, primaryCornerIds };

  const start = footprint.corners.find((c) => c.id === wall.startCorner)!.point;
  const end = footprint.corners.find((c) => c.id === wall.endCorner)!.point;
  const wallLengthFt = wall.lengthFt;
  const dir = { x: (end.x - start.x) / wallLengthFt, y: (end.y - start.y) / wallLengthFt };

  const FLUSH_EPS_FT = 1e-6;
  // Each end is either flush with its nearest wall corner (0 remainder —
  // the bump-out's jog merges straight into the adjoining wall instead of
  // leaving a sliver of the original wall behind, see below) or held back
  // at least MARGIN_FT from it — never something in between. Mirrors the
  // UI's own snapping (`snapSpanPointFt` in FootprintCanvas.tsx) and
  // defends against callers (like tests) that bypass it.
  const clampSpanEnd = (v: number): number => {
    if (v <= FLUSH_EPS_FT) return 0;
    if (v >= wallLengthFt - FLUSH_EPS_FT) return wallLengthFt;
    return Math.max(MARGIN_FT, Math.min(v, wallLengthFt - MARGIN_FT));
  };
  let a = clampSpanEnd(Math.min(spanStartFt, spanEndFt));
  let b = clampSpanEnd(Math.max(spanStartFt, spanEndFt));
  if (b - a < MARGIN_FT) {
    // Degenerate span after clamping (e.g. a very short wall, or a tiny
    // drag) — fall back to a small span centered on the wall.
    const mid = wallLengthFt / 2;
    a = Math.max(MARGIN_FT / 2, mid - MARGIN_FT / 2);
    b = Math.min(wallLengthFt - MARGIN_FT / 2, mid + MARGIN_FT / 2);
  }
  const startFlush = a <= FLUSH_EPS_FT;
  const endFlush = b >= wallLengthFt - FLUSH_EPS_FT;

  const centroid = footprintCentroid(footprint);
  const wallMid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const outward = outwardNormal(dir);

  // Purely a depth-magnitude safety clamp (how far a notch can cut inward
  // before it risks crossing the opposite side of the building) — distance-
  // to-centroid is a fine, non-fragile stand-in for that, since only the
  // *direction* heuristic (replaced above) was ever the fragile part.
  const maxInwardFt = Math.hypot(wallMid.x - centroid.x, wallMid.y - centroid.y) * MAX_INWARD_FRACTION;
  let depth = depthFt;
  if (Math.abs(depth) < MIN_DEPTH_FT) depth = depth < 0 ? -MIN_DEPTH_FT : MIN_DEPTH_FT;
  if (depth < 0) depth = Math.max(depth, -maxInwardFt);

  // A flush end has no `pa`/`pb` of its own — the jog's outward point
  // (`paOut`/`pbOut`) takes over that corner's position directly instead,
  // merging the jog straight into whichever wall used to meet the wall
  // being bumped there (no separate zero-length remainder segment).
  const pa: Point | null = startFlush ? null : { x: start.x + dir.x * a, y: start.y + dir.y * a };
  const pb: Point | null = endFlush ? null : { x: start.x + dir.x * b, y: start.y + dir.y * b };
  const paBase = pa ?? start;
  const pbBase = pb ?? end;
  const paOut: Point = { x: paBase.x + outward.x * depth, y: paBase.y + outward.y * depth };
  const pbOut: Point = { x: pbBase.x + outward.x * depth, y: pbBase.y + outward.y * depth };

  interface PendingPoint {
    point: Point;
    isPrimary: boolean;
  }
  const withNewPoints: PendingPoint[] = [];
  for (const corner of footprint.corners) {
    let point = corner.point;
    if (corner.id === wall.startCorner && startFlush) point = paOut;
    if (corner.id === wall.endCorner && endFlush) point = pbOut;
    withNewPoints.push({ point, isPrimary: primaryCornerIds.has(corner.id) });
    if (corner.id === wall.startCorner) {
      if (!startFlush) {
        withNewPoints.push({ point: pa!, isPrimary: false }, { point: paOut, isPrimary: false });
      }
      if (!endFlush) {
        withNewPoints.push({ point: pbOut, isPrimary: false }, { point: pb!, isPrimary: false });
      }
    }
  }

  const corners: Corner[] = withNewPoints.map((p, i) => ({ id: String(i), point: p.point }));
  const walls = corners.map((corner, i) => {
    const next = corners[(i + 1) % corners.length]!;
    const lengthFt = Math.hypot(next.point.x - corner.point.x, next.point.y - corner.point.y);
    return { id: `${corner.id}${next.id}`, startCorner: corner.id, endCorner: next.id, lengthFt };
  });

  const nextPrimaryCornerIds = new Set<string>();
  withNewPoints.forEach((p, i) => {
    if (p.isPrimary) nextPrimaryCornerIds.add(String(i));
  });

  // Every new corner the jog introduces lands on the 1/8in grid, so the
  // bump-out's own walls (and the two remainder segments it leaves behind on
  // the original wall) all have exact-eighth lengths to tile against.
  return { footprint: quantizeFootprint({ corners, walls }), primaryCornerIds: nextPrimaryCornerIds };
}
