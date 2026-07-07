import { describe, expect, it } from "vitest";
import { computeStrawWeight } from "./weight";

describe("computeStrawWeight", () => {
  it("converts width/thickness/height (in) x density (kg/m3) to volume and weight", () => {
    // 100in x 100in x 100in = (2.54m)^3 = 16.387064 m3
    const result = computeStrawWeight(100, 100, 100, 75);
    expect(result.volumeM3).toBeCloseTo(16.387064, 3);
    expect(result.weightKg).toBeCloseTo(1229.03, 1);
    expect(result.weightLb).toBeCloseTo(2709.54, 1);
    expect(result.woodAndFastenersModeled).toBe(false);
  });
});
