import { distributeEighths, fromEighths, roundToEighthIn, toEighths } from "./eighths";
import type { BracePattern, PanelSlot, PanelSlotType, PanelSlotZone, WallEnd } from "./types";

export interface TileWallResult {
  slots: PanelSlot[];
}

/**
 * The safety/gap panel's reserved wall-run width on a run OVER the threshold
 * (Tommy: "a safety gap should be a 3/4in wide piece of plywood... I want the
 * 3/4in wide safety gap plywood spacers to be flush with both adjacent
 * panels" — not a leftover-sized bay with the actual 3/4in board floating
 * somewhere inside it, unaccounted space on both sides).
 *
 * Must match panel-catalog's `SAFETY_GAP_THICKNESS_IN`
 * (packages/panel-catalog/src/safetyGapMembers.ts) — duplicated here rather
 * than imported since packages/geometry doesn't depend on
 * packages/panel-catalog, and asserted equal by
 * `apps/web/app/tilerFabricationLimits.test.ts`, the one place that imports
 * both.
 *
 * **The reserved width and the sheet thickness are ONE physical fact, not
 * two.** The gap IS the plywood (Tommy: "instead of a safety panel being a
 * standard panel slightly altered, its actually just a 3/4in piece of plywood
 * that is the panel thickness and panel height"), so a run that reserves 3/4in
 * is reserving room for a 3/4in sheet and nothing else. They are two constants
 * only because the two packages may not see each other.
 */
export const WIDE_SAFETY_GAP_WIDTH_IN = 0.75;

/**
 * The safety/gap panel's reserved wall-run width on a run AT OR UNDER the
 * threshold — **Tommy, 2026-09-30, verbatim:** *"Can we make it so that once
 * below the threshold (of 12'? If it's somewhere around 10-12' rn that's fine)
 * the safety gap is 1/2"."* He was told the existing threshold is 144in (12ft)
 * measured against the panel RUN and confirmed that matches what he meant.
 *
 * This is a decision of Building Integrity's, stated first-hand with a number
 * and a unit — the same standing `fabricationMinPanelWidthIn` (24in) has — not
 * a researched or industry-typical figure. Its catalog home is
 * `safetyGapPanelRules` in packages/panel-catalog, where it carries that
 * quotation as its provenance note.
 *
 * Must match panel-catalog's `SAFETY_GAP_THIN_THICKNESS_IN`, same duplication
 * note and same cross-package assertion as the wide width above.
 */
export const NARROW_SAFETY_GAP_WIDTH_IN = 0.5;

/**
 * The longest RUN that gets the narrow (1/2in) gap; anything longer gets the
 * wide (3/4in) one.
 *
 * ⚠ **This is measured against the RUN, not against the wall**, and the
 * constant it replaced (`SAFETY_PANEL_MIN_WALL_LENGTH_IN`) said WALL while
 * being tested against exactly the same run value — a latent trap, because a
 * wall and its run are NOT the same length as soon as the wall butts into a
 * neighbour at either end. A 12'11" (155in) wall that loses both of its
 * corners is a 124in run and is therefore a SHORT run, which is precisely what
 * happens to the short sides of Tommy's 241 x 155in rectangle under the
 * corner-ownership flip of 2026-10-01. The name now says run. Nothing else
 * about the number moved: it was 144in before this pass and it is 144in after.
 *
 * It used to gate whether a gap slot existed AT ALL; from 2026-10-01 it only
 * decides how wide one is. **Every run gets a gap** — see
 * `safetyGapWidthForRunIn`.
 */
export const SAFETY_GAP_NARROW_MAX_RUN_LENGTH_IN = 144;

/**
 * The two-tier safety gap: how much wall-run width a run of this length
 * reserves for its safety/gap panel.
 *
 * Exported because the app needs the same answer the tiler used (which sheet
 * a given gap slot is) and must not re-derive it from a second copy of the
 * threshold.
 */
export function safetyGapWidthForRunIn(runLengthIn: number): number {
  return roundToEighthIn(runLengthIn) > SAFETY_GAP_NARROW_MAX_RUN_LENGTH_IN
    ? WIDE_SAFETY_GAP_WIDTH_IN
    : NARROW_SAFETY_GAP_WIDTH_IN;
}

/**
 * The narrowest panel Building Integrity's shop can build, left to right in
 * elevation — the floor the ABSORB rule below is written against.
 *
 * Must match panel-catalog's `fabricationMinPanelWidthIn` (24in, confirmed,
 * Tommy 2026-09-24). Duplicated here rather than imported for exactly the
 * reason the two safety-gap widths above are: packages/geometry deliberately has
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
 * absorb rule reaches every plain-middle length — i.e. no wall is refused for
 * the width of its STANDARD panels — ONLY because this ceiling is exactly
 * twice that floor.
 *
 * ⚠ **"Every wall length has a legal tiling" is NOT true in general, and this
 * comment used to say it was.** It holds for the plain middle at any standard
 * width, and for the two-corner band at the 25.5in corner. It does not hold
 * when the corner panel may not widen: at the confirmed 39in Square Bale
 * corner, walls from 96.125in to 101.875in have no legal tiling at any
 * standard width (measured — see `resolveCorners`' `cornerMayWiden`), and the
 * app refuses that panelization for such a wall rather than hiding it.
 *
 * See `computePlainSizing`. `data.test.ts` asserts `maxIn >= 2 x minIn`
 * directly so a future change to either number fails loudly rather than
 * quietly producing a wall that cannot be built.
 */
export const TILER_MAX_PANEL_WIDTH_IN = 48;

/**
 * ⚠ **GONE as of 2026-10-01: `buildEvenMiddle`, the no-gap-panel path.**
 *
 * A run of 144in or less used to get NO safety-gap slot at all and was tiled
 * instead by an even split of the whole budget — `Math.ceil(budget /
 * standardWidth)` panels, floored so none landed under
 * `TILER_MIN_PANEL_WIDTH_IN`, all within one eighth of each other. That
 * function no longer exists, because **every run now gets a gap** and the
 * threshold only decides how wide it is (`safetyGapWidthForRunIn`). Deleted
 * rather than left unreachable: a second tiling path nothing calls is a trap,
 * and its even-split behaviour was the reason a short wall could silently end
 * up with no dimensional-tolerance allowance at all — against Tommy's own
 * *"on each wall"*.
 *
 * Its even-split arithmetic is not lost — `computeSillRunWidths` just below
 * still does exactly that, for a window's sill run, and is now the one place
 * in this file that reads that way.
 */

/**
 * How many sill panels a window's rough-opening run needs, and how wide
 * each one is (Tommy: "sills are short standard panels... if the window
 * spacing or header length exceeds the standard panel width, then create
 * another sill to share the run") — an even split of the whole run, no
 * safety-gap reservation of any kind (a sill run is inside a window's rough
 * opening, not along a wall), returning plain widths instead of PanelSlot[]:
 * a sill isn't part of a wall's own tiled slots array, it's derived per window
 * opening. Uses `Math.ceil` because a sill is
 * fabricated as a real (short) Standard Panel, so it shouldn't exceed
 * `standardWidthIn` either. This is now the only even-split tiling left in
 * this file — see the note where `buildEvenMiddle` used to be.
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
 * The gap panel itself is always exactly `gapWidthIn`, the width
 * `safetyGapWidthForRunIn` chose for this run — everything
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
 * wide unrendered gap around the real board; see
 * `WIDE_SAFETY_GAP_WIDTH_IN`'s comment.)
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
  gapWidthIn: number,
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
  // The gap is always exactly the width `safetyGapWidthForRunIn` chose for
  // this run (3/4in over 144in, 1/2in at or under it) — except on a budget too
  // small to hold even that, where it clamps to whatever there is. That
  // case is only reachable through `retileWithOpenings` (openings eating
  // all but a sliver of a wall's middle), and it used to overflow the
  // wall by up to the gap's own width; clamping is what keeps the sum exact
  // there. It does NOT change either tier's constant.
  //
  // KNOWN, DELIBERATE INCONSISTENCY in that degenerate case, written down
  // rather than left to be discovered: `buildSafetyGapMembers` still emits a
  // whole plywood board into the clamped slot, so the model briefly
  // asserts a safety gap narrower than the board it stands for. Chosen over
  // dropping the slot entirely, which would turn the sliver into a phantom
  // sub-inch standard panel — a real (priced, fabricated) panel instance,
  // which is worse than a too-narrow gap. BOM and fabrication output are
  // unaffected: the gap's BOM width is zeroed, and the app picks the sheet by
  // THICKNESS TIER rather than off this slot's clamped width (see
  // `safetyGapSheetThicknessIn` in page.tsx), so a clamped slot still carries
  // a whole sheet of one of the two real specs rather than an invented one.
  const gapEighths = Math.min(toEighths(gapWidthIn), budgetEighths);
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
 * The middle of a run: standard panels plus exactly one safety-gap slot,
 * `gapWidthIn` wide. **There is no longer a second, gapless path** — the
 * threshold decides the gap's WIDTH, not its existence (see
 * `safetyGapWidthForRunIn`, and the note where `buildEvenMiddle` used to be).
 *
 * A budget of exactly 0 (both corners fit with nothing left over) returns no
 * middle slots at all — without this, `buildPlainMiddle`'s "nothing to borrow
 * from" branch would synthesize a phantom zero-width panel, which renders
 * invisibly but still counts as a real panel instance/price line.
 */
function buildMiddle(
  budgetLengthIn: number,
  standardWidthIn: number,
  gapEnd: WallEnd,
  allowBorrow: boolean,
  gapWidthIn: number,
): PanelSlot[] {
  if (budgetLengthIn <= 0) return [];
  // Snapped ONCE here so that every downstream consumer sees the same
  // grid-exact width — including buildPlainMiddle, which emits it verbatim
  // for each full-width panel. See gridStandardWidthIn.
  const widthIn = gridStandardWidthIn(standardWidthIn);
  const sizing = computePlainSizing(budgetLengthIn, widthIn, gapWidthIn, allowBorrow);
  return buildPlainMiddle(sizing, widthIn, gapEnd);
}

/**
 * The middle a wall owning BOTH corners is left with when that middle cannot
 * legally hold a safety gap plus one buildable panel, or null when the wall is
 * not in that band at all.
 *
 * Exported because two places need the SAME definition of "this wall is in
 * the corner band": `resolveCorners`, which absorbs it (see below), and the
 * app's Square Bale refusal, which must name the band to the user in real
 * inches rather than re-deriving the arithmetic in a second place and
 * drifting from it.
 *
 * Null (not in the band) covers all three of: a wall that does not own both
 * corners, a wall whose middle is exactly 0 or negative (the nominal pair
 * fits with nothing left over, or does not fit at all — the merge case), and
 * a wall whose middle is already a legal gap-plus-panel.
 *
 * ⚠ **The band's ceiling moved on 2026-10-01, from `TILER_MIN_PANEL_WIDTH_IN`
 * to `TILER_MIN_PANEL_WIDTH_IN + gapWidthIn`, and that is a correction rather
 * than a widening for its own sake.** Every run now reserves a safety gap, so
 * a middle must pay for the gap BEFORE it can hold a legal panel: a 75in
 * two-corner wall has a 24in middle, which was exactly one legal panel and is
 * now a 1/2in gap plus a 23½in panel the shop cannot build. At
 * `cornerPanelWidthIn` (25.5in) the band is therefore 51in to 75½in rather
 * than 51in to 75.5in — four eighth-steps wider — and every one of those walls
 * gets a legal corner pair instead of an unbuildable panel. **No building value
 * moved to make this fit**: 24in, 48in and 25.5in are all untouched, and the
 * pair is still checked for legality by `resolveCorners` before it absorbs.
 *
 * `gapWidthIn` is passed in rather than derived here because only the caller
 * knows the run's length, and the run's length is what picks the tier
 * (`safetyGapWidthForRunIn`). In practice every wall in this band is far under
 * the 144in threshold and so always gets the narrow tier — the parameter keeps
 * that a fact about the numbers rather than an assumption in the code.
 */
export function cornerBandMiddleIn(
  wallLengthIn: number,
  cornerWidthIn: number,
  hasCornerStart: boolean,
  hasCornerEnd: boolean,
  gapWidthIn: number,
): number | null {
  if (!hasCornerStart || !hasCornerEnd) return null;
  const cornerEighths = Math.max(0, toEighths(cornerWidthIn));
  const wallEighths = Math.max(0, toEighths(wallLengthIn));
  const middleEighths = wallEighths - 2 * cornerEighths;
  if (middleEighths <= 0 || middleEighths >= toEighths(TILER_MIN_PANEL_WIDTH_IN + gapWidthIn)) return null;
  return fromEighths(middleEighths);
}

/**
 * The width of the single MERGED corner slot a wall gets when it owns corners
 * at both ends but is too short to fit them side by side — or null when this
 * wall does not take the merge branch at all.
 *
 * Exported for exactly the reason `cornerBandMiddleIn` above is: two places
 * need the same definition of "this wall merges its corners", and re-deriving
 * `wallLengthIn < 2 x cornerWidthIn` in a second place is how the app's own
 * refusal drifts away from what the tiler does. `resolveCorners`' merge branch
 * is the only consumer that matters on the geometry side; the app's Square Bale
 * refusal is the other one.
 *
 * ### Why the app needs this at all: the MERGED BALE CORNER
 *
 * The merged corner is Tommy's own long-standing rule for a wall too short for
 * two corner panels, and the slot it emits is **as wide as the wall** — which
 * is fine for a plywood-faced corner panel up to the 48in ceiling, and is not
 * fine at all for a Square Bale corner. `squareBalePanel.widthIn` is a
 * CONFIRMED 39in whole-bale unit, so the merge fires on every two-corner wall
 * under 78in and emits a "bale corner" that is not 39in wide — up to
 * 77 7/8in, nearly 30in over `panelWidthInRange.maxIn`. Bales do not stretch,
 * so that part cannot be built, exactly like the widened bale corner
 * `cornerMayWiden` already refuses to produce.
 *
 * **`cornerMayWiden` does NOT gate this branch and deliberately still does
 * not.** The merge predates absorb, Tommy's instruction for the absorb work was
 * that it keep behaving as it does today, and the plywood path depends on it.
 * The answer is a refusal in the app, at the point of edit, not a change here —
 * see `squareBaleCornerRefusal.ts`.
 *
 * Returns null for a wall that does not own both corners, and for a
 * zero-or-negative length, so a caller can treat null as "the merge branch is
 * not what happens here".
 */
export function mergedCornerWidthIn(
  wallLengthIn: number,
  cornerWidthIn: number,
  hasCornerStart: boolean,
  hasCornerEnd: boolean,
): number | null {
  if (!hasCornerStart || !hasCornerEnd) return null;
  const cornerEighths = Math.max(0, toEighths(cornerWidthIn));
  const wallEighths = Math.max(0, toEighths(wallLengthIn));
  if (wallEighths <= 0) return null;
  // The SAME comparison `resolveCorners` makes, on the same grid-snapped
  // length `tileWall`/`retileWithOpenings` hand it: strictly less than the two
  // nominal corners side by side. At exactly 2 x corner the pair fits with a
  // zero middle and there is no merge.
  if (wallEighths >= 2 * cornerEighths) return null;
  return fromEighths(wallEighths);
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
 *
 * ### `cornerMayWiden` — because one panelization's corner cannot stretch
 *
 * Absorb rests entirely on a corner panel being fabricable off its nominal
 * width. That is true of the plain corner panel and confirmed by Tommy
 * (2026-09-25, asked directly whether a corner panel can be built off 25.5in:
 * *"Yes — any width in the 24-48in band"*) — it is a 24in core plus two 3/4in
 * plywood faces, built like a Column Panel, so widening the core is the same
 * part made longer.
 *
 * It is NOT true of every corner this function is called with.
 * `squareBalePanel.widthIn` is a **confirmed 39in** whole-bale unit — two 18in
 * bales plus two 1.5in studs — and the app tiles Square Bale corners at that
 * width, which moves this band to **78in-102.5in** and would otherwise emit two
 * 48in "corner panels" on an ordinary 8ft wall. Tommy, asked directly:
 * **"No — refuse instead."** Bales do not stretch, so widening a bale corner
 * invents a product that does not exist.
 *
 * So the caller says whether its corner product may widen. When it may not,
 * this function does NOT absorb: the wall falls through to today's nominal
 * corners plus a sub-minimum middle, which the Review Log's existing
 * sub-minimum-panel entry reports. **That wall has no legal tiling and the app
 * must say so** — a visible gap beats a substituted value. The refusal that
 * names it at the point of edit lives in `page.tsx`.
 *
 * ### ⚠ EXACTLY what `cornerMayWiden` covers, and what it does not
 *
 * **CORRECTED 2026-09-26.** This paragraph used to say the flag "stops the
 * geometry inventing a part on any other path". That overstated it, and the
 * overstatement was the reason a real hole sat unnoticed. The flag gates **the
 * absorb branch below and nothing else.**
 *
 * It does **not** gate the **merge** branch above it — the older
 * "too short for both corners at all" rule — which emits one `corner` slot of
 * the wall's **whole length** at any corner width, flag or no flag. Measured:
 * `tileWall(72, 39, 39, "end", true, true, true, false)` → a single
 * `corner 72in`, and `tileWall(77.875, ...)` → `corner 77.875in`, **29 7/8in
 * over the confirmed 48in `panelWidthInRange.maxIn`**. Under Square Bale that
 * fires on every two-corner wall under 78in, so every wall of every octagon
 * from about 9.7ft to 15.7ft across is one merged "bale corner" as wide as the
 * wall.
 *
 * **That is deliberately still not gated here.** The merge is Tommy's own rule,
 * the instruction for the absorb work was that it keep behaving as it does
 * today, and the plywood path depends on it. Tommy's answer (2026-09-26, asked
 * whether *"No — refuse instead"* extends to the merged bale corner) was
 * **"Yes — refuse both cases too"**, and a refusal belongs in the app, not in
 * the tiler: see `mergedCornerWidthIn` below, which the app's Square Bale
 * refusal reads so that the two cannot drift, and `squareBaleCornerRefusal.ts`.
 *
 * So the honest summary of what the geometry itself guarantees under
 * `cornerMayWiden: false` is narrow: **a band wall is not silently widened.**
 * Everything else about Square Bale's corner legality is enforced in the app,
 * at the point of edit, and a wall drawn or shortened into the band while
 * Square Bale is ALREADY selected is still reported rather than refused — see
 * `squareBaleCornerRefusal.ts` for the exact edge of that coverage.
 */
function resolveCorners(
  wallLengthIn: number,
  cornerWidthIn: number,
  hasCornerStart: boolean,
  hasCornerEnd: boolean,
  gapWidthIn: number,
  reservedIn = 0,
  cornerMayWiden = true,
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
  if (bothCorners && cornerMayWiden) {
    // Non-negative: the merge test above already established
    // `wallEighths >= 2 x cornerEighths`. Same arithmetic as
    // `cornerBandMiddleIn`, which the app's own refusal uses — kept in
    // eighths here because everything below works in eighths.
    const middleEighths = wallEighths - 2 * cornerEighths;
    if (middleEighths > 0 && middleEighths < toEighths(TILER_MIN_PANEL_WIDTH_IN + gapWidthIn)) {
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
      // ⚠ ABSORB ONLY WHEN THE ABSORBED PAIR IS ITSELF LEGAL — the same
      // legality test `computePlainSizing` applies before it absorbs, and it
      // is here for the same reason the absorb rule's own doc comment keeps
      // repeating: the margin is a coincidence of two catalog numbers, not a
      // property of this algorithm. At `cornerPanelWidthIn` (25.5in) the pair
      // always lands in [25.5in, 37.5in] and this never fires.
      //
      // ⚠ **CORRECTED 2026-09-26: this guard is NOT unreachable at catalog
      // values, and the claim that it "fires only on a caller passing a
      // non-catalog corner width" was false.** It is reachable straight from
      // the panelization control: at the confirmed 39in `squareBalePanel`
      // corner the pair reaches 48in at a 96in wall, so every wall from
      // 96.125in to 101.875in — **47 of the 191 eighth-steps in that band** —
      // lands here, measured. Those walls have NO legal tiling at all, which
      // is why Square Bale now passes `cornerMayWiden: false` and is refused
      // by name instead (see the doc comment above); the guard is the
      // backstop, not the answer.
      //
      // When it fires, the wall keeps today's tiling and the Review Log
      // reports the sub-minimum panel, which is strictly better than a
      // silent unbuildable corner.
      const legalPair =
        Math.min(startEighths, endEighths) >= toEighths(TILER_MIN_PANEL_WIDTH_IN) &&
        Math.max(startEighths, endEighths) <= toEighths(TILER_MAX_PANEL_WIDTH_IN);
      if (legalPair) {
        return {
          merged: null,
          cornerStart: { type: "corner", widthIn: fromEighths(startEighths) },
          cornerEnd: { type: "corner", widthIn: fromEighths(endEighths) },
          fixedEndsIn: fromEighths(shareEighths),
          dropsReservations: !keepsReservations,
        };
      }
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
 * The safety/gap panel's width is always exactly the tier
 * `safetyGapWidthForRunIn` picks for this run — 3/4in over 144in of run,
 * 1/2in at or under it
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
 * rule (2026-10-01): at a plain convex 90deg corner the locally LONGER of
 * the two walls meeting there runs through and owns the corner panel — the
 * shorter one butts flush against it instead, so it gets no corner slot at
 * that end. Callers tiling a butting end should
 * already have shortened `wallLengthIn` by the perpendicular wall's
 * thickness there before calling this. See `cornerOwnership` in retile.ts,
 * which is where the rule and its tiebreak actually live.
 *
 * `allowBorrow` no longer affects sizing (see `computePlainSizing`'s doc
 * comment) — kept as a parameter so mitered (octagon) vs. non-mitered
 * callers don't need to change.
 *
 * EVERY run gets a gap panel (2026-10-01). A run at or under 144in gets a
 * 1/2in one instead of a 3/4in one — it no longer goes without. See
 * `safetyGapWidthForRunIn` and `buildMiddle`.
 *
 * If the wall owns corners at both ends but is too short to fit them
 * without overlapping, they're merged into a single corner panel spanning
 * the wall's whole length instead; and if it is too short to fit them plus a
 * legal middle panel (the 51in-75.5in band), the two corner panels absorb that
 * middle and share the wall between them — see `resolveCorners` for both,
 * and for why the second is a PAIR rather than one wide panel.
 *
 * `cornerMayWiden = false` turns that second rule OFF for a caller whose
 * corner is a fixed physical unit that cannot be fabricated off its nominal
 * width (Square Bale Panels' 39in whole-bale corner). Such a wall then tiles
 * as it did before absorb existed — nominal corners and a sub-minimum middle
 * the Review Log reports — because the honest answer there is a refusal, not a
 * widened part. See `resolveCorners`.
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
  cornerMayWiden = true,
): TileWallResult {
  const gridLengthIn = roundToEighthIn(wallLengthIn);
  // Two-tier gap, measured against the RUN — which is what `gridLengthIn`
  // already is: `wallRunFor` has taken any butt-joint inset out before this is
  // called. See `SAFETY_GAP_NARROW_MAX_RUN_LENGTH_IN` on why that distinction
  // is worth a sentence. Resolved BEFORE the corners, because the corner band's
  // own ceiling now includes it (`cornerBandMiddleIn`).
  const gapWidthIn = safetyGapWidthForRunIn(gridLengthIn);
  const corners = resolveCorners(gridLengthIn, cornerWidthIn, hasCornerStart, hasCornerEnd, gapWidthIn, 0, cornerMayWiden);
  if (corners.merged) {
    return { slots: [corners.merged] };
  }

  const middleLengthIn = Math.max(0, gridLengthIn - corners.fixedEndsIn);
  const middle = buildMiddle(middleLengthIn, standardWidthIn, gapEnd, allowBorrow, gapWidthIn);

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
 * In the 51in-75.5in band the corner pair absorbs the sub-minimum middle
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
  cornerMayWiden = true,
): TileWallResult {
  // Same grid snap tileWall does, for the same reason — plus each
  // opening's own reserved width, so the plain budget left over for
  // standards is itself a whole number of eighths. A window typed as
  // 47-5/8in is already on the grid; one that isn't gets snapped here
  // rather than pushing every panel on the wall off it.
  const gridLengthIn = roundToEighthIn(wallLengthIn);
  const openingsTotalWidthIn = openings.reduce((sum, o) => sum + roundToEighthIn(o.widthIn), 0);
  // Two-tier gap off the RUN's own length, exactly as `tileWall` does — NOT
  // off the plain budget left after the openings, so adding a window never
  // changes which sheet the gap is. Resolved before the corners because the
  // corner band's ceiling includes it (`cornerBandMiddleIn`).
  const gapWidthIn = safetyGapWidthForRunIn(gridLengthIn);
  const corners = resolveCorners(
    gridLengthIn,
    cornerWidthIn,
    hasCornerStart,
    hasCornerEnd,
    gapWidthIn,
    openingsTotalWidthIn,
    cornerMayWiden,
  );
  if (corners.merged) {
    return { slots: [corners.merged] };
  }

  // Empty ONLY on the corner-absorb path that could not keep them — see
  // `resolveCorners`. Every other path leaves this as the caller's own list,
  // so nothing outside the 51in-75.5in band sees any change at all.
  const keptOpenings = corners.dropsReservations ? [] : openings;
  const keptOpeningsTotalWidthIn = corners.dropsReservations ? 0 : openingsTotalWidthIn;
  const middleLengthIn = gridLengthIn - corners.fixedEndsIn;
  const plainBudgetIn = middleLengthIn - keptOpeningsTotalWidthIn;
  const plainMiddle = buildMiddle(Math.max(0, plainBudgetIn), standardWidthIn, gapEnd, allowBorrow, gapWidthIn);

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
