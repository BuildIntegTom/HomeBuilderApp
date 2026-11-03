import { reconcileBracedPlacement } from "./bracedPlacement";
import { getOpeningAnchors, isReservationType, markSafetyCorner, retileWithOpenings, type OpeningAnchor } from "./tiling";
import type { BracePattern, PanelSlot, PanelSlotType, WallEnd } from "./types";

/**
 * **CHANGING ONE PANEL'S TYPE WHEN THE CHANGE MOVES WIDTH — B19, 2026-11-03.**
 *
 * > *"Anchor fix and then cycle retires let's go!"* — Tommy, 2026-11-03
 *
 * A window, door, column, big header or framed void is a **width
 * reservation**: it owns a size of its own that the tiler may not spend. So
 * turning a standard panel into one, or one into a standard panel, or one into
 * a different one, is the only panel edit that cannot be a field change — the
 * free run either loses that width or gets it back, and the panels around it
 * have to pay or absorb. That is what `retileWithOpenings` is for, and this
 * function is the whole of how a type change drives it.
 *
 * ⚠ **It lived inline in `page.tsx`'s `handleToggleOpening` and was reachable
 * only along the click cycle's own edges.** B19 pointed it at an arbitrary
 * target type for the first time and it came apart in three measured ways:
 *
 *  1. **A big header asked to become a door stayed a big header.** The anchor
 *     inherited the big header's 96in width, and the single-peak angle rule
 *     then retyped it straight back. Fixed by the reservation-to-reservation
 *     width rule below. (The retyping itself was deleted hours later the same
 *     day — headers have as many peaks as they need now — but a door built at
 *     a big header's width was never right either way.)
 *  2. **`reconcileBracedPlacement` did not know `big-header` was a
 *     reservation**, so every carried marker after one read a position early.
 *     Fixed at the source — see `RESERVATION_PANEL_TYPES`.
 *  3. **A slot asked to become `open` lost its width to the free run**,
 *     because nothing treated a void as a reservation. Same fix.
 *
 * ⚠ **What this function does NOT do**, on purpose: a transition where
 * neither side is a reservation (cycling braced styles, standard to braced and
 * back) never changes a width at all and stays a plain field mutation in
 * `page.tsx`, zone-aware and far cheaper. And the two app-level passes that
 * follow a retile — marking a mitered safety corner needs the footprint, and
 * the big-header auto-upgrade needs the project's header heights — stay with
 * their callers. This returns the slots and WHERE THE PANEL WENT, and the
 * caller finishes the job.
 */

/** The wall's own tiling inputs — exactly `retileWithOpenings`' parameters,
 *  named so a caller cannot transpose two of them by accident. */
export interface PanelTypeTransitionWall {
  lengthIn: number;
  standardWidthIn: number;
  cornerWidthIn: number;
  gapEnd: WallEnd;
  hasCornerStart: boolean;
  hasCornerEnd: boolean;
  allowBorrow: boolean;
  cornerMayWiden: boolean;
  /** True on a mitered footprint, where the run's gap-end corner is marked
   *  `safety-oct-corner` after tiling. The footprint itself is the caller's. */
  markSafetyCornerAtGapEnd: boolean;
}

/**
 * The width a reservation takes **when it is freshly created**, and the one
 * place those defaults enter this file.
 *
 * ⚠ **Every one of these is a catalog value the caller reads**, never a
 * literal here: a column is fabricated at exactly one width, a big header
 * defaults to 8ft x 2ft, and a window takes the 4ft module so its jack studs
 * land over deck joints. Hard-coding any of them in geometry would put a
 * building decision somewhere nobody looks for one.
 */
export interface PanelTypeTransitionWidths {
  columnWidthIn: number;
  windowWidthIn: number;
  /** ⚠ A door normally KEEPS the width of the panel it replaces — Tommy:
   *  *"A door keeps the slot's width: its own widths come from a door
   *  schedule, not from this module."* This value is used only when there is
   *  no such width to keep, i.e. when the door replaces another reservation
   *  (see `freshReservationWidthIn`). */
  doorWidthIn: number;
  bigHeaderWidthIn: number;
  bigHeaderHeightIn: number;
}

export interface PanelTypeTransitionTarget {
  type: PanelSlotType;
  bracedPattern?: BracePattern;
  bracedMirrored?: boolean;
}

export interface PanelTypeTransitionResult {
  slots: PanelSlot[];
  /** Where the changed panel ended up in `slots`. A retile reshuffles every
   *  index on the wall, so the caller's own `slotIndex` is stale the moment
   *  this returns; -1 when the panel could not be found again, which is the
   *  one case a caller must treat as "do not point the selection at it". */
  slotIndex: number;
}

/**
 * True for a transition that moves width and therefore needs this function.
 * Everything else is a field change on one slot.
 *
 * ⚠ **Becoming `open` is the exception, and it is the whole point of an open
 * slot.** A void keeps the exact width the panel had, so emptying a slot moves
 * no width at all and needs no retile — `setPanelSlotType` changes the label
 * and the run still sums to the wall by identity. Re-tiling the wall to empty
 * one slot would hand that width to the tiler and move every panel around it
 * for nothing. Coming OUT of a void does move width: a 96in void cannot become
 * a 96in standard panel.
 */
export function panelTypeChangeNeedsRetile(fromType: PanelSlotType, toType: PanelSlotType): boolean {
  if (toType === "open") return false;
  return isReservationType(fromType) || isReservationType(toType);
}

/**
 * The width a reservation gets the moment it is created.
 *
 * ⚠ **The rule that fixes "a big header asked to become a door did
 * nothing".** A fresh reservation inherits the slot's current width ONLY when
 * the slot it replaces was part of the tiler's own run — a standard or braced
 * panel, whose width is the module the user was already looking at. When the
 * slot it replaces was itself a reservation, the old width belonged to the old
 * thing: a 96in big header handed its 96in to a door, and a 96in door header
 * cannot carry a single peak, so the auto-upgrade turned it straight back into
 * a big header and the menu looked broken.
 *
 * Column, big header and window never inherit at all — each has its own
 * answer and had it before B19.
 */
function freshReservationWidthIn(
  type: PanelSlotType,
  replacing: PanelSlot,
  widths: PanelTypeTransitionWidths,
): number {
  switch (type) {
    case "column":
      return widths.columnWidthIn;
    case "big-header":
      return widths.bigHeaderWidthIn;
    case "window":
      return widths.windowWidthIn;
    case "door":
      return isReservationType(replacing.type) ? widths.doorWidthIn : replacing.widthIn;
    /* A void keeps the width it already had, whatever it was — that is the
       whole of "delete / no panel": the run still sums to the wall by
       identity and nothing around it moves. */
    default:
      return replacing.widthIn;
  }
}

/**
 * Change `slots[slotIndex]` to `target.type`, re-tiling the wall around the
 * width that moves.
 *
 * Returns null when there is nothing to do (no such slot, or the slot is
 * already that type). The caller keeps what it had.
 */
export function transitionPanelType(
  slots: readonly PanelSlot[],
  slotIndex: number,
  target: PanelTypeTransitionTarget,
  wall: PanelTypeTransitionWall,
  widths: PanelTypeTransitionWidths,
): PanelTypeTransitionResult | null {
  const current = slots[slotIndex];
  if (!current || current.type === target.type) return null;

  /* ⚠ Built from the slots as they are, with the ONE slot's type swapped —
     not from `getOpeningAnchors`, which reads types off the array and would
     therefore describe the wall before the change. Every other reservation on
     the wall keeps the intent it already has, including an absent
     `anchorOffsetIn`, which means "never recorded" and leaves placement on the
     count. */
  const anchors: OpeningAnchor[] = [];
  let standardsSeen = 0;
  let offsetSoFarIn = 0;
  slots.forEach((slot, i) => {
    const type = i === slotIndex ? target.type : slot.type;
    if (isReservationType(type)) {
      const fresh = i === slotIndex;
      anchors.push({
        beforeStandardCount: standardsSeen,
        /* The slot being changed INTO a reservation is the user placing it, so
           where it sits right now is the intent. REPANELIZE R2: this is the
           only place an offset is ever measured; everything downstream copies
           it. An existing reservation is never re-measured here, which is
           precisely what broke the first attempt on 2026-10-07. */
        offsetIn: fresh ? offsetSoFarIn : slot.anchorOffsetIn,
        type,
        widthIn: fresh ? freshReservationWidthIn(type, slot, widths) : slot.widthIn,
        /* A freshly created reservation has no vertical data of its own to
           carry; a big header is the one that needs a default height, because
           its own range starts well above whatever a window was. Every OTHER
           reservation on this wall keeps its height, sill, zones and sill flag
           through this whole-wall retile. */
        ...(fresh
          ? { heightIn: type === "big-header" ? widths.bigHeaderHeightIn : undefined }
          : {
              heightIn: slot.heightIn,
              sillHeightIn: slot.sillHeightIn,
              zones: slot.zones,
              includeSillOnBigHeader: slot.includeSillOnBigHeader,
            }),
      });
    } else if (type === "standard" || type === "braced") {
      standardsSeen++;
    }
    offsetSoFarIn += slot.widthIn;
  });

  /* Both ordinals are read off the PRE-retile array, which is the convention
     `reconcileBracedPlacement` and `getOpeningAnchors` already share: a
     reservation keeps its order among reservations and a standard-family slot
     keeps its order among standard-family slots, so either ordinal still names
     this exact panel after the retile has reshuffled every index. */
  const reservationOrdinal = slots.slice(0, slotIndex).filter((s) => isReservationType(s.type)).length;
  const standardFamilyOrdinal = slots.slice(0, slotIndex).filter((s) => s.type === "standard" || s.type === "braced").length;

  const tiled = retileWithOpenings(
    wall.lengthIn,
    wall.standardWidthIn,
    wall.cornerWidthIn,
    wall.gapEnd,
    wall.hasCornerStart,
    wall.hasCornerEnd,
    anchors,
    wall.allowBorrow,
    wall.cornerMayWiden,
  ).slots;
  const marked = wall.markSafetyCornerAtGapEnd ? markSafetyCorner(tiled, wall.gapEnd) : tiled;
  /* Carries every OTHER braced panel, zone split and width pin already decided
     on this wall across the retile — without it this single-slot change
     silently wipes them, since `retileWithOpenings` only knows about the
     reservations it was handed. */
  let finalSlots = reconcileBracedPlacement(slots as PanelSlot[], marked);

  let landedIndex: number;
  if (isReservationType(target.type)) {
    landedIndex = nthIndexMatching(finalSlots, reservationOrdinal, (s) => isReservationType(s.type));
  } else {
    landedIndex = nthIndexMatching(finalSlots, standardFamilyOrdinal, (s) => s.type === "standard" || s.type === "braced");
    /* ⚠ The user's own explicit choice wins over whatever
       `reconcileBracedPlacement` just carried onto this position. It carries
       by ordinal, and this position's ordinal is exactly the one whose meaning
       just changed, so the carried marker describes the panel that USED to be
       here. */
    if (landedIndex !== -1) {
      const landed = finalSlots[landedIndex]!;
      if (landed.type !== target.type || target.type === "braced") {
        const { bracedPattern: _p, bracedMirrored: _m, ...rest } = landed;
        finalSlots = finalSlots.map((s, i) =>
          i === landedIndex
            ? target.type === "braced"
              ? { ...rest, type: "braced" as const, bracedPattern: target.bracedPattern, bracedMirrored: target.bracedMirrored }
              : { ...rest, type: target.type }
            : s,
        );
      }
    }
  }

  return { slots: finalSlots, slotIndex: landedIndex };
}

function nthIndexMatching(slots: readonly PanelSlot[], ordinal: number, match: (s: PanelSlot) => boolean): number {
  let seen = 0;
  for (let i = 0; i < slots.length; i++) {
    if (!match(slots[i]!)) continue;
    if (seen === ordinal) return i;
    seen++;
  }
  return -1;
}

/** Re-reads every reservation on a wall as anchors, with one of them replaced.
 *  Exported for the width editors, which do exactly this and had their own
 *  copy of the column self-heal. */
export function anchorsWithReplacement(
  slots: readonly PanelSlot[],
  reservationOrdinal: number,
  patch: Partial<OpeningAnchor>,
  columnWidthIn: number,
): OpeningAnchor[] | null {
  const anchors = getOpeningAnchors(slots as PanelSlot[]).map((a) =>
    /* Self-heal: a Column anchor read off an existing slot can still carry a
       stale width from a project saved before the fixed-width rule existed. */
    a.type === "column" ? { ...a, widthIn: columnWidthIn } : a,
  );
  if (!anchors[reservationOrdinal]) return null;
  anchors[reservationOrdinal] = { ...anchors[reservationOrdinal]!, ...patch };
  return anchors;
}
