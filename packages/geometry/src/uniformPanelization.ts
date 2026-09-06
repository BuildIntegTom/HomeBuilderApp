import { distributeEighths, fromEighths, toEighths } from "./eighths";
import type { PanelSlot } from "./types";

/** Slot types considered plain wall infill — eligible to be replaced by a
 * uniform-width run under an alternate panelization type. Corners, columns,
 * openings (window/door), and the safety-gap panel are all structural/
 * functional necessities regardless of infill construction choice, so
 * they're left untouched (Tommy: "safety gaps should be a part of each wall
 * panelizing style" — previously a safety-gap slot got absorbed into the
 * uniform run and disappeared entirely under Square Bale Panels/Timber
 * Frame Curtain; now it's a fixed anchor like a corner or opening, breaking
 * the infill run in two around it, so its own tiled width/position from
 * `retile()` — flush against its neighbors — survives unchanged no matter
 * which panelization style is chosen). */
function isInfillType(slot: PanelSlot): boolean {
  return slot.type === "standard" || slot.type === "braced";
}

/** Tiles a total width into uniform-width slots of `uniformType` — same
 * "ceil'd, evenly re-split" rule as computeJoistLayout/computeGableTiledRow
 * (a width that doesn't divide evenly still gets a uniform pitch, not a
 * short leftover panel).
 *
 * "Uniform" is now uniform to within one 1/8in: `distributeEighths` gives
 * every slot a whole number of eighths and the run still sums to
 * `totalWidthIn` exactly, where the old even division landed on
 * sixteenths (and finer) whenever the run didn't divide cleanly. A shop
 * cannot read the 1/8in difference off a cut list; it can read a run that
 * doesn't add up to its wall. */
function tileUniformRun(totalWidthIn: number, uniformType: "standard" | "braced", uniformWidthIn: number): PanelSlot[] {
  if (totalWidthIn <= 0) return [];
  const count = Math.max(1, Math.round(totalWidthIn / uniformWidthIn));
  return distributeEighths(toEighths(totalWidthIn), count)
    .filter((eighths) => eighths > 0)
    .map((eighths) => ({ type: uniformType, widthIn: fromEighths(eighths) }));
}

/**
 * Replaces every contiguous run of plain infill slots (standard/braced/
 * safety-gap) with a uniform-width re-tiling at `uniformType`/
 * `uniformWidthIn` — the mechanism behind the "Timber Frame Curtain" and
 * "Square Bale Panels" panelization types (Tommy: "timber frame curtain is
 * basically all standard panels 3ft wide... or all braced 3ft wide").
 * Corners/columns/openings keep their exact original position in the
 * array; only the infill spans between them get re-tiled. A no-op-shaped
 * identity call (uniformWidthIn equal to the existing tiling) still
 * re-tiles rather than short-circuiting — this is meant to be gated by the
 * caller (only invoked when an alternate panelization type is selected),
 * not to double as an "is this already uniform" check.
 */
export function applyUniformPanelization(
  slots: PanelSlot[],
  uniformType: "standard" | "braced",
  uniformWidthIn: number,
): PanelSlot[] {
  const result: PanelSlot[] = [];
  let i = 0;
  while (i < slots.length) {
    if (!isInfillType(slots[i]!)) {
      result.push(slots[i]!);
      i++;
      continue;
    }
    let runWidthIn = 0;
    while (i < slots.length && isInfillType(slots[i]!)) {
      runWidthIn += slots[i]!.widthIn;
      i++;
    }
    result.push(...tileUniformRun(runWidthIn, uniformType, uniformWidthIn));
  }
  return result;
}
