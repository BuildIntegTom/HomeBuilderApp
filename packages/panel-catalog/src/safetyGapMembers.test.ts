import { describe, expect, it } from "vitest";
import { buildSafetyGapMembers, buildSafetyGapSchema, SAFETY_GAP_THICKNESS_IN } from "./safetyGapMembers";
import { memberBoxSizeIn } from "./panelMemberHelpers";

const DEPTH_IN = 15.5;
const HEIGHT_IN = 120;

describe("buildSafetyGapMembers", () => {
  it("builds a single 3/4in plywood sheet, panel-depth wide, full height, with no framing", () => {
    const members = buildSafetyGapMembers(DEPTH_IN, HEIGHT_IN);
    expect(members).toHaveLength(1);
    const sheet = members[0]!;
    expect(sheet.material).toBe("plywood");
    expect(sheet.actualDimsIn).toEqual({ thicknessIn: SAFETY_GAP_THICKNESS_IN, widthIn: DEPTH_IN, lengthIn: HEIGHT_IN });
    expect(sheet.orientation).toBe("vertical");
  });

  it("sizes to a 0.75in x depthIn x heightIn box via the shared axis mapping", () => {
    const members = buildSafetyGapMembers(DEPTH_IN, HEIGHT_IN);
    const size = memberBoxSizeIn(members[0]!);
    expect(size.xIn).toBeCloseTo(SAFETY_GAP_THICKNESS_IN, 6);
    expect(size.yIn).toBeCloseTo(DEPTH_IN, 6);
    expect(size.zIn).toBeCloseTo(HEIGHT_IN, 6);
  });
});

describe("buildSafetyGapSchema", () => {
  it("wraps the member with the shared schema envelope", () => {
    const schema = buildSafetyGapSchema(DEPTH_IN, HEIGHT_IN);
    expect(schema.id).toBe("safety_gap");
    expect(schema.members).toHaveLength(1);
  });
});
