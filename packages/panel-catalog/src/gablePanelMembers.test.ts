import { describe, expect, it } from "vitest";
import {
  buildGablePanelMembers,
  buildGablePanelSchema,
  computeGableRipCallout,
  GABLE_PANEL_MAX_HEIGHT_IN,
  GABLE_PANEL_MIN_HEIGHT_IN,
  gableGirtPlan,
} from "./gablePanelMembers";
import { memberBoxSizeIn, SKIN_THICKNESS_IN } from "./panelMemberHelpers";

/**
 * ⚠ **What a gable corner stud's LONG POINT really is**, now that its top
 * is cut to the roof rake instead of left flat.
 *
 * Every assertion below used to read `edgeHeightIn - 1.5` — the panel's
 * height less its two 3/4in skins — which is the stud a flat-topped box
 * would be. A real stud's top follows the underside of the top skin across
 * its own 1 1/2in thickness, so:
 *
 * - the skin's underside sits `0.75 / cos(rake)` below the top face, NOT
 *   0.75 (a perpendicular thickness is not a vertical one);
 * - the stud's long point is whichever of its two top corners is higher,
 *   which is its INNER face on the low edge and the PANEL edge on the high
 *   one.
 *
 * On the 40 x 20/50 fixture that is 19 7/16in and 48 5/16in, against the old
 * 18 1/2in and 48 1/2in. The low stud got LONGER and the high one SHORTER,
 * which is the shape of the correction: the roofline rises across the stud.
 */
function expectedStudLongPointIn(widthIn: number, leftIn: number, rightIn: number, side: "left" | "right"): number {
  const rakeRad = Math.atan2(rightIn - leftIn, widthIn);
  const skinVerticalIn = 0.75 / Math.cos(rakeRad);
  const topAt = (xIn: number) => leftIn + ((rightIn - leftIn) * xIn) / widthIn - skinVerticalIn;
  const [nearXIn, farXIn] = side === "left" ? [0, 1.5] : [widthIn - 1.5, widthIn];
  return Math.max(topAt(nearXIn), topAt(farXIn)) - 0.75;
}

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
    expect(risingLeftStud.actualDimsIn.lengthIn).toBeCloseTo(
      expectedStudLongPointIn(WIDTH_IN, LOW_EDGE_IN, HIGH_EDGE_IN, "left"),
      6,
    );
    expect(risingRightStud.actualDimsIn.lengthIn).toBeCloseTo(
      expectedStudLongPointIn(WIDTH_IN, LOW_EDGE_IN, HIGH_EDGE_IN, "right"),
      6,
    );

    // The mirrored tile — real roofline falls left-to-right (e.g. right of
    // the same peak) — must have the TALL stud on its own left now, not
    // still on the right, or the panel renders backwards once placed at
    // its own real (mirrored) world position.
    const falling = buildGablePanelMembers(WIDTH_IN, DEPTH_IN, HIGH_EDGE_IN, LOW_EDGE_IN, false);
    const fallingStuds = falling.filter((m) => m.role === "stud");
    const fallingLeftStud = fallingStuds.find((m) => m.position.xIn === 0)!;
    const fallingRightStud = fallingStuds.find((m) => m.position.xIn === WIDTH_IN - 1.5)!;
    expect(fallingLeftStud.actualDimsIn.lengthIn).toBeCloseTo(
      expectedStudLongPointIn(WIDTH_IN, HIGH_EDGE_IN, LOW_EDGE_IN, "left"),
      6,
    );
    expect(fallingRightStud.actualDimsIn.lengthIn).toBeCloseTo(
      expectedStudLongPointIn(WIDTH_IN, HIGH_EDGE_IN, LOW_EDGE_IN, "right"),
      6,
    );
    // ...and the tall one really is on the left when the roofline falls.
    expect(fallingLeftStud.actualDimsIn.lengthIn).toBeGreaterThan(fallingRightStud.actualDimsIn.lengthIn);
  });

  it("throws if either edge's height exceeds the 8ft (96in) max a single Gable End Panel can be built at, regardless of side", () => {
    /* ⚠ The short edge is the MINIMUM, not 0 — it used to be 0, which is
       now its own refusal (below) and so no longer isolates the ceiling. */
    const lowIn = GABLE_PANEL_MIN_HEIGHT_IN;
    expect(() => buildGablePanelMembers(WIDTH_IN, DEPTH_IN, lowIn, GABLE_PANEL_MAX_HEIGHT_IN, false)).not.toThrow();
    expect(() => buildGablePanelMembers(WIDTH_IN, DEPTH_IN, lowIn, GABLE_PANEL_MAX_HEIGHT_IN + 0.01, false)).toThrow();
    expect(() => buildGablePanelMembers(WIDTH_IN, DEPTH_IN, GABLE_PANEL_MAX_HEIGHT_IN + 0.01, lowIn, false)).toThrow();
  });

  it("⚠ BUILDS a panel that tapers to NOTHING on one edge, with no negative parts", () => {
    /* ⚠ **IT REFUSED THIS, AND THE REFUSAL TOOK THE WHOLE APP DOWN.**
       *"This page couldn't load whenever I lift my fingers off of the shape
       draw on mobile"* — Tommy, 2026-10-31. A gable row running to a shed's
       low corner, and the triangular cap above a gable window that reaches
       its own roofline, both hand this builder a legitimate 0in edge; the
       guard threw inside the 3D view's render and the page was gone.

       A triangle IS a gable part — *"we can take little gable end panels all
       the way to the end."* What must never appear is a NEGATIVE one: before
       any of this, a 1in tile put `stud_corner_1 = -0.50in` in the cut list. */
    for (const shortIn of [0, 0.5, GABLE_PANEL_MIN_HEIGHT_IN - 0.01]) {
      for (const [leftIn, rightIn] of [
        [shortIn, 60],
        [60, shortIn],
      ]) {
        const members = buildGablePanelMembers(WIDTH_IN, DEPTH_IN, leftIn!, rightIn!, false);
        expect(members.length).toBeGreaterThan(0);
        for (const m of members) {
          expect({ id: m.memberId, negative: Object.values(m.actualDimsIn).some((v) => v < 0) }).toEqual({
            id: m.memberId,
            negative: false,
          });
        }
        /* The tapered edge carries no stud rather than a zero-length one, and
           the standing edge still carries its pair. */
        const studs = members.filter((m) => m.role === "stud");
        expect(studs).toHaveLength(2);
        /* ⚠ The LONG POINT of a raked stud, not the flat-box height. On a
           tile this steep the rake across the stud's own 1 1/2in is worth
           most of an inch, which is exactly the geometry he was pointing at.
           The standing edge is the one at 60in, whichever side it is on. */
        const standingSide = leftIn! > rightIn! ? "left" : "right";
        for (const stud of studs) {
          expect(stud.actualDimsIn.lengthIn).toBeCloseTo(
            expectedStudLongPointIn(WIDTH_IN, leftIn!, rightIn!, standingSide),
            6,
          );
        }
        /* And no girts, because there is no clear span to space them across. */
        expect(members.filter((m) => m.memberId.startsWith("girt_"))).toHaveLength(0);
      }
    }
  });

  it("⚠ REFUSES only when NEITHER edge can carry the panel's own two skins", () => {
    /* Nothing to build at all — the row's own answer for a sliver this short
       is a safety-gap filler, which is what page.tsx turns it into. */
    expect(() => buildGablePanelMembers(WIDTH_IN, DEPTH_IN, 0, 1, false)).toThrow(/no panel here to build/);
    expect(() => buildGablePanelMembers(WIDTH_IN, DEPTH_IN, 1.49, 0, false)).toThrow(/no panel here to build/);
    /* ...and exactly AT the floor it builds. */
    expect(() => buildGablePanelMembers(WIDTH_IN, DEPTH_IN, 0, GABLE_PANEL_MIN_HEIGHT_IN, false)).not.toThrow();
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
    for (const s of lowStuds)
      expect(s.actualDimsIn.lengthIn).toBeCloseTo(expectedStudLongPointIn(WIDTH_IN, LOW_EDGE_IN, HIGH_EDGE_IN, "left"), 6);
    for (const s of highStuds)
      expect(s.actualDimsIn.lengthIn).toBeCloseTo(expectedStudLongPointIn(WIDTH_IN, LOW_EDGE_IN, HIGH_EDGE_IN, "right"), 6);
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

  it("keeps the top plate 2x4s truly parallel to the top skin (same tilt angle), just a shorter inset run", () => {
    const members = buildGablePanelMembers(WIDTH_IN, DEPTH_IN, LOW_EDGE_IN, HIGH_EDGE_IN, false);
    const topSkin = members.find((m) => m.memberId === "top_plate_skin")!;
    const topPlateExt = members.find((m) => m.memberId === "top_plate_2x4_ext")!;
    const topPlateInt = members.find((m) => m.memberId === "top_plate_2x4_int")!;
    expect(topPlateExt.position.tiltDeg).toBeCloseTo(topSkin.position.tiltDeg!, 6);
    expect(topPlateInt.position.tiltDeg).toBeCloseTo(topSkin.position.tiltDeg!, 6);

    // Also true for a mirrored (falling) slope and an asymmetric width.
    const falling = buildGablePanelMembers(70, DEPTH_IN, HIGH_EDGE_IN, LOW_EDGE_IN, false);
    const fallingSkin = falling.find((m) => m.memberId === "top_plate_skin")!;
    const fallingPlate = falling.find((m) => m.memberId === "top_plate_2x4_ext")!;
    expect(fallingPlate.position.tiltDeg).toBeCloseTo(fallingSkin.position.tiltDeg!, 6);
  });

  it("calls out the top plate's own rip angle/length and plumb-cut end note, matching the skin's pitch", () => {
    const members = buildGablePanelMembers(WIDTH_IN, DEPTH_IN, LOW_EDGE_IN, HIGH_EDGE_IN, false);
    const { angleDeg: ripAngleDeg } = computeGableRipCallout(WIDTH_IN, LOW_EDGE_IN, HIGH_EDGE_IN);
    const topPlateExt = members.find((m) => m.memberId === "top_plate_2x4_ext")!;
    expect(topPlateExt.notes).toContain(`${ripAngleDeg.toFixed(2)}deg`);
    expect(topPlateExt.notes).toContain("plumb-cut");
    expect(topPlateExt.notes).toContain("point to butt");

    const topSkin = members.find((m) => m.memberId === "top_plate_skin")!;
    expect(topSkin.notes).toContain("plumb-cut");
    expect(topSkin.notes).toContain("point to butt");
  });

  it("⚠ the top skin's own face lands EXACTLY on the two edge heights", () => {
    /* This used to reconstruct the endpoints from the centreline, the tilt
       and the box length, and then subtract `0.375 / cos(rake)` to undo the
       half-thickness the centreline carried. The skin is a real
       parallelogram now, so its top face is simply stated — no
       reconstruction, no correction to get wrong. Whether that face lands on
       the edge heights is the whole of *"Let's get gable end panels top
       plate edge to be flush with the top of the roof panels"*, and it is
       now readable in one line. */
    const members = buildGablePanelMembers(WIDTH_IN, DEPTH_IN, LOW_EDGE_IN, HIGH_EDGE_IN, false);
    const corners = members.find((m) => m.memberId === "top_plate_skin")!.position.trapezoidCornersIn!;
    expect(corners[0]).toEqual({ xIn: 0, zIn: LOW_EDGE_IN });
    expect(corners[1]).toEqual({ xIn: WIDTH_IN, zIn: HIGH_EDGE_IN });
    // Both ends PLUMB: each end's two corners share one x.
    expect(corners[3]!.xIn).toBe(corners[0]!.xIn);
    expect(corners[2]!.xIn).toBe(corners[1]!.xIn);
    /* ⚠ And the sheet's vertical height is its 3/4in thickness divided by
       cos(rake), not 3/4in. A perpendicular thickness is not a vertical one
       — the error that cost four passes on the gable/roof junction. */
    const rakeRad = Math.atan2(HIGH_EDGE_IN - LOW_EDGE_IN, WIDTH_IN);
    expect(corners[0]!.zIn - corners[3]!.zIn).toBeCloseTo(0.75 / Math.cos(rakeRad), 9);
  });

  it("⚠ the skin's underside IS the plates' top and the studs' tops — one roofline", () => {
    /* The gable's single recorded member overlap was *the sloped top plate
       clipping its own skin*, and it was there because each of these three
       derived the roofline for itself. They read one function now, so they
       meet on shared faces rather than crossing. If this ever fails,
       `memberOverlap.test.ts` will be failing too. */
    const members = buildGablePanelMembers(WIDTH_IN, DEPTH_IN, LOW_EDGE_IN, HIGH_EDGE_IN, false);
    const skin = members.find((m) => m.memberId === "top_plate_skin")!.position.trapezoidCornersIn!;
    const undersideAt = (xIn: number) =>
      skin[3]!.zIn + ((skin[2]!.zIn - skin[3]!.zIn) * (xIn - skin[3]!.xIn)) / (skin[2]!.xIn - skin[3]!.xIn);

    for (const id of ["top_plate_2x4_ext", "top_plate_2x4_int"]) {
      const plate = members.find((m) => m.memberId === id)!.position.trapezoidCornersIn!;
      expect({ id, z: plate[0]!.zIn }).toEqual({ id, z: undersideAt(plate[0]!.xIn) });
      expect({ id, z: plate[1]!.zIn }).toEqual({ id, z: undersideAt(plate[1]!.xIn) });
    }
    for (const stud of members.filter((m) => m.role === "stud")) {
      const c = stud.position.trapezoidCornersIn!;
      // Corners 2 and 3 are the raked top; 0 and 1 the level bottom.
      expect({ id: stud.memberId, z: c[2]!.zIn }).toEqual({ id: stud.memberId, z: undersideAt(c[2]!.xIn) });
      expect({ id: stud.memberId, z: c[3]!.zIn }).toEqual({ id: stud.memberId, z: undersideAt(c[3]!.xIn) });
      // Both sides plumb, bottom level on the bottom skin.
      expect(c[0]!.xIn).toBe(c[3]!.xIn);
      expect(c[1]!.xIn).toBe(c[2]!.xIn);
      expect(c[0]!.zIn).toBe(0.75);
      expect(c[1]!.zIn).toBe(0.75);
    }
  });

  it("⚠ the plates' plumb ends butt the corner studs' inner faces", () => {
    /* Their cut-list note has claimed this since long before the geometry
       did: *"Ends are plumb-cut (vertical), flush to each corner stud's face
       — not square to the rip."* */
    const members = buildGablePanelMembers(WIDTH_IN, DEPTH_IN, LOW_EDGE_IN, HIGH_EDGE_IN, false);
    const plate = members.find((m) => m.memberId === "top_plate_2x4_ext")!.position.trapezoidCornersIn!;
    const leftStud = members.find((m) => m.memberId === "stud_corner_1")!.position.trapezoidCornersIn!;
    const rightStud = members.find((m) => m.memberId === "stud_corner_2")!.position.trapezoidCornersIn!;
    expect(plate[0]!.xIn).toBe(leftStud[1]!.xIn);
    expect(plate[1]!.xIn).toBe(rightStud[0]!.xIn);
  });

  it("has no diagonal bracing — a standard panel with just an inclined top, for the default construction", () => {
    const members = buildGablePanelMembers(WIDTH_IN, DEPTH_IN, LOW_EDGE_IN, HIGH_EDGE_IN, false);
    expect(members.filter((m) => m.role === "brace")).toHaveLength(0);

    const wideMembers = buildGablePanelMembers(400, DEPTH_IN, 20, 40, false);
    expect(wideMembers.filter((m) => m.role === "brace")).toHaveLength(0);
  });

  it("\u26a0 bases girts on the SHORT edge, which at 20in means none at all", () => {
    /* This test used to assert two rows here, which was the old flat
       `GABLE_GIRT_ROW_COUNT = 2` \u2014 and two rows over a 20in edge is
       exactly the *"lot of girts/noggings very close to each other"* Tommy
       reported. Under his rule a short edge below 2ft needs no girt at all.
       The NAILER half of this test is unchanged and still passes. */
    const withoutNailer = buildGablePanelMembers(WIDTH_IN, DEPTH_IN, LOW_EDGE_IN, HIGH_EDGE_IN, false);
    expect(withoutNailer.some((m) => m.role === "nailer")).toBe(false);
    expect(withoutNailer.filter((m) => m.role === "girt")).toHaveLength(0);

    const withNailer = buildGablePanelMembers(WIDTH_IN, DEPTH_IN, LOW_EDGE_IN, HIGH_EDGE_IN, true);
    const nailer = withNailer.find((m) => m.role === "nailer")!;
    expect(nailer).toBeDefined();
    expect(nailer.actualDimsIn.lengthIn).toBeLessThan(LOW_EDGE_IN);
  });
});

/**
 * \u26a0 **His rule, 2026-11-01, measured off the SHORT edge.**
 *
 * > *"If the shorter height of a stud on a Gable end panel is less than 2',
 * > then no girts are needed... If the shorter stud length (or really from
 * > bottom of panel to top tip of shorter stud member) is between 2-3', then
 * > one girt should be placed, it's top height flush with the lower butt
 * > corner of that shorter stud. Gable end panels 3'+ should follow the
 * > typical girt rules (one for every 3' or less so that there are no spaces
 * > that are 3' that aren't braced laterally. Whatever the top height of the
 * > pointy tall end of a Gable end panel is is less relevant for this
 * > equation."*
 */
describe("\u26a0 how many girts a gable panel gets", () => {
  const girtRows = (shortEdgeIn: number, tallEdgeIn: number) =>
    buildGablePanelMembers(WIDTH_IN, DEPTH_IN, shortEdgeIn, tallEdgeIn, false).filter((m) => m.role === "girt").length /
    2;

  /**
   * ⚠ His measurement is *"from bottom of panel to top tip of shorter
   * stud member"*, which is NOT the panel's edge height: the stud starts on
   * top of the bottom skin and stops under the top one, so the measurement
   * is the edge less ONE skin. Every band below is stated in HIS units and
   * converted here, because a test written in edge heights puts the 2ft
   * boundary 3/4in off and then asserts the wrong thing confidently.
   */
  const edgeForMeasure = (measureIn: number) => measureIn + SKIN_THICKNESS_IN;

  it("under 2ft: none", () => {
    for (const measureIn of [2, 6, 12, 18, 23, 23.875]) {
      expect({ measureIn, rows: girtRows(edgeForMeasure(measureIn), 96) }).toEqual({ measureIn, rows: 0 });
    }
  });

  it("2ft to 3ft: exactly one", () => {
    for (const measureIn of [24, 28, 30, 35, 36]) {
      expect({ measureIn, rows: girtRows(edgeForMeasure(measureIn), 96) }).toEqual({ measureIn, rows: 1 });
    }
  });

  it("\u26a0 that one girt's TOP is flush with the short stud's lower butt corner", () => {
    /* The one placement in the whole rule that is NOT a fraction of the
       span. A row's top face is its WEB's, since the web rests on the bars
       \u2014 so asserting the bar's top would pass while the real top stood
       1/2in proud of the stud it is meant to be flush with. */
    const shortEdgeIn = edgeForMeasure(30);
    const members = buildGablePanelMembers(WIDTH_IN, DEPTH_IN, shortEdgeIn, 96, false);
    const web = members.find((m) => m.role === "girt_web")!;
    const studTopZIn = shortEdgeIn - SKIN_THICKNESS_IN; // bottom skin, then the stud
    expect(web.position.zIn + web.actualDimsIn.thicknessIn).toBeCloseTo(studTopZIn, 9);
    // And the bars sit under it, not through it.
    for (const bar of members.filter((m) => m.role === "girt")) {
      expect(bar.position.zIn + bar.actualDimsIn.thicknessIn).toBeCloseTo(web.position.zIn, 9);
    }
  });

  it("\u26a0 over 3ft: enough rows that no unbraced span exceeds 3ft, swept", () => {
    for (let measureIn = 36.125; measureIn <= GABLE_PANEL_MAX_HEIGHT_IN - SKIN_THICKNESS_IN; measureIn += 0.125) {
      const rows = girtRows(edgeForMeasure(measureIn), GABLE_PANEL_MAX_HEIGHT_IN);
      const studSpanIn = measureIn - SKIN_THICKNESS_IN;
      const gapIn = studSpanIn / (rows + 1);
      expect({ measureIn, over: gapIn > 36 + 1e-9 }).toEqual({ measureIn, over: false });
      /* ...and not one row more than that needs — a rule that over-braces
         is as wrong as one that under-braces, just more expensively. */
      const gapWithOneFewer = studSpanIn / Math.max(1, rows);
      expect({ measureIn, wasteful: rows > 0 && gapWithOneFewer <= 36 }).toEqual({ measureIn, wasteful: false });
    }
  });

  it("\u26a0 the TALL edge does not enter into it", () => {
    /* *"Whatever the top height of the pointy tall end of a Gable end panel
       is is less relevant for this equation."* A 30in short edge gets one
       girt whether the peak is 3ft or 8ft above it. */
    for (const tallEdgeIn of [36, 60, 96]) {
      expect({ tallEdgeIn, rows: girtRows(edgeForMeasure(30), tallEdgeIn) }).toEqual({ tallEdgeIn, rows: 1 });
    }
  });

  it("the plan function says the same thing as the panel it builds", () => {
    for (const shortEdgeIn of [12, 24, 30, 36, 48, 72, 96]) {
      const studSpanIn = shortEdgeIn - 2 * SKIN_THICKNESS_IN;
      expect({ shortEdgeIn, rows: gableGirtPlan(studSpanIn).rowCount }).toEqual({
        shortEdgeIn,
        rows: girtRows(shortEdgeIn, GABLE_PANEL_MAX_HEIGHT_IN),
      });
    }
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
