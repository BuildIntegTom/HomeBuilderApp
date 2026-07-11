import { describe, expect, it } from "vitest";
import { buildJackStudMembers, buildJackStudSchema, JACK_STUD_THICKNESS_IN } from "./jackStudMembers";
import { memberBoxSizeIn } from "./panelMemberHelpers";

const DEPTH_IN = 15.5;
const HEIGHT_IN = 120;

describe("buildJackStudMembers", () => {
  it("builds a single 3/4in plywood sheet, panel-depth wide, full height", () => {
    const members = buildJackStudMembers(DEPTH_IN, HEIGHT_IN);
    expect(members).toHaveLength(1);
    const sheet = members[0]!;
    expect(sheet.role).toBe("jack_stud");
    expect(sheet.material).toBe("plywood");
    expect(sheet.actualDimsIn).toEqual({ thicknessIn: JACK_STUD_THICKNESS_IN, widthIn: DEPTH_IN, lengthIn: HEIGHT_IN });
    expect(sheet.orientation).toBe("vertical");
  });

  it("sizes to a 0.75in x depthIn x heightIn box via the shared axis mapping", () => {
    const members = buildJackStudMembers(DEPTH_IN, HEIGHT_IN);
    const size = memberBoxSizeIn(members[0]!);
    expect(size.xIn).toBeCloseTo(JACK_STUD_THICKNESS_IN, 6);
    expect(size.yIn).toBeCloseTo(DEPTH_IN, 6);
    expect(size.zIn).toBeCloseTo(HEIGHT_IN, 6);
  });
});

describe("buildJackStudSchema", () => {
  it("wraps the member with the shared schema envelope", () => {
    const schema = buildJackStudSchema(DEPTH_IN, HEIGHT_IN);
    expect(schema.id).toBe("jack_stud");
    expect(schema.overallDimensions).toEqual({ heightIn: HEIGHT_IN, widthIn: JACK_STUD_THICKNESS_IN, depthIn: DEPTH_IN });
    expect(schema.members).toHaveLength(1);
  });
});
