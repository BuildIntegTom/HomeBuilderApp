import type { Corner, Footprint } from "./types";

export const MIN_DIMENSION_FT = 8;

/**
 * A-B-C-D going clockwise from the origin: A=(0,0), B=(width,0),
 * C=(width,depth), D=(0,depth). Walls: AB/CD run along the width, BC/DA
 * run along the depth.
 */
export function buildRectangleFootprint(widthFt: number, depthFt: number): Footprint {
  const width = Math.max(widthFt, MIN_DIMENSION_FT);
  const depth = Math.max(depthFt, MIN_DIMENSION_FT);

  const corners: Corner[] = [
    { id: "A", point: { x: 0, y: 0 } },
    { id: "B", point: { x: width, y: 0 } },
    { id: "C", point: { x: width, y: depth } },
    { id: "D", point: { x: 0, y: depth } },
  ];

  return {
    corners,
    walls: [
      { id: "AB", startCorner: "A", endCorner: "B", lengthFt: width },
      { id: "BC", startCorner: "B", endCorner: "C", lengthFt: depth },
      { id: "CD", startCorner: "C", endCorner: "D", lengthFt: width },
      { id: "DA", startCorner: "D", endCorner: "A", lengthFt: depth },
    ],
  };
}
