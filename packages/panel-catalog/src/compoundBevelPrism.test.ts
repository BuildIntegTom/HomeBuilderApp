import { describe, expect, it } from "vitest";
import type { PanelMember, PanelSpacePoint2D } from "./componentSchema";
import { memberLocalCornersIn, memberFaceIndices } from "./panelMemberHelpers";
import { memberIsOblique, memberPrism, membersOverlap } from "./memberPrism";

/**
 * ⚠ **A COMPOUND ("DUAL") BEVEL IS A SHEARED TRAPEZOID PRISM.**
 *
 * > *"can we make the top of Gable and dual beveled So that the roof can meet
 * > it?"* — Tommy, 2026-11-16
 *
 * `trapezoidCornersIn` rakes a board in the panel's elevation plane and runs
 * it straight through the depth. A roof falling THROUGH the wall as well as
 * along it needs the second tilt, and this file pins the one field that adds
 * it — including the two places that must read it the same way (the drawn
 * solid and the overlap audit's own solid), because they build the geometry
 * independently and have disagreed before.
 */

const corners = (x0: number, z0: number, x1: number, z1: number, thicknessIn: number) =>
  [
    { xIn: x0, zIn: z0 - thicknessIn },
    { xIn: x1, zIn: z1 - thicknessIn },
    { xIn: x1, zIn: z1 },
    { xIn: x0, zIn: z0 },
  ] as [PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D];

function board(opts: {
  memberId?: string;
  x0?: number;
  x1?: number;
  z0?: number;
  z1?: number;
  yIn: number;
  depthIn: number;
  thicknessIn?: number;
  crossRiseIn?: number;
  /** Only the TOP two corners move through the depth — a stud, whose bottom
   *  sits level on the plate below it. */
  topOnly?: boolean;
}): PanelMember {
  const { x0 = 0, x1 = 48, z0 = 40, z1 = 56, yIn, depthIn, thicknessIn = 1.5, crossRiseIn, topOnly } = opts;
  const far = (c: PanelSpacePoint2D, index: number): PanelSpacePoint2D =>
    topOnly && index < 2 ? c : { xIn: c.xIn, zIn: c.zIn + (crossRiseIn ?? 0) };
  return {
    memberId: opts.memberId ?? "board",
    material: "dimensional_lumber",
    speciesGrade: null,
    plySpec: null,
    nominalSize: "2x4",
    actualDimsIn: { thicknessIn, widthIn: depthIn, lengthIn: Math.hypot(x1 - x0, z1 - z0) },
    orientation: "diagonal",
    position: {
      xIn: (x0 + x1) / 2,
      yIn,
      zIn: (z0 + z1) / 2 - thicknessIn / 2,
      rotationDeg: 0,
      tiltDeg: 0,
      trapezoidCornersIn: corners(x0, z0, x1, z1, thicknessIn),
      trapezoidDepthIn: depthIn,
      ...(crossRiseIn !== undefined && {
        trapezoidFarCornersIn: corners(x0, z0, x1, z1, thicknessIn).map(far) as [
          PanelSpacePoint2D,
          PanelSpacePoint2D,
          PanelSpacePoint2D,
          PanelSpacePoint2D,
        ],
      }),
    },
    role: "plate",
    qty: 1,
  };
}

describe("⚠ absent or zero is byte-identical to a plain trapezoid prism", () => {
  /* The safety property. Every trapezoid in this app was written before this
     field existed and must keep its exact geometry. */
  const plain = board({ yIn: 7.75, depthIn: 15.5 });
  for (const [label, member] of [
    ["undefined", plain],
    ["explicit 0", board({ yIn: 7.75, depthIn: 15.5, crossRiseIn: 0 })],
  ] as const) {
    it(`${label} draws the same eight corners`, () => {
      expect(memberLocalCornersIn(member)).toEqual(memberLocalCornersIn(plain));
    });
    it(`${label} makes the same prism, and is not oblique`, () => {
      expect(memberIsOblique(member)).toBe(false);
      expect(memberPrism(member)).toEqual(memberPrism(plain));
    });
  }

  it("and the topology is unchanged — still a box's six quads", () => {
    expect(memberFaceIndices(board({ yIn: 7.75, depthIn: 15.5, crossRiseIn: 3.653 }))).toEqual(
      memberFaceIndices(plain),
    );
  });
});

describe("⚠ the shear itself", () => {
  const RISE = 3.653;
  const sheared = board({ yIn: 7.75, depthIn: 15.5, crossRiseIn: RISE });

  it("⚠ `trapezoidCornersIn` is the NEAR depth face and the far one climbs", () => {
    /* `memberLocalCornersIn` returns VIEW space: [x, up, depth]. The first
       four corners are the near depth face, the last four the far one. */
    const drawn = memberLocalCornersIn(sheared);
    const plain = memberLocalCornersIn(board({ yIn: 7.75, depthIn: 15.5 }));
    for (let i = 0; i < 4; i++) {
      expect(drawn[i]![1]).toBeCloseTo(plain[i]![1], 9);
      expect(drawn[i + 4]![1]).toBeCloseTo(plain[i + 4]![1] + RISE, 9);
      /* Only the height moves. The rake and the depth are untouched. */
      expect(drawn[i]![0]).toBe(plain[i]![0]);
      expect(drawn[i]![2]).toBe(plain[i]![2]);
    }
  });

  it("the prism is reported OBLIQUE, which is what routes the audit to 3D", () => {
    expect(memberIsOblique(sheared)).toBe(true);
    expect(memberIsOblique(board({ yIn: 7.75, depthIn: 15.5 }))).toBe(false);
  });

  it("a NEGATIVE rise tilts the other way — both signs occur on one octagon", () => {
    const down = board({ yIn: 7.75, depthIn: 15.5, crossRiseIn: -RISE });
    const drawn = memberLocalCornersIn(down);
    expect(drawn[4]![1]).toBeCloseTo(drawn[0]![1] - RISE, 9);
    expect(memberIsOblique(down)).toBe(true);
  });

  it("⚠ a STUD keeps its bottom level while its top follows the plane", () => {
    /* The case a single shear number cannot express, and the one that pushed a
       stud through the bottom skin when it was tried. */
    const stud = board({ yIn: 1.75, depthIn: 3.5, z0: 40, z1: 40, crossRiseIn: 2, topOnly: true });
    const drawn = memberLocalCornersIn(stud);
    const bottoms = drawn.filter((c) => c[1] < 39.9).map((c) => c[1]);
    expect(Math.max(...bottoms) - Math.min(...bottoms), "the bottom stays flat").toBeLessThan(1e-9);
    const tops = drawn.filter((c) => c[1] >= 39.9).map((c) => c[1]);
    expect(Math.max(...tops) - Math.min(...tops)).toBeCloseTo(2, 9);
  });
});

describe("⚠ the overlap audit stays exact where it matters", () => {
  const RISE = 3.653;
  /* A gable top assembly, in miniature: the full-depth skin, the two 2x4
     plates stacked under it, and a stud standing on the plate. All four read
     ONE roof plane.

     ⚠ **THE TRAP, and the first draft of this fixture fell in it.** A
     member's near-face corners are read at ITS OWN depth, so a member sitting
     at a different depth from its neighbour must take its heights from the
     shared plane there — not copy the neighbour's. Giving both plates the
     skin's own corner heights put the exterior plate 1.41in up inside the
     skin, which the audit correctly reported. Every builder writing a compound
     bevel has to apply the same offset, and it looks fine in elevation when it
     is missing. */
  const RATE = RISE / 15.5;
  const onPlane = (zAtExteriorFaceIn: number, yIn: number) => zAtExteriorFaceIn + RATE * yIn;
  const skin = board({
    memberId: "skin",
    yIn: 7.75,
    depthIn: 15.5,
    thicknessIn: 0.75,
    z0: onPlane(40, 0),
    z1: onPlane(56, 0),
    crossRiseIn: RISE,
  });
  const plate = (memberId: string, yIn: number) =>
    board({
      memberId,
      yIn,
      depthIn: 3.5,
      z0: onPlane(40 - 0.75, yIn - 1.75),
      z1: onPlane(56 - 0.75, yIn - 1.75),
      crossRiseIn: RATE * 3.5,
    });
  const plateExt = plate("plate_ext", 1.75);
  const plateInt = plate("plate_int", 13.75);

  it("⚠ the skin and the plates beneath it do NOT overlap — exactly, not by a hull", () => {
    /* This is the pair that fails if an oblique prism is approximated by the
       hull of its two faces: the skin would widen by 3.653in and each plate by
       0.825in, closing the 3/4in between them and reporting a guaranteed
       overlap on every octagon facet. */
    for (const p of [plateExt, plateInt]) {
      expect(membersOverlap(skin, p).overlaps, p.memberId).toBe(false);
      expect(membersOverlap(skin, p).mixedAxes).toBe(false);
    }
  });

  it("the two plates are apart through the depth, as they were before", () => {
    expect(membersOverlap(plateExt, plateInt).overlaps).toBe(false);
  });

  it("⚠ a stud whose top is cut to the plane does not reach into it", () => {
    /* The hull route reports this one too: the stud's top at the high depth
       face stands 0.825in above the plate's underside at the low face, so a
       hulled comparison always collides. */
    const stud = board({
      memberId: "stud",
      x0: 10,
      x1: 11.5,
      yIn: 1.75,
      depthIn: 3.5,
      z0: onPlane(40 - 0.75 - 1.5, 0),
      z1: onPlane(40 - 0.75 - 1.5, 0),
      crossRiseIn: RATE * 3.5,
      topOnly: true,
    });
    expect(membersOverlap(stud, plateExt).overlaps).toBe(false);
  });

  it("⚠ a real overlap is still caught", () => {
    const raised = board({
      memberId: "plate_raised",
      yIn: 1.75,
      depthIn: 3.5,
      z0: onPlane(40 - 0.75, 0) + 0.5,
      z1: onPlane(56 - 0.75, 0) + 0.5,
      crossRiseIn: RATE * 3.5,
    });
    expect(membersOverlap(skin, raised).overlaps).toBe(true);
  });

  it("⚠ a bevelled member against a LEVEL one is still exact, not conservative", () => {
    const level = board({ memberId: "level", yIn: 1.75, depthIn: 3.5, z0: 20, z1: 20 });
    expect(membersOverlap(skin, level)).toEqual({ overlaps: false, mixedAxes: false });
    /* And one that really is in the way. */
    const through = board({ memberId: "through", yIn: 1.75, depthIn: 3.5, z0: 41, z1: 41 });
    expect(membersOverlap(skin, through).overlaps).toBe(true);
  });

  it("two plain members are untouched: same answer as always", () => {
    const a = board({ memberId: "a", yIn: 1.75, depthIn: 3.5 });
    const b = board({ memberId: "b", yIn: 13.75, depthIn: 3.5 });
    expect(membersOverlap(a, b)).toEqual({ overlaps: false, mixedAxes: false });
    expect(membersOverlap(a, a)).toEqual({ overlaps: true, mixedAxes: false });
  });
});
