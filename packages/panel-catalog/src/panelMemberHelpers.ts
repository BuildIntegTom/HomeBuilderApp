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
 * - "diagonal", 90deg (braced panel's diagonal braces): rotated so the wide face spans X instead —
 *   X=width, Y=thickness, Z=length — keeps the brace confined to a thin Y-slice (e.g. the exterior
 *   wythe) instead of centered across the panel's full depth.
 * - "horizontal", 90deg (girt bars): on its side, spanning Y — X=thickness, Y=length, Z=width.
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
export function buildNailer(widthIn: number, heightIn: number): PanelMember {
  const nailerLengthIn = heightIn - NAILER_LENGTH_DEFICIT_IN;
  return {
    memberId: "nailer",
    material: "dimensional_lumber",
    speciesGrade: LUMBER_SPECIES_GRADE,
    plySpec: null,
    nominalSize: "2x4",
    actualDimsIn: { thicknessIn: NAILER_THICKNESS_IN, widthIn: NAILER_WIDTH_IN, lengthIn: nailerLengthIn },
    orientation: "vertical",
    position: { xIn: widthIn / 2 - NAILER_THICKNESS_IN / 2, yIn: 0, zIn: SKIN_THICKNESS_IN, rotationDeg: 0 },
    role: "nailer",
    qty: 1,
    notes: "OPTIONAL — \"with nailer\" vs \"bare standard\". 3.5in face oriented outward as exterior surface, centered on exterior wythe.",
  };
}

/**
 * `rowCount` girt rows, evenly spaced across the stud span (Tommy: the
 * Standard Panel always uses 2; the Braced Panel uses 3+, see
 * `computeBracedGirtRowCount`). Each row is 2 short 2x4 bars (one per
 * stud double, flush to that stud pair's INSIDE face — not centered along
 * the width) plus 1 plywood web that rests flat on top of both bars,
 * spanning between them with a little extra bearing overhang past each
 * bar (`WEB_OVERHANG_TOTAL_IN`) — modeling how the web physically slides
 * down the stud channels into place during fabrication. This in-plane
 * placement is an interpretation of the confirmed girt qty/cross-section
 * sizes (exact position wasn't independently specified elsewhere).
 */
export function buildGirtRows(rowCount: number, widthIn: number, depthIn: number, studSpanIn: number): PanelMember[] {
  const members: PanelMember[] = [];
  const barLeftXIn = PLATE_2X4_THICKNESS_IN;
  const barRightXIn = widthIn - 2 * PLATE_2X4_THICKNESS_IN;
  const studFaceSpanIn = widthIn - 2 * PLATE_2X4_THICKNESS_IN;

  for (let row = 1; row <= rowCount; row++) {
    const centerZIn = SKIN_THICKNESS_IN + (studSpanIn * row) / (rowCount + 1);
    const barTopZIn = centerZIn + PLATE_2X4_WIDTH_IN / 2;

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
        position: { xIn: barXIn, yIn: 0, zIn: centerZIn - PLATE_2X4_WIDTH_IN / 2, rotationDeg: 90 },
        role: "girt",
        qty: 1,
        notes: `girt ${row} of ${rowCount}, ${side} bar — flush to the inside face of the ${side} stud double; the web rests on top of this pair`,
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
