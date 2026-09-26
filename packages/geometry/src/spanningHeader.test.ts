import { describe, expect, it } from "vitest";
import { applyZonesToSlot } from "./panelSlotZones";
import type { SlotIndexRange } from "./panelPlacement";
import { computeWallVerticalBandsForSlot, type MidWallBeamGeometry } from "./wallVerticalBands";
import {
  defaultSpanningHeaderBottomHeightIn,
  resolveSpanningHeaderPlacement,
  slotRangesOverlap,
  spanningHeaderCoveredSlotCount,
  spanningHeaderOpeningConflicts,
  spanningHeaderSpanOutOfRange,
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

describe("spanningHeaderSpanOutOfRange — a span that changed under the header, not at the point of edit", () => {
  // The hazard: the width is DERIVED, so the panels can change without the
  // header being touched. Every one of these cases is a stored record that was
  // legal when it was committed.
  it("says nothing while the stored range still measures a buildable span", () => {
    const slots = [standard(25.5), standard(ADU_E4B_IN), standard(ADU_E4C_IN), standard(30)];
    expect(spanningHeaderSpanOutOfRange(slots, { startSlotIndex: 1, endSlotIndex: 3 }, LIMITS)).toBeNull();
  });

  it("reports a span that a panel DELETE to the left grew past the 144in maximum", () => {
    // Exactly the harness's own finding, pushed further: the shift moves the
    // range correctly and the width moves with it. 48+48+48 = 144 is legal;
    // one wider panel under the same two-index range is not.
    const slots = [standard(48), standard(72), standard(80), standard(48)];
    expect(spanningHeaderSpanOutOfRange(slots, { startSlotIndex: 1, endSlotIndex: 3 }, LIMITS)).toEqual({
      spanWidthIn: 152,
      minIn: 48,
      maxIn: 144,
    });
  });

  it("reports a span that fell UNDER the 48in minimum, which is the re-tile case", () => {
    // A corner-band re-tile can replace one wide middle panel with two narrow
    // corner panels, leaving the same two-index range measuring much less.
    const slots = [standard(25.5), standard(12), standard(12), standard(25.5)];
    expect(spanningHeaderSpanOutOfRange(slots, { startSlotIndex: 1, endSlotIndex: 3 }, LIMITS)).toEqual({
      spanWidthIn: 24,
      minIn: 48,
      maxIn: 144,
    });
  });

  it("is computed from the CURRENT slots, so it does not care which edit caused the change", () => {
    // The design requirement, asserted: the same stored range flags or does
    // not flag purely on what is under it now. A re-tile route nobody has
    // written yet is covered by construction.
    const range = { startSlotIndex: 0, endSlotIndex: 2 };
    expect(spanningHeaderSpanOutOfRange([standard(40), standard(40)], range, LIMITS)).toBeNull();
    expect(spanningHeaderSpanOutOfRange([standard(40), standard(4)], range, LIMITS)).toEqual({
      spanWidthIn: 44,
      minIn: 48,
      maxIn: 144,
    });
  });

  it("catches the re-tile that makes a wall LONGER — a wall absorbing its neighbour", () => {
    // The re-tile route this flag genuinely covers: `absorbedCornerWalls`,
    // where a wall swallows its neighbour and re-tiles wider panels under a
    // stored range. 3 x 40in is fine; 3 x 50in is a 150in header, past the
    // 144in maximum a placement quotes, with nobody having touched the header.
    const range = { startSlotIndex: 0, endSlotIndex: 3 };
    expect(spanningHeaderSpanOutOfRange([standard(40), standard(40), standard(40)], range, LIMITS)).toBeNull();
    expect(spanningHeaderSpanOutOfRange([standard(50), standard(50), standard(50)], range, LIMITS)).toEqual({
      spanWidthIn: 150,
      minIn: 48,
      maxIn: 144,
    });
  });

  it("CANNOT catch the 51-75in two-corner absorb — that sub-route is guarded by the stranded flag instead", () => {
    // Written down because the spec once implied the opposite. On the
    // 51-75in two-corner dead-band re-tile each corner panel is bounded to
    // [25.5, 37.4375]in, so the pair's total is always inside [51, 74.875]in
    // — inside 48-144 at both ends, so no out-of-range flag is reachable
    // there however the wall re-tiles. A reader who trusts this flag for that
    // route is trusting the wrong safeguard.
    const range = { startSlotIndex: 0, endSlotIndex: 2 };
    const CORNER_MIN_IN = 25.5;
    const CORNER_MAX_IN = 37.4375;
    expect(spanningHeaderSpanOutOfRange([standard(CORNER_MIN_IN), standard(CORNER_MIN_IN)], range, LIMITS)).toBeNull();
    expect(spanningHeaderSpanOutOfRange([standard(CORNER_MAX_IN), standard(CORNER_MAX_IN)], range, LIMITS)).toBeNull();
  });

  it("quotes the range's own numbers back rather than a rounded pair", () => {
    // The range is pending BI confirmation and is never widened to fit — so
    // whatever is reported has to be the catalog's own figures.
    const reported = spanningHeaderSpanOutOfRange([standard(10), standard(10)], { startSlotIndex: 0, endSlotIndex: 2 }, LIMITS);
    expect(reported?.minIn).toBe(LIMITS.minSpanIn);
    expect(reported?.maxIn).toBe(LIMITS.maxSpanIn);
  });
});

describe("spanningHeaderOpeningConflicts — Tommy allowed spanning an opening, so this reports the one bad corner of it", () => {
  const OPENING_DEFAULTS = { windowSillHeightIn: 36, windowHeightIn: 48, doorRoughOpeningHeightIn: 82 };
  const window = (widthIn: number, extra: Partial<PanelSlot> = {}): PanelSlot => ({ type: "window", widthIn, ...extra });
  const STORY_IN = 120;

  /**
   * The band inputs a real header produces, built the way the app builds them:
   * the header itself is part of the wall's own band-producing geometry (that
   * is `wallBandGeometry`'s job), so the band beneath it is capped at its
   * bottom face. `assemblyHeightIn` defaults to "up to the top plate", which
   * is where `defaultSpanningHeaderBottomHeightIn` puts a fresh header.
   */
  const bandsFor = (
    headerBottomIn: number,
    range: SlotIndexRange,
    options: { beams?: MidWallBeamGeometry[]; maxPanelHeightIn?: number; assemblyHeightIn?: number } = {},
  ) => ({
    storyHeightIn: STORY_IN,
    bandGeometry: [
      ...(options.beams ?? []),
      { ...range, heightIn: headerBottomIn, assemblyHeightIn: options.assemblyHeightIn ?? STORY_IN - headerBottomIn },
    ],
    maxPanelHeightIn: options.maxPanelHeightIn ?? Number.POSITIVE_INFINITY,
    minRemainderHeightIn: 0,
  });

  it("says nothing when the band beneath the header still clears the window", () => {
    const slots = [standard(25.5), window(41.5), standard(36), standard(30)];
    const range = { startSlotIndex: 1, endSlotIndex: 3 };
    // Sill 36 + RO 48 = 84 < the 96in band a 24in header leaves in a 120in story.
    expect(spanningHeaderOpeningConflicts(slots, range, bandsFor(96, range), OPENING_DEFAULTS)).toEqual([]);
  });

  it("reports a window whose rough opening now reaches past the header's own bottom face", () => {
    const slots = [standard(25.5), window(41.5), standard(36)];
    const range = { startSlotIndex: 1, endSlotIndex: 3 };
    // A header bottom at 72in leaves a 72in panel under a window topping out
    // at 84in: the window's own header collapses to nothing.
    expect(spanningHeaderOpeningConflicts(slots, range, bandsFor(72, range), OPENING_DEFAULTS)).toEqual([
      { slotIndex: 1, zoneIndex: 0, openingType: "window", openingTopIn: 84, bandHeightIn: 72 },
    ]);
  });

  it("reads each window's OWN sill and RO height, not just the project defaults", () => {
    const slots = [window(41.5, { sillHeightIn: 12, heightIn: 24 }), window(41.5, { sillHeightIn: 60, heightIn: 48 })];
    const range = { startSlotIndex: 0, endSlotIndex: 2 };
    expect(spanningHeaderOpeningConflicts(slots, range, bandsFor(96, range), OPENING_DEFAULTS)).toEqual([
      { slotIndex: 1, zoneIndex: 0, openingType: "window", openingTopIn: 108, bandHeightIn: 96 },
    ]);
  });

  it("catches a door too — a door's RO starts at the floor and is tall", () => {
    const slots = [standard(25.5), { type: "door" as const, widthIn: 40 }, standard(36)];
    const range = { startSlotIndex: 1, endSlotIndex: 3 };
    expect(spanningHeaderOpeningConflicts(slots, range, bandsFor(78, range), OPENING_DEFAULTS)).toEqual([
      { slotIndex: 1, zoneIndex: 0, openingType: "door", openingTopIn: 82, bandHeightIn: 78 },
    ]);
  });

  it("treats an opening ending exactly at the header's bottom face as fitting", () => {
    // Zero clearance is a real detail the shop can build; a NEGATIVE one is
    // the thing being reported. The boundary is compared in eighths.
    const slots = [window(41.5, { sillHeightIn: 36, heightIn: 48 }), standard(36)];
    const range = { startSlotIndex: 0, endSlotIndex: 2 };
    expect(spanningHeaderOpeningConflicts(slots, range, bandsFor(84, range), OPENING_DEFAULTS)).toEqual([]);
    expect(spanningHeaderOpeningConflicts(slots, range, bandsFor(83.875, range), OPENING_DEFAULTS)).toHaveLength(1);
  });

  it("ignores slots outside the span, and slots that are not openings at all", () => {
    const slots = [window(41.5), standard(36), window(41.5)];
    const range = { startSlotIndex: 1, endSlotIndex: 3 };
    expect(spanningHeaderOpeningConflicts(slots, range, bandsFor(12, range), OPENING_DEFAULTS)).toEqual([
      { slotIndex: 2, zoneIndex: 0, openingType: "window", openingTopIn: 84, bandHeightIn: 12 },
    ]);
  });

  it("finds an opening in a NON-BOTTOM zone, which reading only zones[0] could not", () => {
    // ⚠ The defect this check shipped with, driven by the code review. A
    // Mid-Wall Bond Beam has already split these columns, so the band the
    // header caps is the UPPER one — `zones[1]` — and the window in it was
    // invisible while only the slot's top-level (= zones[0]) fields were read.
    // Beam bottom 48in, 12in assembly, header bottom 96in, 120in story:
    // bands are [0-48] and [60-96], so the upper panel is 36in tall and a
    // window topping out at 108in inside it has no header left at all.
    const range = { startSlotIndex: 0, endSlotIndex: 2 };
    const beam: MidWallBeamGeometry = { ...range, heightIn: 48, assemblyHeightIn: 12 };
    const split = (widthIn: number): PanelSlot =>
      applyZonesToSlot({ type: "standard", widthIn }, [
        { type: "standard" },
        { type: "window", sillHeightIn: 60, heightIn: 48 },
      ]);
    const slots = [split(41.5), split(36)];
    expect(spanningHeaderOpeningConflicts(slots, range, bandsFor(96, range, { beams: [beam] }), OPENING_DEFAULTS)).toEqual([
      { slotIndex: 0, zoneIndex: 1, openingType: "window", openingTopIn: 108, bandHeightIn: 36 },
      { slotIndex: 1, zoneIndex: 1, openingType: "window", openingTopIn: 108, bandHeightIn: 36 },
    ]);
  });

  it("finds it with no beam at all, once maxPanelHeightIn splits the band beneath the header", () => {
    // The same gap without a beam: a 96in band under the header, subdivided at
    // 60in, leaves [0-60] and [60-96]. The upper zone's own 36in panel cannot
    // hold a window that tops out at 48in.
    const range = { startSlotIndex: 0, endSlotIndex: 2 };
    const split = (widthIn: number): PanelSlot =>
      applyZonesToSlot({ type: "standard", widthIn }, [{ type: "standard" }, { type: "window", sillHeightIn: 12, heightIn: 36 }]);
    const slots = [split(41.5), split(36)];
    const conflicts = spanningHeaderOpeningConflicts(slots, range, bandsFor(96, range, { maxPanelHeightIn: 60 }), OPENING_DEFAULTS);
    expect(conflicts).toEqual([
      { slotIndex: 0, zoneIndex: 1, openingType: "window", openingTopIn: 48, bandHeightIn: 36 },
      { slotIndex: 1, zoneIndex: 1, openingType: "window", openingTopIn: 48, bandHeightIn: 36 },
    ]);
  });

  it("compares band-LOCAL heights, so the same window fits in a tall band and not in a short one", () => {
    // The trap on the other side of the fix: a zone's sill height is measured
    // from its OWN band's bottom (that is how the elevation and the member
    // builders read it), never from the story floor. Compared against a
    // floor-relative band TOP, the upper zone here would look fine.
    const range = { startSlotIndex: 0, endSlotIndex: 2 };
    const slots = [
      applyZonesToSlot({ type: "standard", widthIn: 41.5 }, [{ type: "standard" }, { type: "window", sillHeightIn: 12, heightIn: 48 }]),
      standard(36),
    ];
    // Beam bottom 48 (12in assembly), header bottom 96 → bands [0-48], [60-96].
    // The upper panel is 36in tall and the window inside it runs to 60in: a
    // conflict. Against the band's floor-relative TOP (96in) it would look
    // fine, which is the bug this asserts against.
    expect(
      spanningHeaderOpeningConflicts(
        slots,
        range,
        bandsFor(96, range, { beams: [{ ...range, heightIn: 48, assemblyHeightIn: 12 }] }),
        OPENING_DEFAULTS,
      ),
    ).toEqual([{ slotIndex: 0, zoneIndex: 1, openingType: "window", openingTopIn: 60, bandHeightIn: 36 }]);
    // The same window in a TALLER upper band clears: beam bottom 24, header
    // bottom 108 → bands [0-24], [36-108], a 72in panel.
    expect(
      spanningHeaderOpeningConflicts(
        slots,
        range,
        bandsFor(108, range, { beams: [{ ...range, heightIn: 24, assemblyHeightIn: 12 }] }),
        OPENING_DEFAULTS,
      ),
    ).toEqual([]);
  });

  it("reports nothing for a slot whose whole height a beam consumes — there is no panel there", () => {
    const range = { startSlotIndex: 0, endSlotIndex: 2 };
    const beam: MidWallBeamGeometry = { ...range, heightIn: 0, assemblyHeightIn: STORY_IN };
    const slots = [window(41.5), window(36)];
    expect(spanningHeaderOpeningConflicts(slots, range, bandsFor(96, range, { beams: [beam] }), OPENING_DEFAULTS)).toEqual([]);
  });
});
