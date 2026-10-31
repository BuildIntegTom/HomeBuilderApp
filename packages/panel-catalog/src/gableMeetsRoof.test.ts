import { describe, expect, it } from "vitest";
import { buildGablePanelMembers } from "./gablePanelMembers";
import { roofTopAboveRooflineIn } from "./floorRoofPanelMembers";
import { PLATE_2X4_THICKNESS_IN, SKIN_THICKNESS_IN } from "./panelMemberHelpers";
import type { PanelMember } from "./componentSchema";

/**
 * ⚠ **THE GABLE'S TOP PLATE FINISHES FLUSH WITH THE ROOF'S TOP SURFACE.**
 *
 * > *"Let's get gable end panels top plate edge to be flush with the top of
 * > the roof panels. Some complex geometry involved perhaps."* — Tommy,
 * > 2026-10-31
 *
 * It took three passes, each looking plausible and none breaking a test:
 *
 *  1. the gable rose by the panel's DEPTH, short of its vertical thickness
 *     on any pitch;
 *  2. the gable rose by the plumb thickness but the roof's own anchor still
 *     used the depth, so the roof hung 0.84in below its own plane;
 *  3. both agreed, but inside the gable the top skin's face plane sat
 *     0.020in low and the 2x4 plate beneath it 0.081in into that skin —
 *     perpendicular offsets applied as if they were vertical.
 *
 * This file asserts the JUNCTION rather than either side of it.
 *
 * ⚠ **It measures face PLANES, not box corners, and the difference is not
 * pedantry.** `tiltedMember` models a sloped board as a square-ended box,
 * while the real part is plumb-cut at each end (see the rip callout on the
 * members themselves). So the modelled box's top corner sits slightly
 * INBOARD in x and therefore slightly low — correctly. What has to line up
 * with the roof is the plane the board's top face lies in.
 */

const DEPTH = 15.5;

/** Where a tilted member's TOP FACE plane sits, at a given panel x.
 *
 * ⚠ Offsetting a tilted board perpendicular by `d` raises the plane it lies
 * in by `d / cos(rake)` when read at a fixed x — not `d`, and not
 * `d x cos`. That one conversion is the whole of this bug. */
const topFacePlaneAtX = (m: PanelMember, xIn: number, rakeRad: number) =>
  m.position.zIn + (xIn - m.position.xIn) * Math.tan(rakeRad) + m.actualDimsIn.thicknessIn / 2 / Math.cos(rakeRad);

const underFacePlaneAtX = (m: PanelMember, xIn: number, rakeRad: number) =>
  m.position.zIn + (xIn - m.position.xIn) * Math.tan(rakeRad) - m.actualDimsIn.thicknessIn / 2 / Math.cos(rakeRad);

describe("⚠ where a gable end meets the roof above it", () => {
  for (const pitchIn12 of [0, 2, 4, 6, 12]) {
    describe(`at ${pitchIn12}:12`, () => {
      const widthIn = 48;
      const leftIn = 40;
      const rightIn = leftIn + (widthIn * pitchIn12) / 12;
      const rakeRad = Math.atan2(rightIn - leftIn, widthIn);
      const members = buildGablePanelMembers(widthIn, DEPTH, leftIn, rightIn, false);
      const skin = members.find((m) => m.memberId === "top_plate_skin")!;
      const plateExt = members.find((m) => m.memberId === "top_plate_2x4_ext")!;
      const plateInt = members.find((m) => m.memberId === "top_plate_2x4_int")!;

      it("⚠ the top skin's face plane lands exactly on the quoted edge heights", () => {
        /* Those heights ARE the roof's top surface once the tile is lifted,
           so anything off them is off the roof. Both ends, because a plane
           through one is not a plane through both. */
        expect(topFacePlaneAtX(skin, 0, rakeRad)).toBeCloseTo(leftIn, 9);
        expect(topFacePlaneAtX(skin, widthIn, rakeRad)).toBeCloseTo(rightIn, 9);
      });

      it("⚠ both 2x4 plates sit UNDER that skin — touching it, not inside it", () => {
        for (const plate of [plateExt, plateInt]) {
          expect(topFacePlaneAtX(plate, 0, rakeRad)).toBeCloseTo(underFacePlaneAtX(skin, 0, rakeRad), 9);
          expect(topFacePlaneAtX(plate, widthIn, rakeRad)).toBeCloseTo(underFacePlaneAtX(skin, widthIn, rakeRad), 9);
        }
      });

      it("⚠ the lift that puts the skin there is the roof's OWN plumb thickness", () => {
        const lift = roofTopAboveRooflineIn(DEPTH, pitchIn12);
        expect(lift).toBeCloseTo(DEPTH / Math.cos(Math.atan2(pitchIn12, 12)), 9);
        expect(lift).toBeGreaterThanOrEqual(DEPTH);
      });
    });
  }

  it("⚠ 4:12 on a 15 1/2in panel is 16 3/8in, which is the number to remember", () => {
    expect(roofTopAboveRooflineIn(15.5, 4)).toBeCloseTo(16.338, 3);
    // The shortfall it replaced, stated so nobody reintroduces it.
    expect(roofTopAboveRooflineIn(15.5, 4) - 15.5).toBeCloseTo(0.838, 3);
  });

  it("⚠ a flat roof is the one case where the lift IS the depth", () => {
    expect(roofTopAboveRooflineIn(DEPTH, 0)).toBeCloseTo(DEPTH, 9);
  });

  it("⚠ the three offsets are each a different conversion, which is why they were each wrong once", () => {
    /* Stated as arithmetic so the next person does not have to re-derive
       it. For a board on a 4:12 rake, 3/8in of half-thickness is:
         0.375        if you forget the rake entirely
         0.375 x cos  if you measure the board's own corner
         0.375 / cos  if you measure the PLANE its face lies in  <- this one */
    const cos = Math.cos(Math.atan2(4, 12));
    expect(SKIN_THICKNESS_IN / 2).toBeCloseTo(0.375, 9);
    expect((SKIN_THICKNESS_IN / 2) * cos).toBeCloseTo(0.3558, 4);
    expect(SKIN_THICKNESS_IN / 2 / cos).toBeCloseTo(0.3953, 4);
    expect(PLATE_2X4_THICKNESS_IN).toBeCloseTo(1.5, 9);
  });
});
