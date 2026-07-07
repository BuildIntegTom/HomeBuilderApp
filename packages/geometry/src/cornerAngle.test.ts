import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { buildOctagonFootprint } from "./octagon";
import { cornerTurnAngleRad, footprintIsAllRightAngles, isRightAngleCorner } from "./cornerAngle";

describe("cornerTurnAngleRad / isRightAngleCorner", () => {
  it("finds a right angle at every corner of a rectangle", () => {
    const fp = buildRectangleFootprint(30, 20);
    for (const wall of fp.walls) {
      const nextWall = fp.walls.find((w) => w.startCorner === wall.endCorner)!;
      const angle = cornerTurnAngleRad(wall, nextWall, fp.corners);
      expect(angle).toBeCloseTo(Math.PI / 2, 6);
      expect(isRightAngleCorner(angle)).toBe(true);
    }
  });

  it("finds a 45deg turn at every corner of an octagon", () => {
    const fp = buildOctagonFootprint(30, 30);
    for (const wall of fp.walls) {
      const nextWall = fp.walls.find((w) => w.startCorner === wall.endCorner)!;
      const angle = cornerTurnAngleRad(wall, nextWall, fp.corners);
      expect(angle).toBeCloseTo(Math.PI / 4, 6);
      expect(isRightAngleCorner(angle)).toBe(false);
    }
  });
});

describe("footprintIsAllRightAngles", () => {
  it("is true for a rectangle", () => {
    expect(footprintIsAllRightAngles(buildRectangleFootprint(30, 20))).toBe(true);
  });

  it("is false for an octagon", () => {
    expect(footprintIsAllRightAngles(buildOctagonFootprint(30, 30))).toBe(false);
  });
});
