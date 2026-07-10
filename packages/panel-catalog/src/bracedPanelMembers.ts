import type { PanelComponentSchema, PanelMember } from "./componentSchema";
import {
  LUMBER_SPECIES_GRADE,
  PLATE_2X4_THICKNESS_IN,
  PLATE_2X4_WIDTH_IN,
  SKIN_THICKNESS_IN,
  buildCornerStuds,
  buildGirtRows,
  buildNailer,
  buildPlates,
  buildSkins,
} from "./panelMemberHelpers";

const MAX_GIRT_BAY_IN = 36; // Tommy: another girt row if bays exceed 36in

/**
 * A Braced Panel starts at 3 evenly-spaced girt rows (vs. the Standard
 * Panel's 2) and adds another row any time that would leave a bay taller
 * than 36in (Tommy) — e.g. a 10ft (118.5in stud span) panel's 3 rows
 * split it into 4 bays of ~29.6in each, already under 36in, so 3 stays
 * the minimum; a taller panel keeps gaining rows until every bay fits.
 */
export function computeBracedGirtRowCount(studSpanIn: number): number {
  let rows = 3;
  while (studSpanIn / (rows + 1) > MAX_GIRT_BAY_IN) {
    rows++;
  }
  return rows;
}

/**
 * Two mirrored diagonal 2x4 braces (Tommy, revised spec) forming a
 * full-height zigzag, both rotated 90deg from the original single-brace
 * design so they stay confined to the last 1.5in of the exterior wythe
 * (Y=0..1.5in) instead of centered across the panel's full depth — see
 * the "diagonal"+rotationDeg=90 case in `memberBoxSizeIn`, which swaps
 * the box's wide (3.5in) face onto the X axis and its thin (1.5in) face
 * onto Y.
 *
 * - Upper brace: top nose flush with the underside of the top plate at
 *   one stud double's inside face; bottom nose lands exactly at the
 *   junction of the middle girt row's opposing bar and its stud (the
 *   bar's top corner).
 * - Lower brace (mirrored): top nose at the middle girt row's original-
 *   side bar/stud junction; bottom nose flush with the top of the bottom
 *   plate at the opposing stud double. Each half independently anchors to
 *   its own plate (rather than being a literal point-mirror of the upper
 *   brace), so it always lands exactly on the bottom plate even when the
 *   36in-bay rule leaves the "middle" row short of the panel's true
 *   half-height.
 *
 * Both are straight tilted boxes (see `tiltDeg`) — the real angle-cut
 * ends aren't modeled as actual beveled geometry, consistent with every
 * other "illustrative, not to scale" diagram in this app. "Middle" girt
 * row = `Math.ceil(rowCount / 2)` — exact for an odd row count, an
 * approximation (no true middle) when the 36in rule produces an even
 * count.
 */
export function buildDiagonalBraces(widthIn: number, heightIn: number, rowCount: number, studSpanIn: number): PanelMember[] {
  const middleRow = Math.ceil(rowCount / 2);
  const middleRowCenterZIn = SKIN_THICKNESS_IN + (studSpanIn * middleRow) / (rowCount + 1);
  const middleRowBarTopZIn = middleRowCenterZIn + PLATE_2X4_WIDTH_IN / 2;

  const barLeftXIn = PLATE_2X4_THICKNESS_IN;
  const barRightXIn = widthIn - 2 * PLATE_2X4_THICKNESS_IN;
  const topPlate2x4ZIn = heightIn - SKIN_THICKNESS_IN - PLATE_2X4_THICKNESS_IN;
  const bottomPlate2x4ZIn = SKIN_THICKNESS_IN;

  // Rotated 90deg (see memberBoxSizeIn): the box's Y-extent is now
  // PLATE_2X4_THICKNESS_IN (1.5in) — center it at half that, flush with
  // the exterior face at Y=0.
  const centerYIn = PLATE_2X4_THICKNESS_IN / 2;

  function makeBrace(memberId: string, topX: number, topZ: number, bottomX: number, bottomZ: number, notes: string): PanelMember {
    const centerX = (topX + bottomX) / 2;
    const centerZ = (topZ + bottomZ) / 2;
    const lengthIn = Math.hypot(bottomX - topX, bottomZ - topZ);
    const tiltDeg = (Math.atan2(-(topX - centerX), topZ - centerZ) * 180) / Math.PI;
    return {
      memberId,
      material: "dimensional_lumber",
      speciesGrade: LUMBER_SPECIES_GRADE,
      plySpec: null,
      nominalSize: "2x4",
      actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn },
      orientation: "diagonal",
      position: { xIn: centerX, yIn: centerYIn, zIn: centerZ, rotationDeg: 90, tiltDeg },
      role: "brace",
      qty: 1,
      notes,
    };
  }

  const upper = makeBrace(
    "diagonal_brace_upper",
    barLeftXIn,
    topPlate2x4ZIn,
    barRightXIn,
    middleRowBarTopZIn,
    `Upper brace, confined to the last 1.5in of the exterior wythe — top flush with the underside of the top ` +
      `plate at the left stud double; bottom nose at the junction of the middle girt row (row ${middleRow} of ${rowCount})'s right bar and stud.`,
  );
  const lower = makeBrace(
    "diagonal_brace_lower",
    barLeftXIn,
    middleRowBarTopZIn,
    barRightXIn,
    bottomPlate2x4ZIn,
    `Lower brace (mirrored), confined to the last 1.5in of the exterior wythe — top nose at the junction of the ` +
      `middle girt row (row ${middleRow} of ${rowCount})'s left bar and stud; bottom flush with the top of the bottom plate at the right stud double.`,
  );
  return [upper, lower];
}

/**
 * Every physical member of a Braced Panel — the same skins, plate 2x4s, 4
 * corner studs, and optional nailer as a Standard Panel (see
 * `buildStandardPanelMembers`), but with 3+ girt rows (per
 * `computeBracedGirtRowCount`) instead of 2, plus the mirrored pair of
 * diagonal braces (see `buildDiagonalBraces`).
 */
export function buildBracedPanelMembers(
  widthIn: number,
  depthIn: number,
  heightIn: number,
  includeNailer: boolean,
): PanelMember[] {
  const studSpanIn = heightIn - 2 * SKIN_THICKNESS_IN;
  const rowCount = computeBracedGirtRowCount(studSpanIn);
  const members: PanelMember[] = [
    ...buildSkins(widthIn, depthIn, heightIn),
    ...buildPlates(widthIn, depthIn, heightIn),
    ...buildCornerStuds(widthIn, depthIn, heightIn),
    ...buildGirtRows(rowCount, widthIn, depthIn, studSpanIn),
    ...buildDiagonalBraces(widthIn, heightIn, rowCount, studSpanIn),
  ];
  if (includeNailer) members.push(buildNailer(widthIn, heightIn));
  return members;
}

/**
 * Wraps `buildBracedPanelMembers` in the full shared component schema —
 * see `buildStandardPanelSchema`'s doc comment for the same rationale.
 */
export function buildBracedPanelSchema(
  widthIn: number,
  depthIn: number,
  heightIn: number,
  includeNailer: boolean,
): PanelComponentSchema {
  return {
    schemaVersion: "0.1",
    componentType: "panel",
    id: "braced_panel",
    displayName: "Braced Panel",
    status: "draft",
    derivedFrom: "standard_panel",
    overallDimensions: { heightIn, widthIn, depthIn },
    members: buildBracedPanelMembers(widthIn, depthIn, heightIn, includeNailer),
    fasteners: [],
    notes: [
      {
        type: "deviation",
        text: "Both diagonal braces' angle-cut ends (flush with the plates/middle girt bar) are simplified to straight tilted boxes, not true beveled geometry.",
      },
    ],
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
