import { describe, expect, it } from "vitest";
import {
  buildJackStudMembers,
  buildJackStudSchema,
  computeDoorRoughOpeningHeightIn,
  computeRoughOpeningWidthIn,
  jackStudThicknessIn,
  JACK_STUD_THICKNESS_IN,
} from "./jackStudMembers";
import { memberBoxSizeIn, PLATE_2X4_THICKNESS_IN, PLATE_2X4_WIDTH_IN } from "./panelMemberHelpers";

const DEPTH_IN = 15.5;
const HEIGHT_IN = 120;

describe("buildJackStudMembers", () => {
  it("defaults to a single 3/4in plywood sheet, panel-depth wide, full height", () => {
    const members = buildJackStudMembers(DEPTH_IN, HEIGHT_IN);
    expect(members).toHaveLength(1);
    const sheet = members[0]!;
    expect(sheet.role).toBe("jack_stud");
    expect(sheet.material).toBe("plywood");
    expect(sheet.actualDimsIn).toEqual({ thicknessIn: JACK_STUD_THICKNESS_IN, widthIn: DEPTH_IN, lengthIn: HEIGHT_IN });
    expect(sheet.orientation).toBe("vertical");
  });

  it("sizes to a 0.75in x depthIn x heightIn box via the shared axis mapping", () => {
    const members = buildJackStudMembers(DEPTH_IN, HEIGHT_IN, "plywood");
    const size = memberBoxSizeIn(members[0]!);
    expect(size.xIn).toBeCloseTo(JACK_STUD_THICKNESS_IN, 6);
    expect(size.yIn).toBeCloseTo(DEPTH_IN, 6);
    expect(size.zIn).toBeCloseTo(HEIGHT_IN, 6);
  });

  it("builds a 2x4 stud pair (ext+int wythe) for the 2x4-stud config", () => {
    const members = buildJackStudMembers(DEPTH_IN, HEIGHT_IN, "2x4-stud");
    expect(members).toHaveLength(2);
    for (const m of members) {
      expect(m.role).toBe("jack_stud");
      expect(m.material).toBe("dimensional_lumber");
      expect(m.actualDimsIn).toEqual({ thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: HEIGHT_IN });
      expect(m.orientation).toBe("vertical");
    }
    const ext = members.find((m) => m.memberId.endsWith("_ext"))!;
    const int = members.find((m) => m.memberId.endsWith("_int"))!;
    expect(ext.position.yIn).toBeCloseTo(0, 6);
    expect(int.position.yIn).toBeCloseTo(DEPTH_IN - PLATE_2X4_WIDTH_IN, 6);
  });
});

describe("jackStudThicknessIn / computeRoughOpeningWidthIn", () => {
  it("returns the plywood sheet's own thickness for the plywood config", () => {
    expect(jackStudThicknessIn("plywood")).toBeCloseTo(JACK_STUD_THICKNESS_IN, 6);
  });

  it("returns a 2x4's thickness for the 2x4-stud config", () => {
    expect(jackStudThicknessIn("2x4-stud")).toBeCloseTo(PLATE_2X4_THICKNESS_IN, 6);
  });

  it("subtracts 2x the jack stud thickness from the slot width", () => {
    expect(computeRoughOpeningWidthIn(36, "plywood")).toBeCloseTo(36 - 2 * 0.75, 6);
    expect(computeRoughOpeningWidthIn(36, "2x4-stud")).toBeCloseTo(36 - 2 * 1.5, 6);
  });

  it("never goes negative for a slot narrower than the jack studs themselves", () => {
    expect(computeRoughOpeningWidthIn(1, "2x4-stud")).toBe(0);
  });
});

describe("computeDoorRoughOpeningHeightIn", () => {
  it("subtracts the toe-up height from the selected door RO height", () => {
    expect(computeDoorRoughOpeningHeightIn(82.5, 1.5)).toBeCloseTo(81, 6);
  });

  it("never goes negative for a toe-up taller than the selected RO", () => {
    expect(computeDoorRoughOpeningHeightIn(1, 1.5)).toBe(0);
  });
});

describe("buildJackStudSchema", () => {
  it("wraps the plywood member with the shared schema envelope by default", () => {
    const schema = buildJackStudSchema(DEPTH_IN, HEIGHT_IN);
    expect(schema.id).toBe("jack_stud");
    expect(schema.overallDimensions).toEqual({ heightIn: HEIGHT_IN, widthIn: JACK_STUD_THICKNESS_IN, depthIn: DEPTH_IN });
    expect(schema.members).toHaveLength(1);
  });

  it("wraps the 2x4-stud pair with the shared schema envelope", () => {
    const schema = buildJackStudSchema(DEPTH_IN, HEIGHT_IN, "2x4-stud");
    expect(schema.overallDimensions.widthIn).toBeCloseTo(PLATE_2X4_THICKNESS_IN, 6);
    expect(schema.members).toHaveLength(2);
  });
});
