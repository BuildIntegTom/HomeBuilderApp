import type { PanelSlot } from "./types";

/** Slot types considered plain wall infill — eligible to be replaced by a
 * uniform-width run under an alternate panelization type. Corners, columns,
 * and openings (window/door) are structural/functional necessities
 * regardless of infill construction choice, so they're left untouched. */
function isInfillType(slot: PanelSlot): boolean {
  return slot.type === "standard" || slot.type === "braced" || slot.type === "safety-gap";
}

/** Tiles a total width into uniform-width slots of `uniformType` — same
 * "ceil'd, evenly re-split" rule as computeJoistLayout/computeGableTiledRow
 * (a width that doesn't divide evenly still gets a uniform pitch, not a
 * short leftover panel). */
function tileUniformRun(totalWidthIn: number, uniformType: "standard" | "braced", uniformWidthIn: number): PanelSlot[] {
  if (totalWidthIn <= 0) return [];
  const count = Math.max(1, Math.round(totalWidthIn / uniformWidthIn));
  const widthIn = totalWidthIn / count;
  return Array.from({ length: count }, () => ({ type: uniformType, widthIn }));
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
