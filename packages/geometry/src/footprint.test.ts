import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";

describe("buildRectangleFootprint", () => {
  it("places corners A-B-C-D clockwise with correct wall lengths", () => {
    const fp = buildRectangleFootprint(30, 20);
    expect(fp.corners).toEqual([
      { id: "A", point: { x: 0, y: 0 } },
      { id: "B", point: { x: 30, y: 0 } },
      { id: "C", point: { x: 30, y: 20 } },
      { id: "D", point: { x: 0, y: 20 } },
    ]);
    expect(fp.walls.map((w) => [w.id, w.lengthFt])).toEqual([
      ["AB", 30],
      ["BC", 20],
      ["CD", 30],
      ["DA", 20],
    ]);
  });

  it("clamps below the 8ft minimum dimension", () => {
    const fp = buildRectangleFootprint(5, 5);
    expect(fp.walls[0]!.lengthFt).toBe(8);
  });
});
