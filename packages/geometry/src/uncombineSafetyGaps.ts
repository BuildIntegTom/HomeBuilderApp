import { fromEighths, toEighths } from "./eighths";
import { safetyGapWidthForRunIn, TILER_MIN_PANEL_WIDTH_IN } from "./tiling";
import type { PanelSlot } from "./types";

/** One restored panel: where it was inserted, so a stored slot-index range
 * can be shifted over it. Indices are against the run as it stands when that
 * insertion happens, which is the convention `shiftSlotCoverage` expects, and
 * they come back in ascending order so a caller can apply them in sequence. */
export interface UncombinedSafetyGaps {
  slots: PanelSlot[];
  insertedAt: number[];
  /** Gaps whose combine could not be undone as a split — see the degenerate
   * case in `uncombineSafetyGapSlots`. They are no longer combined (the
   * `secondaryType` is stripped), but no panel came back and no index moved. */
  unsplitGapCount: number;
}

/**
 * Undoes the corner-brace combine on one stored wall — 2026-11-02.
 *
 * Tommy: *"We don't need any of this safety Gap combining stuff. I don't want
 * to see any of the panels combined with safety gaps."* The combine is deleted
 * (it lived in `applyBracedPlacement`, itself deleted a few hours later when
 * both automatic bracing rules were retired), so nothing produces a combined
 * slot any more —
 * but a project SAVED before today still carries them, and nothing re-tiles a
 * wall until somebody edits it. Without this, his existing drawings would keep
 * showing a `braced + safety-gap` panel at a corner, which is exactly the thing
 * he asked not to see.
 *
 * ### Why a split rather than a re-tile
 *
 * A combined slot IS two parts: a safety gap plus the standard panel the
 * combine swallowed whole. Splitting it back into those two restores the run's
 * panel COUNT and leaves its total width untouched to the eighth, so the wall's
 * own length stays exact (Tommy, 2026-09-29: *"this app needs to be perfectly
 * tight with dimensions and wall lengths"*). A re-tile would also fix the wall,
 * and would throw away every hand edit on it to do so.
 *
 * The gap gets the width a fresh tiling would give it — `safetyGapWidthForRunIn`
 * over this run's own length, so the 3/4in and 1/2in thresholds both come out
 * right — and the restored panel takes the remainder. The remainder is
 * `standardWidthIn` on every wall the combine actually fired on, because the
 * combined width was `standardWidthIn + 3/4in`; it is computed rather than
 * assumed so that a wall whose gap tier differs still sums.
 *
 * ### Which SIDE the restored panel goes, and the one thing it affects
 *
 * ⚠ **This is a reconstruction, not a record** — the same caveat the deleted
 * `combineSwallowedOrdinals` carried, and for the same reason: nothing was ever
 * persisted about which neighbour got eaten. The combine always took the panel
 * adjacent to the gap, on the side away from the corner it was walking in from,
 * so the restored panel goes toward the MIDDLE of the run. Getting that wrong
 * would put one panel on the wrong side of a 3/4in spacer; it cannot change the
 * wall's length or its part count.
 *
 * ### The degenerate case, refused rather than forced
 *
 * If the remainder would be under the fabrication minimum, the split would
 * invent an unbuildable panel. That gap instead keeps its stored width and just
 * loses its `secondaryType`: it is no longer combined with anything, the wall
 * still sums exactly, and no stored index moves. Counted so the caller can say
 * so. It should not be reachable from a file this app wrote — the combine's own
 * plan refused anything that left a panel outside the tiler's bounds — which is
 * precisely why it is handled here instead of being asserted away.
 */
export function uncombineSafetyGapSlots(slots: readonly PanelSlot[]): UncombinedSafetyGaps {
  const combinedCount = slots.filter((s) => s.type === "safety-gap" && s.secondaryType === "braced").length;
  if (combinedCount === 0) return { slots: slots as PanelSlot[], insertedAt: [], unsplitGapCount: 0 };

  const runLengthIn = slots.reduce((sum, slot) => sum + Math.max(0, slot.widthIn), 0);
  const gapWidthIn = safetyGapWidthForRunIn(runLengthIn);

  const out: PanelSlot[] = [];
  const insertedAt: number[] = [];
  let unsplitGapCount = 0;

  slots.forEach((slot, i) => {
    if (slot.type !== "safety-gap" || slot.secondaryType !== "braced") {
      out.push(slot);
      return;
    }
    const { secondaryType: _combined, ...gap } = slot;
    const restoredEighths = toEighths(slot.widthIn) - toEighths(gapWidthIn);
    if (restoredEighths < toEighths(TILER_MIN_PANEL_WIDTH_IN)) {
      unsplitGapCount++;
      out.push(gap);
      return;
    }
    const restored: PanelSlot = { type: "standard", widthIn: fromEighths(restoredEighths) };
    // Toward the middle of the run — see the reconstruction note above.
    const towardStart = i * 2 < slots.length - 1;
    if (towardStart) {
      out.push({ ...gap, widthIn: gapWidthIn });
      insertedAt.push(out.length);
      out.push(restored);
    } else {
      insertedAt.push(out.length);
      out.push(restored);
      out.push({ ...gap, widthIn: gapWidthIn });
    }
  });

  return { slots: out, insertedAt, unsplitGapCount };
}
