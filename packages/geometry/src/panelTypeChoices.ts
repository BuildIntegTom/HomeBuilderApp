import { PLACEABLE_PANEL_TYPES } from "./panelPlacement";
import type { PanelSlot, PanelSlotType } from "./types";

/**
 * **WHAT A SLOT IS ALLOWED TO BECOME — B19.**
 *
 * > *"a drop-down menu of all of the panel types"* — Tommy, 2026-11-02
 *
 * Asked whether the menu should hide the impossible choices or show them, he
 * chose **show all, grey out the impossible, with a reason**: every type stays
 * in the same place in the list for every panel, so the menu reads the same
 * everywhere and nothing moves under the cursor. That only works if each
 * refusal can say WHY in a few words, which is what `reason` is for.
 *
 * ⚠ **This is a judgement about the BUILDING, kept out of the UI on purpose.**
 * Whether a corner can appear mid-run, whether a run may carry a second safety
 * gap — those are rules about how a wall goes together, and burying them in a
 * React component would put them where nobody looks for them. The menu renders
 * what this returns and decides nothing.
 */

/** Every type the menu lists, in the order it lists them. Stable across every
 *  panel: the whole point of showing the impossible ones is that the list does
 *  not change shape from one right click to the next. */
export const PANEL_TYPE_MENU_ORDER: readonly PanelSlotType[] = [
  "standard",
  "braced",
  "window",
  "door",
  "column",
  "big-header",
  "open",
  "safety-gap",
  "corner",
  "safety-oct-corner",
];

export interface PanelTypeChoice {
  type: PanelSlotType;
  allowed: boolean;
  /** Present only when `allowed` is false. A few words, for a tooltip. */
  reason?: string;
  /** True for the type the slot already is, so the menu can mark it. */
  current: boolean;
}

/**
 * The menu for one slot.
 *
 * `slots` is the whole run, because several of the rules are about the run
 * rather than the slot — a second safety gap, a corner away from an end.
 */
export function panelTypeChoices(slots: readonly PanelSlot[], slotIndex: number): PanelTypeChoice[] {
  const slot = slots[slotIndex];
  if (!slot) return [];

  const isEnd = slotIndex === 0 || slotIndex === slots.length - 1;
  const gapCount = slots.filter((s) => s.type === "safety-gap").length;
  const placeable = new Set<PanelSlotType>(PLACEABLE_PANEL_TYPES);

  return PANEL_TYPE_MENU_ORDER.map((type) => {
    const current = slot.type === type;
    const refuse = (reason: string): PanelTypeChoice => ({ type, allowed: false, reason, current });

    /* Staying put is always allowed, and is how the menu shows a tick rather
       than greying out the type the panel already is. Checked first so a
       corner can be told it is a corner without also being told it may not
       be one. */
    if (current) return { type, allowed: true, current };

    /* ⚠ A corner is placed by the TILER, from which wall owns the corner at
       each end (`resolveCorners`), not by a person. Letting one be typed
       mid-run would put a corner post where two walls do not meet. */
    if (type === "corner" || type === "safety-oct-corner") {
      return refuse(isEnd ? "Corners are placed by the tiler from wall ownership, not by hand" : "A corner can only sit at the end of a wall");
    }

    /* ⚠ Every run gets exactly one safety gap, placed farthest from the least
       accessible corner, plus the 24ft-rule gaps the run earns by its own
       length. Typing an extra one by hand would put a plywood spacer where no
       tolerance needs absorbing. */
    if (type === "safety-gap") {
      return refuse(gapCount > 0 ? "This run already has its safety gap, placed by the tiler" : "Safety gaps are placed by the tiler, not by hand");
    }

    /* An OPEN slot is always reachable: emptying a panel is exactly the
       "delete / no panel" the menu offers, and nothing about the run can make
       a void illegal — it keeps the width it already had. */
    if (type === "open") return { type, allowed: true, current };

    /* ⚠ A rule-placed slot's own type is not the user's to change. You may
       empty it (above) but you may not turn a safety gap into a window: the
       tiler would put the gap back on the next retile and the wall would carry
       both. */
    if (!placeable.has(slot.type) && slot.type !== "open") {
      return refuse(`A ${slot.type} slot is placed by the tiler — empty it first if you want something else here`);
    }

    return placeable.has(type) ? { type, allowed: true, current } : refuse("Not a type a panel can be changed into");
  });
}

/**
 * Change one slot's type, keeping its width.
 *
 * ⚠ **The width never moves, and that is the whole contract.** Every other
 * wall edit goes through the tiler or through `resolvePanelInsert`/
 * `resolvePanelDelete`, which redistribute. This one does not: the slot is the
 * same width before and after, so the run still sums to the wall by identity
 * rather than by arithmetic (Tommy, 2026-09-29: *"this app needs to be
 * perfectly tight with dimensions and wall lengths"*).
 *
 * Returns the same array reference when the type is already what was asked
 * for, so a no-op change cannot push an undo entry.
 */
export function setPanelSlotType(slots: readonly PanelSlot[], slotIndex: number, type: PanelSlotType): PanelSlot[] {
  const slot = slots[slotIndex];
  if (!slot || slot.type === type) return slots as PanelSlot[];
  return slots.map((s, i) => {
    if (i !== slotIndex) return s;
    /* ⚠ The brace fields go with the type. A slot that stops being `braced`
       keeping its `bracedPattern` would hand a pattern to whatever reads the
       slot next — `resolveBracedStyle`'s "absent = default" fallback exists
       precisely so an absent one is safe, and a stale one is not.
       `bracePairPattern`/`bracePairHalf`/`braceFigure` are NOT stripped: those
       are the wall pattern's own overlay, re-derived from scratch by
       `applyDrawTimeBracing` on the very next render. */
    const { bracedPattern: _p, bracedMirrored: _m, ...rest } = s;
    return { ...rest, type };
  });
}
