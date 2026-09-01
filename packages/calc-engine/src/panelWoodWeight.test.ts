import { describe, expect, it } from "vitest";
import { buildBracedPanelMembers, buildStandardPanelMembers, type PanelMember } from "@building-integrity/panel-catalog";
import { computeMemberSetWoodWeight, computeStandardPanelWoodWeight } from "./panelWoodWeight";

describe("computeStandardPanelWoodWeight", () => {
  it("matches the hand-computed volume/weight for the bare standard panel (no nailer)", () => {
    // plywood: 2x bottom/top skins (0.75x15.5x48=558 in3 each) + 2x girt webs (0.5x8.75x46=201.25 in3 each)
    //   = 1116 + 402.5 = 1518.5 in3 = 0.878761... ft3
    // lumber: 2x2 plate 2x4s (1.5x3.5x45=236.25 in3, x2 qty x2 mirrored=945) + 4 studs (1.5x3.5x118.5=622.125, x4=2488.5)
    //   + 2 girt blocks (1.5x3.5x15.5=81.375, x2=162.75) = 945+2488.5+162.75 = 3596.25 in3 = 2.081163... ft3
    // weight = 0.878761574*36 + 2.081163194*30 = 94.0703125 lb
    const result = computeStandardPanelWoodWeight(false);
    expect(result.plywoodVolumeFt3).toBeCloseTo(0.878762, 5);
    expect(result.lumberVolumeFt3).toBeCloseTo(2.081163, 5);
    expect(result.weightLb).toBeCloseTo(94.0703, 3);
    expect(result.weightKg).toBeCloseTo(42.6695, 3);
    expect(result.includesNailer).toBe(false);
  });

  it("adds the optional nailer's lumber volume when requested", () => {
    // nailer: 1.5x3.5x115.5 = 606.375 in3 = 0.350911... ft3, x30 lb/ft3 = 10.5273 lb
    const withNailer = computeStandardPanelWoodWeight(true);
    const withoutNailer = computeStandardPanelWoodWeight(false);
    expect(withNailer.weightLb - withoutNailer.weightLb).toBeCloseTo(10.5273, 3);
    expect(withNailer.includesNailer).toBe(true);
  });
});

describe("computeMemberSetWoodWeight", () => {
  it("lands in the same ballpark as computeStandardPanelWoodWeight's flat reference BOM at the same nominal dimensions", () => {
    // 48in wide x 15.5in deep x 120in tall matches standardPanelBom's own
    // reference dimensions (skin 48in long, girt web 8.75x46, studs
    // 118.5in) — see standardPanelMembers.test.ts's own cross-check. Not
    // expected to match exactly: buildStandardPanelMembers derives girt row
    // count dynamically (computeStandardGirtRowCount) rather than the flat
    // BOM's fixed qty:2, so a few-percent difference is normal, not a bug.
    const members = buildStandardPanelMembers(48, 15.5, 120, false);
    const fromMembers = computeMemberSetWoodWeight(members);
    const fromFlatBom = computeStandardPanelWoodWeight(false);
    expect(fromMembers.weightLb).toBeGreaterThan(fromFlatBom.weightLb * 0.8);
    expect(fromMembers.weightLb).toBeLessThan(fromFlatBom.weightLb * 1.2);
  });

  it("gives a braced panel more wood weight than a standard panel at the same dimensions (real brace/connector geometry, not the flat same-BOM assumption)", () => {
    const standard = computeMemberSetWoodWeight(buildStandardPanelMembers(40, 15.5, 120, false));
    const braced = computeMemberSetWoodWeight(buildBracedPanelMembers(40, 15.5, 120, false, "chevron", false));
    expect(braced.weightLb).toBeGreaterThan(standard.weightLb);
  });

  it("sums thickness x width x length x qty per member, split plywood vs. dimensional lumber by material", () => {
    const members: PanelMember[] = [
      {
        memberId: "ply",
        material: "plywood",
        speciesGrade: null,
        plySpec: null,
        nominalSize: null,
        actualDimsIn: { thicknessIn: 0.75, widthIn: 12, lengthIn: 24 },
        orientation: "flat",
        position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0 },
        role: "skin",
        qty: 2,
      },
      {
        memberId: "lumber",
        material: "dimensional_lumber",
        speciesGrade: null,
        plySpec: null,
        nominalSize: "2x4",
        actualDimsIn: { thicknessIn: 1.5, widthIn: 3.5, lengthIn: 96 },
        orientation: "vertical",
        position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0 },
        role: "stud",
        qty: 3,
      },
      {
        memberId: "screws",
        material: "fastener",
        speciesGrade: null,
        plySpec: null,
        nominalSize: null,
        actualDimsIn: { thicknessIn: 0.25, widthIn: 0.25, lengthIn: 4 },
        orientation: "flat",
        position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0 },
        role: "blocking",
        qty: 100,
      },
    ];
    const result = computeMemberSetWoodWeight(members);
    // plywood: 0.75*12*24*2 = 432 in3 = 0.25 ft3; lumber: 1.5*3.5*96*3 = 1512 in3 = 0.875 ft3
    expect(result.plywoodVolumeFt3).toBeCloseTo(0.25, 6);
    expect(result.lumberVolumeFt3).toBeCloseTo(0.875, 6);
    // fasteners excluded entirely — weight = 0.25*36 + 0.875*30 = 35.25 lb
    expect(result.weightLb).toBeCloseTo(35.25, 4);
  });
});
