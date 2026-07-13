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
  computeBraceEndCutAngleDeg,
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
 * <") — their inner (middle) ends are flush to the left stud's own inner
 * face (Tommy: "the middle connections of the diagonal braces... should
 * be flush to the stud, not the girt bar"), both sharing that same X, and
 * flank the middle girt row's own bar vertically instead — one landing
 * just above its center, the other just below (Tommy: "the points of the
 * diagonals should start on either side of the girt"), since two braces
 * can't actually converge on a single atom of lumber. Reading
 * left-to-right, this still traces the "<" character (both braces fan out
 * to the top-right and bottom-right corners), just with a small flat spot
 * at the girt bar instead of a knife-point. Present on BOTH wythes (Tommy:
 * "braced panels might as well be on both sides too"), each rotated 90deg
 * so it's confined to its own wythe's outer 1.5in Y-slice instead of
 * centered across the panel's full depth — see the "diagonal"+
 * rotationDeg=90 case in `memberBoxSizeIn`, which swaps the box's wide
 * (3.5in) face onto the X axis and its thin (1.5in) face onto Y.
 *
 * "Middle" girt row = `(rowCount + 1) / 2`, exact because
 * `computeBracedGirtRowCount` always returns an odd count (Tommy: "there
 * are always an odd number of girts... so there is one in the middle
 * that defines where the two braced pieces go").
 *
 * The outer (plate-side) ends are equidistant from the middle girt row's
 * own center — the underside of the top plate above, the TOP face of the
 * bottom plate below (Tommy: "this should keep the diagonal bracing
 * symmetrical") — so the upper and lower brace are true mirror images of
 * one another.
 *
 * Both braces are straight tilted boxes (see `tiltDeg`) — the real
 * angle-cut ends aren't modeled as actual beveled geometry, consistent
 * with every other "illustrative, not to scale" diagram in this app.
 */
export function buildDiagonalBraces(widthIn: number, depthIn: number, heightIn: number, rowCount: number, studSpanIn: number): PanelMember[] {
  const middleRow = (rowCount + 1) / 2;
  const middleRowCenterZIn = SKIN_THICKNESS_IN + (studSpanIn * middleRow) / (rowCount + 1);
  // The middle girt row's bar is now rolled 90deg "hotdog style" (see
  // buildGirtRows) — a thin 1.5in vertical band centered at
  // middleRowCenterZIn — so the 2 braces flank its top/bottom face
  // instead of its (now much wider) left/right face.
  const middleRowBarTopZIn = middleRowCenterZIn + PLATE_2X4_THICKNESS_IN / 2;
  const middleRowBarBottomZIn = middleRowCenterZIn - PLATE_2X4_THICKNESS_IN / 2;

  // Both braces' inner nose shares the left stud's own inner face — flush
  // to the stud, not derived from the girt bar's own (now-rotated) width.
  const studFaceXIn = PLATE_2X4_THICKNESS_IN;
  const barRightXIn = widthIn - 2 * PLATE_2X4_THICKNESS_IN;
  const topPlate2x4ZIn = heightIn - SKIN_THICKNESS_IN - PLATE_2X4_THICKNESS_IN;
  // Top face of the bottom plate (mirrors topPlate2x4ZIn's "underside of
  // the top plate") — the bottom plate assembly spans
  // [SKIN_THICKNESS_IN, SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN], so
  // its own top face is the far end of that span, not its bottom.
  const bottomPlate2x4ZIn = SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN;

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
        studFaceXIn,
        middleRowBarTopZIn,
        barRightXIn,
        topPlate2x4ZIn,
        centerYIn,
        `${wythe}-wythe upper brace — inner nose flush to the left stud's inner face, bearing against the middle girt row (row ${middleRow} of ${rowCount})'s top face; other nose flush with the underside of the top plate at the right stud double.`,
      ),
      makeBrace(
        `diagonal_brace_lower_${wythe}`,
        studFaceXIn,
        middleRowBarBottomZIn,
        barRightXIn,
        bottomPlate2x4ZIn,
        centerYIn,
        `${wythe}-wythe lower brace — inner nose flush to the SAME left stud face as the upper brace, bearing against the middle girt row (row ${middleRow} of ${rowCount})'s bottom face (the upper brace takes the top face, so the 2 braces flank the girt bar vertically instead of pinching to one point); other nose flush with the top of the bottom plate at the right stud double.`,
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
  const members = buildBracedPanelMembers(widthIn, depthIn, heightIn, includeNailer);
  const notes: PanelComponentSchema["notes"] = [
    {
      type: "deviation",
      text: "All 4 diagonal braces' angle-cut ends (flush with the plates/middle girt bar) are simplified to straight tilted boxes in the 3D model above, not the true beveled end shape.",
    },
  ];
  // Both braces (upper/lower, per wythe) share the same tilt magnitude by
  // construction (mirror images around the girt bar) — see
  // buildDiagonalBraces — so one representative brace's angle describes
  // all 4 (Tommy: "lets come up with a way to really hone in on the math
  // involved with cutting the angles of braced panels").
  const brace = members.find((m) => m.role === "brace" && m.position.tiltDeg !== undefined);
  if (brace) {
    const cutAngleDeg = computeBraceEndCutAngleDeg(brace.position.tiltDeg!);
    notes.push({
      type: "deviation",
      text:
        `Each diagonal brace's ends: bevel-cut at ${cutAngleDeg.toFixed(1)}deg off a square crosscut (one ` +
        "miter-saw blade-tilt setting, no compound angle) — a level cut, landing the end face flush (full " +
        "contact) against the girt bar's/plate's own flat face. See computeBraceEndCutAngleDeg's own doc comment " +
        "for the full derivation.",
    });
  }
  return {
    schemaVersion: "0.1",
    componentType: "panel",
    id: "braced_panel",
    displayName: "Braced Panel",
    status: "draft",
    derivedFrom: "standard_panel",
    overallDimensions: { heightIn, widthIn, depthIn },
    members,
    fasteners: [],
    notes,
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
