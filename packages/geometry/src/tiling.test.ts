import { describe, expect, it } from "vitest";
import { computeSillRunWidths, getOpeningAnchors, markSafetyCorner, nextPanelCycleState, retileWithOpenings, tileWall } from "./tiling";
import type { PanelSlot } from "./types";

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
