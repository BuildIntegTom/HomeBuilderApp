import { describe, expect, it } from "vitest";
import {
  buildGablePanelMembers,
  buildGablePanelSchema,
  gableShortestCornerIn,
  gableTallestCornerIn,
  gableTopDivesIntoBottom,
  gableTopPlaneDipRad,
} from "./gablePanelMembers";
import { memberLocalCornersIn, PLATE_2X4_WIDTH_IN, SKIN_THICKNESS_IN } from "./panelMemberHelpers";
import { memberIsOblique, overlappingMemberPairs } from "./memberPrism";
import { computePanelCutList } from "./panelCutList";
import type { PanelMember } from "./componentSchema";

/**
 * ⚠ **A GABLE'S TOP IS DUAL BEVELLED SO THE ROOF CAN MEET IT.**
 *
 * > *"You're right, it is not flush for the roof at the top, can we make the
 * > top of Gable and dual beveled So that the roof can meet it?"* — Tommy,
 * > 2026-11-16
 *
 * The figures here are the 16ft Octagon shed's own, measured off the live roof
 * planes before any of this was written: at 4:12 through a 15 1/2in wall, a
 * diagonal facet rakes 2.828:12 along the wall and falls 3.653in across its
 * depth, while the E/W facets rake the full 4:12 and fall nothing.
 */

const DEPTH = 15.5;
const WIDTH = 48;
/** A 16ft Octagon diagonal facet, derived rather than typed: the roof's 4:12
 *  fall splits evenly between the wall's length and its depth, so the rake is
 *  4 x cos(45deg) = 2.8284:12 and the cross rise is 15.5 x 4/12 x cos(45deg)
 *  = 3.6534in. Typing them rounded made two assertions 7 thousandths out. */
const DIAGONAL_RAKE_IN12 = 4 * Math.SQRT1_2;
const DIAGONAL_CROSS_IN = DEPTH * (4 / 12) * Math.SQRT1_2;
/** A NE facet tile: the interior face is the LOW one. */
const NE = { leftIn: 64, rightIn: 64 - (WIDTH * DIAGONAL_RAKE_IN12) / 12, crossIn: -DIAGONAL_CROSS_IN };
/** An E facet tile: the full pitch along the wall, nothing across it. */
const EAST = { leftIn: 64, rightIn: 64 - (WIDTH * 4) / 12, crossIn: 0 };

/** Every distinct (x, depth) column of a member, with the height of its own
 *  top face there. View space is [x, up, depth]. */
function topFacePoints(member: PanelMember): { xIn: number; yIn: number; zIn: number }[] {
  const byColumn = new Map<string, { xIn: number; yIn: number; zIn: number }>();
  for (const [xIn, upIn, depthIn] of memberLocalCornersIn(member)) {
    const key = `${xIn.toFixed(6)}|${depthIn.toFixed(6)}`;
    const seen = byColumn.get(key);
    if (!seen || upIn > seen.zIn) byColumn.set(key, { xIn, yIn: depthIn, zIn: upIn });
  }
  return [...byColumn.values()];
}

/** Fit a plane z = a + b*x + c*y through three or more points and report the
 *  worst residual, so "these all lie in ONE plane" is a measurement. */
function planeFit(points: { xIn: number; yIn: number; zIn: number }[]) {
  const [p, q, r] = points;
  if (!p || !q || !r) throw new Error("need three points");
  /* Solve the 3x3 by hand: the points are a board's own corners, never
     degenerate, and a dependency-free solve keeps this test honest. */
  const d = (q.xIn - p.xIn) * (r.yIn - p.yIn) - (r.xIn - p.xIn) * (q.yIn - p.yIn);
  const b = ((q.zIn - p.zIn) * (r.yIn - p.yIn) - (r.zIn - p.zIn) * (q.yIn - p.yIn)) / d;
  const c = ((r.zIn - p.zIn) * (q.xIn - p.xIn) - (q.zIn - p.zIn) * (r.xIn - p.xIn)) / d;
  const a = p.zIn - b * p.xIn - c * p.yIn;
  let worst = 0;
  for (const pt of points) worst = Math.max(worst, Math.abs(pt.zIn - (a + b * pt.xIn + c * pt.yIn)));
  return { a, b, c, worstResidualIn: worst, at: (xIn: number, yIn: number) => a + b * xIn + c * yIn };
}

describe("⚠ zero cross rise builds the panel this app has always built", () => {
  /* The safety property, and the one that makes every box building safe:
     every gable in the repo is built through the same call with no seventh
     argument. */
  for (const [label, left, right] of [
    ["a rake", 40, 56],
    ["level", 48, 48],
    ["falling right to left", 56, 40],
    ["a triangle to nothing", 64, 0],
  ] as const) {
    it(label, () => {
      const without = buildGablePanelMembers(WIDTH, DEPTH, left, right, false);
      const withZero = buildGablePanelMembers(WIDTH, DEPTH, left, right, false, undefined, 0);
      expect(withZero).toEqual(without);
      for (const m of withZero) expect(m.position.trapezoidFarCornersIn).toBeUndefined();
    });
  }

  it("and the schema is identical too, notes included", () => {
    expect(buildGablePanelSchema(WIDTH, DEPTH, 40, 56, false, undefined, 0)).toEqual(
      buildGablePanelSchema(WIDTH, DEPTH, 40, 56, false),
    );
  });
});

describe("⚠ the corner helpers — the taller EDGE is no longer the tallest point", () => {
  it("a positive cross rise lifts the interior face", () => {
    expect(gableTallestCornerIn(64, 52, 3.6527)).toBeCloseTo(67.6527, 6);
    expect(gableShortestCornerIn(64, 52, 3.6527)).toBeCloseTo(52, 6);
  });

  it("a negative one drops it, and the shortest corner moves instead", () => {
    expect(gableTallestCornerIn(64, 52, -3.6527)).toBeCloseTo(64, 6);
    expect(gableShortestCornerIn(64, 52, -3.6527)).toBeCloseTo(48.3473, 6);
  });

  it("⚠ the plane's dip is the ROOF'S pitch on every facet, not the rake", () => {
    /* 4:12 is 0.33333 of slope and 18.435deg. The NE facet splits it between
       rake and cross and must come back to the same dip — which is the
       geometric reason one number can be shared by all six facets. */
    const atFourTwelve = Math.atan(4 / 12);
    expect(gableTopPlaneDipRad(4 / 12, 0)).toBeCloseTo(atFourTwelve, 9);
    expect(gableTopPlaneDipRad(2.8284 / 12, 2.8284 / 12)).toBeCloseTo(atFourTwelve, 5);
    expect(gableTopPlaneDipRad(0, 4 / 12)).toBeCloseTo(atFourTwelve, 9);
  });
});

describe("⚠ a NE facet tile — the compound top", () => {
  const members = buildGablePanelMembers(WIDTH, DEPTH, NE.leftIn, NE.rightIn, false, undefined, NE.crossIn);
  const skin = members.find((m) => m.memberId === "top_plate_skin")!;

  it("⚠ the top skin's top face is a PLANE through all four stated corners", () => {
    const fit = planeFit(topFacePoints(skin));
    expect(fit.worstResidualIn, "the four top-face corners must be coplanar").toBeLessThan(1e-9);
    /* The exterior face (depth 0) carries the two quoted edge heights, and the
       interior face (depth 15.5) carries them plus the cross rise. */
    expect(fit.at(0, 0)).toBeCloseTo(NE.leftIn, 6);
    expect(fit.at(WIDTH, 0)).toBeCloseTo(NE.rightIn, 6);
    expect(fit.at(0, DEPTH)).toBeCloseTo(NE.leftIn + NE.crossIn, 6);
    expect(fit.at(WIDTH, DEPTH)).toBeCloseTo(NE.rightIn + NE.crossIn, 6);
  });

  it("⚠ and that plane dips at the roof's own 4:12, measured off the built member", () => {
    const fit = planeFit(topFacePoints(skin));
    expect(Math.hypot(fit.b, fit.c)).toBeCloseTo(4 / 12, 4);
  });

  it("⚠ both top plates touch the skin's underside at their OWN depth", () => {
    /* The defect this catches is reading one depth and building both plates
       from it: on this facet that puts the exterior plate 1.41in up inside
       the skin, and it is invisible in elevation. */
    const skinFit = planeFit(topFacePoints(skin));
    const skinUnderAt = (xIn: number, yIn: number) => skinFit.at(xIn, yIn) - SKIN_THICKNESS_IN / Math.cos(Math.atan(4 / 12));
    for (const id of ["top_plate_2x4_ext", "top_plate_2x4_int"]) {
      const plate = members.find((m) => m.memberId === id)!;
      const fit = planeFit(topFacePoints(plate));
      const centreDepthIn = plate.position.yIn;
      for (const xIn of [PLATE_2X4_WIDTH_IN, WIDTH - PLATE_2X4_WIDTH_IN]) {
        expect(fit.at(xIn, centreDepthIn), `${id} at x=${xIn}`).toBeCloseTo(skinUnderAt(xIn, centreDepthIn), 4);
      }
    }
  });

  it("⚠ the two plates really are at different heights — 2.83in apart", () => {
    const ext = planeFit(topFacePoints(members.find((m) => m.memberId === "top_plate_2x4_ext")!));
    const int = planeFit(topFacePoints(members.find((m) => m.memberId === "top_plate_2x4_int")!));
    const extDepth = members.find((m) => m.memberId === "top_plate_2x4_ext")!.position.yIn;
    const intDepth = members.find((m) => m.memberId === "top_plate_2x4_int")!.position.yIn;
    const dropIn = ext.at(24, extDepth) - int.at(24, intDepth);
    expect(dropIn).toBeCloseTo((Math.abs(NE.crossIn) / DEPTH) * (intDepth - extDepth), 6);
    /* Their centres are 12in apart through the depth, so one roof plane
       leaves them 12 x 0.2357 apart in height — which is the whole reason
       each has to read the plane at its OWN depth. */
    expect(dropIn).toBeCloseTo(2.8284, 3);
  });

  it("⚠ every member that touches the top plane is OBLIQUE, and the rest are not", () => {
    const oblique = members.filter((m) => memberIsOblique(m)).map((m) => m.memberId).sort();
    expect(oblique).toEqual(
      [
        "stud_centre_1_exterior",
        "stud_centre_1_interior",
        "stud_corner_1",
        "stud_corner_2",
        "stud_corner_3",
        "stud_corner_4",
        "top_plate_2x4_ext",
        "top_plate_2x4_int",
        "top_plate_skin",
      ].sort(),
    );
    /* Nothing below the top plane is touched — the bottom skin, the bottom
       plates and the girts are the same boards a box gets. */
    for (const m of members.filter((x) => x.role === "girt" || x.memberId.startsWith("bottom_"))) {
      expect(memberIsOblique(m), m.memberId).toBe(false);
    }
  });

  it("⚠ a plate's two faces TRANSLATE while a stud's bottom stays level", () => {
    const rate = NE.crossIn / DEPTH;
    const plate = members.find((m) => m.memberId === "top_plate_2x4_ext")!;
    const near = plate.position.trapezoidCornersIn!;
    const far = plate.position.trapezoidFarCornersIn!;
    for (let i = 0; i < 4; i++) {
      expect(far[i]!.zIn - near[i]!.zIn, "a plate is parallel to the plane on both faces").toBeCloseTo(
        rate * PLATE_2X4_WIDTH_IN,
        9,
      );
    }
    const stud = members.find((m) => m.memberId === "stud_corner_1")!;
    const sNear = stud.position.trapezoidCornersIn!;
    const sFar = stud.position.trapezoidFarCornersIn!;
    /* Corners 0 and 1 are the level bottom, 2 and 3 the rake — see
       `buildGableCornerStuds`. Only the top pair moves. */
    expect(sFar[0]!.zIn).toBeCloseTo(sNear[0]!.zIn, 9);
    expect(sFar[1]!.zIn).toBeCloseTo(sNear[1]!.zIn, 9);
    expect(sFar[2]!.zIn - sNear[2]!.zIn).toBeCloseTo(rate * PLATE_2X4_WIDTH_IN, 9);
  });

  it("⚠ the exterior and interior centre studs are DIFFERENT lengths", () => {
    const ext = members.find((m) => m.memberId === "stud_centre_1_exterior");
    const int = members.find((m) => m.memberId === "stud_centre_1_interior");
    expect(ext && int).toBeTruthy();
    expect(ext!.actualDimsIn.lengthIn).not.toBeCloseTo(int!.actualDimsIn.lengthIn, 3);
    /* The interior face is the low one here, so its stud is shorter. */
    expect(int!.actualDimsIn.lengthIn).toBeLessThan(ext!.actualDimsIn.lengthIn);
  });

  it("⚠ no members overlap, and none of the answers is a hull", () => {
    expect(overlappingMemberPairs(members)).toEqual([]);
  });

  it("the cut notes give the second angle and the jig wedge", () => {
    const note = members.find((m) => m.memberId === "top_plate_skin")!.notes ?? "";
    expect(note).toContain("COMPOUND CUT");
    /* On a diagonal facet the rake and the cross bevel are the same angle,
       because the roof's fall is split evenly between them. */
    expect(note).toContain("13.26deg");
    expect(note).toContain("exterior face is the high one");
    expect(note).toMatch(/missing wedge the jig is cut from is 15\.5in across by 3\.65\d?in/);
  });

  it("⚠ the CUT LIST carries the second angle, which is what makes the part buildable", () => {
    /* Without this the sheet showed the mitre alone and a generic "CHECK: the
       modelled face is off this stock width" — measured on the 16ft Octagon,
       21 more parts carrying that CHECK and none of them naming the angle a
       shop would have to set the blade to. */
    const rows = computePanelCutList(members);
    const bevelled = rows.filter((r) => r.cutNote.includes("COMPOUND CUT"));
    expect(bevelled.length).toBeGreaterThan(0);
    for (const row of bevelled) {
      expect(row.angleLabel).toContain("bevel");
      expect(row.cutNote).toContain("exterior face high");
      expect(row.cutNote).toMatch(/tilt the blade ~?13\.3°/);
      expect(row.cutNote).toMatch(/build its jig block to those two legs as well/);
    }
    /* ⚠ And a square-cut board is NOT given one. The bottom plate of this very
       panel lies flat and is cut square across its width. */
    const flat = rows.filter((r) => r.members.every((m) => m.memberId.startsWith("bottom_")));
    expect(flat.length).toBeGreaterThan(0);
    for (const row of flat) expect(row.cutNote).not.toContain("COMPOUND CUT");
  });

  it("⚠ a bevelled board and a square one of the same stock never share a row", () => {
    const rows = computePanelCutList(members);
    for (const row of rows) {
      const bevelled = row.members.filter((m) => m.position.trapezoidFarCornersIn !== undefined).length;
      expect(bevelled === 0 || bevelled === row.members.length, row.partLabel).toBe(true);
    }
  });

  it("the schema's own warning names the dual bevel, since elevation cannot show it", () => {
    const schema = buildGablePanelSchema(WIDTH, DEPTH, NE.leftIn, NE.rightIn, false, undefined, NE.crossIn);
    const text = schema.notes.map((n) => n.text).join(" ");
    expect(text).toContain("COMPOUND (dual) bevel top");
    expect(text).toContain("does not show in the elevation view");
    expect(schema.overallDimensions.heightIn).toBeCloseTo(NE.leftIn, 6);
  });
});

describe("⚠ an SE facet bevels the other way", () => {
  const members = buildGablePanelMembers(
    WIDTH,
    DEPTH,
    18.75,
    18.75 - (WIDTH * DIAGONAL_RAKE_IN12) / 12,
    false,
    undefined,
    DIAGONAL_CROSS_IN,
  );

  it("the interior face is the HIGH one and the note says so", () => {
    const skin = members.find((m) => m.memberId === "top_plate_skin")!;
    const fit = planeFit(topFacePoints(skin));
    expect(fit.at(0, DEPTH)).toBeGreaterThan(fit.at(0, 0));
    expect(skin.notes ?? "").toContain("interior face is the high one");
  });

  it("the interior centre stud is the LONGER one here", () => {
    const ext = members.find((m) => m.memberId === "stud_centre_1_exterior");
    const int = members.find((m) => m.memberId === "stud_centre_1_interior");
    if (ext && int) expect(int.actualDimsIn.lengthIn).toBeGreaterThan(ext.actualDimsIn.lengthIn);
  });

  it("no members overlap on this one either", () => {
    expect(overlappingMemberPairs(members)).toEqual([]);
  });
});

describe("⚠ a tile that runs out refuses the bevel rather than drawing one", () => {
  /* Where a tile tapers toward nothing its top and bottom plates already merge
     into one board along the WIDTH. Tilt the top through the DEPTH as well and
     the same collision arrives at one depth face and not the other, so the
     part would be a wedge tapered two ways — which nobody has specified.

     ⚠ Measured before the guard: four gable tiles on the 16ft Octagon turned
     up in the Review Log as "two members in the same volume — not buildable as
     drawn", on a building that had none before the bevel. */
  const RUN_OUT: [number, number, number][] = [
    [48, 15, 0],
    [48, 0, 15],
    [48, 6, 0],
    [15.5, 3.625, 0],
    [15.5, 0, 3.625],
  ];

  it("⚠ and no tile, bevelled or not, has two members in the same volume", () => {
    for (const [w, l, r] of [...RUN_OUT, [28.125, 18.75, 12] as [number, number, number]]) {
      for (const crossIn of [0, DIAGONAL_CROSS_IN, -DIAGONAL_CROSS_IN]) {
        const members = buildGablePanelMembers(w, DEPTH, l, r, false, undefined, crossIn);
        expect(overlappingMemberPairs(members), `${w}in ${l}->${r} cross ${crossIn}`).toEqual([]);
      }
    }
  });

  it("⚠ a run-out tile is byte-identical to the panel built before the bevel", () => {
    for (const [w, l, r] of RUN_OUT) {
      expect(gableTopDivesIntoBottom(w, DEPTH, l, r, DIAGONAL_CROSS_IN), `${w}in ${l}->${r}`).toBe(true);
      expect(buildGablePanelMembers(w, DEPTH, l, r, false, undefined, DIAGONAL_CROSS_IN)).toEqual(
        buildGablePanelMembers(w, DEPTH, l, r, false),
      );
    }
  });

  it("⚠ so the REASON cannot live on the part — it is the Review Log's job", () => {
    /* Two homes were tried and both were invisible: the schema (no consumer in
       the app) and the top skin's note (the cut list builds its own note from
       geometry and never reads `member.notes`). `gableTopDivesIntoBottom` is
       exported so page.tsx can ask the same question the builder asked, and
       say the answer where a human meets it. */
    const rows = computePanelCutList(buildGablePanelMembers(48, DEPTH, 15, 0, false, undefined, DIAGONAL_CROSS_IN));
    expect(rows.some((r) => r.cutNote.includes("COMPOUND CUT"))).toBe(false);
    expect(gableTopDivesIntoBottom(48, DEPTH, 15, 0, DIAGONAL_CROSS_IN)).toBe(true);
  });

  it("a tile well clear of the merge band keeps its bevel", () => {
    expect(gableTopDivesIntoBottom(28.125, DEPTH, 64, 57.4, DIAGONAL_CROSS_IN)).toBe(false);
    const members = buildGablePanelMembers(28.125, DEPTH, 64, 57.4, false, undefined, DIAGONAL_CROSS_IN);
    expect(members.some((m) => m.position.trapezoidFarCornersIn !== undefined)).toBe(true);
  });

  it("⚠ the predicate takes a cross RISE, like the builder — not a slope", () => {
    /* The two disagreed for an hour and the failing test looked like a
       geometry fault rather than a unit one. */
    expect(gableTopDivesIntoBottom(48, DEPTH, 64, 48, DIAGONAL_CROSS_IN)).toBe(false);
    expect(gableTopDivesIntoBottom(48, DEPTH, 64, 48, DIAGONAL_CROSS_IN * DEPTH)).toBe(false);
    /* A rise big enough to swallow the panel does dive. */
    expect(gableTopDivesIntoBottom(48, DEPTH, 64, 48, -120)).toBe(true);
  });
});

describe("⚠ an E facet is untouched — the two that were already right", () => {
  it("builds exactly the panel it built before", () => {
    expect(buildGablePanelMembers(WIDTH, DEPTH, EAST.leftIn, EAST.rightIn, false, undefined, EAST.crossIn)).toEqual(
      buildGablePanelMembers(WIDTH, DEPTH, EAST.leftIn, EAST.rightIn, false),
    );
  });
});

describe("⚠ the full 16ft Octagon shed row — every facet, at once", () => {
  /* The six facets that carry a gable row, with the cross rise geometry
     measured on the live roof planes. The N facet is the shed's tall wall and
     is closed by the cross-tilt row instead. */
  const FACETS: { name: string; rakeIn12: number; crossIn: number; tallIn: number }[] = [
    { name: "NE", rakeIn12: -2.8284, crossIn: -3.6527, tallIn: 64 },
    { name: "E", rakeIn12: -4, crossIn: 0, tallIn: 45.25 },
    { name: "SE", rakeIn12: -2.8284, crossIn: 3.6527, tallIn: 18.75 },
    { name: "SW", rakeIn12: 2.8284, crossIn: 3.6527, tallIn: 18.75 },
    { name: "W", rakeIn12: 4, crossIn: 0, tallIn: 45.25 },
    { name: "NW", rakeIn12: 2.8284, crossIn: -3.6527, tallIn: 64 },
  ];

  it("⚠ no facet's panel has an internal overlap, and every top plane dips at 4:12", () => {
    for (const facet of FACETS) {
      const widthIn = 28.125;
      const riseIn = (widthIn * facet.rakeIn12) / 12;
      const leftIn = facet.rakeIn12 < 0 ? facet.tallIn : facet.tallIn - Math.abs(riseIn);
      const rightIn = leftIn + riseIn;
      const members = buildGablePanelMembers(widthIn, DEPTH, leftIn, rightIn, false, undefined, facet.crossIn);
      expect(overlappingMemberPairs(members), facet.name).toEqual([]);
      const fit = planeFit(topFacePoints(members.find((m) => m.memberId === "top_plate_skin")!));
      expect(Math.hypot(fit.b, fit.c), `${facet.name} dip`).toBeCloseTo(4 / 12, 3);
    }
  });
});
