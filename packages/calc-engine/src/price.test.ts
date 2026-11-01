import { describe, expect, it } from "vitest";
import { beamPriceRatePerSqFt, priceRates } from "@building-integrity/panel-catalog";
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

  it("⚠ a floor and a roof panel are $24 per square foot of COVERAGE, his own figure", () => {
    /* *"floor and roof should be $24/sq ft coverage."* Every other rate
       prices a panel by the face it stands up as; a deck panel lies down. */
    expect(priceRates.floorPanelPerSqFt).toBe(24);
    expect(priceRates.roofPanelPerSqFt).toBe(24);
    const total = computePrice([
      { type: "floor-panel", areaSqFt: 800 },
      { type: "roof-panel", areaSqFt: 843.3 },
    ]);
    expect(total).toBeCloseTo(24 * (800 + 843.3), 2);
  });

  it("⚠ a beam has its own bucket, at the rate it was already charged, and it is NOT confirmed", () => {
    /* He asked for beams to be priced separately and gave no figure. Seeding
       the bucket at the roof rate is what makes the split cost-neutral; the
       status is what stops that seed reading as his number. If somebody ever
       changes the value, this test says out loud that it was never his. */
    expect(beamPriceRatePerSqFt.status).toBe("pending-BI-confirmation");
    expect(beamPriceRatePerSqFt.value).toBe(priceRates.roofPerSqFt);
    expect(computePrice([{ type: "beam", areaSqFt: 10 }])).toBeCloseTo(10 * beamPriceRatePerSqFt.value, 2);
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
