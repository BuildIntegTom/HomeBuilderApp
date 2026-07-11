import type { PanelComponentSchema, PanelMember } from "./componentSchema";
import {
  LUMBER_SPECIES_GRADE,
  PLATE_2X4_THICKNESS_IN,
  PLATE_2X4_WIDTH_IN,
  PLATE_END_CLEARANCE_IN,
  SKIN_THICKNESS_IN,
  buildNailer,
  buildSkins,
} from "./panelMemberHelpers";

const SQUARE_BALE_GIRT_ROW_COUNT = 2; // same baseline row count as the other panelization styles

/**
 * Stud configuration (Tommy: "the ability to change the 2x4 studs to be
 * double 2x4 studs, or double 2x6 studs... this alters girt shapes and
 * top and bottom plate dimensions for that panel") — "double" is modeled
 * as 2 separate studs per corner spaced apart by a gap (not 2 members
 * face-nailed with no gap), since Tommy separately describes a timber
 * fiber board piece filling the void "in between the two close-standing
 * sets of studs." Plate width follows the stud's own width (3.5in for a
 * 2x4, 5.5in for a 2x6) so the plate still spans the full stud face.
 */
export type StudConfig = "single-2x4" | "double-2x4" | "double-2x6";

export interface StudConfigSpec {
  studCount: 1 | 2;
  studThicknessIn: number;
  studWidthIn: number;
  /** Gap between the 2 studs of a "double" pair — wide enough for the
   * 1.5in-thick timber fiber board void-fill piece (see buildVoidFillPieces). */
  studGapIn: number;
}

// Exported for squareBaleCornerPanelMembers.ts, which builds an asymmetric
// panel (a plain single-2x4 corner on one side, a reinforced double-2x6 on
// the "primary" corner) instead of one uniform config for all 4 corners.
export const STUD_CONFIGS: Record<StudConfig, StudConfigSpec> = {
  "single-2x4": { studCount: 1, studThicknessIn: PLATE_2X4_THICKNESS_IN, studWidthIn: PLATE_2X4_WIDTH_IN, studGapIn: 0 },
  "double-2x4": { studCount: 2, studThicknessIn: PLATE_2X4_THICKNESS_IN, studWidthIn: PLATE_2X4_WIDTH_IN, studGapIn: PLATE_2X4_THICKNESS_IN },
  "double-2x6": { studCount: 2, studThicknessIn: PLATE_2X4_THICKNESS_IN, studWidthIn: 5.5, studGapIn: PLATE_2X4_THICKNESS_IN },
};

/** Total X-footprint one corner's stud (or stud pair + gap) occupies. */
export function studAssemblyThicknessIn(spec: StudConfigSpec): number {
  return spec.studCount === 1 ? spec.studThicknessIn : 2 * spec.studThicknessIn + spec.studGapIn;
}

/** 4 corner studs (or 8, for a double config) — same 4 corner positions as
 * the shared `buildCornerStuds`, but parametric on stud cross-section/count. */
function buildSquareBaleCornerStuds(widthIn: number, depthIn: number, heightIn: number, spec: StudConfigSpec): PanelMember[] {
  const studSpanIn = heightIn - 2 * SKIN_THICKNESS_IN;
  const assemblyThicknessIn = studAssemblyThicknessIn(spec);
  const cornerXs = [0, widthIn - assemblyThicknessIn];
  const cornerYs = [0, depthIn - spec.studWidthIn];
  const members: PanelMember[] = [];
  let cornerIdx = 0;
  for (const yIn of cornerYs) {
    for (const baseXIn of cornerXs) {
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
          notes: spec.studCount === 1 ? undefined : `${i === 0 ? "outer" : "inner"} stud of a double pair, corner ${cornerIdx}.`,
        });
      }
    }
  }
  return members;
}

/** Bottom/top plates, widened to match the stud configuration's own width
 * (Tommy: stud-size changes "alter... top and bottom plate dimensions"). */
function buildSquareBalePlates(widthIn: number, depthIn: number, heightIn: number, spec: StudConfigSpec): PanelMember[] {
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
        nominalSize: spec.studWidthIn === 5.5 ? "2x6" : "2x4",
        actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: spec.studWidthIn, lengthIn: plateLengthIn },
        orientation: "flat",
        position: { xIn: PLATE_END_CLEARANCE_IN, yIn: 0, zIn, rotationDeg: 0 },
        role: "plate",
        qty: 1,
        notes: "exterior-wythe edge",
      },
      {
        memberId: `${prefix}_plate_2x4_int`,
        material: "dimensional_lumber",
        speciesGrade: LUMBER_SPECIES_GRADE,
        plySpec: null,
        nominalSize: spec.studWidthIn === 5.5 ? "2x6" : "2x4",
        actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: spec.studWidthIn, lengthIn: plateLengthIn },
        orientation: "flat",
        position: { xIn: PLATE_END_CLEARANCE_IN, yIn: depthIn - spec.studWidthIn, zIn, rotationDeg: 0 },
        role: "plate",
        qty: 1,
        notes: "interior-wythe edge",
      },
    );
  }
  return members;
}

/**
 * Timber fiber board void-fill (Tommy: "instead of straw infilling the
 * void inbetween the two close-standing sets of studs, there is a
 * 1.5in x 7in x between-top-and-bottom-plate piece of timber fiber
 * board") — one piece per corner, filling the gap between a double
 * stud pair's outer/inner members. Only applies when studCount is 2.
 * Width (7in) is Tommy's literal figure, not derived from other panel
 * dimensions — flagged as a fixed reference value.
 */
export const VOID_FILL_WIDTH_IN = 7;

export function buildVoidFillPieces(widthIn: number, depthIn: number, heightIn: number, spec: StudConfigSpec): PanelMember[] {
  if (spec.studCount === 1) return [];
  const studSpanIn = heightIn - 2 * SKIN_THICKNESS_IN;
  const assemblyThicknessIn = studAssemblyThicknessIn(spec);
  const cornerXs = [0, widthIn - assemblyThicknessIn];
  const cornerYs = [0, depthIn - spec.studWidthIn];
  const members: PanelMember[] = [];
  let cornerIdx = 0;
  for (const yIn of cornerYs) {
    for (const baseXIn of cornerXs) {
      cornerIdx++;
      members.push({
        memberId: `void_fill_corner_${cornerIdx}`,
        material: "wood_fiber_board",
        speciesGrade: null,
        plySpec: null,
        nominalSize: null,
        actualDimsIn: { thicknessIn: spec.studGapIn, widthIn: VOID_FILL_WIDTH_IN, lengthIn: studSpanIn },
        orientation: "vertical",
        position: { xIn: baseXIn + spec.studThicknessIn, yIn, zIn: SKIN_THICKNESS_IN, rotationDeg: 0 },
        role: "blocking",
        qty: 1,
        notes: `Timber fiber board filling the gap between the double stud pair at corner ${cornerIdx}, full stud-span height.`,
      });
    }
  }
  return members;
}

/**
 * Rectangular blocking-girt frame (Tommy: "instead of web girts like on
 * the other styles, square bale panels have a rectangular blocking girt.
 * for a 39in standard panel that is 14in thick, there are two 11in and
 * two 36in 2x4s that make the rectangle") — a closed 2x4 loop at each
 * girt row instead of a bar pair + plywood web: 2 short sides (11in for
 * the 39x14 reference — depthIn minus clearance at the panel's stud
 * positions, same X positions `buildGirtRows`'s bars use) sliding through
 * the panel studs, and 2 long sides (36in — the SAME formula as the
 * plate length, widthIn minus PLATE_END_CLEARANCE_IN on each end) closing
 * the rectangle at the front/back. Corner joints are simplified as
 * abutting boxes (no mitered/lapped joinery modeled), consistent with
 * this schema's existing girt-web-overlap simplification.
 */
// A single-2x4 corner's spec — the implicit default every existing (pre-
// asymmetric-corner) caller of buildBlockingGirtRows was built against.
const DEFAULT_SIDE_SPEC: StudConfigSpec = STUD_CONFIGS["single-2x4"];

export function buildBlockingGirtRows(
  rowCount: number,
  widthIn: number,
  depthIn: number,
  studSpanIn: number,
  leftSpec: StudConfigSpec = DEFAULT_SIDE_SPEC,
  // Defaults to the left side's own spec — every existing caller passes
  // one uniform config for a whole (symmetric) panel. Only
  // squareBaleCornerPanelMembers.ts's asymmetric corner (single-2x4 one
  // side, double-2x6 the "primary" side) supplies two different specs.
  rightSpec: StudConfigSpec = leftSpec,
): PanelMember[] {
  const members: PanelMember[] = [];
  const shortSideIn = depthIn - 2 * PLATE_2X4_THICKNESS_IN;
  const longSideIn = widthIn - 2 * PLATE_END_CLEARANCE_IN;
  const leftAssemblyThicknessIn = studAssemblyThicknessIn(leftSpec);
  const rightAssemblyThicknessIn = studAssemblyThicknessIn(rightSpec);
  // Flush against the inner face of each corner stud assembly — for a
  // single 2x4 this reduces to PLATE_2X4_THICKNESS_IN/widthIn-2*that (the
  // original single-stud reference numbers); a doubled stud assembly is
  // wider, so the girt shifts inward to stay flush against it.
  const leftXIn = leftAssemblyThicknessIn;
  const rightXIn = widthIn - rightAssemblyThicknessIn - PLATE_2X4_THICKNESS_IN;
  const backYIn = depthIn - 2 * PLATE_2X4_THICKNESS_IN;

  for (let row = 1; row <= rowCount; row++) {
    const centerZIn = SKIN_THICKNESS_IN + (studSpanIn * row) / (rowCount + 1);
    const zIn = centerZIn - PLATE_2X4_WIDTH_IN / 2;

    for (const [side, xIn, spec] of [
      ["left", leftXIn, leftSpec],
      ["right", rightXIn, rightSpec],
    ] as const) {
      members.push({
        memberId: `blocking_girt_${row}_short_${side}`,
        material: "dimensional_lumber",
        speciesGrade: LUMBER_SPECIES_GRADE,
        plySpec: null,
        nominalSize: "2x4",
        actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: shortSideIn },
        orientation: "horizontal",
        position: { xIn, yIn: PLATE_2X4_THICKNESS_IN, zIn, rotationDeg: 90 },
        role: "girt",
        qty: 1,
        notes: `blocking girt ${row} of ${rowCount}, ${side} short side — slides through the panel studs like a girt bar, flush to the inner face of the ${side} stud assembly.`,
      });
      // Tommy: a doubled stud pack (nailer/corner reinforcement) gets its
      // own additional girt piece reaching the OUTER stud too — the bar
      // above only reaches the assembly's inner (2nd) stud, mirroring how
      // the corner itself has 2 studs instead of 1 (see
      // buildSquareBaleCornerStuds / the asymmetric corner panel).
      if (spec.studCount === 2) {
        const outerXIn = side === "left" ? 0 : widthIn - spec.studThicknessIn;
        members.push({
          memberId: `blocking_girt_${row}_short_${side}_outer`,
          material: "dimensional_lumber",
          speciesGrade: LUMBER_SPECIES_GRADE,
          plySpec: null,
          nominalSize: "2x4",
          actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: shortSideIn },
          orientation: "horizontal",
          position: { xIn: outerXIn, yIn: PLATE_2X4_THICKNESS_IN, zIn, rotationDeg: 90 },
          role: "girt",
          qty: 1,
          notes: `blocking girt ${row} of ${rowCount}, ${side} short side (outer stud) — additional bar reaching the outer stud of the doubled ${side} corner pack.`,
        });
      }
    }

    for (const [side, yIn] of [
      ["front", PLATE_2X4_THICKNESS_IN],
      ["back", backYIn],
    ] as const) {
      members.push({
        memberId: `blocking_girt_${row}_long_${side}`,
        material: "dimensional_lumber",
        speciesGrade: LUMBER_SPECIES_GRADE,
        plySpec: null,
        nominalSize: "2x4",
        actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: longSideIn },
        orientation: "horizontal",
        position: { xIn: PLATE_END_CLEARANCE_IN, yIn, zIn, rotationDeg: 0 },
        role: "girt",
        qty: 1,
        notes: `blocking girt ${row} of ${rowCount}, ${side} long side, closing the rectangle.`,
      });
    }
  }

  return members;
}

/**
 * End blocks (Tommy: "there is a 7in 2x4 on each side of each top and
 * bottom plate, flush with the 36in top plate runners") — one 2x4 at each
 * end (left, right) of both the bottom and top plate rows, running the
 * depth direction, Z-flush with that plate. Length (7in for the 14in-
 * thick reference) is read as half the panel depth, centered — the exact
 * rationale wasn't specified further, flagged as an interpretation.
 */
export function buildEndBlocks(widthIn: number, depthIn: number, heightIn: number): PanelMember[] {
  const endBlockLengthIn = depthIn / 2;
  const yIn = (depthIn - endBlockLengthIn) / 2;
  const members: PanelMember[] = [];
  for (const [plateLabel, zIn] of [
    ["bottom", 0],
    ["top", heightIn - SKIN_THICKNESS_IN - PLATE_2X4_THICKNESS_IN],
  ] as const) {
    for (const [side, xIn] of [
      ["left", 0],
      ["right", widthIn - PLATE_2X4_THICKNESS_IN],
    ] as const) {
      members.push({
        memberId: `end_block_${plateLabel}_${side}`,
        material: "dimensional_lumber",
        speciesGrade: LUMBER_SPECIES_GRADE,
        plySpec: null,
        nominalSize: "2x4",
        actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: endBlockLengthIn, lengthIn: PLATE_2X4_WIDTH_IN },
        orientation: "horizontal",
        position: { xIn, yIn, zIn: zIn + SKIN_THICKNESS_IN, rotationDeg: 90 },
        role: "blocking",
        qty: 1,
        notes: `${side} end of the ${plateLabel} plate, flush with the plate's own Z height.`,
      });
    }
  }
  return members;
}

/**
 * Every physical member of a Square Bale Panel — skins/plates/4 corner
 * stud assemblies/optional nailer as the other panel styles, but with the
 * girt rows replaced by rectangular blocking-girt frames (see
 * buildBlockingGirtRows), 4 end blocks added at the plate ends (see
 * buildEndBlocks), and stud size/count driven by `studConfig` (single
 * 2x4, or double 2x4/2x6 with a timber-fiber-board void fill between the
 * pair — see buildVoidFillPieces).
 */
export function buildSquareBalePanelMembers(
  widthIn: number,
  depthIn: number,
  heightIn: number,
  includeNailer: boolean,
  studConfig: StudConfig = "single-2x4",
  nailerOffsetIn = 0,
): PanelMember[] {
  const spec = STUD_CONFIGS[studConfig];
  const studSpanIn = heightIn - 2 * SKIN_THICKNESS_IN;
  const members: PanelMember[] = [
    ...buildSkins(widthIn, depthIn, heightIn),
    ...buildSquareBalePlates(widthIn, depthIn, heightIn, spec),
    ...buildSquareBaleCornerStuds(widthIn, depthIn, heightIn, spec),
    ...buildVoidFillPieces(widthIn, depthIn, heightIn, spec),
    ...buildBlockingGirtRows(SQUARE_BALE_GIRT_ROW_COUNT, widthIn, depthIn, studSpanIn, spec),
    ...buildEndBlocks(widthIn, depthIn, heightIn),
  ];
  if (includeNailer) members.push(buildNailer(widthIn, heightIn, nailerOffsetIn));
  return members;
}

/**
 * Wraps `buildSquareBalePanelMembers` in the full shared component schema
 * — see `buildStandardPanelSchema`'s doc comment for the same rationale.
 */
export function buildSquareBalePanelSchema(
  widthIn: number,
  depthIn: number,
  heightIn: number,
  includeNailer: boolean,
  studConfig: StudConfig = "single-2x4",
  nailerOffsetIn = 0,
): PanelComponentSchema {
  return {
    schemaVersion: "0.1",
    componentType: "panel",
    id: "square_bale_panel",
    displayName: "Square Bale Panel",
    status: "draft",
    derivedFrom: "standard_panel",
    overallDimensions: { heightIn, widthIn, depthIn },
    members: buildSquareBalePanelMembers(widthIn, depthIn, heightIn, includeNailer, studConfig, nailerOffsetIn),
    fasteners: [],
    notes: [
      {
        type: "deviation",
        text:
          "Blocking-girt/end-block corner joints are simplified as abutting boxes, not real mitered/lapped " +
          "joinery. End block length (half the panel depth) is an interpretation, not an independently confirmed " +
          "dimension. A 'double' stud config is modeled as 2 separate studs per corner spaced by a 1.5in gap " +
          "(filled by a timber fiber board piece) rather than 2 members nailed face-to-face with no gap — " +
          "interpreted from Tommy's description of a void 'in between the two close-standing sets of studs'.",
      },
    ],
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
