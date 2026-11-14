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
  plumbEndedSlopedBoardCornersIn,
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



/**
 * ⚠ **3 1/2in IS THE STOCK, NOT THE RISE, and on a 25.5in panel at 4:12 the
 * two disagree.**
 *
 * > *"The long cut triangles are 3.5" in depth/cut from a 2x4. This is a
 * > 1'7" panel."* — Tommy, 2026-11-13
 *
 * A wedge that tapers to nothing has its depth FIXED by the geometry: it must
 * equal the ridge's rise above the panel's edge, `(width / 2) x pitch/12`.
 *
 * | panel | pitch | rise needed | rips from |
 * |---|---|---|---|
 * | 19in (his sketch) | 4:12 | 3.17in | **2x4** ✓ |
 * | 25.5in (today's column) | 3:12 | 3.19in | **2x4** ✓ |
 * | 25.5in | 4:12 | **4.25in** | **2x6** — a 2x4 cannot do it |
 * | 25.5in | 8:12 | 8.50in | 2x10 |
 *
 * His 19in sketch and his 2x4 agree with each other at about 4:12. The 25.5in
 * ridge column this app actually builds does not, by 3/4in, at the default
 * pitch. **The geometry wins and the stock follows** — a wedge sized to
 * anything but the real rise would put the lid off the roof plane, which is
 * the defect this whole change exists to fix. So 3 1/2in is recorded as the
 * point where a 2x4 stops being enough rather than silently becoming a 2x6.
 */
export const GABLE_PEAK_WEDGE_MAX_STOCK_IN = 3.5;

/** The nominal board a wedge of this depth has to be ripped from. */
export function gablePeakWedgeStockFor(depthIn: number): string {
  for (const [actualIn, nominal] of [
    [3.5, "2x4"],
    [5.5, "2x6"],
    [7.25, "2x8"],
    [9.25, "2x10"],
    [11.25, "2x12"],
  ] as const) {
    if (depthIn <= actualIn + 1e-9) return nominal;
  }
  return "built-up";
}

/** ⚠ One wedge at each wythe face, directly over the 2x6 packs, so the lid's
 * load runs wedge -> pack -> bottom plate instead of landing on straw. The
 * COUNT and the placement are an interpretation of his drawing (it shows the
 * members but not their spacing); the wedge's own profile is his.
 * **Pending Building Integrity confirmation.** */
const GABLE_PEAK_WEDGE_THICKNESS_IN = PLATE_2X4_THICKNESS_IN;

/**
 * ⚠ **How much lower the BODY sits than the panel's top surface: one lid.**
 *
 * The wedges feather to nothing at the panel's outer edge, so what is over
 * the body's top deck there is the lid and nothing else. The body is an
 * ordinary closed Column Panel — its own top plate and top skin untouched —
 * and the lid is a roof deck laid over it, which is two sheets of plywood at
 * the edge on purpose rather than by accident: one closes the straw, one is
 * the roof.
 *
 * ⚠ Vertical, not perpendicular: a 3/4in sheet cut plumb on a 4:12 slope
 * stands 0.79in tall. The rest of this file is careful about that `1/cos`
 * and so is this.
 *
 * ## ⚠ ONE SHARED PLATE UNDER BOTH SLOPES — his ruling, 2026-11-13
 *
 * Asked directly whether the five-sided peak wants one plate spanning the
 * whole panel under both slopes, or its own plate per slope, he answered:
 * **"one shared plate under both slopes."**
 *
 * That is what this builds, and it is why the body is left alone: the Column
 * Panel's own top plate already runs unbroken across the full width, and both
 * slopes bear on it through their wedges. No second plate is added at the
 * ridge, none per slope, and the body's plate is not cut to make room for
 * one. It also keeps the furring box's bearing intact — `gablePeakSlotIn`'s
 * own note is that the plate stays unbroken and the box hangs beneath it.
 *
 * This closes the last `pending-BI-confirmation` on the shape of this top.
 */
export function gablePeakLidVerticalThicknessIn(runIn: number, riseIn: number): number {
  const cosTheta = runIn > 0 ? runIn / Math.hypot(runIn, riseIn) : 1;
  return SKIN_THICKNESS_IN / cosTheta;
}

/**
 * ⚠ **How far below the ROOF'S RIDGE the beam's top face lands, now that the
 * peak is five-sided.**
 *
 * `GABLE_PEAK_BEAM_TOP_BELOW_PANEL_TOP_IN` (3 1/4in) measures from the
 * PANEL'S OWN TOP, and while that top was flat at ridge height the two were
 * the same number — which is why `Building3DView` could place the ridge beam
 * off the roof plane with a constant.
 *
 * They are not the same number any more. The panel's body now stops at its
 * LOWER edge less one lid, and the ridge rises above that, so the box the
 * beam drops into sits `apexRise + lidThickness` further down than the old
 * constant believed. On The Tank at 4:12 that is 4.25 + 0.79 = **5.04in**,
 * and holding the constant would have drawn the beam straight up through the
 * lid of its own box — the B9 fault again, which was found at 0.75in.
 *
 * Exported so the renderer and the builder read one derivation. A second
 * copy of this arithmetic is exactly how the model and the shop drawings
 * come to describe different buildings.
 *
 * ⚠ **Assumes the ridge is CENTRED in the panel**, which is what
 * `placeColumnUnderPeak` produces on every wall from 12ft to 40ft, measured.
 * An off-centre ridge sits further above the lower edge than `width / 2`
 * implies, and this would then run shallow.
 */
export function gablePeakBeamTopBelowRidgeIn(widthIn: number, pitchIn12: number): number {
  const runIn = widthIn / 2;
  const riseIn = runIn * (pitchIn12 / 12);
  /* ⚠ No rise means no cap and therefore no lid — the panel is the ordinary
     flat-topped one and the old constant is exactly right. Returning
     "constant + a lid" here would drop the beam 3/4in for a roof that has no
     ridge to speak of. */
  if (riseIn <= 0) return GABLE_PEAK_BEAM_TOP_BELOW_PANEL_TOP_IN;
  return riseIn + gablePeakLidVerticalThicknessIn(runIn, riseIn) + GABLE_PEAK_BEAM_TOP_BELOW_PANEL_TOP_IN;
}

/** The body's flat top, given where the panel's top SURFACE sits at its
 * lower edge. */
export function gablePeakWedgeBodyTopZIn(widthIn: number, edgeTopZIn: number, top: GablePeakTopProfile): number {
  /* ⚠ **A profile with no rise builds no lid, so the body must NOT drop.**
     Found by the beam test: a `top` whose apex is level with its edges makes
     `buildGablePeakWedgeTopMembers` return nothing, and shortening the body
     anyway left a 3/4in void where the lid would have been. A degenerate
     profile has to collapse all the way back to the plain flat-topped panel,
     not nearly. */
  const maxRiseIn = Math.max(top.leftRiseIn, top.apexRiseIn, top.rightRiseIn);
  const minRiseIn = Math.min(top.leftRiseIn, top.apexRiseIn, top.rightRiseIn);
  if (maxRiseIn - minRiseIn <= 0) return edgeTopZIn;
  const leftRunIn = top.apexOffsetXIn;
  const rightRunIn = widthIn - top.apexOffsetXIn;
  return (
    edgeTopZIn -
    Math.max(
      gablePeakLidVerticalThicknessIn(leftRunIn, Math.abs(top.apexRiseIn - top.leftRiseIn)),
      gablePeakLidVerticalThicknessIn(rightRunIn, Math.abs(top.apexRiseIn - top.rightRiseIn)),
    )
  );
}

/**
 * The five-sided top as he drew it: two tapered wedges per slope on the
 * panel's own flat top, and a plumb-cut plywood lid over each.
 *
 * `edgeTopZIn` is where the panel's top SURFACE sits at its lower edge — the
 * height the tile reports. The body underneath is built to
 * `gablePeakWedgeBodyTopZIn`, one lid lower.
 */
export function buildGablePeakWedgeTopMembers(
  widthIn: number,
  depthIn: number,
  edgeTopZIn: number,
  top: GablePeakTopProfile,
): PanelMember[] {
  const out: PanelMember[] = [];
  const bodyTopZIn = gablePeakWedgeBodyTopZIn(widthIn, edgeTopZIn, top);
  const slopes = [
    { id: "left", fromXIn: 0, toXIn: top.apexOffsetXIn, fromRiseIn: top.leftRiseIn, toRiseIn: top.apexRiseIn },
    {
      id: "right",
      fromXIn: top.apexOffsetXIn,
      toXIn: widthIn,
      fromRiseIn: top.apexRiseIn,
      toRiseIn: top.rightRiseIn,
    },
  ] as const;

  for (const slope of slopes) {
    const runIn = slope.toXIn - slope.fromXIn;
    if (runIn <= 0) continue;
    const deepestIn = Math.max(slope.fromRiseIn, slope.toRiseIn);
    if (deepestIn <= 0) continue;

    /**
     * ⚠ **THE WEDGE IS A 2x4 AND IT STOPS WHERE A 2x4 STOPS — his call.**
     *
     * > *"if the 2x4 is not deep enough to cap it off - that's fine. just
     * > have that space exposed and i can stuff it worth straw."* — Tommy,
     * > 2026-11-13
     *
     * This settles the conflict his own two numbers had: a wedge that
     * feathers to nothing needs a depth equal to the ridge's rise, and on a
     * 25.5in panel at 4:12 that is 4.25in — three quarters of an inch more
     * than a 2x4 can give. The earlier resolution was "geometry wins, the
     * stock follows", which quietly promoted the board to a 2x6. **He would
     * rather keep the 2x4 and leave the deep corner open.**
     *
     * The lid still lies on the true roof plane — that is not negotiable,
     * it is the whole defect being fixed — so the wedge can only sit where
     * the gap under the lid is 3 1/2in or less. That is the OUTER part of
     * the slope: the gap grows from nothing at the panel's edge to the full
     * rise at the ridge, reaching 3 1/2in at `3.5 x run / rise` from the
     * edge. Inboard of that the void is deeper than any 2x4 rip and is left
     * open for him to pack.
     *
     * | panel | pitch | rise | wedge covers | open next to the ridge |
     * |---|---|---|---|---|
     * | 25.5in | 3:12 | 3.19in | all 12.75in | none |
     * | 25.5in | 4:12 | 4.25in | 10.50in | 2.25in |
     * | 25.5in | 8:12 | 8.50in | 5.25in | 7.50in |
     *
     * ⚠ The open void grows fast with pitch, and at 8:12 it is more than
     * half the slope. That is his decision to make and he has made it, but
     * the numbers are printed on the member's own cut note so nobody has to
     * rediscover them at a steep pitch.
     */
    const wedgeDeepestIn = Math.min(deepestIn, GABLE_PEAK_WEDGE_MAX_STOCK_IN);
    /* Where along this slope the gap under the lid reaches the wedge's own
       depth. The wedge runs from the SHALLOW end (the panel edge) to here. */
    const wedgeRunIn = deepestIn > 0 ? (wedgeDeepestIn / deepestIn) * runIn : runIn;
    const openRunIn = runIn - wedgeRunIn;
    /* Which end of this slope is the shallow one — the wedge grows from
       there. On the left slope the panel edge is `fromXIn`; on the right it
       is `toXIn`, because the right slope falls away from the ridge. */
    const shallowAtFrom = slope.fromRiseIn <= slope.toRiseIn;
    const wedgeFromXIn = shallowAtFrom ? slope.fromXIn : slope.toXIn - wedgeRunIn;
    const wedgeToXIn = shallowAtFrom ? slope.fromXIn + wedgeRunIn : slope.toXIn;
    const shallowRiseIn = Math.min(slope.fromRiseIn, slope.toRiseIn);
    const wedgeShallowXIn = shallowAtFrom ? wedgeFromXIn : wedgeToXIn;
    const wedgeDeepXIn = shallowAtFrom ? wedgeToXIn : wedgeFromXIn;

    const stock = gablePeakWedgeStockFor(wedgeDeepestIn);
    /* The wedges. Two per slope, one at each wythe face. */
    for (const [face, yIn] of [
      ["exterior", 0],
      ["interior", depthIn - GABLE_PEAK_WEDGE_THICKNESS_IN],
    ] as const) {
      out.push({
        memberId: `gable_peak_wedge_${slope.id}_${face}`,
        material: "dimensional_lumber",
        speciesGrade: LUMBER_SPECIES_GRADE,
        plySpec: null,
        nominalSize: stock,
        actualDimsIn: { thicknessIn: GABLE_PEAK_WEDGE_THICKNESS_IN, widthIn: wedgeDeepestIn, lengthIn: wedgeRunIn },
        orientation: "diagonal",
        position: {
          xIn: wedgeFromXIn,
          yIn,
          zIn: bodyTopZIn,
          rotationDeg: 0,
          /* ⚠ A TRIANGLE, written as a quad with its two low corners
             coincident — the bottom face is FLAT on the panel's top deck and
             the top face is the roof plane, so the section really does come
             to a point at the shallow end. */
          trapezoidCornersIn: [
            { xIn: wedgeShallowXIn, zIn: bodyTopZIn + shallowRiseIn },
            { xIn: wedgeDeepXIn, zIn: bodyTopZIn + shallowRiseIn + wedgeDeepestIn },
            { xIn: wedgeDeepXIn, zIn: bodyTopZIn },
            { xIn: wedgeShallowXIn, zIn: bodyTopZIn },
          ],
          trapezoidDepthIn: GABLE_PEAK_WEDGE_THICKNESS_IN,
        },
        role: "stud",
        qty: 1,
        notes:
          `${face} wythe — tapered rip from a ${stock}, ${wedgeDeepestIn.toFixed(2)}in deep to a feather edge over ` +
          `${wedgeRunIn.toFixed(2)}in. His "long cut triangle"; the taper IS the roof pitch.` +
          (openRunIn > 1e-6
            ? ` ⚠ The inner ${openRunIn.toFixed(2)}in next to the ridge is left OPEN — the void there is up to ` +
              `${deepestIn.toFixed(2)}in deep, more than a ${stock} can rip. Pack it with straw on site (his call, 2026-11-13).`
            : ""),
      });
    }

    /* The lid. ⚠ Plumb-cut at both ends — *"I forgot to plumb cut the edges
       of the plywood"* — which `plumbEndedSlopedBoardCornersIn` has done all
       along, and is the detail the gable/roof flush junction took four passes
       to get right.

       Its TOP face is the panel's top surface: the wedge's sloped face plus
       the lid's own vertical thickness. So at the panel's outer edge, where
       the wedge has feathered to nothing, the surface is exactly one lid
       above the body — which is what `gablePeakWedgeBodyTopZIn` subtracts. */
    const runRiseIn = Math.abs(slope.toRiseIn - slope.fromRiseIn);
    const lidVerticalThicknessIn = gablePeakLidVerticalThicknessIn(runIn, runRiseIn);
    const lowIsFrom = slope.fromRiseIn <= slope.toRiseIn;
    const lowXIn = lowIsFrom ? slope.fromXIn : slope.toXIn;
    const highXIn = lowIsFrom ? slope.toXIn : slope.fromXIn;
    const lowTopZIn = bodyTopZIn + Math.min(slope.fromRiseIn, slope.toRiseIn) + lidVerticalThicknessIn;
    const highTopZIn = bodyTopZIn + Math.max(slope.fromRiseIn, slope.toRiseIn) + lidVerticalThicknessIn;
    out.push({
      memberId: `gable_peak_lid_${slope.id}`,
      material: "plywood",
      speciesGrade: null,
      plySpec: GABLE_PEAK_BOX_PLY_SPEC,
      nominalSize: null,
      actualDimsIn: {
        thicknessIn: SKIN_THICKNESS_IN,
        widthIn: depthIn,
        lengthIn: Math.hypot(runIn, runRiseIn),
      },
      orientation: "diagonal",
      position: {
        xIn: slope.fromXIn,
        yIn: 0,
        zIn: bodyTopZIn,
        rotationDeg: 0,
        trapezoidCornersIn: plumbEndedSlopedBoardCornersIn(
          lowXIn,
          lowTopZIn,
          highXIn,
          highTopZIn,
          lidVerticalThicknessIn,
        ),
        trapezoidDepthIn: depthIn,
      },
      role: "skin",
      qty: 1,
      notes: `${slope.id} lid of the five-sided peak — one of his two pieces, plumb cut at both ends`,
    });
  }
  return out;
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
  const bodyHeightIn = top ? gablePeakWedgeBodyTopZIn(widthIn, heightIn, top) : heightIn;
  const slot = gablePeakSlotIn(widthIn, bodyHeightIn, rooflineBelowTopIn);
  /* ⚠ **Never a centre nailer on this panel.** A nailer stands at mid-width,
     which is exactly where the box is, so the two would occupy the same
     straw. The box is the thing the panel exists for. */
  /* ⚠ **THE BODY IS AN ORDINARY FLAT-TOPPED COLUMN PANEL**, complete with its
     own top plate and top skin, just one lid's thickness lower than the
     panel's top surface. That is his design and it is what makes the top
     additive — nothing is removed from the body, so there is no shared top
     assembly to negotiate. */
  const column = buildColumnStyleMembers(widthIn, depthIn, bodyHeightIn, includeNailer && false, girtStyle);
  const added = [...buildBoxMembers(slot, depthIn), ...buildStudPacks(slot, depthIn, bodyHeightIn)];
  /* The top is added AFTER the cut pass: it sits entirely above the body, so
     nothing in it runs across the box or the packs. */
  const peak = top ? buildGablePeakWedgeTopMembers(widthIn, depthIn, heightIn, top) : [];
  return [...cutRowsAroundObstacles(column, added), ...added, ...peak];
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
