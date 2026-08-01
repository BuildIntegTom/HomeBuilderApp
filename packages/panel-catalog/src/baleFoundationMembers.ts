import type { PanelMember } from "./componentSchema";
import { LUMBER_SPECIES_GRADE, PLATE_2X4_THICKNESS_IN } from "./panelMemberHelpers";

/**
 * "Bale foundation" floor framing (Tommy) — a perimeter rim built from
 * FRAMING STACKS: a top board + a small gap (with periodic blocking inside
 * it) + a bottom board, standing on edge — e.g. 2x6 (5.5in) + 1.5in gap +
 * 2x6 (5.5in) = 12.5in tall. Two concentric doubled rings (Ring A flush
 * with the inside of the primary footprint, Ring B one panel-width further
 * inward — see perimeterRing.ts's computeInsetPerimeterRing) carry the
 * wall's own exterior/interior wythe loads; single (non-doubled) stacks
 * fill the rest of the interior span at a selectable o.c. spacing (see
 * computeFieldFramingLayout). Every board here is oriented "on edge"
 * (orientation: "horizontal", rotationDeg 0 — memberBoxSizeIn's own doc
 * comment flags this exact case as "kept for a future member that
 * genuinely stands on edge"), unlike Truss Plate/Box Beam's flat-lying
 * ext/int wythe members.
 */

export const BALE_FOUNDATION_TOP_DEPTH_DEFAULT_IN = 5.5;
export const BALE_FOUNDATION_BOTTOM_DEPTH_DEFAULT_IN = 5.5;
export const BALE_FOUNDATION_GAP_DEFAULT_IN = 1.5;
/** Subtracted from the wall's own toe-up bottom (its Z=0) to anchor the
 * top framing board's own top face — see buildBaleFoundationTopFaceZIn's
 * doc comment. Not part of any existing subfloor concept (none exists
 * elsewhere in this repo yet). */
export const SUBFLOOR_DEPTH_DEFAULT_IN = 0.75;
/** Fixed, not UI-adjustable (Tommy's own list of UI-changeable values was
 * top/bottom depth + gap + field spacing only). */
export const BALE_FOUNDATION_GAP_BLOCKING_SPACING_IN = 36;

export const BALE_FOUNDATION_FIELD_SPACING_OPTIONS_IN = [16, 24] as const;
export type BaleFoundationFieldSpacingIn = (typeof BALE_FOUNDATION_FIELD_SPACING_OPTIONS_IN)[number];
export const BALE_FOUNDATION_FIELD_SPACING_DEFAULT_IN: BaleFoundationFieldSpacingIn = 16;

/** The wall's own toe-up (first 1.5in of the wall panel, per
 * toeUpHeightIn in data.ts) starts at the wall's existing Z=0 — so the
 * whole bale foundation assembly sits entirely below Z=0, with the top
 * framing board's own top face at `-subfloorDepthIn`. Nothing about
 * existing wall/roof Z placement changes. */
export function baleFoundationTopFaceZIn(subfloorDepthIn: number): number {
  return -subfloorDepthIn;
}

function nominalSizeForDepthIn(depthIn: number): string {
  const known: Record<number, string> = { 3.5: "2x4", 5.5: "2x6", 7.25: "2x8", 9.25: "2x10", 11.25: "2x12" };
  return known[depthIn] ?? `${depthIn}in`;
}

/**
 * One framing stack's members in its own local frame: X = along its
 * length, Y = 0 (thin — a single stack occupies one Y slice; see
 * buildDoubledStackPair for how 2 stacks share a wider Y span), Z = 0 at
 * the stack's own bottom (bottom board's bottom face) rising to
 * `bottomDepthIn + gapIn + topDepthIn` at the top board's own top face.
 * Gap blocking pieces (role: "blocking") span the 1.5in-ish void between
 * the two boards, spaced every BALE_FOUNDATION_GAP_BLOCKING_SPACING_IN
 * along the run (both ends included, same "ceil, evenly redistribute"
 * convention used throughout this codebase's other spacing calcs).
 */
export function buildFramingStackMembers(idPrefix: string, lengthIn: number, topDepthIn: number, bottomDepthIn: number, gapIn: number): PanelMember[] {
  const members: PanelMember[] = [
    {
      memberId: `${idPrefix}_bottom`,
      material: "dimensional_lumber",
      speciesGrade: LUMBER_SPECIES_GRADE,
      plySpec: null,
      nominalSize: nominalSizeForDepthIn(bottomDepthIn),
      actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: bottomDepthIn, lengthIn },
      orientation: "horizontal",
      position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0 },
      role: "plate",
      qty: 1,
      notes: "Bottom framing board, standing on edge.",
    },
    {
      memberId: `${idPrefix}_top`,
      material: "dimensional_lumber",
      speciesGrade: LUMBER_SPECIES_GRADE,
      plySpec: null,
      nominalSize: nominalSizeForDepthIn(topDepthIn),
      actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: topDepthIn, lengthIn },
      orientation: "horizontal",
      position: { xIn: 0, yIn: 0, zIn: bottomDepthIn + gapIn, rotationDeg: 0 },
      role: "plate",
      qty: 1,
      notes: "Top framing board, standing on edge — its own top face is the assembly's real anchor (see baleFoundationTopFaceZIn).",
    },
  ];

  const segments = Math.max(1, Math.round(lengthIn / BALE_FOUNDATION_GAP_BLOCKING_SPACING_IN));
  const step = lengthIn / segments;
  for (let i = 0; i <= segments; i++) {
    members.push({
      memberId: `${idPrefix}_gap_blocking_${i}`,
      material: "dimensional_lumber",
      speciesGrade: LUMBER_SPECIES_GRADE,
      plySpec: null,
      nominalSize: null,
      actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_THICKNESS_IN, lengthIn: gapIn },
      orientation: "vertical",
      position: { xIn: i * step, yIn: 0, zIn: bottomDepthIn, rotationDeg: 0 },
      role: "blocking",
      qty: 1,
      notes: `Gap blocking, spans the void between the top and bottom boards — every ${BALE_FOUNDATION_GAP_BLOCKING_SPACING_IN}in along the run.`,
    });
  }
  return members;
}

/**
 * A "double stud" pair — 2 framing stacks side by side along Y, touching
 * (0 gap between the pair itself; the 1.5in gap Tommy described is the
 * VERTICAL gap within one stack, built by buildFramingStackMembers above,
 * not a horizontal gap between the 2 stacks of a pair — not explicitly
 * specified either way, flagged as the reasoned default). `memberId`
 * suffixed outer/inner the same way buildSquareBaleCornerStuds already
 * does for its own doubled studs.
 */
export function buildDoubledStackPair(idPrefix: string, lengthIn: number, topDepthIn: number, bottomDepthIn: number, gapIn: number): PanelMember[] {
  return [
    ...buildFramingStackMembers(`${idPrefix}_outer`, lengthIn, topDepthIn, bottomDepthIn, gapIn).map((m) => ({ ...m, position: { ...m.position, yIn: 0 } })),
    ...buildFramingStackMembers(`${idPrefix}_inner`, lengthIn, topDepthIn, bottomDepthIn, gapIn).map((m) => ({
      ...m,
      position: { ...m.position, yIn: PLATE_2X4_THICKNESS_IN },
    })),
  ];
}
