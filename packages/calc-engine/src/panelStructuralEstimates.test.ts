import { describe, expect, it } from "vitest";
import { buildBracedPanelMembers } from "@building-integrity/panel-catalog";
import {
  SPF_NO2_EMIN_PSI,
  SPF_NO2_FC_PSI,
  computeBracedPanelShearCapacityLb,
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

describe("computeBracedPanelShearCapacityLb", () => {
  it("returns 0 for a member list with no brace members", () => {
    expect(computeBracedPanelShearCapacityLb([])).toBe(0);
  });

  it("computes a positive shear capacity for a real braced panel's brace members", () => {
    const members = buildBracedPanelMembers(40, 15.5, 120, false);
    const shearLb = computeBracedPanelShearCapacityLb(members);
    expect(shearLb).toBeGreaterThan(0);
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
