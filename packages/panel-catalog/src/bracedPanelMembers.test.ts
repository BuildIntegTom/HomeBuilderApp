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

  it("adds 2 more rows (staying odd) once a bay would exceed 36in", () => {
    // 200in span / 4 bays = 50in (>36) -> needs more rows.
    const rows = computeBracedGirtRowCount(200);
    expect(rows).toBeGreaterThan(3);
    expect(rows % 2).toBe(1); // always odd — a true middle row must exist
    expect(200 / (rows + 1)).toBeLessThanOrEqual(36);
    // 2 fewer rows would have exceeded 36in (confirms it's the minimum odd count).
    expect(200 / (rows - 1)).toBeGreaterThan(36);
  });
});

describe("buildDiagonalBraces", () => {
  const studSpanIn = HEIGHT_IN - 1.5; // 2*0.75
  const rowCount = 3;
  // Middle row (row 2 of 3) center Z, then its (now-rotated, 1.5in-thick) bar's top/bottom faces.
  const middleCenterZ = 0.75 + (studSpanIn * 2) / 4;
  const middleBarTopZ = middleCenterZ + 0.75;
  const middleBarBottomZ = middleCenterZ - 0.75;
  const studFaceX = 1.5; // PLATE_2X4_THICKNESS_IN — both braces' inner nose, flush to the left stud
  const barRightX = WIDTH_IN - 3; // barRightXIn — outer (plate-side) nose, near the right stud
  const topPlateZ = HEIGHT_IN - 0.75 - 1.5;
  const bottomPlateZ = 0.75 + 1.5; // top face of the bottom plate (mirrors topPlateZ's underside of the top plate)

  it("returns 4 braces (upper+lower per wythe), all rotated 90deg", () => {
    const braces = buildDiagonalBraces(WIDTH_IN, DEPTH_IN, HEIGHT_IN, rowCount, studSpanIn);
    expect(braces).toHaveLength(4);
    for (const brace of braces) {
      expect(brace.orientation).toBe("diagonal");
      expect(brace.position.rotationDeg).toBe(90);
      expect(brace.position.tiltDeg).toBeDefined();
      expect(brace.actualDimsIn.thicknessIn).toBeCloseTo(1.5, 6);
      expect(brace.actualDimsIn.widthIn).toBeCloseTo(3.5, 6);
    }
  });

  it("confines the ext-wythe pair to the exterior 1.5in slice and the int-wythe pair to the interior 1.5in slice", () => {
    const braces = buildDiagonalBraces(WIDTH_IN, DEPTH_IN, HEIGHT_IN, rowCount, studSpanIn);
    const ext = braces.filter((b) => b.memberId.endsWith("_ext"));
    const int = braces.filter((b) => b.memberId.endsWith("_int"));
    expect(ext).toHaveLength(2);
    expect(int).toHaveLength(2);
    for (const b of ext) expect(b.position.yIn).toBeCloseTo(0.75, 6);
    for (const b of int) expect(b.position.yIn).toBeCloseTo(DEPTH_IN - 0.75, 6);
  });

  it("swaps X/Y in memberBoxSizeIn for the rotated brace (wide face now on X, thin face on Y)", () => {
    const [upper] = buildDiagonalBraces(WIDTH_IN, DEPTH_IN, HEIGHT_IN, rowCount, studSpanIn);
    const size = memberBoxSizeIn(upper!);
    expect(size.xIn).toBeCloseTo(3.5, 6); // widthIn -> X
    expect(size.yIn).toBeCloseTo(1.5, 6); // thicknessIn -> Y
    expect(size.zIn).toBeCloseTo(upper!.actualDimsIn.lengthIn, 6);
  });

  it("the 2 braces (per wythe) land on either side of the middle girt bar vertically, both flush to the same stud face", () => {
    const braces = buildDiagonalBraces(WIDTH_IN, DEPTH_IN, HEIGHT_IN, rowCount, studSpanIn);
    const [upperExt, lowerExt] = braces.filter((b) => b.memberId.endsWith("_ext"));

    function endpoints(brace: NonNullable<typeof upperExt>) {
      const size = memberBoxSizeIn(brace);
      const tiltRad = (brace.position.tiltDeg! * Math.PI) / 180;
      const halfLen = size.zIn / 2;
      return {
        a: { x: brace.position.xIn + -Math.sin(tiltRad) * halfLen, z: brace.position.zIn + Math.cos(tiltRad) * halfLen },
        b: { x: brace.position.xIn - -Math.sin(tiltRad) * halfLen, z: brace.position.zIn - Math.cos(tiltRad) * halfLen },
      };
    }

    const upperEnds = endpoints(upperExt!);
    const lowerEnds = endpoints(lowerExt!);

    // Upper brace's inner nose lands on the (now-rotated, thin) girt bar's TOP face; lower brace's on
    // its BOTTOM face — both at the SAME X (flush to the left stud), flanking the bar vertically
    // instead of pinching to one exact point.
    const nearTopFace = (p: { x: number; z: number }) => Math.abs(p.x - studFaceX) < 1e-4 && Math.abs(p.z - middleBarTopZ) < 1e-4;
    const nearBottomFace = (p: { x: number; z: number }) => Math.abs(p.x - studFaceX) < 1e-4 && Math.abs(p.z - middleBarBottomZ) < 1e-4;
    expect(nearTopFace(upperEnds.a) || nearTopFace(upperEnds.b)).toBe(true);
    expect(nearBottomFace(lowerEnds.a) || nearBottomFace(lowerEnds.b)).toBe(true);
    // Confirms they're genuinely offset from each other in Z, not coincident.
    expect(nearTopFace(lowerEnds.a) || nearTopFace(lowerEnds.b)).toBe(false);
    expect(nearBottomFace(upperEnds.a) || nearBottomFace(upperEnds.b)).toBe(false);

    // The other endpoint of each brace is at the right stud, flush with the top plate's underside /
    // bottom plate's top face respectively (equidistant from the girt's center — true mirror images).
    const nearTopRight = (p: { x: number; z: number }) => Math.abs(p.x - barRightX) < 1e-4 && Math.abs(p.z - topPlateZ) < 1e-4;
    const nearBottomRight = (p: { x: number; z: number }) => Math.abs(p.x - barRightX) < 1e-4 && Math.abs(p.z - bottomPlateZ) < 1e-4;
    expect(nearTopRight(upperEnds.a) || nearTopRight(upperEnds.b)).toBe(true);
    expect(nearBottomRight(lowerEnds.a) || nearBottomRight(lowerEnds.b)).toBe(true);
    expect(topPlateZ - middleCenterZ).toBeCloseTo(middleCenterZ - bottomPlateZ, 6); // symmetric rise/fall
  });
});

describe("buildBracedPanelMembers", () => {
  it("shares skins/plates/studs with the standard panel, but uses 3+ girt rows and adds 4 diagonal braces (both wythes)", () => {
    const members = buildBracedPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false);
    expect(members.find((m) => m.memberId === "bottom_plate_skin")).toBeDefined();
    expect(members.filter((m) => m.role === "stud")).toHaveLength(4);
    const girtRows = new Set(members.filter((m) => m.role === "girt").map((m) => m.memberId.split("_")[1]));
    expect(girtRows.size).toBe(3); // 3 rows at this height
    expect(members.filter((m) => m.role === "girt_web")).toHaveLength(3);
    expect(members.filter((m) => m.role === "brace")).toHaveLength(4);
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

  it("reports a real bevel-cut angle for the diagonal braces' ends", () => {
    const schema = buildBracedPanelSchema(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false);
    expect(schema.notes.some((n) => n.type === "deviation" && n.text.includes("deg off a square crosscut"))).toBe(true);
  });
});
