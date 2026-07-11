import type { PanelComponentSchema, PanelMember } from "./componentSchema";
import { LUMBER_SPECIES_GRADE, PLATE_2X4_THICKNESS_IN, PLATE_2X4_WIDTH_IN, SKIN_PLY_SPEC } from "./panelMemberHelpers";

/**
 * Single-story roof-bearing truss plate (Tommy: "if the building is one
 * story, it gets a truss plate on top made out of a 2x4 run on inside wyth
 * and 2x6 on outside wyth topped with 3/4in plywood") — a 2x4 along the
 * interior wythe edge and a 2x6 along the exterior wythe edge (its own
 * 5.5in width doubling as the Roof tab's "truss plate inset" — see
 * trussPlateInsetDefaultIn in data.ts), both capped by one continuous 3/4in
 * plywood top skin spanning the full depth. The two edge members leave an
 * open cavity between them (depthIn - 3.5in - insetIn wide, 1.5in tall,
 * running the wall length) — this is the "internal volume... between the
 * 2x4 and 2x6" Tommy described, filled with Timber HP board insulation
 * (see computeTimberHpVolume below).
 */
export const PLATE_2X6_THICKNESS_IN = 1.5;
export const PLATE_2X6_WIDTH_IN = 5.5;

export function buildTrussPlateMembers(lengthIn: number, depthIn: number, insetIn: number = PLATE_2X6_WIDTH_IN): PanelMember[] {
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
      memberId: "truss_plate_2x6_exterior",
      material: "dimensional_lumber",
      speciesGrade: LUMBER_SPECIES_GRADE,
      plySpec: null,
      nominalSize: "2x6",
      actualDimsIn: { thicknessIn: PLATE_2X6_THICKNESS_IN, widthIn: insetIn, lengthIn },
      orientation: "flat",
      position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0 },
      role: "plate",
      qty: 1,
      notes: "Exterior-wythe edge — its own width is the roof truss's bearing inset from the exterior face.",
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
      notes: "Caps both edge members — the open cavity below (between the 2x4 and 2x6) is filled with Timber HP.",
    },
  ];
}

export interface TimberHpVolumeResult {
  gapWidthIn: number;
  volumeFt3: number;
}

/**
 * Volume of the Timber HP-filled cavity under the truss plate's plywood
 * cap — the gap left between the interior 2x4 and exterior 2x6 (whatever
 * doesn't overlap either edge member), 1.5in tall (both edge members'
 * shared thickness), running the plate's full length.
 */
export function computeTimberHpVolume(lengthIn: number, depthIn: number, insetIn: number = PLATE_2X6_WIDTH_IN): TimberHpVolumeResult {
  const gapWidthIn = Math.max(0, depthIn - PLATE_2X4_WIDTH_IN - insetIn);
  const volumeFt3 = (gapWidthIn * PLATE_2X4_THICKNESS_IN * lengthIn) / 1728;
  return { gapWidthIn, volumeFt3 };
}

export function buildTrussPlateSchema(lengthIn: number, depthIn: number, insetIn: number = PLATE_2X6_WIDTH_IN): PanelComponentSchema {
  return {
    schemaVersion: "0.1",
    componentType: "connection_detail",
    id: "truss_plate",
    displayName: "Truss Plate (Single-Story Roof Bearing)",
    status: "draft",
    derivedFrom: null,
    overallDimensions: { heightIn: PLATE_2X6_THICKNESS_IN + 0.75, widthIn: lengthIn, depthIn },
    members: buildTrussPlateMembers(lengthIn, depthIn, insetIn),
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
