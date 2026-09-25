import { describe, expect, it } from "vitest";
import { computeWallVerticalBandsForSlot } from "./wallVerticalBands";
import {
  defaultSpanningHeaderBottomHeightIn,
  resolveSpanningHeaderPlacement,
  slotRangesOverlap,
  spanningHeaderCoveredSlotCount,
  spanningHeaderSpanWidthIn,
  type SpanningHeaderGeometry,
  type SpanningHeaderLimitsIn,
} from "./spanningHeader";
import type { PanelSlot } from "./types";

/** The catalog's own `bigHeaderWidthInRange` (48-144in) and
 * `bigHeaderHeightInRange` (24-48in), both `pending-BI-confirmation`, passed
 * in the way the real caller passes them. */
const LIMITS: SpanningHeaderLimitsIn = { minSpanIn: 48, maxSpanIn: 144, minHeightIn: 24, maxHeightIn: 48 };

const standard = (widthIn: number): PanelSlot => ({ type: "standard", widthIn });

/** The Rogers-Sehorn ADU's own E4B (3'5½") and E4C (3'0"), the two panels
 * E4A spans. */
const ADU_E4B_IN = 41.5;
const ADU_E4C_IN = 36;

describe("spanningHeaderSpanWidthIn", () => {
  it("reports exactly 6'5½\" over the ADU's own 3'5½\" and 3'0\" panels", () => {
    // The arithmetic the whole stage rests on: 41.5 + 36 = 77.5in = 6'5½".
    const slots = [standard(25.5), standard(ADU_E4B_IN), standard(ADU_E4C_IN), standard(30)];
    expect(spanningHeaderSpanWidthIn(slots, { startSlotIndex: 1, endSlotIndex: 3 })).toBe(77.5);
  });

  it("sums as integer eighths, so a span never lands a float-noise width on a cut list", () => {
    const slots = [standard(24.125), standard(24.125), standard(24.125)];
    expect(spanningHeaderSpanWidthIn(slots, { startSlotIndex: 0, endSlotIndex: 3 })).toBe(72.375);
  });

  it("counts only the slots that are really there when a range overhangs the array", () => {
    const slots = [standard(40), standard(40)];
    expect(spanningHeaderSpanWidthIn(slots, { startSlotIndex: 0, endSlotIndex: 5 })).toBe(80);
    expect(spanningHeaderCoveredSlotCount(slots, { startSlotIndex: 0, endSlotIndex: 5 })).toBe(2);
    expect(spanningHeaderCoveredSlotCount(slots, { startSlotIndex: 3, endSlotIndex: 5 })).toBe(0);
  });
});

describe("resolveSpanningHeaderPlacement", () => {
  const slots = [standard(25.5), standard(ADU_E4B_IN), standard(ADU_E4C_IN), standard(30), standard(25.5)];

  it("accepts the ADU's own two-panel span and reports its width", () => {
    const result = resolveSpanningHeaderPlacement(slots, { startSlotIndex: 1, endSlotIndex: 3 }, [], LIMITS);
    expect(result).toEqual({ outcome: "ok", spanWidthIn: 77.5, coveredSlotCount: 2 });
  });

  it("adds NO width to the wall — the slot array it was asked about is untouched", () => {
    const before = slots.map((s) => ({ ...s }));
    const totalBefore = slots.reduce((sum, s) => sum + s.widthIn, 0);
    resolveSpanningHeaderPlacement(slots, { startSlotIndex: 1, endSlotIndex: 3 }, [], LIMITS);
    expect(slots).toEqual(before);
    expect(slots.reduce((sum, s) => sum + s.widthIn, 0)).toBe(totalBefore);
  });

  it("refuses a one-slot span — that is a zone within one column, not a spanning header", () => {
    expect(resolveSpanningHeaderPlacement(slots, { startSlotIndex: 1, endSlotIndex: 2 }, [], LIMITS)).toEqual({
      outcome: "refuse",
      reason: "single-slot-span",
    });
  });

  it("refuses a range off the end of the wall, an inverted range and a fractional index", () => {
    expect(resolveSpanningHeaderPlacement(slots, { startSlotIndex: 3, endSlotIndex: 9 }, [], LIMITS)).toEqual({
      outcome: "refuse",
      reason: "out-of-range",
    });
    expect(resolveSpanningHeaderPlacement(slots, { startSlotIndex: 3, endSlotIndex: 1 }, [], LIMITS)).toEqual({
      outcome: "refuse",
      reason: "out-of-range",
    });
    expect(resolveSpanningHeaderPlacement(slots, { startSlotIndex: 0.5, endSlotIndex: 3 }, [], LIMITS)).toEqual({
      outcome: "refuse",
      reason: "out-of-range",
    });
  });

  it("refuses a second header over a panel an existing one already covers", () => {
    const existing = [{ startSlotIndex: 1, endSlotIndex: 3 }];
    expect(resolveSpanningHeaderPlacement(slots, { startSlotIndex: 2, endSlotIndex: 4 }, existing, LIMITS)).toEqual({
      outcome: "refuse",
      reason: "overlaps-existing",
    });
    // Touching, not overlapping, is fine — half-open ranges meet at 3.
    expect(resolveSpanningHeaderPlacement(slots, { startSlotIndex: 3, endSlotIndex: 5 }, existing, LIMITS).outcome).toBe("ok");
  });

  it("refuses a span under the catalog minimum and QUOTES the numbers", () => {
    const narrow = [standard(24), standard(23.5), standard(40)];
    const result = resolveSpanningHeaderPlacement(narrow, { startSlotIndex: 0, endSlotIndex: 2 }, [], LIMITS);
    expect(result).toEqual({ outcome: "refuse", reason: "span-out-of-range", spanWidthIn: 47.5, minIn: 48, maxIn: 144 });
  });

  it("REFUSES a span past 12ft rather than widening the range to fit the drawing", () => {
    // `bigHeaderWidthInRange` is Tommy's own stated range and is
    // `pending-BI-confirmation`. The spec is explicit that a later job
    // spanning further does NOT get the range widened to accommodate it —
    // the app refuses and reports. This test is that promise.
    const wide = [standard(48), standard(48), standard(48), standard(1)];
    const result = resolveSpanningHeaderPlacement(wide, { startSlotIndex: 0, endSlotIndex: 4 }, [], LIMITS);
    expect(result).toEqual({ outcome: "refuse", reason: "span-out-of-range", spanWidthIn: 145, minIn: 48, maxIn: 144 });
  });

  it("accepts a span of exactly the maximum", () => {
    const wide = [standard(48), standard(48), standard(48)];
    expect(resolveSpanningHeaderPlacement(wide, { startSlotIndex: 0, endSlotIndex: 3 }, [], LIMITS)).toEqual({
      outcome: "ok",
      spanWidthIn: 144,
      coveredSlotCount: 3,
    });
  });

  it("refuses a header whose top would push through the top plate", () => {
    const result = resolveSpanningHeaderPlacement(slots, { startSlotIndex: 1, endSlotIndex: 3 }, [], LIMITS, {
      heightIn: 100,
      assemblyHeightIn: 24,
      storyHeightIn: 120,
    });
    expect(result).toEqual({ outcome: "refuse", reason: "taller-than-story", headerTopIn: 124, storyHeightIn: 120 });
  });

  it("refuses a header height outside the catalog's own header height range", () => {
    const tooShort = resolveSpanningHeaderPlacement(slots, { startSlotIndex: 1, endSlotIndex: 3 }, [], LIMITS, {
      heightIn: 0,
      assemblyHeightIn: 12,
      storyHeightIn: 120,
    });
    expect(tooShort.outcome).toBe("refuse");
    const tooTall = resolveSpanningHeaderPlacement(slots, { startSlotIndex: 1, endSlotIndex: 3 }, [], LIMITS, {
      heightIn: 0,
      assemblyHeightIn: 60,
      storyHeightIn: 120,
    });
    expect(tooTall.outcome).toBe("refuse");
  });

  it("accepts a header sitting exactly flush with the top plate", () => {
    const result = resolveSpanningHeaderPlacement(slots, { startSlotIndex: 1, endSlotIndex: 3 }, [], LIMITS, {
      heightIn: 96,
      assemblyHeightIn: 24,
      storyHeightIn: 120,
    });
    expect(result.outcome).toBe("ok");
  });
});

describe("defaultSpanningHeaderBottomHeightIn", () => {
  it("births the header hard against the top of the story", () => {
    expect(defaultSpanningHeaderBottomHeightIn(120, 24)).toBe(96);
  });

  it("never returns a negative bottom face", () => {
    expect(defaultSpanningHeaderBottomHeightIn(12, 24)).toBe(0);
  });
});

describe("slotRangesOverlap", () => {
  it("treats half-open ranges that merely touch as not overlapping", () => {
    expect(slotRangesOverlap({ startSlotIndex: 0, endSlotIndex: 2 }, { startSlotIndex: 2, endSlotIndex: 4 })).toBe(false);
    expect(slotRangesOverlap({ startSlotIndex: 0, endSlotIndex: 3 }, { startSlotIndex: 2, endSlotIndex: 4 })).toBe(true);
  });
});

describe("a spanning header reuses the Mid-Wall Bond Beam band machinery unchanged", () => {
  // This is the point of the whole model: `SpanningHeaderGeometry` is
  // structurally `MidWallBeamGeometry`, so `computeWallVerticalBandsForSlot`
  // shortens the panels beneath a header with no change to that function and
  // no second copy of the banding rules.
  const header: SpanningHeaderGeometry = { startSlotIndex: 1, endSlotIndex: 3, heightIn: 96, assemblyHeightIn: 24 };

  it("shortens exactly the covered slots, from the top down", () => {
    const covered = computeWallVerticalBandsForSlot(1, 120, [header]);
    expect(covered).toEqual([{ bandIndex: 0, bottomIn: 0, topIn: 96 }]);
    expect(computeWallVerticalBandsForSlot(2, 120, [header])).toEqual([{ bandIndex: 0, bottomIn: 0, topIn: 96 }]);
  });

  it("leaves every slot outside the span at full story height", () => {
    expect(computeWallVerticalBandsForSlot(0, 120, [header])).toEqual([{ bandIndex: 0, bottomIn: 0, topIn: 120 }]);
    expect(computeWallVerticalBandsForSlot(3, 120, [header])).toEqual([{ bandIndex: 0, bottomIn: 0, topIn: 120 }]);
  });

  it("stacks with a mid-wall beam on the same slot instead of fighting it", () => {
    const beam = { startSlotIndex: 0, endSlotIndex: 4, heightIn: 48, assemblyHeightIn: 10.5 };
    const bands = computeWallVerticalBandsForSlot(1, 120, [beam, header]);
    expect(bands).toEqual([
      { bandIndex: 0, bottomIn: 0, topIn: 48 },
      { bandIndex: 1, bottomIn: 58.5, topIn: 96 },
    ]);
  });
});
