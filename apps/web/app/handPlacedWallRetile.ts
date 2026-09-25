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
 * inserted a panel onto, it is a silent revert: `reconcileBracedPlacement`
 * maps the old markers onto the tiler's shorter list, the surplus marker
 * falls off the end, the wall still sums to its own length — so neither the
 * sum guard nor the pinned-width guard notices — and the hand-placed panel
 * is simply gone.
 *
 * **The rule.** If the tiler's answer holds fewer standard-family slots
 * than the wall actually has, the tiler's answer is not usable for this
 * edit and the count-preserving path (`redistributeFreeRun`) is used
 * instead. A wall that has never been hand-placed on gives the same count
 * both ways, so it takes the tiler path exactly as it did before Stage 2.
 *
 * Kept here, as a pure function with a test of its own, rather than inline
 * in page.tsx — it is a rule, not a detail, and a wrong answer to it is
 * invisible in the UI until a panel count comes out short on a drawing.
 */
export function standardFamilyCount(slots: PanelSlot[]): number {
  return slots.filter((s) => s.type === "standard" || s.type === "braced").length;
}

/** See `standardFamilyCount`. `currentSlots` is the wall as it stands (with
 * the edit's own pin already applied); `tiledSlots` is what the tiler just
 * produced for the same wall. */
export function tilerWouldDropPanels(currentSlots: PanelSlot[], tiledSlots: PanelSlot[]): boolean {
  return standardFamilyCount(tiledSlots) < standardFamilyCount(currentSlots);
}
