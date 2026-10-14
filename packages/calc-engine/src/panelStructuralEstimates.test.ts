import { describe, expect, it } from "vitest";
import { buildBracedPanelMembers, buildColumnPanelMembers } from "@building-integrity/panel-catalog";
import {
  SPF_NO2_EMIN_PSI,
  SPF_NO2_FC_PSI,
  computeBracedPanelShearCapacityLb,
  computeBuiltUpColumnBearingCapacityLb,
  computeBuiltUpColumnSection,
  computeNdsColumnCapacityLb,
  computeStudPackBearingCapacityLb,
} from "./panelStructuralEstimates";

describe("computeNdsColumnCapacityLb", () => {
  it("keeps the column stability factor (and so allowable stress) below the raw Fc value", () => {
    const capacityLb = computeNdsColumnCapacityLb(36, 1.5, 5.25);
    const rawCrushingCapacityLb = SPF_NO2_FC_PSI * 5.25;
    expect(capacityLb).toBeGreaterThan(0);
    expect(capacityLb).toBeLessThan(rawCrushingCapacityLb);
  });

  it("gives a longer unbraced length a lower capacity (more slender -> more buckling-limited)", () => {
    const shortLb = computeNdsColumnCapacityLb(36, 1.5, 5.25);
    const longLb = computeNdsColumnCapacityLb(96, 1.5, 5.25);
    expect(longLb).toBeLessThan(shortLb);
  });

  it("roughly reproduces a commonly-cited single-2x4 reference figure (~2010lb at 10ft, strong axis)", () => {
    // Cross-check only, not a locked-in exact figure — see module doc comment.
    const capacityLb = computeNdsColumnCapacityLb(120, 3.5, 5.25);
    expect(capacityLb).toBeGreaterThan(1000);
    expect(capacityLb).toBeLessThan(3000);
  });

  it("scales with Emin/Fc reference constants being finite, sane, positive values", () => {
    expect(SPF_NO2_FC_PSI).toBeGreaterThan(0);
    expect(SPF_NO2_EMIN_PSI).toBeGreaterThan(0);
  });
});

describe("computeStudPackBearingCapacityLb", () => {
  it("doubles the single-stud capacity for the default 2-stud pack", () => {
    const single = computeStudPackBearingCapacityLb(1);
    const pack = computeStudPackBearingCapacityLb();
    expect(pack).toBeCloseTo(single * 2, 6);
  });

  it("returns a positive, plausible order-of-magnitude bearing capacity", () => {
    const pack = computeStudPackBearingCapacityLb();
    expect(pack).toBeGreaterThan(1000);
    expect(pack).toBeLessThan(20000);
  });
});

describe("computeBuiltUpColumnSection", () => {
  it("returns 0 area/dimension for a member list with no vertical members", () => {
    const section = computeBuiltUpColumnSection([]);
    expect(section.totalAreaIn2).toBe(0);
    expect(section.effectiveWeakAxisDimIn).toBe(0);
  });

  it("gives a Column Panel's real built-up section a far larger effective weak-axis dimension than a bare 2x4 stud (1.5in)", () => {
    const members = buildColumnPanelMembers(15.5, 120, false);
    const section = computeBuiltUpColumnSection(members);
    expect(section.totalAreaIn2).toBeGreaterThan(0);
    expect(section.effectiveWeakAxisDimIn).toBeGreaterThan(10); // dramatically more than a bare 1.5in stud
  });

  it("sums the area of every vertical member (4 corner studs + 2 side plies, no nailer)", () => {
    const members = buildColumnPanelMembers(15.5, 120, false);
    const verticalMembers = members.filter((m) => m.orientation === "vertical");
    expect(verticalMembers).toHaveLength(6); // 4 studs + 2 side plies
    const section = computeBuiltUpColumnSection(members);
    const expectedAreaIn2 = verticalMembers.reduce((sum, m) => sum + m.actualDimsIn.thicknessIn * m.actualDimsIn.widthIn, 0);
    expect(section.totalAreaIn2).toBeCloseTo(expectedAreaIn2, 6);
  });
});

describe("computeBuiltUpColumnBearingCapacityLb", () => {
  it("gives a Column Panel a dramatically higher bearing capacity than the plain double-stud-pack estimate", () => {
    const members = buildColumnPanelMembers(15.5, 120, false);
    const builtUpLb = computeBuiltUpColumnBearingCapacityLb(members, 120);
    const studPackLb = computeStudPackBearingCapacityLb();
    expect(builtUpLb).toBeGreaterThan(studPackLb * 5);
  });

  it("returns 0 for a member list with no vertical members", () => {
    expect(computeBuiltUpColumnBearingCapacityLb([], 120)).toBe(0);
  });
});

describe("computeBracedPanelShearCapacityLb", () => {
  it("returns 0 for a member list with no brace members", () => {
    expect(computeBracedPanelShearCapacityLb([])).toBe(0);
  });

  it("computes a positive shear capacity for a real braced panel's brace members", () => {
    const members = buildBracedPanelMembers(40, 15.5, 120, false, "chevron", false);
    const shearLb = computeBracedPanelShearCapacityLb(members);
    expect(shearLb).toBeGreaterThan(0);
  });

  it("moves with the panel's WIDTH, and the movement is bounded inside the tiler's [24in, 48in] band", () => {
    // ⚠ This pins a claim made in prose elsewhere: `planCornerBraceCombine`
    // (packages/geometry) lets the corner-brace combine RESIZE a pre-existing
    // braced panel to settle its leftover, and the argument that this is safe
    // rests on these numbers. They were quoted in a doc comment and nothing
    // asserted them, which is how a figure drifts.
    //
    // ⚠ The model behind them derives from `pending-BI-confirmation` values.
    // Asserting a number here pins the CODE's behaviour; it does not promote
    // the underlying figure to confirmed.
    const at = (widthIn: number) =>
      Math.round(computeBracedPanelShearCapacityLb(buildBracedPanelMembers(widthIn, 15.75, 96, false, "chevron", false)));
    /* ⚠ THESE NUMBERS MOVED ON 2026-10-13, and the reason is a geometry fix,
       not a model change. Tommy re-anchored the chevron brace so its point
       meets the girt bar's top face and its far long point stays flush with
       the panel edge, with the angle as the output. The brace comes out
       shorter and steeper, so every figure here rose:

         24in  2,678 -> 3,225      40in  3,177 -> 3,474
         48in  3,040 -> 3,250      peak moved from ~40in to ~36in

       ⚠ The underlying model is still `pending-BI-confirmation`. Pinning a
       number here pins the CODE's behaviour; it does not promote the figure
       to confirmed, and a 20% rise at the narrow end is worth a human
       looking at before anyone leans on it.

       96in tall, 15.75in thick, chevron — still not monotonic: it rises off
       the narrow end, peaks in the middle of the band and falls again as the
       brace lies flatter. */
    expect(at(24)).toBe(3_225);
    expect(at(40)).toBe(3_474);
    expect(at(48)).toBe(3_250);
    /* The band is what bounds the permission: the whole [24in, 48in] range
       sits within 9% of its own peak — the 24in end is still the worst of it
       — which is a fraction of the cost of the thing the combine is forbidden
       to do instead, swallowing the brace, at -100%.

       ⚠ The new geometry made this band TIGHTER, from 16% to 8.5%. The
       argument this test protects is therefore stronger than it was, not
       weaker — worth saying explicitly, because a changed number in a
       safety-adjacent test is otherwise indistinguishable from a regression. */
    const inBand = [24, 30, 36, 40, 44, 48].map(at);
    const spreadPct = (Math.min(...inBand) / Math.max(...inBand) - 1) * 100;
    expect(spreadPct).toBeGreaterThan(-9);
    expect(spreadPct).toBeLessThan(-8);
  });

  it("contributes ~0 shear for a brace standing perfectly vertical (tiltDeg=0)", () => {
    const verticalBrace = {
      memberId: "test_brace",
      material: "dimensional_lumber" as const,
      speciesGrade: null,
      plySpec: null,
      nominalSize: "2x4",
      actualDimsIn: { thicknessIn: 1.5, widthIn: 3.5, lengthIn: 60 },
      orientation: "diagonal" as const,
      position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 90, tiltDeg: 0 },
      role: "brace" as const,
      qty: 1,
    };
    expect(computeBracedPanelShearCapacityLb([verticalBrace])).toBeCloseTo(0, 6);
  });

  it("contributes ~its full axial capacity for a brace lying perfectly horizontal (tiltDeg=90)", () => {
    const horizontalBrace = {
      memberId: "test_brace",
      material: "dimensional_lumber" as const,
      speciesGrade: null,
      plySpec: null,
      nominalSize: "2x4",
      actualDimsIn: { thicknessIn: 1.5, widthIn: 3.5, lengthIn: 60 },
      orientation: "diagonal" as const,
      position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 90, tiltDeg: 90 },
      role: "brace" as const,
      qty: 1,
    };
    const axialCapacityLb = computeNdsColumnCapacityLb(60, 1.5, 5.25);
    expect(computeBracedPanelShearCapacityLb([horizontalBrace])).toBeCloseTo(axialCapacityLb, 4);
  });
});
