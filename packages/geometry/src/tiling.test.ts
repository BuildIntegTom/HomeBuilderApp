import { describe, expect, it } from "vitest";
import {
  computeSillRunWidths,
  cornerBandMiddleIn,
  mergedCornerWidthIn,
  getOpeningAnchors,
  markSafetyCorner,
  NARROW_SAFETY_GAP_WIDTH_IN,
  nextPanelCycleState,
  retileWithOpenings,
  tileWall,
  TILER_MAX_PANEL_WIDTH_IN,
  TILER_MIN_PANEL_WIDTH_IN,
  WIDE_SAFETY_GAP_WIDTH_IN,
} from "./tiling";
import type { OpeningAnchor } from "./tiling";
import type { PanelSlot, WallEnd } from "./types";

describe("computeSillRunWidths", () => {
  it("returns a single sill sized to the RO when it's under the standard width", () => {
    expect(computeSillRunWidths(34, 40)).toEqual([34]);
  });

  it("splits into multiple even sills when the RO exceeds the standard width", () => {
    const widths = computeSillRunWidths(84, 40);
    expect(widths.length).toBeGreaterThan(1);
    const total = widths.reduce((s, w) => s + w, 0);
    expect(total).toBeCloseTo(84, 6);
    for (const w of widths) expect(w).toBeCloseTo(widths[0]!, 6); // evenly split
  });

  it("returns an empty array for a zero/negative RO width", () => {
    expect(computeSillRunWidths(0, 40)).toEqual([]);
    expect(computeSillRunWidths(-5, 40)).toEqual([]);
  });
});

describe("tileWall", () => {
  it("keeps the gap panel a fixed 3/4in wide, splitting the leftover evenly into 2 panels next to it, gap second-to-last", () => {
    // middle = 350-40(corners) = 310; minus the fixed 0.75in gap leaves
    // 309.25 for standards -> 7 fit (280) with a 29.25 remainder. Rather
    // than growing one panel to 69.25 (over the 40in standard width),
    // that budget splits evenly into 2 panels of 34.625 each (Tommy:
    // "have a panel break down into an additional panel if the length is
    // going to exceed standard panel width") — gapEnd='end': 5 plain
    // standards, then the 2 split ones, then the fixed 3/4in gap, then
    // the corner-touching standard, then corner.
    const result = tileWall(350, 40, 20, "end");
    expect(result.slots.map((s) => s.type)).toEqual([
      "corner",
      "standard",
      "standard",
      "standard",
      "standard",
      "standard",
      "standard",
      "standard",
      "safety-gap",
      "standard",
      "corner",
    ]);
    expect(result.slots.map((s) => s.widthIn)).toEqual([20, 40, 40, 40, 40, 40, 34.625, 34.625, 0.75, 40, 20]);
  });

  it("splits the leftover evenly into 2 panels next to the gap when it's under 2ft (gapEnd 'end')", () => {
    // middle = 330-40 = 290; minus the fixed 0.75in gap leaves 289.25 for
    // standards -> 7 fit (280) with a 9.25 remainder, split evenly into 2
    // panels of 24.625 each next to the gap — never the corner-touching
    // standard, which stays full width since rule 1 in applyBracedPlacement
    // always braces it.
    const result = tileWall(330, 40, 20, "end");
    const widths = result.slots.map((s) => s.widthIn);
    expect(widths).toEqual([20, 40, 40, 40, 40, 40, 24.625, 24.625, 0.75, 40, 20]);
    expect(result.slots.map((s) => s.type)).toEqual([
      "corner",
      "standard",
      "standard",
      "standard",
      "standard",
      "standard",
      "standard",
      "standard",
      "safety-gap",
      "standard",
      "corner",
    ]);
    // total unchanged — the gap's fixed width never introduces slack
    expect(widths.reduce((a, b) => a + b, 0)).toBe(330);
  });

  it("mirrors the order when gapEnd is 'start': full-width corner-touching standard, then the fixed 3/4in gap, then the 2 split standards, then the plain run", () => {
    const result = tileWall(330, 40, 20, "start");
    const widths = result.slots.map((s) => s.widthIn);
    expect(widths).toEqual([20, 40, 0.75, 24.625, 24.625, 40, 40, 40, 40, 40, 20]);
    expect(result.slots.map((s) => s.type)).toEqual([
      "corner",
      "standard",
      "safety-gap",
      "standard",
      "standard",
      "standard",
      "standard",
      "standard",
      "standard",
      "standard",
      "corner",
    ]);
  });

  it("gives a run at or under 12ft a NARROW (1/2in) safety gap — it no longer goes without one", () => {
    // ⚠ **Reversed on 2026-10-01**, and this test used to assert the opposite:
    // "walls at or under 12ft skip the safety/gap panel entirely, using
    // evenly-sized standards instead". Tommy's decision replaced the
    // all-or-nothing threshold with a two-tier width — *"Can we make it so that
    // once below the threshold (of 12'? If it's somewhere around 10-12' rn
    // that's fine) the safety gap is 1/2"."* — so EVERY run gets a gap and 144in
    // only decides which one.
    //
    // wallLengthIn=80 <= 144 (12ft) -> a 1/2in gap. middle=40, of which the gap
    // takes 1/2in and the one standard panel takes the other 39.5in.
    const result = tileWall(80, 40, 20, "end");
    expect(result.slots.map((s) => [s.type, s.widthIn])).toEqual([
      ["corner", 20],
      ["safety-gap", 0.5],
      ["standard", 39.5],
      ["corner", 20],
    ]);
    // The whole point of the pass: the run still sums to the wall exactly.
    expect(result.slots.reduce((a, s) => a + Math.round(s.widthIn * 8), 0)).toBe(80 * 8);
  });

  it("gives a run OVER 12ft the WIDE (3/4in) gap, which is the tier that did not move", () => {
    // The other side of the same decision, asserted next to it so the pair of
    // tiers is visible in one place rather than inferred.
    const result = tileWall(200, 40, 20, "end");
    const gaps = result.slots.filter((s) => s.type === "safety-gap");
    expect(gaps.map((s) => s.widthIn)).toEqual([0.75]);
    expect(result.slots.reduce((a, s) => a + Math.round(s.widthIn * 8), 0)).toBe(200 * 8);
  });

  it("switches tier at exactly 144in of RUN: 144in is narrow, 144 1/8in is wide", () => {
    // The boundary is `> 144`, not `>= 144`, and it is measured against the RUN
    // — see SAFETY_GAP_NARROW_MAX_RUN_LENGTH_IN. Pinned at the eighth either
    // side so the inequality cannot be flipped unnoticed.
    const narrow = tileWall(144, 40, 20, "end").slots.filter((s) => s.type === "safety-gap");
    const wide = tileWall(144.125, 40, 20, "end").slots.filter((s) => s.type === "safety-gap");
    expect(narrow.map((s) => s.widthIn)).toEqual([0.5]);
    expect(wide.map((s) => s.widthIn)).toEqual([0.75]);
  });

  it("...and a wall whose middle is too small to build has its corners absorb it instead", () => {
    // The 55in case the test above used to assert, kept as its own case so
    // the change is visible rather than merely gone: a 15in middle is under
    // the 24in fabrication minimum, so the two corner panels take the whole
    // wall at 27.5in each. Same rule as the 51in-75.5in band, reached here with
    // a non-catalog 20in corner width.
    const result = tileWall(55, 40, 20, "end");
    expect(result.slots.map((s) => [s.type, s.widthIn])).toEqual([
      ["corner", 27.5],
      ["corner", 27.5],
    ]);
  });

  it("never hands the shop an oversized panel on a short run either — the narrow gap plus a legal split", () => {
    // wallLengthIn=90 <= 144; middle=50, less the 1/2in gap leaves 49.5in,
    // which is more than one 40in standard, so the leftover SPLITS rather than
    // growing one panel past the cap: 49.5 >= 2 x 24, so two panels of 24.75in.
    //
    // ⚠ This used to be 2 x 25in with no gap at all ("still skips the gap panel
    // under 12ft"). The cap rule is unchanged; the gap now takes its 1/2in
    // first.
    const result = tileWall(90, 40, 20, "end");
    expect(result.slots.map((s) => [s.type, s.widthIn])).toEqual([
      ["corner", 20],
      ["safety-gap", 0.5],
      ["standard", 24.75],
      ["standard", 24.75],
      ["corner", 20],
    ]);
    expect(result.slots.reduce((a, s) => a + Math.round(s.widthIn * 8), 0)).toBe(90 * 8);
  });

  it("splits into multiple standards on a short run when the budget calls for more than one", () => {
    // wallLengthIn=110 <= 144; middle=70, less the 1/2in gap leaves 69.5in ->
    // one 40in standard plus a 29.5in remainder; 69.5 >= 48 so it splits into
    // two 34.75in panels. (It was 2 x 35in with no gap before 2026-10-01.)
    const result = tileWall(110, 40, 20, "end");
    expect(result.slots.map((s) => [s.type, s.widthIn])).toEqual([
      ["corner", 20],
      ["safety-gap", 0.5],
      ["standard", 34.75],
      ["standard", 34.75],
      ["corner", 20],
    ]);
    expect(result.slots.reduce((a, s) => a + Math.round(s.widthIn * 8), 0)).toBe(110 * 8);
  });

  it("degrades gracefully when there's nothing to borrow a standard panel from (0 fit), on a wall over 12ft", () => {
    // wallLengthIn=150 > 144, so the gap panel still applies. cornerWidthIn=70
    // each -> middle=10; the fixed 0.75in gap leaves 9.25 which becomes one
    // small resized standard panel next to it — the gap stays flush rather
    // than absorbing the whole 10in itself.
    const result = tileWall(150, 40, 70, "end");
    expect(result.slots.map((s) => s.type)).toEqual(["corner", "safety-gap", "standard", "corner"]);
    expect(result.slots.map((s) => s.widthIn)).toEqual([70, 0.75, 9.25, 70]);
  });

  it("degrades gracefully when only 1 standard panel would fit and the leftover is under 2ft, on a wall over 12ft", () => {
    // wallLengthIn=150 > 144, cornerWidthIn=55 each -> middle=40; the fixed
    // 0.75in gap leaves 39.25, which becomes the one resized standard panel
    // next to it (still under a full standardWidthIn, since less than one
    // fit in the first place).
    const result = tileWall(150, 40, 55, "end");
    expect(result.slots.map((s) => s.type)).toEqual(["corner", "safety-gap", "standard", "corner"]);
    expect(result.slots.map((s) => s.widthIn)).toEqual([55, 0.75, 39.25, 55]);
  });

  it("keeps the gap second-to-last with only 1 standard's worth of budget and a remainder, splitting into 2 capped panels", () => {
    // wallLengthIn=150 > 144, cornerWidthIn=40 each -> middle=70; minus the
    // fixed 0.75in gap leaves 69.25 for standards -> 1 fits (40) with a
    // 29.25 remainder. Rather than one 69.25in panel, that budget splits
    // into 2 panels of 34.625 each (there's no separate corner-touching
    // slot here — both sit directly next to the gap) — gap still sits
    // before them.
    const result = tileWall(150, 40, 40, "end");
    expect(result.slots.map((s) => s.type)).toEqual(["corner", "safety-gap", "standard", "standard", "corner"]);
    expect(result.slots.map((s) => s.widthIn)).toEqual([40, 0.75, 34.625, 34.625, 40]);
  });

  it("omits corner slots entirely when hasCorners is false (butting wall), same fixed-gap logic applies", () => {
    // middle = 300 (no corners reserved); minus the fixed 0.75in gap leaves
    // 299.25 for standards -> 7 fit (280) with a 19.25 remainder, split
    // into 2 panels of 29.625 each next to the gap — corner-touching
    // standard (still present even with hasCorners false — it's what rule 1
    // braces at the butting end) stays full width.
    const result = tileWall(300, 40, 20, "end", false, false);
    const widths = result.slots.map((s) => s.widthIn);
    expect(widths).toEqual([40, 40, 40, 40, 40, 29.625, 29.625, 0.75, 40]);
    expect(widths.reduce((a, b) => a + b, 0)).toBe(300);
    expect(result.slots.map((s) => s.type)).toEqual([
      "standard",
      "standard",
      "standard",
      "standard",
      "standard",
      "standard",
      "standard",
      "safety-gap",
      "standard",
    ]);
  });

  it("allowBorrow no longer changes the sizing — the gap stays a fixed 3/4in regardless of shape (mitered vs. non-mitered)", () => {
    // same 330 wall as the resize test above; passing allowBorrow=false
    // (the mitered/octagon path) produces identical results, since the old
    // borrow-and-split branch this flag used to gate no longer exists.
    const result = tileWall(330, 40, 20, "end", true, true, false);
    const widths = result.slots.map((s) => s.widthIn);
    expect(widths).toEqual([20, 40, 40, 40, 40, 40, 24.625, 24.625, 0.75, 40, 20]);
    expect(widths.reduce((a, b) => a + b, 0)).toBe(330);
    expect(result.slots.map((s) => s.type)).toEqual([
      "corner",
      "standard",
      "standard",
      "standard",
      "standard",
      "standard",
      "standard",
      "standard",
      "safety-gap",
      "standard",
      "corner",
    ]);
  });

  it("produces no middle slot at all (not a phantom zero-width one) when both corners fit exactly, 0 leftover", () => {
    // wallLengthIn=40 == 2*20 (both corners) exactly -> 0 leftover. Previously
    // this synthesized a phantom 0-width "standard" panel, which rendered
    // invisibly but still counted as a real panel instance.
    const result = tileWall(40, 40, 20, "end");
    expect(result.slots.map((s) => s.type)).toEqual(["corner", "corner"]);
    expect(result.slots.map((s) => s.widthIn)).toEqual([20, 20]);
  });

  it("produces no middle slot at all on a wall over 12ft when both corners fit exactly, 0 leftover", () => {
    // wallLengthIn=150 > 144 (needs a safety panel) but corners (75 each) fill
    // it exactly -> 0 leftover. Same phantom-zero-width bug on the gap-panel path.
    const result = tileWall(150, 40, 75, "end");
    expect(result.slots.map((s) => s.type)).toEqual(["corner", "corner"]);
    expect(result.slots.map((s) => s.widthIn)).toEqual([75, 75]);
  });

  it("merges both corners into one when the wall is too short to fit them without overlap", () => {
    // A bump-out's short remainder segment: wallLengthIn=30 < 2*20=40 (both
    // corners). Instead of overlapping, they merge into a single corner
    // panel spanning the whole wall — Tommy: "merge the two corner panels".
    const result = tileWall(30, 40, 20, "end");
    expect(result.slots).toEqual([{ type: "corner", widthIn: 30 }]);
  });

  it("unmerges back into two separate corners once the wall is long enough again", () => {
    // Same wall, later dragged/edited back out past the 2-corner threshold —
    // tileWall is pure, so this is just calling it again with a bigger
    // length; there's no separate merge state to reset.
    const short = tileWall(30, 40, 20, "end");
    expect(short.slots).toEqual([{ type: "corner", widthIn: 30 }]);
    // **Grown from 50in to 64in by corner absorb (2026-09-25), and from 64in to
    // 64½in by the two-tier gap (2026-10-01).** At 50in the
    // unmerged wall had a 10in middle, which is under the fabrication
    // minimum, so the corner pair now absorbs it and there is still no
    // standard slot — the wall unmerges into two corners but not into a
    // middle. 64in used to leave a legal 24in middle; now that middle also has
    // to pay for a 1/2in safety gap, so 24in buys a 23½in panel the shop cannot
    // build and the pair absorbs that length too. 64½in is the first length with
    // a middle that holds a gap AND a legal panel. The intermediate stages are
    // asserted so the staircase is visible rather than skipped over.
    const absorbed = tileWall(50, 40, 20, "end");
    expect(absorbed.slots.map((s) => [s.type, s.widthIn])).toEqual([
      ["corner", 25],
      ["corner", 25],
    ]);
    const stillAbsorbed = tileWall(64, 40, 20, "end");
    expect(stillAbsorbed.slots.map((s) => [s.type, s.widthIn])).toEqual([
      ["corner", 32],
      ["corner", 32],
    ]);
    const grown = tileWall(64.5, 40, 20, "end");
    expect(grown.slots.map((s) => [s.type, s.widthIn])).toEqual([
      ["corner", 20],
      ["safety-gap", 0.5],
      ["standard", 24],
      ["corner", 20],
    ]);
  });

  it("does NOT absorb when the absorbed pair would itself be unbuildable", () => {
    // The legality guard on corner absorb, reached with a deliberately
    // outsized 70in corner width: 140in of corners on a 150in wall leaves a
    // 10in middle, so absorb WOULD fire — but the pair would be two 75in
    // panels, well past the 48in ceiling. Trading an unbuildably narrow
    // panel for an unbuildably wide one is not a fix, so the wall keeps
    // today's tiling and the Review Log reports the narrow panel.
    //
    // At the real 25.5in corner width this guard can never fire: the pair
    // always lands in [25.5in, 37.5in]. It is here so the rule is
    // self-limiting rather than resting on a coincidence of two numbers.
    const result = tileWall(150, 40, 70, "end");
    expect(result.slots.map((s) => s.type)).toEqual(["corner", "safety-gap", "standard", "corner"]);
    expect(result.slots.map((s) => s.widthIn)).toEqual([70, 0.75, 9.25, 70]);
  });

  it("does not merge right at the exact 2-corner boundary (0 leftover is a valid non-overlapping fit)", () => {
    // wallLengthIn=40 == 2*20 exactly -> corners fit with 0 leftover, no
    // overlap, so this should NOT trigger the merge (matches the
    // exact-fit/0-leftover test above).
    const result = tileWall(40, 40, 20, "end");
    expect(result.slots.map((s) => s.type)).toEqual(["corner", "corner"]);
  });

  it("clamps a lone corner (no merge partner) down to the wall's own length if even it alone doesn't fit", () => {
    // Only owns a corner at the start (butts a longer neighbor at the end) —
    // wallLengthIn=15 is shorter than the corner's own nominal 20in width.
    const result = tileWall(15, 40, 20, "end", true, false);
    expect(result.slots).toEqual([{ type: "corner", widthIn: 15 }]);
  });
});

describe("nextPanelCycleState", () => {
  it("cycles standard -> window -> door -> column -> big-header -> chevron -> mirrored chevron -> hatch -> mirrored hatch -> standard", () => {
    let state = nextPanelCycleState({ type: "standard" });
    expect(state).toEqual({ type: "window" });
    state = nextPanelCycleState(state!);
    expect(state).toEqual({ type: "door" });
    state = nextPanelCycleState(state!);
    expect(state).toEqual({ type: "column" });
    state = nextPanelCycleState(state!);
    expect(state).toEqual({ type: "big-header" });
    state = nextPanelCycleState(state!);
    expect(state).toEqual({ type: "braced", bracedPattern: "chevron", bracedMirrored: false });
    state = nextPanelCycleState(state!);
    expect(state).toEqual({ type: "braced", bracedPattern: "chevron", bracedMirrored: true });
    state = nextPanelCycleState(state!);
    expect(state).toEqual({ type: "braced", bracedPattern: "hatch", bracedMirrored: false });
    state = nextPanelCycleState(state!);
    expect(state).toEqual({ type: "braced", bracedPattern: "hatch", bracedMirrored: true });
    state = nextPanelCycleState(state!);
    expect(state).toEqual({ type: "standard" });
  });

  it("returns null for corner and safety-gap slots — not cyclable", () => {
    expect(nextPanelCycleState({ type: "corner" })).toBeNull();
    expect(nextPanelCycleState({ type: "safety-gap" })).toBeNull();
  });

  it("treats an unrecognized/legacy braced pattern-mirror combo as the last stop, wrapping to standard", () => {
    expect(nextPanelCycleState({ type: "braced" })).toEqual({ type: "standard" });
  });
});

describe("getOpeningAnchors", () => {
  it("records each window/door's position as how many standard slots precede it, skipping corner/gap", () => {
    const slots: PanelSlot[] = [
      { type: "corner", widthIn: 24 },
      { type: "standard", widthIn: 40 },
      { type: "standard", widthIn: 40 },
      { type: "window", widthIn: 36 },
      { type: "standard", widthIn: 40 },
      { type: "door", widthIn: 30 },
      { type: "corner", widthIn: 24 },
    ];
    expect(getOpeningAnchors(slots)).toEqual([
      { beforeStandardCount: 2, type: "window", widthIn: 36 },
      { beforeStandardCount: 3, type: "door", widthIn: 30 },
    ]);
  });

  it("returns an empty array when there are no openings", () => {
    const slots: PanelSlot[] = [
      { type: "corner", widthIn: 24 },
      { type: "standard", widthIn: 40 },
      { type: "corner", widthIn: 24 },
    ];
    expect(getOpeningAnchors(slots)).toEqual([]);
  });

  it("counts 'braced' slots toward beforeStandardCount right alongside 'standard' ones (bug regression: a braced slot preceding an opening used to be undercounted, anchoring the opening too early)", () => {
    const slots: PanelSlot[] = [
      { type: "corner", widthIn: 24 },
      { type: "braced", widthIn: 40, bracedPattern: "chevron", bracedMirrored: false },
      { type: "window", widthIn: 36 },
      { type: "standard", widthIn: 40 },
      { type: "corner", widthIn: 24 },
    ];
    expect(getOpeningAnchors(slots)).toEqual([{ beforeStandardCount: 1, type: "window", widthIn: 36 }]);
  });
});

describe("retileWithOpenings", () => {
  it("matches tileWall exactly when there are no openings", () => {
    const withOpenings = retileWithOpenings(350, 40, 20, "end", true, true, []);
    const plain = tileWall(350, 40, 20, "end");
    expect(withOpenings.slots).toEqual(plain.slots);
  });

  it("reserves the opening's width and re-derives standard count + gap sizing around it (no protrusion)", () => {
    // middle = 430-40(corners) = 390; reserve a 100in window -> budget 290;
    // minus the fixed 0.75in gap leaves 289.25 for standards -> 7 fit (280)
    // with a 9.25 remainder, split into 2 panels of 24.625 each next to the
    // gap — window anchored after 2 standard slots
    const result = retileWithOpenings(430, 40, 20, "end", true, true, [
      { beforeStandardCount: 2, type: "window", widthIn: 100 },
    ]);
    const widths = result.slots.map((s) => s.widthIn);
    const types = result.slots.map((s) => s.type);
    expect(types).toEqual([
      "corner",
      "standard",
      "standard",
      "window",
      "standard",
      "standard",
      "standard",
      "standard",
      "standard",
      "safety-gap",
      "standard",
      "corner",
    ]);
    expect(widths).toEqual([20, 40, 40, 100, 40, 40, 40, 24.625, 24.625, 0.75, 40, 20]);
    // total unchanged — the gap's fixed width never introduces slack
    expect(widths.reduce((a, b) => a + b, 0)).toBe(430);
  });

  it("growing the same window further re-derives again, staying anchored and still fitting exactly", () => {
    // same wall, window grown to 140in -> budget 250; minus the fixed
    // 0.75in gap leaves 249.25 for standards -> 6 fit (240) with a 9.25
    // remainder, split into 2 panels of 24.625 each next to the gap
    const result = retileWithOpenings(430, 40, 20, "end", true, true, [
      { beforeStandardCount: 2, type: "window", widthIn: 140 },
    ]);
    const widths = result.slots.map((s) => s.widthIn);
    expect(widths.reduce((a, b) => a + b, 0)).toBe(430);
    expect(result.slots.map((s) => s.type)).toEqual([
      "corner",
      "standard",
      "standard",
      "window",
      "standard",
      "standard",
      "standard",
      "standard",
      "safety-gap",
      "standard",
      "corner",
    ]);
  });

  it("merges both corners (dropping any opening — no room for it either) when the wall is too short to fit them", () => {
    const result = retileWithOpenings(30, 40, 20, "end", true, true, [
      { beforeStandardCount: 0, type: "window", widthIn: 20 },
    ]);
    expect(result.slots).toEqual([{ type: "corner", widthIn: 30 }]);
  });
});

describe("markSafetyCorner", () => {
  it("retypes the corner slot at the given end to safety-oct-corner", () => {
    const result = tileWall(350, 40, 20, "end");
    const markedEnd = markSafetyCorner(result.slots, "end");
    expect(markedEnd[markedEnd.length - 1]!.type).toBe("safety-oct-corner");
    expect(markedEnd[markedEnd.length - 1]!.widthIn).toBe(20); // width unchanged
    expect(markedEnd[0]!.type).toBe("corner"); // the other end untouched

    const markedStart = markSafetyCorner(result.slots, "start");
    expect(markedStart[0]!.type).toBe("safety-oct-corner");
    expect(markedStart[markedStart.length - 1]!.type).toBe("corner");
  });

  it("is a no-op when hasCorners is false (no corner slot to mark)", () => {
    const result = tileWall(300, 40, 20, "end", false, false);
    expect(markSafetyCorner(result.slots, "end")).toEqual(result.slots);
  });

  it("is a no-op on an empty slots array", () => {
    expect(markSafetyCorner([], "start")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The 1/8in grid invariant
//
// Tommy: "we must remain absolutely precise on total lengths of wall segments
// being exactly the same as the addition of all the panels." That sentence is
// the whole reason the tiling engine quantizes in the MODEL instead of at
// display time, and this block is the check that it actually does.
//
// Read the sum assertion carefully: it converts to an INTEGER count of eighths
// and compares integers. It deliberately does NOT use `toBeCloseTo`, because
// `toBeCloseTo` passes on exactly the bug being fixed — two panels of 23.5625
// "close to" a budget of 47.125 is precisely the defect, and a tolerance-based
// assertion would wave it through. If you loosen this, you have deleted the
// test.
// ---------------------------------------------------------------------------

const CORNER_WIDTH_IN = 25.5;
// The four real ones (Square Bale 39, the 40in default, and both ends of
// panelWidthInRange) plus two deliberately OFF-GRID widths. standardWidthIn is
// a typed project setting, so an off-grid value is one keystroke away, and a
// sweep made only of on-grid widths cannot see a tiler that passes the width
// through unquantized — which is exactly how that bug survived the first
// version of this file.
const STANDARD_WIDTHS_IN = [15.75, 39, 40, 48, 40.3, 16.7];
const GAP_ENDS: WallEnd[] = ["start", "end"];
const CORNER_COMBOS: [boolean, boolean][] = [
  [true, true],
  [true, false],
  [false, true],
  [false, false],
];

/**
 * **The shortest wall length that is legal in ALL FOUR corner-ownership
 * combinations — the floor every sweep in this file starts from.**
 *
 * It used to be 96in, which is why the 51in-75.5in two-corner dead band could
 * sit in the tiler unnoticed while two sweeps reported clean: neither of them
 * ever looked at a wall short enough to have the disease. Corner absorb
 * (2026-09-25) fixed the band, so the sweeps now start where the arithmetic
 * actually bottoms out, and 51in is that point rather than a round number:
 *
 * - **no corners:** the whole wall is middle, legal from 24in up.
 * - **one corner:** middle is `L - 25.5`, so legal from **49.5in** up. Below
 *   that a lone corner has no partner to share the wall with — the one
 *   residual this pass deliberately does not fix, asserted as such.
 * - **two corners:** 51in is where the pair fits at nominal width with a zero
 *   middle. Below it the merged-corner rule takes over, and that rule
 *   genuinely does emit a corner slot past the 48in ceiling between 48in and
 *   51in — **pre-existing, untouched here by instruction, and reported.**
 *
 * 51in is therefore the max of the three, and sweeping from it is a real
 * claim rather than a convenient one.
 */
const SWEEP_START_IN = 51;

/** Pushes a description of every way `slots` breaks the invariant. Violations
 * are accumulated rather than asserted per-slot: the sweep makes hundreds of
 * thousands of checks, and one `expect` per check turns a 2-second test into a
 * multi-minute one. The final assertion is on the (expected empty) list, so a
 * failure still names the exact case. */
function collectGridViolations(
  slots: PanelSlot[],
  wallLengthIn: number,
  standardWidthIn: number,
  label: string,
  violations: string[],
): void {
  let sumEighths = 0;
  for (const slot of slots) {
    // 1. every width is a whole number of eighths
    if (Math.abs(slot.widthIn * 8 - Math.round(slot.widthIn * 8)) >= 1e-9) {
      violations.push(`${label}: ${slot.type} width ${slot.widthIn} is not a whole eighth`);
    }
    // 3. no negative widths
    if (slot.widthIn < 0) {
      violations.push(`${label}: ${slot.type} width ${slot.widthIn} is negative`);
    }
    // 4. the "never hand the shop an oversized panel" rule — RESTATED for
    //    the absorb rule (2026-09-24), deliberately and not by loosening it
    //    until it passed.
    //
    //    It used to read "no standard slot exceeds standardWidthIn", full
    //    stop. Absorb makes that false on purpose: where a two-way split
    //    would put a part under the shop's 24in floor, the tiler emits ONE
    //    wider panel instead, and that panel is wider than the nominal
    //    standard width. An unbuildable panel is worse than an oversized
    //    one, so the floor outranks the cap.
    //
    //    What survives — and it is the part that actually protects a cut
    //    list — is the CEILING. An oversized standard slot is legal only as
    //    an absorbed leftover, and every absorbed leftover is STRICTLY under
    //    2 x the floor, which is exactly the catalog's 48in ceiling. Both
    //    absorb paths give that bound: computePlainSizing's branch runs only
    //    when `S + r < 2F`, and buildEvenMiddle's reduced count n =
    //    floor(b / F) leaves a widest part under `F + F/n <= 2F`.
    if (slot.type === "standard" && slot.widthIn > standardWidthIn + 1e-9) {
      if (slot.widthIn >= TILER_MAX_PANEL_WIDTH_IN - 1e-9) {
        violations.push(
          `${label}: standard slot ${slot.widthIn} exceeds standardWidthIn ${standardWidthIn} AND reaches the ${TILER_MAX_PANEL_WIDTH_IN}in ceiling — absorb cannot produce this`,
        );
      }
    }
    sumEighths += Math.round(slot.widthIn * 8);
  }
  // 2. the parts sum to the whole, as integers
  const wallEighths = Math.round(wallLengthIn * 8);
  if (sumEighths !== wallEighths) {
    violations.push(`${label}: slots sum to ${sumEighths} eighths, wall is ${wallEighths} eighths`);
  }
}

describe("the 1/8in grid invariant", () => {
  it("holds for tileWall across every eighth from 51in to 720in, all widths/gap ends/corner combos", () => {
    const violations: string[] = [];
    for (let eighths = SWEEP_START_IN * 8; eighths <= 720 * 8; eighths++) {
      const wallLengthIn = eighths / 8;
      for (const standardWidthIn of STANDARD_WIDTHS_IN) {
        for (const gapEnd of GAP_ENDS) {
          for (const [hasCornerStart, hasCornerEnd] of CORNER_COMBOS) {
            const { slots } = tileWall(wallLengthIn, standardWidthIn, CORNER_WIDTH_IN, gapEnd, hasCornerStart, hasCornerEnd);
            collectGridViolations(
              slots,
              wallLengthIn,
              standardWidthIn,
              `tileWall(${wallLengthIn}, ${standardWidthIn}, ${gapEnd}, ${hasCornerStart}/${hasCornerEnd})`,
              violations,
            );
          }
        }
      }
    }
    expect(violations.slice(0, 10)).toEqual([]);
  });

  it("holds for retileWithOpenings with 0-3 eighth-multiple openings", () => {
    const violations: string[] = [];
    const OPENING_WIDTH_IN = 36; // 288 eighths
    for (let eighths = SWEEP_START_IN * 8; eighths <= 720 * 8; eighths += 1) {
      const wallLengthIn = eighths / 8;
      for (const standardWidthIn of STANDARD_WIDTHS_IN) {
        for (const gapEnd of GAP_ENDS) {
          for (const [hasCornerStart, hasCornerEnd] of CORNER_COMBOS) {
            const fixedEndsIn = (hasCornerStart ? CORNER_WIDTH_IN : 0) + (hasCornerEnd ? CORNER_WIDTH_IN : 0);
            for (let openingCount = 0; openingCount <= 3; openingCount++) {
              // An opening set wider than the wall's own middle is an
              // over-reservation, not a tiling case — the wall genuinely
              // cannot hold it and the caller is expected not to ask. Skipped
              // rather than asserted against.
              const middleLengthIn = wallLengthIn - fixedEndsIn;
              if (middleLengthIn - openingCount * OPENING_WIDTH_IN < standardWidthIn + 0.75) continue;
              const openings: OpeningAnchor[] = Array.from({ length: openingCount }, (_, i) => ({
                beforeStandardCount: i,
                type: "window" as const,
                widthIn: OPENING_WIDTH_IN,
              }));
              const { slots } = retileWithOpenings(
                wallLengthIn,
                standardWidthIn,
                CORNER_WIDTH_IN,
                gapEnd,
                hasCornerStart,
                hasCornerEnd,
                openings,
              );
              collectGridViolations(
                slots,
                wallLengthIn,
                standardWidthIn,
                `retileWithOpenings(${wallLengthIn}, ${standardWidthIn}, ${gapEnd}, ${openingCount} openings)`,
                violations,
              );
            }
          }
        }
      }
    }
    expect(violations.slice(0, 10)).toEqual([]);
  });

  it("holds for a wall length that is itself off the grid (it snaps, then sums to the snapped value)", () => {
    // An octagon diagonal, or any pre-Stage-2 drag, hands tileWall a length
    // that is not an eighth. The guarantee is against
    // wallFabricationLengthIn(wall), NOT against lengthFt * 12 — see the
    // octagon exception. Sweeping sixteenths exercises the worst case.
    const violations: string[] = [];
    for (let sixteenths = 96 * 16; sixteenths <= 200 * 16; sixteenths++) {
      const rawLengthIn = sixteenths / 16;
      const snappedLengthIn = Math.round(rawLengthIn * 8) / 8;
      const { slots } = tileWall(rawLengthIn, 40, CORNER_WIDTH_IN, "end");
      collectGridViolations(slots, snappedLengthIn, 40, `tileWall(${rawLengthIn} off-grid)`, violations);
    }
    expect(violations.slice(0, 10)).toEqual([]);
  });

  it("splits an ODD-eighth leftover budget onto whole eighths, not onto a sixteenth", () => {
    // The named regression, re-aimed. It used to use a 178.875in wall, whose
    // 47.125in leftover budget ABSORBS as of 2026-09-24 (see the test below)
    // and so no longer reaches the split branch at all. The behaviour it
    // guards — an odd number of eighths splits 193/192, never 192.5 twice —
    // is unchanged, it just needs a leftover at or over 48in to reach.
    //
    // A 179.875in wall with two corners leaves a 128.875in middle; minus the
    // 0.75in gap that is 128.125in, i.e. 3 whole 40in standards plus an
    // 8.125in remainder. The panel next to the gap splits 40 + 8.125 =
    // 48.125in — 385 eighths, an ODD count — into 24.125 + 24.
    const { slots } = tileWall(179.875, 40, CORNER_WIDTH_IN, "end");
    const widths = slots.map((s) => s.widthIn);
    expect(widths).toContain(24.125);
    expect(widths).toContain(24);
    expect(widths).not.toContain(24.0625);
    expect(slots.reduce((sum, s) => sum + Math.round(s.widthIn * 8), 0)).toBe(Math.round(179.875 * 8));
  });

  it("ABSORBS the 47.125in leftover into one panel instead of splitting it into two 23½in ones", () => {
    // The same 178.875in wall the split regression used to use, and the
    // headline case for the absorb rule. The leftover budget is 47.125in;
    // halving it gives 23.625 + 23.5, and BOTH are under the 24in minimum
    // Building Integrity's shop can build. Before 2026-09-24 the tiler
    // emitted them anyway — a cut list with two panels nobody can make.
    const { slots } = tileWall(178.875, 40, CORNER_WIDTH_IN, "end");
    const widths = slots.map((s) => s.widthIn);
    expect(widths).toContain(47.125);
    expect(widths).not.toContain(23.625);
    expect(widths).not.toContain(23.5);
    // One panel fewer on the run, and the wall's own total is untouched.
    expect(slots.filter((s) => s.type === "standard")).toHaveLength(3);
    expect(slots.reduce((sum, s) => sum + Math.round(s.widthIn * 8), 0)).toBe(Math.round(178.875 * 8));
  });

  it("gives the tie at exactly 48in to the SPLIT, not to the absorb", () => {
    // Both branches are legal at this single point — one 48in panel, or two
    // 24in ones — and the choice is arbitrary but FIXED. Split wins: it
    // preserves the behaviour that was there before absorb and keeps panels
    // nearer the nominal width. Asserted because "arbitrary" is exactly the
    // kind of decision that gets silently flipped.
    //
    // A 179.75in wall with two corners: middle 128.75, minus the gap 128,
    // i.e. 3 x 40 plus an 8in remainder, so the leftover is exactly 48in.
    const { slots } = tileWall(179.75, 40, CORNER_WIDTH_IN, "end");
    const widths = slots.map((s) => s.widthIn);
    expect(widths).not.toContain(48);
    expect(widths.filter((w) => w === 24)).toHaveLength(2);
    expect(slots.filter((s) => s.type === "standard")).toHaveLength(4);
    expect(slots.reduce((sum, s) => sum + Math.round(s.widthIn * 8), 0)).toBe(Math.round(179.75 * 8));
  });

  it("snaps an off-grid standardWidthIn instead of passing it through to full-width panels", () => {
    // The regression for the hole the first version of this sweep missed: the
    // full-width panels used to be emitted at the raw 40.3, overrunning a
    // 360in wall by 0.3in. Note the eighths-SUM was already correct here
    // (Math.round(40.3 * 8) === 322), so only the whole-eighth check catches
    // it — which is why that assertion is separate from the sum one.
    const { slots } = tileWall(360, 40.3, CORNER_WIDTH_IN, "end");
    for (const slot of slots) {
      expect(Math.abs(slot.widthIn * 8 - Math.round(slot.widthIn * 8))).toBeLessThan(1e-9);
      expect(slot.widthIn).toBeLessThanOrEqual(40.3);
    }
    expect(slots.reduce((sum, s) => sum + s.widthIn, 0)).toBe(360);
  });

  it("floors an off-grid standard width rather than rounding it up past its own cap", () => {
    // standardWidthIn is a cap, so 40.3 becomes 40.25, never 40.375. Rounding
    // a cap upward would hand the shop a panel wider than the cap asked for.
    //
    // This used to use 16.7 -> 16.625. It cannot any more: a standard width
    // BELOW the 24in fabrication floor makes absorb fire on every run (every
    // leftover is under 48in), so no full-width 16.625in panel survives to
    // be measured. 40.3 exercises the same floor-not-round rule at a width
    // the shop can actually build — and the Panelizer's Standard width field
    // is now clamped to >= 24in, so 16.7 is no longer reachable from the UI
    // either.
    const { slots } = tileWall(400, 40.3, CORNER_WIDTH_IN, "end");
    const standards = slots.filter((s) => s.type === "standard").map((s) => s.widthIn);
    expect(standards).toContain(40.25);
    expect(standards).not.toContain(40.375);
  });

  it("⚠ ABSORB CANNOT SAVE A SUB-24in STANDARD WIDTH, and this is why the Panelizer field is clamped", () => {
    // The limit of the rule, stated rather than left to be discovered.
    // Absorb only ever resolves the LEFTOVER. If `standardWidthIn` is itself
    // under the fabrication floor, every full-width panel on the run is
    // unbuildable and there is nothing absorb can do about it — a 16.625in
    // standard width produces a wall of 16.625in panels.
    //
    // That is the whole reason the Panelizer's Standard width field is now
    // clamped to [24, 48]: no amount of absorbing fixes a cap set below the
    // floor. tileWall is a library function and does not clamp its own
    // argument, so this documents what it does with one.
    const { slots } = tileWall(400, 16.7, CORNER_WIDTH_IN, "end");
    const standards = slots.filter((s) => s.type === "standard").map((s) => s.widthIn);
    expect(standards).toContain(16.625);
    expect(Math.min(...standards)).toBeLessThan(TILER_MIN_PANEL_WIDTH_IN);
    // What absorb DOES still guarantee, even here: the leftover became one
    // panel rather than two narrower ones, and nothing breached the ceiling
    // or the sum.
    expect(Math.max(...standards)).toBeLessThan(TILER_MAX_PANEL_WIDTH_IN);
    expect(slots.reduce((sum, s) => sum + Math.round(s.widthIn * 8), 0)).toBe(Math.round(400 * 8));
  });

  it("clamps the safety-gap slot to a budget too small to hold it, rather than overrunning the wall", () => {
    // The degenerate case the sweep deliberately skips as an over-reservation.
    // A 148.5in window on a 200in wall leaves 0.5in of plain budget; the gap
    // used to be emitted at its full 0.75in and push the wall to 200.25in.
    const { slots } = retileWithOpenings(200, 40, CORNER_WIDTH_IN, "end", true, true, [
      { beforeStandardCount: 0, type: "window", widthIn: 148.5 },
    ]);
    expect(slots.map((s) => [s.type, s.widthIn])).toEqual([
      ["corner", 25.5],
      ["window", 148.5],
      ["safety-gap", 0.5],
      ["corner", 25.5],
    ]);
    expect(slots.reduce((sum, s) => sum + Math.round(s.widthIn * 8), 0)).toBe(Math.round(200 * 8));
  });

  it("emits no phantom slot for a budget of exactly zero", () => {
    // Both corners fit with nothing left over.
    const { slots } = tileWall(51, 40, CORNER_WIDTH_IN, "end");
    expect(slots.map((s) => s.type)).toEqual(["corner", "corner"]);
    expect(slots.reduce((sum, s) => sum + s.widthIn, 0)).toBe(51);
  });

  it("keeps a merged corner panel on the grid", () => {
    // Too short for two corners: the merged corner spans the whole wall, and
    // that width is quantized like everything else.
    const { slots } = tileWall(40.0625, 40, CORNER_WIDTH_IN, "end");
    expect(slots).toHaveLength(1);
    expect(slots[0]!.type).toBe("corner");
    expect(slots[0]!.widthIn).toBe(40.125);
  });

  it("stays exact when a wall owns no corner at one end (a butt-joint thickness inset)", () => {
    // All three thickness options are whole eighths, so subtracting one from
    // the tiling length must not knock the budget off the grid.
    const violations: string[] = [];
    for (const thicknessIn of [14, 15.5, 15.75]) {
      for (let eighths = 120 * 8; eighths <= 400 * 8; eighths++) {
        const lengthIn = eighths / 8 - thicknessIn;
        const { slots } = tileWall(lengthIn, 40, CORNER_WIDTH_IN, "end", true, false);
        collectGridViolations(slots, lengthIn, 40, `inset ${thicknessIn} at ${eighths / 8}`, violations);
      }
    }
    expect(violations.slice(0, 10)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// THE ABSORB RULE — the gate for Smearforn Stage 1r.
//
// Tommy, 2026-09-24: "I can't make any panels that are left to right elevation
// view shorter than 2'." The tiler used to break that routinely — its two-way
// split of a leftover lands between 20in and 40in at the 40in standard width —
// so the app could hand a shop a cut list containing a panel that shop cannot
// make. Absorb is his chosen answer: one wider panel instead of two narrow
// ones, chosen over reporting it, over widening the safety gap, and over
// refusing the wall length.
//
// Because he rejected refusing the wall length, there is NO fallback here.
// Every wall length has to come out legal on its own, which is why this is a
// sweep and not a handful of cases. The standard widths are the four the plan
// names, i.e. the ones reachable now that the Panelizer's Standard width field
// is clamped to [24, 48].
// ---------------------------------------------------------------------------
/** The four reachable standard widths: the fabrication floor, Square Bale's
 * fixed 39in, the 40in default, and the catalog ceiling. Module-scoped
 * because the corner-absorb block below sweeps the same four. */
const ABSORB_STANDARD_WIDTHS_IN = [24, 39, 40, 48];

/**
 * Pushes a description of every panel outside [24in, 48in], plus the sum
 * check, which has to survive absorb untouched — the whole point of moving
 * width between panels rather than inventing it.
 *
 * The safety-gap board is exempt BY TYPE and deliberately: it is a 0.75in
 * plywood spacer with no studs, plates or girts (`buildSafetyGapMembers`),
 * not a panel for this purpose. Opening slots are exempt too — a window's
 * `widthIn` is a rough opening, not a fabricated panel width.
 *
 * Corner slots are NOT exempt, and that is what makes this the right gate for
 * corner absorb: a corner panel off its nominal width is still a panel
 * somebody has to build.
 */
function collectFabricationViolations(
  slots: PanelSlot[],
  wallLengthIn: number,
  label: string,
  violations: string[],
): void {
  let sumEighths = 0;
  for (const slot of slots) {
    const isFabricatedPanel = slot.type === "standard" || slot.type === "braced" || slot.type === "corner";
    if (isFabricatedPanel && slot.widthIn < TILER_MIN_PANEL_WIDTH_IN - 1e-9) {
      violations.push(`${label}: ${slot.type} slot ${slot.widthIn} is under the ${TILER_MIN_PANEL_WIDTH_IN}in fabrication minimum`);
    }
    if (isFabricatedPanel && slot.widthIn > TILER_MAX_PANEL_WIDTH_IN + 1e-9) {
      violations.push(`${label}: ${slot.type} slot ${slot.widthIn} is over the ${TILER_MAX_PANEL_WIDTH_IN}in ceiling`);
    }
    sumEighths += Math.round(slot.widthIn * 8);
  }
  // Conserved EXACTLY, as integers. Absorb moves width between panels; it
  // must never create or destroy any.
  if (sumEighths !== Math.round(wallLengthIn * 8)) {
    violations.push(`${label}: slots sum to ${sumEighths} eighths, wall is ${Math.round(wallLengthIn * 8)} eighths`);
  }
}

describe("the absorb rule: no tiler-generated panel the shop cannot build", () => {
  it("holds for tileWall across every eighth from 51in to 720in, all widths/gap ends/corner combos", () => {
    const violations: string[] = [];
    for (let eighths = SWEEP_START_IN * 8; eighths <= 720 * 8; eighths++) {
      const wallLengthIn = eighths / 8;
      for (const standardWidthIn of ABSORB_STANDARD_WIDTHS_IN) {
        for (const gapEnd of GAP_ENDS) {
          for (const [hasCornerStart, hasCornerEnd] of CORNER_COMBOS) {
            const { slots } = tileWall(wallLengthIn, standardWidthIn, CORNER_WIDTH_IN, gapEnd, hasCornerStart, hasCornerEnd);
            collectFabricationViolations(
              slots,
              wallLengthIn,
              `tileWall(${wallLengthIn}, ${standardWidthIn}, ${gapEnd}, ${hasCornerStart}/${hasCornerEnd})`,
              violations,
            );
          }
        }
      }
    }
    expect(violations.slice(0, 10)).toEqual([]);
  });

  it("holds for retileWithOpenings too — an opening changes the budget, not the rule", () => {
    const violations: string[] = [];
    const OPENING_WIDTH_IN = 36;
    for (let eighths = SWEEP_START_IN * 8; eighths <= 720 * 8; eighths++) {
      const wallLengthIn = eighths / 8;
      for (const standardWidthIn of ABSORB_STANDARD_WIDTHS_IN) {
        for (const [hasCornerStart, hasCornerEnd] of CORNER_COMBOS) {
          const fixedEndsIn = (hasCornerStart ? CORNER_WIDTH_IN : 0) + (hasCornerEnd ? CORNER_WIDTH_IN : 0);
          for (let openingCount = 1; openingCount <= 3; openingCount++) {
            // Same over-reservation skip the grid sweep uses: a wall that
            // genuinely cannot hold its openings is not a tiling case.
            if (wallLengthIn - fixedEndsIn - openingCount * OPENING_WIDTH_IN < standardWidthIn + 0.75) continue;
            const openings: OpeningAnchor[] = Array.from({ length: openingCount }, (_, i) => ({
              beforeStandardCount: i,
              type: "window" as const,
              widthIn: OPENING_WIDTH_IN,
            }));
            const { slots } = retileWithOpenings(
              wallLengthIn,
              standardWidthIn,
              CORNER_WIDTH_IN,
              "end",
              hasCornerStart,
              hasCornerEnd,
              openings,
            );
            collectFabricationViolations(
              slots,
              wallLengthIn,
              `retileWithOpenings(${wallLengthIn}, ${standardWidthIn}, ${openingCount} openings, ${hasCornerStart}/${hasCornerEnd})`,
              violations,
            );
          }
        }
      }
    }
    expect(violations.slice(0, 10)).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // The three residual cases absorb does NOT reach. Each has nothing to
  // absorb into, each is Review-Log-only by decision, and each is asserted
  // here so that "deliberately not fixed" stays distinguishable from
  // "accidentally still broken".
  // -------------------------------------------------------------------------
  it("residual 1 is FIXED: a two-corner wall between 51in and 75in has a legal tiling", () => {
    // Was: 51in of corners on a 61.75in wall (the ADU's own 5'-1¾" plan
    // dimension) left a 10.75in middle, floor(10.75 / 24) = 0, no legal panel
    // count at all. Now the corner pair absorbs that middle — Tommy's chosen
    // corner-geometry route — and the wall is two 30-7/8in corner panels.
    // Full coverage of the band lives in its own describe block below.
    const { slots } = tileWall(61.75, 40, CORNER_WIDTH_IN, "end", true, true);
    expect(slots.map((s) => s.type)).toEqual(["corner", "corner"]);
    expect(slots.map((s) => s.widthIn)).toEqual([30.875, 30.875]);
    expect(slots.some((s) => s.widthIn < TILER_MIN_PANEL_WIDTH_IN)).toBe(false);
    expect(slots.reduce((sum, s) => sum + Math.round(s.widthIn * 8), 0)).toBe(Math.round(61.75 * 8));
    // ⚠ **The band's top edge moved from 75in to 75½in on 2026-10-01**, because
    // the middle now has to pay for a safety gap before it can hold a legal
    // panel. 75in leaves a 24in middle, which is a 1/2in gap plus a 23½in panel
    // — unbuildable — so the pair absorbs it; 75½in is the first two-corner wall
    // whose middle holds both. Both are asserted, because "the band ends here"
    // is exactly the kind of edge that silently drifts.
    const absorbedAt75 = tileWall(75, 40, CORNER_WIDTH_IN, "end", true, true).slots;
    expect(absorbedAt75.map((s) => [s.type, s.widthIn])).toEqual([
      ["corner", 37.5],
      ["corner", 37.5],
    ]);
    const legal = tileWall(75.5, 40, CORNER_WIDTH_IN, "end", true, true).slots;
    expect(legal.map((s) => [s.type, s.widthIn])).toEqual([
      ["corner", 25.5],
      ["safety-gap", 0.5],
      ["standard", 24],
      ["corner", 25.5],
    ]);
    expect(legal.some((s) => s.type !== "safety-gap" && s.widthIn < TILER_MIN_PANEL_WIDTH_IN)).toBe(false);
  });

  it("residual 1's ONE-corner twin is deliberately still unfixed", () => {
    // The same arithmetic on a wall that owns a corner at only one end: 25.5in
    // of corner on a 40in wall leaves a 14.5in middle. There is no second
    // corner to share the wall with, and Tommy's decision was specifically
    // about the corner-geometry rule for a wall owning BOTH corners — a rule
    // for a lone corner is a new corner product nobody has asked for. It is
    // reported in the Review Log, not corrected. Asserted so that "not
    // attempted" stays distinguishable from "still broken".
    const { slots } = tileWall(40, 40, CORNER_WIDTH_IN, "end", true, false);
    expect(slots.map((s) => s.type)).toEqual(["corner", "safety-gap", "standard"]);
    // ⚠ **1/2in narrower than before 2026-10-01 (it was 14½in)**, because the
    // sliver now pays for a safety gap too. The CASE is the same case and the
    // decision not to fix it is the same decision; the panel is just smaller.
    expect(slots[2]!.widthIn).toBe(14);
    expect(slots[2]!.widthIn).toBeLessThan(TILER_MIN_PANEL_WIDTH_IN);
    expect(slots.reduce((sum, s) => sum + Math.round(s.widthIn * 8), 0)).toBe(Math.round(40 * 8));
  });

  it("residual 2: rawStandardCount === 0 — openings eating all but a sliver", () => {
    // A 148.5in window on a 200in wall leaves half an inch of plain budget.
    // Its neighbours are an opening and a corner; there is no standard panel
    // to absorb into, so the gap clamps and nothing else can be done.
    const { slots } = retileWithOpenings(200, 40, CORNER_WIDTH_IN, "end", true, true, [
      { beforeStandardCount: 0, type: "window", widthIn: 148.5 },
    ]);
    expect(slots.map((s) => s.type)).toEqual(["corner", "window", "safety-gap", "corner"]);
    expect(slots.reduce((sum, s) => sum + Math.round(s.widthIn * 8), 0)).toBe(Math.round(200 * 8));
  });

  it("residual 3: a single corner clamped onto a sub-25½in wall", () => {
    // A degenerate wall. The corner clamps to the wall's own length rather
    // than protruding, and the result is under the fabrication minimum with
    // nothing else on the wall to take width from.
    const { slots } = tileWall(20, 40, CORNER_WIDTH_IN, "end", true, false);
    expect(slots).toHaveLength(1);
    expect(slots[0]!.type).toBe("corner");
    expect(slots[0]!.widthIn).toBe(20);
    expect(slots[0]!.widthIn).toBeLessThan(TILER_MIN_PANEL_WIDTH_IN);
  });

  it("tiles a whole ADU-like footprint with nothing under the minimum, on every wall", () => {
    // The acceptance criterion, as a deterministic test rather than only as a
    // browser run: draw a rectangular building and tile all four of its walls
    // the way the app does — corner ownership alternating, so two opposite
    // walls own both their corners and the other two own none.
    //
    // Swept over a range of plausible ADU sizes rather than one, at every
    // whole foot, because the point is that Tommy can draw ANY building on
    // Monday and not meet a panel his shop cannot make. The 5'-1¾" band is
    // far below this range — a habitable room's wall is not 61¾in long — so
    // this sweep never exercised it either way; corner absorb covers it now,
    // and the band's own describe block is what proves that.
    const violations: string[] = [];
    for (let widthFt = 16; widthFt <= 44; widthFt++) {
      for (let depthFt = 16; depthFt <= 44; depthFt++) {
        for (const standardWidthIn of ABSORB_STANDARD_WIDTHS_IN) {
          const walls: [number, boolean, boolean][] = [
            [widthFt * 12, true, true],
            [depthFt * 12, false, false],
            [widthFt * 12, true, true],
            [depthFt * 12, false, false],
          ];
          for (const [lengthIn, hasStart, hasEnd] of walls) {
            for (const gapEnd of GAP_ENDS) {
              const { slots } = tileWall(lengthIn, standardWidthIn, CORNER_WIDTH_IN, gapEnd, hasStart, hasEnd);
              collectFabricationViolations(
                slots,
                lengthIn,
                `ADU ${widthFt}x${depthFt}ft, wall ${lengthIn}in, standard ${standardWidthIn}in, gap ${gapEnd}`,
                violations,
              );
            }
          }
        }
      }
    }
    expect(violations.slice(0, 10)).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // THE SUB-MINIMUM BANDS AFTER THE TWO-TIER GAP — measured, not argued.
  //
  // Every run now reserves a safety gap, so a run too short to hold a gap AND a
  // buildable panel has no legal tiling at all. That is not a new KIND of case —
  // it is residual 1's one-corner twin and its corner-less cousin, both already
  // "reported, not corrected" — but the band MOVED, and a band that moves without
  // being measured is how a regression ships.
  //
  // **Measured at the 40in standard, every eighth from 0 to 200in:**
  //
  //   | corners | sub-minimum run lengths | count | before 2026-10-01 |
  //   |---|---|---|---|
  //   | neither | 5/8in .. 24-3/8in | 191 | 1/8in .. 23-7/8in, 191 |
  //   | one     | 26-1/8in .. 49-7/8in | 191 | 25-5/8in .. 49-3/8in, 191 |
  //   | both    | none | 0 | none, 0 |
  //
  // Three things worth saying out loud about that table:
  //
  //   1. **The band is the same SIZE. It only shifted, by exactly the narrow
  //      gap's own 1/2in.** Four lengths at the top are newly unbuildable; four
  //      at the bottom stop producing a panel at all (the whole run becomes the
  //      gap), so they leave the band.
  //   2. **The TWO-CORNER case has none, before or after**, because corner absorb
  //      reaches it — and that is only still true because the absorb band's
  //      ceiling moved with the gap (`cornerBandMiddleIn`). Without that, a 75in
  //      wall would have come out as a 1/2in gap and a 23½in panel.
  //   3. **There is no legal answer for the four lengths that moved in**, and no
  //      building value was touched to pretend otherwise. A 24in run holding a
  //      1/2in gap leaves 23½in, which is under the shop's confirmed 24in
  //      minimum; the only ways out are to drop the gap on short runs (which
  //      reverses Tommy's decision) or to move the 24in minimum (off limits). So
  //      it is reported in the Review Log, exactly as the rest of the band
  //      already is. **Tommy's call, not this code's.**
  // -------------------------------------------------------------------------
  it("the sub-minimum run bands are the two residual cases, shifted by the gap and no wider", () => {
    const bands: Record<string, { first: number | null; last: number | null; count: number; gaps: number }> = {};
    for (const [label, hasStart, hasEnd] of [
      ["neither", false, false],
      ["one", true, false],
      ["both", true, true],
    ] as [string, boolean, boolean][]) {
      let first: number | null = null;
      let last: number | null = null;
      let count = 0;
      let gaps = 0; // non-contiguous jumps — a band with holes would be a different story
      let prev: number | null = null;
      for (let e = 1; e <= 200 * 8; e++) {
        const lengthIn = e / 8;
        const { slots } = tileWall(lengthIn, 40, CORNER_WIDTH_IN, "end", hasStart, hasEnd);
        const panels = slots.filter((slot) => slot.type === "standard");
        if (panels.length === 0) continue;
        if (!panels.some((slot) => slot.widthIn < TILER_MIN_PANEL_WIDTH_IN)) continue;
        count++;
        if (first === null) first = lengthIn;
        else if (prev !== null && Math.abs(lengthIn - prev - 0.125) > 1e-9) gaps++;
        last = lengthIn;
        prev = lengthIn;
      }
      bands[label] = { first, last, count, gaps };
    }
    expect(bands).toEqual({
      neither: { first: 0.625, last: 24.375, count: 191, gaps: 0 },
      one: { first: 26.125, last: 49.875, count: 191, gaps: 0 },
      both: { first: null, last: null, count: 0, gaps: 0 },
    });
  });

  it("and the gap is what shifted them: the same sweep with no gap reserved lands 1/2in lower", () => {
    // Re-derives the "before" column of the table above from this code rather
    // than quoting a number nobody can check: a run that keeps the gap's 1/2in
    // for itself is exactly the pre-2026-10-01 arithmetic on these lengths,
    // because below one standard width the whole budget became one panel.
    const subMinimum = (runLengthIn: number, keepGap: boolean) => {
      const budget = keepGap ? runLengthIn - 0.5 : runLengthIn;
      return budget > 0 && budget < TILER_MIN_PANEL_WIDTH_IN;
    };
    expect(subMinimum(24, true)).toBe(true); // newly unbuildable
    expect(subMinimum(24, false)).toBe(false); // was legal, exactly at the floor
    expect(subMinimum(24.5, true)).toBe(false); // the first legal run again
    expect(subMinimum(0.375, true)).toBe(false); // the whole run IS the gap now
    expect(subMinimum(0.375, false)).toBe(true); // it used to be a 3/8in panel
  });

  it("absorbs on a short run too — one wider panel beside the narrow gap, never two under the floor", () => {
    // A 40⅛in corner-less run at the 40in standard. Three successive rules have
    // owned this case and all three answers are legal, which is why it is here:
    //   - before absorb (2026-09-24): two ~20in panels, ceil(40.125 / 40) = 2;
    //   - absorb, with no gap under 12ft: one 40⅛in panel;
    //   - the two-tier gap (2026-10-01): a 1/2in gap plus one 39⅝in panel,
    //     because the gap comes off the budget first and 39⅝in is still a single
    //     legal panel (floor(39.625 / 40) = 0, so it is the whole remainder).
    const { slots } = tileWall(40.125, 40, CORNER_WIDTH_IN, "end", false, false);
    expect(slots.map((s) => [s.type, s.widthIn])).toEqual([
      ["safety-gap", 0.5],
      ["standard", 39.625],
    ]);
    expect(slots.reduce((a, s) => a + Math.round(s.widthIn * 8), 0)).toBe(Math.round(40.125 * 8));
  });
});

// ---------------------------------------------------------------------------
// CORNER ABSORB — the 51in-75½in two-corner dead band (2026-09-25; top edge
// moved from 75in on 2026-10-01).
//
// A wall owning corners at both ends spends 2 x 25.5in = 51in on them, so its
// middle is `L - 51`, which is under the shop's confirmed 24in fabrication
// minimum for every L below 75in. Too long for the merged-corner rule, too
// short to hold a legal middle panel: no legal tiling existed in that band at
// all, and absorb could not reach it because there was nothing on the run to
// absorb into.
//
// ⚠ **The band is four eighths wider since the two-tier safety gap (2026-10-01).**
// Every run now reserves a gap, so the middle must hold the gap AND a legal
// panel: at 75in the 24in middle became a 1/2in gap plus a 23½in panel, which is
// the very thing this band exists to prevent. `cornerBandMiddleIn`'s ceiling is
// now `TILER_MIN_PANEL_WIDTH_IN + gapWidthIn`. **No catalog number moved** —
// 24in, 48in and the 25.5in corner are all untouched.
//
// Tommy, 2026-09-24: "I want to prioritize good building principles here with
// the panelizer. I like the corner geometry rule." He chose the
// corner-geometry route and explicitly rejected refusing these wall lengths,
// so there is no fallback refusal here either — every length in the band has
// to come out legal on its own, which is why this is a sweep.
//
// ⚠ These tests call `tileWall` DIRECTLY and deliberately.
// `buildRectangleFootprint` clamps every side to MIN_DIMENSION_FT = 8ft, so a
// rectangle can never have a wall in this band at all — a band test written
// against a rectangle is silently testing nothing.
// ---------------------------------------------------------------------------
describe("corner absorb: the 51in-75.5in two-corner band", () => {
  const band = (lengthIn: number, standardWidthIn = 40) =>
    tileWall(lengthIn, standardWidthIn, CORNER_WIDTH_IN, "end", true, true).slots.map((s) => [s.type, s.widthIn]);

  it("51in — the boundary below the band — is UNCHANGED: two nominal corners, no middle", () => {
    // The pair fits at nominal width with exactly zero middle, so the absorb
    // branch must not fire here. This is the case that proves the branch is
    // keyed on "the middle is too small to build", not on "the wall is short".
    expect(band(51)).toEqual([
      ["corner", 25.5],
      ["corner", 25.5],
    ]);
  });

  it("60in (5ft) — two 30in corner panels", () => {
    // 9in of middle, which cannot be a panel. The pair takes it: 30in each,
    // both over the 25.5in nominal corner and both far inside the 48in
    // ceiling. One butt joint at mid-wall, one return face per panel.
    expect(band(60)).toEqual([
      ["corner", 30],
      ["corner", 30],
    ]);
  });

  it("72in (6ft, the bump-out Tommy was first offered) — two 36in corner panels", () => {
    // This is the length that made the band worth fixing rather than
    // documenting: 6ft leaves a 21in middle, three inches inside the broken
    // band, so a "6ft minimum bump-out" rule would have produced exactly the
    // panel his shop cannot build, under a rule bearing his name.
    expect(band(72)).toEqual([
      ["corner", 36],
      ["corner", 36],
    ]);
  });

  it("75.375in — the top of the band, and the widest panel it can ever emit", () => {
    // The odd eighth goes to the lowest index, which is `distributeEighths`'
    // own deliberately arbitrary but FIXED rule. **The widest panel the band
    // can ever emit is therefore 37.75in** — 10.25in clear of the 48in
    // ceiling. (37.6875in is the MEAN of the pair, a sixteenth, and so is not
    // a width this app can emit at all; it was quoted here as "the worst case"
    // until 2026-10-01.)
    //
    // ⚠ Was 74.875in / 37.5in until 2026-10-01: the band's top edge moved out by
    // the narrow gap's own 1/2in.
    expect(band(75.375)).toEqual([
      ["corner", 37.75],
      ["corner", 37.625],
    ]);
  });

  it("75in (6ft 3in) is now INSIDE the band — its 24in middle cannot hold a gap and a legal panel", () => {
    // The case the two-tier gap moved, asserted from the inside rather than
    // left to the sweep. 24in of middle is 1/2in of gap plus a 23½in panel; the
    // pair takes the whole wall instead.
    expect(band(75)).toEqual([
      ["corner", 37.5],
      ["corner", 37.5],
    ]);
  });

  it("75.5in — the first two-corner wall whose middle holds a gap AND a legal panel", () => {
    expect(band(75.5)).toEqual([
      ["corner", 25.5],
      ["safety-gap", 0.5],
      ["standard", 24],
      ["corner", 25.5],
    ]);
  });

  it("the band's answer does not depend on standardWidthIn at all", () => {
    // There is no standard panel on these walls, so there is nothing for the
    // project's standard width to size. Asserted rather than assumed, because
    // a band result that drifted with the width setting would mean the middle
    // was still being sized somewhere.
    for (const standardWidthIn of ABSORB_STANDARD_WIDTHS_IN) {
      expect(band(61.75, standardWidthIn)).toEqual([
        ["corner", 30.875],
        ["corner", 30.875],
      ]);
    }
  });

  it("the existing merged-corner case still behaves exactly as it did", () => {
    // Below 51in the corners would overlap, and the rule there is unchanged:
    // ONE corner panel spanning the whole wall. The spec's own example.
    expect(tileWall(48, 40, CORNER_WIDTH_IN, "end", true, true).slots.map((s) => [s.type, s.widthIn])).toEqual([
      ["corner", 48],
    ]);
    expect(band(50.875)).toEqual([["corner", 50.875]]);
    // ⚠ And the pre-existing defect that rule carries, recorded rather than
    // quietly fixed or quietly broken: between 48in and 51in the merged panel
    // is over the 48in ceiling. It is out of scope here by instruction
    // ("the existing merged-corner case still behaves as today"), and it is
    // why the sweeps in this file start at 51in and not lower.
    expect(50.875).toBeGreaterThan(TILER_MAX_PANEL_WIDTH_IN);
  });

  it("a wall owning only ONE corner never absorbs — there is no pair", () => {
    // Same length, one corner: the middle survives as a standard panel beside
    // its gap rather than being swallowed. (34½in before the two-tier gap took
    // its 1/2in; still legal either way.)
    expect(tileWall(60, 40, CORNER_WIDTH_IN, "end", true, false).slots.map((s) => [s.type, s.widthIn])).toEqual([
      ["corner", 25.5],
      ["safety-gap", 0.5],
      ["standard", 34],
    ]);
    expect(tileWall(60, 40, CORNER_WIDTH_IN, "end", false, false).slots.map((s) => [s.type, s.widthIn])).toEqual([
      ["safety-gap", 0.5],
      ["standard", 29.75],
      ["standard", 29.75],
    ]);
  });

  it("sweeps the whole band at every eighth: two corner panels, in range, summing exactly", () => {
    const violations: string[] = [];
    // Upper bound 75.5in, not 75in, since 2026-10-01 — see the band note above.
    for (let eighths = 51 * 8 + 1; eighths < 75.5 * 8; eighths++) {
      const wallLengthIn = eighths / 8;
      for (const standardWidthIn of ABSORB_STANDARD_WIDTHS_IN) {
        for (const gapEnd of GAP_ENDS) {
          const { slots } = tileWall(wallLengthIn, standardWidthIn, CORNER_WIDTH_IN, gapEnd, true, true);
          const label = `tileWall(${wallLengthIn}, ${standardWidthIn}, ${gapEnd})`;
          if (slots.length !== 2 || slots.some((s) => s.type !== "corner")) {
            violations.push(`${label}: expected two corner slots, got ${slots.map((s) => s.type).join("+")}`);
          }
          // The pair is never below the nominal corner width either — a
          // stronger claim than the 24in floor, and the one that says these
          // are real corner panels rather than shrunken ones.
          if (slots.some((s) => s.widthIn < CORNER_WIDTH_IN - 1e-9)) {
            violations.push(`${label}: a corner came out under the ${CORNER_WIDTH_IN}in nominal width`);
          }
          collectFabricationViolations(slots, wallLengthIn, label, violations);
        }
      }
    }
    expect(violations.slice(0, 10)).toEqual([]);
  });

  it("a band wall KEEPS an opening that still fits its nominal middle", () => {
    // Reachable through `retilePreservingOpenings` when a longer wall is
    // shortened into the band: the 20in window fits inside the 23in nominal
    // middle, so the corners absorb only the 3in left over instead of the
    // merged branch's "drop everything".
    const { slots } = retileWithOpenings(74, 40, CORNER_WIDTH_IN, "end", true, true, [
      { beforeStandardCount: 0, type: "window", widthIn: 20 },
    ]);
    expect(slots.map((s) => [s.type, s.widthIn])).toEqual([
      ["corner", 27],
      ["window", 20],
      ["corner", 27],
    ]);
    expect(slots.reduce((sum, s) => sum + Math.round(s.widthIn * 8), 0)).toBe(Math.round(74 * 8));
  });

  it("...and drops one that does not, which is what merging has always done", () => {
    // A 36in window cannot fit a 60in wall's 9in nominal middle. Keeping it
    // would make the slots sum to more than the wall — the sum invariant is
    // not negotiable, so the opening goes, exactly as `merged` drops it.
    const { slots } = retileWithOpenings(60, 40, CORNER_WIDTH_IN, "end", true, true, [
      { beforeStandardCount: 0, type: "window", widthIn: 36 },
    ]);
    expect(slots.map((s) => [s.type, s.widthIn])).toEqual([
      ["corner", 30],
      ["corner", 30],
    ]);
    expect(slots.reduce((sum, s) => sum + Math.round(s.widthIn * 8), 0)).toBe(Math.round(60 * 8));
  });

  it("sweeps the band through retileWithOpenings too, with 1-3 openings", () => {
    const violations: string[] = [];
    for (let eighths = 51 * 8 + 1; eighths < 75 * 8; eighths++) {
      const wallLengthIn = eighths / 8;
      for (const standardWidthIn of ABSORB_STANDARD_WIDTHS_IN) {
        for (const openingWidthIn of [12, 20, 36]) {
          for (let openingCount = 1; openingCount <= 3; openingCount++) {
            const openings: OpeningAnchor[] = Array.from({ length: openingCount }, (_, i) => ({
              beforeStandardCount: i,
              type: "window" as const,
              widthIn: openingWidthIn,
            }));
            const { slots } = retileWithOpenings(
              wallLengthIn,
              standardWidthIn,
              CORNER_WIDTH_IN,
              "end",
              true,
              true,
              openings,
            );
            collectFabricationViolations(
              slots,
              wallLengthIn,
              `retileWithOpenings(${wallLengthIn}, ${standardWidthIn}, ${openingCount}x${openingWidthIn}in)`,
              violations,
            );
          }
        }
      }
    }
    expect(violations.slice(0, 10)).toEqual([]);
  });

  it("every wall of a small octagon lands in the band, and every one of them tiles legally", () => {
    // A regular octagon's side is 0.41421x its bounding box, so EVERY wall of
    // an octagon between 10.26ft and 15.09ft across is in the band — and
    // every wall of an octagon owns both its corners, because the corners are
    // mitered. Small octagons were broken outright before this fix, which is
    // why it was prioritised now. Lengths are computed from the ratio rather
    // than from a footprint so that this test states the arithmetic it is
    // about; `octagonBandIsLegal` in retile.test.ts does the footprint end.
    const SIDE_RATIO = 0.41421356;
    const violations: string[] = [];
    let wallsInBand = 0;
    for (let acrossFt = 10.5; acrossFt <= 15; acrossFt += 0.125) {
      const sideIn = Math.round(acrossFt * 12 * SIDE_RATIO * 8) / 8;
      if (sideIn <= 51 || sideIn >= 75) continue;
      wallsInBand++;
      for (const standardWidthIn of ABSORB_STANDARD_WIDTHS_IN) {
        const { slots } = tileWall(sideIn, standardWidthIn, CORNER_WIDTH_IN, "end", true, true);
        collectFabricationViolations(slots, sideIn, `octagon ${acrossFt}ft across, side ${sideIn}in`, violations);
      }
    }
    expect(wallsInBand).toBeGreaterThan(30); // the band is genuinely covered
    expect(violations.slice(0, 10)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// BACKWARD COMPATIBILITY — proved against real outputs, not against a flag.
//
// The single most important property of this change is that a wall OUTSIDE
// the band tiles exactly as it did before it. That is asserted here as a
// digest over the entire sweep, and the expected values were produced by
// running this same fold against `main`'s own tiling.ts at a3843f1 — the
// commit this work branched from — not against the code under test.
//
// To reproduce: `git show a3843f1:packages/geometry/src/tiling.ts` into
// `packages/geometry/src/__baseline.ts`, import `tileWall`/
// `retileWithOpenings` from it instead, and re-run. The harness that did it
// also compared every case string-by-string and reported zero differences
// over 169,768 tileWall and 254,652 retileWithOpenings configurations.
//
// A digest rather than a fixture because the fixture would be 424,420 rows.
// If you change tiler behaviour outside the band, this fails — and updating
// the constant instead of explaining the change is how a silent regression
// gets shipped.
// ---------------------------------------------------------------------------
// ⚠ **RE-BASELINED 2026-10-01, and the title no longer means what it says.**
// These two digests were measured on `a3843f1` to prove corner absorb moved
// NOTHING outside its own band. The two-tier safety gap moves every
// configuration in this sweep by design — every run now reserves a gap — so
// "unchanged since a3843f1" is no longer a claim anyone can make, and
// pretending otherwise by leaving the old constant in place would have been a
// lie that failed loudly rather than a check that worked. What the pair is
// worth keeping for is what it was always really doing: catching an
// UNINTENDED change. Both digests and both counts are re-measured on this
// branch, with the previous values recorded beside them so the re-baseline is
// visible rather than quietly overwritten. The properties that must hold
// absolutely — the sum invariant and the [24in, 48in] bounds — are asserted by
// the sweeps above, not by these digests.
// ⚠ **RENAMED 2026-10-01, because the old name had become false.** This block
// was called "walls outside the band tile byte-identically to before corner
// absorb" — a claim about `main` @ `a3843f1` that the two-tier gap retired, since
// every configuration in this sweep now carries a gap it did not carry then.
// Both digests are re-baselined ONTO THIS BRANCH, so what the pair detects is an
// unintended future change, not identity with any earlier tree. A test whose
// name is not true of what it asserts is the same defect class as an Open Items
// pointer that names no item.
describe("walls outside the band: a digest pair that catches an UNINTENDED change (baselined on this branch, 2026-10-01)", () => {
  /** In the band, behaviour changed on purpose; everywhere else it must not.
   * Top edge 75.5in since 2026-10-01 — see the band note above. */
  const inBand = (lengthIn: number, hasCornerStart: boolean, hasCornerEnd: boolean): boolean =>
    hasCornerStart && hasCornerEnd && lengthIn > 51 && lengthIn < 75.5;

  /** FNV-1a over a rendering that carries both the slot TYPES and their exact
   * widths in integer eighths — so a one-eighth move anywhere in the sweep
   * changes the answer. */
  function fold(seed: number, text: string): number {
    let hash = seed;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash >>> 0;
  }
  const FNV_OFFSET = 2166136261;
  const render = (slots: PanelSlot[]): string =>
    slots.map((s) => `${s.type}:${Math.round(s.widthIn * 8)}`).join("|");

  it("tileWall: 169,768 out-of-band configurations, unchanged", () => {
    let digest = FNV_OFFSET;
    let compared = 0;
    for (let eighths = SWEEP_START_IN * 8; eighths <= 720 * 8; eighths++) {
      const wallLengthIn = eighths / 8;
      for (const standardWidthIn of ABSORB_STANDARD_WIDTHS_IN) {
        for (const gapEnd of GAP_ENDS) {
          for (const [hasCornerStart, hasCornerEnd] of CORNER_COMBOS) {
            if (inBand(wallLengthIn, hasCornerStart, hasCornerEnd)) continue;
            const { slots } = tileWall(
              wallLengthIn,
              standardWidthIn,
              CORNER_WIDTH_IN,
              gapEnd,
              hasCornerStart,
              hasCornerEnd,
            );
            compared++;
            digest = fold(
              digest,
              `${wallLengthIn},${standardWidthIn},${gapEnd},${hasCornerStart},${hasCornerEnd}=${render(slots)};`,
            );
          }
        }
      }
    }
    expect(compared).toBe(169736);
    // RE-BASELINED 2026-10-01 for the two-tier safety gap, which moved every
    // configuration here on purpose. Was 4137668243 over 169,768 configurations
    // (measured on a3843f1, before corner absorb); the count dropped by 32
    // because the band swallowed four more eighth-steps x 4 standard widths x 2
    // gap ends. See this describe block's own note.
    expect(digest).toBe(3712675599);
  });

  it("retileWithOpenings: 254,652 out-of-band configurations, unchanged", () => {
    let digest = FNV_OFFSET;
    let compared = 0;
    for (let eighths = SWEEP_START_IN * 8; eighths <= 720 * 8; eighths++) {
      const wallLengthIn = eighths / 8;
      for (const standardWidthIn of ABSORB_STANDARD_WIDTHS_IN) {
        for (const [hasCornerStart, hasCornerEnd] of CORNER_COMBOS) {
          if (inBand(wallLengthIn, hasCornerStart, hasCornerEnd)) continue;
          for (let openingCount = 1; openingCount <= 3; openingCount++) {
            const openings: OpeningAnchor[] = Array.from({ length: openingCount }, (_, i) => ({
              beforeStandardCount: i,
              type: "window" as const,
              widthIn: 36,
            }));
            const { slots } = retileWithOpenings(
              wallLengthIn,
              standardWidthIn,
              CORNER_WIDTH_IN,
              "end",
              hasCornerStart,
              hasCornerEnd,
              openings,
            );
            compared++;
            digest = fold(
              digest,
              `${wallLengthIn},${standardWidthIn},${hasCornerStart},${hasCornerEnd},${openingCount}=${render(slots)};`,
            );
          }
        }
      }
    }
    expect(compared).toBe(254604);
    // RE-BASELINED 2026-10-01, same reason as the row above. Was 512805668 over
    // 254,652 configurations (measured on a3843f1).
    expect(digest).toBe(3623257527);
  });
});

describe("computeSillRunWidths on the 1/8in grid", () => {
  it("makes every sill a whole eighth summing exactly to the rough opening", () => {
    const violations: string[] = [];
    for (let eighths = 8; eighths <= 200 * 8; eighths++) {
      const roWidthIn = eighths / 8;
      for (const standardWidthIn of STANDARD_WIDTHS_IN) {
        const widths = computeSillRunWidths(roWidthIn, standardWidthIn);
        let sumEighths = 0;
        for (const widthIn of widths) {
          if (Math.abs(widthIn * 8 - Math.round(widthIn * 8)) >= 1e-9) {
            violations.push(`sill ${roWidthIn}/${standardWidthIn}: ${widthIn} is not a whole eighth`);
          }
          if (widthIn < 0) violations.push(`sill ${roWidthIn}/${standardWidthIn}: ${widthIn} is negative`);
          if (widthIn > standardWidthIn + 1e-9) {
            violations.push(`sill ${roWidthIn}/${standardWidthIn}: ${widthIn} exceeds the standard width`);
          }
          sumEighths += Math.round(widthIn * 8);
        }
        if (sumEighths !== eighths) {
          violations.push(`sill ${roWidthIn}/${standardWidthIn}: sums to ${sumEighths} eighths, RO is ${eighths}`);
        }
      }
    }
    expect(violations.slice(0, 10)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// SQUARE BALE REFUSES, IT DOES NOT ABSORB (2026-09-26)
//
// `squareBalePanel.widthIn` is a CONFIRMED 39in whole-bale unit — two 18in
// bales plus two 1.5in studs — and the app tiles Square Bale corners at that
// width (`cornerWidthInForTiling` in page.tsx). That moves the two-corner band
// from 51in-75.5in to 78in-102.5in, where absorb would emit corner "panels" up to
// 48in wide. Tommy, asked directly whether a bale corner may be widened the
// way a plywood-faced corner panel may:
//
//   "No — refuse instead."
//
// Bales do not stretch, so widening a bale corner invents a product. The
// geometry therefore stops absorbing (`cornerMayWiden: false`), the wall keeps
// today's nominal corners plus a sub-minimum middle the Review Log already
// reports, and the app refuses the panelization by name at the point of edit.
//
// Every "would have been" number below was MEASURED on this branch before the
// gate went in, by sweeping every eighth from 78in to 103in at a 39in corner.
// ---------------------------------------------------------------------------
describe("Square Bale's 39in corner: refuse, do not absorb", () => {
  const BALE_CORNER_IN = 39;
  const bale = (lengthIn: number, cornerMayWiden: boolean, standardWidthIn = 39) =>
    tileWall(lengthIn, standardWidthIn, BALE_CORNER_IN, "end", true, true, true, cornerMayWiden).slots.map((s) => [
      s.type,
      s.widthIn,
    ]);

  describe("cornerBandMiddleIn — the one definition of 'this wall is in the band'", () => {
    // Every wall this function is ever asked about is far under the 144in run
    // threshold, so the gap tier is always the narrow one. Named rather than
    // inlined, because the gap width is now part of the band's own definition.
    const GAP = NARROW_SAFETY_GAP_WIDTH_IN;

    it("names the sub-minimum middle at the 25.5in corner panel", () => {
      expect(cornerBandMiddleIn(72, 25.5, true, true, GAP)).toBe(21);
      expect(cornerBandMiddleIn(60, 25.5, true, true, GAP)).toBe(9);
      // 51in: the pair fits with a zero middle. Not the band.
      expect(cornerBandMiddleIn(51, 25.5, true, true, GAP)).toBeNull();
      // ⚠ 75in WAS the first legal middle (exactly the 24in floor) and is now
      // inside the band: a 24in middle is a 1/2in gap plus a 23½in panel. The
      // first legal middle is 24½in, at a 75½in wall.
      expect(cornerBandMiddleIn(75, 25.5, true, true, GAP)).toBe(24);
      expect(cornerBandMiddleIn(75.375, 25.5, true, true, GAP)).toBe(24.375);
      expect(cornerBandMiddleIn(75.5, 25.5, true, true, GAP)).toBeNull();
      // Too short for the pair at all — that is the merge case, not this one.
      expect(cornerBandMiddleIn(40, 25.5, true, true, GAP)).toBeNull();
    });

    it("the band's ceiling tracks the gap width it is given, which is the whole coupling", () => {
      // Handed the WIDE tier, the ceiling moves out another quarter inch. No
      // real wall in this band ever gets the wide tier (a 144in run cannot own
      // two 25.5in corners and a sub-25in middle), but the coupling is what the
      // parameter exists for and an untested parameter is a parameter that rots.
      expect(cornerBandMiddleIn(75.5, 25.5, true, true, WIDE_SAFETY_GAP_WIDTH_IN)).toBe(24.5);
      expect(cornerBandMiddleIn(75.75, 25.5, true, true, WIDE_SAFETY_GAP_WIDTH_IN)).toBeNull();
    });

    it("moves the band to 78in-102.5in at the 39in bale corner", () => {
      expect(cornerBandMiddleIn(78, BALE_CORNER_IN, true, true, GAP)).toBeNull();
      expect(cornerBandMiddleIn(78.125, BALE_CORNER_IN, true, true, GAP)).toBe(0.125);
      // An 8ft wall — MIN_DIMENSION_FT, the shortest side the rectangle tool
      // will draw, i.e. entirely ordinary — is inside the moved band.
      expect(cornerBandMiddleIn(96, BALE_CORNER_IN, true, true, GAP)).toBe(18);
      expect(cornerBandMiddleIn(101.875, BALE_CORNER_IN, true, true, GAP)).toBe(23.875);
      // ⚠ 102in was the top of this band before 2026-10-01; it is now 102.5in.
      expect(cornerBandMiddleIn(102, BALE_CORNER_IN, true, true, GAP)).toBe(24);
      expect(cornerBandMiddleIn(102.5, BALE_CORNER_IN, true, true, GAP)).toBeNull();
    });

    it("is null whenever the wall does not own BOTH corners", () => {
      expect(cornerBandMiddleIn(84, BALE_CORNER_IN, true, false, GAP)).toBeNull();
      expect(cornerBandMiddleIn(84, BALE_CORNER_IN, false, true, GAP)).toBeNull();
      expect(cornerBandMiddleIn(84, BALE_CORNER_IN, false, false, GAP)).toBeNull();
    });
  });

  describe("mergedCornerWidthIn — the one definition of 'this wall merges its corners'", () => {
    it("agrees with what resolveCorners actually emits, at both corner widths", () => {
      // The whole point of exporting it: the app's refusal must not re-derive
      // the comparison and drift. Asserted against the tiler's own output
      // rather than against the formula it shares with it.
      for (const [lengthIn, cornerIn] of [
        [40, 25.5],
        [47.25, 25.5],
        [50.875, 25.5],
        [52.25, BALE_CORNER_IN],
        [72, BALE_CORNER_IN],
        [77.875, BALE_CORNER_IN],
      ] as const) {
        const slots = tileWall(lengthIn, 40, cornerIn, "end", true, true, true, false).slots;
        expect(slots).toEqual([{ type: "corner", widthIn: lengthIn }]);
        expect(mergedCornerWidthIn(lengthIn, cornerIn, true, true)).toBe(lengthIn);
      }
    });

    it("is null at and above two nominal corners — there is no merge there", () => {
      expect(mergedCornerWidthIn(51, 25.5, true, true)).toBeNull();
      expect(mergedCornerWidthIn(72, 25.5, true, true)).toBeNull();
      expect(mergedCornerWidthIn(78, BALE_CORNER_IN, true, true)).toBeNull();
      expect(mergedCornerWidthIn(96, BALE_CORNER_IN, true, true)).toBeNull();
    });

    it("is null whenever the wall does not own BOTH corners, or has no length", () => {
      expect(mergedCornerWidthIn(60, BALE_CORNER_IN, true, false)).toBeNull();
      expect(mergedCornerWidthIn(60, BALE_CORNER_IN, false, true)).toBeNull();
      expect(mergedCornerWidthIn(60, BALE_CORNER_IN, false, false)).toBeNull();
      expect(mergedCornerWidthIn(0, BALE_CORNER_IN, true, true)).toBeNull();
    });

    it("⚠ the MERGED BALE CORNER is what this exists for — 29 7/8in over the 48in ceiling at worst", () => {
      // The widest merged bale corner possible: one eighth under two nominal
      // bale corners. `panelWidthInRange.maxIn` is a confirmed 48in.
      expect(mergedCornerWidthIn(77.875, BALE_CORNER_IN, true, true)).toBe(77.875);
      expect(77.875 - 48).toBe(29.875);
      // And it is legal-width, but still not a 39in bale unit, well below the
      // ceiling — which is why the app refuses the whole merge branch under
      // Square Bale rather than only the part of it that breaches 48in.
      expect(mergedCornerWidthIn(44.75, BALE_CORNER_IN, true, true)).toBe(44.75);
    });

    it("the gate does NOT stop the merge, which is exactly the gap the app refusal closes", () => {
      // cornerMayWiden true and false give the same merged slot. Recorded so
      // nobody reads `cornerMayWiden: false` as covering this.
      expect(tileWall(72, 39, BALE_CORNER_IN, "end", true, true, true, true).slots).toEqual([
        { type: "corner", widthIn: 72 },
      ]);
      expect(tileWall(72, 39, BALE_CORNER_IN, "end", true, true, true, false).slots).toEqual([
        { type: "corner", widthIn: 72 },
      ]);
    });
  });

  it("84in (7ft): absorb WOULD have invented a 42in bale corner; refusal keeps 39in", () => {
    // Measured before the gate: [corner 42, corner 42]. A 42in "square bale
    // panel" is not a product — it is three inches of nothing between two
    // 18in bales.
    expect(bale(84, true)).toEqual([
      ["corner", 42],
      ["corner", 42],
    ]);
    // With the gate: both corners stay at the confirmed 39in whole-bale width
    // and the 6in remainder is left VISIBLE as a sub-minimum panel, which the
    // Review Log's existing sub-minimum entry reports. A visible gap beats a
    // substituted value.
    // (5½in, not 6in, since the two-tier gap takes its 1/2in first.)
    expect(bale(84, false)).toEqual([
      ["corner", 39],
      ["safety-gap", 0.5],
      ["standard", 5.5],
      ["corner", 39],
    ]);
  });

  it("96in (8ft, MIN_DIMENSION_FT): absorb WOULD have emitted two 48in bale corners", () => {
    expect(bale(96, true)).toEqual([
      ["corner", 48],
      ["corner", 48],
    ]);
    expect(bale(96, false)).toEqual([
      ["corner", 39],
      ["safety-gap", 0.5],
      ["standard", 17.5],
      ["corner", 39],
    ]);
  });

  it("95.875in: the widest pair absorb could emit, one eighth under the ceiling", () => {
    expect(bale(95.875, true)).toEqual([
      ["corner", 48],
      ["corner", 47.875],
    ]);
  });

  it("78in is two nominal bale corners with a zero middle, gate or no gate", () => {
    const expected = [
      ["corner", 39],
      ["corner", 39],
    ];
    expect(bale(78, true)).toEqual(expected);
    expect(bale(78, false)).toEqual(expected);
  });

  it("96.125in-101.875in: the legality guard ALREADY fired here, and there is still no legal tiling", () => {
    // 47 of the band's 191 eighth-steps. The pair would exceed the confirmed
    // 48in ceiling, so absorb never applied even before the gate — which is
    // why "every wall length has a legal tiling" was never true for Square
    // Bale. The gate changes nothing here; the refusal is what makes it
    // honest rather than hidden.
    let steps = 0;
    for (let eighths = 96.125 * 8; eighths <= 101.875 * 8; eighths++) {
      const lengthIn = eighths / 8;
      steps++;
      const withGate = bale(lengthIn, false);
      expect(bale(lengthIn, true)).toEqual(withGate);
      // Nominal corners, and a middle under the shop floor either way.
      expect(withGate[0]).toEqual(["corner", BALE_CORNER_IN]);
      expect(withGate[withGate.length - 1]).toEqual(["corner", BALE_CORNER_IN]);
      // Two middle slots since 2026-10-01: the narrow safety gap, then the
      // sub-minimum panel. The gap is a plywood spacer, not a panel, so only
      // the panel is held to the shop floor.
      const middle = withGate.slice(1, -1) as [string, number][];
      expect(middle.map((m) => m[0])).toEqual(["safety-gap", "standard"]);
      expect(middle[0]![1]).toBe(NARROW_SAFETY_GAP_WIDTH_IN);
      expect(middle[1]![1]).toBeLessThan(TILER_MIN_PANEL_WIDTH_IN);
    }
    expect(steps).toBe(47);
  });

  it("across the WHOLE moved band, the gate never emits a corner off the confirmed 39in", () => {
    // The property that matters: no invented bale product at any wall length,
    // on any path into the tiler — including drawing a band-length wall while
    // Square Bale is already selected, which never touches the panelization
    // control and so is never seen by the refusal.
    const offNominal: string[] = [];
    let swept = 0;
    for (let eighths = 78 * 8; eighths <= 102 * 8; eighths++) {
      const lengthIn = eighths / 8;
      for (const standardWidthIn of [24, 39, 48]) {
        const slots = tileWall(lengthIn, standardWidthIn, BALE_CORNER_IN, "end", true, true, true, false).slots;
        swept++;
        const sum = slots.reduce((acc, s) => acc + s.widthIn, 0);
        expect(sum).toBe(lengthIn);
        for (const s of slots) {
          if ((s.type === "corner" || s.type === "safety-oct-corner") && s.widthIn !== BALE_CORNER_IN) {
            offNominal.push(`${lengthIn}@${standardWidthIn}: ${s.widthIn}`);
          }
        }
      }
    }
    expect(swept).toBe(579);
    expect(offNominal).toEqual([]);
  });

  it("the gate is OFF by default, so the 25.5in corner panel still absorbs", () => {
    // Backward compatibility of the branch's own rule: `cornerMayWiden`
    // defaults to true, so every existing caller keeps corner absorb.
    expect(tileWall(72, 40, CORNER_WIDTH_IN, "end", true, true).slots.map((s) => [s.type, s.widthIn])).toEqual([
      ["corner", 36],
      ["corner", 36],
    ]);
    expect(
      tileWall(72, 40, CORNER_WIDTH_IN, "end", true, true, true, true).slots.map((s) => [s.type, s.widthIn]),
    ).toEqual([
      ["corner", 36],
      ["corner", 36],
    ]);
  });

  it("retileWithOpenings honours the gate too — a band wall keeps its window and its 39in corners, AND OVERRUNS its wall (108in of slots on 90in): pre-existing, recorded not fixed", () => {
    // 90in wall, 30in window: the nominal middle is 12in, so the window does
    // not fit there and the absorb path would have dropped it AND widened the
    // corners to 45in each. Gated, the tiling is today's: nominal corners and
    // the window kept.
    //
    // ⚠ AND THAT TILING OVERRUNS ITS WALL — 39 + 30 + 39 = 108in of slots on a
    // 90in wall. This is `main`'s own pre-existing behaviour for ANY wall whose
    // openings exceed its middle at ANY corner width (at the 25.5in corner, a
    // 60in wall with a 30in window sums to 81in the same way), which is the
    // "the pre-fix slot sum was already wrong" finding the absorb work
    // measured over 4,110 cases. Absorb hid it on band walls by dropping the
    // opening; refusing to widen a bale corner puts it back, because the only
    // two alternatives are inventing a 45in bale panel or deleting the user's
    // window without saying so. Nothing reports it today — recorded in the
    // spec's `## Open Items` as "A wall whose SLOTS do not sum to the wall"
    // (added there 2026-09-26; this comment used to cite an Open Items list the
    // item was not in). NOT fixed here, because a sum reporter is its own piece
    // of work and this test exists so the exposure cannot be lost.
    //
    // ⚠ HOW FAR IT REACHES, established 2026-09-26 and worth stating because it
    // is not obvious: an overrun wall's slots ARE the panel instances, so the
    // overrun reaches **the price, the cut list and the per-unique-panel shop
    // sheets** — 108in of panels drawn, priced and cut for a 90in wall — while
    // being **invisible in 3D and in the OBJ export**, because
    // `panelSlotBoxes3D` defensively rescales every slot by
    // `lengthIn / totalWidthIn` (0.8333 here, see its line 107). **So the render
    // looks right while the parts are 17% wider than the wall can take**, which
    // is the strongest argument there is for the missing slot-sum/ceiling
    // reporter — it now has three customers (this, the merged corner over the
    // 48in ceiling, and the boundary-drag 56in panel).
    const gated = retileWithOpenings(
      90,
      39,
      BALE_CORNER_IN,
      "end",
      true,
      true,
      [{ beforeStandardCount: 0, type: "window", widthIn: 30 }],
      true,
      false,
    ).slots;
    expect(gated.map((s) => [s.type, s.widthIn])).toEqual([
      ["corner", 39],
      ["window", 30],
      ["corner", 39],
    ]);
    expect(gated.reduce((acc, s) => acc + s.widthIn, 0)).toBe(108);
    // Ungated, for the record: the window is dropped and the corners invent
    // themselves a 45in width.
    expect(
      retileWithOpenings(
        90,
        39,
        BALE_CORNER_IN,
        "end",
        true,
        true,
        [{ beforeStandardCount: 0, type: "window", widthIn: 30 }],
        true,
        true,
      ).slots.map((s) => [s.type, s.widthIn]),
    ).toEqual([
      ["corner", 45],
      ["corner", 45],
    ]);
  });
});
