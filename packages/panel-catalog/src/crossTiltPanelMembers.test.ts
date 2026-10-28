import { describe, expect, it } from "vitest";
import { buildCrossTiltPanelMembers } from "./crossTiltPanelMembers";
import { buildGablePanelMembers } from "./gablePanelMembers";

const W = 48;
const D = 15.5;

describe("⚠ a panel tilted FRONT TO BACK, not left to right", () => {
  it("the two faces are different heights; the two sides are not", () => {
    /* This is the whole difference from a Gable End Panel. A gable's top
       slopes along its WIDTH — stand in front and it runs uphill left to
       right. This one's slopes through its DEPTH, and in elevation it looks
       level. */
    const built = buildCrossTiltPanelMembers({ widthIn: W, depthIn: D, lowHeightIn: 96, pitchIn12: 4 });
    expect(built.refusal).toBeNull();

    const studs = built.members.filter((m) => m.memberId.startsWith("cross_tilt_stud_"));
    const ext = studs.filter((m) => m.memberId.includes("exterior"));
    const int = studs.filter((m) => m.memberId.includes("interior"));

    // Both exterior studs match each other, as do both interior ones...
    expect(new Set(ext.map((m) => m.actualDimsIn.lengthIn)).size).toBe(1);
    expect(new Set(int.map((m) => m.actualDimsIn.lengthIn)).size).toBe(1);
    // ...and the interior pair is taller, because the top rises inward.
    expect(int[0]!.actualDimsIn.lengthIn).toBeGreaterThan(ext[0]!.actualDimsIn.lengthIn);
  });

  it("⚠ a gable panel does the opposite, which is why this is a new type", () => {
    /* Proof the existing type cannot express it: a gable's own two heights
       are its LEFT and RIGHT edges. */
    const gable = buildGablePanelMembers(W, D, 48, 72, false);
    const gableStuds = gable.filter((m) => m.role === "stud");
    expect(gableStuds.length).toBeGreaterThan(0);
    // Its studs vary across the width; the tilted panel's vary through depth.
    const byX = new Map<number, number>();
    for (const s of gableStuds) byX.set(s.position.xIn, s.actualDimsIn.lengthIn);
    expect(new Set(byX.values()).size).toBeGreaterThan(1);
  });

  it("the rise follows the roof's own pitch over the panel's depth", () => {
    // 15.5in of depth at 4:12 rises 5.167in.
    const built = buildCrossTiltPanelMembers({ widthIn: W, depthIn: D, lowHeightIn: 96, pitchIn12: 4 });
    expect(built.highHeightIn).toBeCloseTo(96 + (15.5 * 4) / 12, 9);
    expect(built.tiltDeg).toBeCloseTo((Math.atan2((15.5 * 4) / 12, 15.5) * 180) / Math.PI, 9);
    // Which is the roof's own angle, as it has to be to land flush.
    expect(built.tiltDeg).toBeCloseTo((Math.atan2(4, 12) * 180) / Math.PI, 9);
  });

  it("⚠ the top plate is ONE board, cut to the SLOPED depth", () => {
    /* "We can do one incline surface per panel in the table." So it is a
       single angled face, not a stepped approximation — and the board is
       longer than the panel is deep, which is the number the shop cuts. */
    const built = buildCrossTiltPanelMembers({ widthIn: W, depthIn: D, lowHeightIn: 96, pitchIn12: 4 });
    const plates = built.members.filter((m) => m.role === "plate");
    expect(plates).toHaveLength(1);
    const plate = plates[0]!;
    expect(plate.actualDimsIn.lengthIn).toBeGreaterThan(D);
    expect(plate.actualDimsIn.lengthIn).toBeCloseTo(Math.hypot(D, (15.5 * 4) / 12), 9);
    expect(plate.position.tiltDeg).toBeCloseTo(built.tiltDeg, 9);
    expect(plate.notes).toContain("off level");
  });

  it("a flat roof tilts it not at all, and the faces match", () => {
    const built = buildCrossTiltPanelMembers({ widthIn: W, depthIn: D, lowHeightIn: 96, pitchIn12: 0 });
    expect(built.tiltDeg).toBe(0);
    expect(built.highHeightIn).toBe(96);
    const studs = built.members.filter((m) => m.memberId.startsWith("cross_tilt_stud_"));
    expect(new Set(studs.map((m) => m.actualDimsIn.lengthIn)).size).toBe(1);
  });

  it("a steeper roof tilts it more", () => {
    const shallow = buildCrossTiltPanelMembers({ widthIn: W, depthIn: D, lowHeightIn: 96, pitchIn12: 2 });
    const steep = buildCrossTiltPanelMembers({ widthIn: W, depthIn: D, lowHeightIn: 96, pitchIn12: 12 });
    expect(steep.tiltDeg).toBeGreaterThan(shallow.tiltDeg);
    expect(steep.highHeightIn).toBeGreaterThan(shallow.highHeightIn);
  });

  it("refuses what it cannot build", () => {
    expect(buildCrossTiltPanelMembers({ widthIn: 0, depthIn: D, lowHeightIn: 96, pitchIn12: 4 }).refusal).toContain("width");
    expect(buildCrossTiltPanelMembers({ widthIn: W, depthIn: D, lowHeightIn: 0, pitchIn12: 4 }).refusal).toContain("low side");
    expect(buildCrossTiltPanelMembers({ widthIn: W, depthIn: D, lowHeightIn: 96, pitchIn12: Number.NaN }).refusal).toContain("pitch");
  });
});
