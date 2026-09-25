import { describe, expect, it } from "vitest";
import {
  computeSillRunWidths,
  getOpeningAnchors,
  markSafetyCorner,
  nextPanelCycleState,
  retileWithOpenings,
  tileWall,
  TILER_MAX_PANEL_WIDTH_IN,
  TILER_MIN_PANEL_WIDTH_IN,
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
describe("the absorb rule: no tiler-generated panel the shop cannot build", () => {
  /** The four reachable standard widths: the fabrication floor, Square Bale's
   * fixed 39in, the 40in default, and the catalog ceiling. */
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

  it("holds for tileWall across every eighth from 96in to 720in, all widths/gap ends/corner combos", () => {
    const violations: string[] = [];
    for (let eighths = 96 * 8; eighths <= 720 * 8; eighths++) {
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
    for (let eighths = 96 * 8; eighths <= 720 * 8; eighths++) {
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
  it("residual 1: a two-corner wall between 51in and 75in still yields a sub-minimum middle", () => {
    // 51in of corners on a 61.75in wall (the ADU's own 5'-1¾" plan dimension,
    // which is why this band is worth watching) leaves a 10.75in middle.
    // floor(10.75 / 24) is 0, so no legal panel count exists at all.
    //
    // The real fix extends resolveCorners' merged-corner rule to "too short
    // for both corners PLUS a legal middle" — corner geometry, i.e. real
    // construction. Tommy flagged it and deferred it until after admin
    // tooling: "I want to prioritize good building principles here with the
    // panelizer. I like the corner geometry rule… Let's flag this and return
    // to it after admin tooling." NOT attempted here on purpose.
    const { slots } = tileWall(61.75, 40, CORNER_WIDTH_IN, "end", true, true);
    const middle = slots.filter((s) => s.type === "standard");
    expect(middle).toHaveLength(1);
    expect(middle[0]!.widthIn).toBeCloseTo(10.75, 6);
    expect(middle[0]!.widthIn).toBeLessThan(TILER_MIN_PANEL_WIDTH_IN);
    // The sum invariant still holds — a broken wall, not a broken total.
    expect(slots.reduce((sum, s) => sum + Math.round(s.widthIn * 8), 0)).toBe(Math.round(61.75 * 8));
    // And the first legal two-corner wall is 75in, where the middle is
    // exactly 24in. 6ft (72in) leaves 21in and is INSIDE the broken band —
    // recording "6ft minimum" would have produced the very panel his shop
    // cannot build.
    const legal = tileWall(75, 40, CORNER_WIDTH_IN, "end", true, true).slots.filter((s) => s.type === "standard");
    expect(legal[0]!.widthIn).toBe(24);
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
    // Monday and not meet a panel his shop cannot make. The 5'-1¾" band that
    // absorb genuinely cannot reach (residual 1) is far below this range — a
    // habitable room's wall is not 61¾in long — which is why deferring that
    // fix does not block the job.
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

  it("absorbs on a short wall too — buildEvenMiddle drops a panel rather than halving under the floor", () => {
    // The no-safety-gap path (walls at or under 12ft). A 40⅛in budget at the
    // 40in standard used to give two ~20in panels: ceil(40.125 / 40) is 2.
    // It now gives one 40⅛in panel, because floor(40.125 / 24) is 1.
    const { slots } = tileWall(40.125, 40, CORNER_WIDTH_IN, "end", false, false);
    expect(slots.map((s) => [s.type, s.widthIn])).toEqual([["standard", 40.125]]);
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
