import { describe, expect, it } from "vitest";
import { isPointInPolygon } from "./pointInPolygon";

describe("isPointInPolygon", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  it("returns true for a point clearly inside a square", () => {
    expect(isPointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
  });

  it("returns false for a point clearly outside a square", () => {
    expect(isPointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
  });

  it("handles a clipped-corner (octagon-like) polygon correctly", () => {
    // Same clip geometry as buildOctagonFootprint(40, 20): clip ~5.858.
    const octagon = [
      { x: 5.858, y: 0 },
      { x: 34.142, y: 0 },
      { x: 40, y: 5.858 },
      { x: 40, y: 14.142 },
      { x: 34.142, y: 20 },
      { x: 5.858, y: 20 },
      { x: 0, y: 14.142 },
      { x: 0, y: 5.858 },
    ];
    // (2,2) sits in the clipped-off top-left triangle (x+y=4 < 5.858) — outside.
    expect(isPointInPolygon({ x: 2, y: 2 }, octagon)).toBe(false);
    // The center is unambiguously inside.
    expect(isPointInPolygon({ x: 20, y: 10 }, octagon)).toBe(true);
    // (2,4): x+y=6 > 5.858 — just inside the clip line.
    expect(isPointInPolygon({ x: 2, y: 4 }, octagon)).toBe(true);
  });
});
