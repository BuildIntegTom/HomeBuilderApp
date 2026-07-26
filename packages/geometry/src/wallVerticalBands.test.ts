import { describe, expect, it } from "vitest";
import { computeWallVerticalBands } from "./wallVerticalBands";

describe("computeWallVerticalBands", () => {
  it("returns a single below-beam band spanning the whole story when there's no beam", () => {
    expect(computeWallVerticalBands(120, undefined, 11)).toEqual([{ band: "below-beam", bottomIn: 0, topIn: 120 }]);
  });

  it("omits the below-beam band when the beam sits at the floor", () => {
    expect(computeWallVerticalBands(120, 0, 11)).toEqual([{ band: "above-beam", bottomIn: 11, topIn: 120 }]);
  });

  it("omits the above-beam band when the beam's own top reaches the ceiling", () => {
    expect(computeWallVerticalBands(120, 109, 11)).toEqual([{ band: "below-beam", bottomIn: 0, topIn: 109 }]);
  });

  it("returns two bands for a beam placed mid-wall, with no gap or overlap between them or the story bounds", () => {
    const bands = computeWallVerticalBands(120, 60, 11);
    expect(bands).toEqual([
      { band: "below-beam", bottomIn: 0, topIn: 60 },
      { band: "above-beam", bottomIn: 71, topIn: 120 },
    ]);
    expect(bands[0]!.bottomIn).toBe(0);
    expect(bands[1]!.topIn).toBe(120);
  });

  it("returns zero bands when the beam's own assembly consumes the entire story", () => {
    expect(computeWallVerticalBands(10, 0, 11)).toEqual([]);
  });

  it("clamps an out-of-range beam height instead of throwing", () => {
    expect(computeWallVerticalBands(120, -50, 11)).toEqual([{ band: "above-beam", bottomIn: 11, topIn: 120 }]);
    expect(computeWallVerticalBands(120, 5000, 11)).toEqual([{ band: "below-beam", bottomIn: 0, topIn: 120 }]);
  });
});
