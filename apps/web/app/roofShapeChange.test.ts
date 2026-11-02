import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "@building-integrity/geometry";
import { gableSpanFt, remapEndAnchoredPositions, roofShapeChangeVerdict } from "./roofShapeChange";

/**
 * ⚠ **A RESIZE HAS TO MOVE THE ROOF WITH IT.**
 *
 * > *"When I changed a small shed roof building to 24 x 24, it extended the
 * > shed roof along with one gable end, but the other gable end went to
 * > peaked Gable end style. All the gable ends and roof panels should have
 * > converted to centered ridge beam and two rows of ridge beam resting roof
 * > panels."* — Tommy, 2026-11-01
 *
 * A resize changed the footprint and nothing else, so a building kept the
 * roof its first shape implied. These pin the two ways that goes wrong.
 */

const OPTIONS = { roofEnabled: true, pitchIn12: 4 };

describe("⚠ the roof follows the shape", () => {
  it("⚠ a shed grown past what one run of panels reaches is re-derived as a peak", () => {
    /* His exact case. A 4:12 roof panel reaches about 19ft of ground, so a
       14ft span is a shed and a 24ft span cannot be. */
    const shed = buildRectangleFootprint(24, 14);
    const square = buildRectangleFootprint(24, 24);
    expect(gableSpanFt(shed, true)).toBeCloseTo(14, 6);
    expect(gableSpanFt(square, true)).toBeCloseTo(24, 6);

    const verdict = roofShapeChangeVerdict(shed, square, OPTIONS);
    expect(verdict.rederive).toBe(true);
    expect(verdict.reason).toContain("peaked");
  });

  it("⚠ the gable end pair flipping is re-derived too", () => {
    /* The short pair IS the gable pair. Resize past square and it is the
       other two walls — which is the "weird short backwards north gable
       wall": a row left behind on a wall that is not a gable end any more. */
    const wide = buildRectangleFootprint(30, 16);
    const tall = buildRectangleFootprint(16, 30);
    expect(roofShapeChangeVerdict(wide, tall, OPTIONS).rederive).toBe(true);
    expect(roofShapeChangeVerdict(wide, tall, OPTIONS).reason).toContain("gable end walls changed");
  });

  it("⚠ an ordinary nudge does NOT throw away the roof", () => {
    /* The whole reason this is a verdict and not an unconditional re-derive:
       a two-inch change to a wall must not discard a roofline somebody
       shaped by hand. */
    const a = buildRectangleFootprint(30, 16);
    const b = buildRectangleFootprint(30.2, 16);
    expect(roofShapeChangeVerdict(a, b, OPTIONS).rederive).toBe(false);

    // And a shed that is still a shed keeps its roof.
    expect(roofShapeChangeVerdict(buildRectangleFootprint(24, 14), buildRectangleFootprint(28, 15), OPTIONS).rederive).toBe(
      false,
    );
  });

  it("⚠ an END-ANCHORED shed point moves to the NEW end, which is the half nobody sees", () => {
    /* A shed stores its point at x = 0 on one gable wall and at x = that
       wall's own LENGTH on the other. The second one is an absolute inch
       count that stops meaning "the end" the moment the wall changes length
       — it lands mid-span and reads as a PEAK, while its opposite still
       snaps to a shed. One wall stays a shed and the other becomes a gable. */
    const before = buildRectangleFootprint(24, 14);
    const after = buildRectangleFootprint(28, 14);
    const beforeLenIn = before.walls.find((w) => w.id === "AB")!.lengthFt * 12;
    const afterLenIn = after.walls.find((w) => w.id === "AB")!.lengthFt * 12;
    expect(afterLenIn).not.toBe(beforeLenIn);

    const remapped = remapEndAnchoredPositions(before, after, { AB: [beforeLenIn], CD: [0] });
    expect(remapped.AB).toEqual([afterLenIn]);
    // The one at zero is already at its end and needs nothing.
    expect(remapped.CD).toEqual([0]);
  });

  it("a point somebody dragged into the middle is left exactly where it is", () => {
    const before = buildRectangleFootprint(24, 14);
    const after = buildRectangleFootprint(28, 14);
    expect(remapEndAnchoredPositions(before, after, { AB: [100] }).AB).toEqual([100]);
    expect(remapEndAnchoredPositions(before, after, { AB: [null] }).AB).toEqual([null]);
  });

  it("a wall the new shape does not have is dropped to zero rather than carried", () => {
    const before = buildRectangleFootprint(24, 14);
    const after = buildRectangleFootprint(28, 14);
    // An id neither footprint knows: no old length, so nothing is remapped.
    expect(remapEndAnchoredPositions(before, after, { ZZ: [168] }).ZZ).toEqual([168]);
  });

  it("roofs off: no gable walls, no span, nothing to re-derive on a pure resize", () => {
    const a = buildRectangleFootprint(24, 14);
    const b = buildRectangleFootprint(28, 15);
    expect(gableSpanFt(a, false)).toBe(0);
    expect(roofShapeChangeVerdict(a, b, { roofEnabled: false, pitchIn12: 4 }).rederive).toBe(false);
  });
});
