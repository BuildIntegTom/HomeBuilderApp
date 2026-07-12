import type { Footprint, Point } from "./types";
import { isPointInPolygon } from "./pointInPolygon";

export interface PierPosition {
  id: string;
  point: Point;
}

export interface GridBays {
  polygon: Point[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  colsX: number;
  rowsY: number;
  stepX: number;
  stepY: number;
}

/**
 * The footprint's bounding-box divided into an evenly-spaced grid of bays,
 * no larger than `spacingFt` on a side — "evenly divide the span, ceil'd
 * up to the nearest whole number of bays" (not a fixed spacingFt step
 * counted from the corner), so a wall/span that doesn't divide evenly by
 * spacingFt still gets a *uniform* pitch across its whole length instead
 * of drifting off it (e.g. a 53.3ft span at 6ft spacing divides into 9
 * bays of 5.93ft each, all equal — not 8 bays of 6ft plus one short one).
 * Shared by computePierGrid (piers sit at bay corners) and
 * computeFloorPanelGrid (floor panels fill the bays themselves), so the
 * two always agree on identical boundaries.
 */
export function computeGridBays(footprint: Footprint, spacingFt: number): GridBays {
  const polygon = footprint.corners.map((c) => c.point);
  const minX = Math.min(...polygon.map((p) => p.x));
  const maxX = Math.max(...polygon.map((p) => p.x));
  const minY = Math.min(...polygon.map((p) => p.y));
  const maxY = Math.max(...polygon.map((p) => p.y));

  const colsX = Math.max(1, Math.ceil((maxX - minX) / spacingFt));
  const rowsY = Math.max(1, Math.ceil((maxY - minY) / spacingFt));
  const stepX = (maxX - minX) / colsX;
  const stepY = (maxY - minY) / rowsY;

  return { polygon, minX, minY, maxX, maxY, colsX, rowsY, stepX, stepY };
}

/**
 * Lays out pier positions along the footprint's perimeter walls (the load
 * path piers support is the perimeter beam under each wall) at intervals no
 * larger than `spacingFt`, THEN fills the interior with a grid of infill
 * piers (Tommy) — a large floor span needs more than just perimeter
 * support. Each perimeter wall gets its own endpoints plus enough
 * evenly-spaced interior points to keep every gap <= spacingFt (so a wall
 * doesn't necessarily land exactly on multiples of spacingFt, mirroring
 * how seismicBracedPanelSpacingFt is a maximum, not an exact pitch). The
 * interior grid shares its bay boundaries with `computeGridBays` (see its
 * own doc comment for why that matters), so the interior grid's pitch
 * always matches the perimeter's own pitch instead of drifting apart
 * across a large building (previously visible as a "bowing" grid).
 * Interior candidates are filtered to those actually inside the
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

  const { polygon, minX, minY, colsX, rowsY, stepX, stepY } = computeGridBays(footprint, spacingFt);

  for (let i = 1; i < colsX; i++) {
    for (let j = 1; j < rowsY; j++) {
      const point = { x: minX + i * stepX, y: minY + j * stepY };
      if (isPointInPolygon(point, polygon)) {
        const key = `${point.x.toFixed(4)},${point.y.toFixed(4)}`;
        positions.set(key, point);
      }
    }
  }

  return Array.from(positions.values()).map((point, i) => ({ id: `pier-${i}`, point }));
}

/** Straight-line distance (ft) from `point` to the nearest pier — Infinity
 * for an empty pier list. */
export function nearestPierDistanceFt(point: Point, piers: PierPosition[]): number {
  if (piers.length === 0) return Infinity;
  return Math.min(...piers.map((p) => Math.hypot(p.point.x - point.x, p.point.y - point.y)));
}

/**
 * Whether `point` (e.g. a roof-catcher-beam post's real footprint position
 * — see pointAlongRidgeLine) lands within `toleranceFt` of an existing pier
 * — Tommy: "posts under them that correlate to piers." A false result means
 * the post needs a new pier at that spot; this only checks the existing
 * grid, it doesn't add one (see isPostPositionOnPier's own doc comment in
 * roofCatcherBeamMembers.ts for the analogous 1D version of this idea).
 */
export function isPointNearPier(point: Point, piers: PierPosition[], toleranceFt = 0.5): boolean {
  return nearestPierDistanceFt(point, piers) <= toleranceFt;
}
