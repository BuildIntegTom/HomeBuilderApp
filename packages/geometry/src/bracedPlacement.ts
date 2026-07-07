import type { PanelSlot } from "./types";

const BRACE_NEAR_CORNER_COUNT = 1;

/**
 * Derived overlay, not stored state: recomputed fresh from the base slots
 * (which only ever contain corner/standard/safety-gap/window/door) every
 * time. Two rules, applied in order — the corner-touching brace is a fixed
 * point; periodic spacing fills the plain run and resets at every
 * non-standard slot (corner, gap, window, door, or a slot already braced by
 * the first rule). Windows are no longer auto-flanked (Tommy).
 */
export function applyBracedPlacement(slots: PanelSlot[], spacingIn: number): PanelSlot[] {
  const result = slots.map((s) => ({ ...s }));
  const isStandard = (i: number) => result[i]?.type === "standard";

  const markNearestStandard = (start: number, step: number, count: number) => {
    let marked = 0;
    for (let i = start; i >= 0 && i < result.length && marked < count; i += step) {
      if (isStandard(i)) {
        result[i]!.type = "braced";
        marked++;
      }
    }
  };
  // Rule 1: 1 braced panel touching each corner (Tommy: "each wall must have
  // two braced panels on it, touching each side of each corner panel" — one
  // per end, walking inward past any gap panel). This makes the variable-
  // sized safety/gap panel the second-to-last panel on each run, since
  // tileWall already reserves the corner-adjacent slot for this brace.
  markNearestStandard(0, 1, BRACE_NEAR_CORNER_COUNT);
  markNearestStandard(result.length - 1, -1, BRACE_NEAR_CORNER_COUNT);

  // Rule 2: periodic braced panel every `spacingIn` along the wall (Tommy:
  // "use the earthquake guide to determine amount of braced panels needed
  // per run"). Corner and already-braced slots are genuine reset points —
  // rule 1 already placed a brace there. But a window/door/safety-gap slot
  // must NOT reset the count: the wall's shear requirement doesn't go away
  // just because the panel that would've been braced turned out to be an
  // opening. So distance keeps accumulating through those, and once a
  // standard slot is reached with enough accumulated distance, it (and if
  // the shortfall was large enough, the standard slot(s) after it too)
  // picks up the brace(s) that would otherwise have been dropped (Tommy:
  // "another standard panel becomes a braced panel on that same wall").
  let cumulativeIn = 0;
  for (const slot of result) {
    if (slot.type === "corner" || slot.type === "braced") {
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
