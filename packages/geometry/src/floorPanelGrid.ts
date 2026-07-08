import type { Footprint } from "./types";
import { computeGridBays } from "./pierGrid";
import { isPointInPolygon } from "./pointInPolygon";

export interface FloorPanelRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Floor panels tiled across the same bay grid the piers sit at the
 * corners of (see computeGridBays) — the floor structure that spans pier
 * to pier on the beams below (Tommy: the Floor editor "intakes most of
 * its prompts from the foundation editor", so it shares the exact same
 * spacing/bay boundaries rather than having its own independent grid).
 * A bay becomes a panel if its center point is inside the footprint's
 * polygon (the same simplification already used for interior pier
 * placement) — not clipped to the exact polygon boundary, so a bay that's
 * mostly but not entirely inside a mitered/bumped-out edge still renders
 * as one full rectangular panel. Named sequentially in reading order
 * (left to right, top to bottom).
 */
export function computeFloorPanelGrid(footprint: Footprint, spacingFt: number): FloorPanelRect[] {
  const { polygon, minX, minY, colsX, rowsY, stepX, stepY } = computeGridBays(footprint, spacingFt);
  const panels: FloorPanelRect[] = [];
  let counter = 0;

  for (let j = 0; j < rowsY; j++) {
    for (let i = 0; i < colsX; i++) {
      const x = minX + i * stepX;
      const y = minY + j * stepY;
      const center = { x: x + stepX / 2, y: y + stepY / 2 };
      if (isPointInPolygon(center, polygon)) {
        counter += 1;
        panels.push({ id: `F-${counter}`, x, y, width: stepX, height: stepY });
      }
    }
  }

  return panels;
}
