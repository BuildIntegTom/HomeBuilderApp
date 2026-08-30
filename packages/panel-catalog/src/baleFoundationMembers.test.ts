import { describe, expect, it } from "vitest";
import { buildFloorBottomSkinMembers, STEEL_MESH_THICKNESS_IN } from "./baleFoundationMembers";
import type { PanelMember } from "./componentSchema";
import { memberLocalCornersIn } from "./panelMemberHelpers";

/** View-space (Y-up) height extent of one member, via the same corner
 * helper the 3D renderer and the OBJ exporter both use — see "3D Member
 * Geometry — the two axis spaces" in building_integrity_app_spec.md. */
function viewSpaceYExtentIn(member: PanelMember): [number, number] {
  const ys = memberLocalCornersIn(member).map(([, y]) => y);
  return [Math.min(...ys), Math.max(...ys)];
}

/** The member's view-space min corner [x, y, z] — i.e. which axis a band
 * actually tiles along once converted. The Y extent alone cannot catch a
 * width/depth swap: writing the offset to `xIn` in the depth branch would
 * leave all three bands perfectly coplanar in Y while stacking them on top
 * of one another in Z. These lower bounds catch every wrong-axis variant,
 * not just the one that lifted the bands off the floor. */
function viewSpaceMinCornerIn(member: PanelMember): [number, number, number] {
  const corners = memberLocalCornersIn(member);
  return [
    Math.min(...corners.map((c) => c[0])),
    Math.min(...corners.map((c) => c[1])),
    Math.min(...corners.map((c) => c[2])),
  ];
}

describe("buildFloorBottomSkinMembers", () => {
  it("returns one full-footprint member when no bandPlan is given", () => {
    const members = buildFloorBottomSkinMembers(480, 240);
    expect(members).toHaveLength(1);
    expect(members[0]!.material).toBe("wire_mesh");
    expect(members[0]!.opacityOverride).toBeUndefined();
    expect(members[0]!.actualDimsIn).toEqual({ thicknessIn: STEEL_MESH_THICKNESS_IN, widthIn: 240, lengthIn: 480 });
    expect(members[0]!.position).toEqual({ xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0 });
  });

  it("splits into 3 equal bands along the width axis, opaque nearest the marker", () => {
    const members = buildFloorBottomSkinMembers(480, 240, { axis: "width", nearIsMax: false });
    expect(members).toHaveLength(3);
    expect(members.map((m) => m.opacityOverride)).toEqual([1, 0.75, 0.5]);
    members.forEach((m) => {
      expect(m.actualDimsIn.widthIn).toBe(240);
      expect(m.actualDimsIn.lengthIn).toBeCloseTo(160, 6);
      expect(m.position.yIn).toBe(0);
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
      // zIn is HEIGHT in member space — a depth-axis band that writes its
      // offset here floats above the floor instead of tiling across it.
      expect(m.position.zIn).toBe(0);
    });
    expect(members.map((m) => m.position.yIn)).toEqual([0, 160, 320]);
  });

  it("keeps depth-axis band positions unchanged when the marker sits at the axis max", () => {
    const members = buildFloorBottomSkinMembers(240, 480, { axis: "depth", nearIsMax: true });
    expect(members.map((m) => m.opacityOverride)).toEqual([0.5, 0.75, 1]);
    expect(members.map((m) => m.position.yIn)).toEqual([0, 160, 320]);
    members.forEach((m) => expect(m.position.zIn).toBe(0));
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

  it("covers the full depth span with no gap or overlap between bands", () => {
    const members = buildFloorBottomSkinMembers(300, 500, { axis: "depth", nearIsMax: false });
    let cursor = 0;
    for (const m of members) {
      expect(m.position.yIn).toBeCloseTo(cursor, 6);
      // A depth-axis band runs its full width along X and its band size along Y.
      cursor += m.actualDimsIn.widthIn;
    }
    expect(cursor).toBeCloseTo(500, 6);
  });

  it("puts every depth-axis band on one horizontal plane in view space", () => {
    const members = buildFloorBottomSkinMembers(240, 480, { axis: "depth", nearIsMax: false });
    const extents = members.map(viewSpaceYExtentIn);
    extents.forEach(([minY, maxY]) => {
      expect(minY).toBeCloseTo(0, 6);
      expect(maxY).toBeCloseTo(STEEL_MESH_THICKNESS_IN, 6);
    });
    expect(extents[1]).toEqual(extents[0]);
    expect(extents[2]).toEqual(extents[0]);
    // ...and tiles along view-space Z, the depth axis. Without this, an
    // offset mistakenly written to `xIn` would still pass every check above.
    expect(members.map((m) => viewSpaceMinCornerIn(m)[2])).toEqual([0, 160, 320]);
    expect(members.map((m) => viewSpaceMinCornerIn(m)[0])).toEqual([0, 0, 0]);
  });

  it("puts every width-axis band on one horizontal plane in view space", () => {
    const members = buildFloorBottomSkinMembers(480, 240, { axis: "width", nearIsMax: false });
    const extents = members.map(viewSpaceYExtentIn);
    // Asserted absolutely, not just mutually — same standard as the depth case.
    extents.forEach(([minY, maxY]) => {
      expect(minY).toBeCloseTo(0, 6);
      expect(maxY).toBeCloseTo(STEEL_MESH_THICKNESS_IN, 6);
    });
    expect(extents[1]).toEqual(extents[0]);
    expect(extents[2]).toEqual(extents[0]);
    // The mirror image: this branch tiles along view-space X, not Z.
    expect(members.map((m) => viewSpaceMinCornerIn(m)[0])).toEqual([0, 160, 320]);
    expect(members.map((m) => viewSpaceMinCornerIn(m)[2])).toEqual([0, 0, 0]);
  });

  it("degrades gracefully on a very shallow depth-axis footprint", () => {
    const members = buildFloorBottomSkinMembers(240, 1.5, { axis: "depth", nearIsMax: false });
    expect(members).toHaveLength(3);
    members.forEach((m) => {
      expect(Number.isFinite(m.position.yIn)).toBe(true);
      expect(m.position.yIn).toBeGreaterThanOrEqual(0);
      expect(m.position.zIn).toBe(0);
      expect(m.actualDimsIn.widthIn).toBeCloseTo(0.5, 6);
    });
    expect(members.map((m) => m.position.yIn)).toEqual([0, 0.5, 1]);
  });
});
