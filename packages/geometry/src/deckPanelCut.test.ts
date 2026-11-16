import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { buildOctagonFootprint } from "./octagon";
import {
  clipDeckPanelsToFootprint,
  deckRunSplitPointsIn,
  deckSpanRangeFtAt,
  planDeckRunWidths,
} from "./deckPanelCut";

/**
 * ⚠ **A DECK CUT TO THE BUILDING IT SITS ON.**
 *
 * > *"can we have the roof be basically cut to fit the raised octagon gable
 * > perimeter?"* — Tommy, 2026-11-15, choosing mitred ends over a stepped
 * > edge or a volunteer overhang, and asking for the floor to match.
 *
 * The numbers this file pins were measured on the live
 * `deckPanelPlacements` before any of it was written: on an octagon the deck
 * is the bounding SQUARE, **20.7%** bigger than the building, with each of
 * the four corners hanging out a right triangle 4.69ft on a side.
 */

const MIN_W = 12;
const MAX_W = 48;

describe("⚠ a rectangle is cut exactly as it is today", () => {
  /* The safety property. A deck over a box is already right, and nothing
     here may change it — every panel full-span, square at both ends. */
  it("every panel spans the whole depth, square-cut, on a 24 x 16", () => {
    const fp = buildRectangleFootprint(24, 16);
    const cuts = clipDeckPanelsToFootprint(fp, [48, 48, 48, 48, 48, 48]);
    expect(cuts).toHaveLength(6);
    for (const c of cuts) {
      expect(c.nearStartIn).toBeCloseTo(0, 6);
      expect(c.farStartIn).toBeCloseTo(0, 6);
      expect(c.nearEndIn).toBeCloseTo(16 * 12, 6);
      expect(c.farEndIn).toBeCloseTo(16 * 12, 6);
      expect(c.maxLengthIn).toBeCloseTo(16 * 12, 6);
      expect(c.isMitred, "a box has no mitred deck panel").toBe(false);
    }
  });

  it("and it has no corners to split at", () => {
    expect(deckRunSplitPointsIn(buildRectangleFootprint(24, 16))).toEqual([]);
  });
});

describe("⚠ an octagon — the cut he asked for", () => {
  const fp = buildOctagonFootprint(16, 16);
  /* ⚠ **Read off the real footprint, not from the ideal octagon formula.**
     This app builds its octagon on the EIGHTH-INCH grid, so a 16ft tile's
     facet is 6.625ft where the exact 16/(1+sqrt2) is 6.6274ft. Deriving the
     expected numbers from the ideal shape made four of these tests fail
     against correct code — the difference is only 0.03in, which is exactly
     the kind of gap that reads as a bug when it is a rounding convention. */
  const facetFt = fp.walls.find((w) => Math.abs(w.lengthFt - 16 / (1 + Math.SQRT2)) < 0.1)!.lengthFt;
  const legFt = (16 - facetFt) / 2;

  it("the building's width across the span, sampled along the run", () => {
    /* At the very start of the run the octagon is only its flat facet wide;
       in the middle it is the full 16ft. */
    expect(deckSpanRangeFtAt(fp, 0)!.endFt - deckSpanRangeFtAt(fp, 0)!.startFt).toBeCloseTo(16 - 2 * legFt, 4);
    expect(deckSpanRangeFtAt(fp, 8)!.endFt - deckSpanRangeFtAt(fp, 8)!.startFt).toBeCloseTo(16, 4);
    expect(deckSpanRangeFtAt(fp, 16)!.endFt - deckSpanRangeFtAt(fp, 16)!.startFt).toBeCloseTo(16 - 2 * legFt, 4);
    /* ⚠ And it really does TAPER in between, which is the whole point —
       halfway up the corner triangle the building is half a leg narrower at
       each side. */
    const mid = deckSpanRangeFtAt(fp, legFt / 2)!;
    expect(mid.endFt - mid.startFt).toBeCloseTo(16 - legFt, 4);
  });

  it("⚠ the run splits at the four corners that face the run", () => {
    /* Two interior split points: where the corner triangles stop and the
       building goes square. 4.686ft and 11.314ft, in inches. */
    const splits = deckRunSplitPointsIn(fp);
    expect(splits).toHaveLength(2);
    expect(splits[0]!).toBeCloseTo(legFt * 12, 3);
    expect(splits[1]!).toBeCloseTo((16 - legFt) * 12, 3);
  });

  it("⚠ panels in the corner region are MITRED, panels in the middle are square", () => {
    /* Split the run at the corners first, which is what makes every panel a
       trapezoid rather than a five-sided part. */
    const widths = planDeckRunWidths(192, deckRunSplitPointsIn(fp), MIN_W, MAX_W);
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(192, 6);
    const cuts = clipDeckPanelsToFootprint(fp, widths);

    /* The first panel sits entirely on the leading corner triangles: it is
       narrow at its near edge and wider at its far edge. */
    const first = cuts[0]!;
    expect(first.isMitred, "the first panel should be mitred").toBe(true);
    expect(first.nearEndIn - first.nearStartIn).toBeLessThan(first.farEndIn - first.farStartIn);

    /* The last panel mirrors it. */
    const last = cuts[cuts.length - 1]!;
    expect(last.isMitred, "the last panel should be mitred").toBe(true);
    expect(last.farEndIn - last.farStartIn).toBeLessThan(last.nearEndIn - last.nearStartIn);

    /* ⚠ A panel wholly inside the square middle is NOT mitred — the cut is
       only where the building actually turns. */
    const middle = cuts.filter((c) => c.atIn >= legFt * 12 - 1e-6 && c.atIn + c.widthIn <= (16 - legFt) * 12 + 1e-6);
    expect(middle.length).toBeGreaterThan(0);
    for (const c of middle) {
      expect(c.isMitred, `panel at ${c.atIn}in should be square-cut`).toBe(false);
      expect(c.maxLengthIn).toBeCloseTo(192, 4);
    }
  });

  it("⚠ the cut deck is the octagon's own area, not the bounding square", () => {
    const widths = planDeckRunWidths(192, deckRunSplitPointsIn(fp), MIN_W, MAX_W);
    const cuts = clipDeckPanelsToFootprint(fp, widths);
    /* Each panel is a trapezoid: mean of its two end lengths times width. */
    const areaSqFt = cuts.reduce((a, c) => {
      const nearIn = c.nearEndIn - c.nearStartIn;
      const farIn = c.farEndIn - c.farStartIn;
      return a + ((nearIn + farIn) / 2 / 12) * (c.widthIn / 12);
    }, 0);
    /* The octagon itself: 256 sq ft of box less four 4.686ft right triangles. */
    const octSqFt = 256 - 4 * (legFt * legFt) / 2;
    expect(octSqFt).toBeCloseTo(212.08, 1);
    expect(areaSqFt, "the cut deck should be the building, not its bounding box").toBeCloseTo(octSqFt, 1);
    /* ⚠ Measured before this existed: the uncut deck was 256 sq ft, 20.7%
       over. That is what this removes. */
    expect(256 - areaSqFt).toBeCloseTo(43.9, 1);
  });

  it("the 32ft octagon behaves the same, at twice the size", () => {
    const big = buildOctagonFootprint(32, 32);
    const widths = planDeckRunWidths(384, deckRunSplitPointsIn(big), MIN_W, MAX_W);
    const cuts = clipDeckPanelsToFootprint(big, widths);
    const areaSqFt = cuts.reduce((a, c) => {
      const nearIn = c.nearEndIn - c.nearStartIn;
      const farIn = c.farEndIn - c.farStartIn;
      return a + ((nearIn + farIn) / 2 / 12) * (c.widthIn / 12);
    }, 0);
    const bigFacetFt = big.walls.find((w) => Math.abs(w.lengthFt - 32 / (1 + Math.SQRT2)) < 0.2)!.lengthFt;
    const bigLegFt = (32 - bigFacetFt) / 2;
    expect(areaSqFt).toBeCloseTo(1024 - 4 * (bigLegFt * bigLegFt) / 2, 1);
    expect(cuts.some((c) => c.isMitred)).toBe(true);
  });
});

describe("⚠ planning the run at the corners", () => {
  it("every panel is inside the shop's own width range", () => {
    for (const total of [192, 384, 240]) {
      for (const splits of [[56.25, 135.75], [], [9.375], [100]]) {
        const widths = planDeckRunWidths(total, splits, MIN_W, MAX_W);
        expect(widths.reduce((a, b) => a + b, 0), `total ${total}, splits ${splits.join("/")}`).toBeCloseTo(total, 6);
        for (const w of widths) {
          expect(w, `total ${total}, splits ${splits.join("/")}`).toBeLessThanOrEqual(MAX_W + 1e-9);
          expect(w).toBeGreaterThan(0);
        }
      }
    }
  });

  it("⚠ every corner lands ON a joint, which is what makes a trapezoid possible", () => {
    const splits = [56.25, 135.75];
    const widths = planDeckRunWidths(192, splits, MIN_W, MAX_W);
    const bounds: number[] = [0];
    for (const w of widths) bounds.push(bounds[bounds.length - 1]! + w);
    for (const s of splits) {
      expect(bounds.some((b) => Math.abs(b - s) < 1e-6), `corner at ${s}in is not a joint`).toBe(true);
    }
    /* The 16ft Octagon, in full: two 28.125s, two 39.75s, two 28.125s. */
    expect(widths.map((w) => Number(w.toFixed(3)))).toEqual([28.125, 28.125, 39.75, 39.75, 28.125, 28.125]);
  });

  it("a sliver segment is folded into its neighbour rather than built", () => {
    /* A corner 4in from the start cannot be its own panel. */
    const widths = planDeckRunWidths(192, [4], MIN_W, MAX_W);
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(192, 6);
    for (const w of widths) expect(w).toBeGreaterThanOrEqual(MIN_W);
  });

  it("no corners at all gives the plain even run", () => {
    expect(planDeckRunWidths(192, [], MIN_W, MAX_W)).toEqual([48, 48, 48, 48]);
  });
});
