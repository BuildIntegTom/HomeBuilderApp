import { describe, expect, it } from "vitest";
import { tidyUnbuildableLeftovers } from "./tidyLeftovers";
import { TILER_MAX_PANEL_WIDTH_IN, TILER_MIN_PANEL_WIDTH_IN } from "./tiling";
import type { PanelSlot } from "./types";

const corner = (w = 25.5): PanelSlot => ({ type: "corner", widthIn: w });
const std = (w: number): PanelSlot => ({ type: "standard", widthIn: w });
const locked = (w: number): PanelSlot => ({ type: "standard", widthIn: w, lockedWidthIn: w });
const gap = (): PanelSlot => ({ type: "safety-gap", widthIn: 0.75 });
const win = (w: number): PanelSlot => ({ type: "window", widthIn: w });

const shape = (s: readonly PanelSlot[]) => s.map((x) => `${x.type}:${x.widthIn}`).join("|");
const total = (s: readonly PanelSlot[]) => s.reduce((n, x) => n + Math.round(x.widthIn * 8), 0);

describe("⚠ a LEGAL wall is never touched — the whole point of tile-once", () => {
  it("leaves every panel alone when all of them are buildable", () => {
    /* Tommy, 2026-10-17: the tidy runs on release and ONLY if a panel is
       unbuildable. A pass that normalised every release would be the tiler
       running behind his back again, just later. */
    const wall = [corner(), std(40), std(31.5), std(24), corner()];
    const out = tidyUnbuildableLeftovers(wall);
    expect(shape(out.slots)).toBe(shape(wall));
    expect(out.changedParts).toBe(0);
  });

  it("exactly the minimum is legal — 24in is buildable, not a leftover", () => {
    const wall = [corner(), std(40), std(TILER_MIN_PANEL_WIDTH_IN), corner()];
    expect(tidyUnbuildableLeftovers(wall).changedParts).toBe(0);
  });

  it("an eighth under the minimum is not", () => {
    const wall = [corner(), std(40), std(TILER_MIN_PANEL_WIDTH_IN - 0.125), corner()];
    expect(tidyUnbuildableLeftovers(wall).changedParts).toBe(1);
  });
});

describe("absorb or split, per his 2026-10-01 answer", () => {
  it("absorbs when the combined width still fits one panel", () => {
    // 8 + 32 = 40 ≤ 48, so one 40in panel.
    const wall = [corner(), std(32), std(8), corner()];
    const out = tidyUnbuildableLeftovers(wall);
    expect(shape(out.slots)).toBe("corner:25.5|standard:40|corner:25.5");
    expect(out.changedParts).toBe(1);
  });

  it("⚠ SPLITS when absorbing would build past 4ft — his own threshold, by name", () => {
    // 8 + 46 = 54 > 48, so two panels of 27 each.
    const wall = [corner(), std(46), std(8), corner()];
    const out = tidyUnbuildableLeftovers(wall);
    expect(shape(out.slots)).toBe("corner:25.5|standard:27|standard:27|corner:25.5");
  });

  it("an odd eighth is given to the neighbour, never dropped", () => {
    // 8 + 45.125 = 53.125in = 425 eighths; halves are 212 and 213.
    const wall = [corner(), std(45.125), std(8), corner()];
    const out = tidyUnbuildableLeftovers(wall);
    expect(total(out.slots)).toBe(total(wall));
    const widths = out.slots.filter((s) => s.type === "standard").map((s) => s.widthIn);
    expect(Math.abs(widths[0]! - widths[1]!)).toBe(0.125);
  });

  it("⚠ every split result is itself buildable, which only works because max = 2 × min", () => {
    /* Absorbing is legal iff combined ≤ 48; splitting iff combined ≥ 48. They
       overlap at exactly 48, so every combined width has a legal answer — and
       only because the maximum is exactly twice the minimum. Swept rather than
       spot-checked, because the coupling is the thing being relied on. */
    expect(TILER_MAX_PANEL_WIDTH_IN).toBe(2 * TILER_MIN_PANEL_WIDTH_IN);
    for (let leftoverE = 1; leftoverE < toE(TILER_MIN_PANEL_WIDTH_IN); leftoverE++) {
      for (let neighbourE = toE(TILER_MIN_PANEL_WIDTH_IN); neighbourE <= toE(TILER_MAX_PANEL_WIDTH_IN); neighbourE++) {
        const wall = [corner(), std(neighbourE / 8), std(leftoverE / 8), corner()];
        const out = tidyUnbuildableLeftovers(wall);
        expect(total(out.slots)).toBe(total(wall));
        for (const s of out.slots) {
          if (s.type !== "standard") continue;
          expect(Math.round(s.widthIn * 8)).toBeGreaterThanOrEqual(toE(TILER_MIN_PANEL_WIDTH_IN));
          expect(Math.round(s.widthIn * 8)).toBeLessThanOrEqual(toE(TILER_MAX_PANEL_WIDTH_IN));
        }
      }
    }
  });
});

function toE(inches: number): number {
  return Math.round(inches * 8);
}

describe("⚠ a hand-set width is never overruled", () => {
  it("a LOCKED leftover is reported, not absorbed", () => {
    // He set it. The Review Log is where that gets reported, not here.
    const wall = [corner(), std(40), locked(6), corner()];
    const out = tidyUnbuildableLeftovers(wall);
    expect(shape(out.slots)).toBe(shape(wall));
    expect(out.changedParts).toBe(0);
    expect(out.unresolvedIndexes).toEqual([2]);
  });

  it("a leftover beside a LOCKED neighbour absorbs the other way instead", () => {
    // Prefers an automatic neighbour over overruling a hand-set one.
    const wall = [corner(), std(36), std(8), locked(40), corner()];
    const out = tidyUnbuildableLeftovers(wall);
    expect(out.slots.some((s) => s.lockedWidthIn === 40 && s.widthIn === 40)).toBe(true);
    expect(shape(out.slots)).toBe("corner:25.5|standard:44|standard:40|corner:25.5");
  });

  it("a leftover with ONLY locked neighbours is refused and reported", () => {
    const wall = [corner(), locked(40), std(8), locked(40), corner()];
    const out = tidyUnbuildableLeftovers(wall);
    expect(shape(out.slots)).toBe(shape(wall));
    expect(out.unresolvedIndexes).toEqual([2]);
  });
});

describe("what a tidy may never swallow", () => {
  it("an OPENING is never merged away", () => {
    // Merging a window into its neighbour would delete an opening the user
    // placed — no tidy may do that, however small the window has become.
    const wall = [corner(), std(40), win(8), corner()];
    const out = tidyUnbuildableLeftovers(wall);
    expect(out.slots.some((s) => s.type === "window")).toBe(true);
    expect(out.changedParts).toBe(0);
  });

  it("a leftover never absorbs INTO an opening", () => {
    const wall = [corner(), win(36), std(8), corner()];
    const out = tidyUnbuildableLeftovers(wall);
    expect(out.slots.find((s) => s.type === "window")!.widthIn).toBe(36);
    expect(out.unresolvedIndexes).toEqual([2]);
  });

  it("the corner panel and the safety gap are never touched", () => {
    const wall = [corner(), gap(), std(8), std(40), corner()];
    const out = tidyUnbuildableLeftovers(wall);
    expect(out.slots.find((s) => s.type === "safety-gap")!.widthIn).toBe(0.75);
    expect(out.slots.filter((s) => s.type === "corner").every((s) => s.widthIn === 25.5)).toBe(true);
  });

  it("a wall with nothing to absorb into reports rather than refusing to return", () => {
    const wall = [corner(), std(8), corner()];
    const out = tidyUnbuildableLeftovers(wall);
    expect(out.slots).toHaveLength(3);
    expect(out.unresolvedIndexes).toEqual([1]);
  });
});

describe("conservation", () => {
  it("⚠ the wall's total width NEVER changes — a tidy moves width, it does not create it", () => {
    for (const wall of [
      [corner(), std(40), std(8), corner()],
      [corner(), std(46), std(3.5), corner()],
      [corner(), std(40), std(0.125), std(40), corner()],
      [corner(), gap(), std(2), std(44), corner()],
      [corner(), locked(30), std(5), std(40), corner()],
    ]) {
      expect(total(tidyUnbuildableLeftovers(wall).slots)).toBe(total(wall));
    }
  });
});
