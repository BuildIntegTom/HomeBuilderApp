import type { PanelSlot } from "./types";

const BRACE_NEAR_CORNER_COUNT = 1;

/** Tommy: safety panels are the standard width plus a 3/4in plywood
 * buffer glued on to guard against install mistakes — see
 * `markSafetyCorner`/the Shop Drawing page for the same constant. */
export const SAFETY_PLYWOOD_BUFFER_IN = 0.75;

/**
 * Derived overlay, not stored state: recomputed fresh from the base slots
 * (which only ever contain corner/standard/safety-gap/window/door) every
 * time. Two rules, applied in order — the corner-touching brace is a fixed
 * point; periodic spacing fills the plain run and resets at every
 * non-standard slot (corner, gap, window, door, or a slot already braced by
 * the first rule). Windows are no longer auto-flanked (Tommy).
 */
export function applyBracedPlacement(slots: PanelSlot[], spacingIn: number, standardWidthIn: number): PanelSlot[] {
  const result = slots.map((s) => ({ ...s }));

  /** Nearest standard-type slot to `fromIndex`, searched first in `step`'s
   * direction (continuing further into the wall run, away from the
   * corner) and, failing that, back toward the corner — Tommy: "shed the
   * absorption to the nearest standard panel available" when a safety
   * panel gets fixed-width'd to combine with a corner brace. Clamped at 0
   * (never negative) — on a short wall the gap panel can end up directly
   * corner-adjacent with only one small resized standard panel absorbing
   * the wall's whole leftover budget (see tiling.ts's `computePlainSizing`,
   * which always keeps the gap itself at a fixed 3/4in and pushes any
   * slack into that neighbor instead); shedding this combine's full
   * `standardWidthIn` swing to it could otherwise go negative, which would
   * render as a visually inverted/broken panel. When there isn't enough to
   * shed without going negative, it sheds as much as there is — same
   * documented "wall's total length is off by a little" tradeoff as the
   * "no standard panel at all" case below, just partial instead of total. */
  const shedWidthToNearestStandard = (fromIndex: number, step: number, deltaIn: number) => {
    for (let i = fromIndex + step; i >= 0 && i < result.length; i += step) {
      if (result[i]!.type === "standard") {
        result[i]!.widthIn = Math.max(0, result[i]!.widthIn + deltaIn);
        return;
      }
    }
    for (let i = fromIndex - step; i >= 0 && i < result.length; i -= step) {
      if (result[i]!.type === "standard") {
        result[i]!.widthIn = Math.max(0, result[i]!.widthIn + deltaIn);
        return;
      }
    }
    // No standard panel anywhere on this run to shed to — the combined
    // panel keeps its fixed width; the wall's total length will be off by
    // deltaIn. A rare edge case (a run with no plain standard panels at
    // all), not silently hidden.
  };

  // Rule 1: 1 braced panel touching each corner (Tommy: "each wall must have
  // two braced panels on it, touching each side of each corner panel" — one
  // per end, walking inward past any gap panel). This makes the variable-
  // sized safety/gap panel the second-to-last panel on each run, since
  // tileWall already reserves the corner-adjacent slot for this brace.
  //
  // A safety-gap slot is also eligible: rather than skip past it to find a
  // separate standard panel to brace, it becomes a combined panel (Tommy:
  // "maintain the rules of the safety panel, but have it combine with the
  // braced panel near corners") — fixed-width at standardWidthIn + the
  // plywood buffer instead of its usual dynamically-absorbed width, with
  // the difference shed onto the nearest standard panel so the wall's
  // total length still comes out exactly right.
  const markNearestBraceable = (start: number, step: number, count: number) => {
    let marked = 0;
    for (let i = start; i >= 0 && i < result.length && marked < count; i += step) {
      const slot = result[i]!;
      if (slot.type === "standard") {
        slot.type = "braced";
        marked++;
      } else if (slot.type === "safety-gap" && slot.secondaryType === undefined) {
        const fixedWidthIn = standardWidthIn + SAFETY_PLYWOOD_BUFFER_IN;
        shedWidthToNearestStandard(i, step, slot.widthIn - fixedWidthIn);
        slot.secondaryType = "braced";
        slot.widthIn = fixedWidthIn;
        marked++;
      }
    }
  };
  markNearestBraceable(0, 1, BRACE_NEAR_CORNER_COUNT);
  markNearestBraceable(result.length - 1, -1, BRACE_NEAR_CORNER_COUNT);

  // Rule 2: periodic braced panel every `spacingIn` along the wall (Tommy:
  // "use the earthquake guide to determine amount of braced panels needed
  // per run"). Corner and already-braced slots are genuine reset points —
  // rule 1 already placed a brace there (a combined safety+braced slot
  // counts too — it's a real brace, not just a safety panel). But a plain
  // window/door/safety-gap slot must NOT reset the count: the wall's shear
  // requirement doesn't go away just because the panel that would've been
  // braced turned out to be an opening. So distance keeps accumulating
  // through those, and once a standard slot is reached with enough
  // accumulated distance, it (and if the shortfall was large enough, the
  // standard slot(s) after it too) picks up the brace(s) that would
  // otherwise have been dropped (Tommy: "another standard panel becomes a
  // braced panel on that same wall").
  let cumulativeIn = 0;
  for (const slot of result) {
    if (slot.type === "corner" || slot.type === "braced" || slot.secondaryType === "braced") {
      cumulativeIn = 0;
      continue;
    }
    cumulativeIn += slot.widthIn;
    if (cumulativeIn >= spacingIn && slot.type === "standard") {
      slot.type = "braced";
      cumulativeIn -= spacingIn; // carry any excess forward instead of discarding it
    }
  }

  return result;
}

export function setWindowWidth(slots: PanelSlot[], index: number, widthIn: number): PanelSlot[] {
  return slots.map((s, i) => (i === index && s.type === "window" ? { ...s, widthIn } : s));
}
