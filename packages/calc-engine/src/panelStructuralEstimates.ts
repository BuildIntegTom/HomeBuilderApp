import { memberBoxSizeIn, type PanelMember } from "@building-integrity/panel-catalog";

/**
 * First-pass estimated shear (racking) and bearing (axial load-bearing)
 * capacities for the Braced Panel (Tommy: "let's take a stab at making
 * some estimated engineering numbers for bracing panels... if it makes
 * you feel better we can have a note below the calculations on the UI
 * that says these are estimated numbers"). Both use the same underlying
 * NDS (National Design Specification for Wood Construction) sawn-lumber
 * column-buckling formula — a diagonal brace and a stud both resist their
 * respective loads (racking / axial) primarily by NOT buckling, so the
 * same math applies to each, just with different unbraced lengths and
 * (for the brace) a final step resolving the axial force into its
 * horizontal component.
 *
 * Reference design values below (Fc, Emin) are commonly-published
 * approximate NDS Supplement Table 4A figures for Spruce-Pine-Fir (SPF)
 * No.2 dimension lumber — cross-referenced against a general search for
 * "NDS SPF No.2 2x4 allowable axial load" (one source: ~2010 lb allowable
 * for a single 2x4 at 10ft unbraced length, governed by its strong axis —
 * this module's formula reproduces that same order of magnitude, ~1700 lb,
 * for the same inputs). Confirm the exact figures against the current NDS
 * Supplement before using for real engineering/permitting — this is an
 * estimate, not a substitute for a licensed engineer's calculation.
 */
export const SPF_NO2_FC_PSI = 1150; // Fc: compression parallel to grain
export const SPF_NO2_EMIN_PSI = 510_000; // Emin: modulus of elasticity for stability calcs
const NDS_COLUMN_C_SAWN_LUMBER = 0.8; // NDS 3.7.1 "c" for sawn lumber (vs. 0.9 glulam, 0.85 poles)

const STUD_THICKNESS_IN = 1.5; // 2x4 weak-axis dimension
const STUD_WIDTH_IN = 3.5; // 2x4 strong-axis dimension
const STUD_AREA_IN2 = STUD_THICKNESS_IN * STUD_WIDTH_IN;

/** Tommy: "just know that studs are that tall and are blocked every 36"" —
 * the blocking/girt spacing braces a stud against weak-axis (out-of-plane)
 * buckling, so that's the unbraced length used for bearing capacity, not
 * the full wall height. This assumes the panel's overall assembly
 * (plates, adjoining panels) adequately restrains in-plane buckling
 * instead of separately checking it — an explicit simplification, not an
 * oversight. */
const STUD_BLOCKING_SPACING_IN = 36;

/**
 * NDS column stability factor CP (NDS 3.7.1), then Fc' = Fc* x CP, then
 * allowable axial capacity = Fc' x area. `fcStarPsi` is Fc after the usual
 * adjustment factors (CD/CM/Ct/CF/Ci) — all taken as 1.0 here (normal
 * duration, dry service, standard temperature, no incising, and NDS Table
 * 4A's CF for 2x4 compression is already ~1.0), consistent with this
 * being a first-pass estimate rather than a full engineered calc.
 */
export function computeNdsColumnCapacityLb(unbracedLengthIn: number, weakAxisDimIn: number, areaIn2: number): number {
  const slendernessRatio = unbracedLengthIn / weakAxisDimIn;
  const fcStarPsi = SPF_NO2_FC_PSI;
  const fcEPsi = (0.822 * SPF_NO2_EMIN_PSI) / slendernessRatio ** 2;
  const ratio = fcEPsi / fcStarPsi;
  const term = (1 + ratio) / (2 * NDS_COLUMN_C_SAWN_LUMBER);
  const cp = term - Math.sqrt(term ** 2 - ratio / NDS_COLUMN_C_SAWN_LUMBER);
  const fcPrimePsi = fcStarPsi * cp;
  return fcPrimePsi * areaIn2;
}

/**
 * Estimated axial bearing capacity where two panels meet (Tommy: "when
 * two panels meet, there is usually two 2x4s meeting... let's just
 * calculate outside bearing loads where there is a stud pack") — N
 * independent 2x4 studs (default 2, a "double stud pack"), each buckling
 * about its weak axis over the 36in blocking spacing, summed (not treated
 * as one composite section, since the studs aren't glued/fully fastened
 * together into one solid member).
 */
export function computeStudPackBearingCapacityLb(studCount = 2): number {
  const perStudLb = computeNdsColumnCapacityLb(STUD_BLOCKING_SPACING_IN, STUD_THICKNESS_IN, STUD_AREA_IN2);
  return perStudLb * studCount;
}

export interface BuiltUpColumnSection {
  totalAreaIn2: number;
  /** Equivalent solid-rectangle weak-axis dimension (d = r x sqrt(12))
   * giving the same radius of gyration as the real built-up section —
   * plugs directly into computeNdsColumnCapacityLb's existing d/area
   * inputs, no changes needed to that formula itself. */
  effectiveWeakAxisDimIn: number;
}

/** One vertical member's own area/centroid/self-moment-of-inertia about
 * the panel's X axis (the axis every corner stud's weak 1.5in face already
 * lies along) — null for anything that isn't a full-height vertical
 * member (girts, plates, braces aren't part of this composite section). */
function verticalMemberXSection(member: PanelMember): { areaIn2: number; centerXIn: number; ownIIn4: number } | null {
  if (member.orientation !== "vertical") return null;
  const size = memberBoxSizeIn(member);
  return {
    areaIn2: size.xIn * size.yIn,
    centerXIn: member.position.xIn + size.xIn / 2,
    ownIIn4: (size.yIn * size.xIn ** 3) / 12,
  };
}

/**
 * Built-up composite cross-section for a Column/Corner panel's plywood-
 * clad sides (Tommy: "corner and column panels should have a much higher
 * estimate load bearing capacity because they have those two sheets of
 * plywood running up the sides... calculate the load bearing strength of
 * basically a truss plate turned up") — the two full-height side plywood
 * sheets and the corner studs (everything with a "vertical" orientation,
 * i.e. running the panel's full height) are treated as one composite
 * column cross-section via the parallel-axis theorem, rather than each
 * stud buckling independently. Material sitting far from the panel's own
 * centerline (the plywood, clad at the very edges) contributes far more
 * moment of inertia than a lone 1.5in stud ever could — the same principle
 * that makes a built-up/boxed column dramatically stiffer than its
 * individual parts. Uses the SAME NDS column formula as the plain stud
 * pack (computeNdsColumnCapacityLb) — this only changes what geometry
 * feeds into it, treating all material as one grade/species for
 * simplicity (plywood's actual E differs from the stud lumber's, an
 * explicit simplification consistent with this being a first-pass
 * estimate).
 */
export function computeBuiltUpColumnSection(members: PanelMember[]): BuiltUpColumnSection {
  const parts = members
    .map(verticalMemberXSection)
    .filter((p): p is NonNullable<typeof p> => p !== null);
  const totalAreaIn2 = parts.reduce((sum, p) => sum + p.areaIn2, 0);
  if (totalAreaIn2 === 0) return { totalAreaIn2: 0, effectiveWeakAxisDimIn: 0 };
  const centroidXIn = parts.reduce((sum, p) => sum + p.areaIn2 * p.centerXIn, 0) / totalAreaIn2;
  const totalIIn4 = parts.reduce((sum, p) => sum + p.ownIIn4 + p.areaIn2 * (p.centerXIn - centroidXIn) ** 2, 0);
  const rIn = Math.sqrt(totalIIn4 / totalAreaIn2);
  return { totalAreaIn2, effectiveWeakAxisDimIn: rIn * Math.sqrt(12) };
}

/**
 * Estimated axial bearing capacity for a Column/Corner panel's full
 * built-up section (see computeBuiltUpColumnSection) — unbraced length is
 * the full stud span, not the 36in blocking spacing the plain stud pack
 * uses, since the continuous full-height plywood cladding (not
 * intermittent blocking) is what braces this section against buckling.
 */
export function computeBuiltUpColumnBearingCapacityLb(members: PanelMember[], studSpanIn: number): number {
  const section = computeBuiltUpColumnSection(members);
  if (section.totalAreaIn2 === 0) return 0;
  return computeNdsColumnCapacityLb(studSpanIn, section.effectiveWeakAxisDimIn, section.totalAreaIn2);
}

/**
 * Estimated shear (racking) capacity contributed by a Braced Panel's
 * diagonal brace member(s) (Tommy: estimate shear "specifically based off
 * of diagonal brace and girt web construction... only need to calculate
 * stuff for the outside wyth"). Each brace is modeled as a pin-ended axial
 * strut: its own NDS column-buckling capacity (unbraced over its full
 * length, buckling about its 1.5in out-of-plane dimension — nothing
 * braces it against bowing out of the wall's plane along its run), then
 * resolved to the horizontal (racking-resisting) component via its tilt
 * angle from vertical (`tiltDeg`) — a brace standing more upright
 * contributes less shear resistance, one lying flatter contributes more:
 * horizontalComponent = axialCapacity x sin(|tiltDeg|).
 *
 * Takes the panel's actual brace member(s) (role "brace") directly,
 * rather than re-deriving geometry, so it automatically tracks whatever
 * `buildDiagonalBraces` currently produces.
 */
export function computeBracedPanelShearCapacityLb(members: PanelMember[]): number {
  return members
    .filter((m) => m.role === "brace")
    .reduce((sum, brace) => {
      const lengthIn = brace.actualDimsIn.lengthIn;
      const weakAxisDimIn = brace.actualDimsIn.thicknessIn;
      const areaIn2 = brace.actualDimsIn.thicknessIn * brace.actualDimsIn.widthIn;
      const axialCapacityLb = computeNdsColumnCapacityLb(lengthIn, weakAxisDimIn, areaIn2);
      const tiltRad = ((brace.position.tiltDeg ?? 0) * Math.PI) / 180;
      return sum + axialCapacityLb * Math.sin(Math.abs(tiltRad));
    }, 0);
}
