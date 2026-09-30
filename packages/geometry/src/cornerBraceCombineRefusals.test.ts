import { describe, expect, it } from "vitest";
import { applyBracedPlacement } from "./bracedPlacement";
import { findCornerBraceCombineRefusals } from "./cornerBraceCombineRefusals";
import { retileWithOpenings, TILER_MIN_PANEL_WIDTH_IN, tileWall, type OpeningAnchor } from "./tiling";
import type { PanelSlot } from "./types";

const CORNER_WIDTH_IN = 25.5;
/** 8ft, the high-seismic figure. Test INPUT only — the real value comes from
 * `seismicBracedPanelSpacingFt`, which is `pending-BI-confirmation`. */
const SEISMIC_SPACING_IN = 96;

describe("findCornerBraceCombineRefusals", () => {
  it("reports nothing on a wall whose combine FIRED — the gap carries the brace, so no corner walk steps over a plain gap", () => {
    const { slots } = tileWall(145, 48, CORNER_WIDTH_IN, "end", true, true);
    const braced = applyBracedPlacement(slots, 300, 48, "chevron", false);
    expect(braced.some((s) => s.type === "safety-gap" && s.secondaryType === "braced")).toBe(true);
    expect(findCornerBraceCombineRefusals({ "wall-N": braced })).toEqual([]);
  });

  it("reports nothing on an ordinary long wall, whose corner walks never reach the gap at all", () => {
    const { slots } = tileWall(480, 48, CORNER_WIDTH_IN, "end", true, true);
    const braced = applyBracedPlacement(slots, SEISMIC_SPACING_IN, 48, "chevron", false);
    expect(findCornerBraceCombineRefusals({ "wall-N": braced })).toEqual([]);
  });

  it("names the 144-1/8in wall where ONE brace ends up serving BOTH corners — the case only an engineer can bless", () => {
    // The refusal example from the 2026-09-29 review, reproduced: a 144.125in
    // wall owning both corners with a 61.5in window against the start corner
    // and a 39in standard. The combine cannot be paid for, so the safety gap
    // stays a 3/4in spacer and the run's single braced panel is all there is.
    const openings: OpeningAnchor[] = [{ beforeStandardCount: 0, type: "window", widthIn: 61.5 }];
    const tiled = retileWithOpenings(144.125, 39, CORNER_WIDTH_IN, "end", true, true, openings).slots;
    const braced = applyBracedPlacement(tiled, SEISMIC_SPACING_IN, 39, "chevron", false);
    // The wall is LEGAL — that is the whole point of the fix it reports on.
    expect(braced.reduce((a, s) => a + Math.round(s.widthIn * 8), 0)).toBe(Math.round(144.125 * 8));
    expect(braced.some((s) => s.widthIn === 0)).toBe(false);

    const found = findCornerBraceCombineRefusals({ "wall-N": braced });
    expect(found).toHaveLength(1);
    const [entry] = found;
    expect(entry).toMatchObject({
      wallId: "wall-N",
      end: "start",
      braceSharedWithOtherCorner: true,
      bracedPanelCountOnWall: 1,
    });
    // The brace is not "adjacent but one": it is the far side of a 61.5in
    // window plus the 3/4in spacer.
    expect(entry!.braceOffsetFromCornerIn).toBe(62.25);
    expect(entry!.gapWidthIn).toBe(0.75);
  });

  it("drops the 3/4in step — a brace on the very next panel across the spacer is the refusal working", () => {
    const slots: PanelSlot[] = [
      { type: "corner", widthIn: CORNER_WIDTH_IN },
      { type: "safety-gap", widthIn: 0.75 },
      { type: "braced", widthIn: 40 },
      { type: "standard", widthIn: 40 },
      { type: "standard", widthIn: 40 },
      { type: "braced", widthIn: 40 },
      { type: "corner", widthIn: CORNER_WIDTH_IN },
    ];
    expect(findCornerBraceCombineRefusals({ "wall-N": slots })).toEqual([]);
  });

  it("reports the 3/4in step ANYWAY when that one brace is shared with the other corner", () => {
    const slots: PanelSlot[] = [
      { type: "corner", widthIn: CORNER_WIDTH_IN },
      { type: "safety-gap", widthIn: 0.75 },
      { type: "braced", widthIn: 40 },
      { type: "corner", widthIn: CORNER_WIDTH_IN },
    ];
    const found = findCornerBraceCombineRefusals({ "wall-N": slots });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ end: "start", braceSharedWithOtherCorner: true, bracedPanelCountOnWall: 1 });
  });

  it("reports an end with NO brace anywhere on the wall, with a null offset rather than a fake zero", () => {
    const slots: PanelSlot[] = [
      { type: "corner", widthIn: CORNER_WIDTH_IN },
      { type: "safety-gap", widthIn: 0.75 },
      { type: "standard", widthIn: 40 },
      { type: "corner", widthIn: CORNER_WIDTH_IN },
    ];
    // BOTH corners are unbraced here, so both ends report — and neither is
    // 'shared', because there is no brace to share. A null offset, never a
    // fake zero, which would read as 'the brace is right there'.
    const found = findCornerBraceCombineRefusals({ "wall-N": slots });
    expect(found.map((f) => f.end)).toEqual(["start", "end"]);
    for (const entry of found) {
      expect(entry.braceSlotIndex).toBeNull();
      expect(entry.braceOffsetFromCornerIn).toBeNull();
      expect(entry.braceSharedWithOtherCorner).toBe(false);
      expect(entry.bracedPanelCountOnWall).toBe(0);
    }
  });

  it("ignores an end with no corner panel — there is no corner panel there for a brace to touch", () => {
    const slots: PanelSlot[] = [
      { type: "safety-gap", widthIn: 0.75 },
      { type: "window", widthIn: 61.5 },
      { type: "standard", widthIn: 40 },
      { type: "braced", widthIn: 40 },
      { type: "corner", widthIn: CORNER_WIDTH_IN },
    ];
    const found = findCornerBraceCombineRefusals({ "wall-N": slots });
    // The END corner's own walk finds its brace immediately, with no gap
    // stepped over, so nothing reports. The start end has no corner at all.
    expect(found).toEqual([]);
  });

  it("reports both ends separately when each has its own refused gap", () => {
    const slots: PanelSlot[] = [
      { type: "corner", widthIn: CORNER_WIDTH_IN },
      { type: "safety-gap", widthIn: 0.75 },
      { type: "window", widthIn: 61.5 },
      { type: "braced", widthIn: 40 },
      { type: "safety-gap", widthIn: 0.75 },
      { type: "corner", widthIn: CORNER_WIDTH_IN },
    ];
    const found = findCornerBraceCombineRefusals({ "wall-N": slots });
    expect(found.map((f) => f.end)).toEqual(["start", "end"]);
    // One brace, reached from both ends, past an opening on one side.
    expect(found.every((f) => f.braceSharedWithOtherCorner)).toBe(true);
    expect(found[0]!.braceOffsetFromCornerIn).toBe(62.25);
    expect(found[1]!.braceOffsetFromCornerIn).toBe(0.75);
  });

  it("every reported brace is still a real fabricable panel — the entry is about POSITION, not width", () => {
    // Sweeping the space the refusal actually lives in: the reported brace is
    // never a sub-minimum panel, so nobody reads this entry as a width defect.
    const openings: OpeningAnchor[] = [{ beforeStandardCount: 0, type: "window", widthIn: 61.5 }];
    for (let e = Math.round(100 * 8); e <= Math.round(300 * 8); e++) {
      const wallLengthIn = e / 8;
      for (const standardWidthIn of [39, 48]) {
        const tiled = retileWithOpenings(wallLengthIn, standardWidthIn, CORNER_WIDTH_IN, "end", true, true, openings).slots;
        const braced = applyBracedPlacement(tiled, SEISMIC_SPACING_IN, standardWidthIn, "chevron", false);
        for (const entry of findCornerBraceCombineRefusals({ w: braced })) {
          if (entry.braceSlotIndex === null) continue;
          const slot = braced[entry.braceSlotIndex]!;
          expect(slot.widthIn).toBeGreaterThanOrEqual(TILER_MIN_PANEL_WIDTH_IN);
        }
      }
    }
  });
});
