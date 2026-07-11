import { describe, expect, it } from "vitest";
import {
  buildTrussPlateMembers,
  buildTrussPlateSchema,
  computeTimberHpVolume,
  PLATE_2X6_WIDTH_IN,
} from "./trussPlateMembers";
import { memberBoxSizeIn } from "./panelMemberHelpers";

const LENGTH_IN = 200;
const DEPTH_IN = 15.5;

describe("buildTrussPlateMembers", () => {
  it("builds a 2x4 interior edge, 2x6 exterior edge, and a plywood cap spanning both", () => {
    const members = buildTrussPlateMembers(LENGTH_IN, DEPTH_IN);
    expect(members).toHaveLength(3);
    const int2x4 = members.find((m) => m.memberId === "truss_plate_2x4_interior")!;
    const ext2x6 = members.find((m) => m.memberId === "truss_plate_2x6_exterior")!;
    const skin = members.find((m) => m.memberId === "truss_plate_skin")!;

    expect(int2x4.actualDimsIn).toEqual({ thicknessIn: 1.5, widthIn: 3.5, lengthIn: LENGTH_IN });
    expect(ext2x6.actualDimsIn).toEqual({ thicknessIn: 1.5, widthIn: PLATE_2X6_WIDTH_IN, lengthIn: LENGTH_IN });
    expect(skin.actualDimsIn).toEqual({ thicknessIn: 0.75, widthIn: DEPTH_IN, lengthIn: LENGTH_IN });
  });

  it("sits the plywood cap on top of both edge members (same top elevation)", () => {
    const members = buildTrussPlateMembers(LENGTH_IN, DEPTH_IN);
    const int2x4 = members.find((m) => m.memberId === "truss_plate_2x4_interior")!;
    const ext2x6 = members.find((m) => m.memberId === "truss_plate_2x6_exterior")!;
    const skin = members.find((m) => m.memberId === "truss_plate_skin")!;
    expect(int2x4.position.zIn).toBeCloseTo(0, 6);
    expect(ext2x6.position.zIn).toBeCloseTo(0, 6);
    expect(skin.position.zIn).toBeCloseTo(1.5, 6); // top of both 1.5in-thick edge members
  });

  it("sizes correctly via the shared axis mapping", () => {
    const members = buildTrussPlateMembers(LENGTH_IN, DEPTH_IN);
    for (const m of members) {
      const size = memberBoxSizeIn(m);
      expect(size.xIn).toBeCloseTo(m.actualDimsIn.lengthIn, 6);
    }
  });

  it("accepts a custom inset (exterior member width) instead of the 5.5in default", () => {
    const members = buildTrussPlateMembers(LENGTH_IN, DEPTH_IN, 6);
    const ext = members.find((m) => m.memberId === "truss_plate_2x6_exterior")!;
    expect(ext.actualDimsIn.widthIn).toBe(6);
  });
});

describe("computeTimberHpVolume", () => {
  it("computes the gap width between the 2x4 and 2x6, and its volume", () => {
    const result = computeTimberHpVolume(LENGTH_IN, DEPTH_IN);
    const expectedGapWidthIn = DEPTH_IN - 3.5 - PLATE_2X6_WIDTH_IN;
    expect(result.gapWidthIn).toBeCloseTo(expectedGapWidthIn, 6);
    expect(result.volumeFt3).toBeCloseTo((expectedGapWidthIn * 1.5 * LENGTH_IN) / 1728, 9);
  });

  it("floors the gap at 0 if the edge members would overlap (narrow depth)", () => {
    const result = computeTimberHpVolume(LENGTH_IN, 5);
    expect(result.gapWidthIn).toBe(0);
    expect(result.volumeFt3).toBe(0);
  });
});

describe("buildTrussPlateSchema", () => {
  it("wraps the members with the shared schema envelope", () => {
    const schema = buildTrussPlateSchema(LENGTH_IN, DEPTH_IN);
    expect(schema.id).toBe("truss_plate");
    expect(schema.members).toHaveLength(3);
  });
});
