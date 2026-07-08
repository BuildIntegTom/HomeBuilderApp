import { describe, expect, it } from "vitest";
import { computeFloorPanelGrid } from "./floorPanelGrid";
import { buildRectangleFootprint } from "./footprint";
import { buildOctagonFootprint } from "./octagon";

describe("computeFloorPanelGrid", () => {
  it("tiles a rectangle into evenly-sized bays covering the whole area, no gaps or overlaps", () => {
    const fp = buildRectangleFootprint(30, 20);
    const panels = computeFloorPanelGrid(fp, 10); // 3 cols x 2 rows = 6 bays, all inside
    expect(panels).toHaveLength(6);

    const totalArea = panels.reduce((sum, p) => sum + p.width * p.height, 0);
    expect(totalArea).toBeCloseTo(30 * 20, 6);

    // Every panel is a clean 10x10 bay.
    for (const p of panels) {
      expect(p.width).toBeCloseTo(10, 6);
      expect(p.height).toBeCloseTo(10, 6);
    }
  });

  it("names panels sequentially in reading order (left to right, top to bottom)", () => {
    const fp = buildRectangleFootprint(30, 20);
    const panels = computeFloorPanelGrid(fp, 10);
    expect(panels.map((p) => p.id)).toEqual(["F-1", "F-2", "F-3", "F-4", "F-5", "F-6"]);
    // F-1 is the top-left bay.
    expect(panels[0]).toMatchObject({ x: 0, y: 0 });
  });

  it("shares the exact same bay boundaries as computePierGrid's interior pier positions", () => {
    // A 50ft span (doesn't divide evenly by 6ft) - the same case that
    // exposed the pier-grid bowing bug; floor panels must land on the
    // identical bay lines, not a fixed 6ft step.
    const fp = buildRectangleFootprint(50, 20);
    const panels = computeFloorPanelGrid(fp, 6);
    const bayX = 50 / 9;
    expect(panels.some((p) => Math.abs(p.x - bayX) < 1e-6)).toBe(true);
    expect(panels.some((p) => Math.abs(p.x - 6) < 1e-6)).toBe(false);
  });

  it("excludes a bay whose center falls outside a non-rectangular (octagon) footprint", () => {
    // Same clip geometry as isPointInPolygon's octagon test: 40x20, clip ~5.858.
    const fp = buildOctagonFootprint(40, 20);
    const panels = computeFloorPanelGrid(fp, 4); // 10 cols x 5 rows of 4x4 bays
    // The very first bay (0,0)-(4,4) has its center (2,2) in the clipped
    // top-left triangle (x+y=4 < 5.858) - must be excluded.
    expect(panels.some((p) => p.x === 0 && p.y === 0)).toBe(false);
    // A bay further from the corner, e.g. (16,0)-(20,4) center (18,2), is unambiguously inside.
    expect(panels.some((p) => Math.abs(p.x - 16) < 1e-6 && p.y === 0)).toBe(true);
  });
});
