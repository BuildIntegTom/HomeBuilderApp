import { distributeEighths, fromEighths, toEighths } from "./eighths";
import { applyZonesToSlot } from "./panelSlotZones";
import type { BracePattern, PanelSlot, PanelSlotType } from "./types";

/**
 * Insert, replace and delete ONE panel on ONE wall — the arithmetic behind
 * Smearforn Stage 2 (Tommy: "There should be a way to add a panel, select
 * which type of panel you want to add, and then click where to put it. This
 * would either replace a panel or add one between").
 *
 * Pure, like `panelWidthEdit.ts` beside it, and for the same reason: the
 * rules are testable without a browser. page.tsx owns the tool state, the
 * click targets and the notices; this module owns what the wall's slot array
 * becomes and when the edit is refused.
 *
 * ### The free run is where every inch comes from and goes to
 *
 * A wall's slots divide into two groups, and this whole module is that
 * division:
 *
 *   - **Fixed** — corner and safety-gap (both RULE-placed, see
 *     `PLACEABLE_PANEL_TYPES`), every opening (window/door/column/
 *     big-header, each already a fixed-width reservation the tiler anchors),
 *     and every standard/braced slot the user has hand-pinned
 *     (`lockedWidthIn`).
 *   - **Free** — the unpinned standard/braced slots. The tiler's own run.
 *
 * An insert reserves its new panel's width out of the free run; a delete
 * hands its width back. **Nothing else on the wall moves** — not a corner,
 * not an opening, not a neighbour's type, style, zones or pin. That is the
 * acceptance criterion for this stage, and it is why the free/fixed split is
 * the first thing this file does.
 *
 * **The wall's own total length never moves.** Every quantity below is an
 * integer count of eighths (`toEighths`/`distributeEighths`), and the target
 * total is read off the slot array the edit started from, so "the panels sum
 * to the wall" is an integer identity rather than a floating-point hope.
 *
 * ### Why this does not call the tiler
 *
 * Every other wall edit in the app re-runs `retileWithOpenings`. This one
 * cannot, and the reason is worth stating because it looks like an omission:
 * the tiler derives the free run's COUNT from the budget alone
 * (`computePlainSizing`), so it answers "how many panels does this wall
 * hold" identically every time it is asked. Re-deriving the count is exactly
 * what an insert or a delete must not do — a wall that just gained a
 * hand-placed panel would lose it again on the way back out, which is the
 * silent revert the Smearforn plan exists to prevent. So the count here is
 * carried by the slot array itself (already persisted, no new field, no file
 * version bump) and only the free run's WIDTHS are recomputed.
 *
 * The free run is re-tiled flat — `distributeEighths` over what is left,
 * exactly as `buildEvenMiddle` does for a short wall — so no two automatic
 * panels differ by more than 1/8in and every one of them lands inside
 * [`minIn`, `maxIn`] by construction (see `redistributeFreeRun`).
 */

/**
 * The types this tool may place: the click-through cycle's roster exactly
 * (`nextPanelCycleState`), no more and no less. A braced panel's four styles
 * are `bracedPattern` x `bracedMirrored` on this same "braced" entry.
 *
 * **Corner and safety-gap are deliberately NOT here.** Both are placed by
 * rules that exist for reasons — corner ownership (shorter-wall-wins, reflex
 * corners, the merged-corner case) and the gap-end/second-to-last-panel rule
 * — and hand-placing one would put the user in a fight with two systems that
 * will overwrite them on the next retile. The anchor mechanism would happily
 * carry them; leaving them out is a scope decision, not a technical limit,
 * and the ADU's repeated "SAFETY GAP" annotations may well reopen it. See
 * the spec's Open Items.
 */
export const PLACEABLE_PANEL_TYPES = ["standard", "braced", "window", "door", "column", "big-header"] as const;

export type PlaceablePanelType = (typeof PLACEABLE_PANEL_TYPES)[number];

export function isPlaceablePanelType(type: PanelSlotType): type is PlaceablePanelType {
  return (PLACEABLE_PANEL_TYPES as readonly PanelSlotType[]).includes(type);
}

/** What the tool is about to put on the wall. The caller resolves every
 * real-world width itself — the project's standard width, `COLUMN_TOTAL_
 * WIDTH_IN`, `bigHeaderDefaultWidthIn` — for the same reason
 * `panelWidthEdit.ts` takes its minimum as a parameter: this package has
 * zero package dependencies and that is worth more than reaching for a
 * catalog constant directly. */
export interface PlacementPanel {
  type: PlaceablePanelType;
  /** Required for an insert (the width the new panel is born at). For a
   * replace, `undefined` means "carry the panel already there" — which is
   * what the click-cycle does for every transition except Column (fixed
   * width) and Big Header (its own default). */
  widthIn?: number;
  bracedPattern?: BracePattern;
  bracedMirrored?: boolean;
  /** A window's own rough-opening height, or a Big Header's own assembly
   * height. Undefined = the project default, the same "absent = automatic"
   * convention `PanelSlot` already uses. */
  heightIn?: number;
  sillHeightIn?: number;
  includeSillOnBigHeader?: boolean;
}

export interface FreeRunLimitsIn {
  /** `fabricationMinPanelWidthIn` (24in, confirmed) — the narrowest panel
   * the shop can build. No automatic panel may be left under it. */
  minIn: number;
  /** `panelWidthInRange.maxIn` (48in, confirmed). No automatic panel may be
   * left over it. */
  maxIn: number;
}

/** Why a target cannot be placed on/at all — mapped to a sentence by the
 * caller, so no user-facing copy lives in `packages/geometry`. */
export type PlacementRefusalReason =
  /** A corner or safety-gap slot: rule-placed, see `PLACEABLE_PANEL_TYPES`. */
  | "rule-placed-slot"
  /** No such slot, or a boundary outside the wall's own panel run (outside
   * the corners). */
  | "out-of-range";

export type PanelPlacementResult =
  | {
      outcome: "commit";
      slots: PanelSlot[];
      /** Where the panel the user just placed ended up, for the selection. -1
       * after a delete (nothing to select). */
      selectedIndex: number;
      /** Before/after counts, so the caller can say out loud when an insert
       * had to absorb an automatic panel to pay for itself (the wall's own
       * slot count then does not go up) rather than leaving it to be
       * discovered. */
      slotCountBefore: number;
      slotCountAfter: number;
      freeCountBefore: number;
      freeCountAfter: number;
    }
  | { outcome: "refuse-not-placeable"; reason: PlacementRefusalReason }
  /** The automatic (unpinned) panels on this wall cannot cover the new
   * panel's width, or what would be left of them could not be built.
   * `freeBudgetIn` is how much room there actually is. */
  | { outcome: "refuse-no-room"; requestedIn: number; freeBudgetIn: number; minIn: number }
  /** Nothing automatic left on this wall to absorb the width being freed —
   * every other panel is pinned, an opening or a corner. */
  | { outcome: "refuse-no-free-run"; freedWidthIn: number }
  /** The panel being placed is itself outside what the shop can build. Only
   * reachable for a standard/braced panel — an opening's width answers to
   * its own catalog range, not to this one. */
  | { outcome: "refuse-width-out-of-range"; widthIn: number; minIn: number; maxIn: number }
  /** Honouring this would leave an automatic panel wider than the shop's
   * maximum, and the only alternative (adding a panel back) is not what the
   * user asked for. Mostly a delete: a wall can run out of ways to have
   * FEWER panels. */
  | { outcome: "refuse-would-exceed-maximum"; wouldBeIn: number; maxIn: number }
  /** The click asked for exactly what is already there. */
  | { outcome: "no-change" };

/** Corner types, in both their flavours — never placeable, never deletable,
 * and never a legal insert position (a corner panel stays at the wall's own
 * end). */
function isCornerSlot(slot: PanelSlot): boolean {
  return slot.type === "corner" || slot.type === "safety-oct-corner";
}

function isStandardFamily(slot: PanelSlot): boolean {
  return slot.type === "standard" || slot.type === "braced";
}

/** A slot whose width the tiler still owns: standard/braced and not
 * hand-pinned. Same split `panelWidthEdit.ts` and `bracedPlacement.ts`
 * already use. */
function isFreeSlot(slot: PanelSlot): boolean {
  return isStandardFamily(slot) && slot.lockedWidthIn === undefined;
}

function sumEighths(slots: PanelSlot[]): number {
  return slots.reduce((sum, s) => sum + toEighths(s.widthIn), 0);
}

/**
 * The boundaries an insert may target, as indices into `slots` (insert
 * BEFORE this index). The run's own two ends are included, so a panel can be
 * placed hard against either corner; the corner slots themselves are not,
 * since a corner panel stays at the end of the wall it belongs to.
 *
 * `minIndex > maxIndex` means there is nowhere legal at all — a wall whose
 * corners merged (`resolveCorners`) is the real case.
 */
export function insertableBoundaryRange(slots: PanelSlot[]): { minIndex: number; maxIndex: number } {
  const minIndex = slots.length > 0 && isCornerSlot(slots[0]!) ? 1 : 0;
  const maxIndex = slots.length > 0 && isCornerSlot(slots[slots.length - 1]!) ? slots.length - 1 : slots.length;
  return { minIndex, maxIndex };
}

/**
 * Which automatic panels give up their slot when the free run has to lose
 * one, in the order they are taken.
 *
 * Two rules, in order:
 *
 * 1. **Never the corner-touching panel if there is any other choice.**
 *    `applyBracedPlacement`'s rule 1 puts a mandatory brace on whichever
 *    standard-family slot touches each corner; dropping that slot would
 *    quietly take a wall's corner brace with it. The first and last
 *    standard-family slots on the wall therefore sort last.
 * 2. **Otherwise nearest the edit.** A panel inserted between two others
 *    takes the place of the one it was put next to, which is what the
 *    gesture looks like it should do.
 *
 * Ties break toward the lower index so a given wall always resolves
 * identically — the same "arbitrary but FIXED" discipline
 * `distributeEighths`' own absorber rule follows.
 */
function pickFreeSlotsToDrop(slots: PanelSlot[], editIndex: number, count: number): Set<number> {
  const standardFamilyIndices = slots.map((s, i) => (isStandardFamily(s) ? i : -1)).filter((i) => i !== -1);
  const cornerTouching = new Set<number>(
    standardFamilyIndices.length > 0 ? [standardFamilyIndices[0]!, standardFamilyIndices[standardFamilyIndices.length - 1]!] : [],
  );
  const ranked = slots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => isFreeSlot(slot))
    .sort((a, b) => {
      // Never the panel the user just placed, unless there is nothing else
      // at all — deleting the thing the click asked for is never the answer.
      const edited = Number(a.index === editIndex) - Number(b.index === editIndex);
      if (edited !== 0) return edited;
      const corner = Number(cornerTouching.has(a.index)) - Number(cornerTouching.has(b.index));
      if (corner !== 0) return corner;
      const distance = Math.abs(a.index - editIndex) - Math.abs(b.index - editIndex);
      if (distance !== 0) return distance;
      return a.index - b.index;
    });
  return new Set(ranked.slice(0, Math.max(0, count)).map((entry) => entry.index));
}

/**
 * Re-tiles the free run of an already-structurally-edited wall so the wall
 * still adds up, or refuses and changes nothing.
 *
 * `before` is only read for its total — the length this wall must still be.
 * `after` is the slot array with the insert/replace/delete already applied
 * and widths not yet rebalanced. `editIndex` is where in `after` the edit
 * happened, used only to choose which automatic panel gives up its slot when
 * the run has to lose one.
 *
 * ### The count rule, stated once
 *
 * Let `B` be what is left for the free run (the wall total minus every fixed
 * width) and `n` the number of free slots the edit left standing. The run
 * keeps `n` slots when it legally can, because preserving the count is the
 * entire point of this module — but it may have to SHRINK:
 *
 *   `n' = min( max(n, ceil(B / maxIn)), floor(B / minIn) )`
 *
 * The lower bound stops a free panel exceeding the 48in ceiling; the upper
 * bound stops one falling under the 24in fabrication floor. `distributeEighths`
 * then makes every part either `floor(B/n')` or `ceil(B/n')`, so both bounds
 * hold for every panel rather than on average.
 *
 * **The count may shrink but never grow.** Growing it would mean answering a
 * request to have one fewer panel by inventing a new one, which is not an
 * answer — so that case is refused (`refuse-would-exceed-maximum`) and said
 * out loud.
 *
 * **`B` between zero and the minimum is refused**, not rounded away: a
 * leftover of, say, 11in has no legal home at all (no panel that narrow can
 * be built, and there is nothing to absorb it into without moving a corner
 * or an opening, which this module never does). `B === 0` exactly is fine —
 * the free run simply ends up empty, which is a wall made entirely of
 * hand-set panels and openings.
 */
export function redistributeFreeRun(
  before: PanelSlot[],
  after: PanelSlot[],
  editIndex: number,
  limits: FreeRunLimitsIn,
): PanelPlacementResult {
  const totalEighths = sumEighths(before);
  const fixedEighths = after.reduce((sum, s) => (isFreeSlot(s) ? sum : sum + toEighths(s.widthIn)), 0);
  const freeIndices = after.map((s, i) => (isFreeSlot(s) ? i : -1)).filter((i) => i !== -1);
  const freeCountBefore = before.filter(isFreeSlot).length;
  const freeBudgetBeforeEighths = before.reduce((sum, s) => (isFreeSlot(s) ? sum + toEighths(s.widthIn) : sum), 0);
  const budgetEighths = totalEighths - fixedEighths;
  const minEighths = toEighths(limits.minIn);
  const maxEighths = toEighths(limits.maxIn);

  const requestedIn = fromEighths(Math.max(0, freeBudgetBeforeEighths - budgetEighths));
  if (budgetEighths < 0 || (budgetEighths > 0 && budgetEighths < minEighths)) {
    return {
      outcome: "refuse-no-room",
      requestedIn,
      freeBudgetIn: fromEighths(freeBudgetBeforeEighths),
      minIn: limits.minIn,
    };
  }

  if (budgetEighths > 0 && freeIndices.length === 0) {
    return { outcome: "refuse-no-free-run", freedWidthIn: fromEighths(budgetEighths) };
  }

  let count = 0;
  if (budgetEighths > 0) {
    // The fewest slots that keep every automatic panel inside the ceiling,
    // and the most that keep every one of them above the floor.
    const atLeast = Math.ceil(budgetEighths / maxEighths);
    const atMost = Math.floor(budgetEighths / minEighths);
    if (atLeast > freeIndices.length) {
      // The run would have to GROW to stay legal — i.e. the only way to
      // honour this is to invent a panel, which is not an answer to a
      // request to have one fewer. Refused out loud.
      return {
        outcome: "refuse-would-exceed-maximum",
        wouldBeIn: fromEighths(Math.ceil(budgetEighths / freeIndices.length)),
        maxIn: limits.maxIn,
      };
    }
    if (atLeast > atMost) {
      // No legal count exists at all. Unreachable while the catalog's
      // ceiling stays exactly twice its floor (see `fabricationMinPanelWidthIn`
      // — the coupling `data.test.ts` asserts); kept as a real refusal
      // rather than an assumption, because that coupling is a coincidence
      // of two numbers and not a property of this algorithm.
      return { outcome: "refuse-no-room", requestedIn, freeBudgetIn: fromEighths(freeBudgetBeforeEighths), minIn: limits.minIn };
    }
    count = Math.min(freeIndices.length, atMost);
  }

  // Nothing actually has to move: the free run already holds exactly this
  // budget across exactly this many slots. Leave every automatic width
  // alone rather than flattening a run that was fine — a replace that
  // reserves the same width it inherited must not ripple across the wall.
  const currentFreeEighths = freeIndices.reduce((sum, i) => sum + toEighths(after[i]!.widthIn), 0);
  if (count === freeIndices.length && currentFreeEighths === budgetEighths) {
    return {
      outcome: "commit",
      slots: after.map((s) => ({ ...s })),
      selectedIndex: editIndex >= 0 && editIndex < after.length ? editIndex : -1,
      slotCountBefore: before.length,
      slotCountAfter: after.length,
      freeCountBefore,
      freeCountAfter: count,
    };
  }

  const dropped = count < freeIndices.length ? pickFreeSlotsToDrop(after, editIndex, freeIndices.length - count) : new Set<number>();
  const widthsEighths = distributeEighths(budgetEighths, count);
  let widthCursor = 0;
  const slots: PanelSlot[] = [];
  let selectedIndex = -1;
  after.forEach((slot, index) => {
    if (dropped.has(index)) return;
    if (index === editIndex) selectedIndex = slots.length;
    if (!isFreeSlot(slot)) {
      slots.push(slot);
      return;
    }
    slots.push({ ...slot, widthIn: fromEighths(widthsEighths[widthCursor++]!) });
  });

  return {
    outcome: "commit",
    slots,
    selectedIndex,
    slotCountBefore: before.length,
    slotCountAfter: slots.length,
    freeCountBefore,
    freeCountAfter: count,
  };
}

/** The new slot an insert/replace puts on the wall. A standard/braced panel
 * placed by hand is born PINNED (`lockedWidthIn`) — it is a width the user
 * chose, and the pin is what already survives an unrelated retile of this
 * wall (`reconcileBracedPlacement`). An opening is a reservation in its own
 * right and is not pinned; `lockedWidthIn` is only ever meaningful on a
 * standard/braced slot (see its own doc comment). */
function buildPlacedSlot(panel: PlacementPanel, widthIn: number, pinned: boolean): PanelSlot {
  const slot: PanelSlot = { type: panel.type, widthIn };
  if (panel.type === "braced") {
    slot.bracedPattern = panel.bracedPattern;
    slot.bracedMirrored = panel.bracedMirrored;
  }
  if (panel.heightIn !== undefined) slot.heightIn = panel.heightIn;
  if (panel.sillHeightIn !== undefined) slot.sillHeightIn = panel.sillHeightIn;
  if (panel.includeSillOnBigHeader !== undefined) slot.includeSillOnBigHeader = panel.includeSillOnBigHeader;
  if (pinned && isStandardFamily(slot)) slot.lockedWidthIn = widthIn;
  return slot;
}

/**
 * Puts a new panel between two existing ones (or hard against a corner).
 * `boundaryIndex` is the slot index the new panel takes; everything from
 * there rightward shifts one place.
 *
 * The new panel's width is reserved out of the free run and the free run
 * re-tiles smaller. **If the free run cannot cover it, the insert is refused
 * and the caller says how much room there is** — the wall is never
 * overflowed, and a corner or an opening is never shrunk to make space.
 */
export function resolvePanelInsert(
  slots: PanelSlot[],
  boundaryIndex: number,
  panel: PlacementPanel,
  limits: FreeRunLimitsIn,
): PanelPlacementResult {
  const { minIndex, maxIndex } = insertableBoundaryRange(slots);
  if (!Number.isInteger(boundaryIndex) || boundaryIndex < minIndex || boundaryIndex > maxIndex) {
    return { outcome: "refuse-not-placeable", reason: "out-of-range" };
  }
  const widthEighths = toEighths(panel.widthIn ?? 0);
  if (widthEighths <= 0) return { outcome: "refuse-not-placeable", reason: "out-of-range" };
  // A hand-placed standard/braced panel is a panel the shop has to build, so
  // it answers to the same [min, max] every other one does. An opening is
  // measured against its own catalog range by the caller instead (a Big
  // Header's 96in default is legal and is not a standard panel).
  if (
    (panel.type === "standard" || panel.type === "braced") &&
    (widthEighths < toEighths(limits.minIn) || widthEighths > toEighths(limits.maxIn))
  ) {
    return { outcome: "refuse-width-out-of-range", widthIn: fromEighths(widthEighths), minIn: limits.minIn, maxIn: limits.maxIn };
  }
  const placed = buildPlacedSlot(panel, fromEighths(widthEighths), true);
  const after = [...slots.slice(0, boundaryIndex), placed, ...slots.slice(boundaryIndex)];
  return redistributeFreeRun(slots, after, boundaryIndex, limits);
}

/**
 * Turns the panel at `slotIndex` into `panel`.
 *
 * Same split `handleToggleOpening` already routes the click-cycle through,
 * and deliberately so: a transition that does NOT change the slot's width
 * (standard <-> braced, or between the four braced styles) is an in-place
 * field mutation and nothing else on the wall moves at all; anything that
 * changes the reserved width goes through the free-run re-tile above.
 *
 * A width-changing replace carries the panel's current width unless `panel.
 * widthIn` says otherwise — a Column is always its own fixed width and a Big
 * Header its own default, exactly as the cycle already treats them.
 */
export function resolvePanelReplace(
  slots: PanelSlot[],
  slotIndex: number,
  panel: PlacementPanel,
  limits: FreeRunLimitsIn,
): PanelPlacementResult {
  const target = slots[slotIndex];
  if (!target) return { outcome: "refuse-not-placeable", reason: "out-of-range" };
  if (!isPlaceablePanelType(target.type)) return { outcome: "refuse-not-placeable", reason: "rule-placed-slot" };

  const keepsWidth = panel.widthIn === undefined || toEighths(panel.widthIn) === toEighths(target.widthIn);
  const bothStandardFamily = isStandardFamily(target) && (panel.type === "standard" || panel.type === "braced");
  const sameStyle =
    panel.type !== "braced" || (target.bracedPattern === panel.bracedPattern && target.bracedMirrored === panel.bracedMirrored);
  // Asking for exactly what is already there. Checked before anything else
  // so that re-placing a window over a window keeps that window's own
  // height and sill instead of rebuilding it at the type's defaults.
  if (target.type === panel.type && sameStyle && keepsWidth) return { outcome: "no-change" };

  if (bothStandardFamily && keepsWidth) {
    // In-place, width untouched — and the slot's own zones[0] stays mirrored
    // onto its top-level fields (`applyZonesToSlot`'s invariant), which a
    // plain spread would silently desync on a beam-split column.
    const nextZone = {
      ...(target.zones?.[0] ?? { type: target.type }),
      type: panel.type as PanelSlotType,
      bracedPattern: panel.type === "braced" ? panel.bracedPattern : undefined,
      bracedMirrored: panel.type === "braced" ? panel.bracedMirrored : undefined,
    };
    const mutated: PanelSlot = target.zones
      ? applyZonesToSlot(target, [nextZone, ...target.zones.slice(1)])
      : {
          ...target,
          type: panel.type,
          bracedPattern: panel.type === "braced" ? panel.bracedPattern : undefined,
          bracedMirrored: panel.type === "braced" ? panel.bracedMirrored : undefined,
        };
    const nextSlots = slots.map((s, i) => (i === slotIndex ? mutated : s));
    return {
      outcome: "commit",
      slots: nextSlots,
      selectedIndex: slotIndex,
      slotCountBefore: slots.length,
      slotCountAfter: nextSlots.length,
      freeCountBefore: slots.filter(isFreeSlot).length,
      freeCountAfter: nextSlots.filter(isFreeSlot).length,
    };
  }

  const widthIn = fromEighths(toEighths(panel.widthIn ?? target.widthIn));
  // A hand-placed replacement is pinned for the same reason an inserted one
  // is — it is a width the user chose. A replacement that inherits the
  // width already there is NOT pinned: nothing was chosen, and pinning it
  // would quietly take a panel out of the tiler's hands.
  const pinned = panel.widthIn !== undefined && toEighths(panel.widthIn) !== toEighths(target.widthIn);
  const placed = buildPlacedSlot(panel, widthIn, pinned);
  const after = slots.map((s, i) => (i === slotIndex ? placed : s));
  return redistributeFreeRun(slots, after, slotIndex, limits);
}

/**
 * Removes the panel at `slotIndex`; its width returns to the free run and
 * the wall re-tiles around the hole.
 *
 * The inverse of the insert, and the capability that lets a wall's panel
 * count come DOWN to match a drawing — deleting an opening has always been
 * expressible (cycle it back to standard), deleting a panel has not.
 *
 * Refused when there is nothing automatic left to give the width to, and
 * when giving it away would leave an automatic panel over the 48in maximum
 * (a wall can genuinely run out of ways to hold fewer panels).
 */
export function resolvePanelDelete(slots: PanelSlot[], slotIndex: number, limits: FreeRunLimitsIn): PanelPlacementResult {
  const target = slots[slotIndex];
  if (!target) return { outcome: "refuse-not-placeable", reason: "out-of-range" };
  if (!isPlaceablePanelType(target.type)) return { outcome: "refuse-not-placeable", reason: "rule-placed-slot" };
  const after = slots.filter((_, i) => i !== slotIndex);
  const result = redistributeFreeRun(slots, after, slotIndex, limits);
  // Nothing to select afterwards — the panel the click named is gone.
  return result.outcome === "commit" ? { ...result, selectedIndex: -1 } : result;
}
