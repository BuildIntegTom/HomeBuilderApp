import { describe, expect, it } from "vitest";
import type { PanelMember, PanelSpacePoint2D } from "./componentSchema";
import { describeBraceEndCuts, faceAcrossFieldOf, faceShearAcrossIn } from "./panelMemberHelpers";
import { describeEndCutForShop, JIG_MODEL_TOLERANCE_IN, missingTriangleFor } from "./shopCutNotes";

/**
 * ⚠ **THE JIG CHECK ON A COMPOUND CUT — the identity it was built on holds in
 * ONE PLANE ONLY.**
 *
 * `missingTriangleFor` asked whether `cutEdgeLengthIn * cos(angle)` matches the
 * stock the jig is cut from. That product is the across-extent of the member's
 * **near face**, and a board leaning out of the elevation plane is drawn as a
 * raked section of itself — so its face reads wider than the board is and the
 * sheet reported a disagreement that did not exist.
 *
 * Measured 2026-11-25, the dual-bevelled gable plates of the 16ft Octagon:
 * each read **0.038968in** out on a board whose solid is exactly 1.5000in.
 * `roofMitreEndPlate`'s two studs were worse — *"~1 15/16in off this stock
 * width"* on boards a test measures at 3.5000 x 1.5000.
 *
 * The geometry is derived in `faceShearAcrossIn`; this file pins the two
 * properties that make it right rather than merely smaller, and the numbers
 * here are built from first principles so a wrong formula cannot satisfy them.
 */

/* A 1:3 rake — tan 18.4349deg — so every figure below is exact in closed form. */
const RUN = 3;
const FALL = 1;
const LENGTH_ALONG_X = 30;
const DEPTH_IN = 3.5;
/** cos of the drawn length's rake: the `ux` of the derivation. */
const UX = RUN / Math.hypot(RUN, FALL);

/**
 * A raked board's near face, plumb-cut at both ends, whose two long edges are
 * exactly `inPlaneAcrossIn` apart measured perpendicular to the rake.
 *
 * A plumb end edge is vertical, so its own length is `across / cos(rake)` —
 * which is why the face's across-extent and the board's thickness are two
 * different numbers even before anything leans.
 */
function rakedFace(inPlaneAcrossIn: number): [PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D] {
  const dropIn = inPlaneAcrossIn / UX;
  const topLeftZ = 20;
  const topRightZ = topLeftZ - (LENGTH_ALONG_X * FALL) / RUN;
  return [
    { xIn: 0, zIn: topLeftZ },
    { xIn: LENGTH_ALONG_X, zIn: topRightZ },
    { xIn: LENGTH_ALONG_X, zIn: topRightZ - dropIn },
    { xIn: 0, zIn: topLeftZ - dropIn },
  ];
}

/** The same face shifted bodily through the depth by `(dxIn, dzIn)`. */
function shiftedFace(
  face: readonly PanelSpacePoint2D[],
  dxIn: number,
  dzIn: number,
): PanelSpacePoint2D[] {
  return face.map((c) => ({ xIn: c.xIn + dxIn, zIn: c.zIn + dzIn }));
}

describe("a compound cut's own across-dimension", () => {
  it("⚠ a DUAL-BEVELLED board is not as thick as its drawn face, and the model knows", () => {
    /* Built backwards from the answer: a 1 1/2in board leaning 1.2in across 3 1/2in
       of depth draws a face 1.577in across. Nothing here rounds. */
    const trueThicknessIn = 1.5;
    const crossFallIn = 1.2;
    const factor = Math.hypot(1, (UX * crossFallIn) / DEPTH_IN);
    const inPlaneAcrossIn = trueThicknessIn * factor;
    expect(inPlaneAcrossIn).toBeCloseTo(1.577352, 6);

    const near = rakedFace(inPlaneAcrossIn);
    const far = shiftedFace(near, 0, -crossFallIn);

    /* With only the near face in hand, the single-plane identity is all there
       is — and it reads the raked section, not the board. */
    const [flat] = describeBraceEndCuts(near);
    expect(flat.modelAcrossIn).toBeUndefined();
    expect(flat.cutEdgeLengthIn * Math.cos((flat.angleDeg * Math.PI) / 180)).toBeCloseTo(inPlaneAcrossIn, 9);

    /* Given the far face, it reads the solid — exactly 1.5000in. */
    const [a, b] = describeBraceEndCuts(near, { farCornersIn: far, depthIn: DEPTH_IN });
    expect(a.modelAcrossIn).toBeCloseTo(trueThicknessIn, 9);
    expect(b.modelAcrossIn).toBeCloseTo(trueThicknessIn, 9);
    /* Both ends agree, because the lean belongs to the board and not to an end. */
    expect(a.modelAcrossIn).toBeCloseTo(b.modelAcrossIn!, 12);
  });

  it("⚠ so the CHECK goes quiet on it — and FIRES on the same board read flat", () => {
    const trueThicknessIn = 1.5;
    const crossFallIn = 1.2;
    const inPlaneAcrossIn = trueThicknessIn * Math.hypot(1, (UX * crossFallIn) / DEPTH_IN);
    const near = rakedFace(inPlaneAcrossIn);
    const far = shiftedFace(near, 0, -crossFallIn);

    const [aware] = describeBraceEndCuts(near, { farCornersIn: far, depthIn: DEPTH_IN });
    expect(missingTriangleFor(aware, trueThicknessIn)!.modelDisagreementIn).toBeLessThan(1e-9);
    expect(describeEndCutForShop(aware, trueThicknessIn)).not.toContain("CHECK:");

    /* The defect, stated as a measurement: 0.0774in on a board that is right. */
    const [blind] = describeBraceEndCuts(near);
    const wasOutIn = missingTriangleFor(blind, trueThicknessIn)!.modelDisagreementIn;
    expect(wasOutIn).toBeCloseTo(0.077352, 6);
    expect(wasOutIn).toBeGreaterThan(JIG_MODEL_TOLERANCE_IN);
    expect(describeEndCutForShop(blind, trueThicknessIn)).toContain("CHECK:");
  });

  it("⚠ NOT cos(mitre) x cos(bevel): a lean ALONG the board does not thicken it", () => {
    /* The property that settles the form of the relation. `faceShearAcrossIn`
       is a 2D CROSS product, so only the shear perpendicular to the board's own
       length counts — and a board raked square to the fall is untouched by a
       bevel however steep. A `cos(bevel)` factor would thin it. */
    const near = rakedFace(1.5); // a board that genuinely lies flat
    const uz = -FALL / Math.hypot(RUN, FALL);
    /* A shear parallel to the length: (dx, dz) along (ux, uz). */
    const k = 2;
    const alongFar = shiftedFace(near, UX * k, uz * k);
    expect(faceShearAcrossIn(near, { farCornersIn: alongFar, depthIn: DEPTH_IN }, [UX, uz])).toBeCloseTo(0, 12);
    const [along] = describeBraceEndCuts(near, { farCornersIn: alongFar, depthIn: DEPTH_IN });
    expect(along.modelAcrossIn).toBeCloseTo(1.5, 9);

    /* The same magnitude of shear taken ACROSS the length does thin it, and
       that board really is thinner than its drawn face. */
    const acrossFar = shiftedFace(near, 0, -1.2);
    const [across] = describeBraceEndCuts(near, { farCornersIn: acrossFar, depthIn: DEPTH_IN });
    expect(across.modelAcrossIn).toBeCloseTo(1.5 / Math.hypot(1, (UX * 1.2) / DEPTH_IN), 9);
    expect(across.modelAcrossIn!).toBeLessThan(1.5);
  });

  it("⚠ A TRUE DUAL BEVEL — a plan mitre AND a tilt on one board, which is the end plate", () => {
    /* `roofMitreEndPlate`'s pieces lean BOTH ways at once: the plan mitre moves
       the far face in x and the roof's pitch moves it in z. Tommy's own
       measurement of them — *"skin swings 46.5deg / tilts 18.4deg; the 2x4s swing
       3.0deg / tilt 18.4deg"* — and the CHECK read *"~1 15/16in off this stock
       width"* on boards a test measures at exactly 3.5000 x 1.5000.

       ⚠ The two shears do NOT compose as two cosine factors. They are two
       components of ONE lean, so they can partly cancel — which is why the
       relation is a cross product and not a product of cosines. Asserted here
       against the solid's own face separation, computed independently. */
    const trueThicknessIn = 1.5;
    const near = rakedFace(trueThicknessIn); // starts flat; the shear does the rest
    const uz = -FALL / Math.hypot(RUN, FALL);
    const planMitreIn = 0.9;
    const tiltIn = -1.2;
    const far = shiftedFace(near, planMitreIn, tiltIn);

    /* The solid's own answer: the separation of its two long faces, from the
       cross product of the long edge with the sweep. No reuse of the code
       under test. */
    const longEdge: [number, number, number] = [
      near[1]!.xIn - near[0]!.xIn,
      0,
      near[1]!.zIn - near[0]!.zIn,
    ];
    const sweep: [number, number, number] = [planMitreIn, DEPTH_IN, tiltIn];
    const n: [number, number, number] = [
      longEdge[1] * sweep[2] - longEdge[2] * sweep[1],
      longEdge[2] * sweep[0] - longEdge[0] * sweep[2],
      longEdge[0] * sweep[1] - longEdge[1] * sweep[0],
    ];
    const offset: [number, number, number] = [
      near[3]!.xIn - near[0]!.xIn,
      0,
      near[3]!.zIn - near[0]!.zIn,
    ];
    const separationIn =
      Math.abs(offset[0] * n[0] + offset[1] * n[1] + offset[2] * n[2]) / Math.hypot(n[0], n[1], n[2]);

    const [cut] = describeBraceEndCuts(near, { farCornersIn: far, depthIn: DEPTH_IN });
    expect(cut.modelAcrossIn).toBeCloseTo(separationIn, 9);

    /* ⚠ And the cancellation, stated as a number: taken together the two leans
       thin this board LESS than the tilt alone does, because the plan mitre
       pulls the other way along its length. A cos x cos factor could not. */
    const [tiltOnly] = describeBraceEndCuts(near, {
      farCornersIn: shiftedFace(near, 0, tiltIn),
      depthIn: DEPTH_IN,
    });
    expect(cut.modelAcrossIn!).toBeGreaterThan(tiltOnly.modelAcrossIn!);
  });

  it("a board with no lean at all reads exactly as it always did", () => {
    /* The single-plane case is the degenerate case of the general one, which is
       what makes this safe to apply everywhere. */
    const near = rakedFace(1.5);
    const [withFar] = describeBraceEndCuts(near, { farCornersIn: near, depthIn: DEPTH_IN });
    const [without] = describeBraceEndCuts(near);
    expect(withFar.modelAcrossIn).toBeCloseTo(1.5, 12);
    expect(without.cutEdgeLengthIn).toBeCloseTo(withFar.cutEdgeLengthIn, 12);
    expect(without.angleDeg).toBeCloseTo(withFar.angleDeg, 12);
  });

  it("⚠ a depth of zero or a mismatched far face is refused, NOT divided by", () => {
    /* ⚠ The NaN this very fix could have introduced: a zero depth would make
       the shear factor 0/0, and `NaN >= JIG_MODEL_TOLERANCE_IN` is FALSE — so
       the CHECK would have gone silent instead of printing rubbish, which is
       the worse of the two failures. Both cases fall back to the single-plane
       identity, which is what a caller with one usable face should get. */
    const near = rakedFace(1.5);
    const far = shiftedFace(near, 0, -1.2);
    expect(faceShearAcrossIn(near, { farCornersIn: far, depthIn: 0 }, [UX, 0])).toBe(0);
    expect(faceShearAcrossIn(near, { farCornersIn: far.slice(0, 3), depthIn: DEPTH_IN }, [UX, 0])).toBe(0);

    for (const bad of [
      { farCornersIn: far, depthIn: 0 },
      { farCornersIn: far, depthIn: -1 },
      { farCornersIn: far.slice(0, 3), depthIn: DEPTH_IN },
    ]) {
      const [cut] = describeBraceEndCuts(near, bad);
      expect(Number.isNaN(cut.modelAcrossIn ?? 0), JSON.stringify(bad.depthIn)).toBe(false);
      const outIn = missingTriangleFor(cut, 1.5)!.modelDisagreementIn;
      expect(Number.isNaN(outIn)).toBe(false);
    }
  });
});

describe("⚠ a board that has run out to a point — the NaN that reached a shop sheet", () => {
  /* The 16ft Octagon's SW gable sliver plate. Two of its four corners coincide,
     so one "end cut" is a zero-length edge; dividing by it printed
     "~NaN deg off square" with a waste triangle "~NaN" along the length", and
     no CHECK at all, on a real cut list. */
  const degenerate: [PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D] = [
    { xIn: 6.4512, zIn: 0.75 },
    { xIn: 19.3535, zIn: 3.7911 },
    { xIn: 19.3535, zIn: 0.75 },
    { xIn: 6.4512, zIn: 0.75 },
  ];

  it("reports no angle rather than NaN", () => {
    const cuts = describeBraceEndCuts(degenerate);
    for (const cut of cuts) {
      expect(Number.isNaN(cut.angleDeg), "angle").toBe(false);
      expect(Number.isNaN(cut.cutEdgeLengthIn), "cut edge").toBe(false);
    }
    const point = cuts.find((c) => c.cutEdgeLengthIn === 0);
    expect(point, "one end really is a point").toBeDefined();
    expect(point!.angleDeg).toBe(0);
    expect(point!.modelAcrossIn).toBe(0);
  });

  it("⚠ and it still CARRIES THE CHECK, because a board with no width is the fault", () => {
    /* The square-crosscut path used to return early with no warning, which is
       how a zero-width board reached a sheet saying only "Square crosscut". */
    const point = describeBraceEndCuts(degenerate).find((c) => c.cutEdgeLengthIn === 0)!;
    const note = describeEndCutForShop(point, 1.5);
    expect(note).toContain("Square crosscut");
    expect(note).toContain("CHECK:");
    expect(note).toContain("1½\"");
    expect(note).not.toContain("NaN");
    /* No jig: there is no triangle to build a block to. */
    expect(note).not.toContain("Waste triangle");
  });

  it("a genuinely square end on a sound board still says nothing extra", () => {
    const square = describeBraceEndCuts(rakedFaceSquareEnded())[0]!;
    expect(describeEndCutForShop(square, 1.5)).toBe("Square crosscut — lands level.");
  });
});

/** A board whose ends are square across its own length: a plain rectangle. */
function rakedFaceSquareEnded(): [PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D] {
  return [
    { xIn: 0, zIn: 0 },
    { xIn: 1.5, zIn: 0 },
    { xIn: 1.5, zIn: 40 },
    { xIn: 0, zIn: 40 },
  ];
}

describe("⚠ which stock dimension crosses the drawn face", () => {
  /* The other half of the fix, and the bigger half: the cut list compared the
     model against `widthIn` for every member, but a cut list draws a board in
     ELEVATION. `memberBoxSizeIn` puts the panel's DEPTH on Y, so the face spans
     X and Z and the across-dimension is whichever of thickness and width is not
     the Y one. */
  function member(orientation: PanelMember["orientation"], rotationDeg: number): PanelMember {
    return {
      memberId: "probe",
      material: "dimensional_lumber",
      speciesGrade: null,
      plySpec: null,
      nominalSize: "2x4",
      actualDimsIn: { thicknessIn: 1.5, widthIn: 3.5, lengthIn: 96 },
      orientation,
      position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg },
      role: "stud",
      qty: 1,
    };
  }

  it("a stud ON EDGE and a plate or skin lying FLAT are all drawn on their narrow face", () => {
    /* `memberBoxSizeIn`: vertical 0deg is X=thickness Y=width; flat is Y=width. The
       saw crosses 1 1/2in of a 2x4 stud and 3/4in of a sheet, never the 3 1/2in or
       15 1/2in the sheet used to print. */
    expect(faceAcrossFieldOf(member("vertical", 0))).toBe("thicknessIn");
    expect(faceAcrossFieldOf(member("flat", 0))).toBe("thicknessIn");
    expect(faceAcrossFieldOf(member("diagonal", 0))).toBe("thicknessIn");
  });

  it("⚠ a nailer or a braced panel's chevron IS drawn on its wide face", () => {
    /* Which is why `widthIn` looked right: the chevron brace is the member this
       file's jig note was first measured against, and it is one of the few that
       really does lie in the elevation plane. */
    expect(faceAcrossFieldOf(member("diagonal", 90))).toBe("widthIn");
    expect(faceAcrossFieldOf(member("vertical", 90))).toBe("widthIn");
    expect(faceAcrossFieldOf(member("horizontal", 0))).toBe("widthIn");
  });

  it("⚠ and the two orientations whose DEPTH is their length get no reading", () => {
    /* A face that does not show the board's length has no across-the-length
       dimension to give. No builder emits one today; a caller that meets one
       should keep the CHECK loud rather than pick a field. */
    expect(faceAcrossFieldOf(member("horizontal", 90))).toBeNull();
    expect(faceAcrossFieldOf(member("horizontal", 180))).toBeNull();
  });
});
