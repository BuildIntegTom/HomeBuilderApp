import { standardPanelBom, standardPanelHeightIn } from "./data";
import type { PanelMember } from "./componentSchema";

/**
 * Shared cross-section constants + member builders behind both
 * `buildStandardPanelMembers` and `buildBracedPanelMembers` — a braced
 * panel is a standard panel's skins/plates/studs/nailer with a different
 * number of girt rows plus a diagonal brace, so those 4 pieces live here
 * once instead of being duplicated per panel type.
 */

export const SKIN_THICKNESS_IN = standardPanelBom.bottomPlateSkin.thicknessIn; // 0.75
export const SKIN_PLY_SPEC = "3/4in_5ply_CDX";
export const PLATE_2X4_THICKNESS_IN = 1.5; // standard nominal 2x4 actual thickness
export const PLATE_2X4_WIDTH_IN = 3.5; // standard nominal 2x4 actual width
export const LUMBER_SPECIES_GRADE = "No. 2 Pine";
export const GIRT_WEB_THICKNESS_IN = standardPanelBom.girts.web.thicknessIn; // 0.5
export const GIRT_WEB_HEIGHT_IN = standardPanelBom.girts.web.widthIn; // 8.75
export const GIRT_WEB_PLY_SPEC = "1/2in_3ply_CDX";
export const NAILER_THICKNESS_IN = standardPanelBom.nailer.thicknessIn; // 1.5
export const NAILER_WIDTH_IN = standardPanelBom.nailer.widthIn; // 3.5

// Tommy: bottom/top plate 2x4s sit "centered on Nin width, 1.5in clear
// each end" — a fixed clearance rule, independent of the selected width.
export const PLATE_END_CLEARANCE_IN = 1.5;

// Tommy: the web plywood is 0.5in longer than the clear span between the
// two stud doubles (split evenly, 0.25in overlap onto each girt bar's
// span) — extra bearing surface for where it rests on the bars, not a
// literal edge-to-edge fit.
export const WEB_OVERHANG_TOTAL_IN = 0.5;

// Derived from the confirmed 120in-tall reference BOM's nailer length
// (115.5in — a 4.5in total deficit vs. the full panel height); applied at
// whatever height is actually selected.
export const NAILER_LENGTH_DEFICIT_IN = standardPanelHeightIn.value - standardPanelBom.nailer.lengthIn;

/**
 * The X/Y/Z box size (inches) a renderer/exporter should draw for this
 * member, derived from its `actualDimsIn` per (orientation, rotationDeg):
 * - "flat", 0deg (skins, plate 2x4s, girt web): lying flat on the XY plane — X=length, Y=width, Z=thickness.
 * - "vertical", 0deg (studs, nailer): standing upright — X=thickness, Y=width, Z=length.
 * - "diagonal", 0deg: tilted brace, wide face spanning Y — X=thickness, Y=width, Z=length (unused today).
 * - "diagonal", 90deg (braced panel's diagonal braces, header/gable/truss web braces): rotated so the
 *   wide face spans X instead — X=width, Y=thickness, Z=length — keeps the brace confined to a thin
 *   Y-slice (e.g. the exterior wythe) instead of centered across the panel's full depth.
 * - "horizontal", 90deg: standing on its 1.5in edge, spanning Y — X=thickness, Y=length, Z=width
 *   (unused today, kept for a future member that genuinely stands tall on its narrow edge).
 * - "horizontal", 180deg (girt bars, Tommy: "rotate girt bars 90 degrees hotdog style" — rolled about
 *   its own long/Y axis from the 90deg case above): laid onto its wide 3.5in face instead, spanning Y —
 *   X=width, Y=length, Z=thickness — a real bearing ledge (3.5in) for the girt web to rest on, with
 *   only a thin (1.5in) vertical footprint.
 * - "horizontal", 0deg: on edge, spanning X — X=length, Y=thickness, Z=width (unused today, kept for a
 *   future member that genuinely stands on edge rather than lying flat).
 * Shared here (not duplicated per-consumer) since the 3D renderer and any
 * future SketchUp exporter both need to agree on it exactly.
 */
export function memberBoxSizeIn(member: PanelMember): { xIn: number; yIn: number; zIn: number } {
  const { thicknessIn: t, widthIn: w, lengthIn: l } = member.actualDimsIn;
  if (member.orientation === "diagonal" && member.position.rotationDeg === 90) return { xIn: w, yIn: t, zIn: l };
  if (member.orientation === "vertical" || member.orientation === "diagonal") return { xIn: t, yIn: w, zIn: l };
  if (member.orientation === "horizontal" && member.position.rotationDeg === 90) return { xIn: t, yIn: l, zIn: w };
  if (member.orientation === "horizontal" && member.position.rotationDeg === 180) return { xIn: w, yIn: l, zIn: t };
  if (member.orientation === "horizontal") return { xIn: l, yIn: t, zIn: w };
  return { xIn: l, yIn: w, zIn: t }; // "flat"
}

/** Bottom + top plywood skins, spanning the full widthIn x depthIn footprint. */
export function buildSkins(widthIn: number, depthIn: number, heightIn: number): PanelMember[] {
  return [
    {
      memberId: "bottom_plate_skin",
      material: "plywood",
      speciesGrade: null,
      plySpec: SKIN_PLY_SPEC,
      nominalSize: null,
      actualDimsIn: { thicknessIn: SKIN_THICKNESS_IN, widthIn: depthIn, lengthIn: widthIn },
      orientation: "flat",
      position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0 },
      role: "skin",
      qty: 1,
    },
    {
      memberId: "top_plate_skin",
      material: "plywood",
      speciesGrade: null,
      plySpec: SKIN_PLY_SPEC,
      nominalSize: null,
      actualDimsIn: { thicknessIn: SKIN_THICKNESS_IN, widthIn: depthIn, lengthIn: widthIn },
      orientation: "flat",
      position: { xIn: 0, yIn: 0, zIn: heightIn - SKIN_THICKNESS_IN, rotationDeg: 0 },
      role: "skin",
      qty: 1,
    },
  ];
}

/** Bottom + top plate 2x4s (ext + int wythe edges), 1.5in clear at each end. */
export function buildPlates(widthIn: number, depthIn: number, heightIn: number): PanelMember[] {
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
        actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: plateLengthIn },
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
        nominalSize: "2x4",
        actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: plateLengthIn },
        orientation: "flat",
        position: { xIn: PLATE_END_CLEARANCE_IN, yIn: depthIn - PLATE_2X4_WIDTH_IN, zIn, rotationDeg: 0 },
        role: "plate",
        qty: 1,
        notes: "interior-wythe edge",
      },
    );
  }
  return members;
}

/** All 4 corner studs, spanning the full stud height between the 2 skins. */
export function buildCornerStuds(widthIn: number, depthIn: number, heightIn: number): PanelMember[] {
  const studSpanIn = heightIn - 2 * SKIN_THICKNESS_IN;
  const cornerXs = [0, widthIn - PLATE_2X4_THICKNESS_IN];
  const cornerYs = [0, depthIn - PLATE_2X4_WIDTH_IN];
  const members: PanelMember[] = [];
  let cornerIdx = 0;
  for (const yIn of cornerYs) {
    for (const xIn of cornerXs) {
      cornerIdx++;
      members.push({
        memberId: `stud_corner_${cornerIdx}`,
        material: "dimensional_lumber",
        speciesGrade: LUMBER_SPECIES_GRADE,
        plySpec: null,
        nominalSize: "2x4",
        actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: studSpanIn },
        orientation: "vertical",
        position: { xIn, yIn, zIn: SKIN_THICKNESS_IN, rotationDeg: 0 },
        role: "stud",
        qty: 1,
        notes: cornerIdx === 1 ? "one per corner, 4 total" : undefined,
      });
    }
  }
  return members;
}

/** Optional vertical nailer, centered along the width on the exterior wythe. */
/**
 * `offsetIn` slides the nailer along the exterior wythe from its default
 * centered position (Tommy: "nailer studs should be able to slide on the
 * wyth they are on" — square-bale panels lean on this heavily). This is a
 * numeric position control, not a literal drag gesture in the 3D/2D view
 * yet — flagged as a simplification of "slide."
 */
export function buildNailer(widthIn: number, heightIn: number, offsetIn = 0): PanelMember {
  const nailerLengthIn = heightIn - NAILER_LENGTH_DEFICIT_IN;
  return {
    memberId: "nailer",
    material: "dimensional_lumber",
    speciesGrade: LUMBER_SPECIES_GRADE,
    plySpec: null,
    nominalSize: "2x4",
    actualDimsIn: { thicknessIn: NAILER_THICKNESS_IN, widthIn: NAILER_WIDTH_IN, lengthIn: nailerLengthIn },
    orientation: "vertical",
    position: { xIn: widthIn / 2 - NAILER_THICKNESS_IN / 2 + offsetIn, yIn: 0, zIn: SKIN_THICKNESS_IN, rotationDeg: 0 },
    role: "nailer",
    qty: 1,
    notes:
      "OPTIONAL — \"with nailer\" vs \"bare standard\". 3.5in face oriented outward as exterior surface." +
      (offsetIn !== 0 ? ` Slid ${offsetIn > 0 ? "+" : ""}${offsetIn}in from center along the exterior wythe.` : " Centered on exterior wythe."),
  };
}

/**
 * Minimum brace angle (Tommy: "the math with the triangle parts of the
 * headers cannot go outside the range of 30-45 degrees") — used by
 * `computeTrussWebPeakCount` to decide how many repeating peaks a truss
 * web needs so no single web segment ends up too shallow. There's no
 * matching MAX constant because the upper bound only ever gets tighter as
 * peak count grows (more, narrower segments only get steeper), so nothing
 * needs to clamp against exceeding 45deg from this side — see that
 * function's own doc comment.
 */
export const TRUSS_WEB_MIN_ANGLE_DEG = 30;

/**
 * How many repeating peaks a "W-truss" web (see `buildTrussWebBraces`)
 * needs so every individual web segment's rise angle is at least
 * `TRUSS_WEB_MIN_ANGLE_DEG` — Tommy: "door headers just have one upside
 * down V" (1 peak) but a wider "long header" or a gable's full width
 * needs more, narrower peaks to stay in a sane bracing angle instead of
 * one shallow, wide one. `riseIn` is the (possibly conservative/shortest)
 * vertical rise available to a peak; `widthIn` is the full span being
 * webbed. Always returns at least 1 (an isolated call site — e.g. a door
 * header — can force exactly 1 regardless of this).
 */
export function computeTrussWebPeakCount(widthIn: number, riseIn: number): number {
  const minAngleRad = (TRUSS_WEB_MIN_ANGLE_DEG * Math.PI) / 180;
  const n = Math.ceil((widthIn * Math.tan(minAngleRad)) / (2 * riseIn));
  return Math.max(1, n);
}

/** The rise angle (degrees, from horizontal) one truss-web peak makes,
 * given how many peaks share `widthIn` and how much vertical `riseIn` each
 * has — the inverse of what `computeTrussWebPeakCount` solves for, used to
 * report/flag the actual resulting angle (e.g. a door header's forced
 * single peak might land outside the 30-45deg range for an unusually
 * wide/short opening; this is how a caller would notice and flag it). */
export function computeTrussWebAngleDeg(widthIn: number, riseIn: number, peakCount: number): number {
  const halfSegmentIn = widthIn / (2 * peakCount);
  return (Math.atan2(riseIn, halfSegmentIn) * 180) / Math.PI;
}

/**
 * Two diagonal 2x4s can't literally converge to one shared atom-point
 * (Tommy: "the ends of the diagonal pieces of header brace should be
 * angled like the bracing panels" — the same "flank instead of pinch"
 * principle as a Braced Panel's chevron braces around its girt bar) — every
 * PEAK (a triangle's own rise meeting its own fall) and every INTERNAL foot
 * (one triangle's fall meeting the next triangle's rise) stops each piece
 * `PEAK_GAP_IN / 2` short of the shared point instead, flanking a small gap
 * the width of one 2x4. The very first/last foot (touching the continuous
 * bottom chord, not another diagonal piece) is unaffected.
 */
export const PEAK_GAP_IN = PLATE_2X4_THICKNESS_IN;

/** A point `distIn` inches from (fromX,fromZ) along the line toward (towardX,towardZ). */
function retreatPoint(fromXIn: number, fromZIn: number, towardXIn: number, towardZIn: number, distIn: number): [number, number] {
  const dx = towardXIn - fromXIn;
  const dz = towardZIn - fromZIn;
  const lenIn = Math.hypot(dx, dz);
  if (lenIn === 0) return [fromXIn, fromZIn];
  const t = distIn / lenIn;
  return [fromXIn + dx * t, fromZIn + dz * t];
}

/**
 * A continuous "W-truss" zigzag of `peakCount` triangular webs between a
 * flat bottom chord and a (possibly sloped) top chord — Tommy, from
 * reference photos of real straw-bale wall/gable bracing: repeating
 * "upside-down V" triangles sharing their feet/peaks continuously
 * (foot0-peak0-foot1-peak1-...-footN) rather than isolated, gapped
 * triangles, the same way a real truss's web members connect — except each
 * internal peak/foot flanks a small gap instead of sharing one exact point
 * (see `PEAK_GAP_IN`/`retreatPoint`). `topZAt(x)` lets the top chord follow
 * a slope (a Gable End Panel's rip) or stay flat (headers — pass a constant
 * function). Every brace is a 2x4, rotated 90deg so it's confined to a thin
 * (1.5in) Y-slice — pass `yIn` to place that slice on whichever wythe (see
 * the "diagonal" + rotationDeg=90 case in `memberBoxSizeIn`).
 */
export function buildTrussWebBraces(
  peakCount: number,
  widthIn: number,
  bottomZIn: number,
  topZAt: (xIn: number) => number,
  yIn: number,
  idPrefix: string,
): PanelMember[] {
  const members: PanelMember[] = [];
  const segWidthIn = widthIn / peakCount;

  function makeWebBrace(memberId: string, x1: number, z1: number, x2: number, z2: number, notes: string): PanelMember {
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
      position: { xIn: centerX, yIn, zIn: centerZ, rotationDeg: 90, tiltDeg },
      role: "brace",
      qty: 1,
      notes,
    };
  }

  for (let i = 0; i < peakCount; i++) {
    const footLeftXIn = i * segWidthIn;
    const footRightXIn = (i + 1) * segWidthIn;
    const peakXIn = footLeftXIn + segWidthIn / 2;
    const peakZIn = topZAt(peakXIn);
    const halfGapIn = PEAK_GAP_IN / 2;

    const [riseFootXIn, riseFootZIn] =
      i === 0 ? [footLeftXIn, bottomZIn] : retreatPoint(footLeftXIn, bottomZIn, peakXIn, peakZIn, halfGapIn);
    const [risePeakXIn, risePeakZIn] = retreatPoint(peakXIn, peakZIn, footLeftXIn, bottomZIn, halfGapIn);
    const [fallPeakXIn, fallPeakZIn] = retreatPoint(peakXIn, peakZIn, footRightXIn, bottomZIn, halfGapIn);
    const [fallFootXIn, fallFootZIn] =
      i === peakCount - 1 ? [footRightXIn, bottomZIn] : retreatPoint(footRightXIn, bottomZIn, peakXIn, peakZIn, halfGapIn);

    members.push(
      makeWebBrace(
        `${idPrefix}_${i + 1}_rise`,
        riseFootXIn,
        riseFootZIn,
        risePeakXIn,
        risePeakZIn,
        `web ${i + 1} of ${peakCount}, rising from the bottom chord to the peak — stops short of the peak/foot on either end, flanking a small gap rather than pinching to a shared point with the adjacent piece.`,
      ),
      makeWebBrace(
        `${idPrefix}_${i + 1}_fall`,
        fallPeakXIn,
        fallPeakZIn,
        fallFootXIn,
        fallFootZIn,
        `web ${i + 1} of ${peakCount}, falling from the peak back to the bottom chord — stops short of the peak/foot on either end, flanking a small gap rather than pinching to a shared point with the adjacent piece.`,
      ),
    );
  }
  return members;
}

/**
 * `rowCount` girt rows, evenly spaced across the stud span (Tommy: the
 * Standard Panel always uses 2; the Braced Panel uses 3+, see
 * `computeBracedGirtRowCount`). Each row is 2 short 2x4 bars (one per
 * stud double) plus 1 plywood web that rests flat on top of both bars,
 * spanning between them with a little extra bearing overhang past each
 * bar (`WEB_OVERHANG_TOTAL_IN`) — modeling how the web physically slides
 * down the stud channels into place during fabrication. Each bar's OUTER
 * edge sits flush to its stud pair's INSIDE face and extends inward
 * (toward the panel's center) by its own 3.5in face — rolled 90deg
 * "hotdog style" from a standing-on-edge orientation (Tommy: "rotate girt
 * bars 90 degrees hotdog style") so that wide face lies horizontal,
 * giving the web a real 3.5in-deep bearing ledge instead of a thin 1.5in
 * one; the bar's own vertical footprint shrinks to its 1.5in thickness.
 * Each row's own CENTER Z is a fixed fraction of the total stud span
 * (Tommy: "the center of the girt bar... should be [determined] based on
 * total height of the panel") — the reference other members (the web
 * above, and a Braced Panel's diagonal braces) align to, not the bar's
 * own top/bottom face. This in-plane placement is an interpretation of
 * the confirmed girt qty/cross-section sizes (exact position wasn't
 * independently specified elsewhere).
 */
export function buildGirtRows(rowCount: number, widthIn: number, depthIn: number, studSpanIn: number): PanelMember[] {
  const members: PanelMember[] = [];
  const leftStudInnerFaceXIn = PLATE_2X4_THICKNESS_IN;
  const rightStudInnerFaceXIn = widthIn - PLATE_2X4_THICKNESS_IN;
  const barLeftXIn = leftStudInnerFaceXIn;
  const barRightXIn = rightStudInnerFaceXIn - PLATE_2X4_WIDTH_IN;
  const studFaceSpanIn = widthIn - 2 * PLATE_2X4_THICKNESS_IN;

  for (let row = 1; row <= rowCount; row++) {
    const centerZIn = SKIN_THICKNESS_IN + (studSpanIn * row) / (rowCount + 1);
    const barTopZIn = centerZIn + PLATE_2X4_THICKNESS_IN / 2;

    for (const [side, barXIn] of [
      ["left", barLeftXIn],
      ["right", barRightXIn],
    ] as const) {
      members.push({
        memberId: `girt_${row}_bar_${side}`,
        material: "dimensional_lumber",
        speciesGrade: LUMBER_SPECIES_GRADE,
        plySpec: null,
        nominalSize: "2x4",
        actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: depthIn },
        orientation: "horizontal",
        position: { xIn: barXIn, yIn: 0, zIn: centerZIn - PLATE_2X4_THICKNESS_IN / 2, rotationDeg: 180 },
        role: "girt",
        qty: 1,
        notes: `girt ${row} of ${rowCount}, ${side} bar — flush to the inside face of the ${side} stud double, rolled onto its 3.5in face so the web has a real bearing ledge to rest on; centered at a fixed fraction of the total panel height.`,
      });
    }

    members.push({
      memberId: `girt_${row}_web`,
      material: "plywood",
      speciesGrade: null,
      plySpec: GIRT_WEB_PLY_SPEC,
      nominalSize: null,
      actualDimsIn: {
        thicknessIn: GIRT_WEB_THICKNESS_IN,
        widthIn: GIRT_WEB_HEIGHT_IN,
        lengthIn: studFaceSpanIn + WEB_OVERHANG_TOTAL_IN,
      },
      orientation: "flat",
      position: {
        xIn: barLeftXIn - WEB_OVERHANG_TOTAL_IN / 2,
        yIn: depthIn / 2 - GIRT_WEB_HEIGHT_IN / 2,
        zIn: barTopZIn,
        rotationDeg: 0,
      },
      role: "girt_web",
      qty: 1,
      notes: `girt ${row} web, rests on top of both girt_${row}_bar_left/right`,
    });
  }

  return members;
}

/** Standard 4ft x 8ft sheet, the unit plywood is actually purchased in. */
export const PLYWOOD_SHEET_AREA_SQFT = 32;

/**
 * Total real sheet area (sqft) of every plywood member at a given
 * thickness — `actualDimsIn.widthIn x actualDimsIn.lengthIn` is always the
 * member's true physical size regardless of its 3D orientation/tilt (a
 * rip-cut gable skin's `lengthIn` is already its full rip length), so this
 * works uniformly across every panel type's member list. Used for the
 * Material Totals page (Tommy: "take note of this for 3/4in plywood
 * material totals").
 */
export function computePlywoodAreaSqFt(members: PanelMember[], thicknessIn: number, toleranceIn = 0.05): number {
  return members
    .filter((m) => m.material === "plywood" && Math.abs(m.actualDimsIn.thicknessIn - thicknessIn) < toleranceIn)
    .reduce((sum, m) => sum + (m.actualDimsIn.widthIn * m.actualDimsIn.lengthIn) / 144, 0);
}
