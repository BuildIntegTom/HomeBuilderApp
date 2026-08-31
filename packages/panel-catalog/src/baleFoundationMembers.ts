import type { PanelMember, PlanSpacePoint2D } from "./componentSchema";
import { LUMBER_SPECIES_GRADE, PLATE_2X4_THICKNESS_IN } from "./panelMemberHelpers";

/**
 * "Bale foundation" floor framing (Tommy) — a perimeter rim built from
 * FRAMING STACKS: a top board + a small gap (with periodic blocking inside
 * it) + a bottom board, standing on edge — e.g. 2x6 (5.5in) + 1.5in gap +
 * 2x6 (5.5in) = 12.5in tall. Two doubled rings BRACKET the wall above,
 * one under each wythe (Ring A flush with the wall's exterior face, Ring B
 * flush with its interior face — baleFoundationRingPlan.ts owns that
 * placement rule, perimeterRing.ts's computeInsetPerimeterRing the tracing),
 * carrying the wall's own exterior/interior wythe loads; single
 * (non-doubled) stacks fill the interior span inboard of Ring B at a
 * selectable o.c. spacing (see computeFieldFramingLayout). Every board
 * here is oriented "on edge"
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

/** Nominal thickness for the steel mesh skin — a mesh has no meaningful
 * "thickness" dimension really, this is just enough to render/export as a
 * thin real box rather than a zero-volume plane. */
export const STEEL_MESH_THICKNESS_IN = 0.125;

/** One connected piece of the bottom skin, already shaped and placed —
 * `computeFloorMembraneBandPolygons` in `@building-integrity/geometry`
 * produces these (in feet, footprint coordinates); the caller converts to
 * member-space inches. */
export interface FloorSkinPiece {
  /** 0 = the fully-opaque band, NEAREST the least-accessible-corner marker.
   * Undefined = one uniform, fully-opaque skin with no `opacityOverride` at
   * all — the behavior from before the bands existed. The near-to-far
   * ordering is resolved upstream in `computeFloorMembraneBandPolygons`, so
   * there is deliberately no `nearIsMax` reversal left in this file. */
  bandIndex?: number;
  /** >0 only where a notch cuts one band into disconnected pieces. */
  pieceIndex: number;
  /** This piece's real plan ring in MEMBER SPACE (X = width, Y = depth),
   * inches, absolute, perimeter order. */
  cornersIn: PlanSpacePoint2D[];
}

/** Indexed directly by `FloorSkinPiece.bandIndex` — index 0 IS the band
 * nearest the marker (Tommy: "dividing the space into one side being opaque
 * and the other side being 75% opaque followed by 50%"). Render-only
 * values; nothing structural or dimensional depends on them. */
const OPACITIES_NEAR_TO_FAR = [1, 0.75, 0.5];

/**
 * Rodent/air-sealed bottom skin (Tommy: "an option to do rodent and air
 * sealed steel clay bottom... basically just a skin for the bottom") —
 * the galvanized welded wire mesh only (the `floorAssemblyLayers`
 * "wire-mesh" entry in data.ts), spanning the whole FOOTPRINT, not one
 * panel — unlike `buildSkins` in panelMemberHelpers.ts, which builds a
 * panel-LOCAL top/bottom face. The clay coating over this mesh isn't
 * modeled as a 3D member, matching how every other plaster coating in this
 * app (wall clay/lime plaster) is calculator-only with no 3D representation
 * — see Plaster Master.
 *
 * Each piece becomes an n-gon PRISM member (`planPolygonCornersIn`), so the
 * skin is the building's own outline rather than its bounding rectangle
 * (Tommy: "lets make that the same size as the footprint") — on an octagon,
 * a bump-out or a notch the old box members hung out past the real floor.
 * `zIn` stays 0 on every piece, which is what keeps them all coplanar:
 * `zIn` is HEIGHT in member space and there is no legitimate reason for
 * this builder to write a depth offset into it.
 *
 * Several pieces can share one `bandIndex` (a notch splitting a band in
 * two); they all get that band's opacity via `opacityOverride`, which
 * PanelMembersGroup.tsx reads ahead of the material's own default.
 *
 * `actualDimsIn` carries each piece's own plan BOUNDING BOX as
 * `lengthIn`/`widthIn` — the same caveat `trapezoidCornersIn` already
 * carries: the real rendered shape comes from the corners, and the dims are
 * there for any consumer that reads dims. Nothing aggregates `wire_mesh`
 * dims today; mesh quantity/cost comes from `computeFootprintAreaSqFt`.
 */
export function buildFloorBottomSkinMembers(pieces: FloorSkinPiece[]): PanelMember[] {
  return pieces.map((piece) => {
    const xs = piece.cornersIn.map((c) => c.xIn);
    const ys = piece.cornersIn.map((c) => c.yIn);
    const minXIn = Math.min(...xs);
    const minYIn = Math.min(...ys);
    const banded = piece.bandIndex !== undefined;
    const opacity = banded ? OPACITIES_NEAR_TO_FAR[piece.bandIndex!] : undefined;
    return {
      memberId: banded ? `floor_bottom_skin_band_${piece.bandIndex}_${piece.pieceIndex}` : "floor_bottom_skin",
      material: "wire_mesh",
      speciesGrade: null,
      plySpec: null,
      nominalSize: null,
      actualDimsIn: {
        thicknessIn: STEEL_MESH_THICKNESS_IN,
        widthIn: Math.max(...ys) - minYIn,
        lengthIn: Math.max(...xs) - minXIn,
      },
      orientation: "flat",
      // Member space: xIn = width, yIn = depth, zIn = height up (see
      // MemberPosition in componentSchema.ts). xIn/yIn are this piece's own
      // plan min-corner, matching `actualDimsIn`' bounding box — the real
      // geometry is `planPolygonCornersIn`, whose points are already
      // absolute and are NOT offset by them. zIn stays 0 on every piece so
      // all bands sit on one horizontal plane.
      position: { xIn: minXIn, yIn: minYIn, zIn: 0, rotationDeg: 0, planPolygonCornersIn: piece.cornersIn },
      role: "skin",
      qty: 1,
      ...(opacity !== undefined ? { opacityOverride: opacity } : {}),
      notes:
        "Galvanized welded wire mesh, stapled to the underside of the lowest framing member — rodent/pest barrier, 10mm max opening. " +
        (banded
          ? `Rendered at ${Math.round(opacity! * 100)}% opacity (band ${piece.bandIndex! + 1} of 3, radiating from the least-accessible-corner marker) so the real framing underneath stays visible. `
          : "") +
        "The clay coat over it is calculator-only (see Plaster Master), not modeled here.",
    };
  });
}
