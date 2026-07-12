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
} from "./roofCatcherBeamMembers";
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
