import { describe, expect, it } from "vitest";
import { buildFloorBottomSkinMembers, STEEL_MESH_THICKNESS_IN } from "./baleFoundationMembers";

describe("buildFloorBottomSkinMembers", () => {
  it("returns one full-footprint member when no bandPlan is given", () => {
    const members = buildFloorBottomSkinMembers(480, 240);
    expect(members).toHaveLength(1);
    expect(members[0]!.material).toBe("wire_mesh");
    expect(members[0]!.opacityOverride).toBeUndefined();
    expect(members[0]!.actualDimsIn).toEqual({ thicknessIn: STEEL_MESH_THICKNESS_IN, widthIn: 240, lengthIn: 480 });
  });

  it("splits into 3 equal bands along the width axis, opaque nearest the marker", () => {
    const members = buildFloorBottomSkinMembers(480, 240, { axis: "width", nearIsMax: false });
    expect(members).toHaveLength(3);
    expect(members.map((m) => m.opacityOverride)).toEqual([1, 0.75, 0.5]);
    members.forEach((m) => {
      expect(m.actualDimsIn.widthIn).toBe(240);
      expect(m.actualDimsIn.lengthIn).toBeCloseTo(160, 6);
      expect(m.position.zIn).toBe(0);
    });
    expect(members.map((m) => m.position.xIn)).toEqual([0, 160, 320]);
  });

  it("reverses band order when the marker sits at the axis max", () => {
    const members = buildFloorBottomSkinMembers(480, 240, { axis: "width", nearIsMax: true });
    expect(members.map((m) => m.opacityOverride)).toEqual([0.5, 0.75, 1]);
  });

  it("splits into 3 equal bands along the depth axis instead", () => {
    const members = buildFloorBottomSkinMembers(240, 480, { axis: "depth", nearIsMax: false });
    expect(members).toHaveLength(3);
    expect(members.map((m) => m.opacityOverride)).toEqual([1, 0.75, 0.5]);
    members.forEach((m) => {
      expect(m.actualDimsIn.lengthIn).toBe(240);
      expect(m.actualDimsIn.widthIn).toBeCloseTo(160, 6);
      expect(m.position.xIn).toBe(0);
    });
    expect(members.map((m) => m.position.zIn)).toEqual([0, 160, 320]);
  });

  it("covers the full span with no gap or overlap between bands", () => {
    const members = buildFloorBottomSkinMembers(500, 300, { axis: "width", nearIsMax: false });
    let cursor = 0;
    for (const m of members) {
      expect(m.position.xIn).toBeCloseTo(cursor, 6);
      cursor += m.actualDimsIn.lengthIn;
    }
    expect(cursor).toBeCloseTo(500, 6);
  });
});
