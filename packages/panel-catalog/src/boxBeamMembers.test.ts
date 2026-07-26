import { describe, expect, it } from "vitest";
import {
  BOX_BEAM_CAP_THICKNESS_IN,
  BOX_BEAM_LVL_HEIGHT_IN,
  BOX_BEAM_LVL_THICKNESS_IN,
  BOX_BEAM_SIZE_DEFAULT,
  BOX_BEAM_SIZE_OPTIONS,
  buildBoxBeamMembers,
  buildBoxBeamSchema,
  computeBoxBeamAssemblyHeightIn,
  computeDensePackCelluloseVolume,
} from "./boxBeamMembers";
import { memberBoxSizeIn } from "./panelMemberHelpers";

const LENGTH_IN = 200;
const DEPTH_IN = 15.5;

describe("buildBoxBeamMembers", () => {
  it("builds 2 LVL webs (9x2) and top/bottom plywood caps", () => {
    const members = buildBoxBeamMembers(LENGTH_IN, DEPTH_IN);
    expect(members).toHaveLength(4);
    const webs = members.filter((m) => m.nominalSize === "9x2 LVL");
    expect(webs).toHaveLength(2);
    for (const w of webs) {
      expect(w.actualDimsIn).toEqual({ thicknessIn: BOX_BEAM_LVL_THICKNESS_IN, widthIn: BOX_BEAM_LVL_HEIGHT_IN, lengthIn: LENGTH_IN });
    }
    const caps = members.filter((m) => m.material === "plywood");
    expect(caps).toHaveLength(2);
    for (const c of caps) {
      expect(c.actualDimsIn).toEqual({ thicknessIn: BOX_BEAM_CAP_THICKNESS_IN, widthIn: DEPTH_IN, lengthIn: LENGTH_IN });
    }
  });

  it("stacks bottom cap -> webs -> top cap with no gaps or overlaps", () => {
    const members = buildBoxBeamMembers(LENGTH_IN, DEPTH_IN);
    const bottom = members.find((m) => m.memberId === "box_beam_bottom_cap")!;
    const web = members.find((m) => m.memberId === "box_beam_lvl_exterior")!;
    const top = members.find((m) => m.memberId === "box_beam_top_cap")!;
    expect(bottom.position.zIn).toBeCloseTo(0, 6);
    expect(web.position.zIn).toBeCloseTo(BOX_BEAM_CAP_THICKNESS_IN, 6);
    expect(top.position.zIn).toBeCloseTo(BOX_BEAM_CAP_THICKNESS_IN + BOX_BEAM_LVL_HEIGHT_IN, 6);
  });

  it("places the two webs at the exterior and interior wythe edges", () => {
    const members = buildBoxBeamMembers(LENGTH_IN, DEPTH_IN);
    const ext = members.find((m) => m.memberId === "box_beam_lvl_exterior")!;
    const int = members.find((m) => m.memberId === "box_beam_lvl_interior")!;
    expect(ext.position.yIn).toBeCloseTo(0, 6);
    expect(int.position.yIn).toBeCloseTo(DEPTH_IN - BOX_BEAM_LVL_THICKNESS_IN, 6);
  });

  it("sizes correctly via the shared axis mapping (horizontal orientation)", () => {
    const members = buildBoxBeamMembers(LENGTH_IN, DEPTH_IN);
    const web = members.find((m) => m.memberId === "box_beam_lvl_exterior")!;
    const size = memberBoxSizeIn(web);
    expect(size.xIn).toBeCloseTo(LENGTH_IN, 6);
    expect(size.yIn).toBeCloseTo(BOX_BEAM_LVL_THICKNESS_IN, 6);
    expect(size.zIn).toBeCloseTo(BOX_BEAM_LVL_HEIGHT_IN, 6);
  });
});

describe("computeDensePackCelluloseVolume", () => {
  it("computes the hollow cavity between the two webs and its volume", () => {
    const result = computeDensePackCelluloseVolume(LENGTH_IN, DEPTH_IN);
    const expectedCavityWidthIn = DEPTH_IN - 2 * BOX_BEAM_LVL_THICKNESS_IN;
    expect(result.cavityWidthIn).toBeCloseTo(expectedCavityWidthIn, 6);
    expect(result.volumeFt3).toBeCloseTo((expectedCavityWidthIn * BOX_BEAM_LVL_HEIGHT_IN * LENGTH_IN) / 1728, 9);
  });

  it("floors the cavity at 0 if the webs would overlap (narrow depth)", () => {
    const result = computeDensePackCelluloseVolume(LENGTH_IN, 3);
    expect(result.cavityWidthIn).toBe(0);
    expect(result.volumeFt3).toBe(0);
  });
});

describe("buildBoxBeamSchema", () => {
  it("wraps the members with the shared schema envelope", () => {
    const schema = buildBoxBeamSchema(LENGTH_IN, DEPTH_IN);
    expect(schema.id).toBe("box_beam");
    expect(schema.members).toHaveLength(4);
  });
});

describe("BOX_BEAM_SIZE_OPTIONS (per-size builds)", () => {
  it("defaults to the 9x2 LVL size, matching the original hardcoded behavior exactly", () => {
    const withDefault = buildBoxBeamMembers(LENGTH_IN, DEPTH_IN);
    const explicit = buildBoxBeamMembers(LENGTH_IN, DEPTH_IN, BOX_BEAM_SIZE_DEFAULT);
    expect(withDefault).toEqual(explicit);
    expect(BOX_BEAM_SIZE_DEFAULT).toBe("9x2-lvl");
  });

  it.each(BOX_BEAM_SIZE_OPTIONS)("builds real, non-degenerate webs sized to $label ($id)", (size) => {
    const members = buildBoxBeamMembers(LENGTH_IN, DEPTH_IN, size.id);
    const webs = members.filter((m) => m.nominalSize === size.nominalSize);
    expect(webs).toHaveLength(2);
    for (const w of webs) {
      expect(w.speciesGrade).toBe(size.speciesGrade);
      expect(w.actualDimsIn).toEqual({ thicknessIn: size.webThicknessIn, widthIn: size.webHeightIn, lengthIn: LENGTH_IN });
      expect(w.actualDimsIn.thicknessIn).toBeGreaterThan(0);
      expect(w.actualDimsIn.widthIn).toBeGreaterThan(0);
    }
    const caps = members.filter((m) => m.material === "plywood");
    expect(caps).toHaveLength(2);
  });

  it.each(BOX_BEAM_SIZE_OPTIONS)("computes the correct overall assembly height for $label ($id)", (size) => {
    expect(computeBoxBeamAssemblyHeightIn(size.id)).toBeCloseTo(2 * BOX_BEAM_CAP_THICKNESS_IN + size.webHeightIn, 6);
  });

  it("dimensional-lumber sizes (2x8/2x10/2x12) use the same 1.5in actual thickness", () => {
    const dimensionalSizes = BOX_BEAM_SIZE_OPTIONS.filter((s) => s.id.endsWith("-dimensional"));
    expect(dimensionalSizes).toHaveLength(3);
    for (const size of dimensionalSizes) {
      expect(size.webThicknessIn).toBeCloseTo(1.5, 6);
    }
  });

  it("both LVL sizes keep the same 2in actual thickness, differing only in height", () => {
    const lvlSizes = BOX_BEAM_SIZE_OPTIONS.filter((s) => s.speciesGrade === "LVL");
    expect(lvlSizes).toHaveLength(2);
    for (const size of lvlSizes) {
      expect(size.webThicknessIn).toBe(2);
    }
    expect(new Set(lvlSizes.map((s) => s.webHeightIn)).size).toBe(2); // genuinely 2 distinct heights
  });

  it("computeDensePackCelluloseVolume scales the cavity height with the selected size", () => {
    const small = computeDensePackCelluloseVolume(LENGTH_IN, DEPTH_IN, "2x8-dimensional");
    const large = computeDensePackCelluloseVolume(LENGTH_IN, DEPTH_IN, "11.25x2-lvl");
    expect(large.volumeFt3).toBeGreaterThan(small.volumeFt3);
  });
});
