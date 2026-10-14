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
  computeBraceBoardCornersIn,
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
 * lets call these hatch panels... hatch forward, and hatch back" / "I want
 * this editor to be quite flexible... there should be variations for left
 * and right versions of each") — a per-panel choice (see `bracedPattern`/
 * `bracedMirrored` on `PanelSlot` in packages/geometry), decomposed into a
 * base pattern and an orthogonal left/right mirror flag rather than a flat
 * list of named styles, so every pattern automatically gets a mirrored
 * partner instead of needing its own hand-added style string.
 *
 * - `"chevron"`, unmirrored: the original "<" pattern — both the upper and
 *   lower brace's inner (girt-flanking) end are flush to the SAME (left)
 *   stud. Mirrored: ">" — both flush to the right stud instead.
 * - `"hatch"`, unmirrored ("/", formerly "hatch-forward"): the upper and
 *   lower brace continue ONE single diagonal slope, split at the middle
 *   girt row — each brace's inner end is flush to the OPPOSITE stud from
 *   the other. Mirrored ("\\", formerly "hatch-back"): the same swap,
 *   reflected.
 *
 * See `BRACE_STUD_SIDES`/`buildDiagonalBraces` for exactly which stud each
 * combination picks.
 */
export type BracePattern = "chevron" | "hatch";

/**
 * The 4 concrete style combinations, used only for the project's stored
 * *default* (the global "Bracing style" toolbar in page.tsx, and the
 * project-file field of the same name) — individual panels store their own
 * `bracedPattern`/`bracedMirrored` directly instead of this flat union (see
 * `BracePattern`'s own doc comment). Kept as a flat union (not a
 * `{pattern,mirrored}` object) specifically so old project files' stored
 * `"chevron"`/`"hatch-forward"`/`"hatch-back"` values stay valid without a
 * schema migration — `"chevron-mirrored"` is the one new value.
 */
export type BracingStyle = "chevron" | "chevron-mirrored" | "hatch-forward" | "hatch-back";

export function bracingStyleToPatternMirror(style: BracingStyle): { pattern: BracePattern; mirrored: boolean } {
  switch (style) {
    case "chevron":
      return { pattern: "chevron", mirrored: false };
    case "chevron-mirrored":
      return { pattern: "chevron", mirrored: true };
    case "hatch-forward":
      return { pattern: "hatch", mirrored: false };
    case "hatch-back":
      return { pattern: "hatch", mirrored: true };
  }
}

export function patternMirrorToBracingStyle(pattern: BracePattern, mirrored: boolean): BracingStyle {
  if (pattern === "hatch") return mirrored ? "hatch-back" : "hatch-forward";
  return mirrored ? "chevron-mirrored" : "chevron";
}

/** Which stud each of a wythe's 2 braces' inner (girt-flanking) end is
 * flush to, per base pattern (unmirrored) — see `BracePattern`'s own doc
 * comment. Chevron: both the same (left) stud, unchanged from the original
 * "<" design. Hatch: opposite studs, continuing one diagonal slope instead
 * of forming a chevron — reusing chevron's own upper/lower endpoints
 * verbatim for one of their 2 braces each (see the table in
 * `buildDiagonalBraces`'s own doc comment). Mirroring (see
 * `buildDiagonalBraces`) swaps "left"<->"right" on both entries — verified
 * by hand that this reproduces the old `hatch-back` style's exact values
 * from `hatch`'s own (formerly `hatch-forward`'s) table, so the 2 patterns
 * already in use lose zero geometry precision from this refactor. */
const BRACE_STUD_SIDES: Record<BracePattern, { upper: "left" | "right"; lower: "left" | "right" }> = {
  chevron: { upper: "left", lower: "left" },
  hatch: { upper: "left", lower: "right" },
};

function flipStudSide(side: "left" | "right"): "left" | "right" {
  return side === "left" ? "right" : "left";
}

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
  // The wide/"long point" end lands on the OPPOSITE stud's own real inner
  // face (Tommy: "i want the 2x4 trapezoid to end on the top plate with
  // the long point ending where the vertical stud and the plate 2x4
  // runner intersect") — exactly `studXIn`'s own formula with the
  // branches swapped, matching `buildCornerStuds`'s real corner layout
  // (cornerXs = [0, widthIn - PLATE_2X4_THICKNESS_IN]): the left stud's
  // inner face is at PLATE_2X4_THICKNESS_IN, the right stud's inner face
  // is at widthIn - PLATE_2X4_THICKNESS_IN. Previously a fixed
  // `2 * PLATE_2X4_THICKNESS_IN` inset from the panel edge, which stopped
  // 1 stud-thickness short of the actual stud face.
  /* ⚠ THE FAR ANCHOR IS THE PANEL EDGE, NOT THE OPPOSITE STUD'S FACE, and
     these two values are now the brace's ANCHOR POINTS rather than its
     centreline endpoints. Tommy, 2026-10-13: the brace's point meets the top
     of the girt bar, and the far long point stays flush — *"Flush, and let
     the angle shift instead."* Both anchors lie on ONE long edge of the
     board, which is what makes the shape well-posed; see
     computeBraceBoardCornersIn for why the old centreline version could not
     be. */
  const panelEdgeXIn = studSide === "left" ? widthIn : 0;
  return [studXIn, girtBarZIn, panelEdgeXIn, plateZIn];
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
 * flush to depends on `pattern` (`BRACE_STUD_SIDES`), with `mirrored`
 * swapping left<->right on both entries afterward:
 *
 * | Config (unmirrored)  | Inner (plumb) end        | Outer (level) end     |
 * |-----------------------|---------------------------|------------------------|
 * | chevron upper          | left stud @ girt-top      | right-side, top plate  |
 * | chevron lower           | left stud @ girt-bottom   | right-side, bottom plate |
 * | hatch upper (=chevron upper) | left stud @ girt-top | right-side, top plate |
 * | hatch lower    | right stud @ girt-bottom  | left-side, bottom plate |
 *
 * Mirrored, every "left"/"right" above swaps — e.g. mirrored hatch's upper
 * becomes "right stud @ girt-top, left-side top plate" and its lower
 * becomes "left stud @ girt-bottom, right-side bottom plate" (the same
 * values as unmirrored chevron's own lower, coincidentally) — together
 * exactly today's "hatch-back", now derived instead of hand-tabulated.
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
  pattern: BracePattern,
  mirrored: boolean,
): PanelMember[] {
  const middleRow = (rowCount + 1) / 2;
  const middleRowCenterZIn = SKIN_THICKNESS_IN + (studSpanIn * middleRow) / (rowCount + 1);
  // The middle girt row's bar is rolled 90deg "hotdog style" (see
  // buildGirtRows) — a thin 1.5in vertical band centered at
  // middleRowCenterZIn — so the braces flank its top/bottom face instead
  // of its (now much wider) left/right face.
  /* ⚠ NO BAR AT THE CENTRE? ANCHOR ON MID-HEIGHT. Tommy, 2026-10-13: *"If
     there happens to be no girt the center of the panel then just center it
     on the height if that ever happens."* It happens silently: `middleRow` is
     `(rowCount + 1) / 2`, so an EVEN rowCount lands on a half (2 rows -> row
     1.5) and there is no bar there at all — yet the old code still offset by
     half a bar, anchoring braces to the faces of a bar that does not exist.
     `middleRowCenterZIn` is already exactly mid-height for every rowCount, so
     the fallback is just to stop adding the half-bar. */
  const hasMiddleBar = Number.isInteger(middleRow);
  const middleRowBarTopZIn = middleRowCenterZIn + (hasMiddleBar ? PLATE_2X4_THICKNESS_IN / 2 : 0);
  const middleRowBarBottomZIn = middleRowCenterZIn - (hasMiddleBar ? PLATE_2X4_THICKNESS_IN / 2 : 0);
  const topPlate2x4ZIn = heightIn - SKIN_THICKNESS_IN - PLATE_2X4_THICKNESS_IN;
  // Top face of the bottom plate (mirrors topPlate2x4ZIn's "underside of
  // the top plate") — the bottom plate assembly spans
  // [SKIN_THICKNESS_IN, SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN], so
  // its own top face is the far end of that span, not its bottom.
  const bottomPlate2x4ZIn = SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN;

  function makeBrace(memberId: string, x1: number, z1: number, x2: number, z2: number, centerYIn: number, notes: string): PanelMember {
    /* (x1,z1) is the LOW POINT, on the girt bar's face at the stud face;
       (x2,z2) is the FAR LONG POINT, flush with the panel edge on the plate. */
    const trapezoidCornersIn = computeBraceBoardCornersIn(x1, z1, x2, z2, PLATE_2X4_WIDTH_IN);
    /* ⚠ The recorded centreline must agree with the corners, or the 3D view,
       the OBJ export and the cut list describe different objects. Taken across
       the two long edges rather than between the anchors: both anchors sit on
       ONE edge, so their midpoint lies on that edge, not on the centreline. */
    const centerX = (trapezoidCornersIn[0]!.xIn + trapezoidCornersIn[2]!.xIn) / 2;
    const centerZ = (trapezoidCornersIn[0]!.zIn + trapezoidCornersIn[2]!.zIn) / 2;
    const tiltDeg = (Math.atan2(-(x1 - x2), z1 - z2) * 180) / Math.PI;
    // x1 is always exactly the plumb (stud-face) target and z2 is always
    // exactly the level (plate-face) target — every endpoint pair this
    // file builds (via braceEndpoints) already places its 2 reference
    // points exactly on those 2 planes, so no separate target params are
    // needed beyond the endpoints themselves.
    //
    // The level (plate) end's own 2 corners aren't both forced to a single
    // X the way the plumb end's are — a board of real width, cut level
    // right where its centerline meets the plate near the FAR stud, can
    // have one long edge (the "long point" — Tommy) reach past that stud's
    // own outer face (X<0 or X>widthIn) — real trapezoid geometry, not a
    // math error, but past the panel's own edge is empty space outside
    // this panel entirely. `boundaryXIn` rigidly shifts BOTH level corners
    // together so the long point lands exactly flush with the panel's own
    // edge instead — x1's own side of the panel midline tells us which
    // edge this particular brace's long point reaches toward (a left-stud
    // brace's plate end reaches right, toward X=widthIn; a right-stud
    // brace's reaches left, toward X=0). Previously each overshooting
    // corner was clamped individually after the fact (Math.min/Math.max on
    // its own xIn) — the same "cut the outer cap's apparent width in half"
    // distortion bug the header brace's own outer feet had (see
    // buildHeaderTrussWebBraces in panelMemberHelpers.ts) before that fix;
    // this uses the same proven "shift the whole cut, don't clamp one
    // corner" approach instead.
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

  const sides = BRACE_STUD_SIDES[pattern];
  const upperStudSide = mirrored ? flipStudSide(sides.upper) : sides.upper;
  const lowerStudSide = mirrored ? flipStudSide(sides.lower) : sides.lower;
  const [upperX1, upperZ1, upperX2, upperZ2] = braceEndpoints(widthIn, upperStudSide, middleRowBarTopZIn, topPlate2x4ZIn);
  const [lowerX1, lowerZ1, lowerX2, lowerZ2] = braceEndpoints(widthIn, lowerStudSide, middleRowBarBottomZIn, bottomPlate2x4ZIn);
  const styleLabel = `${pattern}${mirrored ? "-mirrored" : ""}`;

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
        `${wythe}-wythe upper brace (${styleLabel}) — true beveled ends: a plumb cut flush to the ${upperStudSide} stud's own face, positioned to align with the middle girt row (row ${middleRow} of ${rowCount})'s top face; a level cut flush with the underside of the top plate.`,
      ),
      makeBrace(
        `diagonal_brace_lower_${wythe}`,
        lowerX1,
        lowerZ1,
        lowerX2,
        lowerZ2,
        centerYIn,
        `${wythe}-wythe lower brace (${styleLabel}) — true beveled ends: a plumb cut flush to the ${lowerStudSide} stud's own face, positioned to align with the middle girt row (row ${middleRow} of ${rowCount})'s bottom face; a level cut flush with the top of the bottom plate.`,
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
 * Corner blocking. `mirrored` must match the chevron braces it's actually
 * connecting — chevron's own upper/lower stud sides are always equal to
 * each other (both "left" unmirrored, both "right" mirrored — see
 * `BRACE_STUD_SIDES.chevron`), so a single stud-side flip covers both
 * reference braces here.
 */
function buildBracedCenterConnector(widthIn: number, heightIn: number, rowCount: number, studSpanIn: number, mirrored: boolean): PanelMember {
  const middleRow = (rowCount + 1) / 2;
  const middleRowCenterZIn = SKIN_THICKNESS_IN + (studSpanIn * middleRow) / (rowCount + 1);
  /* ⚠ NO BAR AT THE CENTRE? ANCHOR ON MID-HEIGHT. Tommy, 2026-10-13: *"If
     there happens to be no girt the center of the panel then just center it
     on the height if that ever happens."* It happens silently: `middleRow` is
     `(rowCount + 1) / 2`, so an EVEN rowCount lands on a half (2 rows -> row
     1.5) and there is no bar there at all — yet the old code still offset by
     half a bar, anchoring braces to the faces of a bar that does not exist.
     `middleRowCenterZIn` is already exactly mid-height for every rowCount, so
     the fallback is just to stop adding the half-bar. */
  const hasMiddleBar = Number.isInteger(middleRow);
  const middleRowBarTopZIn = middleRowCenterZIn + (hasMiddleBar ? PLATE_2X4_THICKNESS_IN / 2 : 0);
  const middleRowBarBottomZIn = middleRowCenterZIn - (hasMiddleBar ? PLATE_2X4_THICKNESS_IN / 2 : 0);
  const topPlate2x4ZIn = heightIn - SKIN_THICKNESS_IN - PLATE_2X4_THICKNESS_IN;
  const bottomPlate2x4ZIn = SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN;
  const studSide = mirrored ? "right" : "left";

  const [upperX1, upperZ1, upperX2, upperZ2] = braceEndpoints(widthIn, studSide, middleRowBarTopZIn, topPlate2x4ZIn);
  const [lowerX1, lowerZ1, lowerX2, lowerZ2] = braceEndpoints(widthIn, studSide, middleRowBarBottomZIn, bottomPlate2x4ZIn);

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
 * chosen `pattern`/`mirrored` (see `buildDiagonalBraces`), and — chevron
 * only, either mirror state — the vertical center connector (see
 * `buildBracedCenterConnector`).
 */
export function buildBracedPanelMembers(
  widthIn: number,
  depthIn: number,
  heightIn: number,
  includeNailer: boolean,
  pattern: BracePattern,
  mirrored: boolean,
): PanelMember[] {
  const studSpanIn = heightIn - 2 * SKIN_THICKNESS_IN;
  const rowCount = computeBracedGirtRowCount(studSpanIn);
  const members: PanelMember[] = [
    ...buildSkins(widthIn, depthIn, heightIn),
    ...buildPlates(widthIn, depthIn, heightIn),
    ...buildCornerStuds(widthIn, depthIn, heightIn),
    ...buildGirtRows(rowCount, widthIn, depthIn, studSpanIn),
    ...buildDiagonalBraces(widthIn, depthIn, heightIn, rowCount, studSpanIn, pattern, mirrored),
  ];
  if (pattern === "chevron") {
    members.push(buildBracedCenterConnector(widthIn, heightIn, rowCount, studSpanIn, mirrored));
  }
  if (includeNailer) members.push(buildNailer(widthIn, heightIn));
  return members;
}

/**
 * Display name for the Shop Drawing title/3D-view captions, dynamic on the
 * active pattern/mirror (Tommy wants "Hatch Forward Panel"/"Hatch Back
 * Panel" to actually read that way wherever a user sees them) — the
 * shared `panelTypes` catalog entry stays generically "Braced Panel" so
 * BOM/structural notes read correctly for the whole family regardless of
 * style; this helper is used only at the specific UI surfaces that show a
 * style-aware name (mirrors how Square Bale Panels' own note text
 * dynamically relabels a "standard"-typed slot, without renaming the
 * shared catalog entry itself).
 */
export function bracedPanelDisplayLabel(pattern: BracePattern, mirrored: boolean): string {
  if (pattern === "hatch") return mirrored ? "Hatch Back Panel" : "Hatch Forward Panel";
  return mirrored ? "Chevron Braced Panel (Mirrored)" : "Chevron Braced Panel";
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
  pattern: BracePattern,
  mirrored: boolean,
): PanelComponentSchema {
  const members = buildBracedPanelMembers(widthIn, depthIn, heightIn, includeNailer, pattern, mirrored);
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
    displayName: bracedPanelDisplayLabel(pattern, mirrored),
    status: "draft",
    derivedFrom: "standard_panel",
    overallDimensions: { heightIn, widthIn, depthIn },
    members,
    fasteners: [],
    notes,
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
