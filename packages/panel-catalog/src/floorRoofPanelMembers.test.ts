import { describe, expect, it } from "vitest";
import {
  ANTI_TWIST_SPACING_IN,
  BLOCKING_SPACING_IN,
  FLOOR_ROOF_EDGE_PANEL_WIDTH_IN,
  FLOOR_ROOF_PANEL_WIDTH_IN,
  JOIST_2X6_WIDTH_IN,
  STRUCTURAL_GIRT_TOTAL_THICKNESS_IN,
  buildFloorRoofPanelMembers,
  type FloorRoofPanelOptions,
} from "./floorRoofPanelMembers";
import { PLATE_2X4_WIDTH_IN } from "./panelMemberHelpers";

const floor = (over: Partial<FloorRoofPanelOptions> = {}): FloorRoofPanelOptions => ({
  kind: "floor",
  widthIn: FLOOR_ROOF_PANEL_WIDTH_IN,
  depthIn: 15.5,
  lengthIn: 144,
  structuralGirtEnds: ["start"],
  ...over,
});

const idsLike = (members: ReturnType<typeof buildFloorRoofPanelMembers>, prefix: string) =>
  members.filter((m) => m.memberId.startsWith(prefix));

describe("⚠ the numbers he gave, as numbers", () => {
  it("⚠ 19 3/16in is a SIXTEENTH SHORT of five to the 8ft, and off the eighth grid", () => {
    /* Tommy: "that is how wide each floor and roof panel should be - so that
       the panels land on the money." Measured, they land a sixteenth shy:

         19 3/16 x 5 = 95 15/16, not 96.

       The exact fifth of 8ft is 19.2in, which is not a fraction anyone cuts.
       19 3/16 is the nearest sixteenth to it, and five of them lose 1/16in —
       over a 40ft run, 25 panels, that is 5/16in.

       ⚠ And 19 3/16 is a SIXTEENTH, so it is not on the app's own 1/8in grid:
       19.1875 x 8 = 153.5, not a whole number of eighths. Neither eighth
       either side lands on 96 either — 19 1/8 x 5 is 3/8in under, 19 1/4 x 5
       is 1/4in over.

       Recorded as the measured truth rather than asserted as 96, and raised
       with him, because "land on the money" and the dimensional-tightness rule
       both say this is his call and not one to round away quietly. */
    expect(FLOOR_ROOF_PANEL_WIDTH_IN).toBe(19.1875);
    expect(FLOOR_ROOF_PANEL_WIDTH_IN * 5).toBe(95.9375);
    expect(96 - FLOOR_ROOF_PANEL_WIDTH_IN * 5).toBe(1 / 16);
    // Off the eighth grid, stated so it cannot be discovered later by surprise.
    expect(Number.isInteger(FLOOR_ROOF_PANEL_WIDTH_IN * 8)).toBe(false);
  });

  it("the first and last panel plus its girt is the wall depth", () => {
    // "the first and last being the 15.5"-2.25 so that it's load bearing
    // over/under the wall."
    expect(FLOOR_ROOF_EDGE_PANEL_WIDTH_IN).toBe(13.25);
    expect(FLOOR_ROOF_EDGE_PANEL_WIDTH_IN + STRUCTURAL_GIRT_TOTAL_THICKNESS_IN).toBe(15.5);
  });

  it("blocking every 3ft, anti-twist girts every 5ft", () => {
    expect(BLOCKING_SPACING_IN).toBe(36);
    expect(ANTI_TWIST_SPACING_IN).toBe(60);
  });
});

describe("⚠ a joist is a PAIR, and the seams make it a double double", () => {
  it("one panel carries FOUR 2x6s — two joists of two", () => {
    /* The single easiest number here to get wrong by a factor of two, and the
       one the material list is built on. Tommy: "two joists together make a
       double and there's two 2x6s per joist". */
    const members = buildFloorRoofPanelMembers(floor());
    const joists = idsLike(members, "joist-");
    expect(joists).toHaveLength(4);
    expect(joists.every((m) => m.nominalSize === "2x6")).toBe(true);
    expect(new Set(joists.map((m) => m.memberId))).toEqual(
      new Set(["joist-left-bottom", "joist-left-top", "joist-right-bottom", "joist-right-top"]),
    );
  });

  it("the pair is top and bottom, separated by the panel's depth", () => {
    const members = buildFloorRoofPanelMembers(floor());
    const left = idsLike(members, "joist-left-");
    const ys = left.map((m) => m.position.yIn).sort((a, b) => a - b);
    expect(ys[0]).toBe(0);
    expect(ys[1]).toBe(15.5 - JOIST_2X6_WIDTH_IN);
  });

  it("⚠ two panels butted together give the seam FOUR 2x6s", () => {
    // The "double double", stated as the thing an installer actually sees.
    const a = idsLike(buildFloorRoofPanelMembers(floor()), "joist-right-");
    const b = idsLike(buildFloorRoofPanelMembers(floor()), "joist-left-");
    expect(a.length + b.length).toBe(4);
  });

  it("the joists run the panel's full length", () => {
    const members = buildFloorRoofPanelMembers(floor({ lengthIn: 180 }));
    for (const m of idsLike(members, "joist-")) expect(m.actualDimsIn.lengthIn).toBe(180);
  });
});

describe("⚠ the structural girt goes only where a wall lands", () => {
  it("not at an end that was not asked for", () => {
    // "only on exterior ends where panel walls are above."
    const one = buildFloorRoofPanelMembers(floor({ structuralGirtEnds: ["start"] }));
    expect(idsLike(one, "structural-girt-start")).not.toHaveLength(0);
    expect(idsLike(one, "structural-girt-end")).toHaveLength(0);
  });

  it("at both ends when both carry a wall, and at neither when none does", () => {
    expect(idsLike(buildFloorRoofPanelMembers(floor({ structuralGirtEnds: ["start", "end"] })), "structural-girt-")).toHaveLength(6);
    expect(idsLike(buildFloorRoofPanelMembers(floor({ structuralGirtEnds: [] })), "structural-girt-")).toHaveLength(0);
  });

  it("⚠ NEVER on a roof panel, whatever is asked for", () => {
    /* "the roof panels do not need a structural girt, their weight should be
       on both the inner and outer wyth of the wall panel with the trapezoid
       shape." Asked for explicitly and still refused, because the caller
       should not be able to produce a part the spec says does not exist. */
    const roof = buildFloorRoofPanelMembers(floor({ kind: "roof", structuralGirtEnds: ["start", "end"] }));
    expect(idsLike(roof, "structural-girt-")).toHaveLength(0);
  });

  it("is a 3/4in web with a 2x4 at each edge — 2.25in overall", () => {
    const members = buildFloorRoofPanelMembers(floor({ structuralGirtEnds: ["start"] }));
    const web = members.find((m) => m.memberId === "structural-girt-start-web")!;
    expect(web.actualDimsIn.thicknessIn).toBe(0.75);
    expect(idsLike(members, "structural-girt-start-left")).toHaveLength(1);
    expect(idsLike(members, "structural-girt-start-right")).toHaveLength(1);
    expect(STRUCTURAL_GIRT_TOTAL_THICKNESS_IN).toBe(2.25);
  });
});

describe("⚠ blocking and anti-twist girts are two members, not one", () => {
  it("a floor gets both, at their own spacings", () => {
    /* The first reading of this spec collapsed them into one member at two
       different numbers. They are a 2x4 cut to fit between the 2x6s every 3ft
       and a 5/8in OSB girt every 5ft. */
    const members = buildFloorRoofPanelMembers(floor({ lengthIn: 240 }));
    expect(idsLike(members, "blocking-").length).toBeGreaterThan(0);
    expect(idsLike(members, "anti-twist-").length).toBeGreaterThan(0);
  });

  it("⚠ a ROOF gets the girts and NOT the blocking", () => {
    // "I guess we dont need blocking between the girts on the roofs."
    const roof = buildFloorRoofPanelMembers(floor({ kind: "roof", lengthIn: 240, structuralGirtEnds: [] }));
    expect(idsLike(roof, "blocking-")).toHaveLength(0);
    expect(idsLike(roof, "anti-twist-").length).toBeGreaterThan(0);
  });

  it("blocking is cut to fit between the 2x6s", () => {
    const members = buildFloorRoofPanelMembers(floor({ lengthIn: 240 }));
    const block = idsLike(members, "blocking-")[0]!;
    // 15.5 depth less the two 5.5in joists = 4.5in of gap.
    expect(block.actualDimsIn.widthIn).toBe(15.5 - 2 * JOIST_2X6_WIDTH_IN);
  });

  it("⚠ the anti-twist girt's 2x4s are HORIZONTAL, tying top and bottom chords", () => {
    /* "The structural girts are vertical, all the OSB girts are horizontal
       2x4s." The orientation follows the GIRT TYPE, not the panel type —
       simpler than the question that prompted it assumed. */
    const members = buildFloorRoofPanelMembers(floor({ lengthIn: 240 }));
    const top = members.find((m) => m.memberId === "anti-twist-0-top")!;
    const bottom = members.find((m) => m.memberId === "anti-twist-0-bottom")!;
    // Spanning the full width, which is what "horizontal" means in the panel.
    expect(top.actualDimsIn.thicknessIn).toBe(FLOOR_ROOF_PANEL_WIDTH_IN);
    expect(bottom.position.yIn).toBe(0);
    expect(top.position.yIn).toBe(15.5 - PLATE_2X4_WIDTH_IN);
  });

  it("the girt web is 5/8in OSB", () => {
    const members = buildFloorRoofPanelMembers(floor({ lengthIn: 240 }));
    expect(members.find((m) => m.memberId === "anti-twist-0-web")!.actualDimsIn.thicknessIn).toBe(0.625);
  });
});

describe("⚠ both lids are structural, and the last 2x4 is ripped", () => {
  it("covers the whole lid face: five full 2x4s and a sixth ripped", () => {
    /* "As many 2x4s (vertically when installed) to the face of the lid to
       entirely cover it - the last may need to be ripped." 19 3/16in over
       3.5in is 5.48, so five full and one at 1 11/16in. */
    const members = buildFloorRoofPanelMembers(floor());
    const face = idsLike(members, "lid-start-face-");
    expect(face).toHaveLength(6);
    const widths = face.map((m) => m.actualDimsIn.thicknessIn);
    expect(widths.filter((w) => w === PLATE_2X4_WIDTH_IN)).toHaveLength(5);
    const ripped = widths.find((w) => w !== PLATE_2X4_WIDTH_IN)!;
    expect(ripped).toBeCloseTo(FLOOR_ROOF_PANEL_WIDTH_IN - 5 * PLATE_2X4_WIDTH_IN, 9);
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(FLOOR_ROOF_PANEL_WIDTH_IN, 9);
  });

  it("the ripped one says so, so the shop is not left guessing", () => {
    const members = buildFloorRoofPanelMembers(floor());
    const ripped = idsLike(members, "lid-start-face-").find((m) => m.actualDimsIn.thicknessIn !== PLATE_2X4_WIDTH_IN)!;
    expect(ripped.notes).toContain("ripped");
  });

  it("⚠ BOTH ends get one — the interior lid is structural too", () => {
    // He was asked whether the inner lid stayed plain and said to make it
    // structural as well.
    const members = buildFloorRoofPanelMembers(floor());
    expect(idsLike(members, "lid-start-face-").length).toBe(idsLike(members, "lid-end-face-").length);
    expect(idsLike(members, "lid-start-skin")).toHaveLength(1);
    expect(idsLike(members, "lid-end-skin")).toHaveLength(1);
  });

  it("an edge panel's lid needs one fewer 2x4, and still comes out exact", () => {
    const members = buildFloorRoofPanelMembers(floor({ widthIn: FLOOR_ROOF_EDGE_PANEL_WIDTH_IN }));
    const widths = idsLike(members, "lid-start-face-").map((m) => m.actualDimsIn.thicknessIn);
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(FLOOR_ROOF_EDGE_PANEL_WIDTH_IN, 9);
  });
});

describe("nothing lands outside the panel", () => {
  it("every member sits within the panel's own box, on every configuration", () => {
    for (const opts of [
      floor(),
      floor({ widthIn: FLOOR_ROOF_EDGE_PANEL_WIDTH_IN, structuralGirtEnds: ["start", "end"] }),
      floor({ kind: "roof", structuralGirtEnds: [] }),
      floor({ lengthIn: 300 }),
    ]) {
      for (const m of buildFloorRoofPanelMembers(opts)) {
        expect({ id: m.memberId, x: m.position.xIn >= -1e-9 }).toEqual({ id: m.memberId, x: true });
        expect({ id: m.memberId, y: m.position.yIn >= -1e-9 }).toEqual({ id: m.memberId, y: true });
        expect({ id: m.memberId, z: m.position.zIn >= -1e-9 }).toEqual({ id: m.memberId, z: true });
        expect({ id: m.memberId, zMax: m.position.zIn <= opts.lengthIn + 1e-9 }).toEqual({ id: m.memberId, zMax: true });
      }
    }
  });
});
