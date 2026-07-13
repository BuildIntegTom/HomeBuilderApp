import { describe, expect, it } from "vitest";
import { buildStandardPanelMembers } from "./standardPanelMembers";
import type { PanelMember } from "./componentSchema";
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

  function endpoints(brace: PanelMember): { x: number; z: number }[] {
    const size = memberBoxSizeIn(brace);
    const tiltRad = (brace.position.tiltDeg! * Math.PI) / 180;
    const halfLen = size.zIn / 2;
    return [
      { x: brace.position.xIn + -Math.sin(tiltRad) * halfLen, z: brace.position.zIn + Math.cos(tiltRad) * halfLen },
      { x: brace.position.xIn - -Math.sin(tiltRad) * halfLen, z: brace.position.zIn - Math.cos(tiltRad) * halfLen },
    ];
  }

  it("flanks a small gap at an internal foot instead of pinching fall/rise to one shared point", () => {
    const braces = buildTrussWebBraces(3, 90, 0, () => 20, 0.75, "web");
    // rise_1: foot at x=0; fall_1 and rise_2 used to meet at the shared foot x=30 (90/3); fall_3 ends at x=90.
    const nearFoot = (p: { x: number; z: number }) => Math.abs(p.z) < 5; // the foot-side endpoint, near the bottom chord (z=0), not the peak (z=20)
    const fall1FootEnd = endpoints(braces.find((b) => b.memberId === "web_1_fall")!).find(nearFoot)!;
    const rise2FootEnd = endpoints(braces.find((b) => b.memberId === "web_2_rise")!).find(nearFoot)!;

    // Neither piece actually reaches the nominal shared foot (x=30) anymore — each stops
    // PEAK_GAP_IN/2 short of it, flanking a real gap instead.
    expect(fall1FootEnd.x).toBeLessThan(30);
    expect(rise2FootEnd.x).toBeGreaterThan(30);
    expect(rise2FootEnd.x - fall1FootEnd.x).toBeGreaterThan(0.5);
  });

  it("still touches the bottom chord exactly at the very first/last foot (no flanking against the continuous chord)", () => {
    const braces = buildTrussWebBraces(3, 90, 0, () => 20, 0.75, "web");
    const rise1 = endpoints(braces.find((b) => b.memberId === "web_1_rise")!);
    const fall3 = endpoints(braces.find((b) => b.memberId === "web_3_fall")!);
    expect(rise1.some((p) => Math.abs(p.x) < 1e-6 && Math.abs(p.z) < 1e-6)).toBe(true); // starts exactly at x=0
    expect(fall3.some((p) => Math.abs(p.x - 90) < 1e-6 && Math.abs(p.z) < 1e-6)).toBe(true); // ends exactly at x=90
  });

  it("flanks a small gap at a peak too (rise meeting its own fall)", () => {
    const braces = buildTrussWebBraces(1, 36, 0, () => 18, 0.75, "web");
    const nearPeak = (p: { x: number; z: number }) => Math.abs(p.z - 18) < 5;
    const risePeakEnd = endpoints(braces.find((b) => b.memberId === "web_1_rise")!).find(nearPeak)!;
    const fallPeakEnd = endpoints(braces.find((b) => b.memberId === "web_1_fall")!).find(nearPeak)!;
    expect(risePeakEnd.x).toBeLessThan(18); // short of the nominal peak (x=18)
    expect(fallPeakEnd.x).toBeGreaterThan(18);
    expect(fallPeakEnd.x - risePeakEnd.x).toBeGreaterThan(0.5);
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
