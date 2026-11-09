import { describe, expect, it } from "vitest";
import { priceRates } from "@building-integrity/panel-catalog";
import {
  PUBLIC_COVERAGE_RATE_PER_SQ_FT,
  billableAreaSqFt,
  computeCoveragePrice,
  type PriceablePanelType,
} from "./price";

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

describe("billable area: whole square feet, rounded DOWN", () => {
  /** The coverage of the 16x24 Tiny House template, to the hundredth — the
   * figure the first version of this display printed, and the one that made
   * the defect visible. */
  const TINY_HOUSE_SQ_FT = 1791.22;
  const tinyHouse = [{ type: "standard" as const, areaSqFt: TINY_HOUSE_SQ_FT }];

  it("floors a fractional total to the square foot", () => {
    expect(billableAreaSqFt(tinyHouse)).toBe(1791);
    expect(billableAreaSqFt([{ type: "standard", areaSqFt: 100.99 }])).toBe(100);
    expect(billableAreaSqFt([{ type: "standard", areaSqFt: 100 }])).toBe(100);
  });

  it("⚠ rounds DOWN, in the client's favour — and that direction is a decision", () => {
    /* He asked first to round UP to the nearest foot and withdrew it inside
       the minute: *"i dont like that philosophically... id rather give more
       than technical. always round down in client's favor."* So `floor` is
       not an arithmetic convenience that `round` or `ceil` could replace —
       either would reverse a stated policy on every quote in the app. This
       test fails if one does.

       0.99 of a square foot is the strongest case: rounding to nearest would
       take it, rounding up certainly would, and flooring gives it away. */
    expect(billableAreaSqFt([{ type: "standard", areaSqFt: 100.99 }])).toBe(100);
    expect(billableAreaSqFt([{ type: "standard", areaSqFt: 100.99 }])).not.toBe(101);
    expect(computeCoveragePrice([{ type: "standard", areaSqFt: 100.99 }], 25)).toBe(2500);
    // Never more than the client would owe on the true area.
    for (const area of [0.5, 1.4, 99.999, 1791.22, 4096.01]) {
      expect(billableAreaSqFt([{ type: "standard", areaSqFt: area }])).toBeLessThanOrEqual(area);
    }
  });

  it("⚠ THE PRINTED ARITHMETIC RECONCILES EXACTLY — the whole point of the change", () => {
    /* The defect this closes, measured in the browser on 2026-11-08: the
       screen read "1791 sq ft of coverage x $25.00/sq ft" beside a total of
       "$44780.45". Multiply the printed line out and you get $44,775. The
       area was rounded for display while the total used the raw value, so
       the calculation he asked to have printed — *"it simply gives people an
       honest calculation of what's going on and can compare that to other
       products"* — did not hold.

       Asserted as strict equality at every rate, not toBeCloseTo: "within a
       nickel" is what the broken version managed. */
    for (const rate of [25, 20, 18.5, 30]) {
      const total = computeCoveragePrice(tinyHouse, rate);
      expect(total).toBe(billableAreaSqFt(tinyHouse) * rate);
      expect(total).not.toBe(TINY_HOUSE_SQ_FT * rate);
    }
    expect(computeCoveragePrice(tinyHouse, 25)).toBe(44_775);
  });

  it("⚠ floors the TOTAL once, not each panel", () => {
    /* Flooring per panel would discard up to a square foot per panel. On a
       60-panel building that is $1,500 handed over by an implementation
       detail nobody chose, and it would also make the price depend on how
       the same wall happened to be split into panels. One floor of the sum
       can never cost more than one square foot. */
    const sixty = Array.from({ length: 60 }, () => ({ type: "standard" as const, areaSqFt: 10.9 }));
    expect(billableAreaSqFt(sixty)).toBe(654); // floor(654.0), not 60 x floor(10.9) = 600
    expect(billableAreaSqFt(sixty)).not.toBe(600);

    const rawTotal = sixty.reduce((sum, panel) => sum + panel.areaSqFt, 0);
    expect(rawTotal - billableAreaSqFt(sixty)).toBeLessThan(1);

    /* ⚠ And that case is ALSO the floating-point one, which is why the
       number above is 654 and not 653. The first version of this test
       expected 654 and got 653: sixty tenths-of-a-foot sum to
       653.9999999999999 in a double, so a plain floor surrendered a square
       foot to binary representation. His rule is to round down from the
       building's real area, not from an artifact of how it is stored. */
    expect(rawTotal).not.toBe(654);
    expect(rawTotal).toBeLessThan(654);
    expect(billableAreaSqFt(sixty)).toBe(Math.round(rawTotal));

    /* And splitting a wall in two must not change what it costs. */
    const whole = [{ type: "standard" as const, areaSqFt: 400.6 }];
    const split = [
      { type: "standard" as const, areaSqFt: 200.3 },
      { type: "standard" as const, areaSqFt: 200.3 },
    ];
    expect(computeCoveragePrice(split, 25)).toBe(computeCoveragePrice(whole, 25));
  });

  it("⚠ the epsilon absorbs noise only — a real fraction is still floored away", () => {
    /* The guard against the case above is 1e-6 sq ft. If it ever grew into
       something that could swallow a dimension the app can express, it would
       stop being a noise filter and start being a round-to-nearest rule,
       reversing his decision for small fractions. 0.001 sq ft is 0.144 sq in
       — already far finer than the 1/8in grid this app snaps to. */
    expect(billableAreaSqFt([{ type: "standard", areaSqFt: 100.001 }])).toBe(100);
    expect(billableAreaSqFt([{ type: "standard", areaSqFt: 100.000001 }])).toBe(100);
  });

  it("an empty building is 0 sq ft, not -1", () => {
    expect(billableAreaSqFt([])).toBe(0);
    expect(computeCoveragePrice([], 25)).toBe(0);
  });

  it("a redacted rate still reads NaN rather than a number", () => {
    /* The browse path passes NaN as the RATE so a missed display gate reads
       "$NaN" instead of a confident figure. Flooring the area must not turn
       that into a real-looking 0. */
    expect(Number.isNaN(computeCoveragePrice(tinyHouse, Number.NaN))).toBe(true);
  });
});
