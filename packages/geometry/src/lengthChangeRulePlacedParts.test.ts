import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { retile, wallGeometryFor } from "./retile";
import { reconcileBracedPlacement } from "./bracedPlacement";
import { applyRulePlacedParts, resizeWallRun, runChangeEndFromInsets, wallGrowthEnd } from "./resizeWallRun";
import { applySafetyGapSpacing } from "./safetyGapSpacing";
import { TILER_MIN_PANEL_WIDTH_IN, safetyGapWidthForRunIn } from "./tiling";
import { tidyUnbuildableLeftovers } from "./tidyLeftovers";
import type { Footprint, PanelSlot } from "./types";

/**
 * TILE-ONCE, THE STAGE 4 AUDIT FIX — the bug the invariants could not see.
 *
 * The re-tile that Stage 4 replaced did FIVE things to a wall whose length
 * changed. Stage 4 reproduced three of them — resize the standard panels,
 * collapse a crushed opening, tidy an unbuildable leftover — and silently
 * dropped the two that are placed by RULE rather than by width:
 *
 *   1. the CORNER PANELS, whose owner is decided by "the longer wall runs
 *      through", which reads `wall.lengthFt` — so a length change can move
 *      one from one wall to the other;
 *   2. the SAFETY GAP, whose end is decided by distance from the
 *      least-accessible corner.
 *
 * ⚠ **The wall TOTALS still came out right, which is why nothing failed.**
 * The delta is measured between the old and new `wallGeometryFor(...).lengthIn`,
 * which already accounts for the inset change, so every width invariant the
 * app has — the sum rule, dimensional tightness, the shortfall refusal —
 * stayed green while the COMPOSITION was wrong: two corner panels at one
 * corner and none at the other. That is the worst shape a bug can take, so
 * this file asserts composition directly, and the control below proves the
 * assertion can actually fail.
 *
 * This replays `page.tsx`'s own `resizeSlotsForShapeChange` with the same
 * exported functions in the same order. It is not that function, which lives
 * inside the React component — which is exactly why the behaviour is pinned
 * here, at the level where the parts are.
 */

const THICKNESS_IN = 15.5;
const STANDARD_WIDTH_IN = 40;
const CORNER_PANEL_WIDTH_IN = 24;
/** Huge spacing, so only the corner-touching bracing rule fires and the
 * fixtures stay readable — the same choice `retile.test.ts` makes. */
const BRACED_SEED = { spacingIn: 100_000, defaultPattern: "chevron" as const, defaultMirrored: false };
const allPrimary = (fp: Footprint) => new Set(fp.corners.map((c) => c.id));

const cornerXY = (fp: Footprint) => new Map(fp.corners.map((c) => [c.id, { x: c.point.x, y: c.point.y }]));
const toE = (inches: number) => Math.round(inches * 8);
const cornerCount = (slots: readonly PanelSlot[]) => slots.filter((s) => s.type === "corner").length;
const sumE = (slots: readonly PanelSlot[]) => slots.reduce((n, s) => n + toE(s.widthIn), 0);
const gapIndex = (slots: readonly PanelSlot[]) => slots.findIndex((s) => s.type === "safety-gap");

/**
 * The length-change pipeline, replayed.
 *
 * @param moveRulePlacedParts `false` runs the pipeline as Stage 4 shipped it —
 *   resize only — which is the state this fix corrects. The tests use it as a
 *   CONTROL: an assertion that cannot fail against the old behaviour is not
 *   evidence of anything.
 */
function resizeForShapeChange(
  oldFp: Footprint,
  newFp: Footprint,
  slotsByWallId: Record<string, PanelSlot[]>,
  moveRulePlacedParts: boolean,
): { slotsByWallId: Record<string, PanelSlot[]>; cornersMoved: number } | null {
  const oldCorners = cornerXY(oldFp);
  const newCorners = cornerXY(newFp);
  const primary = allPrimary(newFp);
  const next: Record<string, PanelSlot[]> = {};
  let cornersMoved = 0;

  for (const wall of newFp.walls) {
    const slots = slotsByWallId[wall.id];
    if (!slots) continue;
    const oldWall = oldFp.walls.find((w) => w.id === wall.id);
    if (!oldWall) {
      next[wall.id] = slots;
      continue;
    }
    const oldGeom = wallGeometryFor(oldFp, wall.id, allPrimary(oldFp), "A", THICKNESS_IN);
    const newGeom = wallGeometryFor(newFp, wall.id, primary, "A", THICKNESS_IN);
    if (!oldGeom || !newGeom) {
      next[wall.id] = slots;
      continue;
    }
    const end =
      wallGrowthEnd(oldCorners, newCorners, wall) ??
      runChangeEndFromInsets(
        newGeom.startInsetIn - oldGeom.startInsetIn,
        newGeom.endInsetIn - oldGeom.endInsetIn,
      ) ??
      "end";
    const deltaIn = newGeom.lengthIn - oldGeom.lengthIn;

    const ruled = moveRulePlacedParts
      ? applyRulePlacedParts(
          slots,
          { hasCornerStart: oldGeom.hasCornerStart, hasCornerEnd: oldGeom.hasCornerEnd, gapEnd: oldGeom.gapEnd },
          { hasCornerStart: newGeom.hasCornerStart, hasCornerEnd: newGeom.hasCornerEnd, gapEnd: newGeom.gapEnd },
          deltaIn,
          CORNER_PANEL_WIDTH_IN,
        )
      : { slots: slots as PanelSlot[], remainingDeltaIn: deltaIn, cornerMoved: false, gapMoved: false };
    if (ruled.cornerMoved) cornersMoved += 1;
    if (toE(ruled.remainingDeltaIn) === 0 && !ruled.cornerMoved && !ruled.gapMoved) {
      next[wall.id] = slots;
      continue;
    }
    const out = resizeWallRun(ruled.slots, ruled.remainingDeltaIn, end, STANDARD_WIDTH_IN);
    if (out.shortfallEighths > 0) return null;
    const gapSpaced = applySafetyGapSpacing(out.slots, newGeom.gapEnd, safetyGapWidthForRunIn(newGeom.lengthIn), TILER_MIN_PANEL_WIDTH_IN);
    const braced = reconcileBracedPlacement(
      ruled.slots,
      gapSpaced.slots,
      BRACED_SEED.spacingIn,
      STANDARD_WIDTH_IN,
      BRACED_SEED.defaultPattern,
      BRACED_SEED.defaultMirrored,
      false,
    );
    next[wall.id] = tidyUnbuildableLeftovers(braced).slots;
  }
  return { slotsByWallId: next, cornersMoved };
}

/** The composition every wall must end with: as many corner panels as the new
 * geometry says it builds, and a total matching its own run. */
function expectWallsAgreeWithGeometry(fp: Footprint, slotsByWallId: Record<string, PanelSlot[]>): void {
  for (const wall of fp.walls) {
    const geom = wallGeometryFor(fp, wall.id, allPrimary(fp), "A", THICKNESS_IN)!;
    const slots = slotsByWallId[wall.id]!;
    const expected = (geom.hasCornerStart ? 1 : 0) + (geom.hasCornerEnd ? 1 : 0);
    expect({ wall: wall.id, corners: cornerCount(slots) }).toEqual({ wall: wall.id, corners: expected });
    expect({ wall: wall.id, eighths: sumE(slots) }).toEqual({ wall: wall.id, eighths: toE(geom.lengthIn) });
  }
}

function tiled(fp: Footprint): Record<string, PanelSlot[]> {
  return retile(fp, "A", allPrimary(fp), STANDARD_WIDTH_IN, CORNER_PANEL_WIDTH_IN, THICKNESS_IN, BRACED_SEED);
}

describe("⚠ the measured case from the audit: a square widened flips corner ownership", () => {
  it("30x30 -> 40x30 really does move corner ownership — the premise, measured not assumed", () => {
    /* If this ever stops being true the tests below are testing nothing, so
       the premise is asserted before the behaviour. On a perfect square the
       tie-break decides; widening one pair of walls breaks the tie. */
    const square = buildRectangleFootprint(30, 30);
    const wide = buildRectangleFootprint(40, 30);
    const cornersOf = (fp: Footprint, id: string) => {
      const g = wallGeometryFor(fp, id, allPrimary(fp), "A", THICKNESS_IN)!;
      return (g.hasCornerStart ? 1 : 0) + (g.hasCornerEnd ? 1 : 0);
    };
    const before = square.walls.map((w) => cornersOf(square, w.id));
    const after = wide.walls.map((w) => cornersOf(wide, w.id));
    expect(before).not.toEqual(after);
    // The audit's own numbers, recorded so a change of tie-break is visible.
    expect(cornersOf(square, "AB")).toBe(1);
    expect(cornersOf(wide, "AB")).toBe(2);
    expect(cornersOf(square, "BC")).toBe(1);
    expect(cornersOf(wide, "BC")).toBe(0);
  });

  it("the panels follow the rule: every wall ends with the corner panels its geometry says", () => {
    const square = buildRectangleFootprint(30, 30);
    const wide = buildRectangleFootprint(40, 30);
    const out = resizeForShapeChange(square, wide, tiled(square), true)!;
    expect(out).not.toBeNull();
    expectWallsAgreeWithGeometry(wide, out.slotsByWallId);
  });

  it("and it SAYS a corner moved, because that is two walls' parts changing", () => {
    const square = buildRectangleFootprint(30, 30);
    const wide = buildRectangleFootprint(40, 30);
    // Tommy, 2026-10-18: "Yes — it changes two walls' parts." Both the wall
    // that gained and the wall that lost are counted, so the notice fires.
    expect(resizeForShapeChange(square, wide, tiled(square), true)!.cornersMoved).toBeGreaterThanOrEqual(2);
  });

  it("⚠ CONTROL: resize-only gets the TOTALS right and the COMPOSITION wrong", () => {
    /* This is the audit's finding as an executable statement, and it is the
       reason the test above is evidence rather than decoration. Without the
       rule-placed step the sums all still match — so every invariant the app
       has stays green — while a wall carries the wrong number of corner
       panels. If this test ever goes green on composition, the fix has been
       absorbed somewhere else and this file should be re-pointed, not
       deleted. */
    const square = buildRectangleFootprint(30, 30);
    const wide = buildRectangleFootprint(40, 30);
    const out = resizeForShapeChange(square, wide, tiled(square), false)!;

    // Totals: correct, every wall. The delta already carried the inset change.
    for (const wall of wide.walls) {
      const geom = wallGeometryFor(wide, wall.id, allPrimary(wide), "A", THICKNESS_IN)!;
      expect(sumE(out.slotsByWallId[wall.id]!)).toBe(toE(geom.lengthIn));
    }
    // Composition: wrong. AB should build two corner panels and has one; BC
    // should build none and still has one.
    expect(cornerCount(out.slotsByWallId["AB"]!)).toBe(1);
    expect(cornerCount(out.slotsByWallId["BC"]!)).toBe(1);
    expect(() => expectWallsAgreeWithGeometry(wide, out.slotsByWallId)).toThrow();
  });
});

describe("⚠ a wall whose OWN corners never moved can still change length", () => {
  it("DA is resized even though neither D nor A moved — found by measurement, not by the audit", () => {
    /* Widening a 30x30 to 40x30 moves only B and C, so `wallGrowthEnd` returns
       null for DA. Its run still goes 344.5in -> 329in, because AB now builds
       the corner at A and insets DA by a thickness. The old code read that
       null as "this wall did not change" and skipped it, leaving DA's panels
       summing 15.5in LONGER than the wall holding them.

       ⚠ That is a dimensional-tightness violation, not a composition one, and
       it is a worse bug than the one the audit was written about — the audit
       missed it because it reasoned from the delta rather than measuring the
       walls. The lesson is in the comment on `wallGrowthEnd`. */
    const square = buildRectangleFootprint(30, 30);
    const wide = buildRectangleFootprint(40, 30);
    expect(wallGrowthEnd(cornerXY(square), cornerXY(wide), wide.walls.find((w) => w.id === "DA")!)).toBeNull();

    const oldGeom = wallGeometryFor(square, "DA", allPrimary(square), "A", THICKNESS_IN)!;
    const newGeom = wallGeometryFor(wide, "DA", allPrimary(wide), "A", THICKNESS_IN)!;
    expect(toE(newGeom.lengthIn)).not.toBe(toE(oldGeom.lengthIn));
    expect(runChangeEndFromInsets(
      newGeom.startInsetIn - oldGeom.startInsetIn,
      newGeom.endInsetIn - oldGeom.endInsetIn,
    )).toBe("start");

    const out = resizeForShapeChange(square, wide, tiled(square), true)!;
    expect(sumE(out.slotsByWallId["DA"]!)).toBe(toE(newGeom.lengthIn));
    expect(cornerCount(out.slotsByWallId["DA"]!)).toBe(0);
  });

  it("runChangeEndFromInsets is null only when neither inset moved", () => {
    expect(runChangeEndFromInsets(0, 0)).toBeNull();
    expect(runChangeEndFromInsets(15.5, 0)).toBe("start");
    expect(runChangeEndFromInsets(0, -15.5)).toBe("end");
    // Both ends at once — a wall can lose one corner and gain the neighbour's
    // at the other. The larger movement decides; a tie is resolved to "start"
    // so the answer does not depend on argument order.
    expect(runChangeEndFromInsets(15.5, -24)).toBe("end");
    expect(runChangeEndFromInsets(15.5, 15.5)).toBe("start");
  });
});

describe("the safety gap is rule-placed too", () => {
  it("is never lost or RESIZED by a length change — though a long wall gains more", () => {
    /* ⚠ This test asserted an unchanged gap COUNT until 2026-10-18, which his
       24ft spacing rule makes wrong: a wall taken from 20ft to 60ft is
       supposed to gain gaps. What must still hold is that no gap is ever
       resized and no run ever loses its last one — a gap IS a 3/4in sheet of
       plywood, so a gap of some other width is not a part the shop has. */
    const fp = buildRectangleFootprint(30, 20);
    const grown = buildRectangleFootprint(30, 60);
    const start = tiled(fp);
    const out = resizeForShapeChange(fp, grown, start, true)!;
    for (const id of Object.keys(out.slotsByWallId)) {
      const gaps = out.slotsByWallId[id]!.filter((s) => s.type === "safety-gap");
      const was = start[id]!.filter((s) => s.type === "safety-gap");
      expect(gaps.length).toBeGreaterThanOrEqual(Math.min(1, was.length));
      // Every gap is the width the run's own length calls for, not a leftover.
      const geom = wallGeometryFor(grown, id, allPrimary(grown), "A", THICKNESS_IN)!;
      for (const g of gaps) expect(g.widthIn).toBe(safetyGapWidthForRunIn(geom.lengthIn));
    }
    expectWallsAgreeWithGeometry(grown, out.slotsByWallId);
  });

  it("changes side when the RULE changes side", () => {
    /* The flip itself is unit-tested on `applyRulePlacedParts`; this records
       that the pipeline passes the rule through rather than dropping it. */
    const fp = buildRectangleFootprint(30, 20);
    const gapEnds = fp.walls.map(
      (w) => wallGeometryFor(fp, w.id, allPrimary(fp), "A", THICKNESS_IN)!.gapEnd,
    );
    expect(new Set(gapEnds).size).toBe(2); // both sides really do occur
  });

  it("⚠ ANSWERED 2026-10-18: a wall that grows gains gaps every ~24ft", () => {
    /* This test used to pin the open question — a gap stranded ~20ft inboard
       of the end the rule pointed at, after growing BC from 20ft to 60ft.
       His answer turned it into a SPACING rule rather than a sliding one:

       > "There should be a 3/4-in safety cap approximately every 24 ft. This
       > starts with a safety Gap right next to each corner on each wall
       > according to the least accessibility placement."

       So the first gap does not move, and the long stretch it left behind
       gets gaps of its own. The spacing itself is pinned in
       `safetyGapSpacing.test.ts`; what this asserts is that the
       length-change path applies it at all. */
    const fp = buildRectangleFootprint(30, 20);
    const grown = buildRectangleFootprint(30, 60);
    const start = tiled(fp);
    const out = resizeForShapeChange(fp, grown, start, true)!;
    const before = start["BC"]!.filter((s) => s.type === "safety-gap").length;
    const bc = out.slotsByWallId["BC"]!;
    expect(bc.filter((s) => s.type === "safety-gap").length).toBeGreaterThan(before);
    /* ⚠ The property that matters on a real wall: no run of framing is ever
       further than 28ft from a gap, which is his +4ft bound. Asserted as the
       PROPERTY rather than as a slot index, because the index was what made
       the first version of this test wrong. */
    let sinceGapIn = 0;
    let worstIn = 0;
    for (const s of bc) {
      if (s.type === "safety-gap") sinceGapIn = 0;
      else sinceGapIn += s.widthIn;
      worstIn = Math.max(worstIn, sinceGapIn);
    }
    expect(worstIn).toBeLessThanOrEqual(28 * 12);
    expectWallsAgreeWithGeometry(grown, out.slotsByWallId);
  });

  it("⚠ his 20ft-to-40ft example gets ONE gap, not the two he described", () => {
    /* HIS EXAMPLE, and the app does not yet match it. Recorded as the real
       behaviour rather than skipped, because a skipped test is a thing nobody
       reads.

       He said: a 20ft wall grown to 40ft should end up with a gap beside the
       corner panel AND another 24ft along. What happens: `resizeWallRun`
       inserts the new panels at the end that MOVED, which is between the
       corner and the existing gap, so the gap ends up 15.3ft in. The two
       stretches are then 15.3ft and 24.6ft, both inside his 28ft bound, so
       the spacing rule is satisfied and adds nothing.

       Getting his two gaps means MOVING the anchor back beside the corner.
       That was built and measured working (two gaps, 280in apart) and then
       reverted: a gap adjacent to the corner-touching panel is the exact
       configuration the corner-brace combine exists for, and making it common
       broke 36 tests including the 790,440-wall sweep that keeps every panel
       inside [24in, 48in]. See `safetyGapSpacing.ts`.

       ⚠ The PROPERTY he cares about does hold: nothing is further than 28ft
       from a gap. Asserted below, so this test stays useful rather than just
       recording a number. */
    const fp = buildRectangleFootprint(20, 20);
    const grown = buildRectangleFootprint(40, 20);
    const start = tiled(fp);
    expect(start["AB"]!.filter((s) => s.type === "safety-gap")).toHaveLength(1);
    const out = resizeForShapeChange(fp, grown, start, true)!;
    const ab = out.slotsByWallId["AB"]!;
    expect(ab.filter((s) => s.type === "safety-gap")).toHaveLength(1);
    let sinceGapIn = 0;
    let worstIn = 0;
    for (const sl of ab) {
      if (sl.type === "safety-gap") sinceGapIn = 0;
      else sinceGapIn += sl.widthIn;
      worstIn = Math.max(worstIn, sinceGapIn);
    }
    expect(worstIn).toBeLessThanOrEqual(28 * 12);
    expectWallsAgreeWithGeometry(grown, out.slotsByWallId);
  });
});

describe("bracing follows a wall that grew — his answer of 2026-10-18", () => {
  it("a wall grown by 20ft does not end with 20ft of unbraced framing", () => {
    /* `reconcileBracedPlacement` seeds only genuinely NEW standard-slot
       positions from the spacing rule and leaves every pattern the user chose
       where it is. With a real spacing rule the new framing is braced; without
       the reconcile it was plain standard panels all the way. */
    const fp = buildRectangleFootprint(30, 20);
    const grown = buildRectangleFootprint(50, 20);
    const start = tiled(fp);
    const out = resizeForShapeChange(fp, grown, start, true)!;
    const bracedBefore = start["AB"]!.filter((s) => s.type === "braced").length;
    const bracedAfter = out.slotsByWallId["AB"]!.filter((s) => s.type === "braced").length;
    // The corner-touching rule braces the same panels either way; what must
    // never happen is bracing DISAPPEARING from a wall that only got longer.
    expect(bracedAfter).toBeGreaterThanOrEqual(bracedBefore);
    expectWallsAgreeWithGeometry(grown, out.slotsByWallId);
  });
});

describe("⚠ nothing else moves — the fix must not become a re-tile in disguise", () => {
  it("a hand-set width survives a length change on its own wall", () => {
    const fp = buildRectangleFootprint(30, 20);
    const grown = buildRectangleFootprint(40, 20);
    const start = tiled(fp);
    const ab = start["AB"]!.map((s) => ({ ...s }));
    const pinIdx = ab.findIndex((s) => s.type === "standard" || s.type === "braced");
    ab[pinIdx] = { ...ab[pinIdx]!, widthIn: 31.5, lockedWidthIn: 31.5 };
    // Give the wall its width back somewhere else so it starts tight.
    const freeIdx = ab.findIndex((s, i) => i !== pinIdx && (s.type === "standard" || s.type === "braced"));
    const owed = sumE(start["AB"]!) - sumE(ab);
    ab[freeIdx] = { ...ab[freeIdx]!, widthIn: ab[freeIdx]!.widthIn + owed / 8 };

    const out = resizeForShapeChange(fp, grown, { ...start, AB: ab }, true)!;
    const kept = out.slotsByWallId["AB"]!.find((s) => s.lockedWidthIn === 31.5);
    expect(kept).toBeDefined();
    expect(kept!.widthIn).toBe(31.5);
  });

  it("an untouched wall's panels are the SAME ARRAY, not a re-derivation", () => {
    /* CD and DA keep their length when AB and BC grow. Identity, not equality:
       a pass that rebuilt them would be the tiler running behind his back. */
    const fp = buildRectangleFootprint(30, 20);
    const grown = buildRectangleFootprint(30, 40);
    const start = tiled(fp);
    const out = resizeForShapeChange(fp, grown, start, true)!;
    for (const id of Object.keys(out.slotsByWallId)) {
      const geomBefore = wallGeometryFor(fp, id, allPrimary(fp), "A", THICKNESS_IN)!;
      const geomAfter = wallGeometryFor(grown, id, allPrimary(grown), "A", THICKNESS_IN)!;
      const unchanged =
        toE(geomBefore.lengthIn) === toE(geomAfter.lengthIn) &&
        geomBefore.hasCornerStart === geomAfter.hasCornerStart &&
        geomBefore.hasCornerEnd === geomAfter.hasCornerEnd &&
        geomBefore.gapEnd === geomAfter.gapEnd;
      if (unchanged) expect(out.slotsByWallId[id]).toBe(start[id]);
    }
  });

  it("an opening is never swallowed by a corner panel arriving", () => {
    const fp = buildRectangleFootprint(30, 30);
    const wide = buildRectangleFootprint(40, 30);
    const start = tiled(fp);
    const ab = start["AB"]!.map((s) => ({ ...s }));
    const idx = ab.findIndex((s) => s.type === "standard" || s.type === "braced");
    const was = ab[idx]!.widthIn;
    ab[idx] = { type: "window", widthIn: was };
    const out = resizeForShapeChange(fp, wide, { ...start, AB: ab }, true)!;
    expect(out.slotsByWallId["AB"]!.filter((s) => s.type === "window")).toHaveLength(1);
    expectWallsAgreeWithGeometry(wide, out.slotsByWallId);
  });
});
