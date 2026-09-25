import type { PanelSlot } from "@building-integrity/geometry";

/**
 * The one decision that makes Smearforn Stage 1 (a hand-set width) and
 * Stage 2 (a hand-placed panel) compose instead of undoing each other.
 *
 * **The problem, stated plainly.** Every width edit re-tiles its wall
 * through `retileWithOpenings`, and the tiler derives the free run's COUNT
 * from the budget alone — so it hands back the same number of panels every
 * time it is asked, no matter what the wall currently holds. On a wall the
 * tiler laid out, that is exactly right. On a wall the user has since
 * hand-edited, it is a silent revert: `reconcileBracedPlacement` maps the
 * old markers onto the tiler's list, the wall still sums to its own length
 * — so neither the sum guard nor the pinned-width guard notices — and the
 * hand edit is simply gone.
 *
 * **The rule: DISAGREEMENT IN EITHER DIRECTION, not just one.** If the
 * tiler's answer holds a different number of standard-family slots than the
 * wall actually has, the tiler's answer is not usable for this edit and the
 * count-preserving path (`redistributeFreeRun`) is used instead.
 *
 * **⚠ This was `<` and it had to become `!==`, and the reason is worth
 * keeping.** `<` catches only the INSERT direction (the wall has more panels
 * than the tiler would give). After a DELETE the wall has FEWER, so the
 * guard read false, the tiler path ran, and **the tiler put the deleted
 * panel back** — silently, summing correctly, the identical revert this
 * function exists to prevent, mirrored. Bringing a wall's count down is
 * Stage 2's headline capability and typing widths is Stage 1's whole point;
 * on a real job those two gestures interleave on the same wall, so a
 * one-directional guard cancels the user's work with no notice at all.
 *
 * **Why the widening is not a behaviour change for an ordinary wall.**
 * `lockedWidthIn` never reaches the tiler: the tiler's count is a pure
 * function of `(lengthIn, standardWidthIn, corner widths, gapEnd, opening
 * anchors, allowBorrow)`. On a wall that has never been hand-placed on the
 * two counts are equal, so `!==` is false in exactly the cases `<` was.
 *
 * Kept here, as a pure function with a test of its own, rather than inline
 * in page.tsx — it is a rule, not a detail, and a wrong answer to it is
 * invisible in the UI until a panel count comes out wrong on a drawing.
 */
export function standardFamilyCount(slots: PanelSlot[]): number {
  return slots.filter((s) => s.type === "standard" || s.type === "braced").length;
}

/** See `standardFamilyCount`. `currentSlots` is the wall as it stands (with
 * the edit's own pin already applied); `tiledSlots` is what the tiler just
 * produced for the same wall. True when the two disagree about how many
 * panels this wall has — in EITHER direction. */
export function tilerWouldChangeThePanelCount(currentSlots: PanelSlot[], tiledSlots: PanelSlot[]): boolean {
  return standardFamilyCount(tiledSlots) !== standardFamilyCount(currentSlots);
}
