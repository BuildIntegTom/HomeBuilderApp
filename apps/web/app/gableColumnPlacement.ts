import {
  getOpeningAnchors,
  isReservationType,
  retileWithColumnAtIn,
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

/**
 * ⚠ **How far off the peak a ridge column may already be and still be left
 * alone**, in inches.
 *
 * The column's two edges are snapped to the eighth grid, so a column whose
 * width is an odd number of eighths sits 1/16in off the true peak and can
 * never sit exactly on it. Anything inside half an eighth is that snap and
 * nothing else; anything outside it is a column in the wrong bay.
 */
const RIDGE_COLUMN_ON_PEAK_TOLERANCE_IN = 1 / 16;

/** Where each slot sits along the run, in inches from the run's own start. */
function slotSpans(slots: readonly PanelSlot[]): { slot: PanelSlot; startIn: number; endIn: number }[] {
  let atIn = 0;
  return slots.map((slot) => {
    const span = { slot, startIn: atIn, endIn: atIn + slot.widthIn };
    atIn += slot.widthIn;
    return span;
  });
}

/** The slots with one Column Panel placed, or null when the wall has no safe
 * non-corner position for one. */
export function placeColumnUnderPeak(inputs: ColumnUnderPeakInputs): PanelSlot[] | null {
  const standardFamilyCount = inputs.slots.filter((s) => s.type === "standard" || s.type === "braced").length;
  if (standardFamilyCount < 3) return null;

  /** The peak in the RUN's own frame, which is the frame every slot span
   * below is measured in — and the frame `retileWithColumnAtIn` wants. */
  const peakInRunIn = inputs.peakXIn - inputs.startOffsetIn;

  /* ⚠ **Already carrying a column ON THE PEAK? Then the wall is done**, and
     re-tiling would move every panel on it for nothing.

     ⚠ **This used to accept a column of the right WIDTH anywhere on the
     wall**, which made a misplaced ridge column permanent: the first pass
     put one 15in off the peak, and every pass after that saw "a column of
     this width exists" and refused to touch it. The test is now where the
     column is, not that it exists. */
  const existingColumn = slotSpans(inputs.slots).find(
    (sp) => sp.slot.type === "column" && Math.abs(sp.slot.widthIn - inputs.columnWidthIn) < 0.01,
  );
  if (
    existingColumn &&
    Math.abs((existingColumn.startIn + existingColumn.endIn) / 2 - peakInRunIn) <= RIDGE_COLUMN_ON_PEAK_TOLERANCE_IN
  ) {
    return null;
  }

  /* The ridge column is the one being placed, so it is never carried as an
     opening — otherwise a re-place would reserve width for two of them. */
  const slotsWithoutRidgeColumn = existingColumn
    ? inputs.slots.filter((s) => s !== existingColumn.slot)
    : [...inputs.slots];
  const existingAnchors = getOpeningAnchors([...slotsWithoutRidgeColumn]);

  /**
   * ⚠ **EXACTLY UNDER THE PEAK FIRST, by tiling the two sides of the
   * column as separate runs.**
   *
   * > *"some weird inclined changes in the slope to an off centered column
   * > panel that's not the right height."* — Tommy, 2026-11-01
   *
   * The ordinal search below can only put the column where the middle run's
   * own panel boundaries fall. On his 22ft 9in gable wall the nearest was
   * **2.25in off the peak**, and all three viable ordinals were measured at
   * —50.25in, —2.25in and +23.63in — none of them reach it. Asked which
   * gives way, he chose to trim the neighbours rather than move the ridge.
   *
   * ⚠ **IT CARRIES THE WALL'S OTHER OPENINGS NOW, and that is the fix.**
   *
   * This block used to run only `if (existingAnchors.length === 0)`, because
   * `retileWithColumnAtIn` knew about one reservation and a wall with windows
   * or doors would have lost them. The comment here justified that as narrow:
   * *"it is the freshly-drawn wall that spawns a ridge column, and it has no
   * openings yet."*
   *
   * **Auto-spawned windows and doors made that false**, and nothing noticed.
   * Every freshly-drawn gable wall now arrives carrying openings, so this
   * block stopped running at all and every ridge column fell through to the
   * ordinal search below. Measured on a 24 x 24 at 4:12 with the peak at
   * 144in: wall BC put its column at 159..184.5 (**15in past the ridge**) and
   * wall DA put its at 103.6..129.1 (**27.6in short of it**) — so the ridge
   * beam spanning between them was not even parallel to the building, and the
   * gable row faithfully copied both.
   *
   * ⚠ **An opening is assigned to the side its own CENTRE falls on**, which
   * is what slides a window out from under the ridge instead of refusing the
   * column. The alternative — refusing whenever anything overlaps the peak —
   * leaves the ridge beam bearing on a window header, which is not a trade
   * worth making. The tiler still refuses outright when a side's openings no
   * longer fit beside the column, and then the ordinal search runs.
   */
  {
    const columnStartIn = peakInRunIn - inputs.columnWidthIn / 2;
    const reservationSpans = slotSpans(slotsWithoutRidgeColumn).filter((sp) => isReservationType(sp.slot.type));
    /* Re-base the far side's ordinals onto the right run's own standards:
       every standard-family slot that ends at or before the column is on the
       left run and no longer precedes them. */
    const standardsLeftOfColumn = slotSpans(slotsWithoutRidgeColumn).filter(
      (sp) => (sp.slot.type === "standard" || sp.slot.type === "braced") && sp.endIn <= columnStartIn,
    ).length;
    const leftOpenings: OpeningAnchor[] = [];
    const rightOpenings: OpeningAnchor[] = [];
    existingAnchors.forEach((anchor, i) => {
      const span = reservationSpans[i];
      const centreIn = span ? (span.startIn + span.endIn) / 2 : Infinity;
      if (centreIn < peakInRunIn) leftOpenings.push(anchor);
      else rightOpenings.push({ ...anchor, beforeStandardCount: Math.max(0, anchor.beforeStandardCount - standardsLeftOfColumn) });
    });

    const exact = retileWithColumnAtIn(
      inputs.lengthIn,
      inputs.standardWidthIn,
      inputs.cornerWidthIn,
      inputs.gapEnd,
      inputs.hasCornerStart,
      inputs.hasCornerEnd,
      peakInRunIn,
      inputs.columnWidthIn,
      inputs.allowBorrow,
      inputs.cornerMayWiden,
      leftOpenings,
      rightOpenings,
    );
    if (exact) return exact.slots;
  }

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
