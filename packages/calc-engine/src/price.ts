import { priceRates } from "@building-integrity/panel-catalog";

export type PriceablePanelType = "standard" | "corner" | "braced" | "opening" | "column" | "roof";

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
  roof: priceRates.roofPerSqFt,
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
