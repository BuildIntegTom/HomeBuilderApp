import type { PanelSlot, WallEnd } from "./types";

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
 * how many standard panels fit and how wide the one next to the gap ends
 * up being. See `tileWall`'s doc comment for the sizing rules.
 *
 * The gap panel itself is always exactly `SAFETY_GAP_WIDTH_IN` — everything
 * else in the budget goes to standard panels, with the single one next to
 * the gap "resized" to absorb whatever's left over past a whole number of
 * standard widths, so the tiled total always adds up exactly and the gap
 * sits flush against both of its neighbors. (Previously the *gap itself*
 * absorbed that leftover — sizing its own slot to whatever remained, 2 to
 * 4ft typically — while the panel-catalog's actual 3D member for it is
 * only 3/4in wide, leaving a wide unrendered gap around the real board;
 * see `SAFETY_GAP_WIDTH_IN`'s comment.)
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
  const availableForStandardsIn = Math.max(0, budgetLengthIn - SAFETY_GAP_WIDTH_IN);
  const rawStandardCount = Math.max(0, Math.floor(availableForStandardsIn / standardWidthIn));
  const remainderIn = availableForStandardsIn - rawStandardCount * standardWidthIn;

  let standardCount = rawStandardCount;
  let resizedStandardWidthIn = standardWidthIn;

  if (rawStandardCount === 0) {
    // Not even one full standard panel fits alongside the gap — the whole
    // leftover becomes a single resized standard panel (0 if there's none).
    standardCount = availableForStandardsIn > 0 ? 1 : 0;
    resizedStandardWidthIn = availableForStandardsIn;
  } else if (remainderIn > 0) {
    resizedStandardWidthIn = standardWidthIn + remainderIn;
  }

  return { standardCount, gapWidthIn: SAFETY_GAP_WIDTH_IN, resizedStandardWidthIn };
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
  if (!needsSafetyPanel) {
    return buildEvenMiddle(budgetLengthIn, standardWidthIn);
  }
  const sizing = computePlainSizing(budgetLengthIn, standardWidthIn, allowBorrow);
  return buildPlainMiddle(sizing, standardWidthIn, gapEnd);
}

interface ResolvedCorners {
  /** Set only when the wall owns corners at both ends but is too short to
   * fit them without overlap — see the doc comment below. When set, this
   * is the wall's *only* content: no middle, no openings. */
  merged: PanelSlot | null;
  cornerStart: PanelSlot | null;
  cornerEnd: PanelSlot | null;
  fixedEndsIn: number;
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
 */
function resolveCorners(
  wallLengthIn: number,
  cornerWidthIn: number,
  hasCornerStart: boolean,
  hasCornerEnd: boolean,
): ResolvedCorners {
  const fixedEndsIn = (hasCornerStart ? cornerWidthIn : 0) + (hasCornerEnd ? cornerWidthIn : 0);
  if (hasCornerStart && hasCornerEnd && wallLengthIn < fixedEndsIn) {
    return { merged: { type: "corner", widthIn: Math.max(0, wallLengthIn) }, cornerStart: null, cornerEnd: null, fixedEndsIn };
  }
  return {
    merged: null,
    cornerStart: hasCornerStart ? { type: "corner", widthIn: Math.min(cornerWidthIn, wallLengthIn) } : null,
    cornerEnd: hasCornerEnd ? { type: "corner", widthIn: Math.min(cornerWidthIn, wallLengthIn) } : null,
    fixedEndsIn,
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
 * the wall's whole length instead — see `resolveCorners`.
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
  const corners = resolveCorners(wallLengthIn, cornerWidthIn, hasCornerStart, hasCornerEnd);
  if (corners.merged) {
    return { slots: [corners.merged] };
  }

  const middleLengthIn = Math.max(0, wallLengthIn - corners.fixedEndsIn);
  const needsSafetyPanel = wallLengthIn > SAFETY_PANEL_MIN_WALL_LENGTH_IN;
  const middle = buildMiddle(middleLengthIn, standardWidthIn, gapEnd, allowBorrow, needsSafetyPanel);

  return {
    slots: [...(corners.cornerStart ? [corners.cornerStart] : []), ...middle, ...(corners.cornerEnd ? [corners.cornerEnd] : [])],
  };
}

export interface OpeningAnchor {
  /** How many 'standard'-type slots (including corner-touching ones) precede this opening in the plain sequence. */
  beforeStandardCount: number;
  type: "window" | "door" | "column";
  widthIn: number;
}

/**
 * Reads each window/door/column's position out of an existing (tiled)
 * slots array, as "how many standard slots come before it" — the anchor
 * used to put it back in roughly the same place after a re-tile. A Column
 * Panel is a fixed-width structural swap-in (not an opening), but shares
 * the same "reserve this width at this position" mechanism.
 */
export function getOpeningAnchors(slots: PanelSlot[]): OpeningAnchor[] {
  const anchors: OpeningAnchor[] = [];
  let standardsSeen = 0;
  for (const slot of slots) {
    if (slot.type === "window" || slot.type === "door" || slot.type === "column") {
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
 *
 * If the wall owns corners at both ends but is too short to fit them
 * without overlapping, they're merged into a single corner panel spanning
 * the wall's whole length instead (dropping any openings — there's no room
 * for them either at that point) — see `resolveCorners` in `tileWall`'s
 * doc comment.
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
  const corners = resolveCorners(wallLengthIn, cornerWidthIn, hasCornerStart, hasCornerEnd);
  if (corners.merged) {
    return { slots: [corners.merged] };
  }

  const middleLengthIn = wallLengthIn - corners.fixedEndsIn;
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
