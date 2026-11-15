import { describe, expect, it } from "vitest";
import { assemblyEnvelopeDepthIn, assemblyFaceSqFt, largestFaceSqFt, memberLargestFaceSqFt } from "./shopItemFace";
import { buildSafetyGapMembers } from "./safetyGapMembers";
import { buildBoxBeamMembers } from "./boxBeamMembers";
import { buildTrussPlateMembers } from "./trussPlateMembers";
import { buildStandardPanelMembers } from "./standardPanelMembers";

const DEPTH_IN = 15.5;

describe("largestFaceSqFt", () => {
  it("is the biggest of the three faces, whatever order the dimensions arrive in", () => {
    expect(largestFaceSqFt(0.75, 15.5, 120)).toBeCloseTo((15.5 * 120) / 144, 6);
    expect(largestFaceSqFt(120, 0.75, 15.5)).toBeCloseTo((15.5 * 120) / 144, 6);
    expect(largestFaceSqFt(15.5, 120, 0.75)).toBeCloseTo((15.5 * 120) / 144, 6);
  });

  it("a cube's faces are all the same, so there is nothing to choose", () => {
    expect(largestFaceSqFt(12, 12, 12)).toBeCloseTo(1, 6);
  });
});

describe("⚠ assemblyEnvelopeDepthIn — derived from the pieces, not taken on trust", () => {
  it("a safety gap, a box beam and a truss plate all come back at the wall's depth", () => {
    /* Each of these is built across the full wall thickness, and none of them
       carries that number on its fabrication group. Six pipelines would each
       have had to supply it; the pieces already know. */
    expect(assemblyEnvelopeDepthIn(buildSafetyGapMembers(DEPTH_IN, 120))).toBeCloseTo(DEPTH_IN, 6);
    expect(assemblyEnvelopeDepthIn(buildBoxBeamMembers(120, DEPTH_IN))).toBeCloseTo(DEPTH_IN, 6);
    expect(assemblyEnvelopeDepthIn(buildTrussPlateMembers(120, DEPTH_IN))).toBeCloseTo(DEPTH_IN, 6);
  });

  it("a standard panel too — the derivation is not special-cased per pipeline", () => {
    expect(assemblyEnvelopeDepthIn(buildStandardPanelMembers(48, DEPTH_IN, 96, false))).toBeCloseTo(DEPTH_IN, 6);
  });

  it("an assembly with no pieces has no depth, rather than a guessed one", () => {
    expect(assemblyEnvelopeDepthIn([])).toBe(0);
  });
});

describe("⚠ assemblyFaceSqFt — countsAsPanel is the switch", () => {
  const row = (widthIn: number, heightIn: number, depthIn: number, countsAsPanel: boolean) => ({
    widthIn,
    heightIn,
    depthIn,
    countsAsPanel,
  });

  it("a SHOP ITEM takes its largest face — his 12.9, not the 0.63 the elevation gives", () => {
    expect(assemblyFaceSqFt(row(0.75, 120, 15.5, false))).toBeCloseTo(12.9166, 3);
  });

  it("a STRAW PANEL keeps its standing face, unchanged", () => {
    expect(assemblyFaceSqFt(row(48, 96, 15.5, true))).toBeCloseTo(32, 6);
  });

  it("⚠ and keeps it even when its largest face is through the wall", () => {
    /* The reason the gate is `countsAsPanel` and not an unconditional `max`:
       a 48in gable tile only 12in tall in a 15.5in wall is bigger lying down
       (5.17 sq ft) than standing (4 sq ft). It is a panel. It is measured
       standing. A plain `max` would have re-measured the top of every gable
       row without anybody asking for it. */
    expect(assemblyFaceSqFt(row(48, 12, 15.5, true))).toBeCloseTo(4, 6);
    expect(assemblyFaceSqFt(row(48, 12, 15.5, false))).toBeCloseTo((48 * 15.5) / 144, 6);
  });
});

describe("⚠ memberLargestFaceSqFt reads the piece as cut", () => {
  it("turning a piece over does not change its largest face", () => {
    const [sheet] = buildSafetyGapMembers(DEPTH_IN, 120);
    expect(memberLargestFaceSqFt(sheet)).toBeCloseTo((DEPTH_IN * 120) / 144, 6);
    expect(memberLargestFaceSqFt({ ...sheet, orientation: "flat" })).toBeCloseTo(
      memberLargestFaceSqFt(sheet),
      6,
    );
  });
});
