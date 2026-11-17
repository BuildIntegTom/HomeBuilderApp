import { describe, expect, it } from "vitest";
import {
  COMPASS_LABEL_COLORS,
  COMPASS_LABEL_LEGEND,
  NO_DIRECTION_LABEL_COLOR,
  compassLabelColor,
} from "./compassLabelColor";

/* ──────────────────────────────────────────────────────────────────────────
   B35 — THE COMPASS LABEL COLOURS

   His ask was Feng Shui element colours per direction. ⚠ The thing worth
   TESTING is not the hue — that is a choice — but the two properties the shop
   actually depends on: the letter stays readable, and it stays readable after
   the packet has been photocopied in black and white.
   ────────────────────────────────────────────────────────────────────────── */

/** sRGB relative luminance, per WCAG. */
function luminance(hex: string): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG contrast ratio between two hex colours. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const ALL = Object.entries(COMPASS_LABEL_COLORS);

describe("the palette covers the compass and nothing is reused", () => {
  it("has all eight directions", () => {
    expect(Object.keys(COMPASS_LABEL_COLORS).sort()).toEqual(["E", "N", "NE", "NW", "S", "SE", "SW", "W"]);
  });

  it("⚠ every direction is a DIFFERENT colour", () => {
    /* The canonical set gives East and South-East the same green, which is
       why SE takes wood's purple instead. Without this test that collision
       reads as a typo rather than as a decision. */
    const backgrounds = ALL.map(([, c]) => c.background);
    expect(new Set(backgrounds).size).toBe(backgrounds.length);
  });

  it("the legend lists all eight, read round the compass from North", () => {
    expect(COMPASS_LABEL_LEGEND.map((e) => e.direction)).toEqual(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]);
  });

  it("every colour says which element it comes from and where it departs from canon", () => {
    for (const [direction, color] of ALL) {
      expect(color.element, direction).toBeTruthy();
      expect(color.note.length, direction).toBeGreaterThan(10);
    }
  });
});

describe("⚠ the LETTER has to be readable — in colour, and after a photocopy", () => {
  it("every chip carries white text at WCAG AA or better", () => {
    /* This is the property that survives greyscale: eight colours all dark
       enough for white text land at similar luminance, so colour alone cannot
       tell them apart on a photocopied sheet — the LETTER does, and this is
       what keeps the letter legible. */
    for (const [direction, color] of ALL) {
      expect(color.foreground.toLowerCase(), direction).toBe("#ffffff");
      expect(contrast(color.background, color.foreground), `${direction} contrast`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("the no-direction fallback is held to the same bar", () => {
    expect(contrast(NO_DIRECTION_LABEL_COLOR.background, NO_DIRECTION_LABEL_COLOR.foreground)).toBeGreaterThanOrEqual(
      4.5,
    );
  });
});

describe("⚠ the three canonical colours that cannot be printed were replaced", () => {
  it("North is not black — black is the ink colour, and his instinct was blue", () => {
    /* Canonical water is black. A black chip is indistinguishable from
       ordinary print, and he said blue, which is water's other colour. */
    expect(luminance(COMPASS_LABEL_COLORS.N.background)).toBeGreaterThan(luminance("#000000"));
    const n = parseInt(COMPASS_LABEL_COLORS.N.background.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    expect(b, "North reads as blue").toBeGreaterThan(Math.max(r, g));
  });

  it("West is not white, and North-West is not a mid grey", () => {
    /* White is invisible on a white sheet; a mid-grey chip reads as
       "disabled" in every interface. Both take darkened metal instead. */
    for (const direction of ["W", "NW"] as const) {
      const l = luminance(COMPASS_LABEL_COLORS[direction].background);
      expect(l, `${direction} is not white`).toBeLessThan(0.3);
      expect(l, `${direction} is visible`).toBeGreaterThan(0.01);
    }
    /* And the two metals are still told apart from each other. */
    expect(COMPASS_LABEL_COLORS.W.background).not.toBe(COMPASS_LABEL_COLORS.NW.background);
  });
});

describe("an item with no wall of its own", () => {
  it("⚠ gets a plainly NON-compass chip rather than a wrong direction", () => {
    /* A deck panel, a beam or a roof panel does not face a compass point.
       Guessing one would be worse than saying nothing. */
    const fallback = compassLabelColor(undefined);
    expect(fallback).toBe(NO_DIRECTION_LABEL_COLOR);
    for (const [direction, color] of ALL) {
      expect(fallback.background, direction).not.toBe(color.background);
    }
  });

  it("and a real direction gets its own", () => {
    expect(compassLabelColor("SE")).toBe(COMPASS_LABEL_COLORS.SE);
  });
});
