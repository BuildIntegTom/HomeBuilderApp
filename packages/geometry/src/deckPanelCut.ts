import type { Footprint, Point } from "./types";
import { footprintSpanAndRun } from "./joistLayout";

/* ──────────────────────────────────────────────────────────────────────────
   CUTTING A DECK TO THE BUILDING IT SITS ON

   > *"can we have the roof be basically cut to fit the raised octagon gable
   > perimeter?"* — Tommy, 2026-11-15, choosing mitred ends over a stepped
   > edge or a volunteer overhang, and asking for the floor to match.

   `deckPanelPlacements` lays every panel across the footprint's BOUNDING
   BOX, so each one is full-span. On a rectangle that is the building. On an
   octagon it is a square: measured, the deck claims **20.7%** more than the
   building — 43.9 sq ft on the 16ft tile and 175.7 sq ft on the 32ft — with
   each of the four corners hanging out a right triangle **4.69ft on a side**
   (9.37ft on the 32ft tile).

   ⚠ **What makes this more than a number change is the CUT.** A panel
   crossing a 45-degree facet has to be mitred, and because a panel has
   width, that mitre is a sloped cut ACROSS the panel — the part stops being
   a rectangle and becomes a trapezoid.

   ⚠ **And a trapezoid is only possible if no corner of the building falls
   inside a panel.** A panel straddling the point where a facet meets a flat
   wall would need a five-sided end. So the run is split at every corner
   first (`deckRunSplitPointsIn`), exactly the way the gable row is split at
   the wall joints below it, and then every panel is a clean trapezoid with
   at most one sloped cut at each end.
   ────────────────────────────────────────────────────────────────────────── */

/** Which plan axis the panels repeat along. The other one is the span. */
export function deckRunAxis(footprint: Footprint): "x" | "y" {
  /* `footprintSpanAndRun` names the axis a MEMBER spans; the run is the
     other one. Taken from there rather than from the bounding box directly,
     so a deck and its joists can never be drawn at right angles. */
  return footprintSpanAndRun(footprint).axis === "y" ? "x" : "y";
}

/**
 * How far the building reaches across the span, at one position along the
 * run — both in feet, measured in plan, or `null` where the building has no
 * width at all there (exactly at a pointed corner).
 *
 * ⚠ **It is the OUTER extent, min to max, and on a ring that bridges the
 * courtyard.** Which is what the bounding-box version already did, so no
 * courtyard plan changes behaviour here; a ring's real roof is R5's job and
 * does not come through this function.
 */
export function deckSpanRangeFtAt(footprint: Footprint, runAtFt: number): { startFt: number; endFt: number } | null {
  const runAxis = deckRunAxis(footprint);
  const at = (p: Point) => (runAxis === "x" ? p.x : p.y);
  const across = (p: Point) => (runAxis === "x" ? p.y : p.x);
  const byId = new Map(footprint.corners.map((c) => [c.id, c.point]));

  let lo = Infinity;
  let hi = -Infinity;
  for (const wall of footprint.walls) {
    const a = byId.get(wall.startCorner);
    const b = byId.get(wall.endCorner);
    if (!a || !b) continue;
    const aAt = at(a);
    const bAt = at(b);
    if (Math.abs(bAt - aAt) < 1e-9) {
      /* An edge running exactly across the span contributes both its ends,
         but only where the line actually meets it. */
      if (Math.abs(aAt - runAtFt) < 1e-9) {
        lo = Math.min(lo, across(a), across(b));
        hi = Math.max(hi, across(a), across(b));
      }
      continue;
    }
    const t = (runAtFt - aAt) / (bAt - aAt);
    if (t < -1e-9 || t > 1 + 1e-9) continue;
    const v = across(a) + Math.min(Math.max(t, 0), 1) * (across(b) - across(a));
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  if (!(hi > lo)) return null;
  return { startFt: lo, endFt: hi };
}

/**
 * Where the run has to be split so that no panel straddles a corner of the
 * building — inches from the run's own start, sorted, interior only.
 *
 * ⚠ **Without these a mitred panel cannot be a trapezoid.** A corner inside
 * a panel's width is a kink in that panel's end, and a kinked end is a
 * five-sided part. These are the same kind of forced boundary the gable row
 * already takes from the wall below it.
 */
export function deckRunSplitPointsIn(footprint: Footprint): number[] {
  const runAxis = deckRunAxis(footprint);
  const { minX, maxX, minY, maxY } = footprintSpanAndRun(footprint);
  const runStart = runAxis === "x" ? minX : minY;
  const runEnd = runAxis === "x" ? maxX : maxY;
  const at = (p: Point) => (runAxis === "x" ? p.x : p.y);

  const seen = new Set<number>();
  const out: number[] = [];
  for (const corner of footprint.corners) {
    const alongIn = (at(corner.point) - runStart) * 12;
    /* Interior only: the two ends of the run are not splits, they are ends. */
    if (alongIn <= 1e-6 || alongIn >= (runEnd - runStart) * 12 - 1e-6) continue;
    const key = Math.round(alongIn * 1e6);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(alongIn);
  }
  return out.sort((a, b) => a - b);
}

/** One deck panel, cut to the building at both of its ends. */
export interface DeckPanelCut {
  /** Inches from the run's start to this panel's near edge. */
  atIn: number;
  widthIn: number;
  /** Where the building starts and ends across the span at the panel's NEAR
   *  edge, in inches from the span's own start. */
  nearStartIn: number;
  nearEndIn: number;
  /** The same at its FAR edge. Equal to the near pair on a square-cut panel;
   *  different means a mitre. */
  farStartIn: number;
  farEndIn: number;
  /** The longest this panel has to be, which is what the shop cuts from. */
  maxLengthIn: number;
  /** True when either end is a sloped cut rather than square. */
  isMitred: boolean;
}

/**
 * Cut a run of deck panels to the footprint.
 *
 * ⚠ **A panel is measured at its two EDGES, and that is only honest because
 * the run has been split at every corner** — between two corners the
 * building's outline is a straight line, so the extent across a panel's
 * width is linear and its two edge readings describe the whole cut. Hand
 * this widths that straddle a corner and the panel it returns will be a
 * trapezoid where the real building is five-sided, cutting inside the wall
 * at that corner. `deckRunSplitPointsIn` is what prevents it, and
 * `splitWidthsAtIn` applies it.
 */
export function clipDeckPanelsToFootprint(footprint: Footprint, panelWidthsIn: readonly number[]): DeckPanelCut[] {
  const runAxis = deckRunAxis(footprint);
  const { minX, minY } = footprintSpanAndRun(footprint);
  const runStartFt = runAxis === "x" ? minX : minY;
  const spanStartFt = runAxis === "x" ? minY : minX;

  const cuts: DeckPanelCut[] = [];
  let atIn = 0;
  for (const widthIn of panelWidthsIn) {
    const edge = (alongIn: number) => {
      const r = deckSpanRangeFtAt(footprint, runStartFt + alongIn / 12);
      /* A pointed corner has no width; the panel still has to start
         somewhere, so it collapses to a zero-length end rather than
         vanishing. */
      if (!r) return { startIn: 0, endIn: 0 };
      return { startIn: (r.startFt - spanStartFt) * 12, endIn: (r.endFt - spanStartFt) * 12 };
    };
    const near = edge(atIn);
    const far = edge(atIn + widthIn);
    const maxLengthIn = Math.max(near.endIn - near.startIn, far.endIn - far.startIn);
    cuts.push({
      atIn,
      widthIn,
      nearStartIn: near.startIn,
      nearEndIn: near.endIn,
      farStartIn: far.startIn,
      farEndIn: far.endIn,
      maxLengthIn,
      isMitred: Math.abs(near.startIn - far.startIn) > 1e-6 || Math.abs(near.endIn - far.endIn) > 1e-6,
    });
    atIn += widthIn;
  }
  return cuts;
}

/**
 * Plan a run of deck panel widths that **starts and stops at every corner**,
 * so no panel straddles one.
 *
 * ⚠ **Segment first, then subdivide — patching a planned run does not work,
 * and that was tried.** The obvious move is to take the widths
 * `planFloorRoofPanelRun` already produced and insert a boundary at each
 * corner. On the 16ft Octagon the corners are at 56.25in and 135.75in while
 * the planned run is four 48in panels, so each insert leaves an 8.25in
 * sliver; nudging the nearest joint onto the corner instead would make a
 * 56.25in panel, **wider than the 48in maximum**. Neither split could be
 * placed, every panel still straddled a corner, and the deck came out
 * **207.5 sq ft against the building's 212.1** — cutting INSIDE the wall at
 * all four corners.
 *
 * Segmenting first cannot fail that way: each stretch between corners is
 * divided into as few equal panels as fit under `maxWidthIn`, so the corners
 * are joints by construction. The 16ft Octagon comes out 28.125 / 28.125 /
 * 39.75 / 39.75 / 28.125 / 28.125 instead of four 48s.
 *
 * ⚠ A segment shorter than `minWidthIn` is merged into the one before it
 * rather than built as a sliver — the corner it was protecting then sits
 * inside a panel, and that panel's end is the straight line between its two
 * edges. Better a slightly wrong end on one panel than a part the shop
 * cannot make.
 */
export function planDeckRunWidths(
  totalIn: number,
  splitAtIn: readonly number[],
  minWidthIn: number,
  maxWidthIn: number,
): number[] {
  if (!(totalIn > 0) || !(maxWidthIn > 0)) return [];

  /* The stretches between corners, with slivers folded into their left
     neighbour so nothing under the minimum survives. */
  const bounds = [0, ...splitAtIn.filter((v) => v > 1e-6 && v < totalIn - 1e-6).slice().sort((a, b) => a - b), totalIn];
  const segments: number[] = [];
  for (let i = 1; i < bounds.length; i++) {
    const lenIn = bounds[i]! - bounds[i - 1]!;
    if (lenIn <= 1e-6) continue;
    if (lenIn < minWidthIn && segments.length > 0) segments[segments.length - 1] += lenIn;
    else segments.push(lenIn);
  }
  /* ⚠ **A sliver at the very START has no left neighbour**, so the loop above
     pushes it as its own segment and it comes out as a sub-minimum panel. A
     corner 4in from the end of the run is a real case — the Cindy's own
     overall rectangle is 55'-3", and any future plan with a short return
     wall reaches it. Fold it RIGHT instead. */
  while (segments.length > 1 && segments[0]! < minWidthIn) {
    segments[1] += segments[0]!;
    segments.shift();
  }
  /* A single segment under the minimum is the whole deck, and it still has to
     be built. */
  if (segments.length === 0) segments.push(totalIn);

  const widths: number[] = [];
  for (const segIn of segments) {
    const count = Math.max(1, Math.ceil(segIn / maxWidthIn - 1e-9));
    const each = segIn / count;
    for (let i = 0; i < count; i++) widths.push(each);
  }
  return widths;
}
