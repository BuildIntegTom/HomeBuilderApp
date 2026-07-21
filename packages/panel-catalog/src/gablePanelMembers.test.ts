import { describe, expect, it } from "vitest";
import { buildGablePanelMembers, buildGablePanelSchema, computeGableRipCallout, GABLE_PANEL_MAX_HEIGHT_IN } from "./gablePanelMembers";
import { memberBoxSizeIn } from "./panelMemberHelpers";

const WIDTH_IN = 40;
const DEPTH_IN = 15.5;
// A gable panel's own edge heights are relative to the eave line (its own
// local height, up to GABLE_PANEL_MAX_HEIGHT_IN) — NOT the absolute wall
// height these constants used to represent before that bug was fixed.
const LOW_EDGE_IN = 20;
const HIGH_EDGE_IN = 50;

describe("computeGableRipCallout", () => {
  it("computes the rip angle/length from the rise over the width", () => {
    const { angleDeg, lengthIn } = computeGableRipCallout(WIDTH_IN, LOW_EDGE_IN, HIGH_EDGE_IN);
    expect(angleDeg).toBeCloseTo((Math.atan2(30, 40) * 180) / Math.PI, 6);
    expect(lengthIn).toBeCloseTo(Math.hypot(40, 30), 6);
  });

  it("returns 0 angle and lengthIn = widthIn when both edges are the same height (no slope)", () => {
    const { angleDeg, lengthIn } = computeGableRipCallout(WIDTH_IN, LOW_EDGE_IN, LOW_EDGE_IN);
    expect(angleDeg).toBeCloseTo(0, 6);
    expect(lengthIn).toBeCloseTo(WIDTH_IN, 6);
  });

  it("returns a negative angle (same magnitude) when the taller edge is on the left instead of the right", () => {
    const rising = computeGableRipCallout(WIDTH_IN, LOW_EDGE_IN, HIGH_EDGE_IN);
    const falling = computeGableRipCallout(WIDTH_IN, HIGH_EDGE_IN, LOW_EDGE_IN);
    expect(falling.angleDeg).toBeCloseTo(-rising.angleDeg, 6);
    expect(falling.lengthIn).toBeCloseTo(rising.lengthIn, 6);
  });
});

describe("buildGablePanelMembers", () => {
  it("builds without throwing regardless of which side (left or right) is taller — no ordering requirement", () => {
    expect(() => buildGablePanelMembers(WIDTH_IN, DEPTH_IN, LOW_EDGE_IN, HIGH_EDGE_IN, false)).not.toThrow();
    expect(() => buildGablePanelMembers(WIDTH_IN, DEPTH_IN, HIGH_EDGE_IN, LOW_EDGE_IN, false)).not.toThrow();
  });

  it("places each edge's real height at its own true local x position — mirrors correctly when the taller edge is on the left", () => {
    // A tile whose real roofline rises left-to-right (e.g. left of a peak).
    const rising = buildGablePanelMembers(WIDTH_IN, DEPTH_IN, LOW_EDGE_IN, HIGH_EDGE_IN, false);
    const risingStuds = rising.filter((m) => m.role === "stud");
    const risingLeftStud = risingStuds.find((m) => m.position.xIn === 0)!;
    const risingRightStud = risingStuds.find((m) => m.position.xIn === WIDTH_IN - 1.5)!;
    expect(risingLeftStud.actualDimsIn.lengthIn).toBeCloseTo(LOW_EDGE_IN - 1.5, 6);
    expect(risingRightStud.actualDimsIn.lengthIn).toBeCloseTo(HIGH_EDGE_IN - 1.5, 6);

    // The mirrored tile — real roofline falls left-to-right (e.g. right of
    // the same peak) — must have the TALL stud on its own left now, not
    // still on the right, or the panel renders backwards once placed at
    // its own real (mirrored) world position.
    const falling = buildGablePanelMembers(WIDTH_IN, DEPTH_IN, HIGH_EDGE_IN, LOW_EDGE_IN, false);
    const fallingStuds = falling.filter((m) => m.role === "stud");
    const fallingLeftStud = fallingStuds.find((m) => m.position.xIn === 0)!;
    const fallingRightStud = fallingStuds.find((m) => m.position.xIn === WIDTH_IN - 1.5)!;
    expect(fallingLeftStud.actualDimsIn.lengthIn).toBeCloseTo(HIGH_EDGE_IN - 1.5, 6);
    expect(fallingRightStud.actualDimsIn.lengthIn).toBeCloseTo(LOW_EDGE_IN - 1.5, 6);
  });

  it("throws if either edge's height exceeds the 8ft (96in) max a single Gable End Panel can be built at, regardless of side", () => {
    expect(() => buildGablePanelMembers(WIDTH_IN, DEPTH_IN, 0, GABLE_PANEL_MAX_HEIGHT_IN, false)).not.toThrow();
    expect(() => buildGablePanelMembers(WIDTH_IN, DEPTH_IN, 0, GABLE_PANEL_MAX_HEIGHT_IN + 0.01, false)).toThrow();
    expect(() => buildGablePanelMembers(WIDTH_IN, DEPTH_IN, GABLE_PANEL_MAX_HEIGHT_IN + 0.01, 0, false)).toThrow();
  });

  it("keeps the bottom skin/plates flat and unaffected by the slope", () => {
    const members = buildGablePanelMembers(WIDTH_IN, DEPTH_IN, LOW_EDGE_IN, HIGH_EDGE_IN, false);
    const bottomSkin = members.find((m) => m.memberId === "bottom_plate_skin")!;
    expect(bottomSkin.orientation).toBe("flat");
    expect(bottomSkin.actualDimsIn).toEqual({ thicknessIn: 0.75, widthIn: DEPTH_IN, lengthIn: WIDTH_IN });
    expect(bottomSkin.position).toEqual({ xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0 });

    const bottomExt = members.find((m) => m.memberId === "bottom_plate_2x4_ext")!;
    expect(bottomExt.orientation).toBe("flat");
    expect(bottomExt.actualDimsIn.lengthIn).toBeCloseTo(WIDTH_IN - 3, 6);
  });

  it("gives the low-edge and high-edge corner stud pairs their own distinct heights", () => {
    const members = buildGablePanelMembers(WIDTH_IN, DEPTH_IN, LOW_EDGE_IN, HIGH_EDGE_IN, false);
    const studs = members.filter((m) => m.role === "stud");
    expect(studs).toHaveLength(4);
    const lowStuds = studs.filter((m) => m.position.xIn === 0);
    const highStuds = studs.filter((m) => m.position.xIn === WIDTH_IN - 1.5);
    expect(lowStuds).toHaveLength(2);
    expect(highStuds).toHaveLength(2);
    for (const s of lowStuds) expect(s.actualDimsIn.lengthIn).toBeCloseTo(LOW_EDGE_IN - 1.5, 6);
    for (const s of highStuds) expect(s.actualDimsIn.lengthIn).toBeCloseTo(HIGH_EDGE_IN - 1.5, 6);
  });

  it("runs the top plate 2x4s and top skin the full sloped rip length as tilted (diagonal) members", () => {
    const members = buildGablePanelMembers(WIDTH_IN, DEPTH_IN, LOW_EDGE_IN, HIGH_EDGE_IN, false);
    const { lengthIn: ripLengthIn } = computeGableRipCallout(WIDTH_IN, LOW_EDGE_IN, HIGH_EDGE_IN);

    const topSkin = members.find((m) => m.memberId === "top_plate_skin")!;
    expect(topSkin.orientation).toBe("diagonal");
    expect(topSkin.position.tiltDeg).toBeDefined();
    expect(topSkin.actualDimsIn.lengthIn).toBeCloseTo(ripLengthIn, 6);
    expect(topSkin.actualDimsIn.widthIn).toBeCloseTo(DEPTH_IN, 6); // spans full depth
    expect(topSkin.notes).toContain("Rip at");

    const topPlateExt = members.find((m) => m.memberId === "top_plate_2x4_ext")!;
    expect(topPlateExt.orientation).toBe("diagonal");
    expect(topPlateExt.actualDimsIn.thicknessIn).toBeCloseTo(1.5, 6);
    expect(topPlateExt.actualDimsIn.widthIn).toBeCloseTo(3.5, 6);
    // Plate's own length is close to (but not exactly) the full-width rip
    // length, since it's inset by the end clearance on each side.
    expect(topPlateExt.actualDimsIn.lengthIn).toBeLessThan(ripLengthIn);
    expect(topPlateExt.actualDimsIn.lengthIn).toBeGreaterThan(ripLengthIn - 6);
  });

  it("round-trips the top skin's tilt back to its known low/high edge endpoints", () => {
    const members = buildGablePanelMembers(WIDTH_IN, DEPTH_IN, LOW_EDGE_IN, HIGH_EDGE_IN, false);
    const topSkin = members.find((m) => m.memberId === "top_plate_skin")!;
    const size = memberBoxSizeIn(topSkin);
    const tiltRad = (topSkin.position.tiltDeg! * Math.PI) / 180;
    const halfLen = size.zIn / 2;
    const lowX = topSkin.position.xIn + -Math.sin(tiltRad) * halfLen;
    const lowZ = topSkin.position.zIn + Math.cos(tiltRad) * halfLen;
    expect(lowX).toBeCloseTo(0, 4);
    expect(lowZ).toBeCloseTo(LOW_EDGE_IN - 0.375, 4); // center of the 0.75in-thick skin at the low edge
  });

  it("adds W-truss web bracing on both wythes, following the sloped top plate", () => {
    const members = buildGablePanelMembers(WIDTH_IN, DEPTH_IN, LOW_EDGE_IN, HIGH_EDGE_IN, false);
    const braces = members.filter((m) => m.role === "brace");
    expect(braces.length).toBeGreaterThan(0);
    expect(braces.length % 4).toBe(0); // (rise+fall) x (ext+int) per peak

    const ext = braces.filter((m) => m.memberId.includes("_ext_"));
    const int = braces.filter((m) => m.memberId.includes("_int_"));
    expect(ext.length).toBe(int.length);
    expect(ext.length).toBeGreaterThan(0);
    for (const b of ext) expect(b.position.yIn).toBeCloseTo(0.75, 6);
    for (const b of int) expect(b.position.yIn).toBeCloseTo(DEPTH_IN - 0.75, 6);

    // A wide, short gable forces multiple peaks — peaks nearer the high
    // edge should sit higher than peaks nearer the low edge.
    const wideMembers = buildGablePanelMembers(400, DEPTH_IN, 20, 40, false);
    const wideExt = wideMembers.filter((m) => m.role === "brace" && m.memberId.includes("_ext_"));
    const rises = wideExt.filter((m) => m.memberId.includes("_rise"));
    expect(rises.length).toBeGreaterThan(1);
    const firstRise = rises.find((m) => m.memberId.endsWith("_1_rise"))!;
    const lastRise = [...rises].sort((a, b) => a.position.xIn - b.position.xIn).at(-1)!;
    expect(lastRise.position.zIn).toBeGreaterThan(firstRise.position.zIn);
  });

  it("bases girt rows and the optional nailer on the low edge's stud span", () => {
    const withoutNailer = buildGablePanelMembers(WIDTH_IN, DEPTH_IN, LOW_EDGE_IN, HIGH_EDGE_IN, false);
    expect(withoutNailer.some((m) => m.role === "nailer")).toBe(false);
    expect(withoutNailer.filter((m) => m.role === "girt")).toHaveLength(4); // 2 rows x 2 bars

    const withNailer = buildGablePanelMembers(WIDTH_IN, DEPTH_IN, LOW_EDGE_IN, HIGH_EDGE_IN, true);
    const nailer = withNailer.find((m) => m.role === "nailer")!;
    expect(nailer).toBeDefined();
    expect(nailer.actualDimsIn.lengthIn).toBeLessThan(LOW_EDGE_IN);
  });
});

describe("buildGablePanelSchema", () => {
  it("uses the HIGH edge height as the overall envelope height", () => {
    const schema = buildGablePanelSchema(WIDTH_IN, DEPTH_IN, LOW_EDGE_IN, HIGH_EDGE_IN, false);
    expect(schema.id).toBe("gable_panel");
    expect(schema.overallDimensions.heightIn).toBe(HIGH_EDGE_IN);
    expect(schema.members.length).toBeGreaterThan(0);
    expect(schema.notes.some((n) => n.text.includes("rip"))).toBe(true);
  });
});
