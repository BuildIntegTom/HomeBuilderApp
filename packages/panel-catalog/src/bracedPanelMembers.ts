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
 * Panel's 2) and adds 2 more any time that would leave a bay taller than
 * 36in (Tommy) — e.g. a 10ft (118.5in stud span) panel's 3 rows split it
 * into 4 bays of ~29.6in each, already under 36in, so 3 stays the
 * minimum; a taller panel keeps gaining rows (5, 7, ...) until every bay
 * fits. Always odd (Tommy: "there are always an odd number of girts
 * inside a braced panel so that there is one in the middle that defines
 * where the two braced pieces go") — the middle row is the shared vertex
 * `buildDiagonalBraces`'s chevron braces meet at, so an even count (no
 * true middle) would leave nothing for them to anchor to.
 */
export function computeBracedGirtRowCount(studSpanIn: number): number {
  let rows = 3;
  while (studSpanIn / (rows + 1) > MAX_GIRT_BAY_IN) {
    rows += 2;
  }
  return rows;
}

/**
 * A chevron of 2 mirrored diagonal 2x4 braces per wythe (Tommy, revised
 * spec, from reference photos: "how i want the...bracing to be: like a
 * <") sharing one vertex at the middle girt row's LEFT bar/stud junction
 * — reading left-to-right, this traces the "<" character exactly: one
 * shared point on the left, two braces fanning out to the top-right and
 * bottom-right corners. Present on BOTH wythes (Tommy: "braced panels
 * might as well be on both sides too"), each rotated 90deg so it's
 * confined to its own wythe's outer 1.5in Y-slice instead of centered
 * across the panel's full depth — see the "diagonal"+rotationDeg=90 case
 * in `memberBoxSizeIn`, which swaps the box's wide (3.5in) face onto the
 * X axis and its thin (1.5in) face onto Y.
 *
 * "Middle" girt row = `(rowCount + 1) / 2`, exact because
 * `computeBracedGirtRowCount` always returns an odd count (Tommy: "there
 * are always an odd number of girts... so there is one in the middle
 * that defines where the two braced pieces go").
 *
 * Both braces are straight tilted boxes (see `tiltDeg`) — the real
 * angle-cut ends aren't modeled as actual beveled geometry, consistent
 * with every other "illustrative, not to scale" diagram in this app.
 */
export function buildDiagonalBraces(widthIn: number, depthIn: number, heightIn: number, rowCount: number, studSpanIn: number): PanelMember[] {
  const middleRow = (rowCount + 1) / 2;
  const middleRowCenterZIn = SKIN_THICKNESS_IN + (studSpanIn * middleRow) / (rowCount + 1);
  const middleRowBarTopZIn = middleRowCenterZIn + PLATE_2X4_WIDTH_IN / 2;

  const barLeftXIn = PLATE_2X4_THICKNESS_IN;
  const barRightXIn = widthIn - 2 * PLATE_2X4_THICKNESS_IN;
  const topPlate2x4ZIn = heightIn - SKIN_THICKNESS_IN - PLATE_2X4_THICKNESS_IN;
  const bottomPlate2x4ZIn = SKIN_THICKNESS_IN;

  function makeBrace(memberId: string, x1: number, z1: number, x2: number, z2: number, centerYIn: number, notes: string): PanelMember {
    const centerX = (x1 + x2) / 2;
    const centerZ = (z1 + z2) / 2;
    const lengthIn = Math.hypot(x2 - x1, z2 - z1);
    const tiltDeg = (Math.atan2(-(x1 - centerX), z1 - centerZ) * 180) / Math.PI;
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

  const members: PanelMember[] = [];
  for (const [wythe, centerYIn] of [
    ["ext", PLATE_2X4_THICKNESS_IN / 2],
    ["int", depthIn - PLATE_2X4_THICKNESS_IN / 2],
  ] as const) {
    members.push(
      makeBrace(
        `diagonal_brace_upper_${wythe}`,
        barLeftXIn,
        middleRowBarTopZIn,
        barRightXIn,
        topPlate2x4ZIn,
        centerYIn,
        `${wythe}-wythe upper brace — shares its vertex with the lower brace at the middle girt row (row ${middleRow} of ${rowCount})'s left bar/stud junction; other nose flush with the underside of the top plate at the right stud double.`,
      ),
      makeBrace(
        `diagonal_brace_lower_${wythe}`,
        barLeftXIn,
        middleRowBarTopZIn,
        barRightXIn,
        bottomPlate2x4ZIn,
        centerYIn,
        `${wythe}-wythe lower brace — shares its vertex with the upper brace at the middle girt row (row ${middleRow} of ${rowCount})'s left bar/stud junction; other nose flush with the top of the bottom plate at the right stud double.`,
      ),
    );
  }
  return members;
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
    ...buildDiagonalBraces(widthIn, depthIn, heightIn, rowCount, studSpanIn),
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
        text: "All 4 diagonal braces' angle-cut ends (flush with the plates/middle girt bar) are simplified to straight tilted boxes, not true beveled geometry.",
      },
    ],
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
