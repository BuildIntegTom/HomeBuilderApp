import { TILER_MAX_PANEL_WIDTH_IN, TILER_MIN_PANEL_WIDTH_IN } from "./tiling";
import type { PanelSlot } from "./types";

/**
 * TILE-ONCE STAGE 4e — the one tidy-up a length change is allowed to do, when
 * the user lets go of the drag.
 *
 * Tommy, 2026-10-01, on what happens to a part-width leftover:
 *
 * > *"2 but perhaps with thresholds. There might be some adding panels and
 * > divide by 2 if it wants to build a 4ft+ absorbion"*
 *
 * That is the tiler's existing absorb-or-split rule, and his "4ft+" is its
 * 48in ceiling by name. What this module adds is **when it fires**, which he
 * settled on 2026-10-17:
 *
 * 1. **On release, and ONLY if a panel is unbuildable.** A panel already
 *    inside [24in, 48in] is left exactly where he put it. Tiny panels during
 *    the drag stay fine — *"there should be a drag tool on the elevation
 *    editor"* — and nothing tidies a wall that is already legal. ⚠ This is the
 *    whole reason the model is called tile-once: a pass that normalised every
 *    release would be the tiler running behind his back again, just later.
 * 2. **Never touch a hand-set width.** A `lockedWidthIn` panel is his
 *    decision; absorbing it would undo work he did deliberately. The tidy
 *    absorbs into an AUTOMATIC neighbour, and where there is none it refuses
 *    and reports rather than overruling him.
 * 3. **Both directions.** A sliver left by shrinking is treated exactly like
 *    one left by growing — one rule, one behaviour to learn.
 * 4. **Say so when a part changes**, because a merged or split panel is a
 *    different fabricated part. Silent on every ordinary drag.
 *
 * ⚠ **Absorb and split are exactly complementary, and only by a coincidence
 * worth protecting.** Absorbing is legal iff `combined ≤ 48in`; splitting is
 * legal iff `combined ≥ 2 × 24in = 48in`. They overlap at exactly 48in, so
 * every combined width has a legal answer — and that is true ONLY because the
 * maximum is exactly twice the minimum. Move either number and a band of
 * widths becomes genuinely untidiable. The coupling is asserted in
 * `tilerFabricationLimits.test.ts` so it fails loudly rather than here.
 */

const toEighths = (inches: number): number => Math.round(inches * 8);
const toInches = (eighths: number): number => eighths / 8;

/** Placed by rule, so never merged or split — see `resizeWallRun`. */
function isRulePlaced(slot: PanelSlot): boolean {
  return slot.type === "corner" || slot.type === "safety-gap";
}

/** An opening is a part in its own right: merging a window into its neighbour
 * would delete an opening the user placed, which no tidy may do. */
function isOpening(slot: PanelSlot): boolean {
  return slot.type === "window" || slot.type === "door";
}

/** Eligible to absorb a leftover: plain framing, automatic width, not an
 * opening and not rule-placed. */
function isAbsorber(slot: PanelSlot): boolean {
  return !isRulePlaced(slot) && !isOpening(slot) && slot.lockedWidthIn === undefined;
}

export interface TidyResult {
  slots: PanelSlot[];
  /** How many panels were merged away or re-split. Zero on an ordinary drag,
   * which is why the caller can show a notice only when it is non-zero. */
  changedParts: number;
  /**
   * Panels still under the minimum because nothing adjacent could legally take
   * them — a hand-set neighbour, an opening, or a wall with nothing else on
   * it. Reported, never overruled.
   */
  unresolvedIndexes: number[];
}

/**
 * Absorb or split any panel below the shop minimum, once.
 *
 * @param minIn Shop minimum panel width. Defaults to the tiler's own, so a
 *   caller cannot quietly tidy to a different standard than the tiler builds
 *   to.
 */
export function tidyUnbuildableLeftovers(
  slots: readonly PanelSlot[],
  minIn: number = TILER_MIN_PANEL_WIDTH_IN,
  maxIn: number = TILER_MAX_PANEL_WIDTH_IN,
): TidyResult {
  const minE = toEighths(minIn);
  const maxE = toEighths(maxIn);
  const working = slots.map((s) => ({ ...s }));
  let changedParts = 0;
  const unresolvedIndexes: number[] = [];

  /* One pass, left to right, re-checking the index after a merge because a
     merge removes a slot and shifts everything after it. A leftover can only
     be created at a dragged END, so a single pass is enough — but it is
     written to survive more than one rather than assuming. */
  for (let i = 0; i < working.length; i++) {
    const slot = working[i]!;
    if (isRulePlaced(slot) || isOpening(slot)) continue;
    if (toEighths(slot.widthIn) >= minE) continue;
    /* ⚠ A hand-set panel under the minimum is NOT tidied. He set it; the
       Review Log is where that gets reported, not here. */
    if (slot.lockedWidthIn !== undefined) {
      unresolvedIndexes.push(i);
      continue;
    }

    // Prefer the neighbour that keeps the result legal; if both do, the one
    // the leftover was dragged away from — the later index — reads as "it
    // went back where it came from".
    const candidates = [i + 1, i - 1].filter((j) => j >= 0 && j < working.length && isAbsorber(working[j]!));
    if (candidates.length === 0) {
      unresolvedIndexes.push(i);
      continue;
    }

    const j = candidates[0]!;
    const combined = toEighths(slot.widthIn) + toEighths(working[j]!.widthIn);

    if (combined <= maxE) {
      // Absorb: one panel, the neighbour's identity, the combined width.
      working[j] = { ...working[j]!, widthIn: toInches(combined) };
      working.splice(i, 1);
      changedParts += 1;
      i -= 1; // the array shifted under us
      continue;
    }

    /* Split: too wide to be one panel, so make two. Both land in range
       because `combined > maxE` and `maxE === 2 * minE`, which is the coupling
       this module's doc comment names. Halved on the EIGHTH grid, with the odd
       eighth going to the neighbour rather than being lost. */
    const half = Math.floor(combined / 2);
    working[i] = { ...slot, widthIn: toInches(half) };
    working[j] = { ...working[j]!, widthIn: toInches(combined - half) };
    changedParts += 1;
  }

  return { slots: working, changedParts, unresolvedIndexes };
}
