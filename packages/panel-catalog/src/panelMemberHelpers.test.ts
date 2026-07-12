import { describe, expect, it } from "vitest";
import { buildStandardPanelMembers } from "./standardPanelMembers";
import {
  buildNailer,
  buildTrussWebBraces,
  computePlywoodAreaSqFt,
  computeTrussWebAngleDeg,
  computeTrussWebPeakCount,
  memberBoxSizeIn,
} from "./panelMemberHelpers";

describe("computePlywoodAreaSqFt", () => {
  it("sums only plywood members at the requested thickness", () => {
    const members = buildStandardPanelMembers(40, 15.5, 120, false);
    const threeQuarterSqFt = computePlywoodAreaSqFt(members, 0.75);
    const halfSqFt = computePlywoodAreaSqFt(members, 0.5);

    const expectedThreeQuarter = members
      .filter((m) => m.material === "plywood" && m.actualDimsIn.thicknessIn === 0.75)
      .reduce((sum, m) => sum + (m.actualDimsIn.widthIn * m.actualDimsIn.lengthIn) / 144, 0);
    expect(threeQuarterSqFt).toBeCloseTo(expectedThreeQuarter, 6);
    expect(threeQuarterSqFt).toBeGreaterThan(0); // 2 skins
    expect(halfSqFt).toBeGreaterThan(0); // 2 girt webs
    expect(halfSqFt).not.toBeCloseTo(threeQuarterSqFt, 1);
  });

  it("returns 0 when no plywood member matches the thickness", () => {
    const members = buildStandardPanelMembers(40, 15.5, 120, false);
    expect(computePlywoodAreaSqFt(members, 3)).toBe(0);
  });

  it("returns 0 for an empty member list", () => {
    expect(computePlywoodAreaSqFt([], 0.75)).toBe(0);
  });
});

describe("computeTrussWebPeakCount / computeTrussWebAngleDeg", () => {
  it("uses 1 peak when a single peak already clears the 30deg minimum", () => {
    // A 36in-wide, 18in-rise door header: half-width 18, rise 18 -> 45deg with 1 peak.
    const n = computeTrussWebPeakCount(36, 18);
    expect(n).toBe(1);
    expect(computeTrussWebAngleDeg(36, 18, n)).toBeCloseTo(45, 6);
  });

  it("needs more peaks as width grows for a fixed rise, to keep every web >= 30deg", () => {
    const rise = 12;
    const narrow = computeTrussWebPeakCount(36, rise);
    const wide = computeTrussWebPeakCount(120, rise);
    expect(wide).toBeGreaterThan(narrow);
    expect(computeTrussWebAngleDeg(120, rise, wide)).toBeGreaterThanOrEqual(30 - 1e-6);
  });

  it("never returns fewer than 1 peak even for a very short rise", () => {
    expect(computeTrussWebPeakCount(200, 0.001)).toBeGreaterThanOrEqual(1);
  });
});

describe("buildTrussWebBraces", () => {
  it("builds 2 braces per peak (rise + fall), all 2x4 diagonal members rotated 90deg", () => {
    const braces = buildTrussWebBraces(3, 90, 0, () => 20, 0.75, "web");
    expect(braces).toHaveLength(6);
    for (const b of braces) {
      expect(b.orientation).toBe("diagonal");
      expect(b.position.rotationDeg).toBe(90);
      expect(b.actualDimsIn.thicknessIn).toBeCloseTo(1.5, 6);
      expect(b.actualDimsIn.widthIn).toBeCloseTo(3.5, 6);
      expect(b.position.yIn).toBeCloseTo(0.75, 6);
    }
  });

  it("shares feet/peaks continuously — each peak's fall-end X matches the next peak's rise-start X", () => {
    const braces = buildTrussWebBraces(3, 90, 0, () => 20, 0.75, "web");
    function endpoints(brace: (typeof braces)[number]) {
      const size = memberBoxSizeIn(brace);
      const tiltRad = (brace.position.tiltDeg! * Math.PI) / 180;
      const halfLen = size.zIn / 2;
      return {
        x1: brace.position.xIn + -Math.sin(tiltRad) * halfLen,
        x2: brace.position.xIn - -Math.sin(tiltRad) * halfLen,
      };
    }
    // rise_1: foot at x=0; fall_1 and rise_2 should meet at the shared foot x=30 (90/3); fall_3 ends at x=90.
    const fall1 = endpoints(braces.find((b) => b.memberId === "web_1_fall")!);
    const rise2 = endpoints(braces.find((b) => b.memberId === "web_2_rise")!);
    const sharedFootXs = [fall1.x1, fall1.x2, rise2.x1, rise2.x2].map((x) => Math.round(x * 1e6) / 1e6);
    expect(new Set(sharedFootXs).size).toBeLessThanOrEqual(3); // at least one X value repeats between the two braces
  });

  it("follows a sloped top chord (gable-style) via topZAt", () => {
    const braces = buildTrussWebBraces(2, 40, 1, (x) => 1 + x * 0.5, 0.75, "web");
    // Peak 2 (further along X) should sit higher than peak 1, since topZAt rises with X.
    const peak1 = braces.find((b) => b.memberId === "web_1_rise")!;
    const peak2 = braces.find((b) => b.memberId === "web_2_rise")!;
    expect(peak2.position.zIn).toBeGreaterThan(peak1.position.zIn);
  });
});

describe("buildNailer", () => {
  it("centers the nailer by default (offsetIn = 0)", () => {
    const nailer = buildNailer(40, 120);
    expect(nailer.position.xIn).toBeCloseTo(40 / 2 - 1.5 / 2, 6);
  });

  it("slides the nailer by offsetIn from its centered position", () => {
    const centered = buildNailer(40, 120);
    const slid = buildNailer(40, 120, 6);
    expect(slid.position.xIn).toBeCloseTo(centered.position.xIn + 6, 6);
  });
});
