import { describe, expect, it } from "vitest";
import { buildStandardPanelMembers, type PanelMember } from "@building-integrity/panel-catalog";
import { computeStandardPanelStrawVolume } from "./panelStrawVolume";

describe("computeStandardPanelStrawVolume", () => {
  it("computes envelope minus member volume exactly, for a hand-built single member", () => {
    // Envelope 10in x 10in x 10in = 1000in3 = 1000/1728 ft3.
    // One "flat" member 10x10x2 (thickness=2, width=10, length=10) = 200in3.
    const member: PanelMember = {
      memberId: "m",
      material: "plywood",
      speciesGrade: null,
      plySpec: null,
      nominalSize: null,
      actualDimsIn: { thicknessIn: 2, widthIn: 10, lengthIn: 10 },
      orientation: "flat",
      position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0 },
      role: "skin",
      qty: 1,
    };
    const result = computeStandardPanelStrawVolume([member], { heightIn: 10, widthIn: 10, depthIn: 10 });
    expect(result.envelopeVolumeFt3).toBeCloseTo(1000 / 1728, 6);
    expect(result.memberVolumeFt3).toBeCloseTo(200 / 1728, 6);
    expect(result.strawVolumeFt3).toBeCloseTo(800 / 1728, 6);
  });

  it("returns 0 straw volume when there are no members", () => {
    const result = computeStandardPanelStrawVolume([], { heightIn: 10, widthIn: 10, depthIn: 10 });
    expect(result.memberVolumeFt3).toBe(0);
    expect(result.strawVolumeFt3).toBeCloseTo(result.envelopeVolumeFt3, 6);
  });

  it("stays consistent (envelope - member = straw) for a real Standard Panel's members", () => {
    const overallDimensions = { heightIn: 120, widthIn: 40, depthIn: 15.5 };
    const members = buildStandardPanelMembers(overallDimensions.widthIn, overallDimensions.depthIn, overallDimensions.heightIn, true);
    const result = computeStandardPanelStrawVolume(members, overallDimensions);
    expect(result.envelopeVolumeFt3 - result.memberVolumeFt3).toBeCloseTo(result.strawVolumeFt3, 6);
    // Sanity: the panel's wood/plywood shouldn't come close to filling its own envelope.
    expect(result.strawVolumeFt3).toBeGreaterThan(0);
    expect(result.strawVolumeFt3).toBeLessThan(result.envelopeVolumeFt3);
  });
});
