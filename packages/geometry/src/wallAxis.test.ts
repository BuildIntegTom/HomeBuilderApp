import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { wallAxis } from "./wallAxis";

describe("wallAxis", () => {
  it("gives a wall running along +X a 0-radian rotation and unit +X direction", () => {
    const fp = buildRectangleFootprint(30, 20); // A(0,0) B(30,0) C(30,20) D(0,20)
    const ab = fp.walls.find((w) => w.id === "AB")!;
    const axis = wallAxis(fp, ab);
    expect(axis.startXFt).toBeCloseTo(0, 6);
    expect(axis.startZFt).toBeCloseTo(0, 6);
    expect(axis.dirX).toBeCloseTo(1, 6);
    expect(axis.dirZ).toBeCloseTo(0, 6);
    expect(axis.rotationRad).toBeCloseTo(0, 6);
  });

  it("gives a wall running along +Z a quarter-turn rotation and unit +Z direction", () => {
    const fp = buildRectangleFootprint(30, 20);
    const bc = fp.walls.find((w) => w.id === "BC")!;
    const axis = wallAxis(fp, bc);
    expect(axis.startXFt).toBeCloseTo(30, 6);
    expect(axis.startZFt).toBeCloseTo(0, 6);
    expect(axis.dirX).toBeCloseTo(0, 6);
    expect(axis.dirZ).toBeCloseTo(1, 6);
    expect(axis.rotationRad).toBeCloseTo(Math.PI / 2, 6);
  });

  it("uses the wall's own raw corner-to-corner length, not a retiled/corner-owned one", () => {
    const fp = buildRectangleFootprint(30, 20);
    const cd = fp.walls.find((w) => w.id === "CD")!;
    const axis = wallAxis(fp, cd);
    // CD runs from C(30,20) to D(0,20) — along -X.
    expect(axis.startXFt).toBeCloseTo(30, 6);
    expect(axis.startZFt).toBeCloseTo(20, 6);
    expect(axis.dirX).toBeCloseTo(-1, 6);
    expect(axis.dirZ).toBeCloseTo(0, 6);
  });
});
