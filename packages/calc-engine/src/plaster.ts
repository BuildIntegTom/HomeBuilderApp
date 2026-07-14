/**
 * Straw-clay/lime plaster material and labor math (Tommy: "Plaster Master
 * detail page... total materials and total price for plaster options"),
 * derived from Tommy's own "Faster Plaster Calculator" spreadsheet. Every
 * formula here mirrors that spreadsheet's own cells (see the module's test
 * file for the spreadsheet's own worked examples as golden values) — sand,
 * clay, lime, and chopped straw mixed by volume ("Parts") into a Base Coat
 * (scratch/brown coat, straight onto the straw) and a Finish Coat (thin
 * smooth top layer), each convertible into buckets/bags/cu-yd/110-gal-tub
 * purchase units, plus a per-room-free labor-hours estimate (field vs.
 * edge/trim time near rough openings).
 */

export interface PlasterMixParts {
  sand: number;
  clay: number;
  lime: number;
  straw: number;
}

export interface PlasterMixCuFt {
  sand: number;
  clay: number;
  lime: number;
  straw: number;
}

/** Total Cu. Ft = (thickness in inches / 12) x area — spreadsheet's own
 * `D5: =SUM(B5*0.083333)*C5` (0.083333 = 1/12). */
export function computePlasterCoatCuFt(thicknessIn: number, areaSqFt: number): number {
  return (thicknessIn / 12) * areaSqFt;
}

/** Splits a coat's total Cu. Ft across sand/clay/lime/straw by their
 * relative "Parts" ratio (spreadsheet's own Ratios/Cu. Ft rows: each
 * material's ratio = its own parts / total parts, then cu ft = ratio x
 * the coat's total cu ft). A part left at 0 (e.g. finish coat's clay/straw)
 * contributes 0 cu ft, matching the spreadsheet leaving those cells blank. */
export function computePlasterMixCuFt(parts: PlasterMixParts, totalCuFt: number): PlasterMixCuFt {
  const totalParts = parts.sand + parts.clay + parts.lime + parts.straw;
  if (totalParts <= 0) return { sand: 0, clay: 0, lime: 0, straw: 0 };
  return {
    sand: (parts.sand / totalParts) * totalCuFt,
    clay: (parts.clay / totalParts) * totalCuFt,
    lime: (parts.lime / totalParts) * totalCuFt,
    straw: (parts.straw / totalParts) * totalCuFt,
  };
}

/** Generic cu-ft -> purchase-unit conversion (buckets at 0.5 cu ft/bucket,
 * bags at 1.25 cu ft/bag, cu yd at 27 cu ft/yd — see plasterCubicFootageRef
 * in panel-catalog's data.ts). */
export function computePlasterUnits(cuFt: number, cuFtPerUnit: number): number {
  if (cuFtPerUnit <= 0) return 0;
  return cuFt / cuFtPerUnit;
}

export interface PlasterLaborHours {
  fieldHrs: number;
  edgeHrs: number;
  fussyHrs: number;
  totalHrs: number;
}

/**
 * Labor-hours estimate (Tommy: "include labor hours too"), collapsing the
 * spreadsheet's per-room "Time" table (Room/Plane x Area x # ROs x Field/
 * Edge % x Hrs) into one whole-side calculation: each rough opening (door
 * or window) gets `edgeAllowanceSqFt` of "edge" (trim/cutting-in) area
 * carved out of the total, billed at `edgeHrsPerSqFt` (slower, detail work)
 * — the remainder is open "field" area at the faster `fieldHrsPerSqFt`.
 * `fussyHrsExtra` is a manual add-on (the spreadsheet's blank "Fussy Hrs"
 * column) for extra detail work this simple model doesn't capture.
 */
export function computePlasterLaborHours(
  areaSqFt: number,
  roughOpeningCount: number,
  edgeAllowanceSqFt: number,
  fieldHrsPerSqFt: number,
  edgeHrsPerSqFt: number,
  fussyHrsExtra: number = 0,
): PlasterLaborHours {
  const edgeAreaSqFt = Math.min(Math.max(areaSqFt, 0), roughOpeningCount * edgeAllowanceSqFt);
  const fieldAreaSqFt = Math.max(areaSqFt, 0) - edgeAreaSqFt;
  const fieldHrs = fieldAreaSqFt * fieldHrsPerSqFt;
  const edgeHrs = edgeAreaSqFt * edgeHrsPerSqFt;
  return { fieldHrs, edgeHrs, fussyHrs: fussyHrsExtra, totalHrs: fieldHrs + edgeHrs + fussyHrsExtra };
}

export interface PlasterMaterialPrices {
  sandPricePerCuYd: number;
  clayPricePerBag: number;
  limePricePerBag: number;
  strawPricePerCuFt: number;
  bagCuFt: number;
}

export interface PlasterMaterialCost {
  sandCost: number;
  clayCost: number;
  limeCost: number;
  strawCost: number;
  totalMaterialCost: number;
}

/** Sand prices by the cu-yd (how it's actually sold/delivered), clay/lime
 * by the bag (via bagCuFt), chopped straw by the cu ft directly (the
 * spreadsheet never gives chopped straw its own bag/bale purchase unit). */
export function computePlasterMaterialCost(cuFt: PlasterMixCuFt, prices: PlasterMaterialPrices): PlasterMaterialCost {
  const sandCost = (cuFt.sand / 27) * prices.sandPricePerCuYd;
  const clayCost = computePlasterUnits(cuFt.clay, prices.bagCuFt) * prices.clayPricePerBag;
  const limeCost = computePlasterUnits(cuFt.lime, prices.bagCuFt) * prices.limePricePerBag;
  const strawCost = cuFt.straw * prices.strawPricePerCuFt;
  return { sandCost, clayCost, limeCost, strawCost, totalMaterialCost: sandCost + clayCost + limeCost + strawCost };
}

export function computePlasterLaborCost(totalHrs: number, ratePerHour: number): number {
  return totalHrs * ratePerHour;
}
