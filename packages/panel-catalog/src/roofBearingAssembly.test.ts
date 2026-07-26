import { describe, expect, it } from "vitest";
import { BOX_BEAM_SIZE_OPTIONS, computeBoxBeamAssemblyHeightIn } from "./boxBeamMembers";
import {
  computeBoxBeamHeightDeltaIn,
  computeRoofBearingAssemblyHeightIn,
  computeSharedRooflineBearingHeightIn,
} from "./roofBearingAssembly";
import { PLATE_2X6_THICKNESS_IN } from "./trussPlateMembers";

describe("computeSharedRooflineBearingHeightIn", () => {
  it("always equals the Truss Plate's own assembly height, matching computeRoofBearingAssemblyHeightIn(false)", () => {
    expect(computeSharedRooflineBearingHeightIn()).toBeCloseTo(computeRoofBearingAssemblyHeightIn(false), 6);
    expect(computeSharedRooflineBearingHeightIn()).toBeCloseTo(PLATE_2X6_THICKNESS_IN + 0.75, 6);
  });
});

describe("computeBoxBeamHeightDeltaIn", () => {
  it("is always >= 0 for every box-beam size — every size is taller than a Truss Plate", () => {
    for (const size of BOX_BEAM_SIZE_OPTIONS) {
      expect(computeBoxBeamHeightDeltaIn(size.id)).toBeGreaterThanOrEqual(0);
    }
  });

  it("equals the box-beam assembly height minus the shared (Truss Plate) roofline height", () => {
    for (const size of BOX_BEAM_SIZE_OPTIONS) {
      const expectedDeltaIn = computeBoxBeamAssemblyHeightIn(size.id) - computeSharedRooflineBearingHeightIn();
      expect(computeBoxBeamHeightDeltaIn(size.id)).toBeCloseTo(expectedDeltaIn, 6);
    }
  });

  it("computes the exact known delta for the default 9x2 LVL size", () => {
    // (2*0.75 + 9) - (1.5 + 0.75) = 10.5 - 2.25 = 8.25in
    expect(computeBoxBeamHeightDeltaIn("9x2-lvl")).toBeCloseTo(8.25, 6);
  });

  it("a taller box-beam size (11-1/4in LVL) has a larger delta than the default 9in LVL", () => {
    expect(computeBoxBeamHeightDeltaIn("11.25x2-lvl")).toBeGreaterThan(computeBoxBeamHeightDeltaIn("9x2-lvl"));
  });
});
