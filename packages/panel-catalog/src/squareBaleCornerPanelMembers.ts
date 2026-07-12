import type { PanelComponentSchema, PanelMember } from "./componentSchema";
import { squareBalePanel } from "./data";
import {
  LUMBER_SPECIES_GRADE,
  PLATE_2X4_THICKNESS_IN,
  PLATE_END_CLEARANCE_IN,
  SKIN_THICKNESS_IN,
  buildNailer,
  buildSkins,
} from "./panelMemberHelpers";
import {
  STUD_CONFIGS,
  VOID_FILL_WIDTH_IN,
  buildBlockingGirtRows,
  buildEndBlocks,
  studAssemblyThicknessIn,
  type StudConfig,
  type StudConfigSpec,
} from "./squareBalePanelMembers";

const SQUARE_BALE_CORNER_GIRT_ROW_COUNT = 2; // same baseline as the plain Square Bale Panel

// Tommy: "corner panels for square bale panel style are a standard square
// bale panel (with the rectangle girts) with a double 2x6 stud pack in the
// primary corner. they are standard size at 39in" — only ONE of the
// panel's 2 vertical corner edges (the "primary" one, always modeled as
// the LEFT edge here) gets the reinforced double-2x6 pack; the other edge
// stays a plain single-2x4, same as an ordinary Square Bale Panel.
export const SQUARE_BALE_CORNER_PRIMARY_STUD_CONFIG: StudConfig = "double-2x6";
export const SQUARE_BALE_CORNER_BASE_STUD_CONFIG: StudConfig = "single-2x4";

/** 2 primary-corner studs (front+back, double-2x6 pair each) + 2 base-
 * corner studs (front+back, single-2x4) — the asymmetric analog of
 * `buildSquareBaleCornerStuds`, which assumes one uniform spec for all 4. */
function buildCornerPanelStuds(
  widthIn: number,
  depthIn: number,
  heightIn: number,
  primarySpec: StudConfigSpec,
  baseSpec: StudConfigSpec,
): PanelMember[] {
  const studSpanIn = heightIn - 2 * SKIN_THICKNESS_IN;
  const baseAssemblyThicknessIn = studAssemblyThicknessIn(baseSpec);
  const members: PanelMember[] = [];
  let cornerIdx = 0;

  for (const [side, spec, baseXIn] of [
    ["primary", primarySpec, 0],
    ["base", baseSpec, widthIn - baseAssemblyThicknessIn],
  ] as const) {
    for (const yIn of [0, depthIn - spec.studWidthIn]) {
      cornerIdx++;
      for (let i = 0; i < spec.studCount; i++) {
        const xIn = baseXIn + i * (spec.studThicknessIn + spec.studGapIn);
        members.push({
          memberId: spec.studCount === 1 ? `stud_corner_${cornerIdx}` : `stud_corner_${cornerIdx}_${i === 0 ? "outer" : "inner"}`,
          material: "dimensional_lumber",
          speciesGrade: LUMBER_SPECIES_GRADE,
          plySpec: null,
          nominalSize: spec.studWidthIn === 5.5 ? "2x6" : "2x4",
          actualDimsIn: { thicknessIn: spec.studThicknessIn, widthIn: spec.studWidthIn, lengthIn: studSpanIn },
          orientation: "vertical",
          position: { xIn, yIn, zIn: SKIN_THICKNESS_IN, rotationDeg: 0 },
          role: "stud",
          qty: 1,
          notes:
            spec.studCount === 1
              ? `${side} corner, single stud.`
              : `${i === 0 ? "outer" : "inner"} stud of the ${side} corner's double pair.`,
        });
      }
    }
  }
  return members;
}

/** Timber fiber board void-fill — only the primary (doubled) corner has a
 * stud pair to fill between; the base corner is a single stud with no gap. */
function buildCornerPanelVoidFill(depthIn: number, heightIn: number, primarySpec: StudConfigSpec): PanelMember[] {
  if (primarySpec.studCount === 1) return [];
  const studSpanIn = heightIn - 2 * SKIN_THICKNESS_IN;
  const members: PanelMember[] = [];
  let cornerIdx = 0;
  for (const yIn of [0, depthIn - primarySpec.studWidthIn]) {
    cornerIdx++;
    members.push({
      memberId: `void_fill_primary_corner_${cornerIdx}`,
      material: "wood_fiber_board",
      speciesGrade: null,
      plySpec: null,
      nominalSize: null,
      actualDimsIn: { thicknessIn: primarySpec.studGapIn, widthIn: VOID_FILL_WIDTH_IN, lengthIn: studSpanIn },
      orientation: "vertical",
      position: { xIn: primarySpec.studThicknessIn, yIn, zIn: SKIN_THICKNESS_IN, rotationDeg: 0 },
      role: "blocking",
      qty: 1,
      notes: `Timber fiber board filling the gap between the primary corner's double stud pair, position ${cornerIdx}, full stud-span height.`,
    });
  }
  return members;
}

/** Bottom/top plates sized to the BASE (single-2x4, 3.5in) stud width —
 * matching the plain Square Bale Panels this corner sits next to along the
 * wall — for their full length, rather than widening the whole board for
 * the sake of one wider corner. */
function buildCornerPanelPlates(widthIn: number, depthIn: number, heightIn: number, baseSpec: StudConfigSpec): PanelMember[] {
  const plateLengthIn = widthIn - 2 * PLATE_END_CLEARANCE_IN;
  const members: PanelMember[] = [];
  for (const [prefix, zIn] of [
    ["bottom", SKIN_THICKNESS_IN],
    ["top", heightIn - SKIN_THICKNESS_IN - PLATE_2X4_THICKNESS_IN],
  ] as const) {
    members.push(
      {
        memberId: `${prefix}_plate_2x4_ext`,
        material: "dimensional_lumber",
        speciesGrade: LUMBER_SPECIES_GRADE,
        plySpec: null,
        nominalSize: "2x4",
        actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: baseSpec.studWidthIn, lengthIn: plateLengthIn },
        orientation: "flat",
        position: { xIn: PLATE_END_CLEARANCE_IN, yIn: 0, zIn, rotationDeg: 0 },
        role: "plate",
        qty: 1,
        notes: "exterior-wythe edge, sized to the panel's base stud width — see the primary-corner lip pieces for the wider corner's reach.",
      },
      {
        memberId: `${prefix}_plate_2x4_int`,
        material: "dimensional_lumber",
        speciesGrade: LUMBER_SPECIES_GRADE,
        plySpec: null,
        nominalSize: "2x4",
        actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: baseSpec.studWidthIn, lengthIn: plateLengthIn },
        orientation: "flat",
        position: { xIn: PLATE_END_CLEARANCE_IN, yIn: depthIn - baseSpec.studWidthIn, zIn, rotationDeg: 0 },
        role: "plate",
        qty: 1,
        notes: "interior-wythe edge, sized to the panel's base stud width — see the primary-corner lip pieces for the wider corner's reach.",
      },
    );
  }
  return members;
}

/**
 * Plate "lip" pieces (Tommy, from a reference photo: "see clearly how the
 * second stud is lipped up on the bottom plate? same detail for the top
 * plate") — the main plate boards above are sized to the BASE (3.5in)
 * stud width along their whole length, so at the primary corner they fall
 * short of the wider double-2x6 pack's 5.5in face by 2in on both the ext
 * and int wythe. Rather than widening the entire board, a short lip piece
 * (sized to the corner stud assembly's own footprint) bridges just that
 * delta, right at the corner, for both the bottom and top plate.
 */
function buildCornerPanelPlateLips(depthIn: number, heightIn: number, primarySpec: StudConfigSpec, baseSpec: StudConfigSpec): PanelMember[] {
  const deltaWidthIn = primarySpec.studWidthIn - baseSpec.studWidthIn;
  if (deltaWidthIn <= 0) return [];
  const lipLengthIn = studAssemblyThicknessIn(primarySpec);
  const members: PanelMember[] = [];
  for (const [prefix, zIn] of [
    ["bottom", SKIN_THICKNESS_IN],
    ["top", heightIn - SKIN_THICKNESS_IN - PLATE_2X4_THICKNESS_IN],
  ] as const) {
    for (const [wythe, yIn] of [
      ["ext", baseSpec.studWidthIn],
      ["int", depthIn - primarySpec.studWidthIn],
    ] as const) {
      members.push({
        memberId: `${prefix}_plate_lip_${wythe}`,
        material: "dimensional_lumber",
        speciesGrade: LUMBER_SPECIES_GRADE,
        plySpec: null,
        nominalSize: primarySpec.studWidthIn === 5.5 ? "2x6" : "2x4",
        actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: deltaWidthIn, lengthIn: lipLengthIn },
        orientation: "flat",
        position: { xIn: 0, yIn, zIn, rotationDeg: 0 },
        role: "plate",
        qty: 1,
        notes: `Bridges the ${baseSpec.studWidthIn}in base plate up to the full ${primarySpec.studWidthIn}in face of the doubled primary-corner stud pack, right at the corner instead of widening the whole plate board.`,
      });
    }
  }
  return members;
}

/**
 * Every physical member of a Square Bale Corner Panel: a standard 39in
 * Square Bale Panel body (skins, rectangular blocking girts, end blocks —
 * see squareBalePanelMembers.ts) but with a double-2x6 stud pack at the
 * "primary" corner (always modeled as the panel's left edge) instead of a
 * single-2x4, plate/girt lip pieces bridging up to that wider corner (see
 * buildCornerPanelPlateLips and the "outer stud" girt bar this shares with
 * `buildBlockingGirtRows`), and the matching timber-fiber-board void fill
 * between the doubled pair. The opposite edge stays a plain single-2x4,
 * matching the ordinary Square Bale Panels this one sits next to along a
 * wall run.
 */
export function buildSquareBaleCornerPanelMembers(depthIn: number, heightIn: number, includeNailer: boolean, nailerOffsetIn = 0): PanelMember[] {
  const widthIn = squareBalePanel.widthIn;
  const primarySpec = STUD_CONFIGS[SQUARE_BALE_CORNER_PRIMARY_STUD_CONFIG];
  const baseSpec = STUD_CONFIGS[SQUARE_BALE_CORNER_BASE_STUD_CONFIG];
  const studSpanIn = heightIn - 2 * SKIN_THICKNESS_IN;
  const members: PanelMember[] = [
    ...buildSkins(widthIn, depthIn, heightIn),
    ...buildCornerPanelPlates(widthIn, depthIn, heightIn, baseSpec),
    ...buildCornerPanelPlateLips(depthIn, heightIn, primarySpec, baseSpec),
    ...buildCornerPanelStuds(widthIn, depthIn, heightIn, primarySpec, baseSpec),
    ...buildCornerPanelVoidFill(depthIn, heightIn, primarySpec),
    ...buildBlockingGirtRows(SQUARE_BALE_CORNER_GIRT_ROW_COUNT, widthIn, depthIn, studSpanIn, primarySpec, baseSpec),
    ...buildEndBlocks(widthIn, depthIn, heightIn, studAssemblyThicknessIn(primarySpec), studAssemblyThicknessIn(baseSpec)),
  ];
  if (includeNailer) members.push(buildNailer(widthIn, heightIn, nailerOffsetIn));
  return members;
}

/**
 * Wraps `buildSquareBaleCornerPanelMembers` in the full shared component
 * schema — see `buildStandardPanelSchema`'s doc comment for the same
 * rationale.
 */
export function buildSquareBaleCornerPanelSchema(depthIn: number, heightIn: number, includeNailer: boolean, nailerOffsetIn = 0): PanelComponentSchema {
  return {
    schemaVersion: "0.1",
    componentType: "panel",
    id: "square_bale_corner_panel",
    displayName: "Square Bale Corner Panel",
    status: "draft",
    derivedFrom: "square_bale_panel",
    overallDimensions: { heightIn, widthIn: squareBalePanel.widthIn, depthIn },
    members: buildSquareBaleCornerPanelMembers(depthIn, heightIn, includeNailer, nailerOffsetIn),
    fasteners: [],
    notes: [
      {
        type: "deviation",
        text:
          "Only one of the panel's 2 corner edges (the 'primary' one, modeled as the left edge) is reinforced with " +
          "the double-2x6 pack; the other stays a plain single-2x4 like an ordinary Square Bale Panel. Plate/girt " +
          "lip pieces bridging up to the wider corner (from a reference photo) are a best-effort interpretation of " +
          "that detail, not independently confirmed against a shop drawing. Whether a nailer (in addition to the " +
          "corner) should also get its own girt/plate lip is not yet modeled — flagged as an open follow-up.",
      },
    ],
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
