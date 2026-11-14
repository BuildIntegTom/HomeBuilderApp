import { describe, expect, it } from "vitest";
import {
  buildJackStudMembers,
  buildJackStudSchema,
  computeDoorRoughOpeningHeightIn,
  computeHeaderHeightIn,
  computeRoughOpeningWidthIn,
  jackStudThicknessIn,
  jackStudConfigLabel,
  JACK_STUD_CONFIGS,
  JACK_STUD_THICKNESS_IN,
} from "./jackStudMembers";
import { overlappingMemberPairs } from "./memberPrism";
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

describe("computeHeaderHeightIn", () => {
  it("subtracts the RO's top elevation from the wall height (a door: RO starts at the floor)", () => {
    expect(computeHeaderHeightIn(120, 81)).toBeCloseTo(39, 6);
  });

  it("subtracts sill height + window RO height together (a window: RO starts on top of the sill)", () => {
    const sillHeightIn = 32;
    const windowRoHeightIn = 48;
    expect(computeHeaderHeightIn(120, sillHeightIn + windowRoHeightIn)).toBeCloseTo(40, 6);
  });

  it("never goes negative when the RO's top is at or above the wall height", () => {
    expect(computeHeaderHeightIn(96, 96)).toBe(0);
    expect(computeHeaderHeightIn(96, 120)).toBe(0);
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

/**
 * ⚠ **THE SHEET PLUS OPTIONAL 2x4s — 2026-11-14.**
 *
 * > *"those are definitely supposed to be plywood. It would be nice if there
 * > was an option to change or add 2x4s... making Jack studs default 3/4 in
 * > horizontal elevation view with the option of adding 2x4s to make them two
 * > and a quarter horizontal elevation view length."*
 *
 * His 2 1/4in is the whole test: it only comes out that way if "inside" and
 * "outside" are the two WYTHES, so both 2x4s share one band of elevation
 * length beside the sheet. End to end along the wall it would be 3 3/4in.
 */
describe("⚠ jack studs: the sheet, plus a 2x4 at either wythe", () => {
  it("⚠ is 3/4in by default and 2 1/4in with 2x4s, one wythe or both", () => {
    expect(jackStudThicknessIn("plywood")).toBeCloseTo(0.75, 9);
    expect(jackStudThicknessIn("plywood+ext-2x4")).toBeCloseTo(2.25, 9);
    expect(jackStudThicknessIn("plywood+int-2x4")).toBeCloseTo(2.25, 9);
    expect(jackStudThicknessIn("plywood+2x4")).toBeCloseTo(2.25, 9);
    /* The pre-existing replace mode is untouched. */
    expect(jackStudThicknessIn("2x4-stud")).toBeCloseTo(PLATE_2X4_THICKNESS_IN, 9);
  });

  it("⚠ the 2x4 stands INBOARD of the sheet, not on top of it", () => {
    /* The sheet is the piece screwed to the adjacent wall panel, so it keeps
       the slot edge and the stud takes the space toward the opening. Two
       solids cannot share a volume. */
    const members = buildJackStudMembers(DEPTH_IN, HEIGHT_IN, "plywood+2x4");
    const sheet = members.find((m) => m.memberId === "jack_stud_sheet")!;
    expect(sheet.position.xIn).toBe(0);
    for (const wythe of ["ext", "int"] as const) {
      const stud = members.find((m) => m.memberId === `jack_stud_2x4_${wythe}`)!;
      expect(stud.position.xIn).toBeCloseTo(JACK_STUD_THICKNESS_IN, 9);
    }
    /* Nothing overlaps, which is the standing rule. */
    expect(overlappingMemberPairs(members)).toEqual([]);
  });

  it("builds exactly the members each configuration names", () => {
    const ids = (config: Parameters<typeof buildJackStudMembers>[2]) =>
      buildJackStudMembers(DEPTH_IN, HEIGHT_IN, config).map((m) => m.memberId);
    expect(ids("plywood")).toEqual(["jack_stud_sheet"]);
    expect(ids("plywood+ext-2x4")).toEqual(["jack_stud_sheet", "jack_stud_2x4_ext"]);
    expect(ids("plywood+int-2x4")).toEqual(["jack_stud_sheet", "jack_stud_2x4_int"]);
    expect(ids("plywood+2x4")).toEqual(["jack_stud_sheet", "jack_stud_2x4_ext", "jack_stud_2x4_int"]);
    /* ⚠ The replace mode builds what it always did, in the same order and at
       the same x — a project drawn with it is unchanged. */
    expect(ids("2x4-stud")).toEqual(["jack_stud_2x4_ext", "jack_stud_2x4_int"]);
    for (const m of buildJackStudMembers(DEPTH_IN, HEIGHT_IN, "2x4-stud")) expect(m.position.xIn).toBe(0);
  });

  it("⚠ a thicker jack takes its difference out of the rough opening, on BOTH sides", () => {
    /* The reason this is not a cosmetic setting. A 48in slot loses 1 1/2in to
       the sheet alone and 4 1/2in once both sides carry a 2x4. */
    expect(computeRoughOpeningWidthIn(48, "plywood")).toBeCloseTo(46.5, 9);
    expect(computeRoughOpeningWidthIn(48, "plywood+2x4")).toBeCloseTo(43.5, 9);
  });

  it("every configuration is offered by the control, and each one is named", () => {
    expect(JACK_STUD_CONFIGS).toHaveLength(5);
    for (const config of JACK_STUD_CONFIGS) {
      expect({ config, label: jackStudConfigLabel(config).length > 0 }).toEqual({ config, label: true });
    }
    expect(jackStudConfigLabel("plywood+2x4")).toBe("3/4in plywood sheet + 2x4 at both wythes");
    expect(jackStudConfigLabel("2x4-stud")).toBe("2x4 at both wythes");
  });
});
