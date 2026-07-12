import { describe, expect, it } from "vitest";
import { formatImperialFractionIn, formatLengthIn, formatMetricMm, inToMm, mmToIn } from "./units";

describe("inToMm / mmToIn", () => {
  it("round-trips 15.75in <-> 400.05mm (near the 400mm European panel module)", () => {
    expect(inToMm(15.75)).toBeCloseTo(400.05, 6);
    expect(mmToIn(400)).toBeCloseTo(15.748031, 5);
  });
});

describe("formatImperialFractionIn", () => {
  it("formats whole inches with no fraction", () => {
    expect(formatImperialFractionIn(6)).toBe('6"');
    expect(formatImperialFractionIn(0)).toBe('0"');
  });

  it("formats common eighths as unicode fraction glyphs", () => {
    expect(formatImperialFractionIn(15.75)).toBe('15¾"');
    expect(formatImperialFractionIn(5.125)).toBe('5⅛"');
    expect(formatImperialFractionIn(0.75)).toBe('¾"');
    expect(formatImperialFractionIn(3.5)).toBe('3½"');
    expect(formatImperialFractionIn(1.375)).toBe('1⅜"');
    expect(formatImperialFractionIn(2.625)).toBe('2⅝"');
    expect(formatImperialFractionIn(4.875)).toBe('4⅞"');
  });

  it("rounds to the nearest 1/8in", () => {
    expect(formatImperialFractionIn(15.74)).toBe('15¾"'); // 15.74 -> 15.75
    expect(formatImperialFractionIn(15.70)).toBe('15¾"'); // 15.70 -> 15.75 (nearest 1/8 is .75, not .625)
    expect(formatImperialFractionIn(15.6)).toBe('15⅝"'); // 15.6 -> 15.625
  });

  it("carries a rounded-up remainder into the next whole inch", () => {
    expect(formatImperialFractionIn(5.99)).toBe('6"'); // rounds up past 8/8
  });

  it("handles negative values", () => {
    expect(formatImperialFractionIn(-3.5)).toBe('-3½"');
  });

  it("supports a custom unit suffix", () => {
    expect(formatImperialFractionIn(15.75, " in")).toBe("15¾ in");
  });
});

describe("formatMetricMm", () => {
  it("rounds to the nearest whole mm", () => {
    expect(formatMetricMm(400.05)).toBe("400mm");
    expect(formatMetricMm(400.6)).toBe("401mm");
    expect(formatMetricMm(15)).toBe("15mm");
  });
});

describe("formatLengthIn", () => {
  it("formats as an imperial fraction when unitSystem is imperial", () => {
    expect(formatLengthIn(15.75, "imperial")).toBe('15¾"');
  });

  it("formats as nearest-mm when unitSystem is metric", () => {
    expect(formatLengthIn(15.75, "metric")).toBe("400mm");
  });
});
