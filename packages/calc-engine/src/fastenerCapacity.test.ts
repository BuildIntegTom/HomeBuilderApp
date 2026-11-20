import { describe, expect, it } from "vitest";

import { DERIVATION_STATUS_MEANINGS } from "./derivationStatus";
import {
  CD_NORMAL,
  CD_WIND_SEISMIC,
  ESR_2442,
  ESR_2442_TABLE_3_GRK_5_16,
  FASTENER_CAPACITY_SCOPE_LIMIT,
  GRK_5_16_RSS,
  SPF_SPECIFIC_GRAVITY,
  allowableLateralLoadLb,
  dowelBearingStrengthPsi,
  esrLateralDesignValue,
  fastenerCapacityInputs,
  ndsYieldLimitZ,
  reductionTermRd,
} from "./fastenerCapacity";

/** The connection ESR-2442 Table 3 actually tested for this screw. */
const TABLE_3_GEOMETRY = {
  screwOverallLengthIn: 4,
  sideMemberThicknessIn: 1.5,
  penetrationIn: 2.375,
};

describe("ESR-2442, the report itself", () => {
  it("cites the CURRENT report, not the lapsed copy the manufacturer hosts", () => {
    /* ⚠ GRK's own site serves the October 2023 reissue, whose renewal date
       (October 2025) has passed. The figures match, but a citation to a
       superseded report is the first thing a plans examiner would reject. */
    expect(ESR_2442.reissued).toBe("October 2025");
    expect(ESR_2442.revised).toBe("March 2026");
    expect(ESR_2442.renewalDue).toBe("October 2027");
    expect(ESR_2442.url).toContain("icc-es.org");
  });

  it("carries the scope limit that bars the prescriptive route for bracing", () => {
    /* ⚠ This string is the whole reason phase 4 cannot cite Table 4. If it
       ever stops naming all three assembly types, the warning has been
       softened and the page would be quietly misleading. */
    expect(FASTENER_CAPACITY_SCOPE_LIMIT).toContain("diaphragms, shear walls and braced walls");
    expect(FASTENER_CAPACITY_SCOPE_LIMIT).toContain("outside the scope");
    expect(FASTENER_CAPACITY_SCOPE_LIMIT).toContain("engineered");
  });

  it('calls the "5/16 x 4" screw 3.875in long, because that is what it is', () => {
    /* The report measures under-head to tip. Calling it 4in would overstate
       penetration behind a 1.5in member by 1/8in. */
    expect(GRK_5_16_RSS.overallLengthIn).toBe(3.875);
  });

  it("transcribes three lengths x three specific-gravity bands", () => {
    expect(ESR_2442_TABLE_3_GRK_5_16).toHaveLength(9);
    expect(new Set(ESR_2442_TABLE_3_GRK_5_16.map((r) => r.screwOverallLengthIn))).toEqual(
      new Set([2.5, 4, 6]),
    );
    /* The bands must tile 0.42-0.67 with no gap and no overlap, or a lookup
       could silently fall through for a real species. */
    for (const length of [2.5, 4, 6]) {
      const bands = ESR_2442_TABLE_3_GRK_5_16.filter((r) => r.screwOverallLengthIn === length).sort(
        (a, b) => a.gravityMin - b.gravityMin,
      );
      expect(bands.map((b) => [b.gravityMin, b.gravityMaxExclusive])).toEqual([
        [0.42, 0.5],
        [0.5, 0.55],
        [0.55, 0.67],
      ]);
    }
  });
});

describe("esrLateralDesignValue", () => {
  it("returns Table 3's tested value for the geometry Table 3 tested", () => {
    const got = esrLateralDesignValue({ ...TABLE_3_GEOMETRY, specificGravity: SPF_SPECIFIC_GRAVITY });
    expect(got.applies).toBe(true);
    if (!got.applies) return;
    expect(got.parallelLb).toBe(239);
    expect(got.perpendicularLb).toBe(236);
    /* ⚠ The LESSER. Picking 239 would be choosing the favourable column on
       behalf of an engineer who has not seen the drawing. */
    expect(got.zLb).toBe(236);
    expect(got.why).toContain("the lesser is used");
  });

  it("reads the higher band for a denser species", () => {
    const got = esrLateralDesignValue({ ...TABLE_3_GEOMETRY, specificGravity: 0.5 });
    expect(got.applies).toBe(true);
    if (!got.applies) return;
    expect(got.parallelLb).toBe(333);
    expect(got.perpendicularLb).toBe(236);
    expect(got.zLb).toBe(236);
  });

  it("⚠ REFUSES at the brace end, where only a 1.5in member is behind the screw", () => {
    /* A brace lies flat on a 2x4 plate or a Blocking girt: 1.5in through,
       1.5in into. Table 3's row for this screw needs 2 3/8in of penetration,
       so the 239/236 lbf a reader would reach for is NOT available. This is
       the finding, and it has to be a refusal rather than a reduced number. */
    const got = esrLateralDesignValue({
      screwOverallLengthIn: 4,
      sideMemberThicknessIn: 1.5,
      penetrationIn: 1.5,
      specificGravity: SPF_SPECIFIC_GRAVITY,
    });
    expect(got.applies).toBe(false);
    expect(got.zLb).toBeNull();
    expect(got.why).toContain("2.375in of penetration");
    expect(got.why).toContain("cannot be interpolated");
  });

  it("refuses a side member thinner than the row was tested with", () => {
    const got = esrLateralDesignValue({
      screwOverallLengthIn: 4,
      sideMemberThicknessIn: 0.75,
      penetrationIn: 3,
      specificGravity: SPF_SPECIFIC_GRAVITY,
    });
    expect(got.applies).toBe(false);
    expect(got.why).toContain("0.75in");
  });

  it("refuses a length and a specific gravity the table does not cover", () => {
    const length = esrLateralDesignValue({
      screwOverallLengthIn: 5.125,
      sideMemberThicknessIn: 1.5,
      penetrationIn: 3,
      specificGravity: 0.42,
    });
    expect(length.applies).toBe(false);
    expect(length.why).toContain("no 5/16");

    const gravity = esrLateralDesignValue({ ...TABLE_3_GEOMETRY, specificGravity: 0.3 });
    expect(gravity.applies).toBe(false);
    expect(gravity.why).toContain("0.42 to 0.67");
  });
});

describe("the NDS cross-reference", () => {
  it("computes dowel bearing strength as 16,600 G^1.84", () => {
    expect(dowelBearingStrengthPsi(0.42)).toBeCloseTo(3364, 0);
    expect(dowelBearingStrengthPsi(0.5)).toBeCloseTo(4637, 0);
  });

  it("uses Rd = 2.2 for this screw and refuses to guess for a large dowel", () => {
    expect(reductionTermRd(GRK_5_16_RSS.minorThreadDiameterIn)).toBe(2.2);
    expect(reductionTermRd(0.2)).toBeCloseTo(2.5, 10);
    expect(() => reductionTermRd(0.25)).toThrow(/small-dowel branch/);
  });

  it("⚠ comes out BELOW Table 3 in every band, exactly as §4.1.4 says it must", () => {
    /* ESR-2442 §4.1.4: testing produced values "which exceed those determined
       in accordance with the NDS". This is the cross-reference Tommy asked
       for, and it is also a sign check on the six yield equations: get one
       wrong in the generous direction and this inequality breaks. */
    for (const g of [0.42, 0.49, 0.5, 0.55]) {
      const calculated = ndsYieldLimitZ({
        minorThreadDiameterIn: GRK_5_16_RSS.minorThreadDiameterIn,
        bendingYieldStrengthPsi: GRK_5_16_RSS.bendingYieldStrengthPsi,
        sideMemberThicknessIn: TABLE_3_GEOMETRY.sideMemberThicknessIn,
        penetrationIn: TABLE_3_GEOMETRY.penetrationIn,
        specificGravity: g,
      });
      const tested = esrLateralDesignValue({ ...TABLE_3_GEOMETRY, specificGravity: g });
      expect(tested.applies).toBe(true);
      if (!tested.applies) return;
      expect(calculated.zLb).toBeLessThan(tested.zLb);
      /* ...but the same order of magnitude, which is what makes it a
         corroboration rather than two unrelated numbers. */
      expect(calculated.zLb).toBeGreaterThan(tested.zLb * 0.4);
    }
  });

  it("names mode IV — the screw bending — as the governing mode in sound wood", () => {
    const got = ndsYieldLimitZ({
      minorThreadDiameterIn: GRK_5_16_RSS.minorThreadDiameterIn,
      bendingYieldStrengthPsi: GRK_5_16_RSS.bendingYieldStrengthPsi,
      sideMemberThicknessIn: TABLE_3_GEOMETRY.sideMemberThicknessIn,
      penetrationIn: TABLE_3_GEOMETRY.penetrationIn,
      specificGravity: 0.5,
    });
    expect(got.governing.mode).toBe("IV");
    expect(got.zLb).toBe(Math.min(...got.modes.map((m) => m.zLb)));
    expect(got.modes).toHaveLength(6);
    /* Every mode explains itself — the page prints these beside the numbers. */
    for (const m of got.modes) expect(m.meaning.length).toBeGreaterThan(10);
  });

  it("subtracts the tapered tip, and refuses when nothing is left of it", () => {
    const got = ndsYieldLimitZ({
      minorThreadDiameterIn: GRK_5_16_RSS.minorThreadDiameterIn,
      bendingYieldStrengthPsi: GRK_5_16_RSS.bendingYieldStrengthPsi,
      sideMemberThicknessIn: 1.5,
      penetrationIn: 2.375,
      specificGravity: SPF_SPECIFIC_GRAVITY,
    });
    expect(got.tipLengthIn).toBeCloseTo(0.314, 10);
    expect(got.dowelBearingLengthIn).toBeCloseTo(2.061, 10);
    expect(() =>
      ndsYieldLimitZ({
        minorThreadDiameterIn: GRK_5_16_RSS.minorThreadDiameterIn,
        bendingYieldStrengthPsi: GRK_5_16_RSS.bendingYieldStrengthPsi,
        sideMemberThicknessIn: 1.5,
        penetrationIn: 0.3,
        specificGravity: SPF_SPECIFIC_GRAVITY,
      }),
    ).toThrow(/tapered tip/);
  });

  it("answers for the brace end, which is the geometry Table 3 refuses", () => {
    /* The point of keeping both routes: the calculated one still works where
       the tested one has no row. */
    const got = ndsYieldLimitZ({
      minorThreadDiameterIn: GRK_5_16_RSS.minorThreadDiameterIn,
      bendingYieldStrengthPsi: GRK_5_16_RSS.bendingYieldStrengthPsi,
      sideMemberThicknessIn: 1.5,
      penetrationIn: 1.5,
      specificGravity: SPF_SPECIFIC_GRAVITY,
    });
    /* ⚠ PINNED TO THE NUMBER, not just to "greater than zero". This geometry
       is the only one in the app where mode IIIm governs, so it is the only
       place a sign error in k2 shows up at all — everywhere else mode IV is
       lower and hides it. Cross-checked against an independent hand
       calculation of all six modes: Im 284.7, Is 360.1, II 135.1, IIIm 133.5,
       IIIs 151.6, IV 155.5 lbf. */
    expect(got.governing.mode).toBe("IIIm");
    expect(got.zLb).toBeCloseTo(133.47, 1);
    expect(got.modes.find((m) => m.mode === "IIIs")!.zLb).toBeCloseTo(151.55, 1);
    expect(got.modes.find((m) => m.mode === "IV")!.zLb).toBeCloseTo(155.51, 1);
    expect(got.zLb).toBeGreaterThan(0);
    /* Less penetration, less capacity — and by enough to matter. */
    const full = ndsYieldLimitZ({
      minorThreadDiameterIn: GRK_5_16_RSS.minorThreadDiameterIn,
      bendingYieldStrengthPsi: GRK_5_16_RSS.bendingYieldStrengthPsi,
      sideMemberThicknessIn: 1.5,
      penetrationIn: 2.375,
      specificGravity: SPF_SPECIFIC_GRAVITY,
    });
    expect(got.zLb).toBeLessThan(full.zLb);
  });
});

describe("allowableLateralLoadLb (ESR-2442 §4.1.5)", () => {
  it("lets the wood govern, and says so", () => {
    const normal = allowableLateralLoadLb(236, "ESR-2442 Table 3 (tested)", CD_NORMAL);
    expect(normal.allowableLb).toBe(236);
    expect(normal.steelGoverns).toBe(false);
    expect(normal.why).toContain("wood governs");
  });

  it("⚠ multiplies CD into the wood value and NOT into the steel ceiling", () => {
    const wind = allowableLateralLoadLb(236, "ESR-2442 Table 3 (tested)", CD_WIND_SEISMIC);
    expect(wind.adjustedZLb).toBeCloseTo(377.6, 6);
    expect(wind.allowableLb).toBeCloseTo(377.6, 6);
    /* A fictitious wood value above the steel shear must be CAPPED at 884,
       not at 884 x 1.6. Steel does not care how long the wind blows. */
    const capped = allowableLateralLoadLb(900, "NDS 12.3 yield limit (calculated)", CD_WIND_SEISMIC);
    expect(capped.allowableLb).toBe(GRK_5_16_RSS.allowableSteelShearLb);
    expect(capped.steelGoverns).toBe(true);
    expect(capped.why).toContain("CD is not applied to the steel");

    /* ⚠ THE BAND THAT CATCHES CD BEING APPLIED TO THE STEEL. At Z=600 and
       CD=1.6 the adjusted wood value is 960 lbf: above the 884 lbf ceiling, but
       BELOW 884 x 1.6. Only here do the right and wrong rules disagree about
       who governs — outside this band both report the same thing and the
       error is invisible. */
    const band = allowableLateralLoadLb(600, "NDS 12.3 yield limit (calculated)", CD_WIND_SEISMIC);
    expect(band.adjustedZLb).toBeCloseTo(960, 6);
    expect(band.steelGoverns).toBe(true);
    expect(band.why).toContain("steel governs");
    expect(band.allowableLb).toBe(GRK_5_16_RSS.allowableSteelShearLb);
  });
});

describe("fastenerCapacityInputs", () => {
  it("gives every figure a real provenance tag and a note", () => {
    const inputs = fastenerCapacityInputs();
    expect(inputs.length).toBeGreaterThan(5);
    for (const input of inputs) {
      expect(Object.keys(DERIVATION_STATUS_MEANINGS)).toContain(input.status);
      expect(input.note.length).toBeGreaterThan(20);
      expect(Number.isFinite(input.value)).toBe(true);
    }
  });

  it("⚠ claims nothing as `confirmed` — Building Integrity has signed off on none of it", () => {
    /* Every ESR figure is `pending-BI-confirmation` by the tag's own
       definition: published and cited, not yet checked against BI's own
       engineering. A `confirmed` appearing here would mean someone had
       mistaken a well-sourced number for an agreed one. */
    expect(fastenerCapacityInputs().some((i) => i.status === "confirmed")).toBe(false);
  });

  it("warns that G drives Fe at the 1.84 power", () => {
    const g = fastenerCapacityInputs().find((i) => i.label.startsWith("G —"));
    expect(g?.note).toContain("1.84");
    expect(g?.value).toBe(SPF_SPECIFIC_GRAVITY);
  });
});
