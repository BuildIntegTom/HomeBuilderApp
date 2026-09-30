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

  it("two identically-tiled walls each get their OWN record — everything that tells them apart is the wall id", () => {
    // The symmetric-rectangle case. A plain rectangle's north and south walls
    // have the same length, the same openings and therefore the same tiling,
    // so every number on the record — the slot indices, the offset, the gap
    // width, the brace count — is identical between them. The ONLY field that
    // differs is `wallId`, which is why the Review Log note in `page.tsx`
    // interpolates it: that note is deduped on its own text, so a note that
    // does not name its wall makes one of the two walls invisible.
    const slots: PanelSlot[] = [
      { type: "corner", widthIn: CORNER_WIDTH_IN },
      { type: "safety-gap", widthIn: 0.75 },
      { type: "window", widthIn: 61.5 },
      { type: "braced", widthIn: 40 },
      { type: "corner", widthIn: CORNER_WIDTH_IN },
    ];
    const found = findCornerBraceCombineRefusals({ AB: slots, CD: slots.map((s) => ({ ...s })) });
    expect(found).toHaveLength(2);
    expect(found.map((f) => f.wallId)).toEqual(["AB", "CD"]);
    // Identical in every other respect — stated rather than implied, because
    // that identity IS the collision.
    const withoutWallId = ({ wallId: _id, ...rest }: (typeof found)[number]) => rest;
    expect(withoutWallId(found[0]!)).toEqual(withoutWallId(found[1]!));
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

// ---------------------------------------------------------------------------
// THE CENSUS THE DOC COMMENT QUOTES.
//
// `cornerBraceCombineRefusals.ts`'s own doc comment is the honest record of
// what this entry costs and what it deliberately drops, and every count in it
// comes from ONE sweep — the 790,440-wall product sweep `bracedPlacement.test.
// ts` runs. Those numbers used to live only in prose, which is how the first
// half of that comment ended up quoting a smaller sweep's figures beside this
// one's. They are asserted here instead, so a number that moves fails a test
// rather than quietly becoming wrong.
//
// The ONE figure in that comment this file cannot pin is the "13,355 walls
// carry one fewer braced panel than before the 2026-09-29 rewrite" delta: it
// is a comparison against an implementation that no longer exists in the tree
// (commit b714fdb). It is labelled as dated in the comment for that reason.
// ---------------------------------------------------------------------------
describe("the doc comment's census, measured on the 790,440-wall product sweep", () => {
  const SWEEP_SPACING_IN = 96;
  const win = (beforeStandardCount: number, widthIn: number): OpeningAnchor => ({ beforeStandardCount, type: "window", widthIn });
  // The same seven sets, four corner configs and three standard widths the
  // product sweep uses. Restated rather than shared because the two files test
  // different things about the same space, and a shared fixture that drifted
  // would silently re-base both.
  const OPENING_SETS: OpeningAnchor[][] = [
    [],
    [win(0, 61.5)],
    [win(0, 61.5), win(1, 61.5)],
    [win(1, 36)],
    [win(0, 36), win(2, 36)],
    [win(0, 30)],
    [win(1, 80)],
  ];
  const CORNER_CONFIGS: [boolean, boolean][] = [
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ];
  const isCornerSlot = (s: PanelSlot | undefined) => s?.type === "corner" || s?.type === "safety-oct-corner";
  const carries = (s: PanelSlot) => s.type === "braced" || s.secondaryType === "braced";

  /** Did a rule-1 corner walk actually REACH a plain safety gap in this run —
   * that is, was the combine attempted here and refused? Mirrors
   * `applyBracedPlacement`'s own walk: a brace already in the way means the
   * walk stopped before the gap and nothing was ever attempted. */
  const walkReachedPlainGap = (list: PanelSlot[], from: "start" | "end") => {
    const step = from === "start" ? 1 : -1;
    for (let i = from === "start" ? 0 : list.length - 1; i >= 0 && i < list.length; i += step) {
      const slot = list[i]!;
      if (carries(slot)) return false;
      if (slot.type === "safety-gap" && slot.secondaryType === undefined) return true;
    }
    return false;
  };

  it("reproduces every count the doc comment quotes", () => {
    let cases = 0;
    let refusalWalls = 0;
    let refusalWallsOwningACorner = 0;
    let sharedWalls = 0;
    let refusedEnds = 0;
    let stepEnds = 0;
    let reportedEnds = 0;
    const offsets = new Map<string, number>();

    for (let e = Math.round(12 * 8); e <= Math.round(600 * 8); e++) {
      const wallLengthIn = e / 8;
      for (const standardWidthIn of [39, 40, 48]) {
        for (const [hasStart, hasEnd] of CORNER_CONFIGS) {
          for (const gapEnd of ["start", "end"] as const) {
            for (const openings of OPENING_SETS) {
              cases++;
              const tiled = retileWithOpenings(wallLengthIn, standardWidthIn, CORNER_WIDTH_IN, gapEnd, hasStart, hasEnd, openings).slots;
              const braced = applyBracedPlacement(tiled, SWEEP_SPACING_IN, standardWidthIn, "chevron", false);
              if (walkReachedPlainGap(braced, "start") || walkReachedPlainGap(braced, "end")) {
                refusalWalls++;
                if (braced.some(isCornerSlot)) refusalWallsOwningACorner++;
              }
              // Refused ENDS counts every corner end the walk stepped a plain
              // gap at, BEFORE the 3/4in step is dropped; `found` is what
              // actually reaches a reader.
              for (const from of ["start", "end"] as const) {
                const anchor = from === "start" ? braced[0] : braced[braced.length - 1];
                if (!isCornerSlot(anchor)) continue;
                if (walkReachedPlainGap(braced, from)) refusedEnds++;
              }
              const found = findCornerBraceCombineRefusals({ w: braced });
              if (found.some((f) => f.braceSharedWithOtherCorner)) sharedWalls++;
              for (const f of found) {
                reportedEnds++;
                const key = f.braceOffsetFromCornerIn === null ? "no brace on the wall" : String(f.braceOffsetFromCornerIn);
                offsets.set(key, (offsets.get(key) ?? 0) + 1);
                if (f.braceOffsetFromCornerIn === f.gapWidthIn) stepEnds++;
              }
            }
          }
        }
      }
    }

    expect(cases).toBe(790_440);
    // "28,979 of 32,644 refusal walls own at least one corner".
    expect(refusalWalls).toBe(32_644);
    expect(refusalWallsOwningACorner).toBe(28_979);
    // "on 6,152 measured walls the wall goes from two braced panels to one".
    expect(sharedWalls).toBe(6_152);
    // "21,080 refused corner ends, of which 9,118 are that 3/4in step. 7,853
    // of those are dropped here — the other 1,265 report anyway because their
    // brace is shared — leaving 13,227 reported ends."
    expect(refusedEnds).toBe(21_080);
    expect(reportedEnds).toBe(13_227);
    expect(stepEnds).toBe(1_265); // the 3/4in-step ends that report anyway
    expect(reportedEnds + (9_118 - stepEnds)).toBe(refusedEnds); // 13,227 + 7,853 dropped = 21,080
    // "6,559 whose brace sits 62-1/4in in from the corner, 4,064 at 36-3/4in,
    // 1,100 at 80-3/4in, 95 at 30-3/4in, and 144 with no brace anywhere on the
    // wall at all" — plus the 1,265 shared ends at the 3/4in step itself.
    expect(Object.fromEntries([...offsets].sort((a, b) => b[1] - a[1]))).toEqual({
      "62.25": 6_559,
      "36.75": 4_064,
      "0.75": 1_265,
      "80.75": 1_100,
      "no brace on the wall": 144,
      "30.75": 95,
    });
  }, 120_000);
});
