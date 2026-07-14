import { describe, expect, it } from "vitest";
import {
  computePlasterCoatCuFt,
  computePlasterLaborCost,
  computePlasterLaborHours,
  computePlasterMaterialCost,
  computePlasterMixCuFt,
  computePlasterUnits,
} from "./plaster";

// Golden values from Tommy's "Faster Plaster Calculator" spreadsheet
// ("Copy of TEMPLATE" sheet): Base coat 0.75in x 600.2 sqft, Finish coat
// 0.25in x 1654 sqft, Base parts sand:clay:lime:straw = 3.5:1:0.25:1,
// Finish parts sand:lime = 3:1.

describe("computePlasterCoatCuFt", () => {
  // The spreadsheet's own formula hardcodes 0.083333 (a truncated 1/12)
  // rather than dividing by 12 directly, so its cached results are off by
  // ~0.0001-0.00015 cu ft from the mathematically exact figure this
  // function computes — close enough to confirm the formula, not an exact
  // bit-for-bit match.
  it("matches the spreadsheet's Base Coat example (0.75in x 600.2 sqft)", () => {
    expect(computePlasterCoatCuFt(0.75, 600.2)).toBeCloseTo(37.51234995, 2);
  });

  it("matches the spreadsheet's Finish Coat example (0.25in x 1654 sqft)", () => {
    expect(computePlasterCoatCuFt(0.25, 1654)).toBeCloseTo(34.4581955, 2);
  });
});

describe("computePlasterMixCuFt", () => {
  it("splits Base Coat cu ft across sand/clay/lime/straw (3.5:1:0.25:1)", () => {
    const result = computePlasterMixCuFt({ sand: 3.5, clay: 1, lime: 0.25, straw: 1 }, 37.51234995);
    expect(result.sand).toBeCloseTo(22.83360432, 4);
    expect(result.clay).toBeCloseTo(6.523886948, 4);
    expect(result.lime).toBeCloseTo(1.630971737, 4);
    expect(result.straw).toBeCloseTo(6.523886948, 4);
  });

  it("splits Finish Coat cu ft across sand/lime only (3:1, clay/straw at 0)", () => {
    const result = computePlasterMixCuFt({ sand: 3, clay: 0, lime: 1, straw: 0 }, 34.4581955);
    expect(result.sand).toBeCloseTo(25.84364663, 4);
    expect(result.clay).toBe(0);
    expect(result.lime).toBeCloseTo(8.614548875, 4);
    expect(result.straw).toBe(0);
  });

  it("returns all zeros when every part is 0 (avoids divide-by-zero)", () => {
    expect(computePlasterMixCuFt({ sand: 0, clay: 0, lime: 0, straw: 0 }, 100)).toEqual({
      sand: 0,
      clay: 0,
      lime: 0,
      straw: 0,
    });
  });
});

describe("computePlasterUnits", () => {
  it("converts Base Coat sand cu ft to buckets (0.5 cu ft/bucket)", () => {
    expect(computePlasterUnits(22.83360432, 0.5)).toBeCloseTo(45.66720863, 4);
  });

  it("converts Base Coat clay cu ft to bags (1.25 cu ft/bag)", () => {
    expect(computePlasterUnits(6.523886948, 1.25)).toBeCloseTo(5.219109558, 4);
  });

  it("converts Finish Coat sand cu ft to cu yd (27 cu ft/yd)", () => {
    expect(computePlasterUnits(25.84364663, 27)).toBeCloseTo(0.9571720972, 4);
  });

  it("converts Base Coat lime cu ft to 110-gal tubs (17.11 cu ft/tub)", () => {
    expect(computePlasterUnits(1.630971737, 17.11)).toBeCloseTo(0.09532271987, 4);
  });

  it("returns 0 for a non-positive unit size", () => {
    expect(computePlasterUnits(10, 0)).toBe(0);
  });
});

describe("computePlasterLaborHours", () => {
  it("matches the spreadsheet's no-openings example (300 sqft, 0 ROs -> 6 hrs)", () => {
    const result = computePlasterLaborHours(300, 0, 15, 0.02, 0.04);
    expect(result.fieldHrs).toBeCloseTo(6, 5);
    expect(result.edgeHrs).toBe(0);
    expect(result.totalHrs).toBeCloseTo(6, 5);
  });

  it("matches the spreadsheet's 8-opening example (720 sqft, 8 ROs -> 16.8 hrs)", () => {
    const result = computePlasterLaborHours(720, 8, 15, 0.02, 0.04);
    expect(result.fieldHrs).toBeCloseTo(12, 5);
    expect(result.edgeHrs).toBeCloseTo(4.8, 5);
    expect(result.totalHrs).toBeCloseTo(16.8, 5);
  });

  it("matches the spreadsheet's 2-opening example (625 sqft, 2 ROs -> 13.1 hrs)", () => {
    const result = computePlasterLaborHours(625, 2, 15, 0.02, 0.04);
    expect(result.fieldHrs).toBeCloseTo(11.9, 5);
    expect(result.edgeHrs).toBeCloseTo(1.2, 5);
    expect(result.totalHrs).toBeCloseTo(13.1, 5);
  });

  it("adds fussyHrsExtra on top of field+edge hours", () => {
    const result = computePlasterLaborHours(300, 0, 15, 0.02, 0.04, 2.5);
    expect(result.fussyHrs).toBe(2.5);
    expect(result.totalHrs).toBeCloseTo(8.5, 5);
  });

  it("never lets rough-opening edge area exceed the total area (clamped, no negative field hours)", () => {
    const result = computePlasterLaborHours(50, 20, 15, 0.02, 0.04);
    expect(result.edgeHrs).toBeCloseTo(50 * 0.04, 5);
    expect(result.fieldHrs).toBe(0);
  });
});

describe("computePlasterMaterialCost", () => {
  it("prices sand by the cu yd, clay/lime by the bag, straw by the cu ft", () => {
    const result = computePlasterMaterialCost(
      { sand: 27, clay: 1.25, lime: 2.5, straw: 4 },
      { sandPricePerCuYd: 45, clayPricePerBag: 19, limePricePerBag: 10, strawPricePerCuFt: 1.25, bagCuFt: 1.25 },
    );
    expect(result.sandCost).toBeCloseTo(45, 5); // 1 cu yd of sand
    expect(result.clayCost).toBeCloseTo(19, 5); // 1 bag of clay
    expect(result.limeCost).toBeCloseTo(20, 5); // 2 bags of lime
    expect(result.strawCost).toBeCloseTo(5, 5); // 4 cu ft x $1.25
    expect(result.totalMaterialCost).toBeCloseTo(89, 5);
  });
});

describe("computePlasterLaborCost", () => {
  it("multiplies hours by the hourly rate", () => {
    expect(computePlasterLaborCost(16.8, 45)).toBeCloseTo(756, 5);
  });
});
