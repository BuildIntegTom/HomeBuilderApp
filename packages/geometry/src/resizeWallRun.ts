import type { PanelSlot } from "./types";

/**
 * TILE-ONCE STAGE 4 — a wall gets longer or shorter, and its panels are
 * MANIPULATED rather than re-derived.
 *
 * Tommy's spec, 2026-09-30, and this is the whole behaviour:
 *
 * > *"when a user drags the east side of a square building making it bigger,
 * > it auto populates standard panels that enter and grow with the drag. When
 * > that side is dragged back, each of those latest panels shrinks and
 * > disappears. This will make some tiny panels as the drag is marked, and I
 * > think this is okay because there should be a drag tool on the elevation
 * > editor that allows one to drag the side of a panel and shrink/grow the one
 * > next to it."*
 *
 * And for an opening caught in the part a shrink removes, 2026-10-02:
 *
 * > *"It shortens the width of the RO, header, and sill and those shrink with
 * > the drag. This happens until it's less than 1' in which case the RO,
 * > header, and sill all 3 get replaced by 1 standard panel. That continues
 * > down to zero (even though that would make an 'impossible' panel - that's
 * > okay as long as the elevation edit tools can allow the user to fix it)."*
 *
 * ⚠ **CONSERVING BY CONSTRUCTION, like the swap and the boundary drag.** This
 * function works in whole EIGHTHS and moves a budget: it never computes a
 * width from a length and then hopes the sum lands. Every eighth it takes off
 * one slot it has already counted, and it stops when the budget is spent, so
 * `Σ(widthIn)` is `old total + delta` exactly — there is no residual to settle
 * and nothing for an invariant to catch. That is the property the tile-once
 * model is built on (see the spec's "The property that makes it work").
 */

/** The 1/8in grid the whole app is held to. Integer eighths in, integer
 * eighths out — no float width is ever produced here. */
const toEighths = (inches: number): number => Math.round(inches * 8);
const toInches = (eighths: number): number => eighths / 8;

/**
 * Below this, an opening caught in a shrink stops being an opening.
 *
 * Tommy's "less than 1'". The RO, its header and its sill are one slot in this
 * model (the header and sill are that slot's own zones), so "all 3 get
 * replaced by 1 standard panel" is a type change on one slot rather than a
 * three-way splice.
 */
export const OPENING_COLLAPSE_BELOW_IN = 12;

/**
 * Parts placed by rule rather than by the user, which a length change must not
 * consume — spec: *"Two parts remain rule-placed and therefore keep moving by
 * themselves: the corner panels and the safety gap."*
 *
 * ⚠ A corner panel's width IS its geometry (it wraps the corner), and the
 * safety gap is a fixed 3/4in detail. Letting either absorb a drag would make
 * the drag silently change a part whose size is not the user's to choose.
 */
function isRulePlaced(slot: PanelSlot): boolean {
  return slot.type === "corner" || slot.type === "safety-gap";
}

/** Whether this slot is an opening, for the collapse rule. */
function isOpening(slot: PanelSlot): boolean {
  return slot.type === "window" || slot.type === "door";
}

export interface ResizeWallRunResult {
  slots: PanelSlot[];
  /** How many openings the shrink collapsed into standard panels. The caller
   * reports these; they are a real change to what gets fabricated and must
   * not happen silently. */
  collapsedOpenings: number;
  /**
   * Eighths the wall could NOT give up, because everything that was allowed
   * to shrink had already reached zero.
   *
   * ⚠ Non-zero means the request was impossible, not that it was rounded: the
   * caller must refuse rather than show a wall whose panels no longer sum to
   * its length. Tommy's standing rule is that wall lengths are exact.
   */
  shortfallEighths: number;
}

/**
 * Grow or shrink a wall's panel run at ONE end.
 *
 * @param deltaIn  Positive grows, negative shrinks. Snapped to eighths.
 * @param growAtEnd Which end the drag is pulling. `"end"` is the high-index
 *   end of the array. Panels enter, grow, shrink and disappear HERE and
 *   nowhere else — which is what makes a length change feel like the wall
 *   being pulled rather than the whole run reflowing.
 * @param standardWidthIn The width a growing panel stops at before the next
 *   one enters behind it.
 */
export function resizeWallRun(
  slots: readonly PanelSlot[],
  deltaIn: number,
  growAtEnd: "start" | "end",
  standardWidthIn: number,
): ResizeWallRunResult {
  const budget = toEighths(deltaIn);
  if (budget === 0) return { slots: slots.map((s) => s), collapsedOpenings: 0, shortfallEighths: 0 };

  const working = slots.map((s) => ({ ...s }));
  const standardEighths = toEighths(standardWidthIn);
  let collapsedOpenings = 0;

  /* The index of the slot nearest the dragged end that may absorb width, and
     the direction to step inward from it. Rule-placed parts at the very end
     (a corner panel, and a safety gap tucked behind it) are stepped OVER, not
     through: growth happens just inside them, so a corner stays a corner and
     the gap stays where the rule put it. */
  const atEnd = growAtEnd === "end";
  const step = atEnd ? -1 : 1;

  /**
   * Walk inward from the dragged end to the first slot that may change.
   *
   * ⚠ The starting index is recomputed on EVERY call, not captured once. The
   * shrink loop splices panels out as they reach zero, so a start index taken
   * before the first removal points past the end of a shortened array — the
   * loop's own bounds check then fails immediately, `findAbsorber` returns -1
   * and the shrink stops early. Caught by three tests at once: a 55in shrink
   * took only 40, an impossible shrink reported no shortfall, and a grow/shrink
   * round trip left the panel it had just added.
   */
  const findAbsorber = (): number => {
    for (let i = atEnd ? working.length - 1 : 0; i >= 0 && i < working.length; i += step) {
      if (!isRulePlaced(working[i]!)) return i;
    }
    return -1;
  };

  if (budget > 0) {
    let remaining = budget;
    let at = findAbsorber();
    if (at < 0) {
      /* Nothing but rule-placed parts — a wall of just corners and a gap.
         Put the whole growth in one new standard panel just inside the end,
         because refusing would leave the wall shorter than its own length. */
      const insertAt = atEnd ? working.length - 1 : 1;
      working.splice(Math.max(0, Math.min(working.length, insertAt)), 0, {
        type: "standard",
        widthIn: toInches(remaining),
      });
      return { slots: working, collapsedOpenings, shortfallEighths: 0 };
    }

    /* ⚠ Only the END-MOST panel grows, and only to `standardWidthIn`; past
       that a NEW panel enters behind it. That is Tommy's "panels that enter
       and grow with the drag" read literally, and it is also what makes the
       reverse exact: shrinking pops those same panels off in the order they
       arrived. Spreading the growth over several existing panels instead
       would be impossible to undo by dragging back. */
    const headroom = Math.max(0, standardEighths - toEighths(working[at]!.widthIn));
    const intoExisting = Math.min(remaining, headroom);
    if (intoExisting > 0) {
      working[at] = { ...working[at]!, widthIn: toInches(toEighths(working[at]!.widthIn) + intoExisting) };
      remaining -= intoExisting;
    }
    while (remaining > 0) {
      const take = Math.min(remaining, standardEighths);
      // Inserted on the dragged side of the absorber, so the newest panel is
      // always the one nearest the end — the one a drag back removes first.
      const insertAt = atEnd ? at + 1 : at;
      working.splice(insertAt, 0, { type: "standard", widthIn: toInches(take) });
      if (!atEnd) at += 1;
      if (atEnd) at += 1;
      remaining -= take;
    }
    return { slots: working, collapsedOpenings, shortfallEighths: 0 };
  }

  // ---- shrink ------------------------------------------------------------
  let remaining = -budget;
  while (remaining > 0) {
    const at = findAbsorber();
    if (at < 0) break; // nothing left that may shrink
    const slot = working[at]!;
    const have = toEighths(slot.widthIn);
    if (have <= 0) {
      // A zero-width slot left from an earlier step: drop it and continue.
      working.splice(at, 1);
      continue;
    }
    const take = Math.min(remaining, have);
    const nextEighths = have - take;
    remaining -= take;

    if (nextEighths === 0) {
      working.splice(at, 1);
      continue;
    }

    /* ⚠ The opening collapse, and it happens ON THE WAY DOWN rather than at
       the end: an opening narrower than a foot is not a window any more, it
       is a gap in the framing. Tommy: *"the RO, header, and sill all 3 get
       replaced by 1 standard panel. That continues down to zero."* So the
       slot becomes a plain standard and keeps shrinking on the next pass. */
    if (isOpening(slot) && nextEighths < toEighths(OPENING_COLLAPSE_BELOW_IN)) {
      collapsedOpenings += 1;
      working[at] = { type: "standard", widthIn: toInches(nextEighths), ...(slot.zones ? { zones: slot.zones } : {}) };
      // Zones describe the opening's own header/sill bands; a standard panel
      // has no business carrying them.
      delete (working[at] as { zones?: unknown }).zones;
      continue;
    }

    working[at] = { ...slot, widthIn: toInches(nextEighths) };
  }

  return { slots: working, collapsedOpenings, shortfallEighths: remaining };
}
