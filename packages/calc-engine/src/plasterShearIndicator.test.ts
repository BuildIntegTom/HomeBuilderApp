import { describe, expect, it } from "vitest";
import {
  plasterShearReferenceRows,
  plasterShearReferenceStatus,
} from "@building-integrity/panel-catalog";
import {
  plasterShearAspectRatioFactor,
  plasterShearIndicator,
} from "./plasterShearIndicator";

describe("the transcribed Table 106.16 rows", () => {
  it("keeps clay and lime separate, which is the question Tommy asked", () => {
    const clay = plasterShearReferenceRows.filter((r) => r.binder === "clay");
    const lime = plasterShearReferenceRows.filter((r) => r.binder === "lime");
    expect(clay.map((r) => r.allowableShearPlf)).toEqual([60, 140, 180]);
    expect(lime.map((r) => r.allowableShearPlf)).toEqual([330, 450]);
  });

  it("records that bare plaster on straw, with NO mesh at all, is still worth 60 plf", () => {
    // Tommy: "if 7lbs/cuft straw actually has any sheer associated with it".
    // Bales run ~6.5-8 lb/ft3, so 7 is inside the tested range, and row A1 is
    // the answer: small, real, and code-recognised.
    const a1 = plasterShearReferenceRows.find((r) => r.designation === "A1")!;
    expect(a1.mesh).toBe("none");
    expect(a1.stapleSpacingIn).toBeNull();
    expect(a1.allowableShearPlf).toBe(60);
  });

  it("shows lime beating clay by 2.4-3.2x at 60% of the thickness", () => {
    const limeBest = plasterShearReferenceRows.find((r) => r.designation === "C2")!;
    const clayBest = plasterShearReferenceRows.find((r) => r.designation === "A3")!;
    expect(limeBest.allowableShearPlf / clayBest.allowableShearPlf).toBeCloseTo(2.5, 1);
    expect(limeBest.thicknessEachSideIn).toBeLessThan(clayBest.thicknessEachSideIn);
  });

  it("stays pending-BI-confirmation and says plainly that it is not a BI value", () => {
    expect(plasterShearReferenceStatus.status).toBe("pending-BI-confirmation");
    expect(plasterShearReferenceStatus.note).toContain("not a Building Integrity value");
  });
});

describe("plasterShearAspectRatioFactor — footnote (f)", () => {
  it("gives the full value at 1:1 or better", () => {
    expect(plasterShearAspectRatioFactor(8, 8)).toBe(1);
    expect(plasterShearAspectRatioFactor(24, 8)).toBe(1);
  });

  it("halves it at 2:1 and interpolates between", () => {
    expect(plasterShearAspectRatioFactor(4, 8)).toBeCloseTo(0.5, 6);
    expect(plasterShearAspectRatioFactor(16, 24)).toBeCloseTo(0.75, 6);
  });

  it("REFUSES past 2:1 rather than extrapolating off the end of the table", () => {
    expect(plasterShearAspectRatioFactor(3, 8)).toBeNull();
    expect(plasterShearAspectRatioFactor(1, 10)).toBeNull();
  });

  it("measures height over length, so a long low wall is the good case", () => {
    expect(plasterShearAspectRatioFactor(40, 8)).toBe(1);
    expect(plasterShearAspectRatioFactor(8, 40)).toBeNull();
  });
});

describe("plasterShearIndicator", () => {
  const wall = { wallLengthFt: 24, wallHeightFt: 8 } as const;

  it("is NEVER applicable, on any input, because that is the finding", () => {
    for (const binder of ["clay", "lime", "cement", "cement-lime", "soil-cement"] as const) {
      const r = plasterShearIndicator({ ...wall, binder });
      expect(r.applicable).toBe(false);
      expect(r.inapplicabilityReasons.length).toBeGreaterThanOrEqual(5);
    }
  });

  it("never returns a number without the reasons attached", () => {
    const r = plasterShearIndicator({ ...wall, binder: "lime" });
    expect(r.indicativePlf).not.toBeNull();
    expect(r.inapplicabilityReasons).not.toHaveLength(0);
  });

  it("names the mesh-lap problem, which is the one that actually bites a pre-plastered panel", () => {
    const r = plasterShearIndicator({ ...wall, binder: "lime" });
    expect(r.inapplicabilityReasons.join(" ")).toContain("8 inches");
    expect(r.inapplicabilityReasons.join(" ")).toContain("cannot lap");
  });

  it("takes the stiffest row for the binder — lime C2 at 450 plf", () => {
    const r = plasterShearIndicator({ ...wall, binder: "lime" });
    expect(r.row?.designation).toBe("C2");
    expect(r.indicativePlf).toBeCloseTo(450, 6);
    expect(r.indicativeTotalLb).toBeCloseTo(450 * 24, 6);
  });

  it("applies the 40% wind increase of footnote (h), and only for wind", () => {
    const seismic = plasterShearIndicator({ ...wall, binder: "lime" });
    const wind = plasterShearIndicator({ ...wall, binder: "lime", forWind: true });
    expect(wind.indicativePlf! / seismic.indicativePlf!).toBeCloseTo(1.4, 6);
  });

  it("knocks the value down on a tall narrow wall, and refuses past 2:1", () => {
    const squat = plasterShearIndicator({ wallLengthFt: 8, wallHeightFt: 8, binder: "lime" });
    const tall = plasterShearIndicator({ wallLengthFt: 4, wallHeightFt: 8, binder: "lime" });
    const tooTall = plasterShearIndicator({ wallLengthFt: 3, wallHeightFt: 8, binder: "lime" });
    expect(squat.indicativePlf).toBeCloseTo(450, 6);
    expect(tall.indicativePlf).toBeCloseTo(225, 6);
    expect(tooTall.indicativePlf).toBeNull();
    expect(tooTall.indicativeTotalLb).toBeNull();
    expect(tooTall.inapplicabilityReasons.join(" ")).toContain("2:1 limit");
  });

  it("returns null rather than guessing when the binder has no row", () => {
    // @ts-expect-error — deliberately off-schema, because a UI string could
    // reach here at runtime even though the type forbids it.
    const r = plasterShearIndicator({ ...wall, binder: "gypsum" });
    expect(r.row).toBeNull();
    expect(r.indicativePlf).toBeNull();
    expect(r.inapplicabilityReasons.join(" ")).toContain("no row for a gypsum binder");
  });

  it("handles a zero-length wall without producing NaN or Infinity", () => {
    const r = plasterShearIndicator({ wallLengthFt: 0, wallHeightFt: 8, binder: "lime" });
    expect(r.aspectRatioFactor).toBeNull();
    expect(r.indicativePlf).toBeNull();
    expect(r.indicativeTotalLb).toBeNull();
  });
});
