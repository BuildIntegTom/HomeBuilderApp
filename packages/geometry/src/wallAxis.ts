import type { Footprint, Wall } from "./types";

export interface WallAxis {
  startXFt: number;
  startZFt: number;
  dirX: number;
  dirZ: number;
  /** Rotation around the vertical axis, radians — matches `panelSlotBoxes3D`'s
   * own convention exactly (0 = wall runs along +X); negate it for a Three.js
   * `rotation.y`. */
  rotationRad: number;
}

/**
 * A wall's raw corner-to-corner basis (start point, unit direction,
 * rotation) — the same `start`/`dir`/`rotationRad` math `panelSlotBoxes3D`
 * computes per wall before applying `cornerOwnership`'s inset/extra-length
 * adjustments (this file deliberately stops short of that: gable tiles and
 * roof-bearing segments are both positioned along a wall's own real
 * `wall.lengthFt`, corner to corner, not the retiled/corner-owned slot
 * length `panelSlotBoxes3D` itself needs). Feet in, feet out — matching
 * every other 3D-placement helper's own unit convention.
 */
export function wallAxis(footprint: Footprint, wall: Wall): WallAxis {
  const start = footprint.corners.find((c) => c.id === wall.startCorner)!.point;
  const end = footprint.corners.find((c) => c.id === wall.endCorner)!.point;
  const dx = end.x - start.x;
  const dz = end.y - start.y;
  const length = Math.hypot(dx, dz) || 1;
  return {
    startXFt: start.x,
    startZFt: start.y,
    dirX: dx / length,
    dirZ: dz / length,
    rotationRad: Math.atan2(dz, dx),
  };
}
