import { describe, expect, it } from "vitest";
import { computePanelWeightBreakdown } from "./panelWeightBreakdown";
import { computeStrawWeight } from "./weight";

describe("computePanelWeightBreakdown", () => {
  const dims = { widthIn: 40, thicknessIn: 15.5, heightIn: 120, densityKgM3: 112.13 };

  it("straw-only weight matches computeStrawWeight directly (consistency, not re-derived physics)", () => {
    const straw = computeStrawWeight(dims.widthIn, dims.thicknessIn, dims.heightIn, dims.densityKgM3);
    const breakdown = computePanelWeightBreakdown({
      ...dims,
      woodWeightKg: null,
      hasClayPlaster: false,
      hasLimePlaster: false,
    });
    expect(breakdown.strawOnlyWeightKg).toBeCloseTo(straw.weightKg, 9);
  });

  it("includes a real wood component and sums it into the modeled total when wood weight is known", () => {
    const breakdown = computePanelWeightBreakdown({
      ...dims,
      woodWeightKg: 20,
      hasClayPlaster: false,
      hasLimePlaster: false,
    });
    const wood = breakdown.components.find((c) => c.label.startsWith("Wood"))!;
    expect(wood.weightKg).toBe(20);
    expect(wood.weightLb).toBeCloseTo(44.0924, 4);
    expect(breakdown.totalModeledWeightKg).toBeCloseTo(breakdown.strawOnlyWeightKg + 20, 9);
  });

  it("flags wood as not-modeled (null) without treating it as 0 silently — it's excluded from the sum via null, not counted as a real 0", () => {
    const breakdown = computePanelWeightBreakdown({
      ...dims,
      woodWeightKg: null,
      hasClayPlaster: false,
      hasLimePlaster: false,
    });
    const wood = breakdown.components.find((c) => c.label.startsWith("Wood"))!;
    expect(wood.weightKg).toBeNull();
    expect(wood.weightLb).toBeNull();
    expect(breakdown.totalModeledWeightKg).toBeCloseTo(breakdown.strawOnlyWeightKg, 9);
  });

  it("omits clay/lime components entirely when neither finish is selected", () => {
    const breakdown = computePanelWeightBreakdown({
      ...dims,
      woodWeightKg: null,
      hasClayPlaster: false,
      hasLimePlaster: false,
    });
    expect(breakdown.components.some((c) => c.label.includes("plaster"))).toBe(false);
  });

  it("includes clay and/or lime components (as not-modeled) only when that finish is actually selected", () => {
    const clayOnly = computePanelWeightBreakdown({
      ...dims,
      woodWeightKg: null,
      hasClayPlaster: true,
      hasLimePlaster: false,
    });
    expect(clayOnly.components.some((c) => c.label === "Clay plaster")).toBe(true);
    expect(clayOnly.components.some((c) => c.label === "Lime plaster")).toBe(false);

    const both = computePanelWeightBreakdown({
      ...dims,
      woodWeightKg: null,
      hasClayPlaster: true,
      hasLimePlaster: true,
    });
    expect(both.components.some((c) => c.label === "Clay plaster")).toBe(true);
    expect(both.components.some((c) => c.label === "Lime plaster")).toBe(true);
  });
});
