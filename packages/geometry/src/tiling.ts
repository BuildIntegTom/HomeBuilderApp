import { distributeEighths, fromEighths, roundToEighthIn, toEighths } from "./eighths";
import type { BracePattern, PanelSlot, PanelSlotType, PanelSlotZone, WallEnd } from "./types";

export interface TileWallResult {
  slots: PanelSlot[];
}

// The safety/gap panel is always this fixed width (Tommy: "a safety gap
// should be a 3/4in wide piece of plywood... I want the 3/4in wide safety
// gap plywood spacers to be flush with both adjacent panels" — not a
// leftover-sized bay with the actual 3/4in board floating somewhere inside
// it, unaccounted space on both sides). Must match panel-catalog's
// SAFETY_GAP_THICKNESS_IN (packages/panel-catalog/src/safetyGapMembers.ts)
// — duplicated here rather than imported since packages/geometry doesn't
// depend on packages/panel-catalog.
const SAFETY_GAP_WIDTH_IN = 0.75;

/**
 * The narrowest panel Building Integrity's shop can build, left to right in
 * elevation — the floor the ABSORB rule below is written against.
 *
 * Must match panel-catalog's `fabricationMinPanelWidthIn` (24in, confirmed,
 * Tommy 2026-09-24). Duplicated here rather than imported for exactly the
 * reason `SAFETY_GAP_WIDTH_IN` above is: packages/geometry deliberately has
 * no dependency on packages/panel-catalog. The duplication is not left to a
 * comment — `apps/web/app/tilerFabricationLimits.test.ts` is the one place
 * that imports both packages, and it asserts these two pairs agree.
 */
export const TILER_MIN_PANEL_WIDTH_IN = 24;

/**
 * The widest panel the catalog allows. Must match `panelWidthInRange.maxIn`
 * (48in, confirmed), same duplication note as above.
 *
 * **These two numbers are coupled, and the coupling is load-bearing.** The
 * absorb rule is total — i.e. every wall length has a legal tiling and none
 * is ever refused — ONLY because this ceiling is exactly twice that floor.
 * See `computePlainSizing`. `data.test.ts` asserts `maxIn >= 2 x minIn`
 * directly so a future change to either number fails loudly rather than
 * quietly producing a wall that cannot be built.
 */
export const TILER_MAX_PANEL_WIDTH_IN = 48;

// Tommy: a safety/gap panel is only needed on walls longer than 12ft — a
// shorter run doesn't accumulate enough dimensional tolerance to matter.
const SAFETY_PANEL_MIN_WALL_LENGTH_IN = 144;

/**
 * The no-gap-panel path for walls at or under 12ft: however many standard
 * panels roughly fit, evenly resized to exactly fill the budget — no
 * dedicated safety-gap slot, no borrowed/resized outlier panel. Uses
 * `Math.ceil`, not `Math.round` (Tommy: "the default auto spawn should be
 * capped at the standard width") — rounding DOWN can still leave
 * `widthEachIn` past `standardWidthIn` (e.g. a 50in budget at a 40in
 * standard rounds to 1 panel, not 2); ceiling guarantees an extra panel
 * gets added instead of ever exceeding the standard width.
 *
 * **ABSORB (2026-09-24) — the ceiling is no longer the only constraint.**
 * `Math.ceil` alone routinely produced panels the shop cannot build: a 40⅛in
 * budget at a 40in standard gives 2 panels of ~20in each. The count is now
 * also floored so that no part lands under `TILER_MIN_PANEL_WIDTH_IN`, which
 * is one panel FEWER and one panel WIDER — Tommy's choice over reporting it,
 * over widening the safety gap, and over refusing the wall length.
 *
 * `distributeEighths` makes the smallest part exactly `floor(b / n)` eighths,
 * so "every part clears the floor" is precisely `n <= floor(b / F)`. Dropping
 * to that count cannot breach the 48in ceiling either: at `n` the budget is
 * under `(n + 1) x F`, so the widest part is under `F + F/n <= 2F = 48in`.
 *
 * `Math.max(1, …)` is untouched: a budget under 24in has nothing to absorb
 * INTO, so reaching this function with one still yields a single sub-minimum
 * panel, reported in the Review Log rather than corrected here.
 *
 * **What no longer reaches it (2026-09-25):** a wall owning corners at BOTH
 * ends can no longer hand this function a sub-24in budget at all — the
 * corner pair absorbs it first, which is the corner-geometry fix Tommy chose
 * for the 51in-75in band. See `resolveCorners`. Still reachable, and still
 * deliberately unfixed: a wall owning ONE corner and between 25.5in and
 * 49.5in long (nothing to pair the single corner with), and openings eating
 * all but a sliver of a long wall's middle.
 */
function buildEvenMiddle(budgetLengthIn: number, standardWidthIn: number): PanelSlot[] {
  // The standard width is a CAP, so this is the most panels the run may have.
  const cappedCount = Math.ceil(budgetLengthIn / standardWidthIn);
  // …and this is the most it may have without any of them being unbuildable.
  const buildableCount = Math.floor(toEighths(budgetLengthIn) / toEighths(TILER_MIN_PANEL_WIDTH_IN));
  const count = Math.max(1, Math.min(cappedCount, buildableCount));
  // "Evenly" now means "as evenly as the 1/8in grid allows": siblings can
  // differ by one eighth so that every width IS a whole eighth and the run
  // still sums to the budget exactly (see `distributeEighths`). Zero-eighth
  // parts are dropped for the same reason `buildMiddle` guards a zero
  // budget — a zero-width slot renders invisibly but still counts as a real
  // panel instance and price line.
  return distributeEighths(toEighths(budgetLengthIn), count)
    .filter((eighths) => eighths > 0)
    .map((eighths) => ({ type: "standard" as const, widthIn: fromEighths(eighths) }));
}

/**
 * How many sill panels a window's rough-opening run needs, and how wide
 * each one is (Tommy: "sills are short standard panels... if the window
 * spacing or header length exceeds the standard panel width, then create
 * another sill to share the run") — the exact same even-split math as
 * `buildEvenMiddle` (a wall run under the safety-gap threshold), just
 * returning plain widths instead of PanelSlot[]: a sill isn't part of a
 * wall's own tiled slots array, it's derived per window opening. Uses
 * `Math.ceil` for the same reason `buildEvenMiddle` does — a sill is
 * fabricated as a real (short) Standard Panel, so it shouldn't exceed
 * `standardWidthIn` either.
 */
export function computeSillRunWidths(roWidthIn: number, standardWidthIn: number): number[] {
  if (roWidthIn <= 0) return [];
  // Snapped for the same reason buildMiddle snaps it: an off-grid cap of
  // 40.3in would let this emit a 40.375in sill, i.e. a panel wider than the
  // cap. See gridStandardWidthIn.
  const count = Math.max(1, Math.ceil(roWidthIn / gridStandardWidthIn(standardWidthIn)));
  return distributeEighths(toEighths(roWidthIn), count)
    .filter((eighths) => eighths > 0)
    .map(fromEighths);
}

/**
 * The project's standard-panel width, snapped onto the 1/8in grid before
 * anything is built from it.
 *
 * This is a user-typed project setting, not a catalog constant — it can and
 * does arrive off-grid. Without this snap the invariant was CONDITIONAL on
 * the caller: `computePlainSizing` quantized the width for its own
 * arithmetic, but `buildPlainMiddle` emitted the raw value verbatim for every
 * full-width panel, so `tileWall(360, 40.3, ...)` produced five 40.3in panels
 * and overran a 360in wall by 0.3in. (It survived the sweep twice over: every
 * swept width was already on-grid, and `Math.round(40.3 * 8)` happens to make
 * the eighths-sum come out exactly right, so only the whole-eighth predicate
 * would ever have fired.)
 *
 * **Floor, not round-half-up** — deliberately the one place in this pass that
 * does not use `roundToEighthIn`. `standardWidthIn` is a CAP (Tommy: "the
 * default auto spawn should be capped at the standard width"), and rounding a
 * cap upward would hand the shop panels wider than the cap that was asked for
 * — a typed 16.7 would become 16.75. Flooring can only ever be conservative.
 * Once typed entry snaps on commit (Stage 0/2) the value arriving here is
 * already on-grid and floor and round agree, so this only bites on exactly the
 * un-snapped input it exists to defend against.
 */
function gridStandardWidthIn(standardWidthIn: number): number {
  return fromEighths(Math.max(1, Math.floor(standardWidthIn * 8)));
}

interface PlainSizing {
  standardCount: number;
  gapWidthIn: number;
  /** 2 entries, each at most `standardWidthIn`, when a remainder is SPLIT.
   * 1 entry in all three of the other cases: an exact fit, fewer than 1 full
   * standard panel, or a remainder that was ABSORBED — and only in that last
   * case is the single entry WIDER than `standardWidthIn` (still strictly
   * under 48in; see the doc comment below). */
  resizedWidthsIn: number[];
}

/**
 * Core arithmetic shared by `tileWall` and `retileWithOpenings`: given a
 * budget length (already excluding corners and any opening reservations),
 * how many standard panels fit and how wide the one or two next to the gap
 * end up being. See `tileWall`'s doc comment for the sizing rules.
 *
 * The gap panel itself is always exactly `SAFETY_GAP_WIDTH_IN` — everything
 * else in the budget goes to standard panels. Whatever's left over past a
 * whole number of standard widths no longer grows a single panel past
 * `standardWidthIn` (Tommy: "I want to have a panel break down into an
 * additional panel if the length is going to exceed standard panel width...
 * this is not something I really want to build into the shop") — instead
 * the panel that would have absorbed it splits into 2 EVEN panels sharing
 * that same budget (`standardWidthIn + remainderIn`), so the tiled total
 * still adds up exactly and the gap still sits flush against both
 * neighbors, but neither new panel is ever oversized: since `remainderIn`
 * is always less than `standardWidthIn` by construction (it's what's left
 * after floor division), `(standardWidthIn + remainderIn) / 2` is always
 * itself less than `standardWidthIn`. Every OTHER standard panel in the run
 * (including the corner-touching one) is untouched by this — same as
 * before. (Previously the *gap itself* absorbed the leftover — sizing its
 * own slot to whatever remained, 2 to 4ft typically — while the
 * panel-catalog's actual 3D member for it is only 3/4in wide, leaving a
 * wide unrendered gap around the real board; see `SAFETY_GAP_WIDTH_IN`'s
 * comment.)
 *
 * ### The leftover: SPLIT or ABSORB — decided 2026-09-24
 *
 * The paragraph above describes the rule as it stood until 2026-09-24, and
 * it was only half right. Splitting `standardWidthIn + remainderIn` two ways
 * does keep both parts under the standard width — but it says nothing about
 * a FLOOR, and at the 40in standard each half lands between 20in and 40in.
 * So the tiler routinely emitted panels under Building Integrity's own 24in
 * fabrication minimum: a cut list containing a panel the shop cannot make.
 *
 * **Tommy's decision: ABSORB.** Where the two-way split would put either
 * part under the floor, do not split — emit a SINGLE panel of
 * `standardWidthIn + remainderIn` instead. The run loses one panel and keeps
 * its exact total. Chosen over reporting it and changing nothing, over
 * widening the safety gap, and over refusing the wall length.
 *
 * **Why absorbing can never breach the 48in ceiling — and why that is a
 * coincidence of two numbers rather than a property of this algorithm.**
 * Writing `S` for the standard width, `r` for the remainder, `F` for the
 * 24in floor and `C` for the 48in ceiling:
 *
 *   - the SPLIT is legal iff its smaller part clears the floor:
 *     `floor((S + r) / 2) >= F`  ⟺  `S + r >= 2F = 48in`
 *   - the ABSORB is legal iff the single panel clears the ceiling:
 *     `S + r <= C = 48in`
 *
 * The two conditions are exactly complementary: every value of `S + r`
 * satisfies at least one, they overlap only at `S + r = 48in` precisely, and
 * therefore **every wall has a legal tiling**. At the 40in default, absorb
 * fires only when `r < 8in`, and the absorbed panel is `40in + r < 48in`;
 * when `r >= 8in` the split already clears 24in and nothing changes.
 *
 * **⚠ THE MARGIN IS ZERO. The policy is total only because `C` is exactly
 * `2F`.** Raise the floor to 25in, or lower the ceiling to 46in, and a band
 * of `S + r` becomes untileable with no legal answer at all — and the
 * failure is silent, because it produces a plausible-looking cut list rather
 * than an error. Tommy explicitly rejected "refuse the wall length", so
 * there is no fallback refusal to hide behind; that is survivable ONLY
 * because of the arithmetic above. `data.test.ts` asserts
 * `panelWidthInRange.maxIn >= 2 x fabricationMinPanelWidthIn` directly for
 * exactly this reason. Any future change to either number must re-check it.
 *
 * **The residual cases absorb does not reach**, each with nothing to
 * absorb into, all Review-Log-only by decision:
 *   1. ~~a middle budget under 24in on a wall owning two corners and between
 *      51in and 75in long~~ — **FIXED 2026-09-25 by corner absorb**, the
 *      corner-geometry route Tommy chose. The corner pair absorbs that
 *      middle before this function ever sees it; see `resolveCorners`. The
 *      ONE-corner version of the same shape (a wall owning a single corner
 *      and between 25.5in and 49.5in long) is NOT fixed — a lone corner has
 *      no partner to share the wall with, and inventing a rule for it was
 *      not asked for. It is reported, not corrected.
 *   2. `rawStandardCount === 0` — openings eating all but a sliver of a long
 *      wall's middle. The sliver's neighbours are openings and corners.
 *   3. `resolveCorners` clamping a single corner onto a wall shorter than
 *      25.5in. A degenerate wall.
 *
 * **The split is uneven by one eighth when the budget is an odd number of
 * eighths, and that is the whole point of the 1/8in grid.** The old
 * `(standardWidthIn + remainderIn) / 2` landed on a SIXTEENTH whenever
 * `standardWidthIn + remainderIn` was an odd count of eighths — 47.125in
 * (377 eighths) halved to 23.5625in twice, which displayed at nearest-1/8
 * reads 23-5/8 + 23-5/8 = 47-1/4 against a 47-1/8 budget. Now the pair is
 * 189 + 188 eighths (23-5/8 + 23-1/2), both whole eighths, summing to the
 * budget exactly. Which of the two absorbs the extra eighth is
 * `distributeEighths`' deliberately arbitrary but FIXED lowest-index rule
 * — see its own doc comment; nobody has decided that the wider panel
 * belongs on a particular side.
 *
 * `allowBorrow` no longer changes this function's math — every wall now
 * gets the same fixed-width gap regardless of shape — but the parameter is
 * kept so `tileWall`/`retileWithOpenings` callers (mitered vs. non-mitered
 * shapes) don't need to change their call sites.
 */
function computePlainSizing(
  budgetLengthIn: number,
  standardWidthIn: number,
  allowBorrow = true,
): PlainSizing {
  void allowBorrow; // kept for call-site compatibility — see doc comment above
  // Integer eighths from here down: every quantity below is a COUNT of
  // 1/8in, never a decimal inch, so "the parts sum to the budget" is an
  // integer identity rather than a float hope.
  const budgetEighths = Math.max(0, toEighths(budgetLengthIn));
  const standardEighths = Math.max(1, toEighths(standardWidthIn));
  // The shop's own floor, in eighths — see the absorb branch below.
  const minEighths = toEighths(TILER_MIN_PANEL_WIDTH_IN);
  // The gap is always exactly SAFETY_GAP_WIDTH_IN — except on a budget too
  // small to hold even that, where it clamps to whatever there is. That
  // case is only reachable through `retileWithOpenings` (openings eating
  // all but a sliver of a >12ft wall's middle), and it used to overflow the
  // wall by up to 3/4in; clamping is what keeps the sum exact there. It
  // does NOT change SAFETY_GAP_WIDTH_IN, which is untouched at 0.75.
  //
  // KNOWN, DELIBERATE INCONSISTENCY in that degenerate case, written down
  // rather than left to be discovered: `buildSafetyGapMembers` still emits a
  // full 0.75in plywood board into the clamped slot, so the model briefly
  // asserts a safety gap narrower than the board it stands for, against the
  // spec's confirmed "standard panel width minus 3/4in" detail. Chosen over
  // dropping the slot entirely, which would turn the sliver into a phantom
  // sub-inch standard panel — a real (priced, fabricated) panel instance,
  // which is worse than a too-narrow gap. BOM and fabrication output are
  // unaffected: the gap's BOM width is zeroed and its members key off
  // SAFETY_GAP_THICKNESS_IN, not off this slot's width.
  const gapEighths = Math.min(toEighths(SAFETY_GAP_WIDTH_IN), budgetEighths);
  const availableEighths = budgetEighths - gapEighths;
  const rawStandardCount = Math.floor(availableEighths / standardEighths);
  const remainderEighths = availableEighths - rawStandardCount * standardEighths;

  let standardCount = rawStandardCount;
  let resizedEighths: number[];

  if (rawStandardCount === 0) {
    // Not even one full standard panel fits alongside the gap — the whole
    // leftover becomes a single resized standard panel (0 if there's
    // none). Already under standardWidthIn by construction — not part of
    // the "shop doesn't want an oversized panel" problem, left untouched.
    standardCount = availableEighths > 0 ? 1 : 0;
    resizedEighths = [availableEighths];
  } else if (remainderEighths > 0) {
    // ABSORB OR SPLIT — see the doc comment's "the leftover" section.
    const leftoverEighths = standardEighths + remainderEighths;
    if (leftoverEighths >= 2 * minEighths) {
      // SPLIT. Legal precisely here: `distributeEighths(x, 2)` makes the
      // smaller part `floor(x / 2)`, which clears the floor exactly when
      // `x >= 2F`. remainderEighths < standardEighths by construction, so
      // each half is at most standardEighths — the "never hand the shop an
      // oversized panel" rule survives the switch to an uneven split.
      //
      // ⚠ THE TIE AT EXACTLY 2F (48in) GOES TO THE SPLIT, and `>=` is where
      // that is decided. Both branches are legal at that single point (one
      // 48in panel, or two 24in ones); splitting preserves today's behaviour
      // there and keeps panels nearer the nominal width. Arbitrary but
      // FIXED, the same discipline as `distributeEighths`' absorber rule.
      resizedEighths = distributeEighths(leftoverEighths, 2);
      standardCount += 1; // the split adds one extra panel to the run
    } else {
      // ABSORB: one wider panel instead of two narrow ones. The run loses a
      // panel and keeps its exact total — `standardCount` stays at
      // `rawStandardCount`, and the panel that would have been full width
      // simply grows by the remainder.
      //
      // It cannot breach the ceiling: this branch runs only when
      // `leftoverEighths < 2F`, and 2F IS the ceiling (48in = 2 x 24in). So
      // the absorbed panel is strictly under 48in, always.
      resizedEighths = [leftoverEighths];
    }
  } else {
    resizedEighths = [standardEighths]; // exact fit — nothing to split
  }

  return {
    standardCount,
    gapWidthIn: fromEighths(gapEighths),
    resizedWidthsIn: resizedEighths.map(fromEighths),
  };
}

/**
 * Builds the plain standard+gap sequence (no corners, no openings) from a
 * sizing result: gap panel one slot in from whichever end `gapEnd`
 * designates, with a full-width standard panel between it and the corner,
 * and plain standards filling the rest.
 *
 * The resized (borrowed) panel(s) — when `resizedWidthsIn` differs from
 * `[standardWidthIn]` — are tucked in next to the gap panel instead, never
 * at the corner-touching position: rule 1 in `applyBracedPlacement` always
 * braces whichever standard panel touches each corner, and Tommy wants the
 * borrowed panel(s) to never be the one that ends up braced.
 */
function buildPlainMiddle(sizing: PlainSizing, standardWidthIn: number, gapEnd: WallEnd): PanelSlot[] {
  const { standardCount, gapWidthIn, resizedWidthsIn } = sizing;
  const gap: PanelSlot = { type: "safety-gap", widthIn: gapWidthIn };
  const plainStandard = (): PanelSlot => ({ type: "standard", widthIn: standardWidthIn });
  const cornerTouching: PanelSlot = plainStandard(); // always full width — rule 1 always braces this one
  const resizedSlots: PanelSlot[] = resizedWidthsIn.map((widthIn) => ({ type: "standard", widthIn }));

  if (standardCount === 0) {
    return [gap];
  }
  if (standardCount === resizedSlots.length) {
    // No room for a separate corner-touching/others split — every standard
    // panel in the run is one of the resized slot(s), which sit directly
    // corner-adjacent (see applyBracedPlacement's corner-brace-combining
    // rule for what happens when a gap panel ends up there too).
    return gapEnd === "start" ? [...resizedSlots, gap] : [gap, ...resizedSlots];
  }

  const others = Array.from({ length: standardCount - 1 - resizedSlots.length }, plainStandard);
  // Placing the resized slot(s) adjacent to the gap (farthest from both
  // corners, since each corner-touching walk in applyBracedPlacement stops
  // at the very first standard slot it finds) keeps them out of either
  // corner's brace.
  const plainStandards = gapEnd === "start" ? [...resizedSlots, ...others] : [...others, ...resizedSlots];
  return gapEnd === "start" ? [cornerTouching, gap, ...plainStandards] : [...plainStandards, gap, cornerTouching];
}

/**
 * Dispatches between the gap-panel middle (walls over 12ft) and the
 * even-standards middle (12ft or under, no safety panel needed at all —
 * Tommy: "safety panels only needed for walls more than 12' long"). A
 * budget of exactly 0 (both corners fit with nothing left over) returns no
 * middle slots at all — without this, `buildEvenMiddle`'s `Math.max(1, ...)`
 * floor (there to still show 1 evenly-sized standard for a small-but-
 * positive budget) and `buildPlainMiddle`'s "nothing to borrow from"
 * branch would otherwise both synthesize a phantom zero-width panel, which
 * renders invisibly but still counts as a real panel instance/price line.
 */
function buildMiddle(
  budgetLengthIn: number,
  standardWidthIn: number,
  gapEnd: WallEnd,
  allowBorrow: boolean,
  needsSafetyPanel: boolean,
): PanelSlot[] {
  if (budgetLengthIn <= 0) return [];
  // Snapped ONCE here so that every downstream consumer sees the same
  // grid-exact width — including buildPlainMiddle, which emits it verbatim
  // for each full-width panel. See gridStandardWidthIn.
  const widthIn = gridStandardWidthIn(standardWidthIn);
  if (!needsSafetyPanel) {
    return buildEvenMiddle(budgetLengthIn, widthIn);
  }
  const sizing = computePlainSizing(budgetLengthIn, widthIn, allowBorrow);
  return buildPlainMiddle(sizing, widthIn, gapEnd);
}

interface ResolvedCorners {
  /** Set only when the wall owns corners at both ends but is too short to
   * fit them without overlap — see the doc comment below. When set, this
   * is the wall's *only* content: no middle, no openings. */
  merged: PanelSlot | null;
  cornerStart: PanelSlot | null;
  cornerEnd: PanelSlot | null;
  fixedEndsIn: number;
  /** True when the corner pair ABSORBED a middle too small to hold a legal
   * panel and there was not even room to keep the caller's reservations
   * (openings) — they are dropped, exactly as the `merged` branch drops
   * them. False on every other path, including the absorb path that DID
   * keep them. */
  dropsReservations: boolean;
}

/**
 * Corner panels are normally a fixed `cornerWidthIn` at each end a wall
 * owns one. A short wall — most commonly a bump-out's perpendicular
 * remainder segment, whose length is whatever margin was left after
 * carving out the bump-out's span — can end up shorter than its own
 * corner(s)' combined width. Left alone, that would make both corners
 * render at their full nominal width anyway and overlap, protruding into
 * the structure (and, since the leftover "middle" budget clamps to 0, the
 * wall's total slot width would no longer add up to its own true length,
 * throwing off where the *next* wall's panels visually start too — see the
 * misalignment this caused between adjacent walls at a bump-out's reflex
 * corner).
 *
 * Tommy's fix: when a wall owns corners at BOTH ends but is too short for
 * both, merge them into a single corner panel spanning the wall's whole
 * length instead (no middle panel either) — one longer corner panel,
 * rather than two overlapping ones. This re-evaluates from scratch every
 * time the wall is tiled, so it "unmerges" back into two separate corners
 * automatically once the wall is long enough again; there's no separate
 * merged/unmerged state to track.
 *
 * A wall owning only one corner there (the other end butts a longer
 * neighbor) has nothing to merge with — instead that single corner just
 * clamps down to the wall's own length in the rarer case where even it
 * alone doesn't fit, the one-sided version of the same overlap.
 *
 * ### The 51in–75in two-corner band — CORNER ABSORB (2026-09-25)
 *
 * Merging on "too short for both corners" left a band of wall lengths with
 * **no legal tiling at all**, and it was live: `cornerPanelWidthIn` is
 * 25.5in, so a wall owning two corners spends 51in on them, and the middle
 * is `L - 51` — under the shop's 24in `fabricationMinPanelWidthIn` for every
 * `L` below **75in**. Too long to merge, too short to hold a legal middle
 * panel. A 6ft (72in) bump-out return sat three inches inside it; a regular
 * octagon's side is 0.41421x its bounding box, so **every** wall of an
 * octagon between 10.26ft and 15.09ft across landed in it.
 *
 * **Tommy's decision (2026-09-24) was the corner-geometry route, and he
 * explicitly rejected refusing these wall lengths:** *"I want to prioritize
 * good building principles here with the panelizer. I like the corner
 * geometry rule."* So the merge condition is extended from "too short for
 * both corners" to **"too short for both corners plus a legal middle"** —
 * and what the corners do about it is absorb that middle, the same answer
 * `computePlainSizing` already gives a leftover too small to stand alone:
 * widen an existing panel rather than emit one the shop cannot build.
 *
 * **Why the pair absorbs it rather than one merged panel spanning the wall.**
 * The single-panel reading of "extend the merge" would emit one corner slot
 * up to 74.875in wide — **past `panelWidthInRange.maxIn`, a confirmed 48in
 * catalog ceiling**, so it would trade an unbuildably narrow panel for an
 * unbuildably wide one. Splitting the wall between the two corner panels
 * keeps every part inside the catalog: each is `L / 2`, which over the band
 * runs from exactly 25.5in (at L = 51in, where this branch does not even
 * fire) up to 37.4375in (at L = 74.875in) — never below the 25.5in nominal
 * corner and never within 10in of the ceiling. **No catalog number moved to
 * make this fit; the geometry was chosen to fit the catalog.**
 *
 * Physically each panel is still one corner panel with one return face, butt
 * joined to its partner at mid-wall — not a new product, just a corner panel
 * off its nominal width, exactly as the merged corner has always been.
 * ⚠ **Corner panels off nominal width are a construction detail Tommy has not
 * signed off on case by case**, so every wall this fires on is reported in
 * the Review Log (`findAbsorbedCornerWalls`) rather than shipped silently.
 *
 * `reservedIn` is the caller's opening/column reservation total (0 from
 * `tileWall`). The corners absorb only what is left **after** it, so a wall
 * shortened into the band keeps its window instead of losing it — but when
 * the reservations no longer fit in the nominal middle at all, they are
 * dropped and the pair takes the whole wall, which is what `merged` has
 * always done and is the only answer that keeps the sum exact.
 */
function resolveCorners(
  wallLengthIn: number,
  cornerWidthIn: number,
  hasCornerStart: boolean,
  hasCornerEnd: boolean,
  reservedIn = 0,
): ResolvedCorners {
  // cornerWidthIn is already a whole eighth in the catalog (25.5in) — this
  // only defends against a caller passing something else, and it keeps the
  // merged/clamped/absorbed branches (which derive their width from
  // wallLengthIn) on the grid alongside everything else.
  const cornerEighths = Math.max(0, toEighths(cornerWidthIn));
  const wallEighths = Math.max(0, toEighths(wallLengthIn));
  const fixedEndsIn = fromEighths((hasCornerStart ? cornerEighths : 0) + (hasCornerEnd ? cornerEighths : 0));
  const bothCorners = hasCornerStart && hasCornerEnd;
  if (bothCorners && wallLengthIn < fixedEndsIn) {
    return {
      merged: { type: "corner", widthIn: fromEighths(wallEighths) },
      cornerStart: null,
      cornerEnd: null,
      fixedEndsIn,
      dropsReservations: false,
    };
  }
  if (bothCorners) {
    // Non-negative: the merge test above already established
    // `wallEighths >= 2 x cornerEighths`.
    const middleEighths = wallEighths - 2 * cornerEighths;
    if (middleEighths > 0 && middleEighths < toEighths(TILER_MIN_PANEL_WIDTH_IN)) {
      // CORNER ABSORB — see the doc comment above. A reservation total of 0
      // (every `tileWall` call) keeps this branch, so the pair simply shares
      // the whole wall.
      const reservedEighths = Math.max(0, toEighths(reservedIn));
      const keepsReservations = reservedEighths <= middleEighths;
      const shareEighths = keepsReservations ? wallEighths - reservedEighths : wallEighths;
      // Whichever end takes the odd eighth is `distributeEighths`' own
      // deliberately arbitrary but FIXED lowest-index rule — nobody has
      // decided that the wider corner belongs at a particular end.
      const [startEighths = 0, endEighths = 0] = distributeEighths(shareEighths, 2);
      return {
        merged: null,
        cornerStart: { type: "corner", widthIn: fromEighths(startEighths) },
        cornerEnd: { type: "corner", widthIn: fromEighths(endEighths) },
        fixedEndsIn: fromEighths(shareEighths),
        dropsReservations: !keepsReservations,
      };
    }
  }
  const clampedCornerIn = fromEighths(Math.min(cornerEighths, wallEighths));
  return {
    merged: null,
    cornerStart: hasCornerStart ? { type: "corner", widthIn: clampedCornerIn } : null,
    cornerEnd: hasCornerEnd ? { type: "corner", widthIn: clampedCornerIn } : null,
    fixedEndsIn,
    dropsReservations: false,
  };
}

/**
 * corner - standard panels - gap panel - standard panel - corner, with the
 * gap panel positioned at `gapEnd` (i.e. toward whichever corner) but always
 * one slot in from that corner — the slot between it and the corner is
 * reserved for the mandatory corner-touching braced panel (Tommy: "safety
 * panel is the second-to-last panel on each run"). Braced-panel typing
 * itself is a separate derived overlay (see `applyBracedPlacement`); this
 * function only fixes the *order* of standard/gap slots.
 *
 * The safety/gap panel's width is always exactly `SAFETY_GAP_WIDTH_IN`
 * (Tommy: "the 3/4in wide safety gap plywood spacers [should] be flush with
 * both adjacent panels") — everything else in the budget goes to whichever
 * standard panel sits next to the gap, resized wider than the nominal
 * `standardWidthIn` to absorb the leftover past a whole number of standard
 * widths, so the total always adds up exactly with no unaccounted slack on
 * either side of the gap:
 * - 2 or more standard panels fit: the one next to the gap gets resized;
 *   every other standard panel (including the corner-touching one) stays at
 *   the nominal `standardWidthIn`.
 * - Fewer than 1 full standard panel fits after reserving the gap: the
 *   whole remaining budget becomes a single resized standard panel next to
 *   the gap (which then sits directly corner-adjacent — see
 *   `applyBracedPlacement`'s corner-brace-combining rule for what happens
 *   to a gap panel that ends up there).
 *
 * `hasCornerStart`/`hasCornerEnd` (default true) control whether this wall
 * gets its own corner panel at each end independently — a wall can win the
 * corner at one end and butt against a longer neighbor at the other (e.g.
 * a bump-out wall), which a single wall-wide flag couldn't express. Tommy's
 * rule: at a plain 90deg corner, only the locally shorter of the two walls
 * meeting there owns the corner panel — the longer one butts flush against
 * it instead (conventional framing through-wall/butt-wall convention), so
 * it gets no corner slot at that end. Callers tiling a butting end should
 * already have shortened `wallLengthIn` by the perpendicular wall's
 * thickness there before calling this.
 *
 * `allowBorrow` no longer affects sizing (see `computePlainSizing`'s doc
 * comment) — kept as a parameter so mitered (octagon) vs. non-mitered
 * callers don't need to change.
 *
 * A wall at or under 12ft skips the gap panel entirely (Tommy: "safety
 * panels only needed for walls more than 12' long") — see
 * `buildMiddle`/`buildEvenMiddle`.
 *
 * If the wall owns corners at both ends but is too short to fit them
 * without overlapping, they're merged into a single corner panel spanning
 * the wall's whole length instead; and if it is too short to fit them plus a
 * legal middle panel (the 51in-75in band), the two corner panels absorb that
 * middle and share the wall between them — see `resolveCorners` for both,
 * and for why the second is a PAIR rather than one wide panel.
 *
 * **The sum invariant:** the returned slot widths are every one a whole
 * number of 1/8in and they add up EXACTLY to `roundToEighthIn(wallLengthIn)`
 * (Tommy: "we must remain absolutely precise on total lengths of wall
 * segments being exactly the same as the addition of all the panels").
 * `wallLengthIn` is snapped on the way in rather than trusted: callers
 * should already be passing `wallFabricationLengthIn(wall)` (less any
 * butt-joint inset, itself a whole-eighth thickness), so this is a no-op
 * for them, but a wall length is exactly the kind of value that arrives
 * off a drag gesture and the guarantee has to hold unconditionally to be
 * worth anything. For an octagon's 45deg walls the snap is a real (<=1/16in)
 * move — see `wallFabricationLengthIn` for why that is a mathematical
 * exception rather than a defect.
 */
export function tileWall(
  wallLengthIn: number,
  standardWidthIn: number,
  cornerWidthIn: number,
  gapEnd: WallEnd,
  hasCornerStart = true,
  hasCornerEnd = true,
  allowBorrow = true,
): TileWallResult {
  const gridLengthIn = roundToEighthIn(wallLengthIn);
  const corners = resolveCorners(gridLengthIn, cornerWidthIn, hasCornerStart, hasCornerEnd);
  if (corners.merged) {
    return { slots: [corners.merged] };
  }

  const middleLengthIn = Math.max(0, gridLengthIn - corners.fixedEndsIn);
  const needsSafetyPanel = gridLengthIn > SAFETY_PANEL_MIN_WALL_LENGTH_IN;
  const middle = buildMiddle(middleLengthIn, standardWidthIn, gapEnd, allowBorrow, needsSafetyPanel);

  return {
    slots: [...(corners.cornerStart ? [corners.cornerStart] : []), ...middle, ...(corners.cornerEnd ? [corners.cornerEnd] : [])],
  };
}

export interface OpeningAnchor {
  /** How many 'standard'-family-type slots (including corner-touching ones,
   * AND already-decided "braced" slots — see the doc comment below) precede
   * this opening in the plain sequence. */
  beforeStandardCount: number;
  type: "window" | "door" | "column" | "big-header";
  widthIn: number;
  /** This opening's own vertical/style fields, carried through a re-tile so
   * they survive it instead of silently resetting to defaults — a
   * pre-existing gap (window height/sill already reset on any width/wall-
   * length edit) that would also wipe a beam/max-height-split slot's own
   * independent zones the moment ANY opening on the wall triggers a
   * re-tile. Undefined = no data to carry (a door/column never sets
   * heightIn/sillHeightIn; zones absent = this opening was never split).
   * Populated by `getOpeningAnchors` from an existing slot — a caller
   * building a brand-new anchor from scratch just omits them. */
  heightIn?: number;
  sillHeightIn?: number;
  zones?: PanelSlotZone[];
  /** Meaningful only when `type === "big-header"` — see
   * `PanelSlot.includeSillOnBigHeader`'s own doc comment. */
  includeSillOnBigHeader?: boolean;
}

/**
 * Reads each window/door/column's position out of an existing (tiled)
 * slots array, as "how many standard-family slots come before it" — the
 * anchor used to put it back in roughly the same place after a re-tile. A
 * Column Panel is a fixed-width structural swap-in (not an opening), but
 * shares the same "reserve this width at this position" mechanism.
 *
 * Counts "braced" slots toward `standardsSeen` right alongside "standard"
 * ones — a braced panel occupies a real standard-family position on the
 * wall just as much as a plain standard one does (this is also the
 * convention `reconcileBracedPlacement`'s own ordinal-matching uses, and
 * that `handleToggleOpening` in page.tsx's own inline anchor-building loop
 * already independently used). Undercounting here (i.e. only counting
 * "standard") used to anchor an opening too early whenever a "braced" slot
 * preceded it — `retileWithOpenings` would then insert the opening before
 * the position `reconcileBracedPlacement` later re-applies that braced
 * marker to, visually swapping their left-right order after a retile (e.g.
 * a window width edit via `handleSetWindowWidth`).
 */
export function getOpeningAnchors(slots: PanelSlot[]): OpeningAnchor[] {
  const anchors: OpeningAnchor[] = [];
  let standardsSeen = 0;
  for (const slot of slots) {
    if (slot.type === "window" || slot.type === "door" || slot.type === "column" || slot.type === "big-header") {
      anchors.push({
        beforeStandardCount: standardsSeen,
        type: slot.type,
        widthIn: slot.widthIn,
        heightIn: slot.heightIn,
        sillHeightIn: slot.sillHeightIn,
        zones: slot.zones,
        includeSillOnBigHeader: slot.includeSillOnBigHeader,
      });
    } else if (slot.type === "standard" || slot.type === "braced") {
      standardsSeen++;
    }
  }
  return anchors;
}

/**
 * Re-tiles a whole wall from scratch treating each opening as a fixed-width
 * reservation at its anchored position, instead of leaving it as a mutation
 * on top of a previously-tiled array. This is what makes resizing a window
 * auto-adjust the standard panel count and gap/corner-touching sizing
 * around it — the wall's total length never drifts (Tommy: "the rest of the
 * wall protrudes... rather than autosizing the safety/borrowed panel/panel
 * count").
 *
 * If the wall owns corners at both ends but is too short to fit them
 * without overlapping, they're merged into a single corner panel spanning
 * the wall's whole length instead (dropping any openings — there's no room
 * for them either at that point) — see `resolveCorners` in `tileWall`'s
 * doc comment.
 *
 * In the 51in-75in band the corner pair absorbs the sub-minimum middle
 * instead, and here it absorbs only what is left **after** these openings:
 * a wall shortened into the band KEEPS a window that still fits in its
 * nominal middle, rather than losing it the way the merged branch would.
 * Openings are dropped only when they no longer fit there at all, which is
 * the one case where keeping them would break the sum invariant.
 */
export function retileWithOpenings(
  wallLengthIn: number,
  standardWidthIn: number,
  cornerWidthIn: number,
  gapEnd: WallEnd,
  hasCornerStart: boolean,
  hasCornerEnd: boolean,
  openings: OpeningAnchor[],
  allowBorrow = true,
): TileWallResult {
  // Same grid snap tileWall does, for the same reason — plus each
  // opening's own reserved width, so the plain budget left over for
  // standards is itself a whole number of eighths. A window typed as
  // 47-5/8in is already on the grid; one that isn't gets snapped here
  // rather than pushing every panel on the wall off it.
  const gridLengthIn = roundToEighthIn(wallLengthIn);
  const openingsTotalWidthIn = openings.reduce((sum, o) => sum + roundToEighthIn(o.widthIn), 0);
  const corners = resolveCorners(gridLengthIn, cornerWidthIn, hasCornerStart, hasCornerEnd, openingsTotalWidthIn);
  if (corners.merged) {
    return { slots: [corners.merged] };
  }

  // Empty ONLY on the corner-absorb path that could not keep them — see
  // `resolveCorners`. Every other path leaves this as the caller's own list,
  // so nothing outside the 51in-75in band sees any change at all.
  const keptOpenings = corners.dropsReservations ? [] : openings;
  const keptOpeningsTotalWidthIn = corners.dropsReservations ? 0 : openingsTotalWidthIn;
  const middleLengthIn = gridLengthIn - corners.fixedEndsIn;
  const plainBudgetIn = middleLengthIn - keptOpeningsTotalWidthIn;
  const needsSafetyPanel = gridLengthIn > SAFETY_PANEL_MIN_WALL_LENGTH_IN;
  const plainMiddle = buildMiddle(Math.max(0, plainBudgetIn), standardWidthIn, gapEnd, allowBorrow, needsSafetyPanel);

  // Carries heightIn/sillHeightIn/zones through unconditionally — undefined
  // for any anchor built without them (a brand-new opening) is a no-op on
  // the resulting PanelSlot, exactly as if the field were omitted.
  const openingSlotFromAnchor = (o: OpeningAnchor): PanelSlot => ({
    type: o.type,
    widthIn: roundToEighthIn(o.widthIn),
    heightIn: o.heightIn,
    sillHeightIn: o.sillHeightIn,
    zones: o.zones,
    includeSillOnBigHeader: o.includeSillOnBigHeader,
  });
  const sortedOpenings = [...keptOpenings].sort((a, b) => a.beforeStandardCount - b.beforeStandardCount);
  const middle: PanelSlot[] = [];
  let standardsSeen = 0;
  let openingIdx = 0;
  for (const slot of plainMiddle) {
    while (openingIdx < sortedOpenings.length && sortedOpenings[openingIdx]!.beforeStandardCount <= standardsSeen) {
      middle.push(openingSlotFromAnchor(sortedOpenings[openingIdx]!));
      openingIdx++;
    }
    middle.push(slot);
    if (slot.type === "standard") standardsSeen++;
  }
  while (openingIdx < sortedOpenings.length) {
    middle.push(openingSlotFromAnchor(sortedOpenings[openingIdx]!));
    openingIdx++;
  }

  return {
    slots: [...(corners.cornerStart ? [corners.cornerStart] : []), ...middle, ...(corners.cornerEnd ? [corners.cornerEnd] : [])],
  };
}

/**
 * Marks the corner slot at `end` as the "safety" corner variant (Tommy:
 * for shapes where every wall owns its own mitered corner panels, the
 * "left" corner of each run — see `computeSafetyEnd` — is a distinct
 * safety-oct-corner panel, replacing the rectangle's site-wide
 * least-accessible-corner marker). A no-op if that slot isn't a plain
 * corner (e.g. `hasCorners` was false, or the wall has no slots at all).
 */
export function markSafetyCorner(slots: PanelSlot[], end: WallEnd): PanelSlot[] {
  if (slots.length === 0) return slots;
  const index = end === "start" ? 0 : slots.length - 1;
  const target = slots[index];
  if (!target || target.type !== "corner") return slots;
  return slots.map((s, i) => (i === index ? { ...s, type: "safety-oct-corner" as const } : s));
}

export interface PanelCycleState {
  type: PanelSlotType;
  bracedPattern?: BracePattern;
  bracedMirrored?: boolean;
}

/**
 * The full click-through panel-type cycle (Tommy: "I want to be able to
 * include each panel style for braced panels in the click-through cycle
 * for panel type selections"): standard -> window -> door -> column ->
 * big-header -> all 4 braced styles (chevron, mirrored chevron, hatch,
 * mirrored hatch) -> back to standard. Corner and safety-gap slots aren't
 * cyclable at all (returns null), same as before this cycle grew to
 * include braced styles.
 *
 * Pure "what's next" decision only — doesn't touch `widthIn` or retile
 * anything itself. The caller (`handleToggleOpening` in page.tsx) uses
 * this to decide whether the transition needs a full retile (any
 * transition into or out of window/door/column/big-header, since those
 * reserve their own width) or is a simple in-place field mutation (every
 * other transition, including entering/leaving the braced-style block,
 * which never changes a slot's width). Supersedes the old 3-stop
 * standard->window->door->standard cycle this function used to be (it had
 * no way to represent column or braced at all, and nothing outside its own
 * tests ever called it).
 */
export function nextPanelCycleState(current: PanelCycleState): PanelCycleState | null {
  switch (current.type) {
    case "standard":
      return { type: "window" };
    case "window":
      return { type: "door" };
    case "door":
      return { type: "column" };
    case "column":
      return { type: "big-header" };
    case "big-header":
      return { type: "braced", bracedPattern: "chevron", bracedMirrored: false };
    case "braced":
      if (current.bracedPattern === "chevron" && current.bracedMirrored === false) {
        return { type: "braced", bracedPattern: "chevron", bracedMirrored: true };
      }
      if (current.bracedPattern === "chevron" && current.bracedMirrored === true) {
        return { type: "braced", bracedPattern: "hatch", bracedMirrored: false };
      }
      if (current.bracedPattern === "hatch" && current.bracedMirrored === false) {
        return { type: "braced", bracedPattern: "hatch", bracedMirrored: true };
      }
      // hatch+mirrored (the last stop), or an unrecognized/legacy
      // pattern-mirror combo — wrap back to standard either way.
      return { type: "standard" };
    default:
      return null; // corner, safety-gap — not cyclable
  }
}
