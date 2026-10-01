import { toEighths } from "./eighths";
import { TILER_MAX_PANEL_WIDTH_IN, TILER_MIN_PANEL_WIDTH_IN } from "./tiling";
import type { PanelSlot } from "./types";

/**
 * Settles `residualEighths` across `candidates` in order and returns each
 * one's new width, or `null` if it cannot reach exactly zero.
 *
 * Positive residual = surplus to hand BACK to the run (panels grow, none
 * past the shop's ceiling). Negative = a shortfall to take OUT of it (panels
 * shrink, none below the shop's floor). A panel the tiler already left
 * outside those bounds is left alone in the direction that would make it
 * worse, and is never "repaired" in the other one either — the tiler's own
 * residual sub-minimum cases are reported, not corrected, and that is not
 * this function's business to change.
 *
 * ### Why this lives in its own module
 *
 * It was `bracedPlacement.ts`'s private helper, written for
 * `planCornerBraceCombine` on 2026-09-29 and held there by that file's
 * 790,440-case product sweep. The locked-width re-force refusal
 * (`planLockedWidthReforce`, 2026-09-30) has the identical job — a
 * fixed-width slot that has to be paid for by the rest of the run, exactly,
 * or not at all — and the handoff for it was explicit that it must follow this
 * discipline rather than invent a second one. `bracedPlacement.ts` imports
 * `planLockedWidthReforce`, so the shared helper cannot live there without a
 * cycle. **This is a verbatim move, not a rewrite:** the body and the comment
 * above are the ones the combine shipped with, and the combine still calls
 * this one.
 *
 * ⚠ **The bounds are the TILER's, deliberately, and they are not a parameter.**
 * `TILER_MIN_PANEL_WIDTH_IN`/`TILER_MAX_PANEL_WIDTH_IN` (24in/48in) are the
 * widths this package already tiles to, and a settle that used some other pair
 * would produce panels the tiler itself would not have produced. They happen to
 * be the same two numbers `fabricationMinPanelWidthIn` and
 * `panelWidthInRange.maxIn` carry in the catalog; a caller that needs to QUOTE
 * a limit to a user takes it from the catalog instead (see
 * `panelWidthEdit.ts`'s `PanelWidthLimitsIn`, and `honourableLockedWidthRangeIn`).
 */
export function settleResidualEighths(
  slots: PanelSlot[],
  candidates: number[],
  residualEighths: number,
): Map<number, number> | null {
  const minEighths = toEighths(TILER_MIN_PANEL_WIDTH_IN);
  const maxEighths = toEighths(TILER_MAX_PANEL_WIDTH_IN);
  const resizedEighths = new Map<number, number>();
  let remainingEighths = residualEighths;
  for (const i of candidates) {
    if (remainingEighths === 0) break;
    const currentEighths = toEighths(slots[i]!.widthIn);
    if (remainingEighths > 0 && currentEighths >= maxEighths) continue; // no room to grow
    if (remainingEighths < 0 && currentEighths <= minEighths) continue; // no room to shrink
    const nextEighths =
      remainingEighths > 0
        ? Math.min(maxEighths, currentEighths + remainingEighths)
        : Math.max(minEighths, currentEighths + remainingEighths);
    resizedEighths.set(i, nextEighths);
    remainingEighths -= nextEighths - currentEighths;
  }
  return remainingEighths === 0 ? resizedEighths : null;
}
