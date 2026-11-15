import { describe, expect, it } from "vitest";
import {
  buildGablePanelMembers,
  buildGablePanelSchema,
  computeGableRipCallout,
  GABLE_PANEL_MAX_HEIGHT_IN,
  GABLE_PANEL_MIN_HEIGHT_IN,
  LEGACY_GABLE_PANEL_MAX_HEIGHT_IN,
  gableGirtPlan,
} from "./gablePanelMembers";
import { memberBoxSizeIn, SKIN_THICKNESS_IN } from "./panelMemberHelpers";
import { buildStandardPanelMembers } from "./standardPanelMembers";
import type { PanelMember } from "./componentSchema";
import { standardPanelHeightIn } from "./data";
import { overlappingMemberPairs } from "./memberPrism";

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
    const risingStuds = rising.filter((m) => m.memberId.startsWith("stud_corner_"));
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
    const fallingStuds = falling.filter((m) => m.memberId.startsWith("stud_corner_"));
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
        const studs = members.filter((m) => m.memberId.startsWith("stud_corner_"));
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
    const studs = members.filter((m) => m.memberId.startsWith("stud_corner_"));
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
    for (const stud of members.filter((m) => m.memberId.startsWith("stud_corner_"))) {
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

    /* ⚠ **The overlay board is GONE on a panel wide enough to need a centre
       stud — 2026-11-14.** A 40in tile gets one `stud_centre_1_*` pair at the
       same x the wall panel below puts its own, which is what the overlay was
       guaranteeing; building both put two boards in one place. A narrow tile,
       with no centre stud, still takes the optional nailer. */
    const withNailer = buildGablePanelMembers(WIDTH_IN, DEPTH_IN, LOW_EDGE_IN, HIGH_EDGE_IN, true);
    expect(withNailer.some((m) => m.role === "nailer")).toBe(false);
    expect(withNailer.some((m) => m.memberId === "stud_centre_1_exterior")).toBe(true);

    const narrow = buildGablePanelMembers(24, DEPTH_IN, LOW_EDGE_IN, HIGH_EDGE_IN, true);
    const nailer = narrow.find((m) => m.role === "nailer")!;
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

  /**
   * ⚠ **FLUSH WITH THE STUD GAVE WAY TO CLEARING THE PLATE — 2026-11-14.**
   *
   * The short stud's butt corner is also where the sloped top plate descends
   * to, so a row flush with the one was inside the other: the plate ran
   * through the first girt bar on every tile with a short edge under about
   * 3ft, in both gable orientations and in all three girt styles, and the
   * 96in overlap gate never sampled a tile that short.
   *
   * > *"It doesn't necessarily matter where girts are. As long as they are
   * > spaced every 3 ft or less they most certainly can be less to
   * > accommodate space for the top."* — Tommy, 2026-11-14
   *
   * So the row drops to the plate's own underside. This asserts the TOP of
   * the row — the web's, since the web rests on the bars — lands
   * there exactly, rather than asserting a number: the drop follows the pitch.
   */
  it("⚠ that one girt's TOP sits under the sloped top plate, not flush with the stud", () => {
    const shortEdgeIn = edgeForMeasure(30);
    const members = buildGablePanelMembers(WIDTH_IN, DEPTH_IN, shortEdgeIn, 96, false);
    const web = members.find((m) => m.role === "girt_web")!;
    const rowTopZIn = web.position.zIn + web.actualDimsIn.thicknessIn;

    /* The lowest point of the plate above it, read off the built member
       rather than re-derived — the low end's bottom corner. */
    const plate = members.find((m) => m.memberId === "top_plate_2x4_ext")!;
    const plateLowZIn = Math.min(...plate.position.trapezoidCornersIn!.map((c) => c.zIn));
    expect(rowTopZIn).toBeCloseTo(plateLowZIn, 9);

    /* And it really did drop: flush with the stud would have been higher. */
    expect(rowTopZIn).toBeLessThan(shortEdgeIn - SKIN_THICKNESS_IN);

    // The bars still sit under the web, not through it.
    for (const bar of members.filter((m) => m.role === "girt")) {
      expect(bar.position.zIn + bar.actualDimsIn.thicknessIn).toBeCloseTo(web.position.zIn, 9);
    }
  });

  /**
   * ⚠ **The same drop, for the style the PROJECT actually defaults to.**
   *
   * `buildGablePanelMembers` defaults to the legacy plywood web, so the test
   * above and the overlap sweep both describe a panel nobody is shipping. The
   * 2x6 blocking stands 1in higher above the row's centre than the 1/2in web
   * does, which is why the drop is solved per style
   * (`girtRowTopAboveCentreIn`) rather than once.
   */
  it("⚠ every girt style's tallest member clears the plate, not just the legacy web", () => {
    const shortEdgeIn = edgeForMeasure(30);
    for (const style of ["web", "blocking", "ring"] as const) {
      for (const [leftIn, rightIn] of [
        [shortEdgeIn, 96],
        [96, shortEdgeIn],
      ] as const) {
        const members = buildGablePanelMembers(WIDTH_IN, DEPTH_IN, leftIn, rightIn, false, style);
        const rowMembers = members.filter((m) => m.role === "girt" || m.role === "girt_web");
        expect({ style, leftIn, hasRow: rowMembers.length > 0 }).toEqual({ style, leftIn, hasRow: true });
        const rowTopZIn = Math.max(...rowMembers.map((m) => m.position.zIn + memberBoxSizeIn(m).zIn));
        const plate = members.find((m) => m.memberId === "top_plate_2x4_ext")!;
        const plateLowZIn = Math.min(...plate.position.trapezoidCornersIn!.map((c) => c.zIn));
        expect({ style, leftIn, proudIn: rowTopZIn > plateLowZIn + 1e-9 }).toEqual({ style, leftIn, proudIn: false });
      }
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

/**
 * ⚠ **THE CEILING MOVED, SO THE PANEL HAS TO ACTUALLY BUILD THERE.**
 *
 * > *"They should be trapezoid and can be up the height of the main story
 * > panels."* — Tommy, 2026-11-13
 *
 * `GABLE_PANEL_MAX_HEIGHT_IN` went from 96 to the main story panel height.
 * Raising a limit proves nothing on its own — this builds AT the new ceiling
 * and checks the panel that comes out is a real one, with girts to its own
 * span rule and nothing occupying the same space twice.
 */
describe("⚠ a gable panel at the new ceiling", () => {
  it("is the main story panel height, read from the catalog, not a literal", () => {
    expect(GABLE_PANEL_MAX_HEIGHT_IN).toBe(standardPanelHeightIn.value);
    /* It went UP. A ceiling that silently dropped would flatten more tiles,
       which is the opposite of what he asked for. */
    expect(GABLE_PANEL_MAX_HEIGHT_IN).toBeGreaterThan(LEGACY_GABLE_PANEL_MAX_HEIGHT_IN);
  });

  it("builds at the ceiling, and one inch over it still refuses", () => {
    expect(() =>
      buildGablePanelMembers(48, DEPTH_IN, GABLE_PANEL_MAX_HEIGHT_IN, GABLE_PANEL_MAX_HEIGHT_IN - 16, false),
    ).not.toThrow();
    expect(() =>
      buildGablePanelMembers(48, DEPTH_IN, GABLE_PANEL_MAX_HEIGHT_IN + 1, GABLE_PANEL_MAX_HEIGHT_IN - 16, false),
    ).toThrow(/exceeds the/);
  });

  it("⚠ is a real trapezoid at the heights that used to flatten, with nothing overlapping", () => {
    /* Every height between the old ceiling and the new one — the band whose
       tiles used to come out flat-topped with a filler above them. Both edges
       differ, so each one is a genuine trapezoid rather than a box. */
    for (let tallerIn = LEGACY_GABLE_PANEL_MAX_HEIGHT_IN; tallerIn <= GABLE_PANEL_MAX_HEIGHT_IN; tallerIn += 1) {
      const members = buildGablePanelMembers(48, DEPTH_IN, tallerIn, tallerIn - 16, false);
      expect({ tallerIn, overlaps: overlappingMemberPairs(members) }).toEqual({ tallerIn, overlaps: [] });
      /* Four corner studs: both edges carry a real pair at these heights. */
      expect({ tallerIn, studs: members.filter((m) => m.memberId.startsWith("stud_corner_")).length }).toEqual({
        tallerIn,
        studs: 4,
      });
      /* And girts, which is the point of the span rule — a 96in-plus panel
         with no lateral member would be a worse part than a flat one. */
      expect({ tallerIn, girts: members.some((m) => m.role === "girt") }).toEqual({ tallerIn, girts: true });
    }
  });
});

/**
 * ⚠ **THE GABLE ROW'S STUDS LAND ON THE WALL'S STUDS — 2026-11-14.**
 *
 * > *"I really want to see these studs lining up perfectly with the row below
 * > them, it does not appear that way on the app live right now."* — Tommy
 *
 * He was right, and the gap was bigger than a position error: a gable tile had
 * **no centre studs at all**. The row's JOINTS had landed on the wall's joints
 * since B3, so the tile edges stacked; everything between them did not.
 *
 * This compares the two builders directly rather than asserting a number,
 * because the number is only right while both read `MAX_STUD_SPACING_IN`.
 */
describe("⚠ a gable tile's studs stack on the wall panel below it", () => {
  const verticalXsIn = (members: PanelMember[]) =>
    [...new Set(members.filter((m) => m.memberId.startsWith("stud_centre_")).map((m) => m.position.xIn))].sort(
      (a, b) => a - b,
    );

  for (const widthIn of [24, 32, 40, 48, 72, 96]) {
    it(`${widthIn}in: every centre stud is at the same x in both`, () => {
      const wall = buildStandardPanelMembers(widthIn, DEPTH_IN, 120, false);
      const gable = buildGablePanelMembers(widthIn, DEPTH_IN, 30, 30 + widthIn / 2, false, "blocking");
      expect({ widthIn, gable: verticalXsIn(gable) }).toEqual({ widthIn, gable: verticalXsIn(wall) });
    });
  }

  it("⚠ a 48in tile really does carry a pair, which is what was missing", () => {
    const gable = buildGablePanelMembers(48, DEPTH_IN, 30, 54, false, "blocking");
    const centres = gable.filter((m) => m.memberId.startsWith("stud_centre_"));
    expect(centres).toHaveLength(2);
    expect(centres.map((m) => m.position.xIn)).toEqual([22.25, 22.25]);
  });

  it("is cut to the sloped plate above it, not to a wall panel's full height", () => {
    const gable = buildGablePanelMembers(48, DEPTH_IN, 30, 54, false, "blocking");
    const stud = gable.find((m) => m.memberId === "stud_centre_1_exterior")!;
    const c = stud.position.trapezoidCornersIn!;
    /* Level on the bottom plate, raked on top: the two top corners differ by
       the pitch across the stud's own 3 1/2in. */
    expect(c[0]!.zIn).toBe(c[1]!.zIn);
    expect(c[2]!.zIn).toBeGreaterThan(c[3]!.zIn);
    expect(c[2]!.zIn - c[3]!.zIn).toBeCloseTo((24 / 48) * 3.5, 6);
    /* And it reaches the top plate's own underside, so nothing floats. */
    const plate = gable.find((m) => m.memberId === "top_plate_2x4_ext")!.position.trapezoidCornersIn!;
    const plateUndersideAt = (xIn: number) =>
      plate[3]!.zIn + ((plate[2]!.zIn - plate[3]!.zIn) * (xIn - plate[3]!.xIn)) / (plate[2]!.xIn - plate[3]!.xIn);
    expect(c[3]!.zIn).toBeCloseTo(plateUndersideAt(c[3]!.xIn), 6);
  });

  it("⚠ omits the stud where the taper has already made the two plates one board", () => {
    /* A tile 3in at its low edge: at x = 22.25 there is no room between the
       bottom plate and the merged wedge, so no board is invented. */
    const sliver = buildGablePanelMembers(48, DEPTH_IN, 1.5, 25.5, false, "blocking");
    for (const m of sliver) expect({ id: m.memberId, neg: m.actualDimsIn.lengthIn < 0 }).toEqual({ id: m.memberId, neg: false });
    expect(overlappingMemberPairs(sliver)).toEqual([]);
  });
});
