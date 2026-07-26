import type { PanelSlot } from "./types";

/** A contiguous, half-open range of slot indices `[startSlotIndex,
 * endSlotIndex)` within one wall's own second-story `PanelSlot[]` array —
 * the wall's own Box Beam coverage. Using slot indices (not raw inches)
 * makes "the boundary always lands on a real panel edge" automatic — a
 * covered range is always a whole number of consecutive slots. */
export interface BoxBeamCoverage {
  startSlotIndex: number;
  endSlotIndex: number;
}

export interface RoofBearingSegment {
  kind: "truss-plate" | "box-beam";
  /** Offset from the wall's own start corner, inches. */
  startXIn: number;
  lengthIn: number;
}

/**
 * Splits one wall's own top into 1-3 roof-bearing segments (Tommy: "options
 * for being a ring all the way around or just one section of the wall") —
 * a Truss Plate for any uncovered stretch, a Box Beam for the covered
 * range in between. `coverage` undefined (or an empty/inverted range)
 * means no Box Beam on this wall at all — one Truss Plate spanning the
 * wall's own full length, same as before per-wall coverage existed. A
 * full-range coverage (`{startSlotIndex: 0, endSlotIndex: slots.length}`,
 * the "ring" case) collapses to one Box Beam segment spanning the wall's
 * own full length, with no Truss Plate segment either side.
 */
export function computeRoofBearingSegments(slots: PanelSlot[], coverage: BoxBeamCoverage | undefined): RoofBearingSegment[] {
  const totalIn = slots.reduce((sum, s) => sum + s.widthIn, 0);
  if (totalIn <= 0) return [];
  if (!coverage || coverage.endSlotIndex <= coverage.startSlotIndex) {
    return [{ kind: "truss-plate", startXIn: 0, lengthIn: totalIn }];
  }

  const offsetsIn: number[] = [0];
  for (const slot of slots) offsetsIn.push(offsetsIn[offsetsIn.length - 1]! + slot.widthIn);
  const clampedStart = Math.min(Math.max(coverage.startSlotIndex, 0), slots.length);
  const clampedEnd = Math.min(Math.max(coverage.endSlotIndex, 0), slots.length);
  const startXIn = offsetsIn[clampedStart] ?? 0;
  const endXIn = offsetsIn[clampedEnd] ?? totalIn;

  const segments: RoofBearingSegment[] = [];
  if (startXIn > 0) segments.push({ kind: "truss-plate", startXIn: 0, lengthIn: startXIn });
  if (endXIn > startXIn) segments.push({ kind: "box-beam", startXIn, lengthIn: endXIn - startXIn });
  if (totalIn > endXIn) segments.push({ kind: "truss-plate", startXIn: endXIn, lengthIn: totalIn - endXIn });
  return segments;
}

/** True if a given slot index falls inside a wall's own Box Beam coverage
 * range — the shared predicate every per-instance height-override consumer
 * (panelInstances.ts, panelSlotBoxes3D consumers, WallElevationView's own
 * row rendering) should use, so "which slots are covered" is defined in
 * exactly one place. */
export function isSlotBoxBeamCovered(slotIndex: number, coverage: BoxBeamCoverage | undefined): boolean {
  return !!coverage && slotIndex >= coverage.startSlotIndex && slotIndex < coverage.endSlotIndex;
}
