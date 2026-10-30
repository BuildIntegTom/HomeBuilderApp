import {
  getOpeningAnchors,
  retileWithOpenings,
  type OpeningAnchor,
  type PanelSlot,
  type WallEnd,
} from "@building-integrity/geometry";

/**
 * Where a main-level Column Panel goes so the GABLE column above it lands on
 * something.
 *
 * > *"the ridge beam should land on top of a Gable column panel... If there
 * > is a Gable column panel that spawns, there must be a column panel
 * > directly below it in the main level wall and all the way down spawning
 * > two extra structural girts in the floor panels, one underneath each side
 * > of the panel."* — Tommy, 2026-10-29
 *
 * ⚠ **The ordinal is found by TILING FOR REAL, not by arithmetic.**
 * `retileWithOpenings` rebuilds every standard-family slot's width around
 * whatever the full anchor set leaves in budget, so a centre computed from
 * the slots as they stand BEFORE the reservation is inserted cannot predict
 * where the column actually ends up. Each viable ordinal is tiled and the
 * one whose real post-retile centre lands nearest the peak wins. This is
 * what makes the wall column come out flush with the gable column above it,
 * which is itself always centred on the same peak.
 *
 * ⚠ **Corner-adjacent ordinals are excluded**, mirroring the default-window
 * seeding: a column hard against a corner fights the corner panel's own
 * framing. A wall with fewer than three standard-family slots therefore gets
 * nothing, and says so by returning null rather than forcing one in.
 */
export interface ColumnUnderPeakInputs {
  /** The wall's current slots, on the story being placed into. */
  slots: readonly PanelSlot[];
  /** The peak's distance from the wall's TRUE start corner, in inches —
   * the same origin `computeGableTiledRow` uses. */
  peakXIn: number;
  /**
   * ⚠ Where this story's own slots begin, measured from that same true
   * corner. Only zero when the wall owns its start corner and nothing is
   * stopped off it; otherwise a neighbour's corner panel fills the first
   * sliver and every slot sits this far along. Leaving it out would compare
   * a peak measured from the corner against a centre measured from the run.
   */
  startOffsetIn: number;
  /** The run's own tiled length, not the wall's nominal length. */
  lengthIn: number;
  standardWidthIn: number;
  cornerWidthIn: number;
  gapEnd: WallEnd;
  hasCornerStart: boolean;
  hasCornerEnd: boolean;
  allowBorrow: boolean;
  cornerMayWiden: boolean;
  columnWidthIn: number;
}

/** The slots with one Column Panel placed, or null when the wall has no safe
 * non-corner position for one. */
export function placeColumnUnderPeak(inputs: ColumnUnderPeakInputs): PanelSlot[] | null {
  const standardFamilyCount = inputs.slots.filter((s) => s.type === "standard" || s.type === "braced").length;
  if (standardFamilyCount < 3) return null;

  /* Already carrying a column of this width? Then the wall is done, and
     re-tiling would move every panel on it for nothing. */
  if (inputs.slots.some((s) => s.type === "column" && Math.abs(s.widthIn - inputs.columnWidthIn) < 0.01)) {
    return null;
  }

  const existingAnchors = getOpeningAnchors([...inputs.slots]);
  let bestSlots: PanelSlot[] | null = null;
  let bestDistanceIn = Infinity;

  for (let ordinal = 1; ordinal < standardFamilyCount - 1; ordinal++) {
    const anchors: OpeningAnchor[] = [
      ...existingAnchors,
      { beforeStandardCount: ordinal, type: "column", widthIn: inputs.columnWidthIn },
    ];
    const trialSlots = retileWithOpenings(
      inputs.lengthIn,
      inputs.standardWidthIn,
      inputs.cornerWidthIn,
      inputs.gapEnd,
      inputs.hasCornerStart,
      inputs.hasCornerEnd,
      anchors,
      inputs.allowBorrow,
      inputs.cornerMayWiden,
    ).slots;

    let cursorIn = inputs.startOffsetIn;
    let distanceIn = Infinity;
    for (const slot of trialSlots) {
      if (slot.type === "column" && Math.abs(slot.widthIn - inputs.columnWidthIn) < 0.01) {
        distanceIn = Math.min(distanceIn, Math.abs(cursorIn + slot.widthIn / 2 - inputs.peakXIn));
      }
      cursorIn += slot.widthIn;
    }
    if (distanceIn < bestDistanceIn) {
      bestDistanceIn = distanceIn;
      bestSlots = trialSlots;
    }
  }

  return bestSlots;
}
