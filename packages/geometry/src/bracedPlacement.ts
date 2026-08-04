import { getOpeningAnchors } from "./tiling";
import type { BracePattern, PanelSlot, PanelSlotType, PanelSlotZone } from "./types";

const BRACE_NEAR_CORNER_COUNT = 1;
const ADDITIONAL_ROW_BRACE_NEAR_CORNER_COUNT = 2;

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
 * Same 2-rule shape as `applyBracedPlacement`, but for a freshly-appearing
 * UPPER zone (Tommy: "when a wall is 16ft tall and then a shorter than
 * standard height additional row spawns: at least the ends +50%... need to
 * be braced") — doubled near-corner count (`ADDITIONAL_ROW_BRACE_NEAR_
 * CORNER_COUNT = 2` instead of 1), and Rule 2's periodic hit claims 2
 * consecutive eligible slots ("every other pair") instead of 1.
 *
 * Operates on one wall's own zone-1-and-above row, not the wall's flat
 * `PanelSlot[]` (see `applyBracedPlacement` for that) — `zoneSlots[i]` is
 * slot `i`'s own zone at this level (`undefined` where that column has no
 * real zone this high, treated as an implicit "standard" placeholder,
 * same convention `effectiveZonesForSlot`'s own render-time padding
 * uses). `parentSlotTypes`/`parentWidthsIn` are the row's own top-level
 * slot data — a zone has no independent notion of its own column being a
 * corner or how wide it is (`PanelSlotZone` has no `widthIn` of its own,
 * see its own doc comment), so corner/safety-oct-corner exclusion (never
 * a brace candidate, and a periodic-spacing reset point, exactly
 * mirroring `applyBracedPlacement`'s own corner handling) and Rule 2's
 * distance accumulation both read from the parent row instead.
 *
 * `eligibleIndices` (undefined = everything eligible) restricts which
 * "standard"-zone positions this pass may promote — the caller
 * (`reconcileWallZonesForHeightChange` in page.tsx) computes this from
 * which columns just gained a genuinely NEW zone at this level, the same
 * "don't re-decide an already-settled position" precedent
 * `reconcileBracedPlacement` follows for zone 0.
 */
export function applyAdditionalRowBracedPattern(
  zoneSlots: (PanelSlotZone | undefined)[],
  parentSlotTypes: PanelSlotType[],
  parentWidthsIn: number[],
  spacingIn: number,
  defaultPattern: BracePattern,
  defaultMirrored: boolean,
  eligibleIndices?: Set<number>,
): PanelSlotZone[] {
  const result: PanelSlotZone[] = zoneSlots.map((z) => ({ ...(z ?? { type: "standard" as const }) }));
  const isEligible = (i: number) => eligibleIndices === undefined || eligibleIndices.has(i);
  const isCornerParent = (i: number) => parentSlotTypes[i] === "corner" || parentSlotTypes[i] === "safety-oct-corner";

  const markNearestBraceable = (start: number, step: number, count: number) => {
    let marked = 0;
    for (let i = start; i >= 0 && i < result.length && marked < count; i += step) {
      if (isCornerParent(i)) continue; // no real brace candidate here at all — walk straight past
      const zone = result[i]!;
      if (zone.type === "braced") {
        marked++;
      } else if (zone.type === "standard") {
        if (!isEligible(i)) break;
        zone.type = "braced";
        zone.bracedPattern = defaultPattern;
        zone.bracedMirrored = defaultMirrored;
        marked++;
      }
    }
  };
  markNearestBraceable(0, 1, ADDITIONAL_ROW_BRACE_NEAR_CORNER_COUNT);
  markNearestBraceable(result.length - 1, -1, ADDITIONAL_ROW_BRACE_NEAR_CORNER_COUNT);

  let cumulativeIn = 0;
  for (let i = 0; i < result.length; i++) {
    if (isCornerParent(i) || result[i]!.type === "braced") {
      cumulativeIn = 0;
      continue;
    }
    cumulativeIn += parentWidthsIn[i] ?? 0;
    if (cumulativeIn < spacingIn || result[i]!.type !== "standard" || !isEligible(i)) continue;
    result[i]!.type = "braced";
    result[i]!.bracedPattern = defaultPattern;
    result[i]!.bracedMirrored = defaultMirrored;
    cumulativeIn -= spacingIn;
    // Claim one more consecutive eligible slot as this same brace event's
    // own pair-mate ("every other pair") — walks past an opening/locked-
    // standard slot without giving up (same "doesn't reset the shear
    // requirement" precedent Rule 2's own reset condition above follows),
    // stopping at the next corner or at an already-braced slot (which
    // already counts as a real brace, satisfying the pair on its own).
    for (let j = i + 1; j < result.length && !isCornerParent(j); j++) {
      if (result[j]!.type === "braced") break;
      if (result[j]!.type === "standard" && isEligible(j)) {
        result[j]!.type = "braced";
        result[j]!.bracedPattern = defaultPattern;
        result[j]!.bracedMirrored = defaultMirrored;
        break;
      }
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
 *
 * Also carries each matched slot's own `zones` through (a beam/max-height
 * split column's own independently-typed bands — see PanelSlot.zones's own
 * doc comment) — a fresh tiling/retile pass otherwise always builds a bare
 * `{type, widthIn}` slot with no `zones` field at all, which would
 * silently wipe a split column's upper-band data on every wall-length-edit/
 * bump-out-driven retile.
 *
 * Ordinal-matching alone isn't quite enough, though: `newSlots` can have a
 * *different number* of standard-family slots than `oldSlots` did, because
 * a retile can turn a former standard/braced slot into a window/door/column
 * (or vice versa) at some position in the *middle* of the wall, not just at
 * the ends. Naively pairing `newMarkers[i]` with `oldMarkers[i]` by raw
 * index doesn't account for that: every old marker *after* the converted
 * position silently shifts one slot out of alignment against the new (now
 * shorter-or-longer) family, and — if the family shrank — the trailing
 * marker(s) fall off the end of `oldMarkers` and are simply never applied
 * (this is what used to make a wall's *other*, untouched braced panel
 * silently revert to "standard" after toggling a single unrelated panel
 * into a window elsewhere on the same wall).
 *
 * The fix: track how many old standard-family entries a *newly-created*
 * opening has consumed (`droppedOldMarkers`) and fold that into the index
 * used to read `oldMarkers`, so later positions still line up correctly
 * instead of shifting. An opening in `newSlots` only consumes an old marker
 * when it's genuinely new at that position — `oldOpeningCountAtOrdinal`
 * (built from `getOpeningAnchors(oldSlots)`, using that same standard-
 * family ordinal convention) tells the walk when an opening already
 * existed there in `oldSlots` too, in which case it was never part of the
 * standard family to begin with and nothing needs dropping.
 */
/** Shifts `deltaIn` onto the nearest "standard"/"braced" slot that does NOT
 * itself have a `lockedWidthIn` — same search-outward-then-inward shape
 * `applyBracedPlacement`'s own `shedWidthToNearestStandard` already uses,
 * just also skipping any OTHER locked slot (shedding onto one would
 * silently corrupt a second user-dragged width the moment two locked
 * slots happen to sit near each other). No-op (wall's total length ends up
 * off by `deltaIn`) if every standard-family slot on the run is locked —
 * same rare, not-silently-hidden edge case `shedWidthToNearestStandard`
 * itself already accepts. */
function shedWidthToNearestUnlocked(slots: PanelSlot[], fromIndex: number, deltaIn: number) {
  const isUnlockedStandardFamily = (s: PanelSlot) => (s.type === "standard" || s.type === "braced") && s.lockedWidthIn === undefined;
  for (let i = fromIndex + 1; i < slots.length; i++) {
    if (isUnlockedStandardFamily(slots[i]!)) {
      slots[i]!.widthIn = Math.max(0, slots[i]!.widthIn + deltaIn);
      return;
    }
  }
  for (let i = fromIndex - 1; i >= 0; i--) {
    if (isUnlockedStandardFamily(slots[i]!)) {
      slots[i]!.widthIn = Math.max(0, slots[i]!.widthIn + deltaIn);
      return;
    }
  }
}

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

  const oldMarkers: {
    type: "standard" | "braced";
    bracedPattern?: BracePattern;
    bracedMirrored?: boolean;
    zones?: PanelSlotZone[];
    lockedWidthIn?: number;
  }[] = [];
  for (const slot of oldSlots) {
    if (slot.type === "standard") {
      oldMarkers.push({ type: "standard", zones: slot.zones, lockedWidthIn: slot.lockedWidthIn });
    } else if (slot.type === "braced") {
      oldMarkers.push({
        type: "braced",
        bracedPattern: slot.bracedPattern,
        bracedMirrored: slot.bracedMirrored,
        zones: slot.zones,
        lockedWidthIn: slot.lockedWidthIn,
      });
    }
  }

  // Old openings, keyed by their own standard-family ordinal (same
  // convention `oldMarkers`' own index already uses) — lets the walk below
  // tell an opening that already sat at this exact position in `oldSlots`
  // (nothing to reconcile: it was never a standard-family member) apart
  // from a brand-new one that just replaced a former standard/braced slot
  // (that old marker must be dropped outright, not silently shifted onto
  // whichever standard-family slot comes next).
  const oldOpeningCountAtOrdinal = new Map<number, number>();
  for (const anchor of getOpeningAnchors(oldSlots)) {
    oldOpeningCountAtOrdinal.set(anchor.beforeStandardCount, (oldOpeningCountAtOrdinal.get(anchor.beforeStandardCount) ?? 0) + 1);
  }

  const reconciled = newSlots.map((s) => ({ ...s }));
  const eligibleIndices = new Set<number>();
  let ordinal = 0; // new-side standard-family ordinal (count of "standard" slots seen so far in `reconciled`)
  let droppedOldMarkers = 0; // old standard-family entries consumed by newly-created openings, not yet reflected in `ordinal`
  for (let i = 0; i < reconciled.length; i++) {
    const slot = reconciled[i]!;
    if (slot.type === "window" || slot.type === "door" || slot.type === "column") {
      const oldOrdinal = ordinal + droppedOldMarkers;
      const remaining = oldOpeningCountAtOrdinal.get(oldOrdinal) ?? 0;
      if (remaining > 0) {
        // Already an opening at this exact position in oldSlots — never a
        // standard-family member, so nothing to drop.
        oldOpeningCountAtOrdinal.set(oldOrdinal, remaining - 1);
      } else {
        // A brand-new opening here — it replaced whatever standard-family
        // slot used to occupy this position; drop that marker instead of
        // letting every later marker shift onto it.
        droppedOldMarkers++;
      }
      continue;
    }
    // A fresh tiling/retile pass never itself produces a "braced" slot
    // (see tiling.ts) — only "standard" slots are candidates here.
    if (slot.type !== "standard") continue;
    const marker = oldMarkers[ordinal + droppedOldMarkers];
    if (marker) {
      slot.type = marker.type;
      if (marker.type === "braced") {
        slot.bracedPattern = marker.bracedPattern;
        slot.bracedMirrored = marker.bracedMirrored;
      }
      slot.zones = marker.zones;
      slot.lockedWidthIn = marker.lockedWidthIn;
    } else {
      eligibleIndices.add(i);
    }
    ordinal++;
  }

  const result = applyBracedPlacement(reconciled, spacingIn, standardWidthIn, defaultPattern, defaultMirrored, eligibleIndices);

  // Re-force every carried-through locked width back to its own exact
  // value (Tommy: "when you click and drag a panel... it shrinks one panel
  // and adds it to another" — a fresh tiling pass just gave this slot
  // whatever width the ordinary budget math computed, ignoring the lock
  // entirely) and shed the resulting delta onto the nearest still-unlocked
  // standard-family neighbor, so the wall's total length still adds up
  // exactly — same "fixed-width slot sheds its own delta to a neighbor"
  // shape `applyBracedPlacement`'s own corner-brace-combining rule already
  // uses, just for a user-dragged width instead of a combined safety-gap
  // panel.
  for (let i = 0; i < result.length; i++) {
    const slot = result[i]!;
    if (slot.lockedWidthIn === undefined) continue;
    const deltaIn = slot.widthIn - slot.lockedWidthIn;
    if (Math.abs(deltaIn) < 1e-9) continue;
    slot.widthIn = slot.lockedWidthIn;
    shedWidthToNearestUnlocked(result, i, deltaIn);
  }

  return result;
}

export function setWindowWidth(slots: PanelSlot[], index: number, widthIn: number): PanelSlot[] {
  return slots.map((s, i) => (i === index && s.type === "window" ? { ...s, widthIn } : s));
}
