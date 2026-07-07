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

/** total = sum(area x rate-by-type) x 1.3 modifier */
export function computePrice(panels: PriceablePanel[]): number {
  const subtotal = panels.reduce(
    (sum, panel) => sum + panel.areaSqFt * RATE_BY_TYPE[panel.type],
    0,
  );
  return subtotal * priceRates.totalModifier;
}
