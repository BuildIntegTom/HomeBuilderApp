import type { Corner, CornerId, Wall, WallEnd } from "./types";

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Tommy's rule: the safety/gap panel goes on the far side of each wall —
 * furthest from the least-accessible corner. Compares straight-line
 * distance from each of the wall's two endpoints to that corner and
 * returns whichever end is farther.
 */
export function computeGapEnd(
  wall: Wall,
  leastAccessibleCornerId: CornerId,
  corners: Corner[],
): WallEnd {
  const leastAccessible = corners.find((c) => c.id === leastAccessibleCornerId)!;
  const start = corners.find((c) => c.id === wall.startCorner)!;
  const end = corners.find((c) => c.id === wall.endCorner)!;

  const distStart = distance(start.point, leastAccessible.point);
  const distEnd = distance(end.point, leastAccessible.point);

  return distEnd >= distStart ? "end" : "start";
}

/**
 * For shapes where every wall owns its own corner panels (octagon, etc. —
 * see `computeGapEnd` for the rectangle's alternative "least-accessible
 * corner" rule), there's no site-wide marker to place the safety/gap panel
 * against. Instead Tommy's rule is per-wall and purely geometric: the
 * "left" corner — as seen by someone standing outside the shell, facing
 * the wall — is always the safety end. For a wall's unit direction `dir`
 * (start->end) and its inward perpendicular, standing outside and facing
 * inward, "left" works out to be the `end` corner exactly when the inward
 * perpendicular is `rotate(dir, +90deg)` (i.e. `pointsInward` below) —
 * otherwise it's the `start` corner.
 */
export function computeSafetyEnd(wall: Wall, corners: Corner[]): WallEnd {
  const start = corners.find((c) => c.id === wall.startCorner)!.point;
  const end = corners.find((c) => c.id === wall.endCorner)!.point;
  const lengthPx = distance(start, end) || 1;
  const dir = { x: (end.x - start.x) / lengthPx, y: (end.y - start.y) / lengthPx };
  const perp = { x: -dir.y, y: dir.x };

  const centerX = corners.reduce((sum, c) => sum + c.point.x, 0) / corners.length;
  const centerY = corners.reduce((sum, c) => sum + c.point.y, 0) / corners.length;
  const pointsInward = perp.x * (centerX - start.x) + perp.y * (centerY - start.y) >= 0;

  return pointsInward ? "end" : "start";
}
