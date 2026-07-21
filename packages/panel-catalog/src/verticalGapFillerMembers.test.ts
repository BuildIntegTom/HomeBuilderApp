import { describe, expect, it } from "vitest";
import { buildVerticalGapFillerMembers, buildVerticalGapFillerSchema } from "./verticalGapFillerMembers";
import { memberBoxSizeIn } from "./panelMemberHelpers";

const WIDTH_IN = 48;
const DEPTH_IN = 15.5;
const HEIGHT_IN = 6;

describe("buildVerticalGapFillerMembers", () => {
  it("builds a single flat plywood filler, tile-width long, wall-depth wide, gap-height thick, with no framing", () => {
    const members = buildVerticalGapFillerMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN);
    expect(members).toHaveLength(1);
    const sheet = members[0]!;
    expect(sheet.material).toBe("plywood");
    expect(sheet.actualDimsIn).toEqual({ thicknessIn: HEIGHT_IN, widthIn: DEPTH_IN, lengthIn: WIDTH_IN });
    expect(sheet.orientation).toBe("flat");
  });

  it("sizes to a widthIn x depthIn x heightIn box via the shared axis mapping", () => {
    const members = buildVerticalGapFillerMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN);
    const size = memberBoxSizeIn(members[0]!);
    expect(size.xIn).toBeCloseTo(WIDTH_IN, 6);
    expect(size.yIn).toBeCloseTo(DEPTH_IN, 6);
    expect(size.zIn).toBeCloseTo(HEIGHT_IN, 6);
  });
});

describe("buildVerticalGapFillerSchema", () => {
  it("wraps the member with the shared schema envelope", () => {
    const schema = buildVerticalGapFillerSchema(WIDTH_IN, DEPTH_IN, HEIGHT_IN);
    expect(schema.id).toBe("vertical_gap_filler");
    expect(schema.members).toHaveLength(1);
    expect(schema.overallDimensions).toEqual({ heightIn: HEIGHT_IN, widthIn: WIDTH_IN, depthIn: DEPTH_IN });
  });
});
