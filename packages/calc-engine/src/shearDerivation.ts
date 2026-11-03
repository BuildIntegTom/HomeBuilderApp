import type { PanelMember } from "@building-integrity/panel-catalog";
import {
  NDS_COLUMN_C_SAWN_LUMBER,
  SPF_NO2_EMIN_PSI,
  SPF_NO2_FC_PSI,
  computeBracedPanelShearCapacityLb,
} from "./panelStructuralEstimates";

/**
 * **THE DERIVATION SHEET — B18.**
 *
 * > *"Derivation sheet sounds freaking awesome."*
 *
 * > *"Id rather have a pattern be described to an engineer with estimated
 * > values rather than prescribe an engineer seismic zone thing."*
 * > — Tommy, 2026-11-02
 *
 * This module shows its work. `computeBracedPanelShearCapacityLb` returns one
 * number per panel; an engineer asked to check that number needs every step
 * between a 2x4's cut length and the pounds, and needs to know which of the
 * inputs are real published figures and which are this app's assumptions.
 *
 * ⚠ **IT DOES NOT NAME A SEISMIC ZONE, AND THAT IS THE POINT.** A rating is
 * capacity measured against DEMAND, and demand needs a design base shear this
 * app has no numbers for — site class, spectral accelerations, building weight,
 * importance factor, response modification. Inventing one to produce a
 * reassuring letter is exactly what the flags rule forbids. What this sheet
 * does instead is describe the building that was drawn, in the units an
 * engineer's own demand calculation is already in, and stop there. B17 removed
 * the other half of the old arrangement, where a zone picked the bracing.
 *
 * ⚠ **Everything here is re-derived from the same constants and the same
 * formula the app's own number uses**, and `totalHorizontalLb` is asserted
 * against `computeBracedPanelShearCapacityLb` in the tests. A derivation sheet
 * that could disagree with the figure it explains would be worse than none.
 */

/** Where a number came from, so the sheet can say so beside it. */
export type DerivationInputStatus =
  /** A published figure, cited, that Building Integrity has not yet confirmed
   *  against the current NDS Supplement for its own species and grade. */
  | "pending-BI-confirmation"
  /** A value the code specifies outright — a code constant, not a choice. */
  | "code-constant"
  /** An explicit simplification this app makes, named rather than hidden. */
  | "app-assumption"
  /** Measured off the drawing: a real length, angle or section. */
  | "from-the-drawing";

export interface DerivationInput {
  label: string;
  value: number;
  unit: string;
  status: DerivationInputStatus;
  note: string;
}

/** One brace, from its cut length to the pounds it resists. */
export interface BraceDerivation {
  memberId: string;
  /** Unbraced length — the brace's own cut length, pin-ended. */
  lengthIn: number;
  /** The dimension it buckles about: 1.5in out of the wall's plane. */
  weakAxisDimIn: number;
  areaIn2: number;
  /** le/d. */
  slendernessRatio: number;
  /** FcE = 0.822 x Emin / (le/d)^2 */
  fcEPsi: number;
  /** Fc* — Fc after CD/CM/Ct/CF/Ci, all 1.0 here. */
  fcStarPsi: number;
  /** CP, NDS 3.7.1. */
  cp: number;
  /** Fc' = Fc* x CP */
  fcPrimePsi: number;
  /** Fc' x area. What the strut can carry along its own axis. */
  axialCapacityLb: number;
  /** Degrees from vertical. */
  tiltDeg: number;
  /** axial x sin(|tilt|). The part that resists racking. */
  horizontalLb: number;
}

export interface PanelShearDerivation {
  /** Whatever the caller uses to identify a panel — a wall id and slot index,
   *  a panel label. This module does not invent one. */
  panelId: string;
  braces: BraceDerivation[];
  totalHorizontalLb: number;
}

export interface WallShearDerivation {
  wallId: string;
  panels: PanelShearDerivation[];
  totalHorizontalLb: number;
  /** Running feet of this wall line, when the caller knows it. Lets an
   *  engineer read lb/ft, which is the unit a demand check is usually in. */
  wallLengthFt?: number;
  /** `totalHorizontalLb / wallLengthFt`, when the length is known. */
  lbPerFt?: number;
}

export interface BuildingShearDerivation {
  walls: WallShearDerivation[];
  totalHorizontalLb: number;
  braceCount: number;
  /** Every number the chain above depends on that is NOT measured off the
   *  drawing, each with its provenance. The sheet prints these once. */
  inputs: DerivationInput[];
}

/**
 * The shared material and code inputs, stated once.
 *
 * ⚠ The two SPF figures carry `pending-BI-confirmation` deliberately. The
 * module that defines them already says they are *"commonly-published
 * approximate NDS Supplement Table 4A figures"* and that the exact values must
 * be confirmed before use in permitting. A derivation sheet that printed them
 * bare would read as authority they do not have.
 */
export function shearDerivationInputs(): DerivationInput[] {
  return [
    {
      label: "Fc — compression parallel to grain",
      value: SPF_NO2_FC_PSI,
      unit: "psi",
      status: "pending-BI-confirmation",
      note: "Spruce-Pine-Fir No.2, approximate NDS Supplement Table 4A. Confirm against the current Supplement for the species and grade actually bought.",
    },
    {
      label: "Emin — modulus for stability",
      value: SPF_NO2_EMIN_PSI,
      unit: "psi",
      status: "pending-BI-confirmation",
      note: "Spruce-Pine-Fir No.2, approximate NDS Supplement Table 4A. Same caveat as Fc.",
    },
    {
      label: "c — column stability coefficient",
      value: NDS_COLUMN_C_SAWN_LUMBER,
      unit: "",
      status: "code-constant",
      note: "NDS 3.7.1 for sawn lumber (0.9 glulam, 0.85 poles). Not a choice.",
    },
    {
      label: "CD · CM · Ct · CF · Ci",
      value: 1,
      unit: "",
      status: "app-assumption",
      note: "Normal load duration, dry service, standard temperature, no incising, and Table 4A's CF for a 2x4 in compression is already about 1.0. A first-pass estimate, not a full engineered calculation.",
    },
    {
      label: "Brace end fixity",
      value: 1,
      unit: "Ke",
      status: "app-assumption",
      note: "Each brace is taken as a pin-ended strut over its own full cut length. Nothing restrains it against bowing out of the wall's plane along its run, so it buckles about its 1.5in dimension.",
    },
  ];
}

/** The NDS chain for one brace, every intermediate value kept. */
export function deriveBrace(member: PanelMember): BraceDerivation {
  const lengthIn = member.actualDimsIn.lengthIn;
  const weakAxisDimIn = member.actualDimsIn.thicknessIn;
  const areaIn2 = member.actualDimsIn.thicknessIn * member.actualDimsIn.widthIn;
  const slendernessRatio = lengthIn / weakAxisDimIn;
  const fcStarPsi = SPF_NO2_FC_PSI;
  const fcEPsi = (0.822 * SPF_NO2_EMIN_PSI) / slendernessRatio ** 2;
  const ratio = fcEPsi / fcStarPsi;
  const term = (1 + ratio) / (2 * NDS_COLUMN_C_SAWN_LUMBER);
  const cp = term - Math.sqrt(term ** 2 - ratio / NDS_COLUMN_C_SAWN_LUMBER);
  const fcPrimePsi = fcStarPsi * cp;
  const axialCapacityLb = fcPrimePsi * areaIn2;
  const tiltDeg = member.position.tiltDeg ?? 0;
  const horizontalLb = axialCapacityLb * Math.sin(Math.abs((tiltDeg * Math.PI) / 180));
  return {
    memberId: member.memberId,
    lengthIn,
    weakAxisDimIn,
    areaIn2,
    slendernessRatio,
    fcEPsi,
    fcStarPsi,
    cp,
    fcPrimePsi,
    axialCapacityLb,
    tiltDeg,
    horizontalLb,
  };
}

/**
 * One panel's braces, derived.
 *
 * ⚠ The filter is `role === "brace"`, the same one the capacity function uses,
 * and that is what keeps a Nailer Pair out of the sheet: a nailer sets a
 * pattern field and adds no member with that role, so it derives to nothing
 * rather than to an impressive-looking row of zeroes.
 */
export function derivePanelShear(panelId: string, members: PanelMember[]): PanelShearDerivation {
  const braces = members.filter((m) => m.role === "brace").map(deriveBrace);
  return {
    panelId,
    braces,
    totalHorizontalLb: braces.reduce((sum, b) => sum + b.horizontalLb, 0),
  };
}

export interface WallShearInput {
  wallId: string;
  wallLengthFt?: number;
  panels: { panelId: string; members: PanelMember[] }[];
}

/** One wall line. */
export function deriveWallShear(input: WallShearInput): WallShearDerivation {
  const panels = input.panels.map((p) => derivePanelShear(p.panelId, p.members));
  const totalHorizontalLb = panels.reduce((sum, p) => sum + p.totalHorizontalLb, 0);
  return {
    wallId: input.wallId,
    panels,
    totalHorizontalLb,
    ...(input.wallLengthFt !== undefined && {
      wallLengthFt: input.wallLengthFt,
      lbPerFt: input.wallLengthFt > 0 ? totalHorizontalLb / input.wallLengthFt : 0,
    }),
  };
}

/** The whole building, plus the inputs the sheet prints once at the top. */
export function deriveBuildingShear(walls: WallShearInput[]): BuildingShearDerivation {
  const derived = walls.map(deriveWallShear);
  return {
    walls: derived,
    totalHorizontalLb: derived.reduce((sum, w) => sum + w.totalHorizontalLb, 0),
    braceCount: derived.reduce((sum, w) => sum + w.panels.reduce((n, p) => n + p.braces.length, 0), 0),
    inputs: shearDerivationInputs(),
  };
}

/**
 * ⚠ **The sheet's own self-check.** Re-runs the app's capacity function over
 * the same members and reports whether the derivation lands on the same number.
 * Exported rather than kept in a test because the honest place for "these two
 * agree" is on the sheet an engineer is reading, not only in CI.
 */
export function derivationMatchesCapacity(members: PanelMember[], toleranceLb = 1e-6): boolean {
  const derived = derivePanelShear("check", members).totalHorizontalLb;
  return Math.abs(derived - computeBracedPanelShearCapacityLb(members)) <= toleranceLb;
}
