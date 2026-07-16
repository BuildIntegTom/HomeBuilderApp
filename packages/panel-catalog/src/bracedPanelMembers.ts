import type { PanelComponentSchema, PanelMember } from "./componentSchema";
import {
  LUMBER_SPECIES_GRADE,
  PLATE_2X4_THICKNESS_IN,
  PLATE_2X4_WIDTH_IN,
  SKIN_THICKNESS_IN,
  braceLongestEdgeIn,
  buildCornerStuds,
  buildGirtRows,
  buildNailer,
  buildPlates,
  buildSkins,
  computeBraceEndCutAngleDeg,
  computeBraceTrapezoidCornersIn,
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
 * every bracing style's braces anchor to, so an even count (no true
 * middle) would leave nothing for them to anchor to. Shared by all 3
 * `BracingStyle`s (Tommy: "girt placement matters here - its the same
 * equasion from baced panels").
 */
export function computeBracedGirtRowCount(studSpanIn: number): number {
  let rows = 3;
  while (studSpanIn / (rows + 1) > MAX_GIRT_BAY_IN) {
    rows += 2;
  }
  return rows;
}

/**
 * Which bracing pattern to build (Tommy: "add another bracing option...
 * lets call these hatch panels... hatch forward, and hatch back") — a
 * project-wide choice (see `bracingStyle` in page.tsx), not a per-slot
 * one; every `"braced"`-typed slot in a project uses the same style, so
 * no new `PanelSlotType` value is needed.
 *
 * - `"chevron"`: today's original "<" pattern — both the upper and lower
 *   brace's inner (girt-flanking) end are flush to the SAME stud.
 * - `"hatch-forward"` ("/"): the upper and lower brace continue ONE
 *   single diagonal slope, split at the middle girt row — each brace's
 *   inner end is flush to the OPPOSITE stud from the other instead.
 * - `"hatch-back"` ("\\"), the mirror of hatch-forward.
 *
 * See `BRACE_STUD_SIDES`/`buildDiagonalBraces` for exactly which stud
 * each style picks.
 */
export type BracingStyle = "chevron" | "hatch-forward" | "hatch-back";

/** Which stud each of a wythe's 2 braces' inner (girt-flanking) end is
 * flush to, per bracing style — see `BracingStyle`'s own doc comment.
 * Chevron: both the same (left) stud, unchanged from the original "<"
 * design. Hatch Forward/Back: opposite studs, continuing one diagonal
 * slope instead of forming a chevron — reusing chevron's own upper/lower
 * endpoints verbatim for one of their 2 braces each (see the table in
 * `buildDiagonalBraces`'s own doc comment). */
const BRACE_STUD_SIDES: Record<BracingStyle, { upper: "left" | "right"; lower: "left" | "right" }> = {
  chevron: { upper: "left", lower: "left" },
  "hatch-forward": { upper: "left", lower: "right" },
  "hatch-back": { upper: "right", lower: "left" },
};

/**
 * A brace's 2 defining reference endpoints: `(studXIn, girtBarZIn)` — its
 * inner nose, flush to the named stud's own face, positioned in height to
 * align with the middle girt row's own top/bottom face — and
 * `(plateNearXIn, plateZIn)` — its outer nose, flush against a plate's
 * flat face near the OPPOSITE stud. Both endpoints already sit exactly on
 * their own target plane (`studXIn` IS the stud's real face X; `plateZIn`
 * IS the plate's real face Z), which `buildDiagonalBraces`'s `makeBrace`
 * relies on to feed `computeBraceTrapezoidCornersIn` directly. Shared by
 * every bracing style; only `studSide` changes which physical stud the
 * inner nose lands on.
 */
function braceEndpoints(widthIn: number, studSide: "left" | "right", girtBarZIn: number, plateZIn: number): [number, number, number, number] {
  const studXIn = studSide === "left" ? PLATE_2X4_THICKNESS_IN : widthIn - PLATE_2X4_THICKNESS_IN;
  const plateNearXIn = studSide === "left" ? widthIn - 2 * PLATE_2X4_THICKNESS_IN : 2 * PLATE_2X4_THICKNESS_IN;
  return [studXIn, girtBarZIn, plateNearXIn, plateZIn];
}

/**
 * 2 real diagonal 2x4 braces per wythe (4 total, ext+int — Tommy: "braced
 * panels might as well be on both sides too"), each rotated 90deg so it's
 * confined to its own wythe's outer 1.5in Y-slice instead of centered
 * across the panel's full depth (see the "diagonal"+rotationDeg=90 case
 * in `memberBoxSizeIn`).
 *
 * Every brace's inner end is positioned in height to align with the
 * middle girt row's own top/bottom face (Tommy: "the middle connections
 * of the diagonal braces... should be flush to the stud, not the girt
 * bar... the points of the diagonals should start on either side of the
 * girt") — flanking it vertically (one just above its center, one just
 * below) instead of pinching to a single point, since two braces can't
 * actually converge on one atom of lumber. Which STUD each inner end is
 * flush to depends on `bracingStyle` (`BRACE_STUD_SIDES`):
 *
 * | Config               | Inner (plumb) end        | Outer (level) end     |
 * |-----------------------|---------------------------|------------------------|
 * | chevron upper          | left stud @ girt-top      | right-side, top plate  |
 * | chevron lower           | left stud @ girt-bottom   | right-side, bottom plate |
 * | hatch-forward upper (=chevron upper) | left stud @ girt-top | right-side, top plate |
 * | hatch-forward lower    | right stud @ girt-bottom  | left-side, bottom plate |
 * | hatch-back upper       | right stud @ girt-top     | left-side, top plate   |
 * | hatch-back lower (=chevron lower)    | left stud @ girt-bottom | right-side, bottom plate |
 *
 * "Middle" girt row = `(rowCount + 1) / 2`, exact because
 * `computeBracedGirtRowCount` always returns an odd count.
 *
 * Each brace's ends are TRUE beveled cuts, not a simplified straight
 * tilted box (Tommy: "trapezoid cuts... derived from the angle that the
 * trapezoid has been rotated") — a LEVEL (horizontal) cut at the plate
 * end, flush against the plate's own flat face, and a PLUMB (vertical)
 * cut at the stud end, flush against the stud's own face. These 2 cuts
 * are never parallel (except at exactly 45deg), so the brace is a real
 * trapezoid — see `computeBraceTrapezoidCornersIn` in
 * panelMemberHelpers.ts for the full derivation. Board-feet purchasing
 * length uses the longer of the trapezoid's 2 long edges ("longest point
 * to longest point" — Tommy), not the plain centerline length; the
 * centerline reference (`xIn`/`zIn`/`tiltDeg`) stays populated for
 * `computeBraceEndCutAngleDeg`/shear-capacity/notes that don't know about
 * trapezoids.
 */
export function buildDiagonalBraces(
  widthIn: number,
  depthIn: number,
  heightIn: number,
  rowCount: number,
  studSpanIn: number,
  bracingStyle: BracingStyle,
): PanelMember[] {
  const middleRow = (rowCount + 1) / 2;
  const middleRowCenterZIn = SKIN_THICKNESS_IN + (studSpanIn * middleRow) / (rowCount + 1);
  // The middle girt row's bar is rolled 90deg "hotdog style" (see
  // buildGirtRows) — a thin 1.5in vertical band centered at
  // middleRowCenterZIn — so the braces flank its top/bottom face instead
  // of its (now much wider) left/right face.
  const middleRowBarTopZIn = middleRowCenterZIn + PLATE_2X4_THICKNESS_IN / 2;
  const middleRowBarBottomZIn = middleRowCenterZIn - PLATE_2X4_THICKNESS_IN / 2;
  const topPlate2x4ZIn = heightIn - SKIN_THICKNESS_IN - PLATE_2X4_THICKNESS_IN;
  // Top face of the bottom plate (mirrors topPlate2x4ZIn's "underside of
  // the top plate") — the bottom plate assembly spans
  // [SKIN_THICKNESS_IN, SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN], so
  // its own top face is the far end of that span, not its bottom.
  const bottomPlate2x4ZIn = SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN;

  function makeBrace(memberId: string, x1: number, z1: number, x2: number, z2: number, centerYIn: number, notes: string): PanelMember {
    const centerX = (x1 + x2) / 2;
    const centerZ = (z1 + z2) / 2;
    const tiltDeg = (Math.atan2(-(x1 - centerX), z1 - centerZ) * 180) / Math.PI;
    // x1 is always exactly the plumb (stud-face) target and z2 is always
    // exactly the level (plate-face) target — every endpoint pair this
    // file builds (via braceEndpoints) already places its 2 reference
    // points exactly on those 2 planes, so no separate target params are
    // needed beyond the endpoints themselves.
    const trapezoidCornersIn = computeBraceTrapezoidCornersIn(x1, z1, x2, z2, PLATE_2X4_WIDTH_IN, x1, z2);
    const lengthIn = braceLongestEdgeIn(trapezoidCornersIn);
    return {
      memberId,
      material: "dimensional_lumber",
      speciesGrade: LUMBER_SPECIES_GRADE,
      plySpec: null,
      nominalSize: "2x4",
      actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn },
      orientation: "diagonal",
      position: { xIn: centerX, yIn: centerYIn, zIn: centerZ, rotationDeg: 90, tiltDeg, trapezoidCornersIn },
      role: "brace",
      qty: 1,
      notes,
    };
  }

  const { upper: upperStudSide, lower: lowerStudSide } = BRACE_STUD_SIDES[bracingStyle];
  const [upperX1, upperZ1, upperX2, upperZ2] = braceEndpoints(widthIn, upperStudSide, middleRowBarTopZIn, topPlate2x4ZIn);
  const [lowerX1, lowerZ1, lowerX2, lowerZ2] = braceEndpoints(widthIn, lowerStudSide, middleRowBarBottomZIn, bottomPlate2x4ZIn);

  const members: PanelMember[] = [];
  for (const [wythe, centerYIn] of [
    ["ext", PLATE_2X4_THICKNESS_IN / 2],
    ["int", depthIn - PLATE_2X4_THICKNESS_IN / 2],
  ] as const) {
    members.push(
      makeBrace(
        `diagonal_brace_upper_${wythe}`,
        upperX1,
        upperZ1,
        upperX2,
        upperZ2,
        centerYIn,
        `${wythe}-wythe upper brace (${bracingStyle}) — true beveled ends: a plumb cut flush to the ${upperStudSide} stud's own face, positioned to align with the middle girt row (row ${middleRow} of ${rowCount})'s top face; a level cut flush with the underside of the top plate.`,
      ),
      makeBrace(
        `diagonal_brace_lower_${wythe}`,
        lowerX1,
        lowerZ1,
        lowerX2,
        lowerZ2,
        centerYIn,
        `${wythe}-wythe lower brace (${bracingStyle}) — true beveled ends: a plumb cut flush to the ${lowerStudSide} stud's own face, positioned to align with the middle girt row (row ${middleRow} of ${rowCount})'s bottom face; a level cut flush with the top of the bottom plate.`,
      ),
    );
  }
  return members;
}

/**
 * A vertical 2x4, chevron-only (Tommy: "a centered trapezoid 2x4 running
 * vertical from the bottom part of each carrot to the top trapezoid's
 * inner edge... it's centered horizontally on the exterior of the
 * panel") — connects where the upper and lower chevron braces' own
 * centerlines cross the panel's horizontal midline (`X = widthIn/2`), so
 * the bracing assembly reads as one continuous vertical spine down the
 * panel's center instead of 2 separate diagonal pieces. Uses the
 * chevron braces' plain centerline endpoints (not their trapezoid
 * corners) — a simplified square-cut first pass, no birdsmouth notch
 * matching each brace's own tilt yet (consistent with this file's
 * existing "illustrative, not to scale" joints elsewhere). `role:
 * "blocking"`, not `"brace"`, so it's excluded from fastener-weight's
 * brace-screw rule and the shear-capacity racking estimate — the same
 * "no fastener rule specified yet" precedent already used for Column/
 * Corner blocking.
 */
function buildBracedCenterConnector(widthIn: number, heightIn: number, rowCount: number, studSpanIn: number): PanelMember {
  const middleRow = (rowCount + 1) / 2;
  const middleRowCenterZIn = SKIN_THICKNESS_IN + (studSpanIn * middleRow) / (rowCount + 1);
  const middleRowBarTopZIn = middleRowCenterZIn + PLATE_2X4_THICKNESS_IN / 2;
  const middleRowBarBottomZIn = middleRowCenterZIn - PLATE_2X4_THICKNESS_IN / 2;
  const topPlate2x4ZIn = heightIn - SKIN_THICKNESS_IN - PLATE_2X4_THICKNESS_IN;
  const bottomPlate2x4ZIn = SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN;

  const [upperX1, upperZ1, upperX2, upperZ2] = braceEndpoints(widthIn, "left", middleRowBarTopZIn, topPlate2x4ZIn);
  const [lowerX1, lowerZ1, lowerX2, lowerZ2] = braceEndpoints(widthIn, "left", middleRowBarBottomZIn, bottomPlate2x4ZIn);

  const centerXIn = widthIn / 2;
  function crossZAt(x1: number, z1: number, x2: number, z2: number): number {
    const t = (centerXIn - x1) / (x2 - x1);
    return z1 + t * (z2 - z1);
  }
  const bottomCrossZIn = crossZAt(lowerX1, lowerZ1, lowerX2, lowerZ2);
  const topCrossZIn = crossZAt(upperX1, upperZ1, upperX2, upperZ2);

  return {
    memberId: "brace_center_connector",
    material: "dimensional_lumber",
    speciesGrade: LUMBER_SPECIES_GRADE,
    plySpec: null,
    nominalSize: "2x4",
    actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: topCrossZIn - bottomCrossZIn },
    orientation: "vertical",
    position: { xIn: centerXIn - PLATE_2X4_THICKNESS_IN / 2, yIn: 0, zIn: bottomCrossZIn, rotationDeg: 0 },
    role: "blocking",
    qty: 1,
    notes:
      "Chevron-only — connects the upper and lower diagonal braces where each one's own centerline crosses " +
      "the panel's horizontal center, on the exterior wythe. A simplified square-cut first pass (no birdsmouth " +
      "notch matching each brace's own tilt yet).",
  };
}

/**
 * Every physical member of a Braced Panel — the same skins, plate 2x4s, 4
 * corner studs, and optional nailer as a Standard Panel (see
 * `buildStandardPanelMembers`), but with 3+ girt rows (per
 * `computeBracedGirtRowCount`) instead of 2, the diagonal braces for the
 * chosen `bracingStyle` (see `buildDiagonalBraces`), and — chevron only —
 * the new vertical center connector (see `buildBracedCenterConnector`).
 */
export function buildBracedPanelMembers(
  widthIn: number,
  depthIn: number,
  heightIn: number,
  includeNailer: boolean,
  bracingStyle: BracingStyle,
): PanelMember[] {
  const studSpanIn = heightIn - 2 * SKIN_THICKNESS_IN;
  const rowCount = computeBracedGirtRowCount(studSpanIn);
  const members: PanelMember[] = [
    ...buildSkins(widthIn, depthIn, heightIn),
    ...buildPlates(widthIn, depthIn, heightIn),
    ...buildCornerStuds(widthIn, depthIn, heightIn),
    ...buildGirtRows(rowCount, widthIn, depthIn, studSpanIn),
    ...buildDiagonalBraces(widthIn, depthIn, heightIn, rowCount, studSpanIn, bracingStyle),
  ];
  if (bracingStyle === "chevron") {
    members.push(buildBracedCenterConnector(widthIn, heightIn, rowCount, studSpanIn));
  }
  if (includeNailer) members.push(buildNailer(widthIn, heightIn));
  return members;
}

/**
 * Display name for the Shop Drawing title/3D-view captions, dynamic on
 * the active bracing style (Tommy wants "Hatch Forward Panel"/"Hatch Back
 * Panel" to actually read that way wherever a user sees them) — the
 * shared `panelTypes` catalog entry stays generically "Braced Panel" so
 * BOM/structural notes read correctly for the whole family regardless of
 * style; this helper is used only at the specific UI surfaces that show a
 * bracing-style-aware name (mirrors how Square Bale Panels' own note text
 * dynamically relabels a "standard"-typed slot, without renaming the
 * shared catalog entry itself).
 */
export function bracedPanelDisplayLabel(bracingStyle: BracingStyle): string {
  if (bracingStyle === "hatch-forward") return "Hatch Forward Panel";
  if (bracingStyle === "hatch-back") return "Hatch Back Panel";
  return "Braced Panel";
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
  bracingStyle: BracingStyle,
): PanelComponentSchema {
  const members = buildBracedPanelMembers(widthIn, depthIn, heightIn, includeNailer, bracingStyle);
  const notes: PanelComponentSchema["notes"] = [
    {
      type: "deviation",
      text:
        "Every diagonal brace's ends are true beveled cuts (a level cut at the plate, a plumb cut at the stud), " +
        "rendered as a real trapezoid prism — not a simplified straight tilted box.",
    },
  ];
  // Every brace (any style, upper/lower, either wythe) shares the same
  // tilt magnitude by construction (the panel's vertical symmetry — see
  // buildDiagonalBraces's own doc comment) — so one representative
  // brace's angle describes all of them (Tommy: "lets come up with a way
  // to really hone in on the math involved with cutting the angles of
  // braced panels").
  const brace = members.find((m) => m.role === "brace" && m.position.tiltDeg !== undefined);
  if (brace) {
    const levelCutAngleDeg = computeBraceEndCutAngleDeg(brace.position.tiltDeg!);
    const plumbCutAngleDeg = 90 - levelCutAngleDeg;
    notes.push({
      type: "deviation",
      text:
        `Each diagonal brace: a level cut (${levelCutAngleDeg.toFixed(1)}deg off a square crosscut) flush against ` +
        `the plate's own flat face, and a plumb cut (${plumbCutAngleDeg.toFixed(1)}deg off a square crosscut) flush ` +
        "against the stud's own face — both derived from the brace's own tilt, which changes with panel size. " +
        "Board-feet purchasing length uses the longer of the trapezoid's 2 long edges (\"longest point to longest " +
        "point\"), not the plain centerline length. See computeBraceTrapezoidCornersIn's own doc comment for the " +
        "full derivation.",
    });
  }
  return {
    schemaVersion: "0.1",
    componentType: "panel",
    id: "braced_panel",
    displayName: bracedPanelDisplayLabel(bracingStyle),
    status: "draft",
    derivedFrom: "standard_panel",
    overallDimensions: { heightIn, widthIn, depthIn },
    members,
    fasteners: [],
    notes,
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
