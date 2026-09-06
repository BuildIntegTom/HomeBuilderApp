import { describe, expect, it } from "vitest";
import { computeSillRunWidths, getOpeningAnchors, markSafetyCorner, nextPanelCycleState, retileWithOpenings, tileWall } from "./tiling";
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

  it("walls at or under 12ft skip the safety/gap panel entirely, using evenly-sized standards instead", () => {
    // wallLengthIn=55 <= 144 (12ft) -> no gap panel at all, regardless of
    // how the remainder would otherwise have degenerated. middle=15,
    // round(15/40)=0 -> clamped to 1 evenly-sized "standard" panel.
    const result = tileWall(55, 40, 20, "end");
    expect(result.slots.map((s) => s.type)).toEqual(["corner", "standard", "corner"]);
    expect(result.slots[1]!.widthIn).toBe(15);
  });

  it("still skips the gap panel under 12ft when more than 1 standard's worth fits, capped at standard width", () => {
    // wallLengthIn=90 <= 144; middle=50, ceil(50/40)=2 -> 2 evenly-sized
    // standards (25 each) instead of 1 oversized 50in panel.
    const result = tileWall(90, 40, 20, "end");
    expect(result.slots.map((s) => s.type)).toEqual(["corner", "standard", "standard", "corner"]);
    expect(result.slots.map((s) => s.widthIn)).toEqual([20, 25, 25, 20]);
  });

  it("splits evenly into multiple standards under 12ft when the budget calls for more than one", () => {
    // wallLengthIn=110 <= 144; middle=70, round(70/40)=2 -> 2 evenly-sized standards (35 each)
    const result = tileWall(110, 40, 20, "end");
    expect(result.slots.map((s) => s.type)).toEqual(["corner", "standard", "standard", "corner"]);
    expect(result.slots.map((s) => s.widthIn)).toEqual([20, 35, 35, 20]);
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
    const grown = tileWall(50, 40, 20, "end");
    expect(grown.slots.map((s) => s.type)).toEqual(["corner", "standard", "corner"]);
    expect(grown.slots.map((s) => s.widthIn)).toEqual([20, 10, 20]);
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
    // 4. the pre-existing "never hand the shop an oversized panel" rule
    if (slot.type === "standard" && slot.widthIn > standardWidthIn + 1e-9) {
      violations.push(`${label}: standard slot ${slot.widthIn} exceeds standardWidthIn ${standardWidthIn}`);
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
  it("holds for tileWall across every eighth from 96in to 720in, all widths/gap ends/corner combos", () => {
    const violations: string[] = [];
    for (let eighths = 96 * 8; eighths <= 720 * 8; eighths++) {
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
    for (let eighths = 96 * 8; eighths <= 720 * 8; eighths += 1) {
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

  it("splits the 47.125in leftover budget as 23.625 + 23.5, not 23.5625 twice", () => {
    // The named regression. A 178.875in wall with two corners leaves a middle
    // of 127.875in; minus the 0.75in gap that is 127.125in, which is 3 whole
    // 40in standards plus a 7.125in remainder — so the panel next to the gap
    // splits a budget of 40 + 7.125 = 47.125in (377 eighths, an ODD number of
    // eighths). The old even halving put both halves on a sixteenth.
    const { slots } = tileWall(178.875, 40, CORNER_WIDTH_IN, "end");
    const widths = slots.map((s) => s.widthIn);
    expect(widths).toContain(23.625);
    expect(widths).toContain(23.5);
    expect(widths).not.toContain(23.5625);
    expect(slots.reduce((sum, s) => sum + Math.round(s.widthIn * 8), 0)).toBe(Math.round(178.875 * 8));
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
    // standardWidthIn is a cap, so 16.7 becomes 16.625, never 16.75. Rounding
    // a cap upward would hand the shop a panel wider than the cap asked for.
    const { slots } = tileWall(400, 16.7, CORNER_WIDTH_IN, "end");
    const standards = slots.filter((s) => s.type === "standard").map((s) => s.widthIn);
    expect(Math.max(...standards)).toBeLessThanOrEqual(16.7);
    expect(standards).toContain(16.625);
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
