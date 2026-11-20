import type { DerivationInput } from "./shearDerivation";

/**
 * **WHAT ONE SCREW CAN HOLD — phase 2's missing number, found and cited.**
 *
 * > *"can you find a number? surely on the internet somewhere this is
 * > referenced and you can cross reference that to some other stuff. anything
 * > this app produces is an estimate because im not really sure how to make it
 * > official or have the liability for it."*
 * > — Tommy, 2026-11-19
 *
 * The Reference Points page's whole finding was that the app quotes eight
 * fastener spacings and checks none of them against a load. The reason phase 2
 * could not start was that nothing in the app knew what a single GRK
 * 5/16"x4" structural screw is good for laterally. It does now.
 *
 * **THE NUMBER IS PUBLISHED, AND BY THE BEST SOURCE THERE IS FOR IT.** Not a
 * blog, not a retailer listing, not a forum: ICC-ES **ESR-2442**, the
 * evaluation report for GRK's RSS line, which is the document a plans examiner
 * would ask for. Table 3 gives reference lateral design values (Z) for single
 * shear wood-to-wood connections, by screw size, side member thickness,
 * penetration and specific gravity. Table 1 gives the allowable shear of the
 * screw's own steel. Section 4.1.5 says which one governs.
 *
 * ⚠ **AND IT IS CROSS-REFERENCED, BECAUSE HE ASKED FOR THAT.** The report's
 * Table 3 values are *test-based* — its own Section 4.1.4 says testing
 * produced values "which exceed those determined in accordance with the NDS".
 * So `ndsYieldLimitZ` below recomputes the same connection from first
 * principles through the NDS yield-limit equations, using nothing from Table 3
 * — only Dr and Fyb from Table 1 and the NDS's own formulas. The two paths
 * agree in magnitude and the calculated one is lower, exactly as the report
 * says it should be. **That is the cross-reference: two independent routes to
 * the same order of magnitude, and the conservative one is available to an
 * engineer who declines to accept test-based values.**
 *
 * ⚠ **NOTHING HERE STATES THAT A CONNECTION PASSES.** Same refusal the Shear
 * Derivation sheet and the Reference Points page carry, and for the same
 * reason — *"no there has definetely not been any engioneer that has looked at
 * this. this app shouldnt be that"*. A capacity is half of a check. The other
 * half is demand, and this app still has no demand figures. What this module
 * produces is a capacity an engineer can check, beside the geometry it was
 * computed for.
 *
 * ⚠ **THE REPORT EXCLUDES THE USE THIS APP IS HEADED FOR, IN ONE PLACE AND NOT
 * THE OTHER, AND THE DIFFERENCE MATTERS.** ESR-2442 §4.3 permits an RSS screw
 * to substitute one-for-one for a code-prescribed nail — and then says: *"Use
 * of the GRK screws as substitutes for nails used in lateral-force resisting
 * assemblies (diaphragms, shear walls and braced walls) is outside the scope
 * of this report."* That bars the **prescriptive shortcut** ("one 5/16 RSS = one
 * 20d common nail, so the braced-wall line is satisfied"). It does **not** bar
 * the **engineered** path: §4.1's Tables 1–3 are design values an engineer may
 * use for any connection they are competent to design, lateral-force-resisting
 * or not. Phase 4 must take the engineered route and say so, and must never
 * cite Table 4 for a braced wall. See `FASTENER_CAPACITY_SCOPE_LIMIT`.
 */

/** The report, so every figure below can point at it. */
export const ESR_2442 = {
  id: "ICC-ES ESR-2442",
  subject: "GRK Fasteners RSS Rugged Structural Screws (a division of Illinois Tool Works)",
  /** ⚠ Read from the CURRENT report, not the copy GRK hosts, which is the
   *  October 2023 reissue whose renewal date (October 2025) has passed. */
  reissued: "October 2025",
  revised: "March 2026",
  renewalDue: "October 2027",
  codeEditions: "2024, 2021, 2018, 2015 and 2012 IBC and IRC",
  url: "https://icc-es.org/wp-content/uploads/report-directory/ESR-2442.pdf",
} as const;

/**
 * ⚠ **The scope limit, in the report's own words.** Printed wherever a
 * capacity from this module is shown, because a reader who takes Table 4's
 * nail substitution as cover for a braced wall has misread the report in the
 * one way it explicitly warns against.
 */
export const FASTENER_CAPACITY_SCOPE_LIMIT =
  'ESR-2442 §4.3: "Use of the GRK screws as substitutes for nails used in lateral-force resisting assemblies ' +
  '(diaphragms, shear walls and braced walls) is outside the scope of this report." That excludes the ' +
  "PRESCRIPTIVE nail-substitution shortcut, not the engineered design path — Tables 1 and 3 remain design " +
  "values an engineer may use. Anything this app says about bracing must take the engineered route.";

/**
 * ESR-2442 Table 1, the 5/16" RSS row. One screw's own properties.
 *
 * ⚠ **`overallLengthIn` is 3.875, not 4.** The report measures length from
 * under the head to the tip, and lists the fastener designated `5/16 x 4"` at
 * 3 7/8". Every penetration sum below uses the real length; calling it 4in
 * would overstate the penetration available behind a 1.5in member by 1/8in.
 */
export const GRK_5_16_RSS = {
  designation: '5/16" x 4" RSS',
  overallLengthIn: 3.875,
  threadLengthIn: 2.5,
  /** Dr — the diameter the NDS lateral calculation must use (§4.1.3(2)). */
  minorThreadDiameterIn: 0.157,
  /** Ds. */
  shankDiameterIn: 0.195,
  /** D — outside thread diameter, the one Table 5's spacing multiples use. */
  outsideThreadDiameterIn: 0.276,
  /** Fyb, ASTM F1575, measured on the minor thread diameter. */
  bendingYieldStrengthPsi: 171_800,
  allowableSteelTensionLb: 1274,
  /** ⚠ The ceiling on any lateral capacity, per §4.1.5. Not multiplied by CD. */
  allowableSteelShearLb: 884,
} as const;

/** NDS Table 2.3.2 load duration factors, for the two cases that come up here. */
export const CD_NORMAL = 1.0;
export const CD_WIND_SEISMIC = 1.6;

/**
 * Spruce-Pine-Fir's specific gravity, NDS Supplement Table 12.3.3A.
 *
 * ⚠ Carries the same caveat as `SPF_NO2_FC_PSI` and `SPF_NO2_EMIN_PSI`: a
 * commonly-published figure for the species group, not confirmed against the
 * Supplement edition for the lumber actually bought. It matters more here than
 * it does for a column, because G drives dowel bearing strength at the 1.84
 * power and it sits one hundredth below the 0.43 that would move the whole
 * connection into Table 3's next band.
 */
export const SPF_SPECIFIC_GRAVITY = 0.42;

/** One row of ESR-2442 Table 3, for the 5/16" RSS. */
export interface EsrLateralRow {
  /** Which fastener length the row is for — the report's "minimum overall length". */
  screwOverallLengthIn: number;
  sideMemberThicknessIn: number;
  minPenetrationIn: number;
  /** Inclusive. */
  gravityMin: number;
  /** Exclusive. */
  gravityMaxExclusive: number;
  parallelLb: number;
  perpendicularLb: number;
}

/**
 * ESR-2442 Table 3, every 5/16" RSS row, transcribed.
 *
 * ⚠ **All three lengths are here although the app only buys the 4in.** A
 * lookup that holds one row cannot refuse honestly: asked about a 2 1/2in
 * screw it would either answer with the 4in row's number or throw. With all
 * three present, `esrLateralDesignValue` can say which row it used, and say
 * "no row applies" when none does — which is the answer for the brace end.
 *
 * ⚠ **Table 3's values are TEST-BASED (§4.1.4), which is why the parallel and
 * perpendicular columns differ.** A calculated small-dowel Z does not depend
 * on grain direction at all — see `ndsYieldLimitZ`.
 */
export const ESR_2442_TABLE_3_GRK_5_16: readonly EsrLateralRow[] = [
  // 5/16 x 2 1/2", 3/4in side member, 1 3/4in penetration
  { screwOverallLengthIn: 2.5, sideMemberThicknessIn: 0.75, minPenetrationIn: 1.75, gravityMin: 0.42, gravityMaxExclusive: 0.5, parallelLb: 168, perpendicularLb: 133 },
  { screwOverallLengthIn: 2.5, sideMemberThicknessIn: 0.75, minPenetrationIn: 1.75, gravityMin: 0.5, gravityMaxExclusive: 0.55, parallelLb: 168, perpendicularLb: 133 },
  { screwOverallLengthIn: 2.5, sideMemberThicknessIn: 0.75, minPenetrationIn: 1.75, gravityMin: 0.55, gravityMaxExclusive: 0.67, parallelLb: 214, perpendicularLb: 178 },
  // 5/16 x 4", 1 1/2in side member, 2 3/8in penetration — the app's screw
  { screwOverallLengthIn: 4, sideMemberThicknessIn: 1.5, minPenetrationIn: 2.375, gravityMin: 0.42, gravityMaxExclusive: 0.5, parallelLb: 239, perpendicularLb: 236 },
  { screwOverallLengthIn: 4, sideMemberThicknessIn: 1.5, minPenetrationIn: 2.375, gravityMin: 0.5, gravityMaxExclusive: 0.55, parallelLb: 333, perpendicularLb: 236 },
  { screwOverallLengthIn: 4, sideMemberThicknessIn: 1.5, minPenetrationIn: 2.375, gravityMin: 0.55, gravityMaxExclusive: 0.67, parallelLb: 333, perpendicularLb: 257 },
  // 5/16 x 6", 2in side member, 3 7/8in penetration
  { screwOverallLengthIn: 6, sideMemberThicknessIn: 2, minPenetrationIn: 3.875, gravityMin: 0.42, gravityMaxExclusive: 0.5, parallelLb: 265, perpendicularLb: 289 },
  { screwOverallLengthIn: 6, sideMemberThicknessIn: 2, minPenetrationIn: 3.875, gravityMin: 0.5, gravityMaxExclusive: 0.55, parallelLb: 472, perpendicularLb: 289 },
  { screwOverallLengthIn: 6, sideMemberThicknessIn: 2, minPenetrationIn: 3.875, gravityMin: 0.55, gravityMaxExclusive: 0.67, parallelLb: 472, perpendicularLb: 289 },
];

export interface ConnectionGeometry {
  /** The report's "minimum overall length" bucket: 2.5, 4 or 6. */
  screwOverallLengthIn: number;
  /** The member the screw passes THROUGH. */
  sideMemberThicknessIn: number;
  /** How deep it actually lands in the member behind — the app's geometry, not the report's minimum. */
  penetrationIn: number;
  specificGravity: number;
}

export type EsrLateralLookup =
  | {
      applies: true;
      row: EsrLateralRow;
      /** The lesser of the row's two directions. See `why`. */
      zLb: number;
      parallelLb: number;
      perpendicularLb: number;
      why: string;
    }
  | { applies: false; zLb: null; why: string };

/**
 * The Table 3 value for a real connection, or an honest refusal.
 *
 * ⚠ **`zLb` is the LESSER of the parallel and perpendicular columns.** The app
 * does not model which way the grain of a main member runs relative to the
 * force crossing it, and a brace arrives at an angle to both. Taking the
 * smaller column is the only choice that cannot overstate; taking the larger
 * would be picking the favourable reading of a table on behalf of an engineer
 * who has not looked at the drawing.
 *
 * ⚠ **IT REFUSES RATHER THAN EXTRAPOLATING.** Table 3 is a table of tested
 * configurations, not a curve. A connection with less penetration than the row
 * requires is not "the row, slightly reduced" — it is outside the test, and
 * `ndsYieldLimitZ` is the route for it.
 */
export function esrLateralDesignValue(geom: ConnectionGeometry): EsrLateralLookup {
  const lengthRows = ESR_2442_TABLE_3_GRK_5_16.filter(
    (r) => r.screwOverallLengthIn === geom.screwOverallLengthIn,
  );
  if (lengthRows.length === 0) {
    return {
      applies: false,
      zLb: null,
      why: `ESR-2442 Table 3 has no 5/16" RSS row for a ${geom.screwOverallLengthIn}in screw. Tabulated lengths are 2 1/2in, 4in and 6in.`,
    };
  }
  const row = lengthRows.find(
    (r) => geom.specificGravity >= r.gravityMin && geom.specificGravity < r.gravityMaxExclusive,
  );
  if (row === undefined) {
    return {
      applies: false,
      zLb: null,
      why: `Specific gravity ${geom.specificGravity} is outside Table 3's range (0.42 to 0.67). No tabulated value applies.`,
    };
  }
  if (geom.sideMemberThicknessIn < row.sideMemberThicknessIn) {
    return {
      applies: false,
      zLb: null,
      why: `The Table 3 row for this screw is tested with a ${row.sideMemberThicknessIn}in side member; this connection passes through ${geom.sideMemberThicknessIn}in. Thinner than tested, so the tabulated value does not apply.`,
    };
  }
  if (geom.penetrationIn < row.minPenetrationIn) {
    return {
      applies: false,
      zLb: null,
      why: `⚠ The Table 3 row for this screw requires ${row.minPenetrationIn}in of penetration into the main member; this connection has ${geom.penetrationIn}in. The tabulated ${Math.min(row.parallelLb, row.perpendicularLb)}–${Math.max(row.parallelLb, row.perpendicularLb)} lbf does NOT apply, and Table 3 cannot be interpolated downward — it is a table of tested configurations, not a curve.`,
    };
  }
  const zLb = Math.min(row.parallelLb, row.perpendicularLb);
  return {
    applies: true,
    row,
    zLb,
    parallelLb: row.parallelLb,
    perpendicularLb: row.perpendicularLb,
    why: `ESR-2442 Table 3: ${row.screwOverallLengthIn}in screw, ${row.sideMemberThicknessIn}in side member, ${row.minPenetrationIn}in minimum penetration, specific gravity ${row.gravityMin}–${row.gravityMaxExclusive}. Parallel to grain ${row.parallelLb} lbf, perpendicular ${row.perpendicularLb} lbf; the lesser is used because the app does not model which way the grain runs relative to the force.`,
  };
}

/** NDS Table 12.3.3: dowel bearing strength for a dowel under 1/4in diameter. */
export function dowelBearingStrengthPsi(specificGravity: number): number {
  return 16_600 * specificGravity ** 1.84;
}

/** NDS Table 12.3.1B reduction term, for a dowel under 1/4in diameter. */
export function reductionTermRd(diameterIn: number): number {
  if (diameterIn >= 0.25) {
    throw new Error(
      `reductionTermRd is the small-dowel branch of NDS Table 12.3.1B (D < 0.25in); got ${diameterIn}in. A larger dowel uses the Kθ branch and this module has no business guessing it.`,
    );
  }
  return diameterIn <= 0.17 ? 2.2 : 10 * diameterIn + 0.5;
}

export interface YieldMode {
  /** The NDS's own name: Im, Is, II, IIIm, IIIs, IV. */
  mode: string;
  zLb: number;
  /** What physically happens in this mode, in a clause. */
  meaning: string;
}

export interface NdsYieldLimitResult {
  modes: YieldMode[];
  governing: YieldMode;
  zLb: number;
  /** Every intermediate, so the sheet can show its work the way B18 does. */
  dowelBearingStrengthPsi: number;
  /** lm — penetration less the tapered tip, per §4.1.3(5) and NDS 12.3.5.3. */
  dowelBearingLengthIn: number;
  tipLengthIn: number;
  reductionTermRd: number;
  reRatio: number;
  rtRatio: number;
}

/**
 * **THE CROSS-REFERENCE: Z from the NDS yield-limit equations, using nothing
 * from Table 3.**
 *
 * NDS 12.3.1's six single-shear modes, with Dr and Fyb from ESR-2442 Table 1
 * as §4.1.3(1)–(2) require, the tapered tip taken as 2·Dr per §4.1.3(5), and
 * dowel bearing strength from NDS Table 12.3.3. It answers for any geometry,
 * including the ones Table 3 refuses, which is what makes it the useful half
 * for this app.
 *
 * ⚠ **IT RETURNS ONE Z FOR BOTH GRAIN DIRECTIONS, AND THAT IS CORRECT.** For a
 * dowel under 1/4in the NDS uses a single dowel bearing strength regardless of
 * grain orientation, so a calculated small-screw Z has no parallel/
 * perpendicular split. Table 3's split exists because those numbers came from
 * tests, not from these equations.
 *
 * ⚠ **IT IS THE FLOOR, NOT THE ANSWER.** ESR-2442 §4.1.4 says the tested values
 * "exceed those determined in accordance with the NDS", so this routine should
 * come out BELOW Table 3 wherever both apply — and the tests assert exactly
 * that, in both directions, so a sign error in these equations cannot pass.
 */
export function ndsYieldLimitZ(args: {
  minorThreadDiameterIn: number;
  bendingYieldStrengthPsi: number;
  sideMemberThicknessIn: number;
  penetrationIn: number;
  specificGravity: number;
}): NdsYieldLimitResult {
  const d = args.minorThreadDiameterIn;
  const fyb = args.bendingYieldStrengthPsi;
  const ts = args.sideMemberThicknessIn;
  const tipLengthIn = 2 * d;
  const lm = args.penetrationIn - tipLengthIn;
  if (lm <= 0) {
    throw new Error(
      `Penetration ${args.penetrationIn}in is not more than the tapered tip length ${tipLengthIn.toFixed(3)}in, so there is no dowel bearing length to compute a yield limit over. The caller must treat this as "no capacity", not as a number.`,
    );
  }
  /* Both members are the same species here: this app frames in one species and
     the Table 3 rows it is checked against are themselves "both wood members
     having the same specific gravity" (Table 3 footnote 4). */
  const fem = dowelBearingStrengthPsi(args.specificGravity);
  const fes = fem;
  const re = fem / fes;
  const rt = lm / ts;
  const rd = reductionTermRd(d);

  const k1 =
    (Math.sqrt(re + 2 * re ** 2 * (1 + rt + rt ** 2) + rt ** 2 * re ** 3) - re * (1 + rt)) / (1 + re);
  const k2 = -1 + Math.sqrt(2 * (1 + re) + (2 * fyb * (1 + 2 * re) * d ** 2) / (3 * fem * lm ** 2));
  const k3 = -1 + Math.sqrt((2 * (1 + re)) / re + (2 * fyb * (2 + re) * d ** 2) / (3 * fem * ts ** 2));

  const modes: YieldMode[] = [
    { mode: "Im", zLb: (d * lm * fem) / rd, meaning: "the main member crushes under the whole dowel" },
    { mode: "Is", zLb: (d * ts * fes) / rd, meaning: "the side member crushes under the whole dowel" },
    { mode: "II", zLb: (k1 * d * ts * fes) / rd, meaning: "the dowel rotates, both members crush at one end" },
    { mode: "IIIm", zLb: (k2 * d * lm * fem) / ((1 + 2 * re) * rd), meaning: "one hinge in the dowel, the main member crushing" },
    { mode: "IIIs", zLb: (k3 * d * ts * fem) / ((2 + re) * rd), meaning: "one hinge in the dowel, the side member crushing" },
    { mode: "IV", zLb: (d ** 2 / rd) * Math.sqrt((2 * fem * fyb) / (3 * (1 + re))), meaning: "two hinges — the screw itself bends, which is what governs a thin screw in sound wood" },
  ];
  const governing = modes.reduce((lowest, m) => (m.zLb < lowest.zLb ? m : lowest));
  return {
    modes,
    governing,
    zLb: governing.zLb,
    dowelBearingStrengthPsi: fem,
    dowelBearingLengthIn: lm,
    tipLengthIn,
    reductionTermRd: rd,
    reRatio: re,
    rtRatio: rt,
  };
}

export interface LateralCapacity {
  /** The reference value before adjustment, and which route produced it. */
  referenceZLb: number;
  route: "ESR-2442 Table 3 (tested)" | "NDS 12.3 yield limit (calculated)";
  loadDurationFactor: number;
  /** Z x CD. */
  adjustedZLb: number;
  /** ⚠ The answer: the lesser of adjusted Z and the screw's own steel shear. */
  allowableLb: number;
  /** True when the steel, not the wood, is the limit. Expected to be false. */
  steelGoverns: boolean;
  why: string;
}

/**
 * ESR-2442 §4.1.5: *"The allowable lateral load for a single-screw connection
 * is the lesser of: (a) the allowable screw shear strength given in Table 1;
 * and (b) the reference lateral design value ... adjusted by all applicable
 * adjustment factors."*
 *
 * ⚠ **CD multiplies (b) and NOT (a).** A load duration factor is a wood
 * property — it exists because wood carries more for a shorter time. Steel does
 * not care how long the wind blows, so 884 lbf is a flat ceiling. Applying 1.6
 * to it would inflate the cap by 414 lbf at exactly the moment (wind, seismic)
 * when a reader is most likely to be relying on it.
 */
export function allowableLateralLoadLb(
  referenceZLb: number,
  route: LateralCapacity["route"],
  loadDurationFactor: number,
): LateralCapacity {
  const adjustedZLb = referenceZLb * loadDurationFactor;
  const steelGoverns = GRK_5_16_RSS.allowableSteelShearLb < adjustedZLb;
  return {
    referenceZLb,
    route,
    loadDurationFactor,
    adjustedZLb,
    allowableLb: Math.min(GRK_5_16_RSS.allowableSteelShearLb, adjustedZLb),
    steelGoverns,
    why: steelGoverns
      ? `The screw's own steel governs: ESR-2442 Table 1 allows ${GRK_5_16_RSS.allowableSteelShearLb} lbf in shear, below the adjusted wood value of ${Math.round(adjustedZLb)} lbf. CD is not applied to the steel.`
      : `The wood governs: ${Math.round(referenceZLb)} lbf x CD ${loadDurationFactor} = ${Math.round(adjustedZLb)} lbf, below the screw's ${GRK_5_16_RSS.allowableSteelShearLb} lbf steel shear allowance.`,
  };
}

/**
 * ⚠ **THE BRACE END, WHICH IS WHERE THIS LANDS HARDEST.**
 *
 * Tommy, 2026-10-25: *"Each end of each 2x4 on the diagonals has 2 5/16in GRKs
 * 4in screws predrilled and driven."* The Shear Derivation sheet already
 * derives what a brace can carry along its own axis as a pin-ended strut. It
 * has never derived whether two screws can deliver that force into the frame,
 * and the brace row on the Reference Points page says so in those words. This
 * puts a number beside it.
 *
 * ⚠ **THE PENETRATION IS THE PART TO ARGUE WITH.** A brace lies flat and bears
 * on a 1 1/2in member — a 2x4 plate at one end, a Blocking girt at the other —
 * behind which sits 3/4in of plywood skin. That is 2 1/4in of material, 1/8in
 * SHORT of the 2 3/8in ESR-2442 Table 3 requires for this screw, and the last
 * 3/4in of it is plywood rather than the sawn lumber the row was tested in. So
 * Table 3 refuses (see `esrLateralDesignValue`) and the penetration taken here
 * is the 1 1/2in of solid 2x4, through the calculated route. If the real
 * detail has a doubled plate, or the screws rake into a stud, the number goes
 * up — which is exactly the question to put to an engineer.
 */
export const BRACE_END_SCREWS = 2;

export interface BraceEndConnectionComparison {
  screwsPerEnd: number;
  /** The solid sawn thickness the screw lands in. An app assumption, named. */
  penetrationIn: number;
  perScrewLb: number;
  perEndLb: number;
  /** From the Shear Derivation sheet: what the strut itself can carry. */
  braceAxialCapacityLb: number;
  /** perEndLb / braceAxialCapacityLb. Under 1 means the screws are the smaller number. */
  ratio: number;
  governingMode: string;
  statement: string;
  /** ⚠ Never a verdict. What a reader must go and do with these two numbers. */
  caveat: string;
}

/**
 * The two numbers side by side. **Not a check, and never a verdict.**
 *
 * ⚠ **IT DOES NOT SAY "FAILS", AND MUST NOT BE MADE TO.** Both numbers are
 * capacities; neither is a demand. A connection weaker than the member it
 * connects is an ordinary and often deliberate condition — what it means here
 * is that the Shear Derivation sheet's panel capacity is reported off the
 * strut while the smaller number sits at its ends, and an engineer should be
 * told that rather than left to find it.
 */
export function braceEndConnectionComparison(args: {
  braceAxialCapacityLb: number;
  penetrationIn: number;
  specificGravity?: number;
}): BraceEndConnectionComparison {
  const g = args.specificGravity ?? SPF_SPECIFIC_GRAVITY;
  const yieldLimit = ndsYieldLimitZ({
    minorThreadDiameterIn: GRK_5_16_RSS.minorThreadDiameterIn,
    bendingYieldStrengthPsi: GRK_5_16_RSS.bendingYieldStrengthPsi,
    /* The brace is the side member: a 2x4 lying flat. */
    sideMemberThicknessIn: 1.5,
    penetrationIn: args.penetrationIn,
    specificGravity: g,
  });
  /* CD_NORMAL, to match the Shear Derivation sheet, which takes CD as 1.0 and
     says so. Comparing a CD 1.6 connection against a CD 1.0 strut would
     flatter the connection by 60% for no reason other than mismatched units. */
  const perScrew = allowableLateralLoadLb(
    yieldLimit.zLb,
    "NDS 12.3 yield limit (calculated)",
    CD_NORMAL,
  ).allowableLb;
  const perEndLb = perScrew * BRACE_END_SCREWS;
  return {
    screwsPerEnd: BRACE_END_SCREWS,
    penetrationIn: args.penetrationIn,
    perScrewLb: perScrew,
    perEndLb,
    braceAxialCapacityLb: args.braceAxialCapacityLb,
    ratio: args.braceAxialCapacityLb === 0 ? 0 : perEndLb / args.braceAxialCapacityLb,
    governingMode: yieldLimit.governing.mode,
    statement:
      `Two ${GRK_5_16_RSS.designation} screws at ${Math.round(perScrew)} lbf each give ${Math.round(perEndLb)} lbf at a brace end ` +
      `(NDS yield mode ${yieldLimit.governing.mode} — ${yieldLimit.governing.meaning}), against ${Math.round(args.braceAxialCapacityLb)} lbf of axial capacity in the strut itself. ` +
      `⚠ ESR-2442 Table 3's tested ${236} lbf per screw does NOT apply here: it needs 2 3/8in of penetration and a brace bears on a 1 1/2in member.`,
    caveat:
      "⚠ Both of these are CAPACITIES, and neither is a demand — this is not a check and says nothing about whether the brace passes. " +
      "What it does say is that the panel capacity on the Shear Derivation sheet is reported off the strut, while the smaller number sits at its two ends. " +
      "The penetration is an app assumption (the solid 2x4 the brace bears on); a doubled plate or a raked screw would change it.",
  };
}

/**
 * Where every figure in this module came from, for the page to print.
 *
 * ⚠ **EVERY ESR FIGURE IS `pending-BI-confirmation`, AND THAT IS NOT A HEDGE
 * ABOUT THE SOURCE.** `DerivationStatus` defines that tag as *"a published
 * figure, cited, that Building Integrity has not yet confirmed against its own
 * engineering"* — which is precisely what these are. They are as well-sourced
 * as a number in this app gets; what they have not had is Building Integrity
 * agreeing that this connection is the one the report describes. Nothing here
 * needed a new tag.
 */
export function fastenerCapacityInputs(): DerivationInput[] {
  return [
    {
      label: "Allowable steel shear, one 5/16in RSS",
      value: GRK_5_16_RSS.allowableSteelShearLb,
      unit: "lbf",
      status: "pending-BI-confirmation",
      note: `${ESR_2442.id} Table 1, ${ESR_2442.revised} revision. A flat ceiling on lateral capacity per §4.1.5, never multiplied by CD.`,
    },
    {
      label: "Dr — minor thread diameter",
      value: GRK_5_16_RSS.minorThreadDiameterIn,
      unit: "in",
      status: "pending-BI-confirmation",
      note: `${ESR_2442.id} Table 1. §4.1.3(2) requires the MINOR thread diameter for the lateral calculation, not the 5/16in nominal — using 0.3125in instead would roughly quadruple mode IV.`,
    },
    {
      label: "Fyb — specified bending yield strength",
      value: GRK_5_16_RSS.bendingYieldStrengthPsi,
      unit: "psi",
      status: "pending-BI-confirmation",
      note: `${ESR_2442.id} Table 1, per ASTM F1575 measured on the minor thread diameter.`,
    },
    {
      label: "G — specific gravity, Spruce-Pine-Fir",
      value: SPF_SPECIFIC_GRAVITY,
      unit: "",
      status: "pending-BI-confirmation",
      note: "NDS Supplement Table 12.3.3A, species group figure. ⚠ Confirm for the lumber actually bought: dowel bearing strength goes as G^1.84, and 0.43 would move this connection into the next Table 3 band.",
    },
    {
      label: "Fe = 16,600 x G^1.84 — dowel bearing strength",
      value: Math.round(dowelBearingStrengthPsi(SPF_SPECIFIC_GRAVITY)),
      unit: "psi",
      status: "code-constant",
      note: "NDS Table 12.3.3 for a dowel under 1/4in. One value for both grain directions, which is why the calculated route has no parallel/perpendicular split.",
    },
    {
      label: "Rd — reduction term",
      value: reductionTermRd(GRK_5_16_RSS.minorThreadDiameterIn),
      unit: "",
      status: "code-constant",
      note: "NDS Table 12.3.1B: 2.2 for a dowel at or under 0.17in. Not a choice.",
    },
    {
      label: "E — tapered tip length",
      value: 2 * GRK_5_16_RSS.minorThreadDiameterIn,
      unit: "in",
      status: "code-constant",
      note: `${ESR_2442.id} §4.1.3(5): take E as 2 x Dr, and subtract it from penetration to get the dowel bearing length (NDS 12.3.5.3).`,
    },
    {
      label: "CD — load duration, wind and seismic",
      value: CD_WIND_SEISMIC,
      unit: "",
      status: "code-constant",
      note: "NDS Table 2.3.2. Applies to the wood value only. CM, Ct, Cg, CΔ and Ceg are all taken as 1.0 — dry service, standard temperature, a single-fastener check, and spacings far above Table 5's minimums.",
    },
    {
      label: "Both members the same species",
      value: 1,
      unit: "Re",
      status: "app-assumption",
      note: "Fem = Fes, so Re = 1. True of the app's framing, and the condition Table 3 footnote 4 is itself written under.",
    },
  ];
}
