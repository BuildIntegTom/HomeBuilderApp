import { describe, expect, it } from "vitest";
import {
  buildFloorRoofPanelMembers,
  floorRoofMitreAngleDeg,
  floorRoofMitreZRangeIn,
  floorRoofPanelCutLengthIn,
  hasFloorRoofMitre,
  NO_FLOOR_ROOF_MITRE,
  type FloorRoofPanelOptions,
} from "./floorRoofPanelMembers";
import { memberPrism } from "./memberPrism";

/**
 * ⚠ **A DECK PANEL CUT TO THE BUILDING, NOT TO ITS BOUNDING BOX.**
 *
 * > *"can we have the roof be basically cut to fit the raised octagon gable
 * > perimeter? roof panels resting on top of gable panels for shed
 * > octagon."* — Tommy, 2026-11-15, choosing **mitred ends** over a stepped
 * > edge or keeping the overhang as an eave, and asking for the floor to get
 * > the same treatment.
 *
 * And the two fabrication answers that made the part buildable, both of which
 * were put to him rather than guessed:
 *
 * - at a mitred end, the **joist is bevelled to meet the rim flush**;
 * - the angled end lid is **one bevelled board**, not stepped blocking.
 */

const FLOOR: FloorRoofPanelOptions = {
  kind: "floor",
  widthIn: 48,
  depthIn: 15.5,
  lengthIn: 192,
  structuralGirtEnds: ["start", "end"],
};

/** The 16ft Octagon's own leading corner: the deck's first panel sits wholly
 *  on the corner triangles, so it is narrow at its near edge and wider at its
 *  far edge. These are the numbers `deckPanelCut` measures on that building. */
const LEADING: FloorRoofPanelOptions = {
  ...FLOOR,
  widthIn: 28.125,
  mitreIn: { startNearIn: 56.25, startFarIn: 28.125, endNearIn: 56.25, endFarIn: 28.125 },
};

describe("⚠ a rectangle is built exactly as it was before the mitre existed", () => {
  /* THE safety property. Every box building in the app goes down this path,
     and the mitre must be invisible to it — not merely close. */
  it("no mitre at all leaves the members byte-identical", () => {
    const plain = buildFloorRoofPanelMembers(FLOOR);
    const withEmpty = buildFloorRoofPanelMembers({
      ...FLOOR,
      mitreIn: { startNearIn: 0, startFarIn: 0, endNearIn: 0, endFarIn: 0 },
    });
    expect(withEmpty).toEqual(plain);
  });

  it("⚠ an all-zero mitre is not a mitre", () => {
    expect(hasFloorRoofMitre(FLOOR)).toBe(false);
    expect(hasFloorRoofMitre({ ...FLOOR, mitreIn: { startNearIn: 0, startFarIn: 0, endNearIn: 0, endFarIn: 0 } })).toBe(
      false,
    );
    expect(hasFloorRoofMitre(LEADING)).toBe(true);
  });

  it("a rectangle's joists are plain boxes, with no trapezoid corners", () => {
    for (const m of buildFloorRoofPanelMembers(FLOOR).filter((j) => j.memberId.startsWith("joist-"))) {
      expect(m.position.trapezoidCornersIn).toBeUndefined();
    }
  });
});

describe("⚠ the cut itself", () => {
  it("the span available varies linearly across the width", () => {
    expect(floorRoofMitreZRangeIn(LEADING, 0)).toEqual({ startIn: 56.25, endIn: 192 - 56.25 });
    expect(floorRoofMitreZRangeIn(LEADING, LEADING.widthIn)).toEqual({ startIn: 28.125, endIn: 192 - 28.125 });
    /* Halfway across, halfway between. */
    const mid = floorRoofMitreZRangeIn(LEADING, LEADING.widthIn / 2);
    expect(mid.startIn).toBeCloseTo((56.25 + 28.125) / 2, 9);
  });

  it("⚠ `lengthIn` stays the ENVELOPE; the long point is its own number", () => {
    expect(LEADING.lengthIn).toBe(192);
    /* Near edge: 192 - 2x56.25 = 79.5. Far edge: 192 - 2x28.125 = 135.75. */
    expect(floorRoofPanelCutLengthIn(LEADING)).toBeCloseTo(135.75, 6);
    expect(floorRoofPanelCutLengthIn(FLOOR)).toBeCloseTo(192, 6);
  });

  it("the plan angle is what the saw is set to", () => {
    /* 28.125in of rise over 28.125in of width is 45 degrees — the octagon's
       own facet, which is the whole reason this case exists. */
    expect(floorRoofMitreAngleDeg(LEADING, "start")).toBeCloseTo(45, 6);
    expect(floorRoofMitreAngleDeg(LEADING, "end")).toBeCloseTo(45, 6);
    expect(floorRoofMitreAngleDeg(FLOOR, "start")).toBe(0);
  });
});

describe("⚠ the joists — bevelled to meet the rim flush, his answer", () => {
  const members = buildFloorRoofPanelMembers(LEADING);
  const joists = members.filter((m) => m.memberId.startsWith("joist-"));

  it("there are still four of them — the double double is untouched", () => {
    expect(joists).toHaveLength(4);
  });

  it("⚠ the two joists of a panel are DIFFERENT LENGTHS", () => {
    const left = joists.find((m) => m.memberId === "joist-left-bottom")!;
    const right = joists.find((m) => m.memberId === "joist-right-bottom")!;
    expect(Math.abs(left.actualDimsIn.lengthIn - right.actualDimsIn.lengthIn)).toBeGreaterThan(1);
    /* The right joist is nearer the panel's wide edge, so it is the longer. */
    expect(right.actualDimsIn.lengthIn).toBeGreaterThan(left.actualDimsIn.lengthIn);
  });

  it("every joist carries a real four-cornered bevel in the X-Z plane", () => {
    for (const m of joists) {
      expect(m.position.trapezoidCornersIn, m.memberId).toHaveLength(4);
      expect(m.position.sectionCornersIn, `${m.memberId} must not carry both planes`).toBeUndefined();
      expect(m.position.trapezoidDepthIn).toBeCloseTo(5.5, 9);
    }
  });

  it("⚠ its `yIn` is the CENTRE, so the prism lands inside the panel", () => {
    /* The trap: every box in this builder anchors on its min corner, and
       `memberPrism` reads a trapezoid as yIn +/- depth/2. Keeping the box's
       own yIn would push each joist half of its 5 1/2in out of the panel —
       invisible on screen, and exactly what the overlap audit measures. */
    for (const m of joists) {
      const prism = memberPrism(m);
      expect(prism.axis).toBe("y");
      expect(prism.lo, m.memberId).toBeGreaterThanOrEqual(-1e-9);
      expect(prism.hi, m.memberId).toBeLessThanOrEqual(LEADING.depthIn + 1e-9);
    }
  });

  it("⚠ no joist reaches past the cut", () => {
    for (const m of joists) {
      for (const c of m.position.trapezoidCornersIn!) {
        const clear = floorRoofMitreZRangeIn(LEADING, c.xIn);
        expect(c.zIn, `${m.memberId} at x=${c.xIn}`).toBeGreaterThanOrEqual(clear.startIn - 1e-6);
        expect(c.zIn, `${m.memberId} at x=${c.xIn}`).toBeLessThanOrEqual(clear.endIn + 1e-6);
      }
    }
  });

  it("the bevel angle is on the shop note, both ends named", () => {
    const note = joists[0]!.notes ?? "";
    expect(note).toContain("start end mitred 45.00deg off square in plan");
    expect(note).toContain("end end mitred 45.00deg off square in plan");
    expect(note).toMatch(/Long point [\d.]+in, short point [\d.]+in/);
  });
});

describe("⚠ the end lid — one bevelled board, his answer over stepped blocking", () => {
  const members = buildFloorRoofPanelMembers(LEADING);

  it("⚠ the 2x4 face TURNS to run along the cut, tiled through the DEPTH", () => {
    const face = members.filter((m) => m.memberId.startsWith("lid-start-face-"));
    /* 15 1/2in of depth: four 3 1/2in boards and a fifth ripped to 1 1/2in.
       Across the width it would have been eight on this 28in panel, and the
       steps are what he rejected. */
    expect(face).toHaveLength(5);
    expect(face.map((m) => m.actualDimsIn.widthIn)).toEqual([3.5, 3.5, 3.5, 3.5, 1.5]);
    expect(face.at(-1)!.notes).toContain("ripped to 1.5in wide");
  });

  it("each board is cut to the CUT LINE's length, not the panel's width", () => {
    const face = members.filter((m) => m.memberId.startsWith("lid-start-face-"));
    /* 28.125in across by 28.125in of rise: the hypotenuse, 39.77in. A board
       cut to the panel's 28.125in width would fall 11 5/8in short. */
    const expected = Math.hypot(28.125, 28.125);
    expect(expected).toBeCloseTo(39.7748, 3);
    for (const m of face) expect(m.actualDimsIn.lengthIn).toBeCloseTo(expected, 6);
  });

  it("the skin is plywood and sits OUTSIDE the face, measured perpendicular to the cut", () => {
    const skin = members.find((m) => m.memberId === "lid-start-skin")!;
    const face = members.find((m) => m.memberId === "lid-start-face-0")!;
    expect(skin.material).toBe("plywood");
    expect(skin.position.trapezoidCornersIn).toHaveLength(4);
    /* Outside = nearer the cut = smaller Z at the start end. */
    expect(Math.min(...skin.position.trapezoidCornersIn!.map((c) => c.zIn))).toBeLessThan(
      Math.min(...face.position.trapezoidCornersIn!.map((c) => c.zIn)),
    );
  });

  it("⚠ the lid band is THICKER along Z than its own layer, because the cut is angled", () => {
    const skin = members.find((m) => m.memberId === "lid-start-skin")!;
    const corners = skin.position.trapezoidCornersIn!;
    /* A 3/4in skin against a 45deg cut occupies 3/4 / cos45 = 1.0607in of
       span. Placing it by its own 3/4in would leave a wedge of air outside
       the plywood. Measured at one edge, so the slope does not confuse it:
       corner 0 is x=0 at the cut face, corner 3 is x=0 at its inboard face. */
    expect(corners[3]!.zIn - corners[0]!.zIn).toBeCloseTo(0.75 * Math.SQRT2, 6);
  });

  it("a panel mitred at one end only keeps a plain lid at the other", () => {
    const oneEnd = buildFloorRoofPanelMembers({
      ...FLOOR,
      mitreIn: { startNearIn: 0, startFarIn: 0, endNearIn: 24, endFarIn: 0 },
    });
    /* The square start end still tiles its face across the width: a 48in
       panel takes fourteen 3 1/2in boards. */
    expect(oneEnd.filter((m) => m.memberId.startsWith("lid-start-face-"))).toHaveLength(14);
    expect(oneEnd.find((m) => m.memberId === "lid-start-skin")!.position.trapezoidCornersIn).toBeUndefined();
    /* The mitred end turns. */
    expect(oneEnd.filter((m) => m.memberId.startsWith("lid-end-face-"))).toHaveLength(5);
  });
});

describe("⚠ girts and blocking are clipped, or are not built", () => {
  it("a rectangle's girts span the full clear width between the joists", () => {
    const webs = buildFloorRoofPanelMembers(FLOOR).filter((m) => m.memberId.endsWith("-web"));
    expect(webs.length).toBeGreaterThan(0);
    for (const m of webs) expect(m.actualDimsIn.lengthIn).toBeCloseTo(48 - 3, 9);
  });

  it("⚠ nothing a mitred panel builds reaches outside the cut", () => {
    for (const m of buildFloorRoofPanelMembers(LEADING)) {
      const prism = memberPrism(m);
      /* Every member's own polygon, in whichever plane it is drawn, tested
         against the panel's real outline at each of its corners. */
      const points = m.position.trapezoidCornersIn
        ? m.position.trapezoidCornersIn.map((c) => ({ xIn: c.xIn, zIn: c.zIn }))
        : prism.axis === "y"
          ? prism.polygon.map((p) => ({ xIn: p.u, zIn: p.v }))
          : [];
      for (const p of points) {
        const clear = floorRoofMitreZRangeIn(LEADING, p.xIn);
        expect(p.zIn, `${m.memberId} at x=${p.xIn.toFixed(3)}`).toBeGreaterThanOrEqual(clear.startIn - 1e-6);
        expect(p.zIn, `${m.memberId} at x=${p.xIn.toFixed(3)}`).toBeLessThanOrEqual(clear.endIn + 1e-6);
      }
    }
  });

  it("a station entirely outside the cut builds no girt at all", () => {
    /* Cut so hard that most of the panel's far edge is gone: 48in wide,
       pulled back 150 of its 192in there. */
    const severe = buildFloorRoofPanelMembers({
      ...FLOOR,
      mitreIn: { startNearIn: 0, startFarIn: 150, endNearIn: 0, endFarIn: 0 },
    });
    const webs = severe.filter((m) => m.memberId.endsWith("-web"));
    /* Some survive, clipped — and every one that does is inside the cut. */
    for (const m of webs) {
      expect(m.actualDimsIn.lengthIn).toBeLessThanOrEqual(48 - 3 + 1e-9);
      expect(m.actualDimsIn.lengthIn).toBeGreaterThan(0);
    }
  });
});

describe("⚠ a roof panel's mitre is BUILT now — his plumb cut, 2026-11-18", () => {
  const ROOF: FloorRoofPanelOptions = {
    kind: "roof",
    widthIn: 48,
    depthIn: 15.5,
    lengthIn: 192,
    structuralGirtEnds: [],
    pitchIn12: 4,
    bearingSeatDepthIn: 15.5,
  };

  it("⚠ the panel CHANGES, where it used to come back byte-identical", () => {
    /* This asserted the opposite until 2026-11-18: a roof's mitre was dropped
       and `floorRoofMitreUnsupportedReason` said why. He answered both of that
       refusal's reasons — "i dont think there should be any wedges?" and "i
       imagined roof panels to be cut plumb vertically when plan view looking
       down on the building" — and a plumb cut needs no general polyhedron. */
    const asked = buildFloorRoofPanelMembers({ ...ROOF, mitreIn: LEADING.mitreIn });
    expect(asked).not.toEqual(buildFloorRoofPanelMembers(ROOF));
  });

  it("⚠ and the plumb END CUT survives the mitre, which is the whole trick", () => {
    const asked = buildFloorRoofPanelMembers({ ...ROOF, mitreIn: LEADING.mitreIn });
    const joist = asked.find((m) => m.memberId === "joist-left-bottom")!;
    /* Still a SECTION prism — the end cuts it carries are in the Y-Z plane and
       the mitre is a shift in Z across X, so the two compose instead of one
       overwriting the other. A trapezoid here would mean the plumb cut had
       been thrown away. */
    expect(joist.position.sectionCornersIn).toBeDefined();
    expect(joist.position.trapezoidCornersIn).toBeUndefined();
    /* And the second face is what carries the mitre. */
    expect(joist.position.sectionFarCornersIn).toBeDefined();
  });

  it("⚠ the eave joist's FIVE-cornered section survives too", () => {
    /* The reason a quad-based mechanism could not have done this: the top
       chord's eave section has a taper kink, so it has five corners. A plumb
       cut slides them; it does not reshape them. */
    const asked = buildFloorRoofPanelMembers({ ...ROOF, mitreIn: LEADING.mitreIn });
    const top = asked.find((m) => m.memberId === "joist-left-top")!;
    expect(top.position.sectionCornersIn).toHaveLength(5);
    expect(top.position.sectionFarCornersIn).toHaveLength(5);
  });

  it("a square roof panel is untouched, byte for byte", () => {
    expect(buildFloorRoofPanelMembers({ ...ROOF, mitreIn: NO_FLOOR_ROOF_MITRE })).toEqual(
      buildFloorRoofPanelMembers(ROOF),
    );
  });
});
