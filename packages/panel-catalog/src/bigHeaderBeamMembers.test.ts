import { describe, expect, it } from "vitest";
import { buildBigHeaderBeamMembers } from "./bigHeaderBeamMembers";
import { computeTrussWebPeakCount } from "./panelMemberHelpers";

const DEPTH_IN = 15.5;
const WIDTH_IN = 96;
const HEIGHT_IN = 14;

describe("buildBigHeaderBeamMembers", () => {
  it("builds without throwing across a width range", () => {
    for (const widthIn of [24, 48, 96, 200, 400]) {
      expect(() => buildBigHeaderBeamMembers(widthIn, DEPTH_IN, HEIGHT_IN)).not.toThrow();
    }
  });

  it("has W-truss web bracing on both wythes", () => {
    const members = buildBigHeaderBeamMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN);
    const braces = members.filter((m) => m.role === "brace");
    expect(braces.length).toBeGreaterThan(0);
    const ext = braces.filter((m) => m.memberId.includes("_ext_"));
    const int = braces.filter((m) => m.memberId.includes("_int_"));
    expect(ext.length).toBe(int.length);
    expect(ext.length).toBeGreaterThan(0);
  });

  it("matches computeTrussWebPeakCount's own prediction (always the 'however many peaks' path, no isDoor-style single-peak fork)", () => {
    const riseIn = HEIGHT_IN - 2 * 1.5 - 2 * 0.75; // headerWebRiseIn's own formula
    const expectedPeaks = computeTrussWebPeakCount(WIDTH_IN, riseIn);
    const members = buildBigHeaderBeamMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN);
    const extRises = members.filter((m) => m.role === "brace" && m.memberId.includes("_ext_") && m.memberId.includes("_rise"));
    expect(extRises).toHaveLength(expectedPeaks);
  });

  it("uses more peaks for a wide beam than a narrow one, at the same height", () => {
    const narrow = buildBigHeaderBeamMembers(30, DEPTH_IN, HEIGHT_IN);
    const wide = buildBigHeaderBeamMembers(240, DEPTH_IN, HEIGHT_IN);
    const narrowPeaks = narrow.filter((m) => m.role === "brace" && m.memberId.includes("_ext_") && m.memberId.includes("_rise")).length;
    const widePeaks = wide.filter((m) => m.role === "brace" && m.memberId.includes("_ext_") && m.memberId.includes("_rise")).length;
    expect(widePeaks).toBeGreaterThan(narrowPeaks);
  });

  it("still yields at least 1 peak for a very narrow width", () => {
    const members = buildBigHeaderBeamMembers(12, DEPTH_IN, HEIGHT_IN);
    const extRises = members.filter((m) => m.role === "brace" && m.memberId.includes("_ext_") && m.memberId.includes("_rise"));
    expect(extRises.length).toBeGreaterThanOrEqual(1);
  });

  it("has no fill/insulation-related members — a solid framed + braced panel, unlike a Box Beam", () => {
    const members = buildBigHeaderBeamMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN);
    expect(members.some((m) => m.notes?.toLowerCase().includes("cellulose") || m.notes?.toLowerCase().includes("insulation"))).toBe(false);
  });

  it("has 4 chords (top/bottom x ext/int) plus 2 plywood plate caps and 2 end caps, chords/caps spanning the full width/height", () => {
    const members = buildBigHeaderBeamMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN);
    const chords = members.filter((m) => m.role === "plate");
    expect(chords).toHaveLength(4);
    for (const c of chords) expect(c.actualDimsIn.lengthIn).toBeCloseTo(WIDTH_IN, 6);

    const leftCap = members.find((m) => m.memberId === "left_end_ply")!;
    const rightCap = members.find((m) => m.memberId === "right_end_ply")!;
    expect(leftCap).toBeDefined();
    expect(rightCap).toBeDefined();
    expect(leftCap.actualDimsIn.lengthIn).toBeCloseTo(HEIGHT_IN, 6);
  });
});
