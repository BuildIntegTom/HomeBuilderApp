import type { Corner, Footprint, Wall } from "./types";

const RIGHT_ANGLE_TOLERANCE_RAD = 1e-6;

/** Unit direction vector (start->end) of a wall. */
export function wallDirection(wall: Wall, corners: Corner[]): { x: number; y: number } {
  const start = corners.find((c) => c.id === wall.startCorner)!.point;
  const end = corners.find((c) => c.id === wall.endCorner)!.point;
  const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  return { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
}

/**
 * The turn angle (radians, [0, PI]) at the corner shared by two consecutive
 * walls — `incomingWall` ends where `outgoingWall` starts. This is the
 * angle between the two wall directions, not the interior angle of the
 * polygon (e.g. a plain rectangle's corners are PI/2 turns; an octagon's
 * clipped corners are PI/4 turns).
 */
export function cornerTurnAngleRad(incomingWall: Wall, outgoingWall: Wall, corners: Corner[]): number {
  const a = wallDirection(incomingWall, corners);
  const b = wallDirection(outgoingWall, corners);
  return Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y)));
}

export function isRightAngleCorner(turnAngleRad: number): boolean {
  return Math.abs(turnAngleRad - Math.PI / 2) < RIGHT_ANGLE_TOLERANCE_RAD;
}

/**
 * True for a convex corner (the boundary tightens toward the interior,
 * like any rectangle corner or the outside corners of a bump-out), false
 * for a reflex/concave one (like a bump-out's *inside* corners, where the
 * boundary bulges away from the interior instead). Uses the signed cross
 * product of the two wall directions — for our clockwise winding with the
 * interior always on the right of travel (the same convention already used
 * for inward/outward checks elsewhere), convex corners give a positive
 * cross product and reflex corners a negative one. `cornerTurnAngleRad`'s
 * unsigned angle can't tell these apart (a 90deg turn reads the same
 * either way); this is the necessary companion check for the two to be
 * treated differently (see `apps/web/app/page.tsx`'s corner-ownership
 * rule for a reflex corner's different treatment).
 */
export function isConvexCorner(incomingWall: Wall, outgoingWall: Wall, corners: Corner[]): boolean {
  const a = wallDirection(incomingWall, corners);
  const b = wallDirection(outgoingWall, corners);
  return a.x * b.y - a.y * b.x > 0;
}

/**
 * True when every corner in the footprint is a plain 90deg turn (a
 * rectangle, or a bump-out built on one) — false as soon as any corner is
 * mitered (an octagon). Replaces the old `corners.length === 4` proxy,
 * which breaks once a bump-out can add corners to a rectangle without
 * changing the corner *type* at any of them.
 */
export function footprintIsAllRightAngles(footprint: Footprint): boolean {
  return footprint.walls.every((wall) => {
    const nextWall = footprint.walls.find((w) => w.startCorner === wall.endCorner);
    if (!nextWall) return true; // malformed/open wall list — nothing to check
    return isRightAngleCorner(cornerTurnAngleRad(wall, nextWall, footprint.corners));
  });
}
