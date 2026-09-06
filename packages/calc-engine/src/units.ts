import { EIGHTH_IN, toEighths } from "@building-integrity/geometry";

export const MM_PER_IN = 25.4;

export function inToMm(valueIn: number): number {
  return valueIn * MM_PER_IN;
}

export function mmToIn(valueMm: number): number {
  return valueMm / MM_PER_IN;
}

const EIGHTHS_GLYPHS: Record<number, string> = {
  0: "",
  1: "⅛",
  2: "¼",
  3: "⅜",
  4: "½",
  5: "⅝",
  6: "¾",
  7: "⅞",
};

/**
 * Rounds a decimal-inch value to the nearest 1/8in and formats it as a
 * mixed-number fraction (Tommy: "when in imperial, round everything to the
 * nearest 1/8th inch and denote that as fractions everywhere") — e.g.
 * 15.75 -> `15¾"`, 5.125 -> `5⅛"`, 6 -> `6"`, 0.75 -> `¾"`.
 *
 * Shares `packages/geometry`'s `toEighths` rather than keeping its own
 * `* 8` — the model quantizes to the same grid this formatter renders, and
 * a hand-synced copy of that rounding rule is exactly the kind of thing
 * that drifts apart silently. (`calc-engine` -> `geometry` is acyclic;
 * `geometry` has no package dependencies at all.)
 *
 * NOTE: this still ROUNDS silently — a non-eighth renders as its nearest
 * eighth with no signal that it wasn't one. Making that honest (render at
 * the finest precision that is exact, and an `{ approximate: true }`
 * opt-in for genuinely non-grid derived values) is deliberately Stage 1b,
 * not this stage.
 */
export function formatImperialFractionIn(valueIn: number, unit = "\""): string {
  const sign = valueIn < 0 ? "-" : "";
  const absIn = Math.abs(valueIn);
  const roundedEighths = toEighths(absIn);
  const wholeIn = Math.floor(roundedEighths / 8);
  const remainderEighths = roundedEighths % 8;
  const fractionGlyph = EIGHTHS_GLYPHS[remainderEighths] ?? "";
  if (wholeIn === 0 && fractionGlyph) return `${sign}${fractionGlyph}${unit}`;
  if (!fractionGlyph) return `${sign}${wholeIn}${unit}`;
  return `${sign}${wholeIn}${fractionGlyph}${unit}`;
}

/** Rounds a decimal-mm value to the nearest whole mm (Tommy: "for metric,
 * make to the nearest mm"). */
/** 1/8in expressed in mm (3.175 exactly), for callers that need to reason
 * about the imperial grid from the metric side. The grid itself is ALWAYS
 * imperial — the unit toggle is display-only and never changes stored
 * geometry — and an eighth-multiple needs 3 decimal places to be exact in
 * mm, so the sum invariant is exact in imperial and provably cannot be at
 * nearest-mm. See the spec's Metric subsection. */
export const EIGHTH_MM = EIGHTH_IN * MM_PER_IN;

export function formatMetricMm(valueMm: number, unit = "mm"): string {
  const rounded = Math.round(valueMm);
  return `${rounded}${unit}`;
}

/** Formats a real-world inch length per the app's current unit-system
 * toggle — imperial as a nearest-1/8in fraction, metric as nearest-mm. The
 * one function UI code should reach for wherever a dimension is displayed
 * and `unitSystem` is in scope. */
export function formatLengthIn(valueIn: number, unitSystem: "imperial" | "metric"): string {
  return unitSystem === "metric" ? formatMetricMm(inToMm(valueIn)) : formatImperialFractionIn(valueIn);
}
