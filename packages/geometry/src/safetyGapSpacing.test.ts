import { describe, expect, it } from "vitest";
import {
  SAFETY_GAP_SPACING_TARGET_IN,
  SAFETY_GAP_SPACING_TOLERANCE_IN,
  applySafetyGapSpacing,
} from "./safetyGapSpacing";
import { TILER_MIN_PANEL_WIDTH_IN, WIDE_SAFETY_GAP_WIDTH_IN, safetyGapWidthForRunIn } from "./tiling";
import { buildRectangleFootprint } from "./footprint";
import { retile, wallGeometryFor } from "./retile";
import type { Footprint, PanelSlot } from "./types";

const corner = (w = 24): PanelSlot => ({ type: "corner", widthIn: w });
const std = (w: number): PanelSlot => ({ type: "standard", widthIn: w });
const locked = (w: number): PanelSlot => ({ type: "standard", widthIn: w, lockedWidthIn: w });
const win = (w: number): PanelSlot => ({ type: "window", widthIn: w });
const gap = (w = WIDE_SAFETY_GAP_WIDTH_IN): PanelSlot => ({ type: "safety-gap", widthIn: w });

const toE = (n: number) => Math.round(n * 8);
const total = (s: readonly PanelSlot[]) => s.reduce((n, x) => n + toE(x.widthIn), 0);
const gaps = (s: readonly PanelSlot[]) => s.filter((x) => x.type === "safety-gap").length;
const shape = (s: readonly PanelSlot[]) => s.map((x) => `${x.type}:${x.widthIn}`).join("|");

/** Distance from the run's start to each gap's near edge, so spacing can be
 * stated in the terms he stated the rule in. */
function gapOffsets(slots: readonly PanelSlot[]): number[] {
  const out: number[] = [];
  let at = 0;
  for (const s of slots) {
    if (s.type === "safety-gap") out.push(at);
    at = Math.round((at + s.widthIn) * 8) / 8;
  }
  return out;
}

/** A run of `count` 40in panels between two corners, gap at the start end —
 * the shape the tiler actually builds, written out so a test can name the
 * joint it expects. */
function run40(count: number, gapAt: "start" | "end"): PanelSlot[] {
  const body = Array.from({ length: count }, () => std(40));
  return gapAt === "start"
    ? [corner(), std(40), gap(), ...body, corner()]
    : [corner(), ...body, gap(), std(40), corner()];
}

describe("the numbers are his, by name", () => {
  it("24ft target, 4ft tolerance", () => {
    // Stated so a change to either shows up as a failing test rather than as
    // walls quietly gaining or losing a joint.
    expect(SAFETY_GAP_SPACING_TARGET_IN).toBe(288);
    expect(SAFETY_GAP_SPACING_TOLERANCE_IN).toBe(48);
  });

  it("⚠ the spacing rule and the 1/2-vs-3/4 width rule are independent", () => {
    /* A run long enough for a second gap is far past the 144in width
       threshold, so every gap the spacing rule adds is a 3/4in one — which is
       what he said. That is a CONSEQUENCE of the two numbers, not a rule, and
       this test is what would catch the two drifting apart. */
    expect(safetyGapWidthForRunIn(SAFETY_GAP_SPACING_TARGET_IN - SAFETY_GAP_SPACING_TOLERANCE_IN)).toBe(
      WIDE_SAFETY_GAP_WIDTH_IN,
    );
  });
});

describe("⚠ his own example, both halves of it", () => {
  it("a 20ft run keeps exactly ONE gap", () => {
    /* Tommy: "If a 20-ft wall is originally spawned with one safety gap".
       240in IS inside the 20-28ft window, so the only thing stopping a second
       gap is that the joint 240in along is the one against the FAR CORNER —
       where a gap would just be the first gap's own position at the other end
       of the wall. */
    const wall = run40(4, "start"); // 24 + 40 + gap + 4x40 + 24 = 248.75in of run
    const out = applySafetyGapSpacing(wall, "start", WIDE_SAFETY_GAP_WIDTH_IN, TILER_MIN_PANEL_WIDTH_IN);
    expect(gaps(out.slots)).toBe(1);
    expect(out.added).toBe(0);
    expect(shape(out.slots)).toBe(shape(wall));
  });

  it("a 40ft run gets a SECOND gap about 24ft from the first", () => {
    /* "...and it is expanded to be a 40-ft wall, the safety gap should retile
       to have a safety gap right next to the corner panel and then another one
       24 ft away." */
    const wall = run40(10, "start");
    const out = applySafetyGapSpacing(wall, "start", WIDE_SAFETY_GAP_WIDTH_IN, TILER_MIN_PANEL_WIDTH_IN);
    expect(out.added).toBe(1);
    expect(gaps(out.slots)).toBe(2);
    const [first, second] = gapOffsets(out.slots);
    const spacing = second! - first!;
    // 40in joints give 240, 280, 320 inside the window; 280 is nearest 24ft.
    expect(spacing).toBe(280);
    expect(Math.abs(spacing - SAFETY_GAP_SPACING_TARGET_IN)).toBeLessThanOrEqual(SAFETY_GAP_SPACING_TOLERANCE_IN);
  });

  it("picks the joint CLOSEST to 24ft, not the first one that qualifies", () => {
    /* "whatever is closer". With 36in panels the joints inside the window are
       252in, 288in and 324in, so 24ft lands EXACTLY — and a rule that stopped
       at the first joint past 20ft would have chosen 252in instead.

       ⚠ 36in, not 24in: a 24in panel is already at the shop minimum and cannot
       give up the gap's 3/4in, so a wall of them produces no eligible joint at
       all. That is the subject of its own test below. */
    const wall = [corner(), std(40), gap(), ...Array.from({ length: 12 }, () => std(36)), corner()];
    const out = applySafetyGapSpacing(wall, "start", WIDE_SAFETY_GAP_WIDTH_IN, TILER_MIN_PANEL_WIDTH_IN);
    const [first, second] = gapOffsets(out.slots);
    expect(out.added).toBe(1);
    expect(second! - first!).toBe(SAFETY_GAP_SPACING_TARGET_IN);
  });

  it("a 60ft run gets three gaps, each spaced from the one before it", () => {
    /* ⚠ The decision is made on PASSING the window, not at the array's end —
       a wall needing two more gaps would otherwise get only one. */
    const out = applySafetyGapSpacing(run40(16, "start"), "start", WIDE_SAFETY_GAP_WIDTH_IN, TILER_MIN_PANEL_WIDTH_IN);
    expect(gaps(out.slots)).toBe(3);
    const offsets = gapOffsets(out.slots);
    for (let i = 1; i < offsets.length; i++) {
      const spacing = offsets[i]! - offsets[i - 1]!;
      expect(spacing).toBeGreaterThanOrEqual(SAFETY_GAP_SPACING_TARGET_IN - SAFETY_GAP_SPACING_TOLERANCE_IN);
      expect(spacing).toBeLessThanOrEqual(SAFETY_GAP_SPACING_TARGET_IN + SAFETY_GAP_SPACING_TOLERANCE_IN);
    }
  });
});

describe("⚠ the run's total width NEVER changes — a gap is carved, not added", () => {
  it("every case conserves, including the ones that refuse", () => {
    for (const wall of [
      run40(4, "start"),
      run40(10, "start"),
      run40(16, "start"),
      run40(10, "end"),
      [corner(), std(40), gap(), ...Array.from({ length: 18 }, () => std(24)), corner()],
      [corner(), std(40), gap(), std(40), win(60), std(40), std(40), std(40), std(40), std(40), corner()],
      [corner(), std(40), gap(), locked(40), locked(40), locked(40), locked(40), locked(40), locked(40), corner()],
      [corner(), std(40), gap(), std(400), corner()],
    ]) {
      const out = applySafetyGapSpacing(wall, "start", WIDE_SAFETY_GAP_WIDTH_IN, TILER_MIN_PANEL_WIDTH_IN);
      expect({ shape: shape(wall), eighths: total(out.slots) }).toEqual({
        shape: shape(wall),
        eighths: total(wall),
      });
    }
  });

  it("the width comes out of the panel at the joint, not out of thin air", () => {
    const out = applySafetyGapSpacing(run40(10, "start"), "start", WIDE_SAFETY_GAP_WIDTH_IN, TILER_MIN_PANEL_WIDTH_IN);
    const idx = out.slots.findIndex((s, i) => s.type === "safety-gap" && i > 3);
    expect(out.slots[idx - 1]!.widthIn).toBe(40 - WIDE_SAFETY_GAP_WIDTH_IN);
  });
});

describe("⚠ running it twice changes nothing — the rule is a fixed point", () => {
  it("is idempotent on every fixture", () => {
    /* This is the property that makes it safe to call on every length change.
       A rule that drifted on re-application would add a joint to a real wall
       each time the user typed a dimension. */
    for (const wall of [run40(4, "start"), run40(10, "start"), run40(16, "start"), run40(10, "end")]) {
      const once = applySafetyGapSpacing(wall, "start", WIDE_SAFETY_GAP_WIDTH_IN, TILER_MIN_PANEL_WIDTH_IN).slots;
      const twice = applySafetyGapSpacing(once, "start", WIDE_SAFETY_GAP_WIDTH_IN, TILER_MIN_PANEL_WIDTH_IN);
      expect(shape(twice.slots)).toBe(shape(once));
      expect(twice.added).toBe(0);
      expect(twice.removed).toBe(0);
    }
  });
});

describe("the gap end the least-accessible-corner rule picked is never moved", () => {
  it("walks from the END when that is where the first gap is", () => {
    const wall = run40(10, "end");
    const out = applySafetyGapSpacing(wall, "end", WIDE_SAFETY_GAP_WIDTH_IN, TILER_MIN_PANEL_WIDTH_IN);
    expect(out.added).toBe(1);
    const offsets = gapOffsets(out.slots);
    // Measured from the END, the first gap is still one 40in panel in.
    const runLengthIn = total(out.slots) / 8;
    expect(runLengthIn - offsets[1]! - WIDE_SAFETY_GAP_WIDTH_IN).toBe(40 + 24);
    expect(offsets[1]! - offsets[0]!).toBe(280);
  });

  it("a run with no gap at all is left alone — the FIRST gap is the tiler's job", () => {
    const wall = [corner(), ...Array.from({ length: 10 }, () => std(40)), corner()];
    const out = applySafetyGapSpacing(wall, "start", WIDE_SAFETY_GAP_WIDTH_IN, TILER_MIN_PANEL_WIDTH_IN);
    expect(shape(out.slots)).toBe(shape(wall));
    expect(out.added).toBe(0);
  });
});

describe("what a gap may never be carved out of", () => {
  it("never out of an opening", () => {
    // The joint beside a window is fine; the window's own width is not.
    const wall = [corner(), std(40), gap(), std(40), std(40), std(40), std(40), std(40), win(72), std(40), corner()];
    const out = applySafetyGapSpacing(wall, "start", WIDE_SAFETY_GAP_WIDTH_IN, TILER_MIN_PANEL_WIDTH_IN);
    expect(out.slots.find((s) => s.type === "window")!.widthIn).toBe(72);
    expect(total(out.slots)).toBe(total(wall));
  });

  it("never out of a hand-set width, and says so when that leaves a long stretch", () => {
    /* ⚠ Twelve locked panels, not seven. A stretch is only a problem once it
       passes 28ft — his +4ft bound — so seven 40in panels (304in to the far
       corner) is a perfectly acceptable single-gap wall and reports nothing.
       My first version of this test asserted a refusal on that wall and was
       simply wrong about the rule. */
    const wall = [corner(), std(40), gap(), ...Array.from({ length: 12 }, () => locked(40)), corner()];
    const out = applySafetyGapSpacing(wall, "start", WIDE_SAFETY_GAP_WIDTH_IN, TILER_MIN_PANEL_WIDTH_IN);
    expect(out.slots.every((s) => s.lockedWidthIn === undefined || s.widthIn === 40)).toBe(true);
    expect(out.added).toBe(0);
    expect(out.refusals.length).toBeGreaterThan(0);
    expect(total(out.slots)).toBe(total(wall));
  });

  it("a stretch of 28ft or less needs no gap at all, so nothing is reported", () => {
    // Seven 40in panels plus the far corner is 304in — inside the window, so
    // the wall is already correct with one gap and must stay silent.
    const wall = [corner(), std(40), gap(), ...Array.from({ length: 7 }, () => locked(40)), corner()];
    const out = applySafetyGapSpacing(wall, "start", WIDE_SAFETY_GAP_WIDTH_IN, TILER_MIN_PANEL_WIDTH_IN);
    expect({ added: out.added, removed: out.removed, refusals: out.refusals }).toEqual({
      added: 0,
      removed: 0,
      refusals: [],
    });
  });

  it("never out of a panel that would drop under the shop minimum", () => {
    const wall = [corner(), std(40), gap(), ...Array.from({ length: 12 }, () => std(TILER_MIN_PANEL_WIDTH_IN)), corner()];
    const out = applySafetyGapSpacing(wall, "start", WIDE_SAFETY_GAP_WIDTH_IN, TILER_MIN_PANEL_WIDTH_IN);
    // Every candidate panel is exactly 24in, so none can give up 3/4in.
    expect(out.added).toBe(0);
    // Framing only — the gap's own 3/4in is not a panel and is not a breach.
    const framing = out.slots.filter((s) => s.type === "standard" || s.type === "braced");
    expect(framing.filter((s) => s.widthIn < TILER_MIN_PANEL_WIDTH_IN)).toHaveLength(0);
  });

  it("⚠ REFUSES and reports rather than splitting one enormous hand-placed panel", () => {
    /* A 400in panel has no joint inside the window at all. Splitting it would
       be the app overruling a width the user chose, which he has consistently
       said it must not do — refuse and say so. */
    const wall = [corner(), std(40), gap(), std(400), corner()];
    const out = applySafetyGapSpacing(wall, "start", WIDE_SAFETY_GAP_WIDTH_IN, TILER_MIN_PANEL_WIDTH_IN);
    expect(out.added).toBe(0);
    expect(out.refusals).toHaveLength(1);
    expect(out.refusals[0]!.nearestJointOffsetIn).toBeNull();
    expect(total(out.slots)).toBe(total(wall));
  });
});

describe("a wall that shrinks gives its stranded gaps back", () => {
  it("drops a second gap that is no longer anywhere near 24ft away", () => {
    // What a 60ft wall cut back to 25ft would be left holding.
    const wall = [corner(), std(40), gap(), std(40), gap(), std(40), std(40), corner()];
    const out = applySafetyGapSpacing(wall, "start", WIDE_SAFETY_GAP_WIDTH_IN, TILER_MIN_PANEL_WIDTH_IN);
    expect(gaps(out.slots)).toBe(1);
    expect(out.removed).toBe(1);
    expect(total(out.slots)).toBe(total(wall));
  });

  it("keeps a second gap that IS roughly 24ft away, rather than rebuilding it", () => {
    const once = applySafetyGapSpacing(run40(10, "start"), "start", WIDE_SAFETY_GAP_WIDTH_IN, TILER_MIN_PANEL_WIDTH_IN).slots;
    const again = applySafetyGapSpacing(once, "start", WIDE_SAFETY_GAP_WIDTH_IN, TILER_MIN_PANEL_WIDTH_IN);
    expect(again.removed).toBe(0);
    expect(again.added).toBe(0);
  });
});

describe("on walls the tiler really builds", () => {
  const THICKNESS_IN = 15.5;
  const SEED = { spacingIn: 100_000, defaultPattern: "chevron" as const, defaultMirrored: false };
  const allPrimary = (fp: Footprint) => new Set(fp.corners.map((c) => c.id));

  const tiledWall = (widthFt: number, depthFt: number, wallId: string) => {
    const fp = buildRectangleFootprint(widthFt, depthFt);
    const slots = retile(fp, "A", allPrimary(fp), 40, 24, THICKNESS_IN, SEED)[wallId]!;
    const geom = wallGeometryFor(fp, wallId, allPrimary(fp), "A", THICKNESS_IN)!;
    return { slots, geom };
  };

  it("a 20ft wall as the tiler builds it keeps one gap", () => {
    const { slots, geom } = tiledWall(20, 20, "AB");
    const out = applySafetyGapSpacing(slots, geom.gapEnd, safetyGapWidthForRunIn(geom.lengthIn), TILER_MIN_PANEL_WIDTH_IN);
    expect(gaps(out.slots)).toBe(1);
    expect(total(out.slots)).toBe(toE(geom.lengthIn));
  });

  it("⚠ a 40ft wall comes OUT OF THE TILER with two gaps — the rule is wired in", () => {
    /* This test previously asserted `gaps(slots) === 1` with the comment "what
       the tiler ships today", and it went red the moment the rule was wired
       into `retile`. That was the one and only failure in 2968 tests, and it
       is kept pointing the other way round so the wiring itself is pinned: if
       someone removes the call from `retile`'s loop, this fails rather than
       the feature silently reverting to "one gap per wall".

       The second assertion is the idempotence the rule relies on — applying it
       again to an already-spaced wall adds nothing. */
    const { slots, geom } = tiledWall(40, 20, "AB");
    expect(gaps(slots)).toBe(2);
    const out = applySafetyGapSpacing(slots, geom.gapEnd, safetyGapWidthForRunIn(geom.lengthIn), TILER_MIN_PANEL_WIDTH_IN);
    expect({ added: out.added, removed: out.removed }).toEqual({ added: 0, removed: 0 });
    expect(gaps(out.slots)).toBe(2);
    expect(total(out.slots)).toBe(toE(geom.lengthIn));
  });

  it("an 80ft wall ends up with FOUR gaps, spaced 280/280/271in", () => {
    /* Measured, and recorded as the real numbers rather than a round guess:
       960in of run, gaps at 64, 344, 624 and 895.25in from the start. Every
       spacing is inside his 20-28ft window, and the two outermost gaps both
       land one panel in from their corner — the same position the first gap
       has always had, arrived at by the spacing rule rather than by being
       told. ⚠ I expected three here and was wrong: 960/288 is 3.3 intervals,
       which is four gaps, not three. */
    const { slots, geom } = tiledWall(80, 20, "AB");
    const out = applySafetyGapSpacing(slots, geom.gapEnd, safetyGapWidthForRunIn(geom.lengthIn), TILER_MIN_PANEL_WIDTH_IN);
    expect(gaps(out.slots)).toBe(4);
    expect(gapOffsets(out.slots)).toEqual([64, 344, 624, 895.25]);
    expect(total(out.slots)).toBe(toE(geom.lengthIn));
    for (const s of out.slots) {
      if (s.type !== "standard" && s.type !== "braced") continue;
      expect(s.widthIn).toBeGreaterThanOrEqual(TILER_MIN_PANEL_WIDTH_IN);
    }
  });
});
