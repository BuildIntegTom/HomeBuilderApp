import { describe, expect, it } from "vitest";
import {
  buildFloorRoofPanelMembers,
  floorRoofPanelOutlineSection,
  type FloorRoofPanelOptions,
} from "./floorRoofPanelMembers";
import { memberBoxSizeIn } from "./panelMemberHelpers";

/**
 * ⚠ **THE BOX VIEWS DRAW THIS, AND THE FRAMED VIEW IS BUILT INSIDE IT.**
 *
 * > *"3d box and membrane views spawn a weird inclined toe up on shed roof
 * > buildings"* / *"the roof panel is not the same shape as the 3d frames,
 * > it doesn't land right and is squared off wrong"* — Tommy, 2026-10-31
 *
 * The simplified views used to draw a box from the panel's three outside
 * dimensions. That was true while a roof panel WAS a box, and stopped being
 * true the moment its ends became plumb cuts, its tall end grew a bearing
 * wedge and its eave gained a seat — a box of the same extents keeps exactly
 * the corners those cuts removed.
 *
 * The invariant worth testing is not the corner count, it is CONTAINMENT: no
 * framing may poke out through the silhouette. That is the thing a reader
 * would notice and the thing that cannot be eyeballed in a small viewport.
 */

const PITCH = 4;
const DEPTH = 15.5;

const roofOptions = (over: Partial<FloorRoofPanelOptions> = {}): FloorRoofPanelOptions => ({
  kind: "roof",
  widthIn: 24,
  depthIn: DEPTH,
  lengthIn: 216,
  structuralGirtEnds: [],
  pitchIn12: PITCH,
  bearingSeatDepthIn: DEPTH,
  ...over,
});

/** Ray casting in the panel's own (depth, span). */
const insideOutline = (outline: { yIn: number; zIn: number }[], yIn: number, zIn: number, tolIn = 1e-6): boolean => {
  let hits = 0;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i]!;
    const b = outline[j]!;
    /* On an edge counts as inside — members butt the silhouette by design. */
    const cross = (b.yIn - a.yIn) * (zIn - a.zIn) - (b.zIn - a.zIn) * (yIn - a.yIn);
    const withinY = Math.min(a.yIn, b.yIn) - tolIn <= yIn && yIn <= Math.max(a.yIn, b.yIn) + tolIn;
    const withinZ = Math.min(a.zIn, b.zIn) - tolIn <= zIn && zIn <= Math.max(a.zIn, b.zIn) + tolIn;
    if (Math.abs(cross) < 1e-4 && withinY && withinZ) return true;
    if (a.zIn > zIn !== b.zIn > zIn && yIn < ((b.yIn - a.yIn) * (zIn - a.zIn)) / (b.zIn - a.zIn) + a.yIn) hits++;
  }
  return hits % 2 === 1;
};

/** Every corner a member occupies, in (depth, span). */
const memberCorners = (m: ReturnType<typeof buildFloorRoofPanelMembers>[number]) => {
  if (m.position.sectionCornersIn) return m.position.sectionCornersIn.map((c) => ({ yIn: c.yIn, zIn: c.zIn }));
  const size = memberBoxSizeIn(m);
  const { yIn, zIn } = m.position;
  return [
    { yIn, zIn },
    { yIn: yIn + size.yIn, zIn },
    { yIn: yIn + size.yIn, zIn: zIn + size.zIn },
    { yIn, zIn: zIn + size.zIn },
  ];
};

describe("⚠ the panel silhouette the box views draw", () => {
  it("⚠ CONTAINS every member of the framed panel, at any span", () => {
    /* The one assertion that matters. A box of the panel's extents fails it
       at the plumb-cut corners; this outline is what the framing is built
       against. 1/16in of slack, which is the grid everything here lands on. */
    for (const lengthIn of [96, 144, 216]) {
      const options = roofOptions({ lengthIn });
      const outline = floorRoofPanelOutlineSection(options);
      for (const m of buildFloorRoofPanelMembers(options)) {
        for (const c of memberCorners(m)) {
          expect({ lengthIn, id: m.memberId, inside: insideOutline(outline, c.yIn, c.zIn, 1 / 16) }).toEqual({
            lengthIn,
            id: m.memberId,
            inside: true,
          });
        }
      }
    }
  });

  it("⚠ a BOX of the same extents would NOT contain them — which is the bug", () => {
    /* Stated so nobody reverts to one. The box runs 0..depth by 0..length;
       the wedge and the plumb cuts both leave that range. */
    const options = roofOptions();
    const members = buildFloorRoofPanelMembers(options);
    const outsideBox = members.flatMap((m) =>
      memberCorners(m).filter((c) => c.yIn > DEPTH + 1e-9 || c.zIn < -1e-9 || c.zIn > options.lengthIn + 1e-9),
    );
    expect(outsideBox.length).toBeGreaterThan(0);
  });

  it("the tall end is PLUMB and the eave fascia is PLUMB", () => {
    const outline = floorRoofPanelOutlineSection(roofOptions());
    const hyp = Math.hypot(12, PITCH);
    const cos = 12 / hyp;
    const sin = PITCH / hyp;
    const horizOf = (c: { yIn: number; zIn: number }) => c.zIn * cos + c.yIn * sin;
    const heightOf = (c: { yIn: number; zIn: number }) => c.zIn * sin - c.yIn * cos;
    /* Six corners: top face, tall plumb, wedge bottom, underside, seat,
       fascia. Walked as one loop. */
    expect(outline).toHaveLength(6);
    // Corners 1 and 2 share the tall end's vertical plane.
    expect(horizOf(outline[1]!)).toBeCloseTo(horizOf(outline[2]!), 9);
    // Corners 5 and 0 share the eave fascia's.
    expect(horizOf(outline[5]!)).toBeCloseTo(horizOf(outline[0]!), 9);
    // And the wedge's bottom (2 -> 3) is level, as is the eave seat (4 -> 5).
    expect(heightOf(outline[2]!)).toBeCloseTo(heightOf(outline[3]!), 9);
    expect(heightOf(outline[4]!)).toBeCloseTo(heightOf(outline[5]!), 9);
  });

  it("a FLOOR is still a plain rectangle, and so is a roof with no pitch", () => {
    for (const options of [
      { kind: "floor", widthIn: 24, depthIn: DEPTH, lengthIn: 144 } as FloorRoofPanelOptions,
      roofOptions({ pitchIn12: 0, bearingSeatDepthIn: 0 }),
    ]) {
      const outline = floorRoofPanelOutlineSection(options);
      expect(outline).toHaveLength(4);
      expect(new Set(outline.map((c) => c.yIn))).toEqual(new Set([0, DEPTH]));
      expect(new Set(outline.map((c) => c.zIn))).toEqual(new Set([0, options.lengthIn]));
    }
  });
});
