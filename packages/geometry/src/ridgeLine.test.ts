import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { computeRidgeLine, pointAlongRidgeLine, wallPointAtPositionIn } from "./ridgeLine";

describe("wallPointAtPositionIn", () => {
  it("returns the start corner at positionIn = 0", () => {
    const fp = buildRectangleFootprint(30, 20); // A(0,0) B(30,0) C(30,20) D(0,20)
    const ab = fp.walls.find((w) => w.id === "AB")!;
    expect(wallPointAtPositionIn(ab, fp, 0)).toEqual({ x: 0, y: 0 });
  });

  it("returns the midpoint at half the wall's length", () => {
    const fp = buildRectangleFootprint(30, 20);
    const ab = fp.walls.find((w) => w.id === "AB")!; // 30ft = 360in long, runs A(0,0) -> B(30,0)
    const mid = wallPointAtPositionIn(ab, fp, 180);
    expect(mid.x).toBeCloseTo(15, 6);
    expect(mid.y).toBeCloseTo(0, 6);
  });

  it("returns the end corner at positionIn = the wall's full length", () => {
    const fp = buildRectangleFootprint(30, 20);
    const da = fp.walls.find((w) => w.id === "DA")!; // D(0,20) -> A(0,0), 20ft = 240in
    const end = wallPointAtPositionIn(da, fp, 240);
    expect(end.x).toBeCloseTo(0, 6);
    expect(end.y).toBeCloseTo(0, 6);
  });
});

describe("computeRidgeLine", () => {
  it("connects the two walls' default-centered peak points when no custom peak is given", () => {
    const fp = buildRectangleFootprint(30, 20); // AB (N, 30ft) opposite CD (S, 30ft), 20ft apart
    const ridge = computeRidgeLine(fp, "AB", "CD", {});
    expect(ridge).not.toBeNull();
    // AB's midpoint (15, 0); CD runs C(30,20)->D(0,20), midpoint (15, 20)
    expect(ridge!.pointA).toEqual({ x: 15, y: 0 });
    expect(ridge!.pointB).toEqual({ x: 15, y: 20 });
    expect(ridge!.runIn).toBeCloseTo(20 * 12, 6);
  });

  it("uses a custom peak position for either wall", () => {
    const fp = buildRectangleFootprint(30, 20);
    // AB's peak at 60in (5ft) from A instead of the 180in (15ft) center
    const ridge = computeRidgeLine(fp, "AB", "CD", { AB: 60 });
    expect(ridge!.pointA.x).toBeCloseTo(5, 6);
    expect(ridge!.pointB.x).toBeCloseTo(15, 6); // CD still centered
  });

  it("returns a longer, non-perpendicular run when the two peaks aren't mirrored", () => {
    const fp = buildRectangleFootprint(30, 20);
    const mirrored = computeRidgeLine(fp, "AB", "CD", {})!;
    const skewed = computeRidgeLine(fp, "AB", "CD", { AB: 0 })!; // AB's peak snapped to its own start corner
    expect(skewed.runIn).toBeGreaterThan(mirrored.runIn);
  });

  it("returns null for an unknown wall id", () => {
    const fp = buildRectangleFootprint(30, 20);
    expect(computeRidgeLine(fp, "AB", "ZZ", {})).toBeNull();
  });
});

describe("pointAlongRidgeLine", () => {
  it("returns pointA at positionIn = 0 and pointB at positionIn = runIn", () => {
    const fp = buildRectangleFootprint(30, 20);
    const ridge = computeRidgeLine(fp, "AB", "CD", {})!;
    expect(pointAlongRidgeLine(ridge, 0)).toEqual(ridge.pointA);
    const end = pointAlongRidgeLine(ridge, ridge.runIn);
    expect(end.x).toBeCloseTo(ridge.pointB.x, 6);
    expect(end.y).toBeCloseTo(ridge.pointB.y, 6);
  });

  it("interpolates the midpoint at half the run", () => {
    const fp = buildRectangleFootprint(30, 20);
    const ridge = computeRidgeLine(fp, "AB", "CD", {})!; // pointA (15,0), pointB (15,20)
    const mid = pointAlongRidgeLine(ridge, ridge.runIn / 2);
    expect(mid.x).toBeCloseTo(15, 6);
    expect(mid.y).toBeCloseTo(10, 6);
  });
});
