import { describe, expect, it } from "vitest";
import {
  buildTrussPlateMembers,
  buildTrussPlateSchema,
  computeTimberHpVolume,
  trussPlateTimberHpWidthIn,
} from "./trussPlateMembers";
import { memberBoxSizeIn } from "./panelMemberHelpers";

const LENGTH_IN = 200;
const DEPTH_IN = 15.5;

describe("buildTrussPlateMembers", () => {
  it("⚠ builds TWO 2x4 edges and a plywood cap spanning both", () => {
    /* His 2026-11-01 spec, superseding his own earlier "2x4 inside wyth and
       2x6 on outside wyth": *"two 2x4's and a default 8.5\" piece of timber
       HP insulation"*. */
    const members = buildTrussPlateMembers(LENGTH_IN, DEPTH_IN);
    expect(members).toHaveLength(3);
    const int2x4 = members.find((m) => m.memberId === "truss_plate_2x4_interior")!;
    const ext2x4 = members.find((m) => m.memberId === "truss_plate_2x4_exterior")!;
    const skin = members.find((m) => m.memberId === "truss_plate_skin")!;

    expect(int2x4.actualDimsIn).toEqual({ thicknessIn: 1.5, widthIn: 3.5, lengthIn: LENGTH_IN });
    expect(ext2x4.actualDimsIn).toEqual({ thicknessIn: 1.5, widthIn: 3.5, lengthIn: LENGTH_IN });
    expect(skin.actualDimsIn).toEqual({ thicknessIn: 0.75, widthIn: DEPTH_IN, lengthIn: LENGTH_IN });
    // The exterior 2x4 is flush with the wall's exterior face — that face is
    // where the roof panel's plumb leg comes down.
    expect(ext2x4.position.yIn).toBe(0);
    expect(int2x4.position.yIn).toBeCloseTo(DEPTH_IN - 3.5, 9);
  });

  it("sits the plywood cap on top of both edge members (same top elevation)", () => {
    const members = buildTrussPlateMembers(LENGTH_IN, DEPTH_IN);
    const int2x4 = members.find((m) => m.memberId === "truss_plate_2x4_interior")!;
    const ext2x4 = members.find((m) => m.memberId === "truss_plate_2x4_exterior")!;
    const skin = members.find((m) => m.memberId === "truss_plate_skin")!;
    expect(int2x4.position.zIn).toBeCloseTo(0, 6);
    expect(ext2x4.position.zIn).toBeCloseTo(0, 6);
    expect(skin.position.zIn).toBeCloseTo(1.5, 6); // top of both 1.5in-thick edge members
  });

  it("sizes correctly via the shared axis mapping", () => {
    const members = buildTrussPlateMembers(LENGTH_IN, DEPTH_IN);
    for (const m of members) {
      const size = memberBoxSizeIn(m);
      expect(size.xIn).toBeCloseTo(m.actualDimsIn.lengthIn, 6);
    }
  });

  it("⚠ the assembly is NOT deformed by the Roof tab's inset any more", () => {
    /* `trussPlateInsetIn` used to double as the exterior member's width, so
       changing where a truss bears also changed what the plate was made of.
       His *"the plate width is now basically the entire truss plate width"*
       unties them: the roof bears on the whole plate, and the plate is two
       2x4s whatever the inset says. The builder no longer takes one. */
    const a = buildTrussPlateMembers(LENGTH_IN, DEPTH_IN);
    const b = buildTrussPlateMembers(LENGTH_IN, DEPTH_IN);
    expect(a).toEqual(b);
    expect(buildTrussPlateMembers.length).toBe(2);
  });

  it("⚠ the two 2x4s and the cavity sum to the wall, exactly", () => {
    /* Dimensional tightness, and the check that makes his two sentences agree:
       two 2x4s in a 15 1/2in wall leave exactly the 8 1/2in of Timber HP he
       named. */
    expect(trussPlateTimberHpWidthIn(15.5)).toBeCloseTo(8.5, 9);
    for (const depthIn of [12, 14, 15.5, 18, 24]) {
      expect(3.5 + trussPlateTimberHpWidthIn(depthIn) + 3.5).toBeCloseTo(depthIn, 9);
    }
  });
});

describe("computeTimberHpVolume", () => {
  it("computes the gap width between the two 2x4s, and its volume", () => {
    const result = computeTimberHpVolume(LENGTH_IN, DEPTH_IN);
    const expectedGapWidthIn = DEPTH_IN - 3.5 - 3.5;
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
