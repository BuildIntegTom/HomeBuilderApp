import type { PanelComponentSchema, PanelMember } from "./componentSchema";
import {
  ROOF_CATCHER_BEAM_DEPTH_IN,
  ROOF_CATCHER_BEAM_TOTAL_THICKNESS_IN,
} from "./roofCatcherBeamMembers";
import { COLUMN_TOTAL_WIDTH_IN, buildColumnStyleMembers } from "./columnPanelMembers";
import {
  LUMBER_2X6_WIDTH_IN,
  LUMBER_SPECIES_GRADE,
  PLATE_2X4_THICKNESS_IN,
  SKIN_THICKNESS_IN,
  LEGACY_GIRT_STYLE,
  type GirtStyle,
  clearRunsIn,
  memberBoxIn,
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
export function gablePeakSlotIn(widthIn: number, heightIn: number): GablePeakSlot {
  const { topZIn } = gablePeakClearZIn(heightIn);
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
 * Every physical member of a Gable Peak Panel: a Column Panel, with its
 * cross-members cut around a plywood furring box, plus the box and the two
 * 2x6 packs that carry it.
 */
export function buildGablePeakPanelMembers(
  depthIn: number,
  heightIn: number,
  includeNailer: boolean,
  girtStyle: GirtStyle = LEGACY_GIRT_STYLE,
  widthIn: number = COLUMN_TOTAL_WIDTH_IN,
): PanelMember[] {
  const slot = gablePeakSlotIn(widthIn, heightIn);
  /* ⚠ **Never a centre nailer on this panel.** A nailer stands at mid-width,
     which is exactly where the box is, so the two would occupy the same
     straw. The box is the thing the panel exists for. */
  const column = buildColumnStyleMembers(widthIn, depthIn, heightIn, includeNailer && false, girtStyle);
  const added = [...buildBoxMembers(slot, depthIn), ...buildStudPacks(slot, depthIn, heightIn)];
  return [...cutRowsAroundObstacles(column, added), ...added];
}

/** Wraps `buildGablePeakPanelMembers` in the full shared component schema. */
export function buildGablePeakPanelSchema(
  depthIn: number,
  heightIn: number,
  includeNailer: boolean,
  girtStyle: GirtStyle = LEGACY_GIRT_STYLE,
  widthIn: number = COLUMN_TOTAL_WIDTH_IN,
): PanelComponentSchema {
  return {
    schemaVersion: "0.1",
    componentType: "panel",
    id: "gable_peak_panel",
    displayName: "Gable Peak Panel",
    status: "draft",
    derivedFrom: "column_panel",
    overallDimensions: { heightIn, widthIn, depthIn },
    members: buildGablePeakPanelMembers(depthIn, heightIn, includeNailer, girtStyle, widthIn),
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
