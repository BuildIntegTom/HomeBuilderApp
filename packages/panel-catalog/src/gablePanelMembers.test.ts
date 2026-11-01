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
        for (const stud of studs) expect(stud.actualDimsIn.lengthIn).toBeCloseTo(60 - 1.5, 6);
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

  it("round-trips the top skin's tilt back to its known low/high edge endpoints", () => {
    const members = buildGablePanelMembers(WIDTH_IN, DEPTH_IN, LOW_EDGE_IN, HIGH_EDGE_IN, false);
    const topSkin = members.find((m) => m.memberId === "top_plate_skin")!;
    const size = memberBoxSizeIn(topSkin);
    const tiltRad = (topSkin.position.tiltDeg! * Math.PI) / 180;
    const halfLen = size.zIn / 2;
    const lowX = topSkin.position.xIn + -Math.sin(tiltRad) * halfLen;
    const lowZ = topSkin.position.zIn + Math.cos(tiltRad) * halfLen;
    expect(lowX).toBeCloseTo(0, 4);
    /* ⚠ The centreline sits half a thickness below the edge height measured
       PERPENDICULAR to the board, which is `0.375 / cos(rake)` read
       vertically — not 0.375. Correcting that is what finally put the top
       skin's face plane ON the edge heights it is handed, and so flush with
       the roof above it (Tommy, 2026-10-31). See gableMeetsRoof.test.ts. */
    const rakeRad = Math.atan2(HIGH_EDGE_IN - LOW_EDGE_IN, WIDTH_IN);
    expect(lowZ).toBeCloseTo(LOW_EDGE_IN - 0.375 / Math.cos(rakeRad), 4);
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
