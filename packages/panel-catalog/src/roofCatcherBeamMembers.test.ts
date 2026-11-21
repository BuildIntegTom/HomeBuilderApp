import { describe, expect, it } from "vitest";
import {
  buildRoofCatcherBeamMembers,
  buildRoofCatcherBeamSchema,
  computeRoofCatcherBeamPostPositions,
  computeRoofCatcherBeamSegments,
  isPostPositionOnPier,
  ROOF_CATCHER_BEAM_DEPTH_IN,
  ROOF_CATCHER_BEAM_MAX_SPAN_IN,
  ROOF_CATCHER_BEAM_PLY_COUNT,
  ROOF_CATCHER_BEAM_PLY_THICKNESS_IN,
  ROOF_CATCHER_BEAM_TOTAL_THICKNESS_IN,
  roofCatcherBeamCapGeometry,
} from "./roofCatcherBeamMembers";
import { overlappingMemberPairs } from "./memberPrism";
import { memberLocalCornersIn } from "./panelMemberHelpers";
import { memberBoxSizeIn } from "./panelMemberHelpers";

describe("buildRoofCatcherBeamMembers", () => {
  it("builds 3 plies of 2x12, each spanning the full length", () => {
    const members = buildRoofCatcherBeamMembers(120);
    expect(members).toHaveLength(ROOF_CATCHER_BEAM_PLY_COUNT);
    for (const m of members) {
      expect(m.nominalSize).toBe("2x12");
      expect(m.material).toBe("dimensional_lumber");
      expect(m.actualDimsIn).toEqual({ thicknessIn: ROOF_CATCHER_BEAM_PLY_THICKNESS_IN, widthIn: ROOF_CATCHER_BEAM_DEPTH_IN, lengthIn: 120 });
    }
  });

  it("stacks the 3 plies side by side (on edge) via the shared axis mapping", () => {
    const members = buildRoofCatcherBeamMembers(120);
    const sizes = members.map(memberBoxSizeIn);
    for (const size of sizes) {
      expect(size.xIn).toBeCloseTo(120, 6);
      expect(size.yIn).toBeCloseTo(ROOF_CATCHER_BEAM_PLY_THICKNESS_IN, 6);
      expect(size.zIn).toBeCloseTo(ROOF_CATCHER_BEAM_DEPTH_IN, 6);
    }
    const yPositions = members.map((m) => m.position.yIn).sort((a, b) => a - b);
    expect(yPositions).toEqual([0, ROOF_CATCHER_BEAM_PLY_THICKNESS_IN, 2 * ROOF_CATCHER_BEAM_PLY_THICKNESS_IN]);
  });
});

describe("computeRoofCatcherBeamSegments", () => {
  it("keeps a single segment when the run is within the max span", () => {
    const segments = computeRoofCatcherBeamSegments(100, ROOF_CATCHER_BEAM_MAX_SPAN_IN);
    expect(segments).toHaveLength(1);
    expect(segments[0]!.spanIn).toBeCloseTo(100, 6);
  });

  it("evenly re-splits a run that exceeds the max span, not a short leftover segment", () => {
    // 300in run / 144in max span -> ceil(300/144) = 3 segments of 100in each
    const segments = computeRoofCatcherBeamSegments(300, ROOF_CATCHER_BEAM_MAX_SPAN_IN);
    expect(segments).toHaveLength(3);
    for (const s of segments) expect(s.spanIn).toBeCloseTo(100, 6);
    expect(segments[0]!.xStartIn).toBeCloseTo(0, 6);
    expect(segments[2]!.xEndIn).toBeCloseTo(300, 6);
  });

  it("defaults to the 12ft max span", () => {
    const segments = computeRoofCatcherBeamSegments(300);
    expect(segments).toHaveLength(3);
  });
});

describe("computeRoofCatcherBeamPostPositions", () => {
  it("has no posts when the run needs only a single segment", () => {
    expect(computeRoofCatcherBeamPostPositions(100, ROOF_CATCHER_BEAM_MAX_SPAN_IN)).toEqual([]);
  });

  it("places a post at each interior segment boundary, not at the run's own ends", () => {
    const posts = computeRoofCatcherBeamPostPositions(300, ROOF_CATCHER_BEAM_MAX_SPAN_IN);
    expect(posts).toEqual([100, 200]);
  });
});

describe("isPostPositionOnPier", () => {
  it("is true when the post lands exactly on a multiple of the pier spacing", () => {
    expect(isPostPositionOnPier(144, 6)).toBe(true); // 12ft post, 6ft piers
    expect(isPostPositionOnPier(72, 6)).toBe(true); // 6ft post, 6ft piers
  });

  it("is false when the post falls between piers", () => {
    expect(isPostPositionOnPier(100, 6)).toBe(false); // ~8.33ft, not a multiple of 6ft
  });

  it("is false for a non-positive pier spacing", () => {
    expect(isPostPositionOnPier(144, 0)).toBe(false);
  });
});

describe("buildRoofCatcherBeamSchema", () => {
  it("wraps the members with the shared schema envelope", () => {
    const schema = buildRoofCatcherBeamSchema(120);
    expect(schema.id).toBe("roof_catcher_beam");
    expect(schema.overallDimensions.widthIn).toBeCloseTo(120, 6);
    expect(schema.members).toHaveLength(ROOF_CATCHER_BEAM_PLY_COUNT);
  });
});

describe("the triangle cap (2026-11-20)", () => {
  /* > "The ridge beam should have a triangle cap on it for more bearing for
     > the ends of roof panels."  — Tommy, 2026-11-20

     A roof panel reaches the ridge leaning at the pitch and cut PLUMB, so it
     meets a square beam top along a line. The cap's two faces ARE the roof
     planes, which turns that line into full contact. */

  it("⚠ leaves an uncapped beam BYTE-IDENTICAL, so no existing call site moves", () => {
    /* The default is 0 for the same reason `LEGACY_GIRT_STYLE` is `web`: an
       untaught caller draws the old part, not a part built at a guessed
       pitch. */
    expect(buildRoofCatcherBeamMembers(144)).toEqual(buildRoofCatcherBeamMembers(144, 0));
    expect(buildRoofCatcherBeamMembers(144)).toHaveLength(ROOF_CATCHER_BEAM_PLY_COUNT);
    expect(buildRoofCatcherBeamMembers(144).some((m) => m.memberId.includes("cap"))).toBe(false);
  });

  it("⚠ builds NO cap on a shed — a zero rise is not a thin part, it is no part", () => {
    expect(roofCatcherBeamCapGeometry(0)).toBeNull();
    expect(roofCatcherBeamCapGeometry(-4)).toBeNull();
    expect(buildRoofCatcherBeamMembers(144, 0).some((m) => m.memberId.includes("cap"))).toBe(false);
  });

  it("rises at exactly the roof's slope, from the beam's own half-width", () => {
    /* The rise is FORCED: the cap has to climb from the beam's edge to the
       ridge centreline at the roof's pitch, so it is (width / 2) x pitch/12
       and nothing about it is chosen. */
    for (const pitchIn12 of [3, 4, 6, 8, 12]) {
      const cap = roofCatcherBeamCapGeometry(pitchIn12)!;
      expect(cap.baseIn).toBeCloseTo(ROOF_CATCHER_BEAM_TOTAL_THICKNESS_IN, 9);
      expect(cap.riseIn).toBeCloseTo((ROOF_CATCHER_BEAM_TOTAL_THICKNESS_IN / 2) * (pitchIn12 / 12), 9);
    }
    /* The default roof: a 4 1/2in beam at 4:12 gives 3/4in. */
    expect(roofCatcherBeamCapGeometry(4)!.riseIn).toBeCloseTo(0.75, 9);
    expect(roofCatcherBeamCapGeometry(8)!.riseIn).toBeCloseTo(1.5, 9);
  });

  it("picks the smallest board the section fits in, and says when none does", () => {
    expect(roofCatcherBeamCapGeometry(4)!.nominalSize).toBe("2x6");
    /* 8:12 is exactly 1.5in — the last pitch a 2x can hold, and an
       off-by-epsilon here would send every default-ish roof to 4x stock. */
    expect(roofCatcherBeamCapGeometry(8)!.nominalSize).toBe("2x6");
    expect(roofCatcherBeamCapGeometry(9)!.nominalSize).toBe("4x6");
    expect(roofCatcherBeamCapGeometry(12)!.nominalSize).toBe("4x6");
    expect(roofCatcherBeamCapGeometry(24)!.nominalSize).toBe("built-up");
  });

  it("⚠ sits ON the beam's top face and comes to a point on its centreline", () => {
    const members = buildRoofCatcherBeamMembers(120, 4);
    expect(members).toHaveLength(ROOF_CATCHER_BEAM_PLY_COUNT + 1);
    const cap = members.find((m) => m.memberId === "roof_catcher_beam_cap")!;
    const corners = cap.position.sectionCornersIn!;
    /* ⚠ `sectionCornersIn` is ABSOLUTE in the beam's space, so these are the
       real coordinates and not offsets — getting that wrong is what put the
       gable peak panel's lid half outside the building. */
    const zs = corners.map((c) => c.zIn);
    const ys = corners.map((c) => c.yIn);
    expect(Math.min(...zs)).toBeCloseTo(ROOF_CATCHER_BEAM_DEPTH_IN, 9);
    expect(Math.max(...zs)).toBeCloseTo(ROOF_CATCHER_BEAM_DEPTH_IN + 0.75, 9);
    /* Spans the beam exactly — no overhang either side. */
    expect(Math.min(...ys)).toBeCloseTo(0, 9);
    expect(Math.max(...ys)).toBeCloseTo(ROOF_CATCHER_BEAM_TOTAL_THICKNESS_IN, 9);
    /* The apex is on the centreline, and it is the only corner up there. */
    const apexes = corners.filter((c) => Math.abs(c.zIn - (ROOF_CATCHER_BEAM_DEPTH_IN + 0.75)) < 1e-9);
    expect(apexes).toHaveLength(2); // a triangle written as a quad
    for (const a of apexes) expect(a.yIn).toBeCloseTo(ROOF_CATCHER_BEAM_TOTAL_THICKNESS_IN / 2, 9);
    /* ⚠ FOUR corners, not three: `BOX_FACES` is an 8-corner table shared by
       the OBJ exporter and the 3D renderer, so a genuine 3-point ring would
       index past its end. */
    expect(corners).toHaveLength(4);
  });

  it("⚠ lands where the RENDERER and the OBJ exporter will put it, not just where the field says", () => {
    /* ⚠ This is the lesson from the Gable Peak Panel's overhang, found the
       same day: asserting on the raw position field passes while the shared
       `memberLocalCornersIn` reads it by a different convention and puts the
       part somewhere else entirely. The OBJ exporter and the 3D renderer both
       build from that function, so it is the one worth asserting through.

       Its tuples are [x, z, y] — the across-the-beam ordinate is LAST. */
    const cap = buildRoofCatcherBeamMembers(120, 4).find((m) => m.memberId === "roof_catcher_beam_cap")!;
    const corners = memberLocalCornersIn(cap);
    /* 4 section corners x 2 extruded faces. */
    expect(corners).toHaveLength(8);
    const xs = corners.map((c) => c[0]);
    const heights = corners.map((c) => c[1]);
    const across = corners.map((c) => c[2]);
    /* Runs the whole segment. */
    expect(Math.min(...xs)).toBeCloseTo(0, 9);
    expect(Math.max(...xs)).toBeCloseTo(120, 9);
    /* Sits ON the beam's top face and rises 3/4in, not through the beam. */
    expect(Math.min(...heights)).toBeCloseTo(ROOF_CATCHER_BEAM_DEPTH_IN, 9);
    expect(Math.max(...heights)).toBeCloseTo(ROOF_CATCHER_BEAM_DEPTH_IN + 0.75, 9);
    /* And exactly as wide as the beam — no overhang either side. */
    expect(Math.min(...across)).toBeCloseTo(0, 9);
    expect(Math.max(...across)).toBeCloseTo(ROOF_CATCHER_BEAM_TOTAL_THICKNESS_IN, 9);
  });

  it("⚠ does not overlap the beam it caps — his standing rule", () => {
    for (const pitchIn12 of [3, 4, 8, 12]) {
      expect(overlappingMemberPairs(buildRoofCatcherBeamMembers(96, pitchIn12))).toEqual([]);
    }
  });

  it("runs the full length of its segment", () => {
    for (const spanIn of [48, 96, 144]) {
      const cap = buildRoofCatcherBeamMembers(spanIn, 4).find((m) => m.memberId === "roof_catcher_beam_cap")!;
      expect(cap.actualDimsIn.lengthIn).toBe(spanIn);
      expect(cap.position.xIn).toBe(0);
    }
  });

  it("⚠ names the stock as unconfirmed, because nobody specified it", () => {
    const cap = buildRoofCatcherBeamMembers(96, 4).find((m) => m.memberId === "roof_catcher_beam_cap")!;
    expect(cap.notes).toContain("pending Building Integrity confirmation");
    /* And it states the geometry that IS derived, so a reader can tell the
       two apart. */
    expect(cap.notes).toContain("4:12");
  });
});
