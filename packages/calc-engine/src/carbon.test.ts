import { describe, expect, it } from "vitest";
import { computeCarbonRange, computeCarbonSequestration, computeCO2eEquivalencies, computeNetEmbodiedCarbonCO2e } from "./carbon";

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

describe("computeNetEmbodiedCarbonCO2e", () => {
  it("converts straw carbon to CO2e (x44/12) as a credit and nets concrete's volume x factor as a debit", () => {
    // 100kg carbon -> 366.667kg CO2e credit; 10ft3 concrete @ 10kg CO2e/ft3 -> 100kg CO2e debit
    const result = computeNetEmbodiedCarbonCO2e(100, 10, 10);
    expect(result.strawCO2eKg).toBeCloseTo(366.6667, 3);
    expect(result.concreteCO2eKg).toBeCloseTo(100, 6);
    expect(result.netCO2eKg).toBeCloseTo(266.6667, 3);
  });

  it("goes net-negative when concrete's embodied emissions outweigh straw's sequestered credit", () => {
    const result = computeNetEmbodiedCarbonCO2e(1, 1000, 10);
    expect(result.netCO2eKg).toBeLessThan(0);
  });

  it("is straw-only (all credit, no debit) when there's no concrete", () => {
    const result = computeNetEmbodiedCarbonCO2e(50, 0, 10);
    expect(result.concreteCO2eKg).toBe(0);
    expect(result.netCO2eKg).toBeCloseTo(result.strawCO2eKg, 6);
  });
});

describe("computeCO2eEquivalencies", () => {
  it("matches the EPA Greenhouse Gas Equivalencies Calculator reference factors for 1 metric ton (1000kg) CO2e", () => {
    // 1 metric ton / 3.93e-4 metric tons/mile = 2544.5... miles
    // 1 metric ton / 9.00e-4 metric tons/lb coal = 1111.1... lb coal
    // 1 metric ton / 1.24e-5 metric tons/charge = 80645.1... charges
    const result = computeCO2eEquivalencies(1000);
    expect(result.milesDriven).toBeCloseTo(2544.529, 2);
    expect(result.lbCoalBurned).toBeCloseTo(1111.111, 2);
    expect(result.smartphonesCharged).toBeCloseTo(80645.161, 2);
  });

  it("scales linearly with the input CO2e mass", () => {
    const single = computeCO2eEquivalencies(100);
    const doubled = computeCO2eEquivalencies(200);
    expect(doubled.milesDriven).toBeCloseTo(single.milesDriven * 2, 6);
    expect(doubled.lbCoalBurned).toBeCloseTo(single.lbCoalBurned * 2, 6);
    expect(doubled.smartphonesCharged).toBeCloseTo(single.smartphonesCharged * 2, 6);
  });

  it("returns all zeros for zero CO2e", () => {
    const result = computeCO2eEquivalencies(0);
    expect(result.milesDriven).toBe(0);
    expect(result.lbCoalBurned).toBe(0);
    expect(result.smartphonesCharged).toBe(0);
  });
});
