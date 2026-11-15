import { describe, expect, it } from "vitest";
import {
  buildBoxBeamMembers,
  buildSafetyGapMembers,
  buildTrussPlateMembers,
  priceRates,
} from "@building-integrity/panel-catalog";
import { computeShopItemPrice } from "./shopItemPrice";

/**
 * ⚠ **WHAT HIS FOUR RATES DO TO A REAL BUILDING'S MONEY, pinned.**
 *
 * These are not arithmetic checks — `shopItemPrice.test.ts` has those. They
 * exist because the shop-item rates are the first exception to *"$25/sq ft
 * for absolutely everything"* and a rate change is the one kind of change in
 * this app that is invisible in every drawing. If one of these numbers moves,
 * somebody has repriced a building, and the diff should say so out loud
 * rather than being discovered in a quote.
 *
 * ⚠ A Truss Plate is the line worth watching. Its two 2x4 chords take the
 * $60 dimensional rate on their own 3 1/2in x length faces, which is about
 * $175 per 10ft stick — the most aggressive consequence of reading his
 * instruction per piece, and the one to revisit if he says $60 was meant for
 * a built-up beam's envelope rather than for each stick in it.
 */

const DEPTH_IN = 15.5;
const TEN_FEET_IN = 120;

function money(n: number): string {
  return n.toFixed(2);
}

describe("⚠ the price of a shop item, per 10ft, pinned", () => {
  it("a Safety Gap: $15.63 under the flat rate, $51.67 under his own", () => {
    const now = computeShopItemPrice(buildSafetyGapMembers(DEPTH_IN, TEN_FEET_IN)).total;
    const before = ((0.75 * TEN_FEET_IN) / 144) * priceRates.coveragePerSqFt;
    expect(money(before)).toBe("15.63");
    expect(money(now)).toBe("51.67");
  });

  it("a Box Beam (9x2 LVL web): $177.08 before, $253.33 now", () => {
    /* Two LVL webs at $10 of their own 9in x 10ft faces, plus two plywood
       caps at $4 of their 15.5in x 10ft faces. The beam's old price was a
       stand-in face — its covered length by its cross-sectional height — at
       the flat rate. */
    const now = computeShopItemPrice(buildBoxBeamMembers(TEN_FEET_IN, DEPTH_IN)).total;
    const before = ((TEN_FEET_IN * 8.5) / 144) * priceRates.coveragePerSqFt;
    expect(money(before)).toBe("177.08");
    expect(money(now)).toBe("253.33");
  });

  it("⚠ a Truss Plate: $177.08 before, $401.67 now — a 2.3x move", () => {
    /* The biggest consequence in the change, and the one that is his call
       rather than mine. Two 2x4 chords at $60/sq ft of face is ~$175 each. */
    const now = computeShopItemPrice(buildTrussPlateMembers(TEN_FEET_IN, DEPTH_IN)).total;
    const before = ((TEN_FEET_IN * 8.5) / 144) * priceRates.coveragePerSqFt;
    expect(money(before)).toBe("177.08");
    expect(money(now)).toBe("401.67");
  });
});
