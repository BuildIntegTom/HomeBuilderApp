import type { Corner, Footprint, Point, Wall } from "./types";
import { quantizeFootprint } from "./eighths";
import { wallDirection } from "./cornerAngle";
import { isSelfIntersecting } from "./polygonValidity";

const MIN_NEIGHBOR_LENGTH_FT = 1;
const PARALLEL_EPS = 1e-9;
// Tommy: "when using the drag wall tool, walls can snap back into each
// other and reform a straight one (as if drag wall tool can undo what
// bump out tool did)" — deliberately just above MIN_NEIGHBOR_LENGTH_FT,
// so dragging a neighbor all the way down to dragWall's own floor (the
// most a single drag can ever shrink it) reliably crosses this threshold
// and triggers a collapse, instead of leaving it stranded 1ft short of
// straight forever. See collapseNearZeroWalls below.
const COLLAPSE_THRESHOLD_FT = MIN_NEIGHBOR_LENGTH_FT + 0.1;

/**
 * Tightens a `{ lo, hi }` range for `offsetFt` given a linear constraint
 * `coefficient * offsetFt >= rhs` (dividing by a negative coefficient flips
 * which side of the range it tightens).
 */
function tightenBound(bound: { lo: number; hi: number }, coefficient: number, rhs: number): { lo: number; hi: number } {
  if (coefficient > PARALLEL_EPS) return { lo: Math.max(bound.lo, rhs / coefficient), hi: bound.hi };
  if (coefficient < -PARALLEL_EPS) return { lo: bound.lo, hi: Math.min(bound.hi, rhs / coefficient) };
  return bound;
}

/**
 * Drags one wall for an arbitrary rectilinear (all-90deg-corner) polygon —
 * translates the wall's whole line (both endpoints) by `offsetFt` along its
 * own perpendicular, letting its two immediate neighbors absorb the change
 * by stretching or shrinking. Every other corner — including the far end of
 * each neighbor — stays exactly fixed. This is deliberately different from
 * `editWallLength`: that function keeps the wall's *own* start corner fixed
 * and changes the wall's *own* length by moving one endpoint along the
 * wall's own direction; this one keeps the wall's own length and direction
 * fixed and instead slides the whole thing sideways, so on a plain
 * rectangle the wall *opposite* the one being dragged is completely
 * untouched (verified in tests) — `editWallLength` would change that
 * opposite wall's length too.
 *
 * Provably sound for any rectilinear polygon: a wall's two neighbors are
 * always perpendicular to it (a simple polygon can't have a straight
 * 180deg "corner", and the all-90deg premise rules out any other angle).
 * Translating the wall by a vector parallel to its own perpendicular axis
 * therefore moves each neighbor's near corner along a line parallel to
 * that neighbor's *own* direction — the neighbor doesn't rotate, it only
 * changes length. Both corners at the dragged wall's ends stay valid 90deg
 * turns after the edit, since the wall's own direction and each neighbor's
 * own direction are both unchanged.
 *
 * `offsetFt` is clamped so neither neighbor's resulting length drops below
 * `MIN_NEIGHBOR_LENGTH_FT` — each neighbor's new length is a linear
 * function of `offsetFt` (since its direction is parallel to the drag
 * axis), so the two neighbors' floors are intersected into a single valid
 * range and the requested offset is clamped into it (falling back to a
 * 0ft offset — a no-op translate — in the degenerate case where that range
 * is empty, which shouldn't happen for reasonable geometry).
 *
 * Doesn't renumber corner ids or touch `primaryCornerIds` — like
 * `editWallLength`, this never adds or removes a corner.
 *
 * A no-op (returns `footprint` unchanged) if `wallId` doesn't exist, or if
 * it doesn't have two distinct neighbor walls (a malformed/open wall list,
 * or a degenerate 2-wall loop).
 *
 * The dragged corners land on the 1/8in grid (`quantizeFootprint`) — a drag
 * is the single biggest source of off-grid corner coordinates, and snapping
 * here also means `dragWallBounded`'s scan/bisect verifies
 * `isSelfIntersecting` against the same quantized geometry it ultimately
 * returns, rather than against an unrounded one that could round back into
 * a crossing.
 */
export function dragWall(footprint: Footprint, wallId: string, offsetFt: number): Footprint {
  const wall = footprint.walls.find((w) => w.id === wallId);
  if (!wall) return footprint;
  const prevWall = footprint.walls.find((w) => w.endCorner === wall.startCorner);
  const nextWall = footprint.walls.find((w) => w.startCorner === wall.endCorner);
  if (!prevWall || !nextWall || prevWall.id === nextWall.id) return footprint;

  const dir = wallDirection(wall, footprint.corners);
  const perp: Point = { x: -dir.y, y: dir.x };

  const prevDir = wallDirection(prevWall, footprint.corners);
  const nextDir = wallDirection(nextWall, footprint.corners);
  const s = perp.x * prevDir.x + perp.y * prevDir.y;
  const t = perp.x * nextDir.x + perp.y * nextDir.y;

  let bound = { lo: -Infinity, hi: Infinity };
  bound = tightenBound(bound, s, MIN_NEIGHBOR_LENGTH_FT - prevWall.lengthFt);
  bound = tightenBound(bound, -t, MIN_NEIGHBOR_LENGTH_FT - nextWall.lengthFt);
  const clampedOffsetFt = bound.lo > bound.hi ? 0 : Math.min(bound.hi, Math.max(bound.lo, offsetFt));

  const cornersById = new Map(footprint.corners.map((c) => [c.id, c]));
  const a = cornersById.get(wall.startCorner)!.point;
  const b = cornersById.get(wall.endCorner)!.point;
  const delta: Point = { x: perp.x * clampedOffsetFt, y: perp.y * clampedOffsetFt };
  const aNew: Point = { x: a.x + delta.x, y: a.y + delta.y };
  const bNew: Point = { x: b.x + delta.x, y: b.y + delta.y };

  const corners = footprint.corners.map((c) => {
    if (c.id === wall.startCorner) return { ...c, point: aNew };
    if (c.id === wall.endCorner) return { ...c, point: bNew };
    return c;
  });
  const walls = footprint.walls.map((w) => {
    const start = corners.find((c) => c.id === w.startCorner)!.point;
    const end = corners.find((c) => c.id === w.endCorner)!.point;
    return { ...w, lengthFt: Math.hypot(end.x - start.x, end.y - start.y) };
  });

  return quantizeFootprint({ corners, walls });
}

const SAFETY_SCAN_STEPS = 40;
const SAFETY_BISECT_ITERATIONS = 20;

/**
 * `dragWall`, guarded against producing a self-intersecting polygon —
 * Tommy: "sometimes when i make a bump out and drag the wall, it flips
 * the opposing wall to the other side of the floor layout line and makes
 * the plan look sketchy." `dragWall` only floors its 2 immediate
 * neighbors' lengths; the neighbor that's *growing* (and the dragged wall
 * itself) has no ceiling, and nothing checks the result against any OTHER
 * wall in the footprint — so a large enough drag (most easily reached
 * dragging a bump-out's short jog wall) can slide a corner straight past
 * an unrelated wall, producing a self-intersecting polygon.
 *
 * A plain bisection on `offsetFt` alone isn't provably safe here: the 2
 * neighbor walls extend along a fixed line (monotonic — once a neighbor
 * starts crossing another wall, it keeps crossing for every larger
 * `|offsetFt|`), but the dragged wall itself TRANSLATES rigidly (both
 * endpoints move together), so it can enter a crossing zone against some
 * far-off wall and exit it again at a larger offset — not guaranteed
 * monotonic. Instead: scan outward from 0 (guaranteed safe — `offsetFt=0`
 * is a no-op) in fixed steps toward the requested offset, stop at the
 * FIRST unsafe step, then bisect within that last-safe/first-unsafe
 * bracket. Every accepted value is independently re-verified, so this can
 * never return a self-intersecting result even if the safe/unsafe pattern
 * along the way isn't monotonic — it just finds "the first obstacle"
 * along the drag path, which also matches how `MIN_NEIGHBOR_LENGTH_FT`'s
 * own floor already "stops the drag early" today (clamp, not reject).
 *
 * Costs nothing extra for an ordinary (non-crossing) drag — exactly 1
 * `dragWall` + 1 `isSelfIntersecting` call, same as calling `dragWall`
 * directly. The scan+bisect only runs when the naive result would
 * self-intersect.
 */
export function dragWallBounded(footprint: Footprint, wallId: string, offsetFt: number): Footprint {
  const naive = dragWall(footprint, wallId, offsetFt);
  if (offsetFt === 0 || !isSelfIntersecting(naive)) return naive;

  let lastSafeOffsetFt = 0;
  let firstUnsafeOffsetFt = offsetFt;
  for (let i = 1; i <= SAFETY_SCAN_STEPS; i++) {
    const candidateOffsetFt = (offsetFt * i) / SAFETY_SCAN_STEPS;
    if (isSelfIntersecting(dragWall(footprint, wallId, candidateOffsetFt))) {
      firstUnsafeOffsetFt = candidateOffsetFt;
      break;
    }
    lastSafeOffsetFt = candidateOffsetFt;
  }
  for (let i = 0; i < SAFETY_BISECT_ITERATIONS; i++) {
    const midOffsetFt = (lastSafeOffsetFt + firstUnsafeOffsetFt) / 2;
    if (isSelfIntersecting(dragWall(footprint, wallId, midOffsetFt))) {
      firstUnsafeOffsetFt = midOffsetFt;
    } else {
      lastSafeOffsetFt = midOffsetFt;
    }
  }
  return dragWall(footprint, wallId, lastSafeOffsetFt);
}

export interface CollapseResult {
  footprint: Footprint;
  primaryCornerIds: Set<string>;
}

/**
 * Removes every wall shorter than `COLLAPSE_THRESHOLD_FT`, merging its two
 * flanking corners into one — Tommy: "when using the drag wall tool, walls
 * can snap back into each other and reform a straight one (as if drag wall
 * tool can undo what bump out tool did)". The wall list is always DERIVED
 * from `corners` by connecting consecutive entries (the same convention
 * `insertBumpOut` establishes), so "merge two corners into one" is just
 * "delete one of the two corners" — no manual wall-reference patching
 * needed, and the two walls that used to meet at the deleted wall's far
 * endpoints become one wall automatically once the array closes back up.
 *
 * Deliberately keeps the *start* corner of each near-zero wall and drops
 * its *end* corner — arbitrary but consistent, and irrelevant to the
 * result: both corners sit at (almost) the same point by definition of
 * "near-zero length", so which one survives doesn't change the resulting
 * geometry.
 *
 * Checks wall LENGTH only, never angle/collinearity — a rectilinear
 * bump-out's far wall is always parallel to the wall it was split from, so
 * removing the short jog wall alone is guaranteed to restore a straight
 * line; a separate collinearity check would be redundant, and near-zero
 * walls have numerically unstable direction vectors anyway (dividing by a
 * ~0 length), so length is the only robust signal here.
 *
 * Loops (rather than a single pass) since removing one wall changes its
 * neighbors' effective endpoints, which could in principle cascade —
 * though in practice `dragWall` itself only ever shrinks one neighbor
 * toward the floor per call (its other neighbor grows freely), so a
 * single collapse per drag is the common case. Stops at 4 corners: a valid
 * closed rectilinear polygon needs an even number of corners, and 4 is the
 * smallest (a plain rectangle) — never collapse below that.
 *
 * Corner ids are renumbered "0".."n-1" after every removal (matching
 * `insertBumpOut`'s own renumbering convention), so `primaryCornerIds` is
 * remapped alongside: each surviving corner's old primary status carries
 * over to its new id. The corner that absorbs a merge is NOT specially
 * promoted to primary even if the corner it swallowed was — there's no
 * reliable way to know a merged corner "used to be" primary before an
 * earlier bump-out already un-primaried it, so this is a small, accepted
 * cosmetic gap (consistent with how `primaryCornerIds` already degrades
 * gracefully elsewhere, e.g. in `insertBumpOut`).
 */
export function collapseNearZeroWalls(footprint: Footprint, primaryCornerIds: Set<string>): CollapseResult {
  let corners = footprint.corners;
  let primary = primaryCornerIds;

  let changed = true;
  while (changed && corners.length > 4) {
    changed = false;
    const walls = wallsFromCorners(corners);
    const shortWall = walls.find((w) => w.lengthFt < COLLAPSE_THRESHOLD_FT);
    if (!shortWall) break;

    corners = corners.filter((c) => c.id !== shortWall.endCorner);
    changed = true;
  }

  if (corners === footprint.corners) return { footprint, primaryCornerIds };

  const renumbered: Corner[] = corners.map((c, i) => ({ ...c, id: String(i) }));
  const nextPrimary = new Set<string>();
  corners.forEach((c, i) => {
    if (primary.has(c.id)) nextPrimary.add(String(i));
  });

  return { footprint: quantizeFootprint({ corners: renumbered, walls: wallsFromCorners(renumbered) }), primaryCornerIds: nextPrimary };
}

function wallsFromCorners(corners: Corner[]): Wall[] {
  return corners.map((c, i) => {
    const next = corners[(i + 1) % corners.length]!;
    return {
      id: `${c.id}${next.id}`,
      startCorner: c.id,
      endCorner: next.id,
      lengthFt: Math.hypot(next.point.x - c.point.x, next.point.y - c.point.y),
    };
  });
}

/**
 * `dragWallBounded` followed by a snap-back collapse — Tommy's "undo a
 * bump-out by dragging" feature. Threading `primaryCornerIds` through
 * (rather than leaving it to the caller to reconcile separately) mirrors
 * `insertBumpOut`'s own `{ footprint, primaryCornerIds }` result shape,
 * since a collapse can renumber corner ids exactly like a bump-out can.
 * Uses the self-intersection-guarded drag (not plain `dragWall`) for the
 * same reason every other drag-wall call site does — see
 * `dragWallBounded`'s own doc comment.
 */
export function dragWallWithCollapse(
  footprint: Footprint,
  wallId: string,
  offsetFt: number,
  primaryCornerIds: Set<string>,
): CollapseResult {
  const dragged = dragWallBounded(footprint, wallId, offsetFt);
  return collapseNearZeroWalls(dragged, primaryCornerIds);
}
