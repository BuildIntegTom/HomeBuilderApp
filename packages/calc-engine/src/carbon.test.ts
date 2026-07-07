import { describe, expect, it } from "vitest";
import { computeCarbonRange, computeCarbonSequestration } from "./carbon";

describe("computeCarbonSequestration", () => {
  it("strips out moisture (wet-basis) before applying the carbon fraction", () => {
    // 100kg moist weight @ 15% moisture -> 85kg dry -> x 0.45 = 38.25kg carbon
    const result = computeCarbonSequestration(100, 0.15, 0.45);
    expect(result.dryWeightKg).toBeCloseTo(85, 6);
    expect(result.carbonKg).toBeCloseTo(38.25, 6);
    expect(result.carbonLb).toBeCloseTo(84.327, 2);
  });
});

describe("computeCarbonRange", () => {
  it("gives more carbon at low moisture and less at high moisture, for the same measured weight", () => {
    const range = computeCarbonRange(100, { min: 0.05, standard: 0.15, max: 0.2 }, 0.45);
    expect(range.atMinMoisture.carbonKg).toBeCloseTo(42.75, 6);
    expect(range.atStandardMoisture.carbonKg).toBeCloseTo(38.25, 6);
    expect(range.atMaxMoisture.carbonKg).toBeCloseTo(36, 6);
    // lower moisture content => less water => more dry mass => more carbon
    expect(range.atMinMoisture.carbonKg).toBeGreaterThan(range.atStandardMoisture.carbonKg);
    expect(range.atStandardMoisture.carbonKg).toBeGreaterThan(range.atMaxMoisture.carbonKg);
  });
});
