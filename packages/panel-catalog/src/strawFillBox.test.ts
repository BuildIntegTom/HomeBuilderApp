import { describe, expect, it } from "vitest";
import { buildStandardPanelMembers } from "./standardPanelMembers";
import { buildGablePanelMembers } from "./gablePanelMembers";
import { buildFloorRoofPanelMembers } from "./floorRoofPanelMembers";
import { memberLocalCornersIn, SKIN_THICKNESS_IN } from "./panelMemberHelpers";
import { strawFillBoxIn } from "./strawFillBox";

const WIDTH_IN = 48;
const DEPTH_IN = 15.5;
const HEIGHT_IN = 96;

/** Every member corner, view space — what the box has to stay inside. */
function envelope(members: Parameters<typeof strawFillBoxIn>[0]) {
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  for (const m of members) {
    for (const [x, y, z] of memberLocalCornersIn(m)) {
      xs.push(x);
      ys.push(y);
      zs.push(z);
    }
  }
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  };
}

describe("strawFillBoxIn", () => {
  it("⚠ fills a standard panel BETWEEN its skins, not over them", () => {
    /* The derivation the single-panel preview has used all along: straw
       starts on top of the bottom skin and stops under the top one. */
    const members = buildStandardPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false);
    const box = strawFillBoxIn(members)!;
    expect(box).not.toBeNull();
    const topIn = box.centerIn[1] + box.sizeIn[1] / 2;
    const bottomIn = box.centerIn[1] - box.sizeIn[1] / 2;
    expect(bottomIn).toBeCloseTo(SKIN_THICKNESS_IN, 6);
    expect(topIn).toBeCloseTo(HEIGHT_IN - SKIN_THICKNESS_IN, 6);
  });

  it("runs the panel's full width and full depth — a bale wall is open on both faces", () => {
    const members = buildStandardPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false);
    const box = strawFillBoxIn(members)!;
    expect(box.sizeIn[0]).toBeCloseTo(WIDTH_IN, 6);
    expect(box.sizeIn[2]).toBeCloseTo(DEPTH_IN, 6);
  });

  it("⚠ stays INSIDE a gable panel's rake rather than poking through it", () => {
    /* A raked top skin is thin in its own normal but spans feet in Y, so a
       plain bounding box would run the straw up to the tall corner and out
       through the slope over the short one. The box stops at the sloped
       cap's LOWEST point — under-drawn inside the panel, never outside it. */
    const members = buildGablePanelMembers(WIDTH_IN, DEPTH_IN, 40, 80, false);
    const box = strawFillBoxIn(members)!;
    const topIn = box.centerIn[1] + box.sizeIn[1] / 2;
    expect(topIn).toBeLessThanOrEqual(40);
    const env = envelope(members);
    expect(topIn).toBeLessThan(env.maxY);
  });

  it("never leaves the member envelope on any axis, for any of the three panel kinds", () => {
    const cases = [
      buildStandardPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false),
      buildGablePanelMembers(WIDTH_IN, DEPTH_IN, 40, 80, false),
      buildFloorRoofPanelMembers({ kind: "floor", widthIn: 24, depthIn: DEPTH_IN, lengthIn: 144, structuralGirtEnds: ["start", "end"] }),
      buildFloorRoofPanelMembers({ kind: "roof", widthIn: 24, depthIn: DEPTH_IN, lengthIn: 144 }),
    ];
    for (const members of cases) {
      const box = strawFillBoxIn(members)!;
      const env = envelope(members);
      const lo = [box.centerIn[0] - box.sizeIn[0] / 2, box.centerIn[1] - box.sizeIn[1] / 2, box.centerIn[2] - box.sizeIn[2] / 2];
      const hi = [box.centerIn[0] + box.sizeIn[0] / 2, box.centerIn[1] + box.sizeIn[1] / 2, box.centerIn[2] + box.sizeIn[2] / 2];
      expect({
        xIn: lo[0]! >= env.minX - 1e-9 && hi[0]! <= env.maxX + 1e-9,
        yIn: lo[1]! >= env.minY - 1e-9 && hi[1]! <= env.maxY + 1e-9,
        zIn: lo[2]! >= env.minZ - 1e-9 && hi[2]! <= env.maxZ + 1e-9,
      }).toEqual({ xIn: true, yIn: true, zIn: true });
    }
  });

  it("⚠ a floor panel fills between its two LIDS, and they are symmetric now", () => {
    /* A floor panel is a standard panel laid over, so the caps at each end of
       its span are its lids. Nothing here knows that; it finds them the same
       way it finds a wall panel's skins.

       ⚠ **This test pinned a real defect for one day.** It used to assert
       141.75 at the top against 0.75 at the bottom, because the two lids
       stacked their layers in OPPOSITE orders — plywood outboard at the
       start, inboard at the end — so one lid presented plywood to the next
       panel and the other presented board ends. Tommy's answer, 2026-11-05:
       *"Plywood should always be on the exterior side for lids/plates."* Both
       lids now read skin outermost, and the cavity is symmetric. */
    const members = buildFloorRoofPanelMembers({
      kind: "floor",
      widthIn: 24,
      depthIn: DEPTH_IN,
      lengthIn: 144,
      structuralGirtEnds: ["start", "end"],
    });
    const box = strawFillBoxIn(members)!;
    const bottomIn = box.centerIn[1] - box.sizeIn[1] / 2;
    const topIn = box.centerIn[1] + box.sizeIn[1] / 2;
    expect(bottomIn).toBeCloseTo(SKIN_THICKNESS_IN, 6);
    expect(topIn).toBeCloseTo(144 - SKIN_THICKNESS_IN, 6);
    const lidSkins = members
      .filter((m) => m.role === "skin")
      .map((m) => memberLocalCornersIn(m).map((c) => c[1]))
      .map((ys) => [Math.min(...ys), Math.max(...ys)]);
    expect(lidSkins).toEqual([
      [0, 0.75],
      [143.25, 144],
    ]);
  });

  it("⚠ and the lid is still 2.25in thick, with the joists where B23 put them", () => {
    /* The layers swapped; nothing else moved. If this ever fails alongside the
       test above, the fix went further than it was meant to. */
    const members = buildFloorRoofPanelMembers({
      kind: "floor",
      widthIn: 24,
      depthIn: DEPTH_IN,
      lengthIn: 144,
      structuralGirtEnds: ["start", "end"],
    });
    const joistYs = members
      .filter((m) => m.memberId.startsWith("joist-"))
      .map((m) => memberLocalCornersIn(m).map((c) => c[1]))
      .map((ys) => [Math.min(...ys), Math.max(...ys)]);
    for (const [lo, hi] of joistYs) expect([lo, hi]).toEqual([2.25, 141.75]);
    const faceYs = members
      .filter((m) => m.memberId.startsWith("lid-end-face-"))
      .map((m) => memberLocalCornersIn(m).map((c) => c[1]))
      .map((ys) => [Math.min(...ys), Math.max(...ys)]);
    for (const [lo, hi] of faceYs) expect([lo, hi]).toEqual([141.75, 143.25]);
  });

  it("refuses rather than drawing a degenerate box", () => {
    expect(strawFillBoxIn([])).toBeNull();
  });

  it("falls back to the whole envelope when a panel has no capping skin at all", () => {
    /* A safety gap is one sheet of plywood and nothing else — no cap, no
       cavity. The fallback keeps the function total instead of special-casing
       the panel types that have no skins. */
    const members = buildStandardPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false).filter((m) => m.role !== "skin");
    const box = strawFillBoxIn(members)!;
    const env = envelope(members);
    expect(box.sizeIn[1]).toBeCloseTo(env.maxY - env.minY, 6);
  });
});
