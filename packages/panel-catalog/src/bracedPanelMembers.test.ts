import { describe, expect, it } from "vitest";
import { buildBracedPanelMembers, buildBracedPanelSchema, buildDiagonalBraces, computeBracedGirtRowCount } from "./bracedPanelMembers";
import { memberBoxSizeIn } from "./panelMemberHelpers";

const WIDTH_IN = 40;
const DEPTH_IN = 15.5;
const HEIGHT_IN = 120;

describe("computeBracedGirtRowCount", () => {
  it("uses 3 rows when 4 evenly-split bays already fit under 36in", () => {
    // studSpan for a 120in-tall panel = 118.5; 4 bays = 29.625in each, under 36.
    expect(computeBracedGirtRowCount(118.5)).toBe(3);
  });

  it("adds another row once a bay would exceed 36in", () => {
    // A very tall span where 4 bays (118.5*... ) would exceed 36in each.
    // 200in span / 4 bays = 50in (>36) -> needs more rows.
    const rows = computeBracedGirtRowCount(200);
    expect(rows).toBeGreaterThan(3);
    expect(200 / (rows + 1)).toBeLessThanOrEqual(36);
    // One fewer row would have exceeded 36in (confirms it's the minimum).
    expect(200 / rows).toBeGreaterThan(36);
  });
});

describe("buildDiagonalBraces", () => {
  const studSpanIn = HEIGHT_IN - 1.5; // 2*0.75
  const rowCount = 3;
  // Middle row (row 2 of 3) center Z, then its bar's top.
  const middleCenterZ = 0.75 + (studSpanIn * 2) / 4;
  const middleBarTopZ = middleCenterZ + 1.75;
  const barLeftX = 1.5; // PLATE_2X4_THICKNESS_IN
  const barRightX = WIDTH_IN - 3; // barRightXIn
  const topPlateZ = HEIGHT_IN - 0.75 - 1.5;
  const bottomPlateZ = 0.75;

  it("returns exactly 2 braces, both rotated 90deg and confined to the exterior wythe's last 1.5in", () => {
    const [upper, lower] = buildDiagonalBraces(WIDTH_IN, HEIGHT_IN, rowCount, studSpanIn);
    for (const brace of [upper, lower]) {
      expect(brace.orientation).toBe("diagonal");
      expect(brace.position.rotationDeg).toBe(90);
      expect(brace.position.tiltDeg).toBeDefined();
      expect(brace.actualDimsIn.thicknessIn).toBeCloseTo(1.5, 6);
      expect(brace.actualDimsIn.widthIn).toBeCloseTo(3.5, 6);
      // Centered within Y=0..1.5in (exterior wythe), not mid-depth.
      expect(brace.position.yIn).toBeCloseTo(0.75, 6);
    }
  });

  it("swaps X/Y in memberBoxSizeIn for the rotated brace (wide face now on X, thin face on Y)", () => {
    const [upper] = buildDiagonalBraces(WIDTH_IN, HEIGHT_IN, rowCount, studSpanIn);
    const size = memberBoxSizeIn(upper);
    expect(size.xIn).toBeCloseTo(3.5, 6); // widthIn -> X
    expect(size.yIn).toBeCloseTo(1.5, 6); // thicknessIn -> Y
    expect(size.zIn).toBeCloseTo(upper.actualDimsIn.lengthIn, 6);
  });

  it("upper brace: top flush with the top plate at the left stud, bottom nose at the middle row's right bar/stud junction", () => {
    const [upper] = buildDiagonalBraces(WIDTH_IN, HEIGHT_IN, rowCount, studSpanIn);
    expect(upper.position.xIn).toBeCloseTo((barLeftX + barRightX) / 2, 6);
    expect(upper.position.zIn).toBeCloseTo((topPlateZ + middleBarTopZ) / 2, 6);
    expect(upper.actualDimsIn.lengthIn).toBeCloseTo(Math.hypot(barRightX - barLeftX, middleBarTopZ - topPlateZ), 6);
  });

  it("lower brace (mirrored): top nose at the middle row's left bar/stud junction, bottom flush with the bottom plate at the right stud", () => {
    const [, lower] = buildDiagonalBraces(WIDTH_IN, HEIGHT_IN, rowCount, studSpanIn);
    expect(lower.position.xIn).toBeCloseTo((barLeftX + barRightX) / 2, 6);
    expect(lower.position.zIn).toBeCloseTo((middleBarTopZ + bottomPlateZ) / 2, 6);
    expect(lower.actualDimsIn.lengthIn).toBeCloseTo(Math.hypot(barRightX - barLeftX, bottomPlateZ - middleBarTopZ), 6);
  });

  it("keeps each brace's computed endpoints reachable via its center + tilt (round-trips back to its own top/bottom points)", () => {
    const [upper, lower] = buildDiagonalBraces(WIDTH_IN, HEIGHT_IN, rowCount, studSpanIn);

    function topEndpoint(brace: (typeof upper)) {
      const size = memberBoxSizeIn(brace);
      const tiltRad = (brace.position.tiltDeg! * Math.PI) / 180;
      const halfLen = size.zIn / 2;
      return {
        x: brace.position.xIn + -Math.sin(tiltRad) * halfLen,
        z: brace.position.zIn + Math.cos(tiltRad) * halfLen,
      };
    }

    const upperTop = topEndpoint(upper);
    expect(upperTop.x).toBeCloseTo(barLeftX, 4);
    expect(upperTop.z).toBeCloseTo(topPlateZ, 4);

    const lowerTop = topEndpoint(lower);
    expect(lowerTop.x).toBeCloseTo(barLeftX, 4);
    expect(lowerTop.z).toBeCloseTo(middleBarTopZ, 4);
  });
});

describe("buildBracedPanelMembers", () => {
  it("shares skins/plates/studs with the standard panel, but uses 3+ girt rows and adds 2 diagonal braces", () => {
    const members = buildBracedPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false);
    expect(members.find((m) => m.memberId === "bottom_plate_skin")).toBeDefined();
    expect(members.filter((m) => m.role === "stud")).toHaveLength(4);
    const girtRows = new Set(members.filter((m) => m.role === "girt").map((m) => m.memberId.split("_")[1]));
    expect(girtRows.size).toBe(3); // 3 rows at this height
    expect(members.filter((m) => m.role === "girt_web")).toHaveLength(3);
    expect(members.filter((m) => m.role === "brace")).toHaveLength(2);
  });

  it("includes the nailer when requested, same as the standard panel", () => {
    const withNailer = buildBracedPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, true);
    expect(withNailer.find((m) => m.role === "nailer")).toBeDefined();
  });
});

describe("buildBracedPanelSchema", () => {
  it("wraps the members with the shared schema envelope, derived from standard_panel", () => {
    const schema = buildBracedPanelSchema(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false);
    expect(schema.id).toBe("braced_panel");
    expect(schema.derivedFrom).toBe("standard_panel");
    expect(schema.members.length).toBeGreaterThan(0);
  });
});
