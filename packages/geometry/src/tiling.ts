import type { PanelSlot, WallEnd } from "./types";

export interface TileWallResult {
  slots: PanelSlot[];
}

const MIN_GAP_PANEL_IN = 24; // 2ft — below this, borrow a standard panel and split 50/50 instead
// Nominal upper bound is 4ft, but since the remainder of dividing by
// standardWidthIn is always < standardWidthIn, that's only reachable if
// standardWidthIn itself exceeds 4ft — not enforced separately.

// Tommy: a safety/gap panel is only needed on walls longer than 12ft — a
// shorter run doesn't accumulate enough dimensional tolerance to matter.
const SAFETY_PANEL_MIN_WALL_LENGTH_IN = 144;

/**
 * The no-gap-panel path for walls at or under 12ft: however many standard
 * panels roughly fit, evenly resized to exactly fill the budget — no
 * dedicated safety-gap slot, no borrowed/resized outlier panel.
 */
function buildEvenMiddle(budgetLengthIn: number, standardWidthIn: number): PanelSlot[] {
  const count = Math.max(1, Math.round(budgetLengthIn / standardWidthIn));
  const widthEachIn = budgetLengthIn / count;
  return Array.from({ length: count }, () => ({ type: "standard" as const, widthIn: widthEachIn }));
}

interface PlainSizing {
  standardCount: number;
  gapWidthIn: number;
  resizedStandardWidthIn: number;
}

/**
 * Core arithmetic shared by `tileWall` and `retileWithOpenings`: given a
 * budget length (already excluding corners and any opening reservations),
 * how many standard panels fit and how wide the gap/resized panels end up
 * being. See `tileWall`'s doc comment for the sizing rules.
 *
 * `allowBorrow` (default true) gates the under-2ft borrow-and-split branch
 * below — octagon walls don't use it at all (Tommy: "no standard-safety
 * panels for octagons"), so the gap panel just absorbs whatever's left,
 * even under 2ft.
 */
function computePlainSizing(
  budgetLengthIn: number,
  standardWidthIn: number,
  allowBorrow = true,
): PlainSizing {
  const rawStandardCount = Math.max(0, Math.floor(budgetLengthIn / standardWidthIn));
  const remainderIn = budgetLengthIn - rawStandardCount * standardWidthIn;

  let standardCount = rawStandardCount;
  let gapWidthIn: number;
  let resizedStandardWidthIn = standardWidthIn;

  if (rawStandardCount < 2 && remainderIn < MIN_GAP_PANEL_IN) {
    // nothing to borrow from — the gap panel just takes whatever's left
    standardCount = 0;
    gapWidthIn = budgetLengthIn;
  } else if (remainderIn >= MIN_GAP_PANEL_IN || !allowBorrow) {
    gapWidthIn = remainderIn;
  } else {
    // Keep the same standard-panel COUNT (rawStandardCount) — resizing one
    // of them down to half of (its own width + the remainder) is what frees
    // up the other half for the gap panel, not a separate deduction.
    const combinedIn = remainderIn + standardWidthIn;
    gapWidthIn = combinedIn / 2;
    resizedStandardWidthIn = combinedIn / 2;
  }

  return { standardCount, gapWidthIn, resizedStandardWidthIn };
}

/**
 * Builds the plain standard+gap sequence (no corners, no openings) from a
 * sizing result: gap panel one slot in from whichever end `gapEnd`
 * designates, with a full-width standard panel between it and the corner,
 * and plain standards filling the rest.
 *
 * The resized (borrowed) panel — when `resizedStandardWidthIn` differs from
 * `standardWidthIn` — is tucked in next to the gap panel instead, never at
 * the corner-touching position: rule 1 in `applyBracedPlacement` always
 * braces whichever standard panel touches each corner, and Tommy wants the
 * borrowed panel to never be the one that ends up braced.
 */
function buildPlainMiddle(sizing: PlainSizing, standardWidthIn: number, gapEnd: WallEnd): PanelSlot[] {
  const { standardCount, gapWidthIn, resizedStandardWidthIn } = sizing;
  const gap: PanelSlot = { type: "safety-gap", widthIn: gapWidthIn };
  const plainStandard = (): PanelSlot => ({ type: "standard", widthIn: standardWidthIn });
  const cornerTouching: PanelSlot = plainStandard(); // always full width — rule 1 always braces this one

  if (standardCount === 0) {
    return [gap];
  }
  if (standardCount === 1) {
    // Only 1 standard total — there's no position that isn't corner-
    // adjacent, so the resize (if any) has nowhere safe to go.
    const only: PanelSlot = { type: "standard", widthIn: resizedStandardWidthIn };
    return gapEnd === "start" ? [only, gap] : [gap, only];
  }

  const resized: PanelSlot = { type: "standard", widthIn: resizedStandardWidthIn };
  const others = Array.from({ length: standardCount - 2 }, plainStandard);
  // Placing `resized` adjacent to the gap (farthest from both corners, since
  // each corner-touching walk in applyBracedPlacement stops at the very
  // first standard slot it finds) keeps it out of either corner's brace.
  const plainStandards = gapEnd === "start" ? [resized, ...others] : [...others, resized];
  return gapEnd === "start" ? [cornerTouching, gap, ...plainStandards] : [...plainStandards, gap, cornerTouching];
}

/**
 * Dispatches between the gap-panel middle (walls over 12ft) and the
 * even-standards middle (12ft or under, no safety panel needed at all —
 * Tommy: "safety panels only needed for walls more than 12' long").
 */
function buildMiddle(
  budgetLengthIn: number,
  standardWidthIn: number,
  gapEnd: WallEnd,
  allowBorrow: boolean,
  needsSafetyPanel: boolean,
): PanelSlot[] {
  if (!needsSafetyPanel) {
    return buildEvenMiddle(budgetLengthIn, standardWidthIn);
  }
  const sizing = computePlainSizing(budgetLengthIn, standardWidthIn, allowBorrow);
  return buildPlainMiddle(sizing, standardWidthIn, gapEnd);
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
 * The safety/gap panel's width is derived from whatever's actually left
 * over after fitting as many standard panels as possible (Tommy), not a
 * fixed width — this is the panel's whole purpose (dimensional tolerance
 * absorption), so there's no unaccounted slack by construction:
 * - Leftover in [2ft, 4ft): the gap panel is exactly that leftover width.
 * - Leftover < 2ft (and `allowBorrow`, the default): too small on its own,
 *   so one standard panel is "un-placed" and its width combined with the
 *   leftover, then split evenly between the gap panel and that borrowed
 *   standard panel — placed next to the gap, never at either corner-
 *   touching position (Tommy: the borrowed panel must not be the one that
 *   rule 1 in `applyBracedPlacement` braces for touching the corner).
 * - Too short to borrow a standard panel from at all (0 or 1 fit): gap
 *   panel absorbs the whole remaining length, standards degrade to 0 (no
 *   corner-touching brace possible at that end either, at that point).
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
 * `allowBorrow` (default true) disables the whole borrow-and-split branch
 * above when false — octagon walls don't do it at all (Tommy: "no
 * standard-safety panels for octagons"), so the gap panel just takes
 * whatever's left over, even under 2ft.
 *
 * Regardless of `allowBorrow`, a wall at or under 12ft skips the gap panel
 * entirely (Tommy: "safety panels only needed for walls more than 12'
 * long") — see `buildMiddle`/`buildEvenMiddle`.
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
  const fixedEndsIn = (hasCornerStart ? cornerWidthIn : 0) + (hasCornerEnd ? cornerWidthIn : 0);
  // Clamped at 0: a wall shorter than its own fixed corner allocations (e.g.
  // a bump-out's perpendicular jog, whose length is just the bump-out's
  // depth) would otherwise hand computePlainSizing a negative budget and
  // produce a negative-width gap panel.
  const middleLengthIn = Math.max(0, wallLengthIn - fixedEndsIn);
  const needsSafetyPanel = wallLengthIn > SAFETY_PANEL_MIN_WALL_LENGTH_IN;
  const middle = buildMiddle(middleLengthIn, standardWidthIn, gapEnd, allowBorrow, needsSafetyPanel);

  const cornerStart: PanelSlot = { type: "corner", widthIn: cornerWidthIn };
  const cornerEnd: PanelSlot = { type: "corner", widthIn: cornerWidthIn };
  return {
    slots: [...(hasCornerStart ? [cornerStart] : []), ...middle, ...(hasCornerEnd ? [cornerEnd] : [])],
  };
}

export interface OpeningAnchor {
  /** How many 'standard'-type slots (including corner-touching ones) precede this opening in the plain sequence. */
  beforeStandardCount: number;
  type: "window" | "door";
  widthIn: number;
}

/**
 * Reads each window/door's position out of an existing (tiled) slots array,
 * as "how many standard slots come before it" — the anchor used to put it
 * back in roughly the same place after a re-tile.
 */
export function getOpeningAnchors(slots: PanelSlot[]): OpeningAnchor[] {
  const anchors: OpeningAnchor[] = [];
  let standardsSeen = 0;
  for (const slot of slots) {
    if (slot.type === "window" || slot.type === "door") {
      anchors.push({ beforeStandardCount: standardsSeen, type: slot.type, widthIn: slot.widthIn });
    } else if (slot.type === "standard") {
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
  const fixedEndsIn = (hasCornerStart ? cornerWidthIn : 0) + (hasCornerEnd ? cornerWidthIn : 0);
  const middleLengthIn = wallLengthIn - fixedEndsIn;
  const openingsTotalWidthIn = openings.reduce((sum, o) => sum + o.widthIn, 0);
  const plainBudgetIn = middleLengthIn - openingsTotalWidthIn;
  const needsSafetyPanel = wallLengthIn > SAFETY_PANEL_MIN_WALL_LENGTH_IN;
  const plainMiddle = buildMiddle(Math.max(0, plainBudgetIn), standardWidthIn, gapEnd, allowBorrow, needsSafetyPanel);

  const sortedOpenings = [...openings].sort((a, b) => a.beforeStandardCount - b.beforeStandardCount);
  const middle: PanelSlot[] = [];
  let standardsSeen = 0;
  let openingIdx = 0;
  for (const slot of plainMiddle) {
    while (openingIdx < sortedOpenings.length && sortedOpenings[openingIdx]!.beforeStandardCount <= standardsSeen) {
      const o = sortedOpenings[openingIdx]!;
      middle.push({ type: o.type, widthIn: o.widthIn });
      openingIdx++;
    }
    middle.push(slot);
    if (slot.type === "standard") standardsSeen++;
  }
  while (openingIdx < sortedOpenings.length) {
    const o = sortedOpenings[openingIdx]!;
    middle.push({ type: o.type, widthIn: o.widthIn });
    openingIdx++;
  }

  const cornerStart: PanelSlot = { type: "corner", widthIn: cornerWidthIn };
  const cornerEnd: PanelSlot = { type: "corner", widthIn: cornerWidthIn };
  return {
    slots: [...(hasCornerStart ? [cornerStart] : []), ...middle, ...(hasCornerEnd ? [cornerEnd] : [])],
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

const OPENING_CYCLE: Record<string, PanelSlot["type"]> = {
  standard: "window",
  window: "door",
  door: "standard",
};

/** Cycles a standard/window/door slot: standard -> window -> door -> standard. Corner and safety-gap slots are left untouched. */
export function toggleOpening(slots: PanelSlot[], index: number): PanelSlot[] {
  const slot = slots[index];
  if (!slot || !(slot.type in OPENING_CYCLE)) {
    return slots;
  }
  const nextType = OPENING_CYCLE[slot.type]!;
  return slots.map((s, i) => (i === index ? { ...s, type: nextType } : s));
}
