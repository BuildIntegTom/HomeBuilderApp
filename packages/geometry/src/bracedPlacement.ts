import { planLockedWidthReforce } from "./lockedWidthReforce";
import { getOpeningAnchors } from "./tiling";
import type { BracePattern, PanelSlot, PanelSlotType, PanelSlotZone } from "./types";

const ADDITIONAL_ROW_BRACE_NEAR_CORNER_COUNT = 2;

/*
 * ⚠ **BOTH AUTOMATIC BRACING RULES ARE RETIRED — B17, 2026-11-02.**
 *
 * `applyBracedPlacement` stood here. It had two rules, and nothing in the app
 * places a braced panel automatically any more:
 *
 * 1. **near-corner** — walk inward from each end of the wall, brace the first
 *    standard panel found, one per end. Originally from *"each wall must have
 *    two braced panels on it, touching each side of each corner panel"*.
 * 2. **periodic** — another brace every `seismicBracedPanelSpacingFt[zone]`
 *    along the plain run, carrying the count forward past an opening rather
 *    than dropping it. From *"use the earthquake guide to determine amount of
 *    braced panels needed per run"*.
 *
 * > *"We can retire near corner braces because the super brace pattern should
 * > inherently provide the same structural shear value."*
 *
 * > *"My answer on the periodic rule: ... we're replacing it with something
 * > better."* — both Tommy, 2026-11-02
 *
 * **What replaces them is `applyDrawTimeBracing` (B15):** the wall brace
 * pattern lays half a figure on **every** standard panel of every ground-floor
 * wall. Two panels per wall plus one every 8-to-16ft was a subset of that, so
 * the rules had stopped adding shear — and they were actively costing it,
 * because a `braced` slot is not pattern-eligible (`isBraceEligible`) and so
 * **broke the pair run it sat in**. Their deletion is what lets one figure run
 * continuously from corner to corner.
 *
 * ⚠ **The seismic zone is no longer an input to ground-floor bracing.** That
 * was the point: it is the half of [[seismic_rating_backwards]] that had to go
 * before a rating could be read OUT of a built design (B18, the derivation
 * sheet). The zone still drives `applyAdditionalRowBracedPattern` below, so
 * the control is not dead — just much narrower, and its copy says so.
 *
 * **What a `braced` slot means now:** the user put it there (the type cycle),
 * or `applyAdditionalRowBracedPattern` did on a freshly-spawned upper row, or
 * it is in a project file an older version of this app wrote. All three are
 * carried faithfully through a retile by `reconcileBracedPlacement`, which is
 * what is left of this module's zero-0 work and is now purely about CARRYING
 * decisions rather than making any.
 *
 * ⚠ **Three places reasoned FROM rule 1 and have been re-reasoned rather
 * than left pointing at a deleted walk:** `buildPlainMiddle` (tiling.ts) keeps
 * the borrowed panel off the corner-touching position, `pickFreeSlotsToDrop`
 * (panelPlacement.ts) sorts the corner-touching slots last, and
 * `seedDefaultOpenings` (retile.ts) refuses to put a default opening at either
 * end. All three KEEP their behaviour; each says there why it still does.
 */

/**
 * The one surviving automatic bracing rule, and the only reason the seismic
 * zone is still wired to anything: a freshly-appearing UPPER zone (Tommy: "when a wall is 16ft tall and then a shorter than
 * standard height additional row spawns: at least the ends +50%... need to
 * be braced") — doubled near-corner count (`ADDITIONAL_ROW_BRACE_NEAR_
 * CORNER_COUNT = 2`), and its periodic hit claims 2 consecutive eligible
 * slots ("every other pair") instead of 1.
 *
 * ⚠ **It kept both rules when zone 0 lost both of them** (B17, 2026-11-02 —
 * see the record above). Deliberate, and the reason is one sentence: the
 * wall brace pattern that replaced them is laid per SLOT and does not reach
 * zone 1 at all, so retiring these would remove bracing from a tall wall's
 * upper row and put nothing back. It is also a different instruction of
 * his, about a different thing. When the pattern learns about zones, this
 * is the next thing to retire.
 *
 * Operates on one wall's own zone-1-and-above row, not the wall's flat
 * `PanelSlot[]` — `zoneSlots[i]` is
 * slot `i`'s own zone at this level (`undefined` where that column has no
 * real zone this high, treated as an implicit "standard" placeholder,
 * same convention `effectiveZonesForSlot`'s own render-time padding
 * uses). `parentSlotTypes`/`parentWidthsIn` are the row's own top-level
 * slot data — a zone has no independent notion of its own column being a
 * corner or how wide it is (`PanelSlotZone` has no `widthIn` of its own,
 * see its own doc comment), so corner/safety-oct-corner exclusion (never
 * a brace candidate, and a periodic-spacing reset point) and the periodic
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
 * Carries each wall's own prior per-panel decisions across a retile (Tommy:
 * "softly decouple [seismic auto-population] to be an original suggestion...
 * allows the user to change each panel" — once decided, a position's type
 * stays decided), then re-forces every locked width.
 *
 * ⚠ **It no longer SEEDS anything, and took four parameters with it when it
 * stopped** (B17, 2026-11-02 — `spacingIn`, `standardWidthIn`,
 * `defaultPattern`, `defaultMirrored`, which existed only to feed the two
 * deleted rules; see the record at the top of this file). `oldSlots` is the
 * wall's slots array from BEFORE the retile that produced `newSlots` —
 * undefined for a wall with no prior state (a brand-new wall, or a project
 * file old enough to predate per-slot braced state), which now means there is
 * nothing to carry and the wall comes back as the tiler built it.
 *
 * The function is still named for braced placement because carrying a braced
 * panel's type, pattern and mirror across a retile is exactly what it does
 * — it just no longer invents one.
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
export function reconcileBracedPlacement(oldSlots: PanelSlot[] | undefined, newSlots: PanelSlot[]): PanelSlot[] {
  /* Nothing to carry. Still goes through the locked-width re-force below via
     the shared tail, because a tiler-fresh wall can carry a pin too (a drag
     that pinned a width, then a retile) and the refusal reporting reads the
     same planner. */
  if (!oldSlots) return planLockedWidthReforce(newSlots.map((s) => ({ ...s }))).slots;

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
    }
    /* No `else`. Until B17 a position with no old marker was added to an
       `eligibleIndices` set and handed to `applyBracedPlacement`, which was
       allowed to brace it; that is the seeding that was retired, so a
       genuinely new position now simply stays as the tiler built it. */
    ordinal++;
  }

  // Re-force every carried-through locked width back to its own exact value
  // (Tommy: "when you click and drag a panel... it shrinks one panel and adds
  // it to another" — a fresh tiling pass just gave this slot whatever width the
  // ordinary budget math computed, ignoring the lock entirely), paying for it
  // out of the still-unlocked standard-family slots, and REFUSING the re-force
  // outright on a run that cannot pay legally.
  //
  // ⚠ That refusal is new as of 2026-09-30 and it is Tommy’s decision, not an
  // implementation detail: a locked width the wall length cannot honour "is
  // refused outright — nothing changes... The wall’s real length is never
  // violated." Until then this loop called a `shedWidthToNearestUnlocked`
  // helper that no-opped when the run had no unlocked slot and clamped its
  // neighbour at zero, and 362 walls of one 8,004-case fixture came out off
  // their own length by up to 23⅞in. See `planLockedWidthReforce` for the whole
  // of it, including why nothing here clears the pin.
  //
  // This function’s signature is deliberately unchanged — it has 7+ call sites
  // and no business composing English. The refusals are re-derived from the
  // committed wall by `findUnhonouredLockedWidths`, which asks this same
  // planner, so the report and the behaviour cannot drift apart.
  return planLockedWidthReforce(reconciled).slots;
}

export function setWindowWidth(slots: PanelSlot[], index: number, widthIn: number): PanelSlot[] {
  return slots.map((s, i) => (i === index && s.type === "window" ? { ...s, widthIn } : s));
}
