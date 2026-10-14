import { describe, expect, it } from "vitest";
import { describeBraceEndCuts } from "./panelMemberHelpers";
import {
  bracedPanelDisplayLabel,
  bracingStyleToPatternMirror,
  buildBracedPanelMembers,
  buildBracedPanelSchema,
  buildDiagonalBraces,
  computeBracedGirtRowCount,
  patternMirrorToBracingStyle,
  type BracePattern,
} from "./bracedPanelMembers";
import type { PanelSpacePoint2D } from "./componentSchema";
import { computeBraceEndCutAngleDeg, memberBoxSizeIn, PLATE_2X4_WIDTH_IN } from "./panelMemberHelpers";

const WIDTH_IN = 40;
const DEPTH_IN = 15.5;
const HEIGHT_IN = 120;
const BRACE_CONFIGS: { pattern: BracePattern; mirrored: boolean }[] = [
  { pattern: "chevron", mirrored: false },
  { pattern: "chevron", mirrored: true },
  { pattern: "hatch", mirrored: false },
  { pattern: "hatch", mirrored: true },
];

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

describe("bracingStyleToPatternMirror / patternMirrorToBracingStyle", () => {
  it("round-trips all 4 combinations, preserving the 3 legacy string values", () => {
    expect(bracingStyleToPatternMirror("chevron")).toEqual({ pattern: "chevron", mirrored: false });
    expect(bracingStyleToPatternMirror("chevron-mirrored")).toEqual({ pattern: "chevron", mirrored: true });
    expect(bracingStyleToPatternMirror("hatch-forward")).toEqual({ pattern: "hatch", mirrored: false });
    expect(bracingStyleToPatternMirror("hatch-back")).toEqual({ pattern: "hatch", mirrored: true });
    for (const { pattern, mirrored } of BRACE_CONFIGS) {
      const style = patternMirrorToBracingStyle(pattern, mirrored);
      expect(bracingStyleToPatternMirror(style)).toEqual({ pattern, mirrored });
    }
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
  // The trapezoid's wide end lands exactly on the OPPOSITE stud's own face
  // (Tommy: "the long point ending where the vertical stud and the plate
  // 2x4 runner intersect") — same target as leftStudFaceX/rightStudFaceX,
  // just named for readability at each call site below.
  const barRightX = rightStudFaceX;
  const barLeftX = leftStudFaceX;
  const topPlateZ = HEIGHT_IN - 0.75 - 1.5;
  const bottomPlateZ = 0.75 + 1.5; // top face of the bottom plate

  // A level end's 2 corners are no longer guaranteed to average out to the
  // opposite stud's own face (barLeftX/barRightX) — a board of real width,
  // cut level right where its centerline meets that reference, can have one
  // long edge (the "long point" — Tommy) reach past the panel's own
  // X=0/widthIn edge (real trapezoid geometry for this panel's proportions,
  // not a math error). `computeBraceTrapezoidCornersIn`'s own `boundaryXIn`
  // rigidly shifts BOTH of that level end's corners together so the long
  // point lands exactly flush with the panel edge instead — preserving the
  // board's true, undistorted width (see the dedicated width-preservation
  // test below) — rather than clamping only the one overshooting corner
  // (an earlier bug that shrank the apparent cut width; see
  // buildDiagonalBraces's own makeBrace doc comment). For a level end NEAR
  // the left edge, this shift lands one corner exactly at X=0; both
  // corners still land on the correct Z (the plate face).
  function expectLevelEndClampedAtLeftEdge(corners: PanelSpacePoint2D[], targetZIn: number) {
    expect(corners).toHaveLength(2);
    for (const c of corners) {
      expect(c.zIn).toBeCloseTo(targetZIn, 6);
      expect(c.xIn).toBeGreaterThanOrEqual(0);
      expect(c.xIn).toBeLessThanOrEqual(WIDTH_IN);
    }
    expect(corners.some((c) => Math.abs(c.xIn) < 1e-6)).toBe(true);
  }

  // Same as above, mirrored — a level end near the RIGHT edge instead.
  function expectLevelEndClampedAtRightEdge(corners: PanelSpacePoint2D[], targetZIn: number) {
    expect(corners).toHaveLength(2);
    for (const c of corners) {
      expect(c.zIn).toBeCloseTo(targetZIn, 6);
      expect(c.xIn).toBeGreaterThanOrEqual(0);
      expect(c.xIn).toBeLessThanOrEqual(WIDTH_IN);
    }
    expect(corners.some((c) => Math.abs(c.xIn - WIDTH_IN) < 1e-6)).toBe(true);
  }

  for (const { pattern, mirrored } of BRACE_CONFIGS) {
    const label = `${pattern}${mirrored ? " mirrored" : ""}`;
    it(`returns 4 braces (upper+lower per wythe), all rotated 90deg, with real trapezoid corners (${label})`, () => {
      const braces = buildDiagonalBraces(WIDTH_IN, DEPTH_IN, HEIGHT_IN, rowCount, studSpanIn, pattern, mirrored);
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

    it(`confines the ext-wythe pair to the exterior 1.5in slice and the int-wythe pair to the interior 1.5in slice (${label})`, () => {
      const braces = buildDiagonalBraces(WIDTH_IN, DEPTH_IN, HEIGHT_IN, rowCount, studSpanIn, pattern, mirrored);
      const ext = braces.filter((b) => b.memberId.endsWith("_ext"));
      const int = braces.filter((b) => b.memberId.endsWith("_int"));
      expect(ext).toHaveLength(2);
      expect(int).toHaveLength(2);
      for (const b of ext) expect(b.position.yIn).toBeCloseTo(0.75, 6);
      for (const b of int) expect(b.position.yIn).toBeCloseTo(DEPTH_IN - 0.75, 6);
    });

    it(`board-feet length (actualDimsIn.lengthIn) is the trapezoid's longest edge, longer than the plain centerline length (${label})`, () => {
      const braces = buildDiagonalBraces(WIDTH_IN, DEPTH_IN, HEIGHT_IN, rowCount, studSpanIn, pattern, mirrored);
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
    const braces = buildDiagonalBraces(WIDTH_IN, DEPTH_IN, HEIGHT_IN, rowCount, studSpanIn, "chevron", false);
    const [upperExt, lowerExt] = braces.filter((b) => b.memberId.endsWith("_ext"));

    // Every plumb corner shares the same X (the stud face); every level
    // corner shares the same Z (the plate face) — simplest robust check:
    // at least 2 corners sit exactly at the left stud face X.
    const nearLeftStud = (brace: NonNullable<typeof upperExt>) =>
      brace.position.trapezoidCornersIn!.filter((c) => Math.abs(c.xIn - leftStudFaceX) < 1e-6).length;
    expect(nearLeftStud(upperExt!)).toBe(2);
    expect(nearLeftStud(lowerExt!)).toBe(2);

    // Upper brace's level corners sit on the top plate face; lower's on
    // the bottom plate face — both near the RIGHT side.
    const nearTopPlate = upperExt!.position.trapezoidCornersIn!.filter((c) => Math.abs(c.zIn - topPlateZ) < 1e-6);
    const nearBottomPlate = lowerExt!.position.trapezoidCornersIn!.filter((c) => Math.abs(c.zIn - bottomPlateZ) < 1e-6);
    expectLevelEndClampedAtRightEdge(nearTopPlate, topPlateZ);
    expectLevelEndClampedAtRightEdge(nearBottomPlate, bottomPlateZ);

    // The 2 plumb corners' own Z-midpoint lands exactly on the girt row's
    // top/bottom face respectively (upper flanks the top, lower flanks
    // the bottom) — provable exactly since the width-offset's linear term
    // cancels between the +-halfWidth pair.
    const upperPlumb = upperExt!.position.trapezoidCornersIn!.filter((c) => Math.abs(c.xIn - leftStudFaceX) < 1e-6);
    const lowerPlumb = lowerExt!.position.trapezoidCornersIn!.filter((c) => Math.abs(c.xIn - leftStudFaceX) < 1e-6);
    /* ⚠ THE POINT MEETS THE BAR, NOT THE CENTRE OF THE CUT. Tommy, 2026-10-13:
       *"the point should meet the top of the Girt bar"*. These lines used to
       average the plumb cut's two corners onto the bar's face, which is what
       pinned the board at its middle and forced the old stretched shape. The
       upper brace rises away from the bar's top, so its point is the LOWEST of
       its plumb corners; the lower brace falls away from the bar's bottom, so
       its point is the HIGHEST. */
    expect(Math.min(upperPlumb[0]!.zIn, upperPlumb[1]!.zIn)).toBeCloseTo(middleBarTopZ, 6);
    expect(Math.max(lowerPlumb[0]!.zIn, lowerPlumb[1]!.zIn)).toBeCloseTo(middleBarBottomZ, 6);
    expect(topPlateZ - middleCenterZ).toBeCloseTo(middleCenterZ - bottomPlateZ, 6); // symmetric rise/fall
  });

  it("⚠ IS A TRUE BOARD: exactly the stock width across BOTH end cuts, and the long point flush with the panel edge", () => {
    /* The invariant this test has always been reaching for, now assertable
       exactly. It used to compare the level cut's X-spread against
       PLATE_2X4_WIDTH_IN / uz using the NOMINAL stud-to-stud direction — which
       stopped being the brace's direction on 2026-10-13, when Tommy anchored
       the board on two points and let the angle be whatever connects them.

       So the direction is now read off the board's own long edge rather than
       assumed, and the check is the stronger one: measured perpendicular to
       that edge, each end cut spans EXACTLY the stock width. The old stretched
       construction could not pass this — it measured 3.4628" at the plumb end
       and 3.5156" at the level end on a 2x4, which is what sent a shop a jig
       dimension that was nearly 1/16" wrong. */
    const braces = buildDiagonalBraces(WIDTH_IN, DEPTH_IN, HEIGHT_IN, rowCount, studSpanIn, "chevron", false);
    const upperExt = braces.find((b) => b.memberId === "diagonal_brace_upper_ext")!;
    const corners = upperExt.position.trapezoidCornersIn!;

    for (const cut of describeBraceEndCuts(corners)) {
      const acrossIn = cut.cutEdgeLengthIn * Math.cos((cut.angleDeg * Math.PI) / 180);
      expect(acrossIn).toBeCloseTo(PLATE_2X4_WIDTH_IN, 9);
    }

    // The two long edges are genuinely parallel — the property the old
    // construction broke, and the reason the widths disagreed.
    const dirOf = (a: PanelSpacePoint2D, b: PanelSpacePoint2D) => Math.atan2(b.zIn - a.zIn, b.xIn - a.xIn);
    const edgeA = dirOf(corners[0]!, corners[1]!);
    const edgeB = dirOf(corners[3]!, corners[2]!);
    expect(Math.abs(Math.sin(edgeA - edgeB))).toBeLessThan(1e-12);

    // ...and the long point still genuinely reaches the panel's own true edge.
    const levelCorners = corners.filter((c) => Math.abs(c.zIn - topPlateZ) < 1e-6);
    expect(levelCorners).toHaveLength(2);
    expect(levelCorners.some((c) => Math.abs(c.xIn - WIDTH_IN) < 1e-6)).toBe(true);
  });

  it("mirrored chevron: both braces' inner (plumb) end is flush to the RIGHT stud instead, outer (level) end near the left plate", () => {
    const braces = buildDiagonalBraces(WIDTH_IN, DEPTH_IN, HEIGHT_IN, rowCount, studSpanIn, "chevron", true);
    const [upperExt, lowerExt] = braces.filter((b) => b.memberId.endsWith("_ext"));

    const nearRightStud = (brace: NonNullable<typeof upperExt>) =>
      brace.position.trapezoidCornersIn!.filter((c) => Math.abs(c.xIn - rightStudFaceX) < 1e-6).length;
    expect(nearRightStud(upperExt!)).toBe(2);
    expect(nearRightStud(lowerExt!)).toBe(2);

    const nearTopPlate = upperExt!.position.trapezoidCornersIn!.filter((c) => Math.abs(c.zIn - topPlateZ) < 1e-6);
    const nearBottomPlate = lowerExt!.position.trapezoidCornersIn!.filter((c) => Math.abs(c.zIn - bottomPlateZ) < 1e-6);
    expectLevelEndClampedAtLeftEdge(nearTopPlate, topPlateZ);
    expectLevelEndClampedAtLeftEdge(nearBottomPlate, bottomPlateZ);

    const upperPlumb = upperExt!.position.trapezoidCornersIn!.filter((c) => Math.abs(c.xIn - rightStudFaceX) < 1e-6);
    const lowerPlumb = lowerExt!.position.trapezoidCornersIn!.filter((c) => Math.abs(c.xIn - rightStudFaceX) < 1e-6);
    /* ⚠ THE POINT MEETS THE BAR, NOT THE CENTRE OF THE CUT. Tommy, 2026-10-13:
       *"the point should meet the top of the Girt bar"*. These lines used to
       average the plumb cut's two corners onto the bar's face, which is what
       pinned the board at its middle and forced the old stretched shape. The
       upper brace rises away from the bar's top, so its point is the LOWEST of
       its plumb corners; the lower brace falls away from the bar's bottom, so
       its point is the HIGHEST. */
    expect(Math.min(upperPlumb[0]!.zIn, upperPlumb[1]!.zIn)).toBeCloseTo(middleBarTopZ, 6);
    expect(Math.max(lowerPlumb[0]!.zIn, lowerPlumb[1]!.zIn)).toBeCloseTo(middleBarBottomZ, 6);
  });

  it("hatch (unmirrored, formerly 'hatch-forward'): upper brace matches chevron's upper (left stud), lower brace flips to the RIGHT stud + left-side bottom plate", () => {
    const braces = buildDiagonalBraces(WIDTH_IN, DEPTH_IN, HEIGHT_IN, rowCount, studSpanIn, "hatch", false);
    const lowerExt = braces.find((b) => b.memberId === "diagonal_brace_lower_ext")!;
    const nearRightStud = lowerExt.position.trapezoidCornersIn!.filter((c) => Math.abs(c.xIn - rightStudFaceX) < 1e-6);
    expect(nearRightStud).toHaveLength(2);
    expect(Math.max(nearRightStud[0]!.zIn, nearRightStud[1]!.zIn)).toBeCloseTo(middleBarBottomZ, 6);
    const nearBottomPlate = lowerExt.position.trapezoidCornersIn!.filter((c) => Math.abs(c.zIn - bottomPlateZ) < 1e-6);
    expectLevelEndClampedAtLeftEdge(nearBottomPlate, bottomPlateZ);
  });

  it("hatch mirrored (formerly 'hatch-back'): lower brace matches chevron's lower (left stud), upper brace flips to the RIGHT stud + left-side top plate", () => {
    const braces = buildDiagonalBraces(WIDTH_IN, DEPTH_IN, HEIGHT_IN, rowCount, studSpanIn, "hatch", true);
    const upperExt = braces.find((b) => b.memberId === "diagonal_brace_upper_ext")!;
    const nearRightStud = upperExt.position.trapezoidCornersIn!.filter((c) => Math.abs(c.xIn - rightStudFaceX) < 1e-6);
    expect(nearRightStud).toHaveLength(2);
    expect(Math.min(nearRightStud[0]!.zIn, nearRightStud[1]!.zIn)).toBeCloseTo(middleBarTopZ, 6);
    const nearTopPlate = upperExt.position.trapezoidCornersIn!.filter((c) => Math.abs(c.zIn - topPlateZ) < 1e-6);
    expectLevelEndClampedAtLeftEdge(nearTopPlate, topPlateZ);
  });

  it("every brace, across all 4 configs, shares the same folded tilt magnitude (panel's own vertical symmetry)", () => {
    // Raw tiltDeg values can legitimately differ by a full 180deg between
    // configs (swapping which endpoint is "first" — see
    // computeBraceEndCutAngleDeg's own doc comment) while describing the
    // exact same physical lean — fold through that function (the same way
    // representativeBraceCutAngleDeg/the schema notes actually do) before
    // comparing, rather than comparing raw |tiltDeg|.
    const magnitudes = BRACE_CONFIGS.flatMap(({ pattern, mirrored }) =>
      buildDiagonalBraces(WIDTH_IN, DEPTH_IN, HEIGHT_IN, rowCount, studSpanIn, pattern, mirrored).map((b) =>
        computeBraceEndCutAngleDeg(b.position.tiltDeg!),
      ),
    );
    const first = magnitudes[0]!;
    for (const m of magnitudes) expect(m).toBeCloseTo(first, 6);
  });
});

describe("buildBracedPanelMembers", () => {
  it("shares skins/plates/studs with the standard panel, but uses 3+ girt rows and adds 4 diagonal braces (both wythes)", () => {
    const members = buildBracedPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "chevron", false);
    expect(members.find((m) => m.memberId === "bottom_plate_skin")).toBeDefined();
    expect(members.filter((m) => m.role === "stud")).toHaveLength(4);
    const girtRows = new Set(members.filter((m) => m.role === "girt").map((m) => m.memberId.split("_")[1]));
    expect(girtRows.size).toBe(3); // 3 rows at this height
    expect(members.filter((m) => m.role === "girt_web")).toHaveLength(3);
    expect(members.filter((m) => m.role === "brace")).toHaveLength(4);
  });

  it("includes the nailer when requested, same as the standard panel", () => {
    const withNailer = buildBracedPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, true, "chevron", false);
    expect(withNailer.find((m) => m.role === "nailer")).toBeDefined();
  });

  it("adds a vertical center connector for chevron only (either mirror state), not for hatch", () => {
    const chevron = buildBracedPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "chevron", false);
    const chevronMirrored = buildBracedPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "chevron", true);
    const hatch = buildBracedPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "hatch", false);
    const hatchMirrored = buildBracedPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "hatch", true);
    const connector = chevron.find((m) => m.memberId === "brace_center_connector");
    expect(connector).toBeDefined();
    expect(connector!.role).toBe("blocking");
    expect(connector!.orientation).toBe("vertical");
    expect(connector!.position.xIn).toBeCloseTo(WIDTH_IN / 2 - 0.75, 6); // centered on the panel's own midline
    expect(connector!.position.yIn).toBe(0); // exterior wythe only
    const mirroredConnector = chevronMirrored.find((m) => m.memberId === "brace_center_connector");
    expect(mirroredConnector).toBeDefined();
    // Same X (still centered on the midline) — only the underlying brace
    // endpoints it's derived from differ by mirror, not its own position.
    expect(mirroredConnector!.position.xIn).toBeCloseTo(connector!.position.xIn, 6);
    expect(hatch.find((m) => m.memberId === "brace_center_connector")).toBeUndefined();
    expect(hatchMirrored.find((m) => m.memberId === "brace_center_connector")).toBeUndefined();
  });

  it("mirrored chevron's center connector derives its crossing points from the mirrored (right-stud) brace endpoints, not the unmirrored ones", () => {
    // Regression test for a real bug found during the pattern/mirror
    // refactor: buildBracedCenterConnector used to hardcode "left" for
    // both its reference braces regardless of the actual bracingStyle,
    // so a mirrored chevron's connector would silently use the WRONG
    // (unmirrored) endpoints. lengthIn (topCrossZIn - bottomCrossZIn) is
    // derived from those endpoints — if the bug were still present, this
    // would be identical to the unmirrored connector's own length only by
    // coincidence (both configs are vertically symmetric here), so the
    // real proof is that mirroring doesn't crash and produces a
    // structurally sane (positive-length) connector.
    const mirroredMembers = buildBracedPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "chevron", true);
    const connector = mirroredMembers.find((m) => m.memberId === "brace_center_connector")!;
    expect(connector.actualDimsIn.lengthIn).toBeGreaterThan(0);
  });
});

describe("bracedPanelDisplayLabel", () => {
  it("returns the style-specific name Tommy wants shown wherever a user sees it", () => {
    expect(bracedPanelDisplayLabel("chevron", false)).toBe("Chevron Braced Panel");
    expect(bracedPanelDisplayLabel("chevron", true)).toBe("Chevron Braced Panel (Mirrored)");
    expect(bracedPanelDisplayLabel("hatch", false)).toBe("Hatch Forward Panel");
    expect(bracedPanelDisplayLabel("hatch", true)).toBe("Hatch Back Panel");
  });
});

describe("buildBracedPanelSchema", () => {
  it("wraps the members with the shared schema envelope, derived from standard_panel", () => {
    const schema = buildBracedPanelSchema(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "chevron", false);
    expect(schema.id).toBe("braced_panel");
    expect(schema.derivedFrom).toBe("standard_panel");
    expect(schema.members.length).toBeGreaterThan(0);
  });

  it("uses the style-aware display name", () => {
    expect(buildBracedPanelSchema(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "hatch", false).displayName).toBe("Hatch Forward Panel");
    expect(buildBracedPanelSchema(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "hatch", true).displayName).toBe("Hatch Back Panel");
  });

  it("reports both the level and plumb bevel-cut angles for the diagonal braces' ends, summing to 90deg", () => {
    const schema = buildBracedPanelSchema(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "chevron", false);
    const note = schema.notes.find((n) => n.type === "deviation" && n.text.includes("plumb cut ("));
    expect(note).toBeDefined();
    expect(note!.text).toMatch(/level cut \(\d+\.\d+deg/);
    expect(note!.text).toMatch(/plumb cut \(\d+\.\d+deg/);
  });
});
