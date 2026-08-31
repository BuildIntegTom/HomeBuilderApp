import { describe, expect, it } from "vitest";
import { buildFloorBottomSkinMembers, STEEL_MESH_THICKNESS_IN, type FloorSkinPiece } from "./baleFoundationMembers";
import type { PanelMember, PlanSpacePoint2D } from "./componentSchema";
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
 * width/depth swap: writing a band's offset into the wrong plan axis would
 * leave every band perfectly coplanar in Y while stacking them on top of one
 * another in Z. These lower bounds catch every wrong-axis variant, not just
 * the one that lifted the bands off the floor. */
function viewSpaceMinCornerIn(member: PanelMember): [number, number, number] {
  const corners = memberLocalCornersIn(member);
  return [
    Math.min(...corners.map((c) => c[0])),
    Math.min(...corners.map((c) => c[1])),
    Math.min(...corners.map((c) => c[2])),
  ];
}

/** An axis-aligned rectangular piece, i.e. what a plain rectangular
 * footprint's own bands still are. */
function rectPiece(bandIndex: number | undefined, pieceIndex: number, x0: number, y0: number, x1: number, y1: number): FloorSkinPiece {
  return {
    bandIndex,
    pieceIndex,
    cornersIn: [
      { xIn: x0, yIn: y0 },
      { xIn: x1, yIn: y0 },
      { xIn: x1, yIn: y1 },
      { xIn: x0, yIn: y1 },
    ],
  };
}

/** 3 bands tiling a 480 x 240 floor along the WIDTH axis. */
function widthAxisBands(): FloorSkinPiece[] {
  return [rectPiece(0, 0, 0, 0, 160, 240), rectPiece(1, 0, 160, 0, 320, 240), rectPiece(2, 0, 320, 0, 480, 240)];
}

/** 3 bands tiling a 240 x 480 floor along the DEPTH axis — the branch that
 * once shipped broken (bands lifted into the air instead of tiled across
 * the floor), so it is asserted at the same standard as the width one. */
function depthAxisBands(): FloorSkinPiece[] {
  return [rectPiece(0, 0, 0, 0, 240, 160), rectPiece(1, 0, 0, 160, 240, 320), rectPiece(2, 0, 0, 320, 240, 480)];
}

describe("buildFloorBottomSkinMembers", () => {
  it("returns one uniform, fully-opaque member when a piece carries no bandIndex", () => {
    const members = buildFloorBottomSkinMembers([rectPiece(undefined, 0, 0, 0, 480, 240)]);
    expect(members).toHaveLength(1);
    expect(members[0]!.memberId).toBe("floor_bottom_skin");
    expect(members[0]!.material).toBe("wire_mesh");
    expect(members[0]!.opacityOverride).toBeUndefined();
    expect(members[0]!.actualDimsIn).toEqual({ thicknessIn: STEEL_MESH_THICKNESS_IN, widthIn: 240, lengthIn: 480 });
    expect(members[0]!.position.zIn).toBe(0);
  });

  it("assigns opacity straight off bandIndex — 0 is the opaque band, nearest the marker", () => {
    const members = buildFloorBottomSkinMembers(widthAxisBands());
    expect(members).toHaveLength(3);
    expect(members.map((m) => m.opacityOverride)).toEqual([1, 0.75, 0.5]);
    expect(members.map((m) => m.memberId)).toEqual([
      "floor_bottom_skin_band_0_0",
      "floor_bottom_skin_band_1_0",
      "floor_bottom_skin_band_2_0",
    ]);
    // The note's prose and the id index now agree: both count from the
    // marker. (Before, under nearIsMax the id said band_0 for the band
    // FARTHEST from the marker while the note claimed it radiated from it.)
    expect(members[0]!.notes).toContain("band 1 of 3");
    expect(members[0]!.notes).toContain("100% opacity");
    expect(members[2]!.notes).toContain("band 3 of 3");
    expect(members[2]!.notes).toContain("50% opacity");
  });

  it("takes its real shape from the ring, not from a bounding box — an L piece stays an L", () => {
    const lRing: PlanSpacePoint2D[] = [
      { xIn: 0, yIn: 0 },
      { xIn: 120, yIn: 0 },
      { xIn: 120, yIn: 60 },
      { xIn: 60, yIn: 60 },
      { xIn: 60, yIn: 120 },
      { xIn: 0, yIn: 120 },
    ];
    const [member] = buildFloorBottomSkinMembers([{ bandIndex: 0, pieceIndex: 0, cornersIn: lRing }]);
    expect(member!.position.planPolygonCornersIn).toEqual(lRing);
    expect(member!.position.trapezoidCornersIn).toBeUndefined(); // never both
    const corners = memberLocalCornersIn(member!);
    expect(corners).toHaveLength(2 * lRing.length);
    // The reflex corner is really in the geometry — a bounding box has no
    // vertex at (60, 60).
    expect(corners.some(([x, , z]) => x === 60 && z === 60)).toBe(true);
    // actualDimsIn is still the piece's plan bounding box, for consumers
    // that read dims rather than corners.
    expect(member!.actualDimsIn).toEqual({ thicknessIn: STEEL_MESH_THICKNESS_IN, widthIn: 120, lengthIn: 120 });
  });

  it("gives every piece of one band that band's own opacity, with distinct ids", () => {
    const split = [rectPiece(0, 0, 0, 0, 100, 160), rectPiece(0, 1, 200, 0, 300, 160), rectPiece(1, 0, 0, 160, 300, 320)];
    const members = buildFloorBottomSkinMembers(split);
    expect(members.map((m) => m.opacityOverride)).toEqual([1, 1, 0.75]);
    expect(members.map((m) => m.memberId)).toEqual([
      "floor_bottom_skin_band_0_0",
      "floor_bottom_skin_band_0_1",
      "floor_bottom_skin_band_1_0",
    ]);
    expect(new Set(members.map((m) => m.memberId)).size).toBe(3);
  });

  it("puts every depth-axis band on one horizontal plane in view space", () => {
    const members = buildFloorBottomSkinMembers(depthAxisBands());
    const extents = members.map(viewSpaceYExtentIn);
    extents.forEach(([minY, maxY]) => {
      expect(minY).toBeCloseTo(0, 6);
      expect(maxY).toBeCloseTo(STEEL_MESH_THICKNESS_IN, 6);
    });
    expect(extents[1]).toEqual(extents[0]);
    expect(extents[2]).toEqual(extents[0]);
    // ...and tiles along view-space Z, the depth axis. Without this, an
    // offset mistakenly written to the X axis would still pass every check
    // above.
    expect(members.map((m) => viewSpaceMinCornerIn(m)[2])).toEqual([0, 160, 320]);
    expect(members.map((m) => viewSpaceMinCornerIn(m)[0])).toEqual([0, 0, 0]);
  });

  it("puts every width-axis band on one horizontal plane in view space", () => {
    const members = buildFloorBottomSkinMembers(widthAxisBands());
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

  it("stays coplanar for irregular, disconnected pieces too — zIn is height, never a depth offset", () => {
    const irregular: FloorSkinPiece[] = [
      { bandIndex: 0, pieceIndex: 0, cornersIn: [{ xIn: 0, yIn: 0 }, { xIn: 90, yIn: 30 }, { xIn: 40, yIn: 110 }] },
      { bandIndex: 0, pieceIndex: 1, cornersIn: [{ xIn: 300, yIn: 200 }, { xIn: 380, yIn: 210 }, { xIn: 350, yIn: 260 }] },
      rectPiece(1, 0, 0, 160, 240, 320),
    ];
    const members = buildFloorBottomSkinMembers(irregular);
    for (const m of members) {
      expect(m.position.zIn).toBe(0);
      const [minY, maxY] = viewSpaceYExtentIn(m);
      expect(minY).toBeCloseTo(0, 6);
      expect(maxY).toBeCloseTo(STEEL_MESH_THICKNESS_IN, 6);
    }
  });

  it("covers the full span with no gap or overlap between adjacent bands", () => {
    const members = buildFloorBottomSkinMembers(widthAxisBands());
    let cursor = 0;
    for (const m of members) {
      const xs = memberLocalCornersIn(m).map(([x]) => x);
      expect(Math.min(...xs)).toBeCloseTo(cursor, 6);
      cursor = Math.max(...xs);
    }
    expect(cursor).toBeCloseTo(480, 6);
  });

  it("returns nothing at all for an empty piece list", () => {
    expect(buildFloorBottomSkinMembers([])).toEqual([]);
  });
});
