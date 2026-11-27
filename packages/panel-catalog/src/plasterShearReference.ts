import type { CatalogStatus } from "./types";

/**
 * IRC Appendix S **Table 106.16 — Allowable Shear (pounds per foot) for
 * Plastered Strawbale Shear Walls**, transcribed 2026-11-26 from the Ecobuild
 * Network's "Seismic Design Factors and Allowable Shears for Strawbale Wall
 * Assemblies" (26 Sep 2013), which reproduces the proposed code text in full.
 *
 * ⚠⚠ **THIS IS REFERENCE DATA FOR A WALL BUILDING INTEGRITY DOES NOT BUILD.**
 * Every row describes a *site-plastered straw-BALE* wall, where plaster is
 * applied directly onto bales and the bale core acts as the web transferring
 * shear between the two plaster skins — the SIP analogy King draws and the
 * reason §105.6.1 forbids any membrane between straw and plaster. A BI panel
 * is a stud-framed, straw-filled panel whose lateral capacity comes from its
 * bracing, its screws and its plywood, and whose plaster (where there is any)
 * goes on over paper and lath. **None of these rows applies to it.**
 *
 * It is here because Tommy asked for it in those terms — *"additional sheer
 * value indicators that most certainly do not need to be used/somewhat
 * separate calculation estimate"* — so that a reader can see what plaster is
 * worth on a wall that does rely on it, and how far that is from a number
 * anybody should design to. See `plasterShearIndicator.ts` in calc-engine for
 * the guard rails, and docs/plaster-perm-and-shear-research-2026-11-26.md for
 * the full transcription and sources.
 */
export interface PlasterShearReferenceRow {
  /** The table's own wall designation — A1, C2, E2 and so on. */
  designation: string;
  binder: "clay" | "soil-cement" | "lime" | "cement-lime" | "cement";
  /** Minimum plaster thickness EACH SIDE, inches. The table assumes both
   *  sides are plastered; a single-skin wall is not in it at all. */
  thicknessEachSideIn: number;
  /** Nominal sill plate size the row is tied to. */
  sillPlate: "2x4" | "4x4";
  anchorBoltSpacingIn: number;
  mesh: string;
  /** null where the row specifies no mesh and therefore no staples. */
  stapleSpacingIn: number | null;
  /** Allowable shear, pounds per linear foot, ALLOWABLE STRESS DESIGN,
   *  for an aspect ratio of 1:1 or less. */
  allowableShearPlf: number;
}

export const plasterShearReferenceRows: PlasterShearReferenceRow[] = [
  { designation: "A1", binder: "clay", thicknessEachSideIn: 1.5, sillPlate: "2x4", anchorBoltSpacingIn: 32, mesh: "none", stapleSpacingIn: null, allowableShearPlf: 60 },
  { designation: "A2", binder: "clay", thicknessEachSideIn: 1.5, sillPlate: "2x4", anchorBoltSpacingIn: 32, mesh: "2in x 2in high-density polypropylene", stapleSpacingIn: 2, allowableShearPlf: 140 },
  { designation: "A3", binder: "clay", thicknessEachSideIn: 1.5, sillPlate: "2x4", anchorBoltSpacingIn: 32, mesh: "2in x 2in 14 ga", stapleSpacingIn: 4, allowableShearPlf: 180 },
  { designation: "B", binder: "soil-cement", thicknessEachSideIn: 1, sillPlate: "4x4", anchorBoltSpacingIn: 24, mesh: "2in x 2in 14 ga", stapleSpacingIn: 2, allowableShearPlf: 520 },
  { designation: "C1", binder: "lime", thicknessEachSideIn: 0.875, sillPlate: "2x4", anchorBoltSpacingIn: 32, mesh: "17 ga woven wire", stapleSpacingIn: 3, allowableShearPlf: 330 },
  { designation: "C2", binder: "lime", thicknessEachSideIn: 0.875, sillPlate: "4x4", anchorBoltSpacingIn: 24, mesh: "2in x 2in 14 ga", stapleSpacingIn: 2, allowableShearPlf: 450 },
  { designation: "D1", binder: "cement-lime", thicknessEachSideIn: 0.875, sillPlate: "4x4", anchorBoltSpacingIn: 32, mesh: "17 ga woven wire", stapleSpacingIn: 2, allowableShearPlf: 380 },
  { designation: "D2", binder: "cement-lime", thicknessEachSideIn: 0.875, sillPlate: "4x4", anchorBoltSpacingIn: 24, mesh: "2in x 2in 14 ga", stapleSpacingIn: 2, allowableShearPlf: 520 },
  { designation: "E1", binder: "cement", thicknessEachSideIn: 0.875, sillPlate: "4x4", anchorBoltSpacingIn: 32, mesh: "2in x 2in 14 ga", stapleSpacingIn: 2, allowableShearPlf: 540 },
  { designation: "E2", binder: "cement", thicknessEachSideIn: 1.5, sillPlate: "4x4", anchorBoltSpacingIn: 24, mesh: "2in x 2in 14 ga", stapleSpacingIn: 2, allowableShearPlf: 680 },
];

/** Table 106.16 footnote (h) — wind only, never seismic. */
export const plasterShearWindIncreaseFactor = 1.4;

/** Table 106.16 footnote (f) — the fraction of the tabulated value permitted
 *  at a 2:1 aspect ratio, interpolated linearly from 1:1. Above 2:1 the table
 *  does not go. */
export const plasterShearAspectRatio2to1Factor = 0.5;

/** Table 106.16 footnote (i) — 16 ga mesh in place of 14 ga. */
export const plasterShear16GaugeMeshFactor = 0.6;

export const plasterShearReferenceStatus: {
  status: CatalogStatus;
  note: string;
} = {
  status: "pending-BI-confirmation",
  note:
    "IRC Appendix S Table 106.16, transcribed 2026-11-26 from the Ecobuild Network's \"Seismic Design Factors and Allowable Shears for Strawbale Wall Assemblies\" (26 Sep 2013), which reproduces the proposed code text in full. Derived from Ash et al. (2003) full-scale reversed-cyclic tests with a factor of safety of 2.5 on the clay rows, plus a further 10% reduction where strain-compatibility analyses were used. " +
    "⚠ PENDING AND LIKELY TO STAY PENDING: this is not a Building Integrity value and no BI panel has been tested against it. Every row is a site-plastered straw-BALE wall with plaster bonded directly to the bales. A BI panel is stud-framed with plaster over paper and lath, so the mechanism the table measures — the bale core transferring shear between two bonded plaster skins — is absent by construction. " +
    "⚠ It is carried ONLY as a comparison figure, because Tommy asked for \"additional sheer value indicators that most certainly do not need to be used\". Nothing in the app's structural path may read it: the shear derivation sheet counts bracing, screws and plywood, and must go on doing exactly that.",
};
