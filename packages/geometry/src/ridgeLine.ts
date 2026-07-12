import type { Footprint, Point, Wall } from "./types";

/**
 * The real (X,Y) point `positionIn` inches along a wall from its start
 * corner — footprint coordinates are in feet (see buildRectangleFootprint),
 * so this converts positionIn to a 0..1 fraction of the wall's own length
 * before interpolating between its start/end corner points.
 */
export function wallPointAtPositionIn(wall: Wall, footprint: Footprint, positionIn: number): Point {
  const start = footprint.corners.find((c) => c.id === wall.startCorner)!.point;
  const end = footprint.corners.find((c) => c.id === wall.endCorner)!.point;
  const wallLengthIn = wall.lengthFt * 12;
  const t = wallLengthIn > 0 ? positionIn / wallLengthIn : 0;
  return { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
}

export interface RidgeLine {
  /** Gable wall A's real peak point (footprint coordinates, feet). */
  pointA: Point;
  /** Gable wall B's real peak point (footprint coordinates, feet). */
  pointB: Point;
  /** Straight-line distance between the two peak points, in inches — the
   * roof-catcher beam's real run length (see computeRoofCatcherBeamSegments
   * in panel-catalog). */
  runIn: number;
}

/**
 * The roof-catcher beam's real path between two Gable End walls' Column
 * Panels — each bears at its own wall's peak position (Tommy's draggable
 * gable peak; see computeGableTiledRow), so the line runs from wall A's
 * actual peak point to wall B's actual peak point, not just the building's
 * perpendicular depth. If the two peaks aren't mirrored across the
 * building, this is a straight but non-perpendicular line (a legitimate,
 * if unusual, beam run) rather than an approximation. A peak position
 * missing from `peakPositionInByWallId` defaults to that wall's own
 * midpoint, matching the elevation view's own default.
 */
export function computeRidgeLine(
  footprint: Footprint,
  wallAId: string,
  wallBId: string,
  peakPositionInByWallId: Record<string, number>,
): RidgeLine | null {
  const wallA = footprint.walls.find((w) => w.id === wallAId);
  const wallB = footprint.walls.find((w) => w.id === wallBId);
  if (!wallA || !wallB) return null;

  const peakAIn = peakPositionInByWallId[wallAId] ?? (wallA.lengthFt * 12) / 2;
  const peakBIn = peakPositionInByWallId[wallBId] ?? (wallB.lengthFt * 12) / 2;
  const pointA = wallPointAtPositionIn(wallA, footprint, peakAIn);
  const pointB = wallPointAtPositionIn(wallB, footprint, peakBIn);
  const runFt = Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y);

  return { pointA, pointB, runIn: runFt * 12 };
}

/** The real (X,Y) point `positionIn` inches along a ridge line from pointA
 * — used to place a roof-catcher-beam post (see
 * computeRoofCatcherBeamPostPositions in panel-catalog) at its real
 * footprint position, e.g. to cross-check against the pier grid. */
export function pointAlongRidgeLine(ridge: RidgeLine, positionIn: number): Point {
  const t = ridge.runIn > 0 ? positionIn / ridge.runIn : 0;
  return {
    x: ridge.pointA.x + (ridge.pointB.x - ridge.pointA.x) * t,
    y: ridge.pointA.y + (ridge.pointB.y - ridge.pointA.y) * t,
  };
}
