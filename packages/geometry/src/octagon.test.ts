import { describe, expect, it } from "vitest";
import { buildOctagonFootprint } from "./octagon";
import { isWholeEighthIn } from "./eighths";

// The octagon's corners are snapped to the 1/8in grid (see
// `quantizeFootprint`), which moves each coordinate by up to 1/16in and so
// moves a side length by up to 1/8in away from the ideal regular-octagon
// value. These tests therefore assert the ideal to within 1/8in rather than
// to 1e-6, and separately assert the grid property that replaced exactness.
const ONE_EIGHTH_FT = 1 / 96;

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
      expect(Math.abs(len - (40 - 2 * clip))).toBeLessThanOrEqual(ONE_EIGHTH_FT);
    }
    for (const len of diagonalLengths) {
      expect(Math.abs(len - clip * Math.SQRT2)).toBeLessThanOrEqual(ONE_EIGHTH_FT);
    }
    // All four straight sides are still exactly equal to each other, and to
    // each other's counterparts on the grid — the snap is symmetric.
    expect(new Set(straightLengths).size).toBe(1);
    expect(new Set(diagonalLengths).size).toBe(1);
  });

  it("puts every corner on the 1/8in grid, and every AXIS-ALIGNED side length with it", () => {
    const fp = buildOctagonFootprint(40, 40);
    for (const corner of fp.corners) {
      expect(isWholeEighthIn(corner.point.x * 12)).toBe(true);
      expect(isWholeEighthIn(corner.point.y * 12)).toBe(true);
    }
    const straightLengths = fp.walls.filter((_, i) => i % 2 === 0).map((w) => w.lengthFt);
    for (const len of straightLengths) {
      expect(isWholeEighthIn(len * 12)).toBe(true);
    }
  });

  it("does NOT force the 45deg diagonals onto the grid — the documented exception", () => {
    // A diagonal between two grid corners has an irrational length. This is
    // asserted rather than merely tolerated, so that a future change which
    // silently distorts the octagon to force grid-exact diagonals (the
    // explicitly rejected alternative) fails here instead of shipping.
    const fp = buildOctagonFootprint(40, 40);
    const diagonal = fp.walls[1]!;
    expect(isWholeEighthIn(diagonal.lengthFt * 12)).toBe(false);
    // ...and the residual it hands the corner joint is under 1/16in, which is
    // what the safety/gap panel absorbs.
    const fabricationLengthIn = Math.round(diagonal.lengthFt * 12 * 8) / 8;
    expect(Math.abs(fabricationLengthIn - diagonal.lengthFt * 12)).toBeLessThanOrEqual(1 / 16);
  });

  it("handles a non-square bounding box, still all straight+diagonal walls", () => {
    const fp = buildOctagonFootprint(60, 40);
    const clip = 40 * (1 - 1 / Math.SQRT2); // clip derives from the shorter side
    const [top, topRightDiag, right, botRightDiag, bottom, botLeftDiag, left, topLeftDiag] =
      fp.walls.map((w) => w.lengthFt);

    expect(Math.abs(top - (60 - 2 * clip))).toBeLessThanOrEqual(ONE_EIGHTH_FT);
    expect(Math.abs(bottom - (60 - 2 * clip))).toBeLessThanOrEqual(ONE_EIGHTH_FT);
    expect(Math.abs(right - (40 - 2 * clip))).toBeLessThanOrEqual(ONE_EIGHTH_FT);
    expect(Math.abs(left - (40 - 2 * clip))).toBeLessThanOrEqual(ONE_EIGHTH_FT);
    for (const diag of [topRightDiag, botRightDiag, botLeftDiag, topLeftDiag]) {
      expect(Math.abs(diag - clip * Math.SQRT2)).toBeLessThanOrEqual(ONE_EIGHTH_FT);
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
    expect(Math.abs(fp.walls[0]!.lengthFt - (8 - 2 * clip))).toBeLessThanOrEqual(ONE_EIGHTH_FT);
  });
});
