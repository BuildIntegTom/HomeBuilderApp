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
 */
export function formatImperialFractionIn(valueIn: number, unit = "\""): string {
  const sign = valueIn < 0 ? "-" : "";
  const absIn = Math.abs(valueIn);
  const roundedEighths = Math.round(absIn * 8);
  const wholeIn = Math.floor(roundedEighths / 8);
  const remainderEighths = roundedEighths % 8;
  const fractionGlyph = EIGHTHS_GLYPHS[remainderEighths] ?? "";
  if (wholeIn === 0 && fractionGlyph) return `${sign}${fractionGlyph}${unit}`;
  if (!fractionGlyph) return `${sign}${wholeIn}${unit}`;
  return `${sign}${wholeIn}${fractionGlyph}${unit}`;
}

/** Rounds a decimal-mm value to the nearest whole mm (Tommy: "for metric,
 * make to the nearest mm"). */
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
