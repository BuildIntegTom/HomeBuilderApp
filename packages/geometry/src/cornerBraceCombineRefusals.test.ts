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

  it("the entry is about POSITION, not width: it never NAMES a brace the tiler did not already leave sub-minimum", () => {
    // Sweeping the space the refusal actually lives in. The claim this test used
    // to make — "the reported brace is never a sub-minimum panel" — is no longer
    // true as stated, and the honest version is stronger rather than weaker:
    // **this entry never reports a sub-minimum brace that the TILER had not
    // already put on the wall**, so nobody can read the entry as a width defect
    // it caused.
    //
    // ⚠ **What changed, 2026-10-01.** Every run now reserves a safety gap, so a
    // wall whose openings have eaten all but a sliver of its middle spends 1/2in
    // of that sliver on the gap and leaves the rest as the panel — the tiler's own
    // documented residual case 2 ("openings eating all but a sliver of a long
    // wall's middle", nothing to absorb into, reported not corrected). It was
    // already emitting a sub-minimum panel there before this pass; the panel is
    // now 1/2in narrower and, because the wall now HAS a gap, the corner walk
    // reaches it and the refusal names it. Measured on this grid: **382 of the
    // 3,202 cases**, every one of them a wall the tiler had already left
    // sub-minimum.
    const openings: OpeningAnchor[] = [{ beforeStandardCount: 0, type: "window", widthIn: 61.5 }];
    let cases = 0;
    let subMinimumReported = 0;
    for (let e = Math.round(100 * 8); e <= Math.round(300 * 8); e++) {
      const wallLengthIn = e / 8;
      for (const standardWidthIn of [39, 48]) {
        cases++;
        const tiled = retileWithOpenings(wallLengthIn, standardWidthIn, CORNER_WIDTH_IN, "end", true, true, openings).slots;
        // What the TILER alone left, before any brace placement: is there already
        // a panel here the shop cannot build?
        const tilerAlreadySubMinimum = tiled.some(
          (s) => (s.type === "standard" || s.type === "braced") && s.widthIn < TILER_MIN_PANEL_WIDTH_IN,
        );
        const braced = applyBracedPlacement(tiled, SEISMIC_SPACING_IN, standardWidthIn, "chevron", false);
        for (const entry of findCornerBraceCombineRefusals({ w: braced })) {
          if (entry.braceSlotIndex === null) continue;
          const slot = braced[entry.braceSlotIndex]!;
          if (slot.widthIn >= TILER_MIN_PANEL_WIDTH_IN) continue;
          subMinimumReported++;
          // The load-bearing assertion: this entry never invented it.
          expect(tilerAlreadySubMinimum).toBe(true);
        }
      }
    }
    expect(cases).toBe(3_202);
    expect(subMinimumReported).toBe(382);
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
    // ⚠ **RE-MEASURED 2026-10-01 for the two-tier safety gap, and every count in
    // this census moved.** The old figures (left beside each new one) were taken
    // when a run of 144in or less got NO safety gap at all, so the corner walk on
    // a short run had no plain gap to reach and no refusal to report. Now every
    // run reserves one, so short runs join the census wholesale.
    //
    // **The sweep is a `retileWithOpenings` sweep with hasCornerStart/End passed
    // in explicitly, so the corner-ownership flip of the same day cannot touch
    // it** — and the proof of that is in the histogram below: every
    // WIDE-gap offset (62¼in, 36¾in, 80¾in, 30¾in) comes back bit-identical to
    // its old count, and every new entry is its NARROW-gap twin a quarter inch
    // nearer the corner. The census is doing what it was built to do.
    //
    // "75,480 of 100,451 refusal walls own at least one corner" (was 28,979 of
    // 32,644).
    expect(refusalWalls).toBe(100_451);
    expect(refusalWallsOwningACorner).toBe(75_480);
    // "on 14,972 measured walls the wall goes from two braced panels to one"
    // (was 6,152).
    expect(sharedWalls).toBe(14_972);
    // "50,269 refused corner ends, of which 25,888 are the gap step. 20,129 of
    // those are dropped here — the other 5,759 report anyway because their brace
    // is shared — leaving 30,140 reported ends." (Was 21,080 / 9,118 / 7,853 /
    // 1,265 / 13,227.)
    expect(refusedEnds).toBe(50_269);
    expect(reportedEnds).toBe(30_140);
    expect(stepEnds).toBe(5_759); // the gap-step ends that report anyway
    expect(reportedEnds + (25_888 - stepEnds)).toBe(refusedEnds); // 30,140 + 20,129 dropped = 50,269
    // The histogram, in two halves that say the whole story:
    //   - WIDE-gap (3/4in) offsets, every one UNCHANGED from the 2026-09-30
    //     census: 6,559 at 62¼in, 4,064 at 36¾in, 1,100 at 80¾in, 95 at 30¾in;
    //   - NARROW-gap (1/2in) offsets, all NEW, each a quarter inch nearer the
    //     corner than its twin: 2,098 at 62in, 5,490 at 36½in, 1,212 at 80½in,
    //     3,091 at 30½in;
    //   - the gap step itself, reported only when the brace is shared: 1,265 at
    //     3/4in (unchanged) and 4,494 at 1/2in (new);
    //   - and 672 ends with no brace anywhere on the wall at all (was 144).
    expect(Object.fromEntries([...offsets].sort((a, b) => b[1] - a[1]))).toEqual({
      "62.25": 6_559,
      "36.5": 5_490,
      "0.5": 4_494,
      "36.75": 4_064,
      "30.5": 3_091,
      "62": 2_098,
      "0.75": 1_265,
      "80.5": 1_212,
      "80.75": 1_100,
      "no brace on the wall": 672,
      "30.75": 95,
    });
  }, 120_000);
});
