import type { Footprint, Point } from "./types";
import { wallDirection } from "./cornerAngle";

const MIN_WALL_LENGTH_FT = 1;

/**
 * Edits one wall's length for an arbitrary rectilinear (all-90deg-corner)
 * polygon — the general fallback used once a shape's had a bump-out added,
 * where the rectangle/octagon "regenerate the whole shape from 2 numbers"
 * shortcuts no longer apply (too many free parameters).
 *
 * Keeps the wall's start corner (A) fixed and moves its end corner (B)
 * along the wall's own original direction to hit the new length. The very
 * next wall (B->C) is then rigidly translated by that same move (so it
 * keeps its own exact length and direction — it doesn't rotate or stretch)
 * by shifting C by the same delta. Every other corner is untouched.
 *
 * This is provably consistent for any rectilinear polygon: since every
 * corner is a 90deg turn, a wall's direction is always parallel to either
 * of exactly 2 perpendicular axes throughout the whole shape. B's move is
 * parallel to wall A-B's axis, which is perpendicular to wall B-C's axis
 * (so translating C by it can't rotate B-C) and parallel to wall C-D's
 * axis (so it only ever changes C-D's *length*, never its direction) —
 * corners B and C both stay valid 90deg turns after the edit. For a plain
 * rectangle this reduces to exactly the existing "opposite wall changes
 * too" behavior (verified in tests), generalized to work after a wall's
 * been split up by one or more bump-outs.
 *
 * Doesn't renumber corner ids or touch `primaryCornerIds` — unlike
 * `insertBumpOut`, this never adds or removes a corner, so every id stays
 * exactly as valid as it was before the edit.
 *
 * A no-op (returns `footprint` unchanged) if `wallId` doesn't exist or is
 * the last wall before the loop closes back onto itself in a way that
 * leaves no distinct "next" wall (a malformed/open wall list).
 */
export function editWallLength(footprint: Footprint, wallId: string, newLengthFt: number): Footprint {
  const wall = footprint.walls.find((w) => w.id === wallId);
  if (!wall) return footprint;
  const nextWall = footprint.walls.find((w) => w.startCorner === wall.endCorner);
  if (!nextWall || nextWall.endCorner === wall.startCorner) return footprint;

  const cornersById = new Map(footprint.corners.map((c) => [c.id, c]));
  const a = cornersById.get(wall.startCorner)!.point;
  const bOld = cornersById.get(wall.endCorner)!.point;
  const cOld = cornersById.get(nextWall.endCorner)!.point;

  const dir = wallDirection(wall, footprint.corners);
  const clampedLengthFt = Math.max(MIN_WALL_LENGTH_FT, newLengthFt);
  const bNew: Point = { x: a.x + dir.x * clampedLengthFt, y: a.y + dir.y * clampedLengthFt };
  const delta: Point = { x: bNew.x - bOld.x, y: bNew.y - bOld.y };
  const cNew: Point = { x: cOld.x + delta.x, y: cOld.y + delta.y };

  const corners = footprint.corners.map((c) => {
    if (c.id === wall.endCorner) return { ...c, point: bNew };
    if (c.id === nextWall.endCorner) return { ...c, point: cNew };
    return c;
  });
  const walls = footprint.walls.map((w) => {
    const start = corners.find((c) => c.id === w.startCorner)!.point;
    const end = corners.find((c) => c.id === w.endCorner)!.point;
    return { ...w, lengthFt: Math.hypot(end.x - start.x, end.y - start.y) };
  });

  return { corners, walls };
}
