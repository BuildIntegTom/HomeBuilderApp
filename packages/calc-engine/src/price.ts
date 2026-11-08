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
  return panels.reduce((sum, panel) => sum + panel.areaSqFt, 0) * ratePerSqFt;
}

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
