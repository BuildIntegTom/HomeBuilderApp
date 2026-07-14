import {
  computePlasterCoatCuFt,
  computePlasterMaterialCost,
  computePlasterMixCuFt,
  computePlasterUnits,
  type PlasterMixParts,
} from "@building-integrity/calc-engine";
import { plasterCubicFootageRef } from "@building-integrity/panel-catalog";

export interface PlasterCoatInputs {
  thicknessIn: number;
  parts: PlasterMixParts;
}
export interface PlasterSideInputs {
  base: PlasterCoatInputs;
  finish: PlasterCoatInputs;
}
export interface PlasterInputsState {
  interior: PlasterSideInputs;
  exterior: PlasterSideInputs;
}
export type PlasterSide = keyof PlasterInputsState;
export type PlasterCoat = keyof PlasterSideInputs;

export interface PlasterCoatResult {
  cuFt: number;
  mixCuFt: PlasterMixParts;
  buckets: PlasterMixParts;
  bagsClay: number;
  bagsLime: number;
  sandCuYd: number;
  tubs: PlasterMixParts;
  materialCost: number;
}

/** One coat's (Base or Finish) full materials + cost breakdown — see
 * packages/calc-engine/src/plaster.ts for the underlying formulas (every
 * one mirrors Tommy's "Faster Plaster Calculator" spreadsheet). Shared by
 * page.tsx (computing every active side/coat) and PlasterCoatEditor.tsx
 * (rendering the result). */
export function computePlasterCoatResult(
  coat: PlasterCoatInputs,
  areaSqFt: number,
  prices: { sandPricePerCuYd: number; clayPricePerBag: number; limePricePerBag: number; strawPricePerCuFt: number },
): PlasterCoatResult {
  const cuFt = computePlasterCoatCuFt(coat.thicknessIn, areaSqFt);
  const mixCuFt = computePlasterMixCuFt(coat.parts, cuFt);
  const toUnits = (perMaterialCuFt: PlasterMixParts, cuFtPerUnit: number): PlasterMixParts => ({
    sand: computePlasterUnits(perMaterialCuFt.sand, cuFtPerUnit),
    clay: computePlasterUnits(perMaterialCuFt.clay, cuFtPerUnit),
    lime: computePlasterUnits(perMaterialCuFt.lime, cuFtPerUnit),
    straw: computePlasterUnits(perMaterialCuFt.straw, cuFtPerUnit),
  });
  const buckets = toUnits(mixCuFt, plasterCubicFootageRef.bucketCuFt.value);
  const tubs = toUnits(mixCuFt, plasterCubicFootageRef.tub110GalCuFt.value);
  const cost = computePlasterMaterialCost(mixCuFt, { ...prices, bagCuFt: plasterCubicFootageRef.bagCuFt.value });
  return {
    cuFt,
    mixCuFt,
    buckets,
    bagsClay: computePlasterUnits(mixCuFt.clay, plasterCubicFootageRef.bagCuFt.value),
    bagsLime: computePlasterUnits(mixCuFt.lime, plasterCubicFootageRef.bagCuFt.value),
    sandCuYd: computePlasterUnits(mixCuFt.sand, 27),
    tubs,
    materialCost: cost.totalMaterialCost,
  };
}
