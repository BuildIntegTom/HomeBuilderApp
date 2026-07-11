import { describe, expect, it } from "vitest";
import {
  BOX_BEAM_CAP_THICKNESS_IN,
  BOX_BEAM_LVL_HEIGHT_IN,
  BOX_BEAM_LVL_THICKNESS_IN,
  buildBoxBeamMembers,
  buildBoxBeamSchema,
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
