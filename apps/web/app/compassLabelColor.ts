import type { CompassDirection } from "@building-integrity/geometry";

/**
 * ⚠ **A PANEL LABEL'S COLOUR, BY THE DIRECTION ITS WALL FACES — B35,
 * 2026-11-16.**
 *
 * > *"To make it visually easy to read, lets color code each compass direction
 * > the same color as chinese fungshei recommendations. so if the point of
 * > least accessability is nw on a square house, then the first panel of the
 * > run is 0001 and its label is colored blue (or whatever fengshu color for
 * > north is)."* — Tommy, 2026-11-16
 *
 * ## ⚠ Three of the eight canonical colours cannot be printed
 *
 * The bagua element colours are real and this follows them — but it follows
 * them onto **white paper that gets photocopied**, and three of the eight do
 * not survive that:
 *
 * | | element | canonical | why it is changed |
 * | --- | --- | --- | --- |
 * | **N** | Water | **black**, dark blue | Black is the ink colour — a black label is just a label. **His own instinct was blue**, which is water's other colour, so that is what this uses. |
 * | **W** | Metal | **white** | Invisible on a white sheet. |
 * | **NW** | Metal | **grey**, white | Mid-grey reads as *disabled* in every interface anyone has ever used. |
 *
 * The other five keep their element hue, darkened where the canonical shade is
 * too pale to read (NE's beige, SW's pink). SE takes **purple**, which is its
 * usual alternate, because the canonical green would make it identical to E.
 *
 * ## ⚠ Two rules that come with it, and neither is negotiable
 *
 * 1. **The compass letter stays on the chip.** Colour is never the only
 *    carrier of the direction — not for a colour-blind crew member (red/green,
 *    which S and E are, is the commonest pair), not for a photocopied sheet,
 *    not for a page faxed to a supplier.
 * 2. **It does not touch the TYPE colours.** Panel sheets already carry
 *    `panelSheetAccentColor` — box beam green, truss plate blue (B25/B27/B28).
 *    A second colour system on the same pixel would give green two meanings.
 *    So a direction colour only ever paints the **label chip**, and the type
 *    colour keeps the panel body it already has.
 *
 * ⚠ Every colour below is dark enough for white text on it, which is what
 * makes the chip legible without a border and keeps it readable in greyscale.
 */

export interface CompassLabelColor {
  /** The chip's fill. Dark enough to carry white text. */
  background: string;
  /** The text on it. */
  foreground: string;
  /** The element the colour comes from, for the key/legend. */
  element: "Water" | "Earth" | "Wood" | "Fire" | "Metal";
  /** What a reader is told the colour means, in the legend. */
  note: string;
}

const WHITE = "#ffffff";

/**
 * ⚠ **The palette. Hues are the five elements; the VALUES are chosen for
 * print.** Where a value departs from the canonical shade, the note says so —
 * nobody should have to discover that from a hex code.
 */
export const COMPASS_LABEL_COLORS: Record<CompassDirection, CompassLabelColor> = {
  N: {
    background: "#1d4e89",
    foreground: WHITE,
    element: "Water",
    note: "Water. Canonically black; blue is water's other colour and is his own instinct — and a black chip is indistinguishable from ink.",
  },
  NE: {
    background: "#8a6a3b",
    foreground: WHITE,
    element: "Earth",
    note: "Earth. Canonically beige, darkened to ochre so it is visible on white paper.",
  },
  E: {
    background: "#2f7d4f",
    foreground: WHITE,
    element: "Wood",
    note: "Wood, the canonical green used unchanged — the one direction whose textbook colour needed no adjustment for print.",
  },
  SE: {
    background: "#6b3fa0",
    foreground: WHITE,
    element: "Wood",
    note: "Wood's purple, the usual south-east alternate — the canonical green would be identical to East.",
  },
  S: {
    background: "#b4282e",
    foreground: WHITE,
    element: "Fire",
    note: "Fire, the canonical red used unchanged. ⚠ Red against East's green is the commonest colour-blind pair, which is why the letter stays on the chip.",
  },
  SW: {
    background: "#a4486b",
    foreground: WHITE,
    element: "Earth",
    note: "Earth's pink, darkened to rose so it reads at label size.",
  },
  W: {
    background: "#5f6a72",
    foreground: WHITE,
    element: "Metal",
    note: "Metal. Canonically white, which is invisible on a white sheet, so it takes metal's slate.",
  },
  NW: {
    background: "#3d4348",
    foreground: WHITE,
    element: "Metal",
    note: "Metal's grey, darkened — a mid-grey chip reads as disabled rather than as a direction.",
  },
};

/**
 * The colour for a wall direction. ⚠ Falls back to a neutral slate rather
 * than throwing or picking a direction at random, so an item with no wall of
 * its own — a deck panel, a beam — gets a chip that is plainly **not** a
 * compass colour instead of a wrong one.
 */
export const NO_DIRECTION_LABEL_COLOR: CompassLabelColor = {
  background: "#44474b",
  foreground: WHITE,
  element: "Metal",
  note: "No wall direction — a deck panel, a beam or a roof panel does not face a compass point.",
};

export function compassLabelColor(direction: CompassDirection | undefined): CompassLabelColor {
  return direction === undefined ? NO_DIRECTION_LABEL_COLOR : COMPASS_LABEL_COLORS[direction];
}

/**
 * ⚠ **The legend, which has to be printed beside the drawing.** A colour
 * system nobody is given a key to is decoration. Ordered the way a compass
 * rose is read, starting at North.
 */
export const COMPASS_LABEL_LEGEND: readonly { direction: CompassDirection; color: CompassLabelColor }[] = (
  ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const
).map((direction) => ({ direction, color: COMPASS_LABEL_COLORS[direction] }));
