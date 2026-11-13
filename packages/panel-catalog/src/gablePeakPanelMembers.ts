import type { PanelComponentSchema, PanelMember } from "./componentSchema";
import {
  ROOF_CATCHER_BEAM_DEPTH_IN,
  ROOF_CATCHER_BEAM_TOTAL_THICKNESS_IN,
} from "./roofCatcherBeamMembers";
import { COLUMN_TOTAL_WIDTH_IN, buildColumnStyleMembers } from "./columnPanelMembers";
import { GABLE_PANEL_MIN_HEIGHT_IN, buildGablePanelMembers } from "./gablePanelMembers";
import {
  LUMBER_2X6_WIDTH_IN,
  LUMBER_SPECIES_GRADE,
  PLATE_2X4_THICKNESS_IN,
  SKIN_THICKNESS_IN,
  LEGACY_GIRT_STYLE,
  type GirtStyle,
  clearRunsIn,
  memberBoxIn,
  shiftTrapezoidCorners,
} from "./panelMemberHelpers";

/**
 * **The Gable Peak Panel** — the ridge column, with the roof-catcher beam
 * running *through* it instead of sitting on top of it.
 *
 * > *"this may entail making what I call a gable peak panel panel, where it has a
 * > furred out slot inside the straw (3/4" plywood small box that is 1/4"
 * > bigger each sideways and taller to house the beam) and then the weight is
 * > ditributed down with a 2x6 stud pack on each wythe."* — Tommy, 2026-11-10
 *
 * Every number below is his, confirmed on 2026-11-10 and 2026-11-12:
 *
 * | | |
 * |---|---|
 * | Replaces | the ridge column — *"wherever a ridge beam lands, that panel is a gable peak panel"* |
 * | Beam | **passes all the way through**, so the box is open at both wall faces |
 * | Panel top | **full height, past the beam** — it runs to the roofline like its neighbours |
 * | Box clearance | **1/4in on each side**, so 5.0in x 11.5in inside a 4.5in x 11.25in beam |
 * | Stud pack | **two 2x6s per wythe**, four in all, **5.5in face along the wall** |
 *
 * ⚠ **IT DROPS THE BEAM CLEAR OF THE PEAK, and he chose that knowingly.**
 * Until now the ridge column's top WAS the beam's underside and the beam's
 * top face sat flush with the peak (B9 — see `ROOF_CATCHER_BEAM_DEPTH_IN`).
 * A beam buried inside a full-height panel cannot also be flush with that
 * panel's top; it now sits under the top plate, which is where the roof load
 * it carries is coming from anyway.
 *
 * ⚠ **The box floor spans the panel's depth on two 3in packs.** The beam
 * bears on 3/4in plywood that is supported at the two wythes and unsupported
 * for the 9.5in of straw between them. That is what he described, and it is
 * recorded as a `deviation` note on the schema rather than silently
 * "improved" into something he did not ask for. **Pending Building Integrity
 * confirmation.**
 */

/** ⚠ His *"1/4in bigger each sideways and taller"*, asked and answered
 * directly on 2026-11-12: a quarter inch at **each** face sideways, and a
 * quarter at the top. */
export const GABLE_PEAK_SIDE_CLEARANCE_IN = 0.25;
export const GABLE_PEAK_TOP_CLEARANCE_IN = 0.25;

/** The furring box's own plywood. */
export const GABLE_PEAK_BOX_PLY_THICKNESS_IN = 0.75;
export const GABLE_PEAK_BOX_PLY_SPEC = "3/4in_5ply_CDX";

/** Clear inside the box: the beam plus his clearances. 5.0in x 11.5in. */
export const GABLE_PEAK_SLOT_WIDTH_IN = ROOF_CATCHER_BEAM_TOTAL_THICKNESS_IN + 2 * GABLE_PEAK_SIDE_CLEARANCE_IN;
export const GABLE_PEAK_SLOT_HEIGHT_IN = ROOF_CATCHER_BEAM_DEPTH_IN + GABLE_PEAK_TOP_CLEARANCE_IN;

/** Outside the box, plywood included. 6.5in x 13.0in. */
export const GABLE_PEAK_BOX_WIDTH_IN = GABLE_PEAK_SLOT_WIDTH_IN + 2 * GABLE_PEAK_BOX_PLY_THICKNESS_IN;
export const GABLE_PEAK_BOX_HEIGHT_IN = GABLE_PEAK_SLOT_HEIGHT_IN + 2 * GABLE_PEAK_BOX_PLY_THICKNESS_IN;

/** ⚠ **Two 2x6s per wythe, 5.5in face along the wall.** Asked directly on
 * 2026-11-12 — *"lets go with 5.5\" along the wall"* — so each stud stands
 * 5.5in along the panel's length and 1.5in through its depth, and a pair makes
 * a 5.5in x 3.0in pack sitting under the 6.5in box. */
export const GABLE_PEAK_PACK_STUD_COUNT = 2;
export const GABLE_PEAK_PACK_WIDTH_IN = LUMBER_2X6_WIDTH_IN; // 5.5, along the wall
export const GABLE_PEAK_PACK_DEPTH_IN = GABLE_PEAK_PACK_STUD_COUNT * PLATE_2X4_THICKNESS_IN; // 3.0, through the wall

/** The clear span between the plates — the same two numbers `buildPlates`
 * works to, so the box and the packs cannot drift from the panel they sit
 * in. */
export function gablePeakClearZIn(heightIn: number): { bottomZIn: number; topZIn: number } {
  return {
    bottomZIn: SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN,
    topZIn: heightIn - SKIN_THICKNESS_IN - PLATE_2X4_THICKNESS_IN,
  };
}

/**
 * ⚠ **How far below the panel's own TOP the beam's top face lands.**
 *
 * Constant whatever the panel's height, because every term in it is: the top
 * skin, the top plate the box hangs under, the box's own lid, and his quarter
 * inch of clearance. 3 1/4in in all.
 *
 * Exported so the 3D view can place the beam from the same arithmetic the box
 * is built from. A second copy of this in the renderer is exactly how the
 * model and the shop drawings come to describe different buildings — which is
 * the fault B9 was fixing when it found the beam floating 0.75in on
 * nominal-versus-actual.
 */
export const GABLE_PEAK_BEAM_TOP_BELOW_PANEL_TOP_IN =
  SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN + GABLE_PEAK_BOX_PLY_THICKNESS_IN + GABLE_PEAK_TOP_CLEARANCE_IN;

/** Where the box sits in the panel, and where the beam sits in the box. */
export interface GablePeakSlot {
  /** The box, plywood included. */
  boxFromXIn: number;
  boxToXIn: number;
  boxFromZIn: number;
  boxToZIn: number;
  /** The clear slot the beam drops into. */
  slotFromXIn: number;
  slotToXIn: number;
  slotFromZIn: number;
  slotToZIn: number;
  /** The beam itself, resting on the box floor with his clearance above. */
  beamFromZIn: number;
  beamToZIn: number;
}

/**
 * ⚠ **The box hangs under the TOP PLATE, not at the panel's very top.**
 * The roof load arrives through the top plate, so the plate stays unbroken
 * and the box takes its bearing directly off the underside of it. That is
 * also what makes the panel "full height past the beam" true in the only
 * sense a panel can be — its plates and skins are continuous.
 */
export function gablePeakSlotIn(
  widthIn: number,
  heightIn: number,
  /**
   * ⚠ **How far below this panel's own top the ROOFLINE sits**, which is what
   * the box actually hangs from.
   *
   * A gable panel closing to the roof's TOP surface is built taller than the
   * roofline by the roof's own plumb thickness — 16 3/8in through a 15.5in
   * deck at 4:12. The ridge beam belongs under the roof DECK, not up inside
   * its thickness, so hanging the box from the panel's top put the box
   * **16.338in above the beam** on The Tank: panel top 186.588in, box at
   * 183.34in, beam drawn at 167.0in. Measured 2026-11-13, and the two numbers
   * agreed to three decimals, which is what identified the lift as the cause.
   *
   * 0 for a panel whose top IS the roofline, which is every caller that does
   * not close to the roof's top.
   */
  rooflineBelowTopIn = 0,
): GablePeakSlot {
  const { topZIn: panelTopZIn } = gablePeakClearZIn(heightIn);
  const topZIn = panelTopZIn - Math.max(0, rooflineBelowTopIn);
  const centreXIn = widthIn / 2;
  const boxFromXIn = centreXIn - GABLE_PEAK_BOX_WIDTH_IN / 2;
  const boxToZIn = topZIn;
  const boxFromZIn = boxToZIn - GABLE_PEAK_BOX_HEIGHT_IN;
  const slotFromZIn = boxFromZIn + GABLE_PEAK_BOX_PLY_THICKNESS_IN;
  return {
    boxFromXIn,
    boxToXIn: boxFromXIn + GABLE_PEAK_BOX_WIDTH_IN,
    boxFromZIn,
    boxToZIn,
    slotFromXIn: boxFromXIn + GABLE_PEAK_BOX_PLY_THICKNESS_IN,
    slotToXIn: boxFromXIn + GABLE_PEAK_BOX_WIDTH_IN - GABLE_PEAK_BOX_PLY_THICKNESS_IN,
    slotFromZIn,
    slotToZIn: boxToZIn - GABLE_PEAK_BOX_PLY_THICKNESS_IN,
    /* The beam rests on the box floor; his quarter inch of clearance is at
       the TOP, which is the only place it can be once the beam is bearing. */
    beamFromZIn: slotFromZIn,
    beamToZIn: slotFromZIn + ROOF_CATCHER_BEAM_DEPTH_IN,
  };
}

/** The four plywood faces of the box. Open at both wall faces, because the
 * beam runs through. */
function buildBoxMembers(slot: GablePeakSlot, depthIn: number): PanelMember[] {
  const t = GABLE_PEAK_BOX_PLY_THICKNESS_IN;
  const ply = (
    memberId: string,
    xIn: number,
    zIn: number,
    lengthIn: number,
    standing: boolean,
    notes: string,
  ): PanelMember => ({
    memberId,
    material: "plywood",
    speciesGrade: null,
    plySpec: GABLE_PEAK_BOX_PLY_SPEC,
    nominalSize: null,
    actualDimsIn: { thicknessIn: t, widthIn: depthIn, lengthIn },
    /* Both pairs run the full depth of the wall; the difference is which way
       the sheet stands. The two cheeks stand on edge beside the beam, the
       floor and lid lie flat under and over it. */
    orientation: standing ? "vertical" : "flat",
    position: { xIn, yIn: 0, zIn, rotationDeg: 0 },
    role: "skin",
    qty: 1,
    notes,
  });

  return [
    ply(
      "gable_peak_box_floor",
      slot.boxFromXIn,
      slot.boxFromZIn,
      GABLE_PEAK_BOX_WIDTH_IN,
      false,
      "furring box floor — the beam bears on this, and it bears on the two 2x6 packs below",
    ),
    ply(
      "gable_peak_box_lid",
      slot.boxFromXIn,
      slot.boxToZIn - t,
      GABLE_PEAK_BOX_WIDTH_IN,
      false,
      "furring box lid, directly under the top plate",
    ),
    ply(
      "gable_peak_box_cheek_left",
      slot.boxFromXIn,
      slot.slotFromZIn,
      GABLE_PEAK_SLOT_HEIGHT_IN,
      true,
      "furring box cheek — holds the straw off the beam on this side",
    ),
    ply(
      "gable_peak_box_cheek_right",
      slot.slotToXIn,
      slot.slotFromZIn,
      GABLE_PEAK_SLOT_HEIGHT_IN,
      true,
      "furring box cheek — holds the straw off the beam on this side",
    ),
  ];
}

/** The two 2x6 packs, one at each wythe, carrying the box down to the bottom
 * plate. */
function buildStudPacks(slot: GablePeakSlot, depthIn: number, heightIn: number): PanelMember[] {
  const { bottomZIn } = gablePeakClearZIn(heightIn);
  const lengthIn = slot.boxFromZIn - bottomZIn;
  if (lengthIn <= 0) return [];
  const packFromXIn = (slot.boxFromXIn + slot.boxToXIn) / 2 - GABLE_PEAK_PACK_WIDTH_IN / 2;
  const out: PanelMember[] = [];
  for (const [face, packYIn] of [
    ["exterior", 0],
    ["interior", depthIn - GABLE_PEAK_PACK_DEPTH_IN],
  ] as const) {
    for (let i = 0; i < GABLE_PEAK_PACK_STUD_COUNT; i++) {
      out.push({
        memberId: `gable_peak_pack_${face}_${i + 1}`,
        material: "dimensional_lumber",
        speciesGrade: LUMBER_SPECIES_GRADE,
        plySpec: null,
        nominalSize: "2x6",
        /* 5.5in along the wall, 1.5in through it — his orientation. */
        actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: GABLE_PEAK_PACK_WIDTH_IN, lengthIn },
        orientation: "vertical",
        position: { xIn: packFromXIn, yIn: packYIn + i * PLATE_2X4_THICKNESS_IN, zIn: bottomZIn, rotationDeg: 90 },
        role: "stud",
        qty: 1,
        notes: `${face} wythe, ${i + 1} of ${GABLE_PEAK_PACK_STUD_COUNT} — carries the beam's bearing from the furring box down to the bottom plate`,
      });
    }
  }
  return out;
}

/**
 * ⚠ **Anything running ACROSS the panel is cut around whatever this panel
 * adds**, the same way a ring girt is cut around a vertical.
 *
 * A column panel's girt rows and its 2x4 blocking both run along X between
 * the corner studs, and this panel puts two new things in their way: the
 * furring box, 6.5in wide over 13in of height, and the two 2x6 packs, which
 * stand at the wythe faces from the bottom plate all the way up to the box.
 * The blocking is at those same two faces, so **every row below the box is
 * crossed by a pack** — twelve collisions on a 10ft panel, found by the
 * overlap rule rather than by eye ([[no_overlapping_members]], 2026-10-23).
 *
 * The obstacles are read off the members THEMSELVES rather than recomputed
 * from the constants, so the cut cannot drift from what is actually built.
 * A row with nothing left either side is dropped rather than emitted at zero
 * length.
 */
function cutRowsAroundObstacles(members: readonly PanelMember[], obstacles: readonly PanelMember[]): PanelMember[] {
  const boxes = obstacles.map(memberBoxIn);
  const out: PanelMember[] = [];
  for (const member of members) {
    const box = memberBoxIn(member);
    /* Only boards that RUN along X get cut; a vertical is cut by nothing
       here, and neither is anything that clears the obstacles in Y or Z. */
    const inTheWay = boxes.filter(
      (o) =>
        o.zToIn > box.zFromIn + 1e-9 &&
        o.zFromIn < box.zToIn - 1e-9 &&
        o.yToIn > box.yFromIn + 1e-9 &&
        o.yFromIn < box.yToIn - 1e-9 &&
        o.xToIn > box.xFromIn + 1e-9 &&
        o.xFromIn < box.xToIn - 1e-9,
    );
    if (member.orientation === "vertical" || inTheWay.length === 0) {
      out.push(member);
      continue;
    }
    const runs = clearRunsIn(
      box.xFromIn,
      box.xToIn,
      inTheWay.map((o) => [o.xFromIn, o.xToIn] as [number, number]),
    );
    const cut = runs.length !== 1 || runs[0]![0] !== box.xFromIn || runs[0]![1] !== box.xToIn;
    runs.forEach(([fromXIn, toXIn]: [number, number], i: number) => {
      if (toXIn - fromXIn <= 1e-9) return;
      out.push({
        ...member,
        memberId: cut ? `${member.memberId}_${i + 1}` : member.memberId,
        actualDimsIn: { ...member.actualDimsIn, lengthIn: toXIn - fromXIn },
        position: { ...member.position, xIn: fromXIn },
        notes: cut
          ? `${member.notes ?? ""}${member.notes ? " — " : ""}cut around the gable peak panel's furring box and 2x6 packs`
          : member.notes,
      });
    });
  }
  return out;
}

/**
 * ⚠ **THE FIVE-SIDED TOP — his shape, built as TWO gable tops rather than
 * one new one.**
 *
 * > *"this Gable column panel would be five-sided, or I guess technically
 * > seven-sided including the inside and outside faces. The top lid would be
 * > very weird and two pieces and that's fine."* — Tommy, 2026-11-13
 *
 * Three top heights, measured as rises above the panel body's own flat top:
 * the left edge, the ridge, the right edge. Normally the two edges are 0 (the
 * body already reaches the roofline) and only the ridge rises.
 *
 * ⚠ **Each slope is a real `buildGablePanelMembers` call, and that is the
 * whole design.** A gable top is not a rectangle tilted over: its boards are
 * cut with PLUMB ends, its skin and plate thicknesses are converted from
 * perpendicular to vertical through `1/cos θ`, and its corner studs are
 * omitted rather than built negative at a tip. Those corrections are worth
 * 0.020in and 0.081in at 4:12 — small, and exactly the numbers that decide
 * whether a gable finishes flush with the roof above it. They took four
 * passes to get right once (see `gable_roof_flush_junction`) and a second
 * hand-rolled copy here is how they would come undone. So the ridge is a
 * SEAM between two ordinary gable tops, which is also why the lid comes out
 * as his two pieces without anyone arranging it.
 *
 * ⚠ **No post under the ridge.** Two sloped plates meeting is all this adds;
 * it invents no vertical member he did not describe, and the furring box the
 * beam drops into is directly below that seam.
 *
 * ⚠ **A ridge that barely rises gets NO cap, and that is a real answer.**
 * `buildGablePanelMembers` refuses a panel whose taller edge cannot carry its
 * own two skins, by THROWING — and this builder is called inside the 3D
 * view's render. On a 25.5in column the ridge rises `12.75 x pitch/12`, so a
 * pitch under about 1.4:12 puts it below that floor. The roofline is then
 * within an inch and a half of level across the whole tile and a flat top is
 * the truthful shape, so the cap is skipped rather than forced. Same
 * reasoning, and the same shape of answer, as `gableWindowCapHeightsIn`.
 */
export interface GablePeakTopProfile {
  /** The ridge's distance from the panel's own left edge. */
  apexOffsetXIn: number;
  /** Rise of the left edge above the body's top. Normally 0. */
  leftRiseIn: number;
  /** Rise of the ridge above the body's top. */
  apexRiseIn: number;
  /** Rise of the right edge above the body's top. Normally 0. */
  rightRiseIn: number;
}

function shiftMembers(members: PanelMember[], deltaXIn: number, deltaZIn: number): PanelMember[] {
  return members.map((m) => ({
    ...m,
    memberId: m.memberId,
    position: {
      ...m.position,
      xIn: m.position.xIn + deltaXIn,
      zIn: m.position.zIn + deltaZIn,
      trapezoidCornersIn: shiftTrapezoidCorners(m.position.trapezoidCornersIn, deltaXIn, deltaZIn),
    },
  }));
}

/**
 * ⚠ **The cap has NO bottom plate of its own — it bears on the body's top
 * plate**, and the first version of this got that wrong in a way worth
 * recording.
 *
 * A gable panel built by `buildGablePanelMembers` starts with a bottom plate
 * assembly: 3/4in skin then a 1 1/2in 2x4, `BOTTOM_PLATE_ASSEMBLY_IN` in all.
 * Stacking one whole gable panel on the column body therefore laid a plate
 * directly on the body's own unbroken top plate — two plates and a skin in a
 * sandwich no one asked for. At 4:12 that is 2 1/4in of invented material at
 * the seam; at **2:12 it is taller than the entire cap**, whose ridge rises
 * only 2.125in on a 25.5in panel, so the "cap" was pure bottom plate with its
 * top boards poking out above the ridge.
 *
 * ⚠ **Only the SKIN is dropped, not the plate**, and the stack-up is why.
 * Read off the builder: `bottom_plate_skin` lies flat across the full width
 * at 0 -> 3/4; the two `bottom_plate_2x4`s sit on it at 3/4 -> 2 1/4, inset
 * a stud's width at each end; and the corner studs stand **beside** those
 * plates, from 3/4 up. So the panel's lowest layer is a sheet of plywood and
 * the body already has one of those at its top. Dropping the whole assembly
 * instead left the cap's studs bearing on the body's top skin with no plate
 * under them — and, measured, standing 1 1/2in BELOW the body's own top.
 *
 * So the slope is asked for `rise + SKIN_THICKNESS_IN`, dropped by the same,
 * and only its bottom skin discarded. The cap's bottom plate then lands
 * directly on the body's top skin — skin-then-plate, the same order every
 * other panel in this app is built in. The gable WINDOW cap already does
 * this same trick with the header it does not want
 * (`!m.memberId.startsWith("header_")`).
 *
 * ⚠ **Pending Building Integrity confirmation**: whether a five-sided peak
 * wants one shared plate under both slopes (what this builds) or its own
 * plate per slope is a fabrication call, not a geometric one.
 *
 * ## ⚠ THE CAP IS A BAND, NOT A HAT — and the second version of this was a hat
 *
 * A panel's top SURFACE is the top face of its top skin; the skin and the
 * top plate live **below** that surface, not above it. So a cap stacked on a
 * body that already reached the roofline had nowhere to put its own top
 * assembly at the panel's two outer edges, where the cap's height goes to
 * nothing: measured at 4:12, the sloped top plates hung **1.87in below the
 * body's own top**, straight through the top plate they were sitting on.
 * Silent in the render, and exactly the kind of thing his no-overlapping-
 * members rule exists to catch.
 *
 * So the body stops `CAP_BAND_IN` short of the roofline and the cap occupies
 * that band across the WHOLE width, rising to the ridge in the middle. At the
 * two edges the cap is exactly its own top assembly and nothing more, which
 * is what an ordinary gable tile is at its own eave edge too.
 *
 * ⚠ The band is a VERTICAL thickness, so it carries the `1/cos θ` the rest of
 * this file is careful about: a 3/4in skin and a 1 1/2in plate cut plumb on a
 * 4:12 slope stand 2.37in tall, not 2.25in. The steeper of the two slopes
 * sets it, so neither side can poke through.
 */
function capBandIn(runIn: number, riseIn: number): number {
  const cosTheta = runIn > 0 ? runIn / Math.hypot(runIn, riseIn) : 1;
  return (SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN) / cosTheta;
}

/** One slope of the cap band. */
function buildCapSlope(
  prefix: string,
  widthIn: number,
  depthIn: number,
  leftHeightIn: number,
  rightHeightIn: number,
  baseZIn: number,
  xOffsetIn: number,
  girtStyle: GirtStyle,
): PanelMember[] {
  if (widthIn <= 0) return [];
  const slope = buildGablePanelMembers(widthIn, depthIn, leftHeightIn, rightHeightIn, false, girtStyle)
    /* The body's own top skin is directly beneath, so the cap does not bring
       a second sheet of plywood to lie on it. */
    .filter((m) => m.memberId !== "bottom_plate_skin");
  return shiftMembers(slope, xOffsetIn, baseZIn).map((m) => ({
    ...m,
    memberId: `${prefix}_${m.memberId}`,
    notes: `${m.notes ?? ""}${m.notes ? " — " : ""}${prefix === "cap_left" ? "left" : "right"} slope of the five-sided peak, meeting its pair at the ridge`,
  }));
}

/**
 * How far below the roofline a five-sided peak's BODY has to stop, so the cap
 * band above it has room for its own sloped top assembly. The caller builds
 * the column body this much shorter than the tile's edge height.
 */
export function gablePeakCapBandIn(widthIn: number, top: GablePeakTopProfile): number {
  const leftRunIn = top.apexOffsetXIn;
  const rightRunIn = widthIn - top.apexOffsetXIn;
  return Math.max(
    capBandIn(leftRunIn, Math.abs(top.apexRiseIn - top.leftRiseIn)),
    capBandIn(rightRunIn, Math.abs(top.apexRiseIn - top.rightRiseIn)),
  );
}

/**
 * The cap band. `edgeTopZIn` is where the panel's own top surface sits at its
 * LOWER edge — i.e. the body height the caller would have used for a flat
 * top. The band hangs below it and rises to the ridge; the body underneath
 * must be built `gablePeakCapBandIn` shorter.
 */
export function buildGablePeakTopMembers(
  widthIn: number,
  depthIn: number,
  edgeTopZIn: number,
  top: GablePeakTopProfile,
  girtStyle: GirtStyle = LEGACY_GIRT_STYLE,
): PanelMember[] {
  const { apexOffsetXIn, leftRiseIn, apexRiseIn, rightRiseIn } = top;
  const bandIn = gablePeakCapBandIn(widthIn, top);
  const baseZIn = edgeTopZIn - bandIn;
  /* Heights within the band: every point is the band itself plus however far
     this panel's top surface rises above its lower edge there. */
  return [
    ...buildCapSlope("cap_left", apexOffsetXIn, depthIn, bandIn + leftRiseIn, bandIn + apexRiseIn, baseZIn, 0, girtStyle),
    ...buildCapSlope(
      "cap_right",
      widthIn - apexOffsetXIn,
      depthIn,
      bandIn + apexRiseIn,
      bandIn + rightRiseIn,
      baseZIn,
      apexOffsetXIn,
      girtStyle,
    ),
  ];
}

/**
 * Every physical member of a Gable Peak Panel: a Column Panel, with its
 * cross-members cut around a plywood furring box, plus the box and the two
 * 2x6 packs that carry it — and, when the ridge falls inside this panel, the
 * five-sided top above it.
 */
export function buildGablePeakPanelMembers(
  depthIn: number,
  heightIn: number,
  includeNailer: boolean,
  girtStyle: GirtStyle = LEGACY_GIRT_STYLE,
  widthIn: number = COLUMN_TOTAL_WIDTH_IN,
  /** See `gablePeakSlotIn` — how far below this panel's top the roofline is,
   * which is where the beam goes. */
  rooflineBelowTopIn = 0,
  /** ⚠ The ridge, when it falls inside this panel — see
   * `GablePeakTopProfile`. `heightIn` is then the BODY's height (its two
   * edges), not the panel's tallest point. Omitted leaves the old flat top,
   * which is still right for a peak that lands on this panel's own edge. */
  top?: GablePeakTopProfile,
): PanelMember[] {
  /* ⚠ **THE BOX HANGS FROM THE BODY'S TOP PLATE, NOT THE RIDGE.** With a cap
     on, the panel's tallest point is the ridge and its unbroken top plate is
     at the body's top — which is what `gablePeakSlotIn` means by the plate
     the box takes its bearing off. Measuring from `heightIn` here would have
     hung the box up inside the cap, the same shape of fault as the 16.338in
     lift error that function's own doc comment records. */
  const slotBandIn = top ? gablePeakCapBandIn(widthIn, top) : 0;
  const slot = gablePeakSlotIn(widthIn, heightIn - slotBandIn, rooflineBelowTopIn);
  /* ⚠ **Never a centre nailer on this panel.** A nailer stands at mid-width,
     which is exactly where the box is, so the two would occupy the same
     straw. The box is the thing the panel exists for. */
  /* ⚠ **THE BODY STOPS SHORT WHEN THERE IS A CAP**, by exactly the band the
     cap's own sloped top assembly needs — see `gablePeakCapBandIn`. Building
     the body to the full edge height and putting the cap above it drove the
     cap's plates 1.87in down through the body's top plate at 4:12. */
  const bandIn = top ? gablePeakCapBandIn(widthIn, top) : 0;
  const bodyHeightIn = heightIn - bandIn;
  const column = buildColumnStyleMembers(widthIn, depthIn, bodyHeightIn, includeNailer && false, girtStyle);
  const added = [...buildBoxMembers(slot, depthIn), ...buildStudPacks(slot, depthIn, bodyHeightIn)];
  /* The cap is added AFTER the cut pass: it sits entirely above the body, so
     nothing in it runs across the box or the packs. */
  const cap = top ? buildGablePeakTopMembers(widthIn, depthIn, heightIn, top, girtStyle) : [];
  return [...cutRowsAroundObstacles(column, added), ...added, ...cap];
}

/** Wraps `buildGablePeakPanelMembers` in the full shared component schema. */
export function buildGablePeakPanelSchema(
  depthIn: number,
  heightIn: number,
  includeNailer: boolean,
  girtStyle: GirtStyle = LEGACY_GIRT_STYLE,
  widthIn: number = COLUMN_TOTAL_WIDTH_IN,
  rooflineBelowTopIn = 0,
): PanelComponentSchema {
  return {
    schemaVersion: "0.1",
    componentType: "panel",
    id: "gable_peak_panel",
    displayName: "Gable Peak Panel",
    status: "draft",
    derivedFrom: "column_panel",
    overallDimensions: { heightIn, widthIn, depthIn },
    members: buildGablePeakPanelMembers(depthIn, heightIn, includeNailer, girtStyle, widthIn, rooflineBelowTopIn),
    fasteners: [],
    notes: [
      {
        type: "deviation",
        text:
          "The furring box's floor spans the full wall depth on two 3in-wide 2x6 packs, one at each wythe, so the " +
          "beam's bearing crosses about 9.5in of unsupported 3/4in plywood between them. This is Tommy's own " +
          "description (\"the weight is ditributed down with a 2x6 stud pack on each wythe\") built as given — " +
          "pending Building Integrity engineering confirmation, not an engineered detail.",
      },
      {
        type: "deviation",
        text:
          "Housing the beam inside a full-height panel puts its top face below the peak rather than flush with it, " +
          "which supersedes the B9 rule that the ridge column's top IS the beam's underside. Tommy chose the " +
          "full-height panel on 2026-11-12 with that consequence stated.",
      },
    ],
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
