import { describe, expect, it } from "vitest";
import {
  buildOctagonRingSegmentMembers,
  computeOctagonRingSegmentLengthIn,
  computeOctagonRingSegmentPlacements,
  OCTAGON_RING_DEPTH_IN,
  OCTAGON_RING_THICKNESS_IN,
} from "./octagonRingMembers";
import { memberBoxSizeIn } from "./panelMemberHelpers";

const FT_TO_IN = 12;

describe("computeOctagonRingSegmentLengthIn", () => {
  it("matches the standard regular-octagon apothem/side relationship (side = 2 x apothem x tan(22.5deg))", () => {
    const outsideDiameterIn = 3 * FT_TO_IN; // 36in
    const centerlineApothemIn = outsideDiameterIn / 2 - OCTAGON_RING_THICKNESS_IN / 2;
    const expected = 2 * centerlineApothemIn * Math.tan(Math.PI / 8);
    expect(computeOctagonRingSegmentLengthIn(outsideDiameterIn)).toBeCloseTo(expected, 6);
  });

  it("grows with a larger outside diameter", () => {
    const small = computeOctagonRingSegmentLengthIn(2 * FT_TO_IN);
    const large = computeOctagonRingSegmentLengthIn(4 * FT_TO_IN);
    expect(large).toBeGreaterThan(small);
  });
});

describe("buildOctagonRingSegmentMembers", () => {
  it("builds a single 1.75in x 14in LVL cross-section at the computed length", () => {
    const outsideDiameterIn = 3 * FT_TO_IN;
    const members = buildOctagonRingSegmentMembers(outsideDiameterIn);
    expect(members).toHaveLength(1);
    const seg = members[0]!;
    expect(seg.material).toBe("dimensional_lumber");
    expect(seg.speciesGrade).toBe("LVL");
    expect(seg.actualDimsIn.thicknessIn).toBeCloseTo(OCTAGON_RING_THICKNESS_IN, 6);
    expect(seg.actualDimsIn.widthIn).toBeCloseTo(OCTAGON_RING_DEPTH_IN, 6);
    expect(seg.actualDimsIn.lengthIn).toBeCloseTo(computeOctagonRingSegmentLengthIn(outsideDiameterIn), 6);
  });

  it("sits on edge — 14in vertical (Z), 1.75in horizontal (Y), length along X", () => {
    const members = buildOctagonRingSegmentMembers(3 * FT_TO_IN);
    const size = memberBoxSizeIn(members[0]!);
    expect(size.zIn).toBeCloseTo(OCTAGON_RING_DEPTH_IN, 6);
    expect(size.yIn).toBeCloseTo(OCTAGON_RING_THICKNESS_IN, 6);
  });
});

describe("computeOctagonRingSegmentPlacements", () => {
  const outsideDiameterIn = 3 * FT_TO_IN;
  const placements = computeOctagonRingSegmentPlacements(outsideDiameterIn);

  it("returns exactly 8 segments, indices 0..7", () => {
    expect(placements).toHaveLength(8);
    expect(placements.map((p) => p.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("rotates each segment by 45deg more than the last, starting at 0", () => {
    expect(placements.map((p) => p.rotationDeg)).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
  });

  it("places every segment the same centerline-apothem distance from the ring's center", () => {
    const centerlineApothemIn = outsideDiameterIn / 2 - OCTAGON_RING_THICKNESS_IN / 2;
    for (const p of placements) {
      const distance = Math.hypot(p.centerXIn, p.centerZIn);
      expect(distance).toBeCloseTo(centerlineApothemIn, 6);
    }
  });

  it("places index 0 due north (negative Z, zero X) in the local frame", () => {
    const north = placements[0]!;
    expect(north.centerXIn).toBeCloseTo(0, 6);
    expect(north.centerZIn).toBeLessThan(0);
  });

  it("places opposite segments (index and index+4) diametrically across the center", () => {
    for (let i = 0; i < 4; i++) {
      const a = placements[i]!;
      const b = placements[i + 4]!;
      expect(a.centerXIn).toBeCloseTo(-b.centerXIn, 6);
      expect(a.centerZIn).toBeCloseTo(-b.centerZIn, 6);
    }
  });

  it("scales with a larger outside diameter", () => {
    const largerPlacements = computeOctagonRingSegmentPlacements(4 * FT_TO_IN);
    const smallDistance = Math.hypot(placements[0]!.centerXIn, placements[0]!.centerZIn);
    const largeDistance = Math.hypot(largerPlacements[0]!.centerXIn, largerPlacements[0]!.centerZIn);
    expect(largeDistance).toBeGreaterThan(smallDistance);
  });
});
