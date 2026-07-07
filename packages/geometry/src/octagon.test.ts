import { describe, expect, it } from "vitest";
import { buildOctagonFootprint } from "./octagon";

describe("buildOctagonFootprint", () => {
  it("produces 8 corners and 8 walls", () => {
    const fp = buildOctagonFootprint(40, 40);
    expect(fp.corners).toHaveLength(8);
    expect(fp.walls).toHaveLength(8);
  });

  it("gives a square box 4 equal straight walls and 4 equal diagonal walls", () => {
    const fp = buildOctagonFootprint(40, 40);
    const clip = 40 * (1 - 1 / Math.SQRT2);
    const straightLengths = fp.walls.filter((_, i) => i % 2 === 0).map((w) => w.lengthFt);
    const diagonalLengths = fp.walls.filter((_, i) => i % 2 === 1).map((w) => w.lengthFt);

    for (const len of straightLengths) {
      expect(len).toBeCloseTo(40 - 2 * clip, 6);
    }
    for (const len of diagonalLengths) {
      expect(len).toBeCloseTo(clip * Math.SQRT2, 6);
    }
  });

  it("handles a non-square bounding box, still all straight+diagonal walls", () => {
    const fp = buildOctagonFootprint(60, 40);
    const clip = 40 * (1 - 1 / Math.SQRT2); // clip derives from the shorter side
    const [top, topRightDiag, right, botRightDiag, bottom, botLeftDiag, left, topLeftDiag] =
      fp.walls.map((w) => w.lengthFt);

    expect(top).toBeCloseTo(60 - 2 * clip, 6);
    expect(bottom).toBeCloseTo(60 - 2 * clip, 6);
    expect(right).toBeCloseTo(40 - 2 * clip, 6);
    expect(left).toBeCloseTo(40 - 2 * clip, 6);
    for (const diag of [topRightDiag, botRightDiag, botLeftDiag, topLeftDiag]) {
      expect(diag).toBeCloseTo(clip * Math.SQRT2, 6);
    }
  });

  it("connects walls end-to-end around the polygon (closed loop)", () => {
    const fp = buildOctagonFootprint(40, 30);
    for (let i = 0; i < fp.walls.length; i++) {
      const wall = fp.walls[i]!;
      const nextWall = fp.walls[(i + 1) % fp.walls.length]!;
      expect(wall.endCorner).toBe(nextWall.startCorner);
    }
    expect(fp.walls[0]!.startCorner).toBe(fp.walls[fp.walls.length - 1]!.endCorner);
  });

  it("clamps below the 8ft minimum dimension", () => {
    const fp = buildOctagonFootprint(5, 5);
    const clip = 8 * (1 - 1 / Math.SQRT2);
    expect(fp.walls[0]!.lengthFt).toBeCloseTo(8 - 2 * clip, 6);
  });
});
