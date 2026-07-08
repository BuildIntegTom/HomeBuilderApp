import type { Footprint, Point } from "./types";
import { isPointInPolygon } from "./pointInPolygon";

export interface PierPosition {
  id: string;
  point: Point;
}

/**
 * Lays out pier positions along the footprint's perimeter walls (the load
 * path piers support is the perimeter beam under each wall) at intervals no
 * larger than `spacingFt`, THEN fills the interior with a spacingFt x
 * spacingFt grid of infill piers (Tommy) — a large floor span needs more
 * than just perimeter support. Each perimeter wall gets its own endpoints
 * plus enough evenly-spaced interior points to keep every gap <= spacingFt
 * (so a wall doesn't necessarily land exactly on multiples of spacingFt,
 * mirroring how seismicBracedPanelSpacingFt is a maximum, not an exact
 * pitch). Interior candidates are filtered to those actually inside the
 * footprint's polygon (not just its bounding box), so a non-rectangular
 * shape (octagon, bump-out) doesn't get infill piers sitting outside the
 * building. Corners/duplicate points are deduped to a single pier.
 */
export function computePierGrid(footprint: Footprint, spacingFt: number): PierPosition[] {
  const positions = new Map<string, Point>();

  for (const wall of footprint.walls) {
    const start = footprint.corners.find((c) => c.id === wall.startCorner)!.point;
    const end = footprint.corners.find((c) => c.id === wall.endCorner)!.point;
    const segments = Math.max(1, Math.ceil(wall.lengthFt / spacingFt));

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const point = { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
      const key = `${point.x.toFixed(4)},${point.y.toFixed(4)}`;
      positions.set(key, point);
    }
  }

  const polygon = footprint.corners.map((c) => c.point);
  const minX = Math.min(...polygon.map((p) => p.x));
  const maxX = Math.max(...polygon.map((p) => p.x));
  const minY = Math.min(...polygon.map((p) => p.y));
  const maxY = Math.max(...polygon.map((p) => p.y));

  for (let x = minX + spacingFt; x < maxX; x += spacingFt) {
    for (let y = minY + spacingFt; y < maxY; y += spacingFt) {
      const point = { x, y };
      if (isPointInPolygon(point, polygon)) {
        const key = `${point.x.toFixed(4)},${point.y.toFixed(4)}`;
        positions.set(key, point);
      }
    }
  }

  return Array.from(positions.values()).map((point, i) => ({ id: `pier-${i}`, point }));
}
