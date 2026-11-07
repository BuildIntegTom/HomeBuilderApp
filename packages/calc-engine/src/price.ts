import { beamPriceRatePerSqFt, priceRates } from "@building-integrity/panel-catalog";

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

const RATE_BY_TYPE: Record<PriceablePanelType, number> = {
  standard: priceRates.standardPerSqFt,
  corner: priceRates.cornerPerSqFt,
  braced: priceRates.bracedPerSqFt,
  opening: priceRates.headerSillPerSqFt,
  column: priceRates.columnPerSqFt,
  /* ⚠ Its own bucket at his own $25, and it is the only rate here LOWER than
     a standard panel's. See `bigHeaderPerSqFt` for why that is right rather
     than a typo. ⚠ Not the `opening` bucket: a spanning header IS charged
     there by his 2026-09-25 decision, and the two are the same geometry, so
     this is a second decision of his sitting beside the first rather than an
     inconsistency nobody noticed. */
  "big-header": priceRates.bigHeaderPerSqFt,
  /** The GABLE row, which is a wall standing under a roof, not a roof. */
  roof: priceRates.roofPerSqFt,
  /* ⚠ These two are per square foot of COVERAGE — what the panel lies
     under or over — while every rate above is per square foot of the face
     a panel stands up as. Same unit, different area, and the caller is
     what knows which one it is handing over. */
  "floor-panel": priceRates.floorPanelPerSqFt,
  "roof-panel": priceRates.roofPanelPerSqFt,
  /* ⚠ Its own bucket because he asked for one, at the rate beams were
     already charged, because he gave no figure. See its own doc comment. */
  beam: beamPriceRatePerSqFt.value,
};

/**
 * total = sum(area x rate-by-type) x modifier. `modifier` defaults to 1 (no
 * markup) — callers decide when it applies. Tommy: the 1.3x modifier is a
 * fabricator/admin-only markup, editable in the UI, not something public
 * viewers see applied to the base material cost.
 */
export function computePrice(panels: PriceablePanel[], modifier: number = 1): number {
  const subtotal = panels.reduce(
    (sum, panel) => sum + panel.areaSqFt * RATE_BY_TYPE[panel.type],
    0,
  );
  return subtotal * modifier;
}
