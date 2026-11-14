import { describe, expect, it } from "vitest";
import {
  buildGablePeakPanelMembers,
  buildGablePeakTopMembers,
  gablePeakAssemblyUndersideAtXIn,
  gablePeakBeamTopBelowRooflineForPitchIn,
  gablePeakBeamTopBelowRooflineIn,
  gablePeakHasFiveSidedTop,
  gablePeakSlotForPanel,
  gablePeakTopSurfaceAtXIn,
  GABLE_PEAK_BEAM_TOP_BELOW_PANEL_TOP_IN,
  type GablePeakTopProfile,
} from "./gablePeakPanelMembers";
import { COLUMN_SIDE_PLY_THICKNESS_IN, COLUMN_TOTAL_WIDTH_IN, buildColumnStyleMembers } from "./columnPanelMembers";
import { buildCornerPanelMembers } from "./cornerPanelMembers";
import { overlappingMemberPairs } from "./memberPrism";
import type { PanelMember } from "./componentSchema";
import { memberBoxIn, PLATE_END_CLEARANCE_IN } from "./panelMemberHelpers";

const DEPTH_IN = 15.5;
const WIDTH_IN = COLUMN_TOTAL_WIDTH_IN; // 25.5
const EDGE_TOP_IN = 48;
const PITCHES = [2, 3, 4, 6, 8, 12];

/**
 * ⚠ **A BOUNDING BOX CANNOT SEE A SLOPED BOARD** — the `trapezoidCornersIn`
 * ARE the board. The same lesson `gablePeakPanelTop.test.ts` and
 * `floorRoofPanelMembers.test.ts` each record, learned three times now.
 */
const zsOf = (m: PanelMember): number[] => {
  const corners = m.position.trapezoidCornersIn;
  if (corners) return corners.map((p) => p.zIn);
  const box = memberBoxIn(m);
  return [box.zFromIn, box.zToIn];
};
const xsOf = (m: PanelMember): number[] => {
  const corners = m.position.trapezoidCornersIn;
  if (corners) return corners.map((p) => p.xIn);
  const box = memberBoxIn(m);
  return [box.xFromIn, box.xToIn];
};
/** A raked board's own TOP edge at one of its two x positions, read off its
 * real corners rather than from any box. */
const topZAtXIn = (m: PanelMember, xIn: number): number => {
  const corners = m.position.trapezoidCornersIn!;
  const lowestIn = Math.min(...corners.map((p) => p.zIn));
  const match = corners.filter((p) => p.zIn > lowestIn + 1e-9).find((p) => Math.abs(p.xIn - xIn) < 1e-6);
  return match!.zIn;
};

const riseForPitch = (pitchIn12: number) => (WIDTH_IN / 2) * (pitchIn12 / 12);
const symmetricTop = (pitchIn12: number): GablePeakTopProfile => ({
  apexOffsetXIn: WIDTH_IN / 2,
  leftRiseIn: 0,
  apexRiseIn: riseForPitch(pitchIn12),
  rightRiseIn: 0,
});
const build = (top?: GablePeakTopProfile, edgeTopIn = EDGE_TOP_IN) =>
  buildGablePeakPanelMembers(DEPTH_IN, edgeTopIn, false, undefined, WIDTH_IN, 0, top);
const byId = (members: PanelMember[], id: string) => members.find((m) => m.memberId === id);

describe("the Gable Peak Panel's ONE shared top assembly", () => {
  /* The blocker stage 1 stopped at, and why this file exists:

     > *"this Gable column panel would be five-sided, or I guess technically
     > seven-sided including the inside and outside faces. The top lid would
     > be very weird and two pieces and that's fine."* — Tommy, 2026-11-13

     A five-sided panel cannot be composed from a finished column plus a
     finished cap, because each prefab piece carries its own skins. Stacked,
     the joint holds two 3/4in sheets of plywood; with the cap's own dropped,
     it holds a 3/4in void. Both were measured. The band version measured
     worse still: the cap's bottom plate and its own sloped top plate landed
     in the same 2.25in of space at each outer edge, a full overlap, with a
     1.33in offcut of corner stud between them.

     So the body brings no top assembly at all and the one above spans the
     whole panel. */

  it("the body brings NO top assembly of its own — the double skin and the void are both gone", () => {
    for (const pitch of PITCHES) {
      const members = build(symmetricTop(pitch));
      /* Not one of the three, at any pitch. Their presence IS the double
         skin: the shared assembly above lands in exactly their space. */
      for (const id of ["top_plate_skin", "top_plate_2x4_ext", "top_plate_2x4_int"]) {
        expect(byId(members, id), `pitch ${pitch}:12 — ${id}`).toBeUndefined();
      }
      /* The bottom assembly is untouched, which is what makes this a change
         to the TOP of the panel and to nothing else. */
      for (const id of ["bottom_plate_skin", "bottom_plate_2x4_ext", "bottom_plate_2x4_int"]) {
        expect(byId(members, id), `pitch ${pitch}:12 — ${id}`).toBeDefined();
      }
    }
  });

  it("his two pieces of lid, one plate pair per slope, and nothing else above the body", () => {
    const cap = buildGablePeakTopMembers(WIDTH_IN, DEPTH_IN, EDGE_TOP_IN, symmetricTop(4));
    expect(cap.map((m) => m.memberId).sort()).toEqual([
      "cap_left_top_plate_2x4_ext",
      "cap_left_top_plate_2x4_int",
      "cap_left_top_plate_skin",
      "cap_right_top_plate_2x4_ext",
      "cap_right_top_plate_2x4_int",
      "cap_right_top_plate_skin",
    ]);
  });

  it("THE JOINT IS TIGHT TO ZERO — every corner stud lands exactly on the assembly's underside", () => {
    /* This is the 0.12in that was not acceptable just because it was small.
       Filtering the body's three top members out and leaving everything else
       alone would have left its studs stopping at `height - 2.25` while a
       plumb-cut assembly on a 4:12 slope wants `height - 2.372`. Reading the
       studs off the real underside closes it at every pitch, not at one. */
    for (const pitch of PITCHES) {
      const top = symmetricTop(pitch);
      const members = build(top);
      const undersideAtXIn = gablePeakAssemblyUndersideAtXIn(WIDTH_IN, EDGE_TOP_IN, top);
      for (const id of ["stud_corner_1", "stud_corner_2", "stud_corner_3", "stud_corner_4"]) {
        const stud = byId(members, id)!;
        const corners = stud.position.trapezoidCornersIn!;
        /* Each of the stud's two top corners, read at its own x — a 1 1/2in
           stud picks up half an inch of rise across itself at 4:12. */
        for (const xIn of [Math.min(...corners.map((p) => p.xIn)), Math.max(...corners.map((p) => p.xIn))]) {
          expect(topZAtXIn(stud, xIn), `pitch ${pitch}:12 — ${id} at x ${xIn}`).toBeCloseTo(undersideAtXIn(xIn), 9);
        }
      }
    }
  });

  it("the side plywood faces are raked, and finish flush with the panel's own top surface", () => {
    /* Left flat, each face stopped at the panel's lower edge while the
       surface above it kept rising — a wedge of missing plywood 0.25in deep
       at 4:12. Small, real, and exactly what the dimensional-tightness rule
       is about. */
    for (const pitch of PITCHES) {
      const top = symmetricTop(pitch);
      const members = build(top);
      const surfaceAtXIn = gablePeakTopSurfaceAtXIn(WIDTH_IN, EDGE_TOP_IN, top);
      for (const id of ["side_ply_left", "side_ply_right"]) {
        const ply = byId(members, id)!;
        const corners = ply.position.trapezoidCornersIn!;
        for (const xIn of [Math.min(...corners.map((p) => p.xIn)), Math.max(...corners.map((p) => p.xIn))]) {
          expect(topZAtXIn(ply, xIn), `pitch ${pitch}:12 — ${id} at x ${xIn}`).toBeCloseTo(surfaceAtXIn(xIn), 9);
        }
      }
    }
  });

  it("the lid spans the CORE and the side faces span the rest — one layer of plywood everywhere", () => {
    /* A lid laid across the full 25.5in would sit on top of both side faces:
       3/4in x the panel's depth of plywood in the same place twice, at each
       side. A flat column has never been built that way — its top skin covers
       the 24in core and the two faces run past it to the panel's own top. */
    const members = build(symmetricTop(4));
    const lids = members.filter((m) => m.memberId.endsWith("top_plate_skin"));
    expect(lids).toHaveLength(2);
    expect(Math.min(...lids.flatMap(xsOf))).toBeCloseTo(COLUMN_SIDE_PLY_THICKNESS_IN, 9);
    expect(Math.max(...lids.flatMap(xsOf))).toBeCloseTo(WIDTH_IN - COLUMN_SIDE_PLY_THICKNESS_IN, 9);
    /* The two meet at the ridge and overlap nowhere. */
    expect(Math.max(...xsOf(byId(members, "cap_left_top_plate_skin")!))).toBeCloseTo(WIDTH_IN / 2, 9);
    expect(Math.min(...xsOf(byId(members, "cap_right_top_plate_skin")!))).toBeCloseTo(WIDTH_IN / 2, 9);
  });

  it("THE PLATES RUN ALL THE WAY TO THE RIDGE — no 3in unplated gap over the furring box", () => {
    /* `buildGablePanelMembers` insets its top plates `PLATE_END_CLEARANCE_IN`
       at BOTH ends, which is right where a corner stud stands and wrong at the
       ridge, where nothing stands. Left alone it opens a 3in hole in the top
       plate directly over the box the ridge beam drops into — the one place on
       this panel where the load from both roof planes arrives. */
    for (const pitch of PITCHES) {
      const top = symmetricTop(pitch);
      const members = build(top);
      for (const wythe of ["ext", "int"] as const) {
        const leftPlate = byId(members, `cap_left_top_plate_2x4_${wythe}`)!;
        const rightPlate = byId(members, `cap_right_top_plate_2x4_${wythe}`)!;
        expect(Math.max(...xsOf(leftPlate)), `pitch ${pitch}:12`).toBeCloseTo(top.apexOffsetXIn, 9);
        expect(Math.min(...xsOf(rightPlate)), `pitch ${pitch}:12`).toBeCloseTo(top.apexOffsetXIn, 9);
        /* Still inset at the panel's own two ends, where the studs are. */
        expect(Math.min(...xsOf(leftPlate))).toBeCloseTo(COLUMN_SIDE_PLY_THICKNESS_IN + PLATE_END_CLEARANCE_IN, 9);
        expect(Math.max(...xsOf(rightPlate))).toBeCloseTo(WIDTH_IN - COLUMN_SIDE_PLY_THICKNESS_IN - PLATE_END_CLEARANCE_IN, 9);
      }
    }
  });

  it("the ridge is the panel's tallest point, to zero, at every pitch", () => {
    for (const pitch of PITCHES) {
      const top = symmetricTop(pitch);
      const members = build(top);
      expect(Math.max(...members.flatMap(zsOf)), `pitch ${pitch}:12`).toBeCloseTo(EDGE_TOP_IN + top.apexRiseIn, 9);
    }
  });

  it("it adds NO overlapping pair the flat-topped panel did not already have", () => {
    /* [[no_overlapping_members]], his 2026-10-23 standing rule. The
       girt-x-blocking pairs that remain are a plain Column Panel's own, at
       the same heights, and are one of the five causes still open on that
       audit — not something this shape introduced. Measured: the five-sided
       panel reports FEWER than the flat-topped one it replaces at most
       pitches, and never a new kind. */
    const bare = (pair: string) => pair.replace(/_\d+(?= x |$)/g, "");
    for (const pitch of PITCHES) {
      const top = symmetricTop(pitch);
      const before = new Set(overlappingMemberPairs(build(undefined, EDGE_TOP_IN + top.apexRiseIn)).map(bare));
      const after = overlappingMemberPairs(build(top)).map(bare);
      expect(after.filter((p) => !before.has(p)), `pitch ${pitch}:12`).toEqual([]);
    }
  });

  it("the furring box hangs under the SLOPED plate, not 2.25in under a flat one", () => {
    /* The box is 6 1/2in wide and the plate above it is on a slope, so its lid
       has to clear that plate at whichever of its two edges the plate is lower
       over. Hanging it from the old flat arithmetic drove the lid up into the
       plate. */
    for (const pitch of PITCHES) {
      const top = symmetricTop(pitch);
      const members = build(top);
      const slot = gablePeakSlotForPanel(WIDTH_IN, EDGE_TOP_IN, 0, top);
      const undersideAtXIn = gablePeakAssemblyUndersideAtXIn(WIDTH_IN, EDGE_TOP_IN, top);
      const lid = byId(members, "gable_peak_box_lid")!;
      const lidTopIn = Math.max(...zsOf(lid));
      expect(lidTopIn, `pitch ${pitch}:12`).toBeCloseTo(slot.boxToZIn, 9);
      /* Flush with the plate's underside at the box's low edge — touching,
         never through, at either edge. */
      const lowEdgeXIn = Math.min(...xsOf(lid));
      expect(lidTopIn, `pitch ${pitch}:12`).toBeCloseTo(undersideAtXIn(lowEdgeXIn), 9);
      for (const xIn of [lowEdgeXIn, Math.max(...xsOf(lid))]) {
        expect(lidTopIn, `pitch ${pitch}:12 at x ${xIn}`).toBeLessThanOrEqual(undersideAtXIn(xIn) + 1e-9);
      }
      /* And it still has every part this panel exists for. */
      expect(members.filter((m) => m.memberId.startsWith("gable_peak_box_"))).toHaveLength(4);
      expect(members.filter((m) => m.memberId.startsWith("gable_peak_pack_"))).toHaveLength(4);
    }
  });

  it("the DRAWN beam reads the same box the members are built from", () => {
    /* A second copy of this arithmetic in the renderer is how the view and the
       shop drawings come to describe different buildings — the fault B9 was
       fixing when it found the beam floating 0.75in. */
    expect(gablePeakBeamTopBelowRooflineIn(WIDTH_IN)).toBeCloseTo(GABLE_PEAK_BEAM_TOP_BELOW_PANEL_TOP_IN, 9);
    for (const pitch of PITCHES) {
      const top = symmetricTop(pitch);
      /* The pitch-only form the 3D view uses, against the real profile. */
      expect(gablePeakBeamTopBelowRooflineForPitchIn(pitch, WIDTH_IN), `pitch ${pitch}:12`).toBeCloseTo(
        gablePeakBeamTopBelowRooflineIn(WIDTH_IN, top),
        9,
      );
      /* It is no longer the flat constant, and it only ever goes DOWN: a box
         cannot hang higher under a slope than under a level plate. */
      expect(gablePeakBeamTopBelowRooflineIn(WIDTH_IN, top), `pitch ${pitch}:12`).toBeGreaterThan(
        GABLE_PEAK_BEAM_TOP_BELOW_PANEL_TOP_IN,
      );
    }
    /* 4.455in at 4:12 against 3.25in flat: 2.372in of assembly, plus 1.083in
       of slope across the box's own half-width. */
    expect(gablePeakBeamTopBelowRooflineForPitchIn(4, WIDTH_IN)).toBeCloseTo(4.455, 3);
  });

  it("an ORDINARY column and corner are byte-identical — the option is off for them", () => {
    /* `buildColumnStyleMembers` builds every Column Panel and every Corner
       Panel in this app. Neither has any business changing shape because the
       Gable Peak needed a raked top. */
    for (const heightIn of [40, 48, 50, 72, 84, 96, 120]) {
      for (const widthIn of [WIDTH_IN, 36, 48]) {
        expect(
          JSON.stringify(buildColumnStyleMembers(widthIn, DEPTH_IN, heightIn, false, undefined, undefined)),
          `${widthIn}x${heightIn}`,
        ).toEqual(JSON.stringify(buildColumnStyleMembers(widthIn, DEPTH_IN, heightIn, false)));
      }
      const corner = buildCornerPanelMembers(DEPTH_IN, heightIn, false);
      expect(corner.find((m) => m.memberId === "top_plate_skin"), `corner ${heightIn}`).toBeDefined();
      expect(corner.find((m) => m.memberId === "side_ply_left")!.position.trapezoidCornersIn).toBeUndefined();
    }
  });

  it("a ridge too close to the panel's end is a FLAT top, not a plate of no length", () => {
    /* Both answers are real parts. A slope shorter than the plate's own end
       clearance has no plate left once both ends are inset, and the assembly
       would be a lid with nothing under it. The row only reports an apex
       strictly inside a tile anyway, so this is the type's own edge rather
       than a case that has been seen. */
    const tooClose: GablePeakTopProfile = { apexOffsetXIn: 2, leftRiseIn: 0, apexRiseIn: 4, rightRiseIn: 0 };
    expect(gablePeakHasFiveSidedTop(WIDTH_IN, tooClose)).toBe(false);
    expect(buildGablePeakTopMembers(WIDTH_IN, DEPTH_IN, EDGE_TOP_IN, tooClose)).toEqual([]);
    expect(JSON.stringify(build(tooClose))).toEqual(JSON.stringify(build(undefined)));
    /* A ridge that does not rise above its own edges is the same answer. */
    expect(gablePeakHasFiveSidedTop(WIDTH_IN, { ...symmetricTop(4), apexRiseIn: 0 })).toBe(false);
    expect(gablePeakHasFiveSidedTop(WIDTH_IN, undefined)).toBe(false);
  });

  it("an OFF-CENTRE ridge, with its two edges at different heights, comes out exact", () => {
    /* Measured on the real placement path the apex is dead centre on every
       wall from 12ft to 40ft, with and without openings below. This is the
       case the TYPE allows, tested so that a builder which silently assumed
       symmetry is caught the day the column stops landing on the peak. */
    const lopsided: GablePeakTopProfile = { apexOffsetXIn: WIDTH_IN * 0.4, leftRiseIn: 1.5, apexRiseIn: 9, rightRiseIn: 0 };
    const members = build(lopsided);
    const surfaceAtXIn = gablePeakTopSurfaceAtXIn(WIDTH_IN, EDGE_TOP_IN, lopsided);
    const undersideAtXIn = gablePeakAssemblyUndersideAtXIn(WIDTH_IN, EDGE_TOP_IN, lopsided);
    expect(Math.max(...members.flatMap(zsOf))).toBeCloseTo(EDGE_TOP_IN + lopsided.apexRiseIn, 9);
    for (const m of members) expect(m.actualDimsIn.lengthIn, m.memberId).toBeGreaterThan(0);
    /* The two slopes have different 1/cos, so each edge's stud reads its own. */
    for (const id of ["stud_corner_1", "stud_corner_2"]) {
      const stud = byId(members, id)!;
      const xIn = Math.min(...xsOf(stud));
      expect(topZAtXIn(stud, xIn), id).toBeCloseTo(undersideAtXIn(xIn), 9);
    }
    expect(topZAtXIn(byId(members, "side_ply_left")!, 0)).toBeCloseTo(surfaceAtXIn(0), 9);
    expect(topZAtXIn(byId(members, "side_ply_right")!, WIDTH_IN)).toBeCloseTo(surfaceAtXIn(WIDTH_IN), 9);
    expect(overlappingMemberPairs(members).filter((p) => p.includes("cap_"))).toEqual([]);
  });
});
