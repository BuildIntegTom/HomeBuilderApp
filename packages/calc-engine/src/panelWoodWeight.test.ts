import { describe, expect, it } from "vitest";
import { computeStandardPanelWoodWeight } from "./panelWoodWeight";

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
