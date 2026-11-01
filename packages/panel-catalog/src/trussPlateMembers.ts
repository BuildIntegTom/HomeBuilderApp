import type { PanelComponentSchema, PanelMember } from "./componentSchema";
import { LUMBER_SPECIES_GRADE, PLATE_2X4_THICKNESS_IN, PLATE_2X4_WIDTH_IN, SKIN_PLY_SPEC } from "./panelMemberHelpers";

/**
 * Single-story roof-bearing truss plate: **two 2x4s on edge-to-edge wythes
 * with Timber HP between them, capped by 3/4in plywood** — the whole thing
 * the full depth of the wall.
 *
 * > *"On top of the first layer of wall system, there should be auto spawned
 * > a truss plate detail - two 2x4's and a default 8.5" piece of timber HP
 * > insulation. The gable end panels and the roof panels should both sit
 * > directly on this 2x4 top wall ring."* — Tommy, 2026-11-01
 *
 * > *"The plate width is now basically the entire truss plate width = 15.5"
 * > usually."* — Tommy, 2026-11-01
 *
 * ⚠ **This SUPERSEDES his own earlier spec**, which was *"a 2x4 run on
 * inside wyth and 2x6 on outside wyth topped with 3/4in plywood"* and left a
 * 6 1/2in Timber HP cavity. Both versions come to the same 15 1/2in and the
 * same 2 1/4in assembly height, so no roofline moves — what changes is the
 * exterior member (2x6 → 2x4) and the insulation (6 1/2in → 8 1/2in).
 * His 8.5in is not an independent number: two 2x4s in a 15 1/2in wall leave
 * exactly 8 1/2in between them, which is how the two halves of his sentence
 * check each other. On a wall of another depth the cavity follows the wall.
 *
 * ⚠ **The assembly is no longer deformed by `trussPlateInsetIn`.** That
 * setting used to double as the exterior member's width (*"its own 5.5in
 * width doubling as the Roof tab's truss plate inset"*), which tied two
 * unrelated things together: what the plate is MADE OF, and how far in from
 * the exterior face a truss bears. His *"the plate width is now basically the
 * entire truss plate width"* unties them — the roof bears on the whole
 * plate now (see `ROOF_CAP_SEAT_WIDTH_IN`), so the inset means only what it
 * says elsewhere: the gable row's own inset and the heel seat.
 */
/** Both wythe members are 2x4s now. Kept under the old names because
 * `roofBearingAssembly` quotes the thickness as the assembly's own height,
 * and that height is deliberately unchanged. */
export const PLATE_2X6_THICKNESS_IN = PLATE_2X4_THICKNESS_IN;
/** @deprecated The exterior member is a 2x4; this is kept only so a saved
 * project's 5.5in inset still resolves to a valid Roof-tab option. */
export const PLATE_2X6_WIDTH_IN = 5.5;

/** What the Timber HP cavity comes to: whatever the two 2x4s leave. 8 1/2in
 * in a 15 1/2in wall, which is the figure he gave. */
export function trussPlateTimberHpWidthIn(depthIn: number): number {
  return Math.max(0, depthIn - 2 * PLATE_2X4_WIDTH_IN);
}

export function buildTrussPlateMembers(lengthIn: number, depthIn: number): PanelMember[] {
  return [
    {
      memberId: "truss_plate_2x4_interior",
      material: "dimensional_lumber",
      speciesGrade: LUMBER_SPECIES_GRADE,
      plySpec: null,
      nominalSize: "2x4",
      actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn },
      orientation: "flat",
      position: { xIn: 0, yIn: depthIn - PLATE_2X4_WIDTH_IN, zIn: 0, rotationDeg: 0 },
      role: "plate",
      qty: 1,
      notes: "Interior-wythe edge.",
    },
    {
      memberId: "truss_plate_2x4_exterior",
      material: "dimensional_lumber",
      speciesGrade: LUMBER_SPECIES_GRADE,
      plySpec: null,
      nominalSize: "2x4",
      actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn },
      orientation: "flat",
      position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0 },
      role: "plate",
      qty: 1,
      notes: "Exterior-wythe edge — flush with the wall's exterior face, which is where the roof panel's plumb leg lands.",
    },
    {
      memberId: "truss_plate_skin",
      material: "plywood",
      speciesGrade: null,
      plySpec: SKIN_PLY_SPEC,
      nominalSize: null,
      actualDimsIn: { thicknessIn: 0.75, widthIn: depthIn, lengthIn },
      orientation: "flat",
      position: { xIn: 0, yIn: 0, zIn: PLATE_2X4_THICKNESS_IN, rotationDeg: 0 },
      role: "skin",
      qty: 1,
      notes: "Caps both 2x4s — the cavity below them is filled with Timber HP, and this is the face the roof and the gable row bear on.",
    },
  ];
}

export interface TimberHpVolumeResult {
  gapWidthIn: number;
  volumeFt3: number;
}

/**
 * Volume of the Timber HP-filled cavity under the truss plate's plywood
 * cap — the gap between the two 2x4s, 1.5in tall (their shared thickness),
 * running the plate's full length. 8 1/2in wide in a 15 1/2in wall, his own
 * figure; see `trussPlateTimberHpWidthIn`.
 */
export function computeTimberHpVolume(lengthIn: number, depthIn: number): TimberHpVolumeResult {
  const gapWidthIn = trussPlateTimberHpWidthIn(depthIn);
  const volumeFt3 = (gapWidthIn * PLATE_2X4_THICKNESS_IN * lengthIn) / 1728;
  return { gapWidthIn, volumeFt3 };
}

export function buildTrussPlateSchema(lengthIn: number, depthIn: number): PanelComponentSchema {
  return {
    schemaVersion: "0.1",
    componentType: "connection_detail",
    id: "truss_plate",
    displayName: "Truss Plate (Single-Story Roof Bearing)",
    status: "draft",
    derivedFrom: null,
    overallDimensions: { heightIn: PLATE_2X4_THICKNESS_IN + 0.75, widthIn: lengthIn, depthIn },
    members: buildTrussPlateMembers(lengthIn, depthIn),
    fasteners: [],
    notes: [
      {
        type: "deviation",
        text: "Timber HP is a real product category (wood-fiber board insulation) but its density/quantity here is a placeholder pending Tommy building the material out further — see computeTimberHpVolume.",
      },
    ],
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
