import { describe, expect, it } from "vitest";
import { buildStandardPanelMembers } from "./standardPanelMembers";
import { buildNailer, computePlywoodAreaSqFt } from "./panelMemberHelpers";

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
