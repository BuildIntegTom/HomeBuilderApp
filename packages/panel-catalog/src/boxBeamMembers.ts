import type { PanelComponentSchema, PanelMember } from "./componentSchema";
import { SKIN_PLY_SPEC } from "./panelMemberHelpers";

/**
 * Two-story roof-bearing box beam (Tommy: "if the building is two stories,
 * it gets a box beam that is made of two 9in x 2in LVL's with 3/4in
 * plywood for top and bottom caps") — two LVL webs (2in thick, 9in tall)
 * at the exterior/interior wythe edges, running the wall's full length,
 * capped top and bottom by 3/4in plywood spanning the full depth. Hollow
 * inside (between the two webs, between the two caps) — blown in with
 * dense-pack cellulose (see computeDensePackCelluloseVolume below).
 */
export const BOX_BEAM_LVL_THICKNESS_IN = 2;
export const BOX_BEAM_LVL_HEIGHT_IN = 9;
export const BOX_BEAM_CAP_THICKNESS_IN = 0.75;

export function buildBoxBeamMembers(lengthIn: number, depthIn: number): PanelMember[] {
  const webZIn = BOX_BEAM_CAP_THICKNESS_IN;
  return [
    {
      memberId: "box_beam_bottom_cap",
      material: "plywood",
      speciesGrade: null,
      plySpec: SKIN_PLY_SPEC,
      nominalSize: null,
      actualDimsIn: { thicknessIn: BOX_BEAM_CAP_THICKNESS_IN, widthIn: depthIn, lengthIn },
      orientation: "flat",
      position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0 },
      role: "skin",
      qty: 1,
      notes: "Bottom cap — bears directly on the wall panel below.",
    },
    {
      memberId: "box_beam_lvl_exterior",
      material: "dimensional_lumber",
      speciesGrade: "LVL",
      plySpec: null,
      nominalSize: "9x2 LVL",
      actualDimsIn: { thicknessIn: BOX_BEAM_LVL_THICKNESS_IN, widthIn: BOX_BEAM_LVL_HEIGHT_IN, lengthIn },
      orientation: "horizontal",
      position: { xIn: 0, yIn: 0, zIn: webZIn, rotationDeg: 0 },
      role: "plate",
      qty: 1,
      notes: "Exterior-wythe web.",
    },
    {
      memberId: "box_beam_lvl_interior",
      material: "dimensional_lumber",
      speciesGrade: "LVL",
      plySpec: null,
      nominalSize: "9x2 LVL",
      actualDimsIn: { thicknessIn: BOX_BEAM_LVL_THICKNESS_IN, widthIn: BOX_BEAM_LVL_HEIGHT_IN, lengthIn },
      orientation: "horizontal",
      position: { xIn: 0, yIn: depthIn - BOX_BEAM_LVL_THICKNESS_IN, zIn: webZIn, rotationDeg: 0 },
      role: "plate",
      qty: 1,
      notes: "Interior-wythe web.",
    },
    {
      memberId: "box_beam_top_cap",
      material: "plywood",
      speciesGrade: null,
      plySpec: SKIN_PLY_SPEC,
      nominalSize: null,
      actualDimsIn: { thicknessIn: BOX_BEAM_CAP_THICKNESS_IN, widthIn: depthIn, lengthIn },
      orientation: "flat",
      position: { xIn: 0, yIn: 0, zIn: webZIn + BOX_BEAM_LVL_HEIGHT_IN, rotationDeg: 0 },
      role: "skin",
      qty: 1,
      notes: "Top cap — the roof (truss plate or structural panel) bears on this.",
    },
  ];
}

export interface DensePackCelluloseVolumeResult {
  cavityWidthIn: number;
  volumeFt3: number;
}

/** Volume of the hollow box-beam cavity blown in with dense-pack cellulose
 * — between the two LVL webs, between the top/bottom caps, running the
 * beam's full length. */
export function computeDensePackCelluloseVolume(lengthIn: number, depthIn: number): DensePackCelluloseVolumeResult {
  const cavityWidthIn = Math.max(0, depthIn - 2 * BOX_BEAM_LVL_THICKNESS_IN);
  const volumeFt3 = (cavityWidthIn * BOX_BEAM_LVL_HEIGHT_IN * lengthIn) / 1728;
  return { cavityWidthIn, volumeFt3 };
}

export function buildBoxBeamSchema(lengthIn: number, depthIn: number): PanelComponentSchema {
  return {
    schemaVersion: "0.1",
    componentType: "connection_detail",
    id: "box_beam",
    displayName: "Box Beam (Two-Story Roof Bearing)",
    status: "draft",
    derivedFrom: null,
    overallDimensions: { heightIn: 2 * BOX_BEAM_CAP_THICKNESS_IN + BOX_BEAM_LVL_HEIGHT_IN, widthIn: lengthIn, depthIn },
    members: buildBoxBeamMembers(lengthIn, depthIn),
    fasteners: [],
    notes: [
      {
        type: "deviation",
        text: "Dense-pack cellulose density/quantity uses a standard published installed-density reference (see computeDensePackCelluloseVolume), not a Building Integrity-confirmed figure yet.",
      },
    ],
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
