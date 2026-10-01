import { describe, expect, it } from "vitest";
import {
  buildSafetyGapMembers,
  buildSafetyGapSchema,
  SAFETY_GAP_THICKNESS_IN,
  SAFETY_GAP_THIN_THICKNESS_IN,
  safetyGapPlySpecFor,
  safetyGapSheetThicknessIn,
} from "./safetyGapMembers";
import { GIRT_WEB_PLY_SPEC, memberBoxSizeIn, SKIN_PLY_SPEC } from "./panelMemberHelpers";

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

describe("the two-tier sheet (Tommy, 2026-09-30)", () => {
  it("builds a 1/2in 3-ply CDX sheet when asked for the narrow tier", () => {
    const members = buildSafetyGapMembers(DEPTH_IN, HEIGHT_IN, SAFETY_GAP_THIN_THICKNESS_IN);
    expect(members).toHaveLength(1);
    expect(members[0]!.actualDimsIn).toEqual({
      thicknessIn: SAFETY_GAP_THIN_THICKNESS_IN,
      widthIn: DEPTH_IN,
      lengthIn: HEIGHT_IN,
    });
    // The plySpec FOLLOWS the thickness — a 1/2in board labelled 3/4in_5ply_CDX
    // is a sheet ordered wrong.
    expect(members[0]!.plySpec).toBe(GIRT_WEB_PLY_SPEC);
  });

  it("defaults to the 3/4in 5-ply sheet, so every existing caller is unchanged", () => {
    expect(buildSafetyGapMembers(DEPTH_IN, HEIGHT_IN)[0]!.plySpec).toBe(SKIN_PLY_SPEC);
    expect(buildSafetyGapMembers(DEPTH_IN, HEIGHT_IN)[0]!.actualDimsIn.thicknessIn).toBe(SAFETY_GAP_THICKNESS_IN);
  });

  it("uses the two specs that already existed — it invents no new sheet", () => {
    // Named explicitly: these are the standard panel's own skin and girt-web
    // specs. ⚠ They differ in PLY COUNT as well as thickness.
    expect(SKIN_PLY_SPEC).toBe("3/4in_5ply_CDX");
    expect(GIRT_WEB_PLY_SPEC).toBe("1/2in_3ply_CDX");
    expect(safetyGapPlySpecFor(0.75)).toBe(SKIN_PLY_SPEC);
    expect(safetyGapPlySpecFor(0.5)).toBe(GIRT_WEB_PLY_SPEC);
  });

  it("maps a reserved slot width onto a real sheet, including the two widths that are not their own thickness", () => {
    // The ordinary pair.
    expect(safetyGapSheetThicknessIn(0.75)).toBe(SAFETY_GAP_THICKNESS_IN);
    expect(safetyGapSheetThicknessIn(0.5)).toBe(SAFETY_GAP_THIN_THICKNESS_IN);
    // A COMBINED corner-brace slot: a standard width plus the plywood buffer.
    expect(safetyGapSheetThicknessIn(40.75)).toBe(SAFETY_GAP_THICKNESS_IN);
    // A slot CLAMPED by openings eating the wall's middle — it still gets a whole
    // real sheet of a real spec rather than an invented 1/4in one.
    expect(safetyGapSheetThicknessIn(0.25)).toBe(SAFETY_GAP_THIN_THICKNESS_IN);
    expect(safetyGapPlySpecFor(safetyGapSheetThicknessIn(0.25))).toBe(GIRT_WEB_PLY_SPEC);
  });

  it("both tiers are whole eighths, like every other dimension the shop cuts to", () => {
    for (const t of [SAFETY_GAP_THICKNESS_IN, SAFETY_GAP_THIN_THICKNESS_IN]) {
      expect(Math.abs(t * 8 - Math.round(t * 8))).toBeLessThan(1e-9);
    }
    // And the narrow tier really is narrower, which is what makes
    // safetyGapSheetThicknessIn's floor comparison meaningful.
    expect(SAFETY_GAP_THIN_THICKNESS_IN).toBeLessThan(SAFETY_GAP_THICKNESS_IN);
  });
});

describe("buildSafetyGapSchema", () => {
  it("wraps the member with the shared schema envelope", () => {
    const schema = buildSafetyGapSchema(DEPTH_IN, HEIGHT_IN);
    expect(schema.id).toBe("safety_gap");
    expect(schema.members).toHaveLength(1);
    expect(schema.overallDimensions.widthIn).toBe(SAFETY_GAP_THICKNESS_IN);
  });

  it("carries the narrow tier through to overallDimensions as well as to the member", () => {
    const schema = buildSafetyGapSchema(DEPTH_IN, HEIGHT_IN, SAFETY_GAP_THIN_THICKNESS_IN);
    expect(schema.overallDimensions.widthIn).toBe(SAFETY_GAP_THIN_THICKNESS_IN);
    expect(schema.members[0]!.actualDimsIn.thicknessIn).toBe(SAFETY_GAP_THIN_THICKNESS_IN);
  });
});
