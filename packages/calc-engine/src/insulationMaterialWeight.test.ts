import { describe, expect, it } from "vitest";
import { computeInsulationWeight } from "./insulationMaterialWeight";

describe("computeInsulationWeight", () => {
  it("multiplies volume by density for weightLb, and converts to kg", () => {
    const result = computeInsulationWeight(10, 3.5);
    expect(result.weightLb).toBeCloseTo(35, 9);
    expect(result.weightKg).toBeCloseTo(35 * 0.453592, 6);
  });

  it("returns 0 for 0 volume", () => {
    const result = computeInsulationWeight(0, 3.5);
    expect(result.weightLb).toBe(0);
    expect(result.weightKg).toBe(0);
  });
});
