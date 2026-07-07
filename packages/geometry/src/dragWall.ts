import type { Footprint, Point } from "./types";
import { wallDirection } from "./cornerAngle";

const MIN_NEIGHBOR_LENGTH_FT = 1;
const PARALLEL_EPS = 1e-9;

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

  return { corners, walls };
}
