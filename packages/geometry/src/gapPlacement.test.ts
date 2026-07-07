import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { buildOctagonFootprint } from "./octagon";
import { computeGapEnd, computeSafetyEnd } from "./gapPlacement";

describe("computeGapEnd — Tommy's rule: farthest end from the least-accessible corner", () => {
  const fp = buildRectangleFootprint(30, 20);
  const wallsById = Object.fromEntries(fp.walls.map((w) => [w.id, w]));

  it("puts the two walls touching the least-accessible corner's gap at their far (non-A) end", () => {
    expect(computeGapEnd(wallsById.AB!, "A", fp.corners)).toBe("end"); // near B
    expect(computeGapEnd(wallsById.DA!, "A", fp.corners)).toBe("start"); // near D
  });

  it("clusters the two remote walls' gaps toward the diagonally-opposite corner", () => {
    // Both BC and CD should place their gap at the C end (the corner
    // diagonal to A), since C is farther from A than either B or D is.
    expect(computeGapEnd(wallsById.BC!, "A", fp.corners)).toBe("end"); // near C
    expect(computeGapEnd(wallsById.CD!, "A", fp.corners)).toBe("start"); // near C
  });
});

describe("computeSafetyEnd — Tommy's rule: the 'left' corner as seen from outside the shell", () => {
  // Every footprint generator winds its corners clockwise as drawn on
  // screen (A-B-C-D, "0".."7", etc.) — for a consistently clockwise-wound
  // convex polygon the interior is always on the *right* of each wall's
  // start->end direction, which works out to the `end` corner always being
  // the "left, standing outside" one (verified by hand per-wall below).
  it("resolves to the endCorner for every wall of a rectangle", () => {
    const fp = buildRectangleFootprint(30, 20);
    for (const wall of fp.walls) {
      expect(computeSafetyEnd(wall, fp.corners)).toBe("end");
    }
  });

  it("resolves to the endCorner for every wall of an octagon", () => {
    const fp = buildOctagonFootprint(30, 30);
    for (const wall of fp.walls) {
      expect(computeSafetyEnd(wall, fp.corners)).toBe("end");
    }
  });
});
