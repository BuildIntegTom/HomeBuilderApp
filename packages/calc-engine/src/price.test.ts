import { describe, expect, it } from "vitest";
import { priceRates } from "@building-integrity/panel-catalog";
import { PUBLIC_COVERAGE_RATE_PER_SQ_FT, computeCoveragePrice, type PriceablePanelType } from "./price";

const EVERY_TYPE: PriceablePanelType[] = [
  "standard",
  "corner",
  "braced",
  "opening",
  "column",
  "big-header",
  "roof",
  "floor-panel",
  "roof-panel",
  "beam",
];

describe("computeCoveragePrice", () => {
  it("is area x rate, and nothing else", () => {
    expect(
      computeCoveragePrice(
        [
          { type: "standard", areaSqFt: 100 },
          { type: "column", areaSqFt: 50 },
          { type: "roof", areaSqFt: 20 },
        ],
        25,
      ),
    ).toBeCloseTo(170 * 25, 2);
  });

  it("returns 0 for no panels", () => {
    expect(computeCoveragePrice([], 25)).toBe(0);
  });

  it("⚠ EVERY bucket is charged the same rate — his \"flat $25 for absolutely everything\"", () => {
    /* Asked on 2026-11-08 whether the gable row ($42), the beams and truss
       plates ($42) and the Big Header ($25) should keep their own rates, he
       answered "Flat $25 for absolutely everything". This test is that
       sentence: one square foot costs the same whatever it is a square foot
       of. If a future change reintroduces a per-type rate, it fails here. */
    for (const type of EVERY_TYPE) {
      expect(computeCoveragePrice([{ type, areaSqFt: 1 }], 25), `${type} must be charged the flat rate`).toBeCloseTo(25, 6);
    }
  });

  it("⚠ the rate is $25, his own number", () => {
    expect(priceRates.coveragePerSqFt).toBe(25);
    expect(priceRates.status).toBe("confirmed");
  });

  it("⚠ the 1.3x markup is GONE, because it was double counting", () => {
    /* > "those rates were all-in prices, the 1.3x is double counting."
       > - Tommy, 2026-11-08

       For as long as it existed, every fabricator-, admin- and engineer-side
       total was 1.3x the real price. The absence is asserted rather than
       assumed, because a reintroduced modifier would not break any other
       test in this file - it would just quietly inflate every quote again. */
    expect("totalModifier" in priceRates).toBe(false);
  });

  it("⚠ no per-type rate is read by the total any more", () => {
    /* The per-type figures are still in the catalog - he asked to keep
       per-panel pricing in play as a possibility - but a total computed at
       the flat rate must not coincide with one computed from them, or this
       test could pass while the old scheme was still live underneath.

       Standard was $28 and a corner $36; at a flat $25 the two are equal, and
       neither equals its old figure. */
    const standard = computeCoveragePrice([{ type: "standard", areaSqFt: 10 }], 25);
    const corner = computeCoveragePrice([{ type: "corner", areaSqFt: 10 }], 25);
    expect(standard).toBeCloseTo(corner, 6);
    expect(standard).not.toBeCloseTo(10 * priceRates.standardPerSqFt, 2);
    expect(corner).not.toBeCloseTo(10 * priceRates.cornerPerSqFt, 2);
  });

  it("⚠ the per-type rates are still recorded, exactly as he gave them", () => {
    /* He chose "$25/sq ft is the only price", with the per-type rates kept in
       the catalog for a detailed scheme later. Kept means UNCHANGED: if
       somebody edits one while nothing reads it, the edit would be invisible
       until the day the detailed scheme ships. */
    expect(priceRates.standardPerSqFt).toBe(28);
    expect(priceRates.cornerPerSqFt).toBe(36);
    expect(priceRates.bracedPerSqFt).toBe(32);
    expect(priceRates.headerSillPerSqFt).toBe(34);
    expect(priceRates.columnPerSqFt).toBe(36);
    expect(priceRates.bigHeaderPerSqFt).toBe(25);
    expect(priceRates.roofPerSqFt).toBe(42);
    expect(priceRates.floorPanelPerSqFt).toBe(24);
    expect(priceRates.roofPanelPerSqFt).toBe(24);
  });

  it("⚠ an adjusted rate scales the whole building, linearly", () => {
    /* *"i may want to test out what a particular building would cost at $20/sq
       ft for instance because that is the actual price point i think we could
       be selling panels at."* One number, one multiplication - which is the
       reason the markup was not replaced by a second factor. */
    const panels = [
      { type: "standard" as const, areaSqFt: 720 },
      { type: "floor-panel" as const, areaSqFt: 384 },
      { type: "roof-panel" as const, areaSqFt: 405 },
    ];
    expect(computeCoveragePrice(panels, 25)).toBeCloseTo(1509 * 25, 2);
    expect(computeCoveragePrice(panels, 20)).toBeCloseTo(1509 * 20, 2);
    expect(computeCoveragePrice(panels, 20) / computeCoveragePrice(panels, 25)).toBeCloseTo(0.8, 6);
  });

  it("⚠ the PUBLIC rate is the catalog's, so an adjusted rate is never shown to them", () => {
    /* *"the public user should definetely not be the one seeing what could be
       the lowest price point."* The gate is the same shape the retired 1.3x
       markup had, pointed the other way: what is withheld from the public is
       now the LOWER number, not the higher one. */
    expect(PUBLIC_COVERAGE_RATE_PER_SQ_FT).toBe(priceRates.coveragePerSqFt);
    const panels = [{ type: "standard" as const, areaSqFt: 100 }];
    expect(computeCoveragePrice(panels, PUBLIC_COVERAGE_RATE_PER_SQ_FT)).toBeGreaterThan(computeCoveragePrice(panels, 20));
  });

  it("⚠ plywood jack studs are inside the rate, not a separate fee", () => {
    /* He chose "explicitly rolled into the $25" over a flat fee per stud, so
       there is no jack-stud term in this function and there must not be one
       added without a decision. The catalog note says the same thing in
       words; this asserts it in arithmetic: a panel's price is its area and
       the rate, with no additive term of any kind. */
    expect(computeCoveragePrice([{ type: "standard", areaSqFt: 0 }], 25)).toBe(0);
    expect(computeCoveragePrice([{ type: "opening", areaSqFt: 0 }], 25)).toBe(0);
  });
});
