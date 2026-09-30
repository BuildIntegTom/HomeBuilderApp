import { fromEighths, toEighths } from "./eighths";
import { getOpeningAnchors, TILER_MAX_PANEL_WIDTH_IN, TILER_MIN_PANEL_WIDTH_IN } from "./tiling";
import type { BracePattern, PanelSlot, PanelSlotType, PanelSlotZone } from "./types";

const BRACE_NEAR_CORNER_COUNT = 1;
const ADDITIONAL_ROW_BRACE_NEAR_CORNER_COUNT = 2;

/** What the corner-brace combine would do to the rest of the run to pay for
 * itself: at most one standard panel SWALLOWED (gone from the run, not
 * resized to nothing), plus new widths for however many panels the leftover
 * takes to settle. */
interface CornerBraceCombinePlan {
  /** `null` when nothing is swallowed — see plan B in
   * `planCornerBraceCombine`. */
  consumedIndex: number | null;
  /** slot index -> its new width in whole eighths. */
  resizedEighths: Map<number, number>;
}

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
 */
function settleResidualEighths(
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

/**
 * Plans the corner-brace combine, or returns `null` to refuse it outright.
 *
 * ### What the combine is, physically
 *
 * A combined slot is one braced standard panel with the 3/4in plywood
 * safety spacer glued to it (Tommy: "maintain the rules of the safety
 * panel, but have it combine with the braced panel near corners"), so it
 * stands where a safety gap AND a standard panel used to stand. The run
 * therefore loses a panel — the same shape the tiler's own ABSORB rule
 * already takes ("the run loses one panel and keeps its exact total", see
 * `computePlainSizing`). That is why plan A below SWALLOWS a panel rather
 * than shedding a full standard width onto a neighbour and hoping it fits.
 *
 * ### Two ways to pay, tried in that order
 *
 * **A — swallow the nearest standard panel whole**, and settle whatever that
 * overpays or underpays against the panels past it. The growth a real wall
 * asks for is a whole standard width (the tiler's gap is always 3/4in), and
 * no amount of shrinking can cover that legally: a panel is at most 48in and
 * may not go under 24in, so it can spare at most 24in. Swallowing is what
 * the combine physically IS, and it leaves every other panel at the width
 * the tiler chose apart from the one that settles the difference.
 *
 * **B — take it out of the run's own slack**, removing no panel. Used when
 * there is nothing to pay at all (a slot already at the combined width —
 * the old rule's zero-delta behaviour, kept exactly), when the gap is WIDER
 * than the combined slot and the surplus has to go back into the run, and as
 * the fallback for a growth small enough to come out of what the panels can
 * spare. Only a stored legacy wall reaches that last case: the tiler used to
 * size the gap slot to whatever the run had left over (2 to 4ft, see
 * `SAFETY_GAP_WIDTH_IN`'s own comment) and files from then still say so.
 *
 * ### What it guarantees — and this comment is the contract, not a hope
 *
 *   1. **The wall's total length does not move. At all.** Every quantity
 *      below is a count of 1/8in, so "the parts still sum to the wall" is an
 *      integer identity: the combined slot's width is paid for exactly by
 *      the gap's own width plus the swallowed panel's, and any leftover is
 *      handed to (or taken from) later panels until it is zero. If it
 *      cannot reach zero, there is no plan and no mutation.
 *   2. **No zero-width panel.** The swallowed panel is removed from the
 *      run. Nothing is ever resized to 0.
 *   3. **No panel pushed outside `[TILER_MIN_PANEL_WIDTH_IN,
 *      TILER_MAX_PANEL_WIDTH_IN]` by this combine.** A panel the TILER
 *      already left outside those bounds (see `computePlainSizing`'s
 *      residual cases) is not touched in the direction that would make it
 *      worse, and is never "repaired" either — that is the tiler's own
 *      reported-not-corrected business, not this function's.
 *   4. **Refusal is total.** A `null` plan means the caller changes
 *      nothing: no width moves, no slot disappears, the safety gap stays
 *      the 3/4in spacer the tiler laid out and the corner's brace lands on
 *      an ordinary standard panel further in. A visible gap beats a
 *      substituted value.
 *
 * ⚠ **The previous version of this comment promised the opposite and was
 * wrong.** It said the difference was "shed onto the nearest standard panel
 * so the wall's total length still comes out exactly right", with a clamp at
 * zero for when the neighbour was too narrow — and the clamp is exactly
 * where the length went missing. A 240in wall with two 61.5in windows came
 * out 247-3/8in long, with a 0in panel on the cut list, and the app then
 * refused to draw it because its panels did not add back up to the wall
 * (Tommy, 2026-09-29: "this app needs to be perfectly tight with dimensions
 * and wall lengths").
 *
 * ### The choices, made deliberately
 *
 * - **Swallow the nearest, settle across the rest.** The candidate order is
 *   the one the old single-neighbour search already used — outward into the
 *   run first (away from the corner), then back toward the corner — so the
 *   panel that disappears is still "the nearest standard panel available".
 *   The leftover then walks the SAME order, taking or giving whatever each
 *   panel can legally take or give, rather than forcing it all onto one.
 *   **Measured, on every eighth from 12in to 600in across standard widths
 *   {39, 40, 48}, all four corner combinations, both gap ends and six
 *   opening sets: the leftover has never needed more than ONE panel past
 *   the swallowed one** (6,047 of the 6,112 walls where the combine fires
 *   resize exactly one, the other 65 resize none). The loop is written for
 *   N anyway, because "one is always enough" is an observation about
 *   today's widths and not something any of these numbers promise.
 * - **Only plain "standard" slots take part.** A "braced" slot is a shear
 *   element the seismic rule has already placed, and the old search never
 *   touched one either; widening the candidate set would move widths on
 *   walls that are fine today.
 * - **A user-dragged (`lockedWidthIn`) slot is never swallowed or
 *   resized.** `reconcileBracedPlacement` re-forces those widths right
 *   after this runs, so any change here would be undone and re-shed
 *   somewhere else — see `shedWidthToNearestUnlocked`.
 */
function planCornerBraceCombine(
  slots: PanelSlot[],
  gapIndex: number,
  step: number,
  combinedEighths: number,
  consumedIndices: ReadonlySet<number>,
): CornerBraceCombinePlan | null {
  const candidates: number[] = [];
  const consider = (i: number) => {
    if (consumedIndices.has(i)) return;
    const slot = slots[i]!;
    if (slot.type !== "standard" || slot.lockedWidthIn !== undefined) return;
    candidates.push(i);
  };
  for (let i = gapIndex + step; i >= 0 && i < slots.length; i += step) consider(i);
  for (let i = gapIndex - step; i >= 0 && i < slots.length; i -= step) consider(i);

  const growthEighths = combinedEighths - toEighths(slots[gapIndex]!.widthIn);

  // PLAN B, taken first when there is nothing to pay. A gap slot that is
  // already the combined width costs the run nothing, so nothing is
  // swallowed and no width moves — the old rule's behaviour at zero delta,
  // kept exactly.
  if (growthEighths <= 0) {
    const resizedEighths = settleResidualEighths(slots, candidates, -growthEighths);
    return resizedEighths ? { consumedIndex: null, resizedEighths } : null;
  }

  // PLAN A: swallow the nearest standard panel whole and settle whatever
  // that overpays or underpays against the panels past it. This is the one
  // that fits the real product space, where the growth is a full standard
  // width and no amount of shrinking could cover it legally.
  const consumedIndex = candidates[0];
  if (consumedIndex !== undefined) {
    const residualEighths = toEighths(slots[consumedIndex]!.widthIn) - growthEighths;
    const resizedEighths = settleResidualEighths(slots, candidates.slice(1), residualEighths);
    if (resizedEighths) return { consumedIndex, resizedEighths };
  }

  // PLAN B for a real payment: take the growth out of the run's own slack
  // without removing a panel. Reachable only for a growth small enough to
  // come out of what the panels can spare above the 24in floor, which the
  // tiler cannot produce today (its gap is always 3/4in, so the growth is
  // always a full standard width) but a stored legacy wall can.
  const resizedEighths = settleResidualEighths(slots, candidates, -growthEighths);
  return resizedEighths ? { consumedIndex: null, resizedEighths } : null;
}

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

  /** Slots the corner-brace combine has swallowed — see
   * `planCornerBraceCombine`. They keep their index (so `eligibleIndices`,
   * which is indexed against the caller's own array, stays aligned) and are
   * dropped from the returned run at the very end. Every walk below steps
   * straight over them: they are not braceable, not shed-to-able, and
   * contribute no distance to rule 2. */
  const consumedIndices = new Set<number>();

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
  // plywood buffer instead of its usual dynamically-absorbed width, paid
  // for by swallowing the nearest standard panel whole and settling the
  // residual against the ones past it, so the wall's total length comes out
  // exactly right to the eighth or the combine does not happen at all. See
  // `planCornerBraceCombine` for what it guarantees and when it refuses.
  // This combine is NOT gated
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
      if (consumedIndices.has(i)) continue; // already swallowed by a combine — not on the wall any more
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
        const combinedEighths = toEighths(standardWidthIn + SAFETY_PLYWOOD_BUFFER_IN);
        const plan = planCornerBraceCombine(result, i, step, combinedEighths, consumedIndices);
        // REFUSED: the run cannot pay for this combine without breaking the
        // wall's length or producing an unbuildable panel. Nothing is
        // touched — the safety gap stays the 3/4in spacer the tiler laid
        // out — and the walk carries on inward to brace a plain standard
        // panel instead, which is what this rule did before the combine
        // existed. A visible gap beats a substituted width.
        if (!plan) continue;
        for (const [index, eighths] of plan.resizedEighths) result[index]!.widthIn = fromEighths(eighths);
        if (plan.consumedIndex !== null) consumedIndices.add(plan.consumedIndex);
        slot.secondaryType = "braced";
        slot.widthIn = fromEighths(combinedEighths);
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
    if (consumedIndices.has(i)) continue; // not on the wall — contributes no distance and takes no brace
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

  // Drop the swallowed panels LAST, so every index above — including the
  // caller's own `eligibleIndices` — stayed aligned with the array it was
  // computed against. A swallowed panel is not a zero-width panel: it is
  // not a part, and it does not appear on the cut list, the price sheet or
  // the elevation at all.
  return consumedIndices.size === 0 ? result : result.filter((_, i) => !consumedIndices.has(i));
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
 * itself have a `lockedWidthIn` — a search-outward-then-inward shape,
 * skipping any OTHER locked slot (shedding onto one would silently corrupt
 * a second user-dragged width the moment two locked slots happen to sit
 * near each other).
 *
 * ⚠ **THIS ONE STILL BREAKS THE WALL'S TOTAL, IN TWO WAYS, AND IT IS NOT
 * FIXED.** It is a no-op when no unlocked standard-family slot exists on the
 * run (the wall then comes out off by the whole `deltaIn`), and it clamps at
 * zero, which is the exact mistake the corner-brace combine was fixed for on
 * 2026-09-29. **Measured, not guessed:** sweeping every eighth of wall length
 * from 150in to 400in at standard widths {40, 48}, one 61.5in window, and a
 * lock of 24in or 48in on the first standard slot, **363 walls come out off
 * their own length by as much as ±12¾in** — a 150in two-corner wall whose one
 * standard panel is locked at 48in reconciles to 161¼in.
 *
 * Left alone on purpose: it is a different rule on a different path (a user's
 * own dragged width, not a derived one), the fix has to decide what happens
 * when a lock and a wall length genuinely cannot both be honoured, and that
 * is Tommy's call rather than a coder's. Written up in the spec's "Still
 * open" list on 2026-09-29 so it is a recorded item and not a comment nobody
 * reads. `planCornerBraceCombine` is the shape a fix would follow. */
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
  // standard-family neighbor — the same "fixed-width slot sheds its own delta
  // to a neighbor" shape the corner-brace combine takes, for a user-dragged
  // width instead of a combined safety-gap panel.
  //
  // ⚠ Unlike that combine, this one does NOT keep the wall's total exact: see
  // `shedWidthToNearestUnlocked`'s own comment for the 363 measured walls it
  // gets wrong and why it was left alone.
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
