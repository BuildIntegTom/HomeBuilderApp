import { describe, expect, it } from "vitest";
import { computePrice } from "./price";

describe("computePrice", () => {
  it("applies per-type rates with no markup when no modifier is passed", () => {
    // 100 sqft standard @ $28 + 50 sqft column @ $36 + 20 sqft roof @ $42
    // = 2800 + 1800 + 840 = 5440
    const total = computePrice([
      { type: "standard", areaSqFt: 100 },
      { type: "column", areaSqFt: 50 },
      { type: "roof", areaSqFt: 20 },
    ]);
    expect(total).toBeCloseTo(5440, 2);
  });

  it("applies the given modifier on top of the per-type rates (e.g. fabricator/admin's 1.3x markup)", () => {
    // Same panels as above (5440 subtotal), x 1.3 = 7072
    const total = computePrice(
      [
        { type: "standard", areaSqFt: 100 },
        { type: "column", areaSqFt: 50 },
        { type: "roof", areaSqFt: 20 },
      ],
      1.3,
    );
    expect(total).toBeCloseTo(7072, 2);
  });

  it("returns 0 for no panels", () => {
    expect(computePrice([])).toBe(0);
  });

  it("prices corner/braced/opening panels at their own confirmed rates", () => {
    // 10 sqft corner @ $36 + 10 sqft braced @ $32 + 10 sqft opening @ $34
    // = 360 + 320 + 340 = 1020, x 1.3 = 1326
    const total = computePrice(
      [
        { type: "corner", areaSqFt: 10 },
        { type: "braced", areaSqFt: 10 },
        { type: "opening", areaSqFt: 10 },
      ],
      1.3,
    );
    expect(total).toBeCloseTo(1326, 2);
  });
});
