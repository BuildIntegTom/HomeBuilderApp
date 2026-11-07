import type { PanelSlot } from "@building-integrity/geometry";

/**
 * **B33 — the priced face of every Big Header in a building.**
 *
 * > *"Big Header price rate: $25/sq ft."* — Tommy, 2026-11-05.
 *
 * ⚠ **Why this is not one more line in the `price` memo's own `areaSqFtFor`.**
 * That helper multiplies every slot of a type by the STORY's wall height,
 * which is right for a panel that stands floor to plate and wrong for this
 * one by a factor of four: a Big Header is a short assembly sitting in a
 * full-height slot. Its own height is what the user typed into its left-bar
 * field, so it needs its own measurement, and a pure function is where that
 * measurement can be tested.
 *
 * ⚠ **The opt-in sill is part of the same face.** `buildBigHeaderMembers`
 * appends it below z = 0 and it goes on the same fabrication sheet, so it is
 * the same fabricated part and carries the same rate. A separate rate for it
 * was not invented.
 *
 * Both defaults are passed in rather than imported, for the reason
 * `panelWidthEdit.ts` already gives about its limits: `bigHeaderDefaultHeightIn`
 * is `pending-BI-confirmation` and a caller should be able to see that it is
 * reading it.
 */
export interface BigHeaderFaceAreaInput {
  /** Every slot in the building, all stories flattened — only `big-header`
   * ones are read. */
  slots: readonly PanelSlot[];
  /** `bigHeaderDefaultHeightIn.value`, for a slot that carries no height. */
  defaultHeightIn: number;
  /** `sillDefaultHeightIn.value`, added only where the sill is opted in. */
  sillHeightIn: number;
}

export function bigHeaderFaceAreaSqFt({ slots, defaultHeightIn, sillHeightIn }: BigHeaderFaceAreaInput): number {
  let areaSqFt = 0;
  for (const slot of slots) {
    if (slot.type !== "big-header") continue;
    const assemblyHeightIn = (slot.heightIn ?? defaultHeightIn) + (slot.includeSillOnBigHeader === true ? sillHeightIn : 0);
    areaSqFt += (slot.widthIn / 12) * (assemblyHeightIn / 12);
  }
  return areaSqFt;
}
