import type { PanelSlot } from "@building-integrity/geometry";
import { describe, expect, it } from "vitest";
import { bigHeaderFaceAreaSqFt } from "./bigHeaderTakeoff";

/** The catalog's own two defaults, passed in the way the caller passes them. */
const DEFAULT_HEIGHT_IN = 24;
const SILL_HEIGHT_IN = 32;
const area = (slots: PanelSlot[]) =>
  bigHeaderFaceAreaSqFt({ slots, defaultHeightIn: DEFAULT_HEIGHT_IN, sillHeightIn: SILL_HEIGHT_IN });

describe("bigHeaderFaceAreaSqFt", () => {
  it("⚠ measures a Big Header's OWN height, not the wall's", () => {
    /* The whole reason this function exists. A 96in x 24in header is 16 sqft;
       charged the way `areaSqFtFor` charges every other type — slot width
       times the story's wall height — a 96in slot in an 8ft wall would have
       billed 64 sqft, four times the panel there is. */
    expect(area([{ type: "big-header", widthIn: 96, heightIn: 24 }])).toBeCloseTo(16, 6);
  });

  it("adds the opt-in sill, because it is part of the same fabricated part", () => {
    /* `buildBigHeaderMembers` appends the sill below z = 0 and it appears on
       the same fabrication sheet. 96in x (24 + 32)in = 37.333 sqft. */
    expect(area([{ type: "big-header", widthIn: 96, heightIn: 24, includeSillOnBigHeader: true }])).toBeCloseTo(
      (96 / 12) * (56 / 12),
      6,
    );
  });

  it("treats an absent includeSillOnBigHeader as no sill — his own default", () => {
    /* *"2 with the option to have a sill under it as an option in the left bar
       but default not."* */
    const without = area([{ type: "big-header", widthIn: 96, heightIn: 24 }]);
    const explicitlyFalse = area([{ type: "big-header", widthIn: 96, heightIn: 24, includeSillOnBigHeader: false }]);
    expect(without).toBeCloseTo(explicitlyFalse, 6);
  });

  it("falls back to the passed default height for a slot that carries none", () => {
    expect(area([{ type: "big-header", widthIn: 96 }])).toBeCloseTo((96 / 12) * (DEFAULT_HEIGHT_IN / 12), 6);
  });

  it("ignores every other slot type, including the openings it is cousin to", () => {
    /* A window or door slot reaches the price through the `opening` bucket, and
       a standard panel through its own — double-counting either here would be
       money charged twice. */
    expect(
      area([
        { type: "standard", widthIn: 48 },
        { type: "window", widthIn: 36 },
        { type: "door", widthIn: 36 },
        { type: "column", widthIn: 25.5 },
        { type: "open", widthIn: 40 },
      ]),
    ).toBe(0);
  });

  it("sums every Big Header in the building, at each one's own size", () => {
    expect(
      area([
        { type: "big-header", widthIn: 96, heightIn: 24 },
        { type: "standard", widthIn: 48 },
        { type: "big-header", widthIn: 144, heightIn: 36 },
      ]),
    ).toBeCloseTo(16 + (144 / 12) * (36 / 12), 6);
  });

  it("is 0 on a building with none, so a design without one is unaffected", () => {
    expect(area([])).toBe(0);
  });
});
