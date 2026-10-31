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

  it("⚠ the top is ONE inclined plane and every member is ripped to it", () => {
    /* "We can do one incline surface per panel in the table." A single
       angled face, not a stepped approximation — so the top skin, both top
       plates and every stud top lie in the same plane. */
    const built = buildCrossTiltPanelMembers({ widthIn: W, depthIn: D, lowHeightIn: 96, pitchIn12: 4 });
    const cos = 12 / Math.hypot(12, 4);
    const topAt = (yIn: number) => 96 + (yIn * 4) / 12;

    const skin = built.members.find((m) => m.memberId === "cross_tilt_top_skin")!;
    /* The skin is cut to the SLOPED depth, longer than the panel is deep —
       the number the shop cuts to. */
    expect(skin.actualDimsIn.widthIn).toBeCloseTo(D / cos, 9);
    expect(skin.actualDimsIn.widthIn).toBeGreaterThan(D);
    /* Its upper face IS the plane, at both ends of the depth. */
    const skinCorners = skin.position.sectionCornersIn!;
    expect(skinCorners.find((c) => c.yIn === 0)!.zIn).toBeCloseTo(topAt(0), 9);
    expect(skinCorners.find((c) => c.yIn === D)!.zIn).toBeCloseTo(topAt(D), 9);

    /* Both top plates sit UNDER that skin, each ripped across its own 3 1/2in
       of depth rather than left square. */
    for (const face of ["exterior", "interior"]) {
      const plate = built.members.find((m) => m.memberId === `cross_tilt_top_plate_${face}`)!;
      const corners = plate.position.sectionCornersIn!;
      const zs = corners.map((c) => c.zIn);
      expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(0);
      expect(plate.notes).toContain("off level");
    }
  });

  it("⚠ it is a REAL panel now, not the six pieces it was", () => {
    /* Tommy, 2026-10-31: "it appears as though the shed roof sloped
       determining inclined panels are not spawning, though there are a few
       pieces of wood hanging around where they should be." The few pieces
       WERE the panel. */
    const built = buildCrossTiltPanelMembers({ widthIn: W, depthIn: D, lowHeightIn: 96, pitchIn12: 4 });
    /* A 4ft panel: two skins, two bottom plates, two top plates, and two
       rows of three studs — twelve, against the six it had. */
    expect(built.members).toHaveLength(12);
    expect(built.members.some((m) => m.memberId === "cross_tilt_bottom_skin")).toBe(true);
    expect(built.members.some((m) => m.memberId === "cross_tilt_top_skin")).toBe(true);
    expect(built.members.filter((m) => m.role === "plate")).toHaveLength(4);
    /* Studs in two rows, and INTERMEDIATE ones, so no bay runs more than
       24in — the old panel had nothing between its four corners. */
    const studs = built.members.filter((m) => m.role === "stud");
    expect(studs).toHaveLength(6);
    const xs = [...new Set(studs.map((m) => m.position.xIn))].sort((a, b) => a - b);
    expect(xs.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeLessThanOrEqual(24 + 1e-9);
    /* A wider panel gets more of them rather than longer bays. */
    const wide = buildCrossTiltPanelMembers({ widthIn: 96, depthIn: D, lowHeightIn: 96, pitchIn12: 4 });
    expect(wide.members.filter((m) => m.role === "stud").length).toBeGreaterThan(studs.length);
  });

  it("⚠ the tilt is carried in the DEPTH plane, not the width plane", () => {
    /* The bug that made it look like loose pieces: `tiltDeg` is applied by
       both the renderer and the exporter in the panel's WIDTH/HEIGHT plane,
       which is the one plane this panel's tilt is NOT in, so its one sloped
       board came out swung sideways. Nothing here may carry it. */
    const built = buildCrossTiltPanelMembers({ widthIn: W, depthIn: D, lowHeightIn: 96, pitchIn12: 4 });
    for (const m of built.members) {
      expect({ id: m.memberId, tilt: m.position.tiltDeg }).toEqual({ id: m.memberId, tilt: undefined });
    }
    expect(built.members.some((m) => m.position.sectionCornersIn)).toBe(true);
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
