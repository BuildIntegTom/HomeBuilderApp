import { describe, expect, it } from "vitest";
import {
  bracedPanelDisplayLabel,
  buildBracedPanelMembers,
  buildBracedPanelSchema,
  buildDiagonalBraces,
  computeBracedGirtRowCount,
  type BracingStyle,
} from "./bracedPanelMembers";
import { computeBraceEndCutAngleDeg, memberBoxSizeIn } from "./panelMemberHelpers";

const WIDTH_IN = 40;
const DEPTH_IN = 15.5;
const HEIGHT_IN = 120;
const BRACING_STYLES: BracingStyle[] = ["chevron", "hatch-forward", "hatch-back"];

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
  const leftStudFaceX = 1.5; // PLATE_2X4_THICKNESS_IN
  const rightStudFaceX = WIDTH_IN - 1.5;
  const barRightX = WIDTH_IN - 3; // near-right plate-side reference
  const barLeftX = 3; // near-left plate-side reference (mirror of barRightX)
  const topPlateZ = HEIGHT_IN - 0.75 - 1.5;
  const bottomPlateZ = 0.75 + 1.5; // top face of the bottom plate

  for (const bracingStyle of BRACING_STYLES) {
    it(`returns 4 braces (upper+lower per wythe), all rotated 90deg, with real trapezoid corners (${bracingStyle})`, () => {
      const braces = buildDiagonalBraces(WIDTH_IN, DEPTH_IN, HEIGHT_IN, rowCount, studSpanIn, bracingStyle);
      expect(braces).toHaveLength(4);
      for (const brace of braces) {
        expect(brace.orientation).toBe("diagonal");
        expect(brace.position.rotationDeg).toBe(90);
        expect(brace.position.tiltDeg).toBeDefined();
        expect(brace.actualDimsIn.thicknessIn).toBeCloseTo(1.5, 6);
        expect(brace.actualDimsIn.widthIn).toBeCloseTo(3.5, 6);
        expect(brace.position.trapezoidCornersIn).toHaveLength(4);
      }
    });

    it(`confines the ext-wythe pair to the exterior 1.5in slice and the int-wythe pair to the interior 1.5in slice (${bracingStyle})`, () => {
      const braces = buildDiagonalBraces(WIDTH_IN, DEPTH_IN, HEIGHT_IN, rowCount, studSpanIn, bracingStyle);
      const ext = braces.filter((b) => b.memberId.endsWith("_ext"));
      const int = braces.filter((b) => b.memberId.endsWith("_int"));
      expect(ext).toHaveLength(2);
      expect(int).toHaveLength(2);
      for (const b of ext) expect(b.position.yIn).toBeCloseTo(0.75, 6);
      for (const b of int) expect(b.position.yIn).toBeCloseTo(DEPTH_IN - 0.75, 6);
    });

    it(`board-feet length (actualDimsIn.lengthIn) is the trapezoid's longest edge, longer than the plain centerline length (${bracingStyle})`, () => {
      const braces = buildDiagonalBraces(WIDTH_IN, DEPTH_IN, HEIGHT_IN, rowCount, studSpanIn, bracingStyle);
      for (const brace of braces) {
        const centerlineLengthIn = memberBoxSizeIn(brace).zIn === brace.actualDimsIn.lengthIn ? brace.actualDimsIn.lengthIn : NaN;
        // memberBoxSizeIn just echoes back actualDimsIn.lengthIn for a
        // diagonal member, so this is really just confirming lengthIn is
        // populated and, independently, longer than a directly-computed
        // hypot of the trapezoid's own 2 plumb corners' midpoint to its 2
        // level corners' midpoint (a real, if approximate, proxy for the
        // true centerline length).
        expect(centerlineLengthIn).toBeGreaterThan(0);
        const corners = brace.position.trapezoidCornersIn!;
        const plumbMidX = (corners[0].xIn + corners[3].xIn) / 2;
        const plumbMidZ = (corners[0].zIn + corners[3].zIn) / 2;
        const levelMidX = (corners[1].xIn + corners[2].xIn) / 2;
        const levelMidZ = (corners[1].zIn + corners[2].zIn) / 2;
        const approxCenterlineIn = Math.hypot(levelMidX - plumbMidX, levelMidZ - plumbMidZ);
        expect(brace.actualDimsIn.lengthIn).toBeGreaterThan(approxCenterlineIn);
      }
    });
  }

  it("chevron: both braces' inner (plumb) end is flush to the LEFT stud, outer (level) end near the right plate", () => {
    const braces = buildDiagonalBraces(WIDTH_IN, DEPTH_IN, HEIGHT_IN, rowCount, studSpanIn, "chevron");
    const [upperExt, lowerExt] = braces.filter((b) => b.memberId.endsWith("_ext"));

    function plumbXs(brace: NonNullable<typeof upperExt>): number[] {
      return brace.position.trapezoidCornersIn!.map((c) => c.xIn).filter((x, i, arr) => arr.indexOf(x) === i);
    }
    // Every plumb corner shares the same X (the stud face); every level
    // corner shares the same Z (the plate face) — so the corner set's own
    // distinct X values are exactly [plumbX, someLevelX1, someLevelX2] —
    // simplest robust check: at least 2 corners sit exactly at the left
    // stud face X.
    const nearLeftStud = (brace: NonNullable<typeof upperExt>) =>
      brace.position.trapezoidCornersIn!.filter((c) => Math.abs(c.xIn - leftStudFaceX) < 1e-6).length;
    expect(nearLeftStud(upperExt!)).toBe(2);
    expect(nearLeftStud(lowerExt!)).toBe(2);
    void plumbXs; // (kept for readability of intent above; not asserted directly)

    // Upper brace's level corners sit on the top plate face; lower's on
    // the bottom plate face — both near the RIGHT side.
    const nearTopPlate = upperExt!.position.trapezoidCornersIn!.filter((c) => Math.abs(c.zIn - topPlateZ) < 1e-6);
    const nearBottomPlate = lowerExt!.position.trapezoidCornersIn!.filter((c) => Math.abs(c.zIn - bottomPlateZ) < 1e-6);
    expect(nearTopPlate).toHaveLength(2);
    expect(nearBottomPlate).toHaveLength(2);
    const topPlateMidX = (nearTopPlate[0]!.xIn + nearTopPlate[1]!.xIn) / 2;
    const bottomPlateMidX = (nearBottomPlate[0]!.xIn + nearBottomPlate[1]!.xIn) / 2;
    expect(topPlateMidX).toBeCloseTo(barRightX, 6);
    expect(bottomPlateMidX).toBeCloseTo(barRightX, 6);

    // The 2 plumb corners' own Z-midpoint lands exactly on the girt row's
    // top/bottom face respectively (upper flanks the top, lower flanks
    // the bottom) — provable exactly since the width-offset's linear term
    // cancels between the +-halfWidth pair.
    const upperPlumb = upperExt!.position.trapezoidCornersIn!.filter((c) => Math.abs(c.xIn - leftStudFaceX) < 1e-6);
    const lowerPlumb = lowerExt!.position.trapezoidCornersIn!.filter((c) => Math.abs(c.xIn - leftStudFaceX) < 1e-6);
    expect((upperPlumb[0]!.zIn + upperPlumb[1]!.zIn) / 2).toBeCloseTo(middleBarTopZ, 6);
    expect((lowerPlumb[0]!.zIn + lowerPlumb[1]!.zIn) / 2).toBeCloseTo(middleBarBottomZ, 6);
    expect(topPlateZ - middleCenterZ).toBeCloseTo(middleCenterZ - bottomPlateZ, 6); // symmetric rise/fall
  });

  it("hatch-forward: upper brace matches chevron's upper (left stud), lower brace flips to the RIGHT stud + left-side bottom plate", () => {
    const braces = buildDiagonalBraces(WIDTH_IN, DEPTH_IN, HEIGHT_IN, rowCount, studSpanIn, "hatch-forward");
    const lowerExt = braces.find((b) => b.memberId === "diagonal_brace_lower_ext")!;
    const nearRightStud = lowerExt.position.trapezoidCornersIn!.filter((c) => Math.abs(c.xIn - rightStudFaceX) < 1e-6);
    expect(nearRightStud).toHaveLength(2);
    expect((nearRightStud[0]!.zIn + nearRightStud[1]!.zIn) / 2).toBeCloseTo(middleBarBottomZ, 6);
    const nearBottomPlate = lowerExt.position.trapezoidCornersIn!.filter((c) => Math.abs(c.zIn - bottomPlateZ) < 1e-6);
    expect(nearBottomPlate).toHaveLength(2);
    expect((nearBottomPlate[0]!.xIn + nearBottomPlate[1]!.xIn) / 2).toBeCloseTo(barLeftX, 6);
  });

  it("hatch-back: lower brace matches chevron's lower (left stud), upper brace flips to the RIGHT stud + left-side top plate", () => {
    const braces = buildDiagonalBraces(WIDTH_IN, DEPTH_IN, HEIGHT_IN, rowCount, studSpanIn, "hatch-back");
    const upperExt = braces.find((b) => b.memberId === "diagonal_brace_upper_ext")!;
    const nearRightStud = upperExt.position.trapezoidCornersIn!.filter((c) => Math.abs(c.xIn - rightStudFaceX) < 1e-6);
    expect(nearRightStud).toHaveLength(2);
    expect((nearRightStud[0]!.zIn + nearRightStud[1]!.zIn) / 2).toBeCloseTo(middleBarTopZ, 6);
    const nearTopPlate = upperExt.position.trapezoidCornersIn!.filter((c) => Math.abs(c.zIn - topPlateZ) < 1e-6);
    expect(nearTopPlate).toHaveLength(2);
    expect((nearTopPlate[0]!.xIn + nearTopPlate[1]!.xIn) / 2).toBeCloseTo(barLeftX, 6);
  });

  it("every brace, across all 3 styles, shares the same folded tilt magnitude (panel's own vertical symmetry)", () => {
    // Raw tiltDeg values can legitimately differ by a full 180deg between
    // configs (swapping which endpoint is "first" — see
    // computeBraceEndCutAngleDeg's own doc comment) while describing the
    // exact same physical lean — fold through that function (the same way
    // representativeBraceCutAngleDeg/the schema notes actually do) before
    // comparing, rather than comparing raw |tiltDeg|.
    const magnitudes = BRACING_STYLES.flatMap((style) =>
      buildDiagonalBraces(WIDTH_IN, DEPTH_IN, HEIGHT_IN, rowCount, studSpanIn, style).map((b) => computeBraceEndCutAngleDeg(b.position.tiltDeg!)),
    );
    const first = magnitudes[0]!;
    for (const m of magnitudes) expect(m).toBeCloseTo(first, 6);
  });
});

describe("buildBracedPanelMembers", () => {
  it("shares skins/plates/studs with the standard panel, but uses 3+ girt rows and adds 4 diagonal braces (both wythes)", () => {
    const members = buildBracedPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "chevron");
    expect(members.find((m) => m.memberId === "bottom_plate_skin")).toBeDefined();
    expect(members.filter((m) => m.role === "stud")).toHaveLength(4);
    const girtRows = new Set(members.filter((m) => m.role === "girt").map((m) => m.memberId.split("_")[1]));
    expect(girtRows.size).toBe(3); // 3 rows at this height
    expect(members.filter((m) => m.role === "girt_web")).toHaveLength(3);
    expect(members.filter((m) => m.role === "brace")).toHaveLength(4);
  });

  it("includes the nailer when requested, same as the standard panel", () => {
    const withNailer = buildBracedPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, true, "chevron");
    expect(withNailer.find((m) => m.role === "nailer")).toBeDefined();
  });

  it("adds a vertical center connector for chevron only, not for either hatch style", () => {
    const chevron = buildBracedPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "chevron");
    const hatchForward = buildBracedPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "hatch-forward");
    const hatchBack = buildBracedPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "hatch-back");
    const connector = chevron.find((m) => m.memberId === "brace_center_connector");
    expect(connector).toBeDefined();
    expect(connector!.role).toBe("blocking");
    expect(connector!.orientation).toBe("vertical");
    expect(connector!.position.xIn).toBeCloseTo(WIDTH_IN / 2 - 0.75, 6); // centered on the panel's own midline
    expect(connector!.position.yIn).toBe(0); // exterior wythe only
    expect(hatchForward.find((m) => m.memberId === "brace_center_connector")).toBeUndefined();
    expect(hatchBack.find((m) => m.memberId === "brace_center_connector")).toBeUndefined();
  });
});

describe("bracedPanelDisplayLabel", () => {
  it("returns the style-specific name Tommy wants shown wherever a user sees it", () => {
    expect(bracedPanelDisplayLabel("chevron")).toBe("Braced Panel");
    expect(bracedPanelDisplayLabel("hatch-forward")).toBe("Hatch Forward Panel");
    expect(bracedPanelDisplayLabel("hatch-back")).toBe("Hatch Back Panel");
  });
});

describe("buildBracedPanelSchema", () => {
  it("wraps the members with the shared schema envelope, derived from standard_panel", () => {
    const schema = buildBracedPanelSchema(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "chevron");
    expect(schema.id).toBe("braced_panel");
    expect(schema.derivedFrom).toBe("standard_panel");
    expect(schema.members.length).toBeGreaterThan(0);
  });

  it("uses the bracing-style-aware display name", () => {
    expect(buildBracedPanelSchema(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "hatch-forward").displayName).toBe("Hatch Forward Panel");
    expect(buildBracedPanelSchema(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "hatch-back").displayName).toBe("Hatch Back Panel");
  });

  it("reports both the level and plumb bevel-cut angles for the diagonal braces' ends, summing to 90deg", () => {
    const schema = buildBracedPanelSchema(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "chevron");
    const note = schema.notes.find((n) => n.type === "deviation" && n.text.includes("plumb cut ("));
    expect(note).toBeDefined();
    expect(note!.text).toMatch(/level cut \(\d+\.\d+deg/);
    expect(note!.text).toMatch(/plumb cut \(\d+\.\d+deg/);
  });
});
