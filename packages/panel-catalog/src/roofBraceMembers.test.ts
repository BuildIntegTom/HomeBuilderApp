import { describe, expect, it } from "vitest";
import {
  buildRoofBraceMembers,
  roofBraceBoardCornersIn,
  roofBraceEndBevelDeg,
  roofBracePiecesForPanel,
  roofBraceTopFaceClearZIn,
  ROOF_BRACE_CONTAINED_TO_DEG,
  ROOF_BRACE_END_CLEARANCE_IN,
  type RoofBracePiece,
  type RoofBraceSliceLike,
} from "./roofBraceMembers";
import { buildFloorRoofPanelMembers, JOIST_2X6_THICKNESS_IN } from "./floorRoofPanelMembers";
import { memberAabbIn } from "./memberPrism";
import { memberBoxSizeIn, PLATE_2X4_THICKNESS_IN, PLATE_2X4_WIDTH_IN } from "./panelMemberHelpers";

const PANEL_DEPTH_IN = 15.5;
const PANEL_SPAN_IN = Math.hypot(12, 4) * 12;
const CLEAR_X_FROM_IN = JOIST_2X6_THICKNESS_IN;
const CLEAR_X_TO_IN = 24 - JOIST_2X6_THICKNESS_IN;

const optionsFor = (regionFromIn = 3.5, regionToIn = 140) => ({
  panelDepthIn: PANEL_DEPTH_IN,
  panelSpanIn: PANEL_SPAN_IN,
  regionFromIn,
  regionToIn,
  clearXFromIn: CLEAR_X_FROM_IN,
  clearXToIn: CLEAR_X_TO_IN,
});

const pieceAt = (
  x1In: number,
  y1In: number,
  x2In: number,
  y2In: number,
  over: Partial<RoofBracePiece> = {},
): RoofBracePiece => ({
  figure: "x",
  bayIndex: 0,
  braceIndex: 0,
  pieceIndex: 1,
  pieceCount: 1,
  x1In,
  y1In,
  x2In,
  y2In,
  ...over,
});

describe("a 2x4 lying flat on the exterior face", () => {
  const { members } = buildRoofBraceMembers([pieceAt(0, 10, 24, 30)], optionsFor());
  const member = members[0]!;

  it("is a diagonal turned flat, which is what confines it to 1 1/2in of depth", () => {
    expect(member.orientation).toBe("diagonal");
    expect(member.position.rotationDeg).toBe(90);
    expect(member.role).toBe("brace");
    expect(member.nominalSize).toBe("2x4");
    expect(member.actualDimsIn.thicknessIn).toBe(PLATE_2X4_THICKNESS_IN);
    expect(member.actualDimsIn.widthIn).toBe(PLATE_2X4_WIDTH_IN);
    const box = memberBoxSizeIn(member);
    expect(box.yIn).toBe(PLATE_2X4_THICKNESS_IN);
    expect(box.xIn).toBe(PLATE_2X4_WIDTH_IN);
  });

  /* ⚠ His *"just the exterior face"*, and for a ROOF panel that is the TOP —
     the weather side, where the sheathing goes. A wall brace sits at
     `PLATE_2X4_THICKNESS_IN / 2`, its own exterior wythe; this is the mirror
     of that, measured back from the panel's depth. */
  it("fills the outermost 1 1/2in of the depth and nothing deeper", () => {
    const box = memberAabbIn(member);
    expect(box.y0).toBeCloseTo(PANEL_DEPTH_IN - PLATE_2X4_THICKNESS_IN, 9);
    expect(box.y1).toBeCloseTo(PANEL_DEPTH_IN, 9);
  });

  it("refuses a panel too shallow to hold the board at all", () => {
    expect(() =>
      buildRoofBraceMembers([pieceAt(0, 10, 24, 30)], {
        ...optionsFor(),
        panelDepthIn: 1.5,
      }),
    ).toThrow(/cannot carry a brace lying flat/);
  });
});

describe("both ends cut on the panel's own side face", () => {
  /* ⚠ **A ROOF BRACE IS A PARALLELOGRAM, where every other brace in this repo
     is a trapezoid.** A wall brace is cut plumb at one end and level at the
     other. A roof brace piece stops where its panel stops — at a plane of
     constant x — at BOTH ends, so the two cuts are parallel and the shape has
     no long point. A cut list printing one would be inventing it. */
  it("puts all four corners on the two cut planes, two to each", () => {
    const corners = roofBraceBoardCornersIn(4, 10, 20, 30, PLATE_2X4_WIDTH_IN);
    const xs = corners.map((c) => c.xIn);
    expect(xs.filter((x) => Math.abs(x - 4) < 1e-9)).toHaveLength(2);
    expect(xs.filter((x) => Math.abs(x - 20) < 1e-9)).toHaveLength(2);
  });

  it("makes both long edges exactly the centreline's length", () => {
    const corners = roofBraceBoardCornersIn(4, 10, 20, 30, PLATE_2X4_WIDTH_IN);
    const centreline = Math.hypot(20 - 4, 30 - 10);
    const edge = (a: number, b: number) =>
      Math.hypot(corners[b]!.xIn - corners[a]!.xIn, corners[b]!.zIn - corners[a]!.zIn);
    expect(edge(0, 1)).toBeCloseTo(centreline, 9);
    expect(edge(2, 3)).toBeCloseTo(centreline, 9);
  });

  /* The board's true width has to survive the cut, or the shop builds a
     narrower board than the one that was designed. Measured perpendicular,
     across the parallelogram. */
  it("keeps the board its full 3 1/2in across, not its projection", () => {
    const corners = roofBraceBoardCornersIn(4, 10, 20, 30, PLATE_2X4_WIDTH_IN);
    const dx = 20 - 4;
    const dz = 30 - 10;
    const lengthIn = Math.hypot(dx, dz);
    /* Perpendicular distance from corner 0 to the opposite long edge. */
    const across =
      Math.abs(
        (corners[3]!.xIn - corners[0]!.xIn) * (dz / lengthIn) -
          (corners[3]!.zIn - corners[0]!.zIn) * (dx / lengthIn),
      );
    expect(across).toBeCloseTo(PLATE_2X4_WIDTH_IN, 9);
  });

  /* ⚠ The bevel and the brace's angle off the eave are the SAME number: a
     square crosscut runs perpendicular to the board and the cut runs up the
     panel, so the angle between them is the angle between the board and the
     eave. One jig setting does both ends. */
  it("bevels both ends at the brace's own angle off the eave", () => {
    expect(roofBraceEndBevelDeg(0, 0, 10, 10)).toBeCloseTo(45, 9);
    expect(roofBraceEndBevelDeg(0, 0, 12, 4)).toBeCloseTo(18.4349, 4);
    /* Direction does not change the bevel. */
    expect(roofBraceEndBevelDeg(12, 4, 0, 0)).toBeCloseTo(18.4349, 4);
  });

  it("refuses a piece with no length and one that runs straight up the panel", () => {
    expect(() => roofBraceBoardCornersIn(4, 10, 4, 10, PLATE_2X4_WIDTH_IN)).toThrow(/no length/);
    expect(() => roofBraceBoardCornersIn(4, 10, 4, 30, PLATE_2X4_WIDTH_IN)).toThrow(
      /runs straight up the panel/,
    );
  });

  it("records a length and a centre that agree with the corners", () => {
    const { members } = buildRoofBraceMembers([pieceAt(0, 10, 24, 30)], optionsFor());
    const member = members[0]!;
    const corners = member.position.trapezoidCornersIn!;
    const edge = Math.hypot(corners[1]!.xIn - corners[0]!.xIn, corners[1]!.zIn - corners[0]!.zIn);
    expect(member.actualDimsIn.lengthIn).toBeCloseTo(edge, 9);
    /* The parallelogram's diagonals bisect each other at its centre. */
    expect(member.position.xIn).toBeCloseTo((corners[0]!.xIn + corners[2]!.xIn) / 2, 9);
    expect(member.position.zIn).toBeCloseTo((corners[0]!.zIn + corners[2]!.zIn) / 2, 9);
  });

  /* `tiltDeg` is what every consumer that does NOT read the corners uses —
     the cut-angle helper, the shear estimate, a note. It has to describe the
     same board. */
  it("sets a tilt that points along the board", () => {
    const { members } = buildRoofBraceMembers([pieceAt(0, 10, 24, 30)], optionsFor());
    const member = members[0]!;
    const corners = member.position.trapezoidCornersIn!;
    const alongX = corners[1]!.xIn - corners[0]!.xIn;
    const alongZ = corners[1]!.zIn - corners[0]!.zIn;
    /* The same formula the wall's brace uses, read back: tilt measures the
       board's direction from vertical, so its tangent is run over rise. */
    const fromTilt = Math.tan((member.position.tiltDeg! * Math.PI) / 180);
    expect(fromTilt).toBeCloseTo(-alongX / alongZ, 6);
  });
});

describe("the piece stops at the joists, not at the seam", () => {
  /* ⚠ **MEASURED BEFORE THIS EXISTED: every single brace member overlapped
     BOTH top joist chords.** Not crossing them — buried inside them, since a
     2x6 chord laid in the top of a roof panel occupies the very 1 1/2in depth
     slice the brace does. Butting the brace into the joist's inner face gives
     it something to bear against, and the joists are what carry the seam from
     one panel to the next anyway. */
  it("trims every piece to the clear band between the two joists", () => {
    const { members } = buildRoofBraceMembers(
      [pieceAt(0, 10, 24, 30), pieceAt(24, 10, 0, 30)],
      optionsFor(),
    );
    for (const member of members) {
      const corners = member.position.trapezoidCornersIn!;
      const xs = corners.map((c) => c.xIn);
      expect(Math.min(...xs)).toBeCloseTo(CLEAR_X_FROM_IN, 9);
      expect(Math.max(...xs)).toBeCloseTo(CLEAR_X_TO_IN, 9);
    }
  });

  /* The trim follows the piece's own line, so the shortened piece still lies
     on the figure — shorter, never moved. */
  it("takes the z at the trim from the piece's own line", () => {
    const { members } = buildRoofBraceMembers([pieceAt(0, 0, 24, 24)], optionsFor(0, 140));
    const corners = members[0]!.position.trapezoidCornersIn!;
    /* A 45deg piece from (0,0): at x = 1.5 the line is at z = 1.5. */
    const nearMid = (corners[0]!.zIn + corners[3]!.zIn) / 2;
    expect(nearMid).toBeCloseTo(CLEAR_X_FROM_IN, 9);
  });

  it("reports what the worst piece lost to the joists", () => {
    const plan = buildRoofBraceMembers([pieceAt(0, 10, 24, 30)], optionsFor());
    const angle = Math.atan2(20, 24);
    /* A joist's thickness at each end, measured along the sloped board. */
    expect(plan.trimmedIn).toBeCloseTo((2 * JOIST_2X6_THICKNESS_IN) / Math.cos(angle), 6);
  });

  it("refuses a clear band that leaves the piece nothing", () => {
    expect(() =>
      buildRoofBraceMembers([pieceAt(0, 10, 24, 30)], {
        ...optionsFor(),
        clearXFromIn: 12,
        clearXToIn: 12,
      }),
    ).toThrow(/leaves nothing between the joists/);
  });
});

describe("the clear band on the top face", () => {
  const panel = buildFloorRoofPanelMembers({
    kind: "roof",
    widthIn: 24,
    depthIn: PANEL_DEPTH_IN,
    lengthIn: PANEL_SPAN_IN,
    pitchIn12: 4,
    bearingSeatDepthIn: 15.5,
  });
  const clear = roofBraceTopFaceClearZIn(
    panel,
    PANEL_DEPTH_IN,
    PANEL_SPAN_IN,
    CLEAR_X_FROM_IN,
    CLEAR_X_TO_IN,
  );

  /* ⚠ **THE TWO ENDS ARE NOT ALIKE, which is why this is derived from the
     panel rather than from the pitch.** The eave takes its cut from BELOW —
     the fascia stops at the bearing seat — so there is nothing up here to
     stop at and the top face runs the full way to z = 0. The plumb end lid
     does reach this depth, and stops the top face about 7in short of the
     span. */
  it("runs to the eave and stops short at the plumb end", () => {
    expect(clear.fromIn).toBe(0);
    expect(clear.toIn).toBeLessThan(PANEL_SPAN_IN - 5);
    expect(clear.toIn).toBeGreaterThan(PANEL_SPAN_IN - 10);
  });

  /* ⚠ **THE TEST THAT MATTERS MOST HERE.** The two top joist chords run the
     panel's whole span in this very depth slice, so a rule of "any member
     touching a span end caps it" would read them as caps and collapse the
     band to nothing — no bracing anywhere, silently. They are excluded by the
     x band: a joist is confined to its own 1 1/2in, outside the clear span
     the brace lives in. */
  it("does not read the two top joists as end caps", () => {
    expect(clear.toIn - clear.fromIn).toBeGreaterThan(PANEL_SPAN_IN * 0.9);
  });

  /* A floor panel has plain lids at both ends, which DO reach the top face,
     so its clear band is short at both ends — the same function, a different
     panel, no special case. */
  it("stops short at both ends of a floor panel", () => {
    const floor = buildFloorRoofPanelMembers({
      kind: "floor",
      widthIn: 24,
      depthIn: PANEL_DEPTH_IN,
      lengthIn: 120,
    });
    const band = roofBraceTopFaceClearZIn(floor, PANEL_DEPTH_IN, 120, CLEAR_X_FROM_IN, CLEAR_X_TO_IN);
    expect(band.fromIn).toBeGreaterThan(0);
    expect(band.toIn).toBeLessThan(120);
  });
});

describe("the boards stay inside the panel", () => {
  /* ⚠ **The clearance is a BOUND, not a measurement, and this is the angle it
     holds to.** A board of width `w` centred on a line ending at the region's
     edge reaches `w/2 / cos(angle)` past it. A full board width covers every
     member up to 60deg, which is well past the 45deg ceiling of his band. */
  it("contains a board at the angle the clearance is stated for", () => {
    expect(ROOF_BRACE_END_CLEARANCE_IN).toBeCloseTo(
      PLATE_2X4_WIDTH_IN / 2 / Math.cos((ROOF_BRACE_CONTAINED_TO_DEG * Math.PI) / 180),
      6,
    );
  });

  it("keeps a piece ending on the region's floor inside the panel", () => {
    const regionFromIn = ROOF_BRACE_END_CLEARANCE_IN;
    /* A 45deg piece whose eave end sits exactly on the region's floor. */
    const plan = buildRoofBraceMembers([pieceAt(0, 0, 24, 24)], optionsFor(regionFromIn, 140));
    expect(plan.withinPanelSpan).toBe(true);
    expect(plan.zFromIn).toBeGreaterThanOrEqual(0);
    expect(plan.lidBiteIn).toBeGreaterThan(0);
    expect(plan.lidBiteIn).toBeLessThanOrEqual(ROOF_BRACE_END_CLEARANCE_IN + 1e-9);
  });

  /* ⚠ **AND IT REPORTS RATHER THAN CLAMPS WHEN A MEMBER IS STEEPER THAN THE
     BOUND.** The 24ft plane's snapped figure contains a 63.9deg member, past
     the 60deg the clearance holds to, so its board reaches further than the
     clearance allows for. Nobody has said how a roof brace meets an end lid,
     so the number is reported and the Review Log carries it — his standing
     rule for a brace crossing another member. */
  it("reports the overshoot of a member steeper than the bound", () => {
    /* 70deg off the eave, well past 60. */
    const plan = buildRoofBraceMembers(
      [pieceAt(CLEAR_X_FROM_IN, 0, CLEAR_X_TO_IN, (CLEAR_X_TO_IN - CLEAR_X_FROM_IN) * Math.tan((70 * Math.PI) / 180))],
      optionsFor(ROOF_BRACE_END_CLEARANCE_IN, 140),
    );
    expect(plan.lidBiteIn).toBeGreaterThan(ROOF_BRACE_END_CLEARANCE_IN);
  });

  /* ⚠ **BOTH ENDS OF THE REGION, or the measurement is half a measurement.**
     A mutation run removed the ridge-end term and every other test here still
     passed, because they all exercise a piece ending on the region's FLOOR.
     The two ends of a roof panel are not alike — the eave runs full and the
     plumb end stops short — so the end that is not tested is exactly the one
     whose boundary is easy to get wrong. */
  it("measures a bite at the region's ridge end as well as its eave end", () => {
    const regionFromIn = ROOF_BRACE_END_CLEARANCE_IN;
    const regionToIn = 140;
    const height = regionToIn - regionFromIn;
    /* A piece climbing to the region's very ceiling, and nowhere near its
       floor: only the ridge-end term can see this one. */
    const plan = buildRoofBraceMembers(
      [pieceAt(0, height - 24, 24, height)],
      optionsFor(regionFromIn, regionToIn),
    );
    expect(plan.zToIn).toBeGreaterThan(regionToIn);
    expect(plan.lidBiteIn).toBeGreaterThan(0);
    expect(plan.lidBiteIn).toBeCloseTo(plan.zToIn - regionToIn, 9);
  });

  it("reports an empty panel without inventing a band", () => {
    const plan = buildRoofBraceMembers([], optionsFor());
    expect(plan.members).toEqual([]);
    expect(plan.withinPanelSpan).toBe(true);
    expect(plan.lidBiteIn).toBe(0);
    expect(plan.trimmedIn).toBe(0);
  });
});

describe("piece n of m counts along the brace, not within the panel", () => {
  const slice = (
    segmentIndex: number,
    panelIndex: number,
    startFraction: number,
    x1In: number,
    x2In: number,
  ): RoofBraceSliceLike => ({
    figure: "x",
    bayIndex: 0,
    segmentIndex,
    panelIndex,
    startFraction,
    x1In,
    y1In: 0,
    x2In,
    y2In: 10,
  });

  /* ⚠ **"piece 2 of 3" is a fact about the PARENT brace.** Counted within one
     panel it would read "piece 1 of 1" on every board, and a run of one
     brace's pieces would look like a row of unrelated boards to the
     installer. */
  it("numbers a panel's pieces by their place along the whole brace", () => {
    const slices = [
      slice(7, 0, 0, 0, 24),
      slice(7, 1, 0.33, 24, 48),
      slice(7, 2, 0.66, 48, 72),
    ];
    const middle = roofBracePiecesForPanel(slices, 1, 24);
    expect(middle).toHaveLength(1);
    expect(middle[0]!.pieceIndex).toBe(2);
    expect(middle[0]!.pieceCount).toBe(3);
    expect(middle[0]!.braceIndex).toBe(7);
  });

  it("makes the x panel-local and leaves the span coordinate alone", () => {
    const pieces = roofBracePiecesForPanel([slice(0, 1, 0.5, 24, 48)], 1, 24);
    expect(pieces[0]!.x1In).toBe(0);
    expect(pieces[0]!.x2In).toBe(24);
    expect(pieces[0]!.y1In).toBe(0);
    expect(pieces[0]!.y2In).toBe(10);
  });

  it("orders pieces along the parent even when the slices arrive shuffled", () => {
    const slices = [slice(3, 2, 0.8, 48, 72), slice(3, 0, 0, 0, 24), slice(3, 1, 0.4, 24, 48)];
    expect(roofBracePiecesForPanel(slices, 2, 48)[0]!.pieceIndex).toBe(3);
    expect(roofBracePiecesForPanel(slices, 0, 0)[0]!.pieceIndex).toBe(1);
  });
});

describe("the members a shop can read", () => {
  const plan = buildRoofBraceMembers(
    [
      pieceAt(0, 10, 24, 30, { figure: "x", bayIndex: 1, braceIndex: 2, pieceIndex: 3, pieceCount: 8 }),
      pieceAt(24, 10, 0, 30, { figure: "carrot", bayIndex: 1, braceIndex: 5, pieceIndex: 1, pieceCount: 2 }),
    ],
    optionsFor(),
  );

  it("gives every member its own id", () => {
    const ids = plan.members.map((m) => m.memberId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("says which part of the figure a board is, and which piece of it", () => {
    expect(plan.members[0]!.notes).toMatch(/leg of the X in bay 2/);
    expect(plan.members[0]!.notes).toMatch(/piece 3 of 8/);
    expect(plan.members[1]!.notes).toMatch(/carrot in bay 2/);
  });

  /* The two facts the shop needs that are NOT in the dimensions: one jig
     setting does both ends, and there is no long point to measure to. */
  it("states the end bevel and that there is no long point", () => {
    expect(plan.members[0]!.notes).toMatch(/off square/);
    expect(plan.members[0]!.notes).toMatch(/one jig setting does both/);
    expect(plan.members[0]!.notes).toMatch(/no long point/);
  });

  /* ⚠ **THE NUMBER, not just the sentence around it.** A mutation run swapped
     the bevel's two axes and every assertion above still passed: the note
     said "off square" either way, and the only difference was 39.8deg against
     its complement at 50.2. A figure on a shop sheet that no test reads is a
     figure nobody is checking. Measured on the TRIMMED piece, which is the
     board the shop cuts: 17.5in of rise over 21in of run between the joists. */
  it("prints the bevel the trimmed board is actually cut at", () => {
    const corners = plan.members[0]!.position.trapezoidCornersIn!;
    const runIn = CLEAR_X_TO_IN - CLEAR_X_FROM_IN;
    const riseIn = Math.abs((corners[1]!.zIn + corners[2]!.zIn) / 2 - (corners[0]!.zIn + corners[3]!.zIn) / 2);
    const expectedDeg = Math.round(((Math.atan2(riseIn, runIn) * 180) / Math.PI) * 10) / 10;
    expect(expectedDeg).toBe(39.8);
    expect(plan.members[0]!.notes).toContain(`${expectedDeg}deg off square`);
  });

  /* ⚠ Never a verdict: a note goes in front of a fabricator and an engineer,
     and "passes" or "fails" is a judgement nothing here is entitled to make. */
  it("states what a board is without pronouncing on it", () => {
    for (const member of plan.members) {
      expect(member.notes).not.toMatch(/\b(pass|fail)/i);
    }
  });
});
