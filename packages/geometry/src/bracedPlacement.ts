import type { BracePattern, PanelSlot } from "./types";

const BRACE_NEAR_CORNER_COUNT = 1;

/** Tommy: safety panels are the standard width plus a 3/4in plywood
 * buffer glued on to guard against install mistakes — see
 * `markSafetyCorner`/the Shop Drawing page for the same constant. */
export const SAFETY_PLYWOOD_BUFFER_IN = 0.75;

/**
 * Two rules, applied in order — the corner-touching brace is a fixed
 * point; periodic spacing fills the plain run and resets at every
 * non-standard slot (corner, gap, window, door, or a slot already braced by
 * the first rule). Windows are no longer auto-flanked (Tommy).
 *
 * Every "standard" slot is a candidate by default; `eligibleIndices`
 * (undefined = everything eligible — a brand-new wall, or a legacy project
 * file's one-time migration seed) restricts which ones this pass is
 * actually allowed to promote — see `reconcileBracedPlacement`, which is
 * what callers should normally use instead of calling this directly, since
 * it computes `eligibleIndices` from a wall's own prior state (Tommy:
 * "softly decouple [seismic auto-population] to be an original suggestion
 * for autopopulating panels, but then allows the user to change each
 * panel" — once a position has been decided, one way or the other, this
 * function won't re-decide it again).
 */
export function applyBracedPlacement(
  slots: PanelSlot[],
  spacingIn: number,
  standardWidthIn: number,
  defaultPattern: BracePattern,
  defaultMirrored: boolean,
  eligibleIndices?: Set<number>,
): PanelSlot[] {
  const result = slots.map((s) => ({ ...s }));
  const isEligible = (i: number) => eligibleIndices === undefined || eligibleIndices.has(i);

  /** Nearest standard-type slot to `fromIndex`, searched first in `step`'s
   * direction (continuing further into the wall run, away from the
   * corner) and, failing that, back toward the corner — Tommy: "shed the
   * absorption to the nearest standard panel available" when a safety
   * panel gets fixed-width'd to combine with a corner brace. Clamped at 0
   * (never negative) — on a short wall the gap panel can end up directly
   * corner-adjacent with only one small resized standard panel absorbing
   * the wall's whole leftover budget (see tiling.ts's `computePlainSizing`,
   * which always keeps the gap itself at a fixed 3/4in and pushes any
   * slack into that neighbor instead); shedding this combine's full
   * `standardWidthIn` swing to it could otherwise go negative, which would
   * render as a visually inverted/broken panel. When there isn't enough to
   * shed without going negative, it sheds as much as there is — same
   * documented "wall's total length is off by a little" tradeoff as the
   * "no standard panel at all" case below, just partial instead of total. */
  const shedWidthToNearestStandard = (fromIndex: number, step: number, deltaIn: number) => {
    for (let i = fromIndex + step; i >= 0 && i < result.length; i += step) {
      if (result[i]!.type === "standard") {
        result[i]!.widthIn = Math.max(0, result[i]!.widthIn + deltaIn);
        return;
      }
    }
    for (let i = fromIndex - step; i >= 0 && i < result.length; i -= step) {
      if (result[i]!.type === "standard") {
        result[i]!.widthIn = Math.max(0, result[i]!.widthIn + deltaIn);
        return;
      }
    }
    // No standard panel anywhere on this run to shed to — the combined
    // panel keeps its fixed width; the wall's total length will be off by
    // deltaIn. A rare edge case (a run with no plain standard panels at
    // all), not silently hidden.
  };

  // Rule 1: 1 braced panel touching each corner (Tommy: "each wall must have
  // two braced panels on it, touching each side of each corner panel" — one
  // per end, walking inward past any gap panel). This makes the variable-
  // sized safety/gap panel the second-to-last panel on each run, since
  // tileWall already reserves the corner-adjacent slot for this brace.
  //
  // A safety-gap slot is also eligible: rather than skip past it to find a
  // separate standard panel to brace, it becomes a combined panel (Tommy:
  // "maintain the rules of the safety panel, but have it combine with the
  // braced panel near corners") — fixed-width at standardWidthIn + the
  // plywood buffer instead of its usual dynamically-absorbed width, with
  // the difference shed onto the nearest standard panel so the wall's
  // total length still comes out exactly right. This combine is NOT gated
  // by `eligibleIndices` — a combined safety-gap+brace slot has no
  // per-panel style of its own (see `PanelSlot.bracedPattern`'s own doc
  // comment) and isn't reachable from the click-cycle, so it's always
  // freely re-derived, same as before this function gained per-position
  // stickiness for genuine "braced"-typed slots.
  //
  // A slot that's already braced (or already a combined safety-gap+brace)
  // satisfies the requirement without being touched — this is what makes a
  // *preserved* corner brace (see `reconcileBracedPlacement`) register as
  // "already handled" instead of the walk searching further inward for a
  // second one. A LOCKED "standard" slot (ineligible — the user explicitly
  // chose to keep it plain) stops the walk entirely rather than reaching
  // past it for an eligible slot further in: Tommy's own choice at that
  // specific position wins, even if that means this corner ends up with no
  // brace suggestion at all.
  const markNearestBraceable = (start: number, step: number, count: number) => {
    let marked = 0;
    for (let i = start; i >= 0 && i < result.length && marked < count; i += step) {
      const slot = result[i]!;
      if (slot.type === "braced" || slot.secondaryType === "braced") {
        marked++;
      } else if (slot.type === "standard") {
        if (!isEligible(i)) break;
        slot.type = "braced";
        slot.bracedPattern = defaultPattern;
        slot.bracedMirrored = defaultMirrored;
        marked++;
      } else if (slot.type === "safety-gap" && slot.secondaryType === undefined) {
        const fixedWidthIn = standardWidthIn + SAFETY_PLYWOOD_BUFFER_IN;
        shedWidthToNearestStandard(i, step, slot.widthIn - fixedWidthIn);
        slot.secondaryType = "braced";
        slot.widthIn = fixedWidthIn;
        marked++;
      }
    }
  };
  markNearestBraceable(0, 1, BRACE_NEAR_CORNER_COUNT);
  markNearestBraceable(result.length - 1, -1, BRACE_NEAR_CORNER_COUNT);

  // Rule 2: periodic braced panel every `spacingIn` along the wall (Tommy:
  // "use the earthquake guide to determine amount of braced panels needed
  // per run"). Corner and already-braced slots are genuine reset points —
  // rule 1 already placed a brace there (a combined safety+braced slot
  // counts too — it's a real brace, not just a safety panel). But a plain
  // window/door/safety-gap slot — or a LOCKED "standard" slot ineligible
  // for promotion — must NOT reset the count: the wall's shear requirement
  // doesn't go away just because the panel that would've been braced
  // turned out to be an opening (or the user's own explicit choice). So
  // distance keeps accumulating through those, and once an ELIGIBLE
  // standard slot is reached with enough accumulated distance, it (and if
  // the shortfall was large enough, the standard slot(s) after it too)
  // picks up the brace(s) that would otherwise have been dropped (Tommy:
  // "another standard panel becomes a braced panel on that same wall").
  let cumulativeIn = 0;
  for (let i = 0; i < result.length; i++) {
    const slot = result[i]!;
    if (slot.type === "corner" || slot.type === "braced" || slot.secondaryType === "braced") {
      cumulativeIn = 0;
      continue;
    }
    cumulativeIn += slot.widthIn;
    if (cumulativeIn >= spacingIn && slot.type === "standard" && isEligible(i)) {
      slot.type = "braced";
      slot.bracedPattern = defaultPattern;
      slot.bracedMirrored = defaultMirrored;
      cumulativeIn -= spacingIn; // carry any excess forward instead of discarding it
    }
  }

  return result;
}

/**
 * Preserves each wall's own prior braced-panel decisions across a retile,
 * seeding only genuinely new standard-slot positions via the seismic rule
 * (Tommy: "softly decouple [seismic auto-population] to be an original
 * suggestion... allows the user to change each panel" — once decided, a
 * position's type stays decided). `oldSlots` is the wall's slots array
 * from BEFORE the retile that produced `newSlots` — undefined for a wall
 * with no prior state (a brand-new wall, or a legacy project file's
 * one-time migration seed — see `applyBracedPlacement`'s own doc comment),
 * which just runs the seismic rule freely over everything, same as before
 * this function existed.
 *
 * Matches positions by ordinal among "standard"|"braced" slots only (the
 * same convention `getOpeningAnchors`'s `beforeStandardCount` uses for
 * window/door/column) — a "standard" position is just as sticky as a
 * "braced" one, so a user reverting a panel back to plain standard stays
 * reverted through future retiles, not just braced choices.
 */
export function reconcileBracedPlacement(
  oldSlots: PanelSlot[] | undefined,
  newSlots: PanelSlot[],
  spacingIn: number,
  standardWidthIn: number,
  defaultPattern: BracePattern,
  defaultMirrored: boolean,
): PanelSlot[] {
  if (!oldSlots) {
    return applyBracedPlacement(newSlots, spacingIn, standardWidthIn, defaultPattern, defaultMirrored);
  }

  const oldMarkers: { type: "standard" | "braced"; bracedPattern?: BracePattern; bracedMirrored?: boolean }[] = [];
  for (const slot of oldSlots) {
    if (slot.type === "standard") {
      oldMarkers.push({ type: "standard" });
    } else if (slot.type === "braced") {
      oldMarkers.push({ type: "braced", bracedPattern: slot.bracedPattern, bracedMirrored: slot.bracedMirrored });
    }
  }

  const reconciled = newSlots.map((s) => ({ ...s }));
  const eligibleIndices = new Set<number>();
  let ordinal = 0;
  for (let i = 0; i < reconciled.length; i++) {
    const slot = reconciled[i]!;
    // A fresh tiling/retile pass never itself produces a "braced" slot
    // (see tiling.ts) — only "standard" slots are candidates here.
    if (slot.type !== "standard") continue;
    const marker = oldMarkers[ordinal];
    if (marker) {
      slot.type = marker.type;
      if (marker.type === "braced") {
        slot.bracedPattern = marker.bracedPattern;
        slot.bracedMirrored = marker.bracedMirrored;
      }
    } else {
      eligibleIndices.add(i);
    }
    ordinal++;
  }

  return applyBracedPlacement(reconciled, spacingIn, standardWidthIn, defaultPattern, defaultMirrored, eligibleIndices);
}

export function setWindowWidth(slots: PanelSlot[], index: number, widthIn: number): PanelSlot[] {
  return slots.map((s, i) => (i === index && s.type === "window" ? { ...s, widthIn } : s));
}
