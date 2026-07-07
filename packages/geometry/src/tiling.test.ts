import { describe, expect, it } from "vitest";
import { getOpeningAnchors, markSafetyCorner, retileWithOpenings, tileWall, toggleOpening } from "./tiling";
import type { PanelSlot } from "./types";

describe("tileWall", () => {
  it("uses the leftover space exactly as the gap panel's width when it's between 2ft and 4ft, gap second-to-last", () => {
    // middle = 350-40(corners) = 310; 310/40 = 7 standards, remainder 30 (2ft-4ft) -> gap = 30 exactly
    // gapEnd='end': 6 plain standards, then gap, then the corner-touching standard, then corner
    const result = tileWall(350, 40, 20, "end");
    expect(result.slots.map((s) => s.type)).toEqual([
      "corner",
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
    expect(result.slots.map((s) => s.widthIn)).toEqual([20, 40, 40, 40, 40, 40, 40, 30, 40, 20]);
  });

  it("borrows one standard panel and splits 50/50 with the gap when leftover is under 2ft (gapEnd 'end')", () => {
    // middle = 330-40 = 290; 290/40 = 7 standards, remainder 10 (<2ft)
    // combined = 10 + 40 = 50, split 25/25 between the gap and the borrowed
    // standard next to it — never the corner-touching standard, which stays
    // full width since rule 1 in applyBracedPlacement always braces it.
    const result = tileWall(330, 40, 20, "end");
    const widths = result.slots.map((s) => s.widthIn);
    expect(widths).toEqual([20, 40, 40, 40, 40, 40, 25, 25, 40, 20]);
    expect(result.slots.map((s) => s.type)).toEqual([
      "corner",
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
    // total unchanged — no slack introduced by the split
    expect(widths.reduce((a, b) => a + b, 0)).toBe(330);
  });

  it("mirrors the order when gapEnd is 'start': full-width corner-touching standard, then gap, then the borrowed standard, then the plain run", () => {
    const result = tileWall(330, 40, 20, "start");
    const widths = result.slots.map((s) => s.widthIn);
    expect(widths).toEqual([20, 40, 25, 25, 40, 40, 40, 40, 40, 20]);
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

  it("still skips the gap panel under 12ft when more than 1 standard's worth fits", () => {
    // wallLengthIn=90 <= 144; middle=50, round(50/40)=1 -> 1 evenly-sized standard
    const result = tileWall(90, 40, 20, "end");
    expect(result.slots.map((s) => s.type)).toEqual(["corner", "standard", "corner"]);
    expect(result.slots[1]!.widthIn).toBe(50);
  });

  it("splits evenly into multiple standards under 12ft when the budget calls for more than one", () => {
    // wallLengthIn=110 <= 144; middle=70, round(70/40)=2 -> 2 evenly-sized standards (35 each)
    const result = tileWall(110, 40, 20, "end");
    expect(result.slots.map((s) => s.type)).toEqual(["corner", "standard", "standard", "corner"]);
    expect(result.slots.map((s) => s.widthIn)).toEqual([20, 35, 35, 20]);
  });

  it("degrades gracefully when there's nothing to borrow a standard panel from (0 fit), on a wall over 12ft", () => {
    // wallLengthIn=150 > 144, so the gap panel still applies. cornerWidthIn=70
    // each -> middle=10, no standard panels fit at all — gap absorbs everything
    const result = tileWall(150, 40, 70, "end");
    expect(result.slots.map((s) => s.type)).toEqual(["corner", "safety-gap", "corner"]);
    expect(result.slots[1]!.widthIn).toBe(10);
  });

  it("degrades gracefully when only 1 standard panel would fit and the leftover is under 2ft, on a wall over 12ft", () => {
    // wallLengthIn=150 > 144, cornerWidthIn=55 each -> middle=40, exactly 1
    // standard fits with 0 remainder (<2ft) — too little to borrow from, gap
    // takes the whole 40
    const result = tileWall(150, 40, 55, "end");
    expect(result.slots.map((s) => s.type)).toEqual(["corner", "safety-gap", "corner"]);
    expect(result.slots[1]!.widthIn).toBe(40);
  });

  it("keeps the gap second-to-last even with exactly 1 standard panel and a clean remainder, on a wall over 12ft", () => {
    // wallLengthIn=150 > 144, cornerWidthIn=40 each -> middle=70; 1 standard
    // fits (40) with remainder 30 (2ft-4ft) — no plain standards left over,
    // but the single standard still becomes the corner-touching one, gap
    // still sits before it
    const result = tileWall(150, 40, 40, "end");
    expect(result.slots.map((s) => s.type)).toEqual(["corner", "safety-gap", "standard", "corner"]);
    expect(result.slots.map((s) => s.widthIn)).toEqual([40, 30, 40, 40]);
  });

  it("omits corner slots entirely when hasCorners is false (butting wall), same split logic applies", () => {
    // middle = 300 (no corners reserved); 300/40 = 7 standards, remainder 20 (<2ft)
    // combined = 20 + 40 = 60, split 30/30 — borrowed standard next to the
    // gap, corner-touching standard (still present even with hasCorners
    // false — it's what rule 1 braces at the butting end) stays full width.
    const result = tileWall(300, 40, 20, "end", false, false);
    const widths = result.slots.map((s) => s.widthIn);
    expect(widths).toEqual([40, 40, 40, 40, 40, 30, 30, 40]);
    expect(widths.reduce((a, b) => a + b, 0)).toBe(300);
    expect(result.slots.map((s) => s.type)).toEqual([
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

  it("skips the borrow entirely when allowBorrow is false — gap just absorbs the leftover, even under 2ft", () => {
    // same 330 wall as the borrow test above, but allowBorrow=false (octagon
    // walls): remainder 10 stays as a 10in gap panel, all 7 standards stay
    // full width — no standard-safety (resized) panel at all.
    const result = tileWall(330, 40, 20, "end", true, true, false);
    const widths = result.slots.map((s) => s.widthIn);
    expect(widths).toEqual([20, 40, 40, 40, 40, 40, 40, 10, 40, 20]);
    expect(widths.reduce((a, b) => a + b, 0)).toBe(330);
    expect(result.slots.map((s) => s.type)).toEqual([
      "corner",
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
});

describe("toggleOpening", () => {
  it("cycles standard -> window -> door -> standard", () => {
    const slots = [{ type: "standard" as const, widthIn: 40 }];
    const afterOne = toggleOpening(slots, 0);
    expect(afterOne[0]!.type).toBe("window");
    const afterTwo = toggleOpening(afterOne, 0);
    expect(afterTwo[0]!.type).toBe("door");
    const afterThree = toggleOpening(afterTwo, 0);
    expect(afterThree[0]!.type).toBe("standard");
  });

  it("leaves corner and safety-gap slots untouched", () => {
    const slots = [
      { type: "corner" as const, widthIn: 24 },
      { type: "safety-gap" as const, widthIn: 39.25 },
    ];
    expect(toggleOpening(slots, 0)[0]!.type).toBe("corner");
    expect(toggleOpening(slots, 1)[1]!.type).toBe("safety-gap");
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
});

describe("retileWithOpenings", () => {
  it("matches tileWall exactly when there are no openings", () => {
    const withOpenings = retileWithOpenings(350, 40, 20, "end", true, true, []);
    const plain = tileWall(350, 40, 20, "end");
    expect(withOpenings.slots).toEqual(plain.slots);
  });

  it("reserves the opening's width and re-derives standard count + gap sizing around it (no protrusion)", () => {
    // middle = 430-40(corners) = 390; reserve a 100in window -> budget 290
    // 290/40 = 7 standards, remainder 10 (<2ft) -> borrow+split: combined=50, 25/25
    // window anchored after 2 standard slots
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
      "safety-gap",
      "standard",
      "corner",
    ]);
    expect(widths).toEqual([20, 40, 40, 100, 40, 40, 40, 25, 25, 40, 20]);
    // total unchanged — the whole point is no protrusion past the fixed wall length
    expect(widths.reduce((a, b) => a + b, 0)).toBe(430);
  });

  it("growing the same window further re-derives again, staying anchored and still fitting exactly", () => {
    // same wall, window grown to 140in -> budget 250; 250/40 = 6 standards, remainder 10 (<2ft)
    // -> borrow+split: combined=50, 25/25
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
      "safety-gap",
      "standard",
      "corner",
    ]);
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
