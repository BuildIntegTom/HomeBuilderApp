import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { computeJoistLayout } from "./joistLayout";

describe("computeJoistLayout", () => {
  it("runs joists perpendicular to the longest walls (wide building -> joists run along y, spanning the depth)", () => {
    const fp = buildRectangleFootprint(30, 20); // wider (30) than deep (20)
    const layout = computeJoistLayout(fp, 16);
    expect(layout.axis).toBe("y");
    // Every joist spans the full depth (0 to 20), landing on the top/bottom (long) walls.
    for (const j of layout.joists) {
      expect(j.y1).toBeCloseTo(0, 6);
      expect(j.y2).toBeCloseTo(20, 6);
    }
    // First and last joists sit right at the two short-wall edges.
    expect(Math.min(...layout.joists.map((j) => j.x1))).toBeCloseTo(0, 6);
    expect(Math.max(...layout.joists.map((j) => j.x1))).toBeCloseTo(30, 6);
  });

  it("runs joists perpendicular to the longest walls (deep building -> joists run along x, spanning the width)", () => {
    const fp = buildRectangleFootprint(20, 30); // deeper (30) than wide (20)
    const layout = computeJoistLayout(fp, 16);
    expect(layout.axis).toBe("x");
    for (const j of layout.joists) {
      expect(j.x1).toBeCloseTo(0, 6);
      expect(j.x2).toBeCloseTo(20, 6);
    }
    expect(Math.min(...layout.joists.map((j) => j.y1))).toBeCloseTo(0, 6);
    expect(Math.max(...layout.joists.map((j) => j.y1))).toBeCloseTo(30, 6);
  });

  it("never leaves a gap larger than the o.c. spacing, even when the span doesn't divide evenly", () => {
    const fp = buildRectangleFootprint(30, 20);
    const spacingIn = 16; // 1.333ft - 30ft doesn't divide evenly by this
    const layout = computeJoistLayout(fp, spacingIn);
    const xs = layout.joists.map((j) => j.x1).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]! - xs[i - 1]!).toBeLessThanOrEqual(spacingIn / 12 + 1e-6);
    }
  });

  it("spaces joists closer together at 16in o.c. than 24in o.c.", () => {
    const fp = buildRectangleFootprint(30, 20);
    const layout16 = computeJoistLayout(fp, 16);
    const layout24 = computeJoistLayout(fp, 24);
    expect(layout16.joists.length).toBeGreaterThan(layout24.joists.length);
  });
});
