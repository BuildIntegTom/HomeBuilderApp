import { fromEighths, roundToEighthIn, toEighths } from "./eighths";
import type { PanelSlot } from "./types";

/**
 * Hand-set panel widths — the arithmetic behind Smearforn Stage 1 (Tommy:
 * "We need a way to manipulate the widths of individual panels... click the
 * numerical value of width of one panel... so you can type in a new value.
 * And/or also a tool should allow the user to click and drag a wall to
 * shrink one and grow another").
 *
 * Three pure functions, kept here rather than in page.tsx/
 * WallElevationDiagram.tsx so the rules are testable without a browser:
 *
 * 1. `resolvePanelWidthEdit` — what a TYPED width commits to, or why it is
 *    refused.
 * 2. `resolvePanelBoundaryDrag` — where a DRAGGED panel boundary lands, now
 *    snapped to the 1/8in grid like every other dimension in the app.
 * 3. `findSubMinimumPanelWidths` — every panel already below the shop's
 *    minimum, however it got there, for the Review Log.
 *
 * **The minimum itself is not defined here.** It is a real building value
 * with Building Integrity as its source, so it lives in
 * `packages/panel-catalog` as `fabricationMinPanelWidthIn` (24in, confirmed)
 * and is passed in. This package has zero package dependencies, and that is
 * worth more than the convenience of reaching for the constant directly.
 *
 * **Limits bind at the point of EDIT, never at LOAD.** Nothing in here runs
 * on a file being opened. A stored design containing a 20in panel opens,
 * draws, prices and prints exactly as before and is *reported* by
 * `findSubMinimumPanelWidths`; it is never rewritten, and the wall it sits
 * on is never refused.
 */

/** Slots whose width the plain tiler is free to move, and the only ones a
 * user may pin a width on — same split `eighths.ts` and
 * `bracedPlacement.ts` already use. */
function isAdjustablePanel(slot: PanelSlot): boolean {
  return slot.type === "standard" || slot.type === "braced";
}

/** A slot whose width the free run can still give up or absorb: adjustable,
 * and not already pinned by a hand edit of its own. */
function isFreePanel(slot: PanelSlot): boolean {
  return isAdjustablePanel(slot) && slot.lockedWidthIn === undefined;
}

export interface PanelWidthLimitsIn {
  /** Building Integrity's fabrication minimum — `fabricationMinPanelWidthIn`.
   * A typed width below this is REFUSED, not clamped: the shop cannot build
   * it, and that is not a thing to negotiate at the keyboard. */
  minIn: number;
  /** `panelWidthInRange.maxIn` (48in). Above this the entry is CLAMPED and
   * said so, which is the existing house pattern for a ceiling. */
  maxIn: number;
}

export type PanelWidthEditResult =
  /** Commit `widthIn` as both `widthIn` and `lockedWidthIn`, then re-tile the
   * wall. `clampedFromIn` is non-null when the typed value was above the
   * maximum and was reduced — the caller shows its clamp notice. */
  | { outcome: "commit"; widthIn: number; clampedFromIn: number | null; freeWidthIn: number }
  /** Below the shop minimum. The field keeps focus, states the limit, and
   * commits nothing. */
  | { outcome: "refuse-below-minimum"; requestedIn: number; minIn: number }
  /** The free run cannot give up (or absorb) the difference: every other
   * panel on this wall is pinned, an opening, or a corner. `maxAvailableIn`
   * is how wide this panel could actually be made right now — the caller
   * says that number rather than partially applying the edit. */
  | { outcome: "refuse-no-room"; requestedIn: number; maxAvailableIn: number; freeWidthIn: number }
  /** Not a standard/braced slot at all (a window, door, column, corner or
   * gap panel) — those have their own editors or their own placement rules. */
  | { outcome: "refuse-not-a-panel" };

/**
 * What typing `requestedWidthIn` into a standard/braced panel's width field
 * does.
 *
 * Order matters and is deliberate: **quantize, then refuse the minimum,
 * then clamp the maximum, then check the room.** Quantizing first means the
 * limits are applied to the number that would actually be stored, so a value
 * that snaps to exactly the minimum is accepted rather than refused by a
 * rounding artefact. Refusing before clamping means a user who types 6in is
 * told about the 24in floor, not silently handed a 24in panel.
 *
 * The wall's total length is never a thing a width edit may change: the
 * extra width comes out of the UNPINNED standard/braced slots and nowhere
 * else. If they cannot cover it, this refuses — it never shrinks a corner,
 * an opening or another hand-set panel to make room.
 */
export function resolvePanelWidthEdit(
  slots: PanelSlot[],
  slotIndex: number,
  requestedWidthIn: number,
  limits: PanelWidthLimitsIn,
): PanelWidthEditResult {
  const slot = slots[slotIndex];
  if (!slot || !isAdjustablePanel(slot)) return { outcome: "refuse-not-a-panel" };

  // Typed entry already arrives snapped (LengthInput commits through
  // resolveLengthEntry), so this is belt-and-braces rather than the primary
  // snap — but it is what makes "a stored width is always a whole eighth"
  // true of THIS path regardless of who calls it.
  const requestedEighths = toEighths(requestedWidthIn);
  const requestedIn = fromEighths(requestedEighths);

  if (requestedEighths < toEighths(limits.minIn)) {
    return { outcome: "refuse-below-minimum", requestedIn, minIn: limits.minIn };
  }

  const maxEighths = toEighths(limits.maxIn);
  const clamped = requestedEighths > maxEighths;
  const widthEighths = clamped ? maxEighths : requestedEighths;
  const widthIn = fromEighths(widthEighths);

  // Everything the free run currently holds on this wall, excluding the panel
  // being edited. A pinned neighbour is NOT part of it: honouring one hand
  // edit by quietly undoing another is the failure this whole design exists
  // to prevent.
  const freeEighths = slots.reduce(
    (sum, other, i) => (i !== slotIndex && isFreePanel(other) ? sum + toEighths(other.widthIn) : sum),
    0,
  );
  const currentEighths = toEighths(slot.widthIn);
  const deltaEighths = widthEighths - currentEighths;

  // No free slot at all means the wall cannot rebalance in EITHER direction:
  // width given up has nowhere to go, exactly as width taken has nowhere to
  // come from. Only a no-op edit survives that.
  const hasFreeSlot = slots.some((other, i) => i !== slotIndex && isFreePanel(other));
  const maxAvailableIn = fromEighths(Math.min(currentEighths + freeEighths, maxEighths));
  if ((!hasFreeSlot && deltaEighths !== 0) || deltaEighths > freeEighths) {
    return { outcome: "refuse-no-room", requestedIn, maxAvailableIn, freeWidthIn: fromEighths(freeEighths) };
  }

  return {
    outcome: "commit",
    widthIn,
    clampedFromIn: clamped ? requestedIn : null,
    freeWidthIn: fromEighths(freeEighths),
  };
}

export interface PanelBoundaryDragInput {
  /** Where the cursor is, in inches along the wall. */
  cursorIn: number;
  /** The active pair's own outer edges, in the same coordinates. */
  pairStartIn: number;
  pairEndIn: number;
  /** `fabricationMinPanelWidthIn` — the width a shrinking panel stops at. */
  floorIn: number;
  /** Tommy's ±2in snap window around that floor. Ergonomics, not a building
   * value: "snapping to when a shrinking panel becomes 2' at which point it
   * snaps there for plus or minus 2 inches and then switches spots." */
  snapToleranceIn: number;
}

export interface PanelBoundaryDragResult {
  boundaryIn: number;
  leftWidthIn: number;
  rightWidthIn: number;
  /** True when the floor snap fired — the pair is sitting exactly on the
   * minimum, which is what the role handoff watches for. */
  atFloor: boolean;
}

/**
 * Where a dragged panel boundary actually lands.
 *
 * **The whole point of this function is that the boundary is snapped and
 * both widths are DERIVED from it** (`left = boundary − pairStart`,
 * `right = pairEnd − boundary`), so the pair's total is conserved exactly
 * and neither width can drift off the 1/8in grid. The drag used to be
 * "continuous, inch-based, NOT slot-snapped", which meant one drag walked a
 * hand-set width off the grid where the load-time repair would silently
 * absorb it — the quiet correction the grid work exists to prevent.
 *
 * The floor and the ±2in snap window are unchanged ergonomics, and the
 * left-hand branch still wins when a pair is too short to give both sides
 * the floor — same precedence the shipped drag has always had.
 */
export function resolvePanelBoundaryDrag(input: PanelBoundaryDragInput): PanelBoundaryDragResult {
  const { cursorIn, pairStartIn, pairEndIn, floorIn, snapToleranceIn } = input;
  const combinedWidthIn = pairEndIn - pairStartIn;
  const rawBoundaryIn = Math.min(Math.max(cursorIn, pairStartIn), pairEndIn);

  let boundaryIn = roundToEighthIn(rawBoundaryIn);
  let atFloor = false;
  if (boundaryIn - pairStartIn <= floorIn + snapToleranceIn) {
    boundaryIn = pairStartIn + floorIn;
    atFloor = true;
  } else if (pairEndIn - boundaryIn <= floorIn + snapToleranceIn) {
    boundaryIn = pairEndIn - floorIn;
    atFloor = true;
  }
  // A pair shorter than two floors can't honour both ends; the left branch
  // above has already decided, and clamping here keeps the derived widths
  // non-negative instead of emitting a negative panel.
  boundaryIn = Math.min(Math.max(boundaryIn, pairStartIn), pairEndIn);

  return {
    boundaryIn,
    leftWidthIn: boundaryIn - pairStartIn,
    rightWidthIn: combinedWidthIn - (boundaryIn - pairStartIn),
    atFloor,
  };
}

export interface SubMinimumPanel {
  wallId: string;
  slotIndex: number;
  type: PanelSlot["type"];
  widthIn: number;
}

/**
 * Every panel narrower than the shop can build, however it got there —
 * typed, dragged, or produced by the tiler's own arithmetic.
 *
 * **The tiler-generated case is the important one and it is pre-existing.**
 * `computePlainSizing` splits a leftover across two panels, which at the
 * 40in standard width lands each of them anywhere from 20in up; short walls
 * and clamped corners can go lower still. Nothing here changes that
 * behaviour — changing the split rule would change panel counts and widths
 * on every wall of every existing project, and needs a real decision about
 * what the tiler should do instead. Reporting it makes an invisible defect
 * visible on the one document an engineer actually reads.
 *
 * **The Safety/Gap panel is exempt, explicitly.** Its 0.75in board is a
 * plywood spacer with no studs, plates or girts at all — not a panel for
 * this purpose, and including it would fill the Review Log with false
 * positives on every wall over 12ft. Openings (window/door/big-header) are
 * also out: their `widthIn` is a rough opening, not a fabricated panel
 * width.
 */
export function findSubMinimumPanelWidths(
  slotsByWallId: Record<string, PanelSlot[]>,
  minIn: number,
): SubMinimumPanel[] {
  const REPORTED_TYPES: ReadonlySet<PanelSlot["type"]> = new Set(["standard", "braced", "corner", "column"]);
  const minEighths = toEighths(minIn);
  const found: SubMinimumPanel[] = [];
  for (const [wallId, slots] of Object.entries(slotsByWallId ?? {})) {
    (slots ?? []).forEach((slot, slotIndex) => {
      if (!REPORTED_TYPES.has(slot.type)) return;
      if (toEighths(slot.widthIn) >= minEighths) return;
      found.push({ wallId, slotIndex, type: slot.type, widthIn: slot.widthIn });
    });
  }
  return found;
}
