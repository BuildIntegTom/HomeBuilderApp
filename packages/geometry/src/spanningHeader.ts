import { fromEighths, toEighths } from "./eighths";
import type { SlotIndexRange } from "./panelPlacement";
import type { PanelSlot } from "./types";

/**
 * Project Smearforn Stage 2b — the spanning ("triple") header.
 *
 * ### What this is, verified rather than assumed
 *
 * From Tommy's own cut list for the Rogers-Sehorn ADU: `E4A` is a header
 * spanning the two panels beneath it. `E4B` is 3'5½" wide, `E4C` is 3'0",
 * and **3'5½" + 3'0" = 6'5½"**, which is exactly `E4A`'s own span. So `A` is
 * not a sibling of `B` and `C` — **A sits on top of them.** An earlier draft
 * of the plan read the three letters as three adjacent Big Header slots,
 * which would have produced a wall 6'5½" too long; the guess was plausible
 * and wrong, which is why it is written down here as well as in the spec.
 *
 * Confirmed by Tommy 2026-09-24 (*"Yes, that's what it is"*): a spanning
 * header is a **wall-level record over a slot-index range** — structurally
 * the same object as a Mid-Wall Bond Beam, which already carries a slot-index
 * coverage range (`BoxBeamCoverage`) and already shortens every covered
 * slot's panels through `computeWallVerticalBandsForSlot`. The one difference
 * is what occupies the band: a real **header panel** with its own width (the
 * span), its own weight and its own fabrication sheet — not a beam.
 *
 * ### Why the ends always land on a panel edge
 *
 * The range is slot INDICES, never raw inches — the same choice
 * `BoxBeamCoverage` makes and for the same reason. "A span whose ends do not
 * align with slot boundaries" is therefore not a case that has to be refused
 * or snapped: it cannot be expressed. The span's WIDTH is derived (the sum of
 * the covered slots' widths), so it follows those panels whenever they are
 * re-tiled, rather than being a second copy of the same number that can drift.
 *
 * ### The span adds NO width to the wall
 *
 * A spanning header sits ABOVE the run; it is not a member of it. The wall's
 * own invariant — `Σ slot widths === wallGeometryFor(...).lengthIn` — is
 * untouched by every function in this file, none of which returns slots at
 * all. That is the single most important property of this model and it is
 * asserted directly in the tests.
 *
 * ### Naming lives elsewhere, and deliberately
 *
 * A spanning header is named from a **separate building-wide series `H1`,
 * `H2`, `H3` carrying no direction letter** (Tommy, 2026-09-24, on the
 * grounds that his shop's stencil rack would otherwise need eight more
 * prefixes). That walk needs a `Footprint` and the app's own story model, so
 * it lives in `apps/web/app/spanningHeader.ts`; this module owns only the
 * arithmetic.
 */

/**
 * One spanning header's own geometry, pre-resolved by the caller — the same
 * split `MidWallBeamGeometry` already makes, and structurally identical to
 * it, so a spanning header drops straight into
 * `computeWallVerticalBandsForSlot`/`computeWallVerticalBandsForSlotWithMaxHeight`
 * beside the beams with no adapter and no change to that function at all.
 */
export interface SpanningHeaderGeometry extends SlotIndexRange {
  /** Height of the header's own bottom face above this story's floor. The
   * panels beneath are shortened to exactly this height by the band
   * machinery. */
  heightIn: number;
  /** The header's own assembly height — its real fabricated height. */
  assemblyHeightIn: number;
}

/** Why a spanning header cannot be placed as asked. Mapped to a sentence by
 * the caller, so no user-facing copy lives in `packages/geometry` (the same
 * rule `panelPlacement.ts` follows). */
export type SpanningHeaderRefusalReason =
  /** The range is not a real, in-bounds, ascending slot range on this wall. */
  | "out-of-range"
  /** A one-slot span. A header above ONE panel is already expressible as a
   * zone within that column (`PanelSlot.zones` splits a column vertically);
   * this record exists for the case that column-local zones cannot express,
   * which is a header above TWO OR MORE columns. Refused rather than
   * silently duplicated. */
  | "single-slot-span"
  /** Two spanning headers cannot cover the same panel. Their bands would
   * stack in an order nobody chose, and "which header is above E4" would
   * stop having one answer. */
  | "overlaps-existing"
  /** The span is outside what the shop builds a header at. See
   * `SpanningHeaderLimitsIn` — the numbers come from the catalog's
   * `bigHeaderWidthInRange`, which is `pending-BI-confirmation` and is NOT
   * widened to fit a drawing. */
  | "span-out-of-range"
  /** The header is taller than the story it sits in, or its own height is
   * not a real positive number. */
  | "taller-than-story";

/**
 * The bounds a spanning header answers to, passed in rather than imported —
 * `packages/geometry` has no dependency on `packages/panel-catalog`, the same
 * reason `panelWidthEdit.ts` and `panelPlacement.ts` take theirs as
 * parameters.
 *
 * **These are `bigHeaderWidthInRange`/`bigHeaderHeightInRange`, both
 * `pending-BI-confirmation`** ("Tommy's own stated range — not mfr-sourced").
 * The ADU's 6'5½" span sits comfortably inside the width range. **If a later
 * job spans past 12ft, the range does not get widened to fit the drawing** —
 * the placement is refused and the number is reported.
 */
export interface SpanningHeaderLimitsIn {
  minSpanIn: number;
  maxSpanIn: number;
  minHeightIn: number;
  maxHeightIn: number;
}

export type SpanningHeaderPlacementResult =
  | {
      outcome: "ok";
      /** The sum of the covered slots' own widths, in inches on the 1/8in
       * grid. This is the header's fabricated width. */
      spanWidthIn: number;
      /** How many panels this header sits on. Always >= 2. */
      coveredSlotCount: number;
    }
  | { outcome: "refuse"; reason: "out-of-range" }
  | { outcome: "refuse"; reason: "single-slot-span" }
  | { outcome: "refuse"; reason: "overlaps-existing" }
  | { outcome: "refuse"; reason: "span-out-of-range"; spanWidthIn: number; minIn: number; maxIn: number }
  | { outcome: "refuse"; reason: "taller-than-story"; headerTopIn: number; storyHeightIn: number };

/**
 * The sum of the covered slots' widths — the header's own fabricated width.
 *
 * Summed as integer eighths and converted back once, so a span over panels
 * of 41.5in and 36in is exactly 77.5in rather than 77.49999999999999. Slots
 * outside the array are simply not counted: a range that has fallen off the
 * end of a shortened wall reports the width of what is actually there, and
 * the caller (`resolveSpanningHeaderPlacement`, or the wall-run-stop check in
 * the app) decides what to do about it.
 */
export function spanningHeaderSpanWidthIn(slots: PanelSlot[], range: SlotIndexRange): number {
  const start = Math.max(0, Math.min(range.startSlotIndex, slots.length));
  const end = Math.max(start, Math.min(range.endSlotIndex, slots.length));
  let eighths = 0;
  for (let i = start; i < end; i++) eighths += toEighths(slots[i]!.widthIn);
  return fromEighths(eighths);
}

/** How many real slots of this wall a range actually covers right now. Less
 * than `endSlotIndex - startSlotIndex` once a wall has lost panels under it. */
export function spanningHeaderCoveredSlotCount(slots: PanelSlot[], range: SlotIndexRange): number {
  const start = Math.max(0, Math.min(range.startSlotIndex, slots.length));
  const end = Math.max(start, Math.min(range.endSlotIndex, slots.length));
  return end - start;
}

/** True when two half-open slot ranges share at least one slot. */
export function slotRangesOverlap(a: SlotIndexRange, b: SlotIndexRange): boolean {
  return a.startSlotIndex < b.endSlotIndex && b.startSlotIndex < a.endSlotIndex;
}

/**
 * Whether a span that ALREADY EXISTS is still a width the shop builds.
 *
 * ### Why this is separate from `resolveSpanningHeaderPlacement`
 *
 * That function answers "may this be placed", at the point of edit, and
 * refuses. This one answers "is what is stored still buildable", at any time,
 * and only reports — because by the time it can say no, the record is already
 * there and refusing it would mean either deleting a part off a shop sheet or
 * refusing to open a file.
 *
 * **It is needed because a header's width is DERIVED, and three separate paths
 * change the panels under it without asking anybody:**
 *
 * - the insert/delete shift (`shiftSlotCoverageRecords`), which moves a range
 *   but never re-checks the span it now measures;
 * - any path that RE-TILES a wall — a wall-length edit, a panelization
 *   switch, a corner-band change that turns one middle panel into two corner
 *   panels — which leaves the stored range pointing at a different set of
 *   panels entirely;
 * - a file written by a version whose limits differed.
 *
 * Because the answer is computed from the CURRENT slots and the stored range,
 * and not from whatever edit caused the change, it covers all three without
 * knowing about any of them. That is the whole design requirement: a route
 * nobody has written yet still gets flagged.
 *
 * `minIn`/`maxIn` are `bigHeaderWidthInRange`, **pending BI confirmation** —
 * a span outside it is REPORTED, never accommodated by widening the range and
 * never silently corrected.
 */
export function spanningHeaderSpanOutOfRange(
  slots: PanelSlot[],
  range: SlotIndexRange,
  limits: Pick<SpanningHeaderLimitsIn, "minSpanIn" | "maxSpanIn">,
): { spanWidthIn: number; minIn: number; maxIn: number } | null {
  const spanWidthIn = spanningHeaderSpanWidthIn(slots, range);
  const spanEighths = toEighths(spanWidthIn);
  if (spanEighths >= toEighths(limits.minSpanIn) && spanEighths <= toEighths(limits.maxSpanIn)) return null;
  return { spanWidthIn, minIn: limits.minSpanIn, maxIn: limits.maxSpanIn };
}

/** One covered panel whose own opening no longer fits underneath the header.
 * `openingTopIn` and `bandHeightIn` are both measured from this story's own
 * floor, so the two are directly comparable. */
export interface SpanningHeaderOpeningConflict {
  slotIndex: number;
  /** Which kind of opening it is — the discriminant, so no caller has to read
   * a sentence back to find out. */
  openingType: "window" | "door";
  /** Top of that opening's rough opening above the floor. */
  openingTopIn: number;
  /** The height the panel beneath the header is actually built to — the
   * header's own bottom face. */
  bandHeightIn: number;
}

/**
 * Covered panels whose own rough opening does not fit in the band the header
 * leaves beneath it.
 *
 * ### Why this reports rather than refuses
 *
 * Asked whether a header may span a window or door and bear on a corner
 * panel, Tommy answered **"allow both."** So the combination is permitted,
 * and this function exists for the one part of it that is not automatically
 * fine.
 *
 * A header shortens every panel beneath it to `bandHeightIn` (that is
 * `computeWallVerticalBandsForSlot`'s job and it is unchanged). The window in
 * such a panel keeps the sill height and rough-opening height it already had,
 * which are measured from the FLOOR and know nothing about the header. Put
 * the header low enough and the opening's top reaches — or passes — the top
 * of the panel it is now in: the window's own header collapses to zero
 * height, an opening filling its whole panel. Nothing crashes
 * (`computeHeaderHeightIn` clamps at 0), and nothing says anything, which is
 * the actual defect.
 *
 * **The vertical refusal cannot catch this**: it checks the header's top
 * against the story and its own assembly height against
 * `bigHeaderHeightInRange`, both of which are about the header. And the sill
 * clamp cannot either — it clamps against the WALL's height, not against a
 * band a header may later put beneath it.
 *
 * Only `zones[0]`-level fields are read, i.e. this slot's own top-level
 * type/sill/height, which the zone machinery keeps mirrored onto the
 * BOTTOM-most zone — and the bottom-most zone is exactly the one a header
 * shortens from above. Openings' own default heights are passed in, since
 * they are catalog values and this package does not read the catalog.
 */
export function spanningHeaderOpeningConflicts(
  slots: PanelSlot[],
  range: SlotIndexRange,
  bandHeightIn: number,
  defaultsIn: {
    /** `sillDefaultHeightIn` — a window slot with no sill of its own. */
    windowSillHeightIn: number;
    /** `standardWindowHeightDefaultIn` — a window slot with no RO height of its own. */
    windowHeightIn: number;
    /** `computeDoorRoughOpeningHeightIn(...)` — a door's RO is never per-slot. */
    doorRoughOpeningHeightIn: number;
  },
): SpanningHeaderOpeningConflict[] {
  const start = Math.max(0, Math.min(range.startSlotIndex, slots.length));
  const end = Math.max(start, Math.min(range.endSlotIndex, slots.length));
  const conflicts: SpanningHeaderOpeningConflict[] = [];
  for (let i = start; i < end; i++) {
    const slot = slots[i]!;
    const openingType = slot.type === "window" ? "window" : slot.type === "door" ? "door" : null;
    if (openingType === null) continue;
    const openingTopIn =
      openingType === "door"
        ? defaultsIn.doorRoughOpeningHeightIn
        : (slot.sillHeightIn ?? defaultsIn.windowSillHeightIn) + (slot.heightIn ?? defaultsIn.windowHeightIn);
    if (toEighths(openingTopIn) <= toEighths(bandHeightIn)) continue;
    conflicts.push({ slotIndex: i, openingType, openingTopIn, bandHeightIn });
  }
  return conflicts;
}

/**
 * Whether this wall will take a spanning header over this range, and — when
 * it will — what the header's own fabricated width is.
 *
 * Checked at the point of EDIT, never at load: a stored file is always
 * readable, exactly the rule Stage 3's own refusal follows and for the same
 * reason (a project that will not open is worse than a project with a flagged
 * part in it).
 */
export function resolveSpanningHeaderPlacement(
  slots: PanelSlot[],
  range: SlotIndexRange,
  existing: SlotIndexRange[],
  limits: SpanningHeaderLimitsIn,
  /** The header's own bottom-face height and assembly height, checked against
   * the story so a header cannot be committed sticking out through the top
   * plate. Omit to skip the vertical check (the horizontal range is the only
   * thing some callers are asking about). */
  vertical?: { heightIn: number; assemblyHeightIn: number; storyHeightIn: number },
): SpanningHeaderPlacementResult {
  const { startSlotIndex, endSlotIndex } = range;
  if (
    !Number.isInteger(startSlotIndex) ||
    !Number.isInteger(endSlotIndex) ||
    startSlotIndex < 0 ||
    endSlotIndex > slots.length ||
    endSlotIndex <= startSlotIndex
  ) {
    return { outcome: "refuse", reason: "out-of-range" };
  }
  if (endSlotIndex - startSlotIndex < 2) return { outcome: "refuse", reason: "single-slot-span" };
  if (existing.some((other) => slotRangesOverlap(range, other))) return { outcome: "refuse", reason: "overlaps-existing" };

  const spanWidthIn = spanningHeaderSpanWidthIn(slots, range);
  const spanEighths = toEighths(spanWidthIn);
  if (spanEighths < toEighths(limits.minSpanIn) || spanEighths > toEighths(limits.maxSpanIn)) {
    return { outcome: "refuse", reason: "span-out-of-range", spanWidthIn, minIn: limits.minSpanIn, maxIn: limits.maxSpanIn };
  }

  if (vertical) {
    const { heightIn, assemblyHeightIn, storyHeightIn } = vertical;
    const headerTopIn = heightIn + assemblyHeightIn;
    if (
      !(assemblyHeightIn > 0) ||
      heightIn < 0 ||
      toEighths(headerTopIn) > toEighths(storyHeightIn) ||
      toEighths(assemblyHeightIn) < toEighths(limits.minHeightIn) ||
      toEighths(assemblyHeightIn) > toEighths(limits.maxHeightIn)
    ) {
      return { outcome: "refuse", reason: "taller-than-story", headerTopIn, storyHeightIn };
    }
  }

  return { outcome: "ok", spanWidthIn, coveredSlotCount: endSlotIndex - startSlotIndex };
}

/**
 * Where a header sits when nothing else says otherwise: hard against the top
 * of the story, so the panels beneath it are shortened from the top down —
 * which is what a header IS. The caller can move it afterwards; this is the
 * birth position, not a rule.
 *
 * Clamped at 0 so a story shorter than the header itself yields a bottom face
 * on the floor rather than a negative height — that configuration is refused
 * by `resolveSpanningHeaderPlacement`'s vertical check, and this function is
 * not the place to decide it.
 */
export function defaultSpanningHeaderBottomHeightIn(storyHeightIn: number, assemblyHeightIn: number): number {
  return fromEighths(Math.max(0, toEighths(storyHeightIn) - toEighths(assemblyHeightIn)));
}
