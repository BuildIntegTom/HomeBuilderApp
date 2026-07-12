import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { buildOctagonFootprint } from "./octagon";
import { computePierGrid, isPointNearPier, nearestPierDistanceFt } from "./pierGrid";

describe("computePierGrid", () => {
  it("places a pier every spacingFt around a rectangle's 100ft perimeter, deduped at shared corners", () => {
    const fp = buildRectangleFootprint(30, 20); // A(0,0) B(30,0) C(30,20) D(0,20), perimeter 100ft
    const piers = computePierGrid(fp, 10);

    const points = piers.map((p) => p.point);
    for (const expected of [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 10 },
      { x: 30, y: 20 },
      { x: 20, y: 20 },
      { x: 10, y: 20 },
      { x: 0, y: 20 },
      { x: 0, y: 10 },
    ]) {
      expect(points).toContainEqual(expected);
    }
  });

  it("fills the interior with a spacingFt grid, in addition to the perimeter", () => {
    const fp = buildRectangleFootprint(30, 20);
    const piers = computePierGrid(fp, 10);
    // Perimeter (10, hand-verified above) + interior infill at (10,10) and (20,10).
    const points = piers.map((p) => p.point);
    expect(points).toContainEqual({ x: 10, y: 10 });
    expect(points).toContainEqual({ x: 20, y: 10 });
    expect(piers).toHaveLength(12);
  });

  it("excludes interior infill candidates that fall outside a non-rectangular (octagon) footprint", () => {
    // Same clip geometry as isPointInPolygon's octagon test: 40x20, clip ~5.858.
    const fp = buildOctagonFootprint(40, 20);
    const piers = computePierGrid(fp, 2);
    const points = piers.map((p) => p.point);
    // (2,2) sits in the clipped-off top-left triangle - must be excluded...
    expect(points).not.toContainEqual({ x: 2, y: 2 });
    // ...while a nearby candidate just past the clip line is kept.
    expect(points).toContainEqual({ x: 2, y: 4 });
    // ...and the unambiguous center is kept.
    expect(points).toContainEqual({ x: 20, y: 10 });
  });

  it("never leaves a gap larger than spacingFt, even when the wall length doesn't divide evenly", () => {
    const fp = buildRectangleFootprint(30, 20);
    const spacingFt = 8;
    const piers = computePierGrid(fp, spacingFt);

    // Reconstruct perimeter order (A -> B -> C -> D -> A) and check consecutive gaps.
    const order = ["A", "B", "C", "D"];
    const cornerPoint = (id: string) => fp.corners.find((c) => c.id === id)!.point;
    for (let i = 0; i < order.length; i++) {
      const wall = fp.walls.find((w) => w.startCorner === order[i] && w.endCorner === order[(i + 1) % order.length])!;
      const start = cornerPoint(wall.startCorner);
      const end = cornerPoint(wall.endCorner);
      const along = piers
        .map((p) => p.point)
        .filter((pt) => isOnSegment(pt, start, end))
        .map((pt) => Math.hypot(pt.x - start.x, pt.y - start.y))
        .sort((a, b) => a - b);
      for (let j = 1; j < along.length; j++) {
        expect(along[j]! - along[j - 1]!).toBeLessThanOrEqual(spacingFt + 1e-6);
      }
    }
  });

  it("dedupes shared corners instead of double-counting them", () => {
    const fp = buildRectangleFootprint(20, 20); // 80ft perimeter
    const piers = computePierGrid(fp, 20); // 1 segment per wall -> exactly the 4 corners
    expect(piers).toHaveLength(4);
  });

  it("keeps the interior grid on the same pitch as the perimeter instead of a fixed spacingFt step (regression: previously drifted further out of alignment the farther from the origin corner, visible as a 'bowing' grid on a large building)", () => {
    // 50ft doesn't divide evenly by 6ft (50/6 = 8.33) - the real-world case
    // that exposed the bug. Top wall AB: 9 bays of 50/9 = 5.5556ft each.
    const fp = buildRectangleFootprint(50, 20);
    const spacingFt = 6;
    const piers = computePierGrid(fp, spacingFt);
    const points = piers.map((p) => p.point);

    const bayX = 50 / 9; // perimeter's own evenly-divided top/bottom wall pitch
    const bayY = 20 / 4; // perimeter's own evenly-divided left/right wall pitch (20/6 -> ceil 4 bays of 5ft)

    // Old (buggy) behavior would have placed this at (6,5) or (6,6) - a fixed
    // 6ft step from the origin corner, off-pitch from the perimeter's own 5.5556ft bays.
    expect(points).toContainEqual({ x: bayX, y: bayY });
    expect(points.some((p) => Math.abs(p.x - 6) < 1e-6)).toBe(false);

    // Every interior pier's x must land on one of the perimeter's own bay
    // lines (a multiple of bayX from the origin), not merely "close" to one.
    const interiorPoints = points.filter((p) => p.x > 1e-6 && p.x < 50 - 1e-6 && p.y > 1e-6 && p.y < 20 - 1e-6);
    expect(interiorPoints.length).toBeGreaterThan(0);
    for (const p of interiorPoints) {
      const bayIndexX = p.x / bayX;
      expect(bayIndexX).toBeCloseTo(Math.round(bayIndexX), 6);
    }
  });
});

describe("nearestPierDistanceFt / isPointNearPier", () => {
  const fp = buildRectangleFootprint(30, 20);
  const piers = computePierGrid(fp, 10); // includes a pier at (10, 10)

  it("returns 0 for a point exactly on a pier", () => {
    expect(nearestPierDistanceFt({ x: 10, y: 10 }, piers)).toBeCloseTo(0, 6);
    expect(isPointNearPier({ x: 10, y: 10 }, piers)).toBe(true);
  });

  it("returns the straight-line distance to the closest pier", () => {
    expect(nearestPierDistanceFt({ x: 10, y: 10.3 }, piers)).toBeCloseTo(0.3, 6);
  });

  it("is false when the nearest pier is farther than the tolerance", () => {
    expect(isPointNearPier({ x: 15, y: 15 }, piers, 0.5)).toBe(false);
  });

  it("is true when within a wider explicit tolerance", () => {
    expect(isPointNearPier({ x: 10, y: 10.4 }, piers, 0.5)).toBe(true);
    expect(isPointNearPier({ x: 10, y: 10.6 }, piers, 0.5)).toBe(false);
  });

  it("returns Infinity/false for an empty pier list", () => {
    expect(nearestPierDistanceFt({ x: 0, y: 0 }, [])).toBe(Infinity);
    expect(isPointNearPier({ x: 0, y: 0 }, [])).toBe(false);
  });
});

function isOnSegment(pt: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }): boolean {
  const cross = (pt.x - start.x) * (end.y - start.y) - (pt.y - start.y) * (end.x - start.x);
  if (Math.abs(cross) > 1e-6) return false;
  const dot = (pt.x - start.x) * (end.x - start.x) + (pt.y - start.y) * (end.y - start.y);
  const lenSq = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
  return dot >= -1e-6 && dot <= lenSq + 1e-6;
}
