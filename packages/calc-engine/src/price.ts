import { priceRates } from "@building-integrity/panel-catalog";

export type PriceablePanelType =
  | "standard"
  | "corner"
  | "braced"
  | "opening"
  | "column"
  | "big-header"
  | "roof"
  | "floor-panel"
  | "roof-panel"
  | "beam";

export interface PriceablePanel {
  type: PriceablePanelType;
  areaSqFt: number;
}

/**
 * ⚠ **One rate, every bucket.**
 *
 * > *"just give floors, walls, and roof panels a flat $25/sq ft of coverage"*
 * > — Tommy, 2026-11-08, who then answered **"Flat $25 for absolutely
 * > everything"** when asked about the buckets that sentence does not name:
 * > the gable row, the beams and truss plates, the Big Header.
 *
 * `total = sum(areaSqFt) × ratePerSqFt`. The per-type rates that used to live
 * here (`standard` $28, `corner` $36, `roof` $42 …) are still in the catalog
 * and **nothing reads them** — he chose "$25/sq ft is the only price" over
 * keeping two schemes side by side, on the grounds that two prices for one
 * building is not a breakdown, it is a contradiction.
 *
 * ⚠ **`type` is kept although the arithmetic no longer branches on it.** It
 * is what documents which areas are inside the price, it is what a future
 * per-type breakdown would need, and the call site already knows it. Deleting
 * it would make the one place that lists everything charged for disappear.
 *
 * ⚠ **THE RATE IS A REQUIRED ARGUMENT, with no default**, and the function was
 * renamed out of `computePrice` on purpose. The old signature was
 * `computePrice(panels, modifier = 1)`, where the second argument was a
 * MULTIPLIER. A rate and a multiplier are both "a number you pass second",
 * so leaving either the name or a default in place would let a stale caller
 * compile and quietly price a whole building at $1/sq ft. The compiler now
 * finds every call site instead.
 */
export function computeCoveragePrice(panels: PriceablePanel[], ratePerSqFt: number): number {
  return billableAreaSqFt(panels) * ratePerSqFt;
}

/**
 * ⚠ **WHOLE SQUARE FEET, ROUNDED DOWN.** The building's total coverage is
 * floored to an integer before the rate is applied.
 *
 * > *"I'd prefer nice even rounded numbers ... always round down in client's
 * > favor"* — Tommy, 2026-11-08
 *
 * Two reasons it is here rather than in a display `toFixed`:
 *
 * 1. **It moves money, so it cannot live in a format string.** A rounded
 *    display over an unrounded total is exactly the defect this replaces:
 *    the screen read `1791 sq ft × $25` beside a total of `$44,780.45`, which
 *    does not multiply out. Printing the method and then printing arithmetic
 *    that fails is worse than printing no method at all, because he asked for
 *    it so a reader *"can compare that to other products."* Now the printed
 *    line IS the calculation: 1791 × $25 = $44,775, to the cent.
 * 2. **Down, not up, and he reversed himself to get there.** His first
 *    instruction was to round UP to the nearest foot; he withdrew it within
 *    the minute — *"i dont like that philosophically... id rather give more
 *    than technical."* So the direction is not an arithmetic convenience, it
 *    is a stated policy: where the fraction has to go to somebody, it goes to
 *    the client. Changing `floor` to `round` or `ceil` here would reverse that
 *    decision silently, on every quote.
 *
 * ⚠ **The floor is applied ONCE, to the building's total** — not per panel.
 * Flooring each panel would discard up to a square foot per panel, which on a
 * 60-panel building is $1,500 given away by an implementation detail nobody
 * chose. One floor of the sum costs at most one square foot: under $25.
 */
export function billableAreaSqFt(panels: PriceablePanel[]): number {
  const raw = panels.reduce((sum, panel) => sum + panel.areaSqFt, 0);
  return Math.floor(raw + BINARY_SUM_EPSILON_SQ_FT);
}

/**
 * ⚠ **A square foot is not given away to floating point.** Found by this
 * module's own test on 2026-11-08: sixty panels of 10.9 sq ft sum to
 * `653.9999999999999`, not 654, so a building whose real coverage is exactly
 * 654 sq ft billed for 653 — $25 surrendered to binary representation rather
 * than to his policy. "Round down to the nearest foot" means down from the
 * TRUE area; the fraction belongs to the client, the artifact does not.
 *
 * `1e-6` sq ft is 0.000144 square inches — far below any real dimension this
 * app can express, and orders of magnitude above the accumulated error of
 * summing a few hundred areas of a few thousand square feet in a double. So
 * it can absorb the noise without ever rounding up a fraction that is really
 * there: a panel 0.001 sq ft over a whole foot still floors down.
 */
const BINARY_SUM_EPSILON_SQ_FT = 1e-6;

/**
 * The rate a PUBLIC viewer is shown: always the catalog's own figure, never a
 * project's adjusted one.
 *
 * > *"the public user should definetely not be the one seeing what could be
 * > the lowest price point ... i want to have the option for
 * > fabricators/people doing proposals to adjust the total average price/sq
 * > ft, i may want to test out what a particular building would cost at $20/sq
 * > ft"* — Tommy, 2026-11-08
 *
 * So the adjustment is private to the people quoting. A building a fabricator
 * is pricing at $20 still reads $25 to the public, and the gate is the same
 * shape as the one the retired 1.3× markup had — pointed the other way, since
 * the number being withheld is now the LOWER one rather than the higher one.
 */
export const PUBLIC_COVERAGE_RATE_PER_SQ_FT = priceRates.coveragePerSqFt;
