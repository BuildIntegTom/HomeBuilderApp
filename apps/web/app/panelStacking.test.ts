import { describe, expect, it } from "vitest";
import { tileWall } from "@building-integrity/geometry";
import { cornerPanelWidthIn, planFloorRoofPanelWidthsIn } from "@building-integrity/panel-catalog";
import { jointsFromWidths, reportWallStacking } from "./panelStacking";

/**
 * ⚠ **B15 BASELINE — how badly the floor and the wall disagree today.**
 *
 * > *"I want the floors, walls, and roof intersections of panels to be
 * > stacked and supported."* — Tommy, 2026-11-01
 *
 * Measured from the REAL tiler and the REAL deck planner, not from a fixture,
 * so these numbers move the moment either one does. That is the point: this
 * is the baseline any fix gets measured against, the same shape as the
 * no-overlapping-members audit.
 */

const DECK_EDGE_IN = 15.5; // the wall's own thickness, his rule
const STANDARD_IN = 48;
/** What it was until 2026-11-01: "24in core + two 3/4in plywood side faces". */
const FORMER_CORNER_IN = 25.5;

function wallJoints(wallLengthIn: number, cornerWidthIn: number): number[] {
  return jointsFromWidths(tileWall(wallLengthIn, STANDARD_IN, cornerWidthIn, "end").slots.map((s) => s.widthIn));
}

function deckJoints(runLengthIn: number): number[] {
  return jointsFromWidths(planFloorRoofPanelWidthsIn(runLengthIn, DECK_EDGE_IN)!);
}

function report(wallLengthIn: number, cornerWidthIn: number) {
  return reportWallStacking({
    wallId: "AB",
    wallJointsIn: wallJoints(wallLengthIn, cornerWidthIn),
    deckJointsIn: deckJoints(wallLengthIn),
  });
}

describe("⚠ B15: do the wall's joints land on the deck's?", () => {
  it("⚠ AT THE OLD 25.5in CORNER: not one of them stacked", () => {
    /* His building, before the change. Nothing stacked, on either wall. */
    for (const wallFt of [25.25, 22.75]) {
      const r = report(wallFt * 12, FORMER_CORNER_IN);
      expect({ wallFt, stacked: r.stackedCount, of: r.jointCount }).toEqual({
        wallFt,
        stacked: 0,
        of: r.jointCount,
      });
      expect(r.jointCount).toBeGreaterThan(0);
    }
  });

  it("⚠ AT TODAY'S CATALOG WIDTH: the full-width run stacks exactly", () => {
    /* ⚠ Reads the catalog rather than a literal, so this tracks the real
       default and fails the day it moves. Tommy, 2026-11-01: *"Let's change
       the default to 15.5\" so everything lands."* */
    expect(cornerPanelWidthIn.value).toBeCloseTo(DECK_EDGE_IN, 6);
    for (const wallFt of [25.25, 22.75]) {
      const r = report(wallFt * 12, cornerPanelWidthIn.value);
      expect({ wallFt, stackedAtLeast: r.stackedCount > 0 }).toEqual({ wallFt, stackedAtLeast: true });
      /* The whole full-width stretch, joint for joint. */
      expect(r.joints.slice(0, 4).every((j) => j.stacked)).toBe(true);
    }
  });

  it("⚠ the miss is 10in, and 10in is exactly the two runs' different first panel", () => {
    /* ⚠ Not bad luck — arithmetic. The wall opens with a 25.5in corner and
       the deck with a 15.5in edge, so the grids start 10in apart. Their PITCH
       already agrees: 48 is exactly two 24s. They would interleave perfectly
       if they began together. */
    expect(FORMER_CORNER_IN - DECK_EDGE_IN).toBeCloseTo(10, 9);

    const r = report(25.25 * 12, FORMER_CORNER_IN);
    /* Every joint on the full-width stretch misses by exactly that. */
    const fullWidthMisses = r.joints.slice(0, 4).map((j) => +j.offsetIn.toFixed(4));
    expect(fullWidthMisses).toEqual([10, 10, 10, 10]);
  });

  it("⚠ the grids lock at a 15.5in corner — which is the module working", () => {
    /* `panel_module_2ft_4ft`: floors and roofs on 24in, walls on 48in, "so
       load bears straight down". It already does, as soon as the two runs
       start together, and since 2026-11-01 they do. */
    const r = report(25.25 * 12, DECK_EDGE_IN);
    expect(r.stackedCount).toBeGreaterThan(0);
    expect(r.joints.slice(0, 4).map((j) => j.stacked)).toEqual([true, true, true, true]);
    expect(r.joints.slice(0, 4).map((j) => j.atIn)).toEqual([15.5, 63.5, 111.5, 159.5]);
  });

  it("⚠ ...but the TAIL still breaks it, even in phase", () => {
    /* The borrowed pair plus the 3/4in safety gap push the last stretch off
       the module. Whatever reconciles the two runs has to survive the
       REMAINDER, not just the full-width panels — which is the part a
       "just align the grids" fix would miss. */
    const r = report(30 * 12, DECK_EDGE_IN);
    expect(r.stackedCount).toBeLessThan(r.jointCount);
    expect(r.unstackedAtIn.length).toBeGreaterThan(0);
    expect(r.worstOffsetIn).toBeGreaterThan(1);
  });

  it("reports an exact stack as stacked, and says which joints are not", () => {
    const r = reportWallStacking({
      wallId: "AB",
      wallJointsIn: [24, 48, 70],
      deckJointsIn: [24, 48, 72],
    });
    expect(r.stackedCount).toBe(2);
    expect(r.unstackedAtIn).toEqual([70]);
    expect(r.worstOffsetIn).toBeCloseTo(2, 9);
    expect(r.joints[2]!.nearestDeckJointIn).toBe(72);
  });

  it("a deck with no joints at all leaves every wall joint unsupported", () => {
    const r = reportWallStacking({ wallId: "AB", wallJointsIn: [24], deckJointsIn: [] });
    expect(r.stackedCount).toBe(0);
    expect(r.joints[0]!.nearestDeckJointIn).toBeNull();
    expect(r.joints[0]!.offsetIn).toBe(Number.POSITIVE_INFINITY);
    /* Infinity must not poison the worst-offset readout. */
    expect(r.worstOffsetIn).toBe(0);
  });
});
