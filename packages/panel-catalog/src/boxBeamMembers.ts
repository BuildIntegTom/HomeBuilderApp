import type { PanelComponentSchema, PanelMember } from "./componentSchema";
import { LUMBER_SPECIES_GRADE, SKIN_PLY_SPEC } from "./panelMemberHelpers";

/**
 * Two-story roof-bearing box beam (Tommy: "if the building is two stories,
 * it gets a box beam that is made of two 9in x 2in LVL's with 3/4in
 * plywood for top and bottom caps") — two webs on edge (interior + exterior
 * wythe), running the wall's full length, capped top and bottom by 3/4in
 * plywood spanning the full depth. Hollow inside (between the two webs,
 * between the two caps) — blown in with dense-pack cellulose (see
 * computeDensePackCelluloseVolume below).
 *
 * Tommy later asked for a choice of web material/size (2 LVL depths plus
 * 2x8/2x10/2x12 dimensional lumber) — see BOX_BEAM_SIZE_OPTIONS. Every size
 * shares this exact same cap/fill assembly shape; only the web's own
 * thickness/height/species/nominal-size callout changes. BOX_BEAM_LVL_*
 * constants stay exported (unchanged) since they're what the "9x2-lvl"
 * option itself is built from, and the original 2-arg call shape still
 * works via BOX_BEAM_SIZE_DEFAULT.
 */
export const BOX_BEAM_LVL_THICKNESS_IN = 2;
export const BOX_BEAM_LVL_HEIGHT_IN = 9;
export const BOX_BEAM_CAP_THICKNESS_IN = 0.75;
/** Actual (S4S) thickness of any "2x_" dimensional-lumber web, on edge. */
export const BOX_BEAM_DIMENSIONAL_THICKNESS_IN = 1.5;

export const BOX_BEAM_SIZE_OPTIONS = [
  {
    id: "9x2-lvl",
    label: "9in x 2in LVL",
    speciesGrade: "LVL",
    nominalSize: "9x2 LVL",
    webThicknessIn: BOX_BEAM_LVL_THICKNESS_IN,
    webHeightIn: BOX_BEAM_LVL_HEIGHT_IN,
  },
  {
    id: "11.25x2-lvl",
    label: "11-1/4in x 2in LVL",
    speciesGrade: "LVL",
    nominalSize: "11-1/4x2 LVL",
    webThicknessIn: 2,
    webHeightIn: 11.25,
  },
  {
    id: "2x8-dimensional",
    label: "2x8 Dimensional Lumber",
    speciesGrade: LUMBER_SPECIES_GRADE,
    nominalSize: "2x8",
    webThicknessIn: BOX_BEAM_DIMENSIONAL_THICKNESS_IN,
    webHeightIn: 7.25,
  },
  {
    id: "2x10-dimensional",
    label: "2x10 Dimensional Lumber",
    speciesGrade: LUMBER_SPECIES_GRADE,
    nominalSize: "2x10",
    webThicknessIn: BOX_BEAM_DIMENSIONAL_THICKNESS_IN,
    webHeightIn: 9.25,
  },
  {
    id: "2x12-dimensional",
    label: "2x12 Dimensional Lumber",
    speciesGrade: LUMBER_SPECIES_GRADE,
    nominalSize: "2x12",
    webThicknessIn: BOX_BEAM_DIMENSIONAL_THICKNESS_IN,
    webHeightIn: 11.25,
  },
] as const;

export type BoxBeamSizeId = (typeof BOX_BEAM_SIZE_OPTIONS)[number]["id"];
export const BOX_BEAM_SIZE_DEFAULT: BoxBeamSizeId = "9x2-lvl";

function resolveBoxBeamSize(sizeId: BoxBeamSizeId) {
  return BOX_BEAM_SIZE_OPTIONS.find((s) => s.id === sizeId) ?? BOX_BEAM_SIZE_OPTIONS[0];
}

/** Overall assembly height (cap + web + cap) for a given box-beam size —
 * shared by buildBoxBeamMembers/buildBoxBeamSchema and by
 * roofBearingAssembly.ts's computeBoxBeamHeightDeltaIn. */
export function computeBoxBeamAssemblyHeightIn(sizeId: BoxBeamSizeId = BOX_BEAM_SIZE_DEFAULT): number {
  return 2 * BOX_BEAM_CAP_THICKNESS_IN + resolveBoxBeamSize(sizeId).webHeightIn;
}

export function buildBoxBeamMembers(lengthIn: number, depthIn: number, sizeId: BoxBeamSizeId = BOX_BEAM_SIZE_DEFAULT): PanelMember[] {
  const size = resolveBoxBeamSize(sizeId);
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
      speciesGrade: size.speciesGrade,
      plySpec: null,
      nominalSize: size.nominalSize,
      actualDimsIn: { thicknessIn: size.webThicknessIn, widthIn: size.webHeightIn, lengthIn },
      orientation: "horizontal",
      position: { xIn: 0, yIn: 0, zIn: webZIn, rotationDeg: 0 },
      role: "plate",
      qty: 1,
      notes: "Exterior-wythe web.",
    },
    {
      memberId: "box_beam_lvl_interior",
      material: "dimensional_lumber",
      speciesGrade: size.speciesGrade,
      plySpec: null,
      nominalSize: size.nominalSize,
      actualDimsIn: { thicknessIn: size.webThicknessIn, widthIn: size.webHeightIn, lengthIn },
      orientation: "horizontal",
      position: { xIn: 0, yIn: depthIn - size.webThicknessIn, zIn: webZIn, rotationDeg: 0 },
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
      position: { xIn: 0, yIn: 0, zIn: webZIn + size.webHeightIn, rotationDeg: 0 },
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
 * — between the two webs, between the top/bottom caps, running the beam's
 * full length. Fill density (see densePackCelluloseDensityLbFt3 in
 * data.ts) is the same for every size — only the cavity's own height
 * changes. */
export function computeDensePackCelluloseVolume(
  lengthIn: number,
  depthIn: number,
  sizeId: BoxBeamSizeId = BOX_BEAM_SIZE_DEFAULT,
): DensePackCelluloseVolumeResult {
  const size = resolveBoxBeamSize(sizeId);
  const cavityWidthIn = Math.max(0, depthIn - 2 * size.webThicknessIn);
  const volumeFt3 = (cavityWidthIn * size.webHeightIn * lengthIn) / 1728;
  return { cavityWidthIn, volumeFt3 };
}

export function buildBoxBeamSchema(lengthIn: number, depthIn: number, sizeId: BoxBeamSizeId = BOX_BEAM_SIZE_DEFAULT): PanelComponentSchema {
  const size = resolveBoxBeamSize(sizeId);
  return {
    schemaVersion: "0.1",
    componentType: "connection_detail",
    id: "box_beam",
    displayName: `Box Beam (Two-Story Roof Bearing) — ${size.label}`,
    status: "draft",
    derivedFrom: null,
    overallDimensions: { heightIn: computeBoxBeamAssemblyHeightIn(sizeId), widthIn: lengthIn, depthIn },
    members: buildBoxBeamMembers(lengthIn, depthIn, sizeId),
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
