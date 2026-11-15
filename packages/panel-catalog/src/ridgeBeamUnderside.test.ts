import { describe, expect, it } from "vitest";
import { ridgeBeamUndersideFt } from "./ridgeBeamLayout";
import { COLUMN_TOTAL_WIDTH_IN } from "./columnPanelMembers";
import { gablePeakBeamTopBelowRidgeIn } from "./gablePeakPanelMembers";
import { ROOF_CATCHER_BEAM_DEPTH_IN } from "./roofCatcherBeamMembers";

/**
 * ⚠ **The one derivation of where the ridge beam hangs — pinned against the
 * expression it replaced.**
 *
 * `Building3DView` carried these three lines inline until 2026-11-15, when the
 * beam gained a fabrication group that needs the same answer to work out its
 * posts' heights. The arithmetic moved into `ridgeBeamUndersideFt` so there is
 * one copy rather than two.
 *
 * ⚠ **Two copies of this subtraction is the B9 fault.** The beam floated
 * 0.75in above the column carrying it, on nominal-versus-actual, and the fix
 * was to derive the offset once. A second copy on the PRICING side would be
 * worse than the original: a post cut to the wrong height still prices, so
 * nothing on any sheet would look wrong.
 *
 * This test exists because the refactor has to be a no-op for the renderer. If
 * it ever stops being one, the roof moves in the 3D view and nobody finds out
 * from a number.
 */
describe("⚠ ridgeBeamUndersideFt is exactly what Building3DView used to compute inline", () => {
  const inlineOriginal = (ridgeHeightFt: number, pitchIn12: number) =>
    ridgeHeightFt -
    (gablePeakBeamTopBelowRidgeIn(COLUMN_TOTAL_WIDTH_IN, pitchIn12) + ROOF_CATCHER_BEAM_DEPTH_IN) / 12;

  for (const pitchIn12 of [0, 2, 3, 4, 6, 8, 12]) {
    for (const ridgeHeightFt of [9, 12, 14.5, 20, 26]) {
      it(`agrees at ${pitchIn12}:12, ridge ${ridgeHeightFt}ft`, () => {
        expect(ridgeBeamUndersideFt(ridgeHeightFt, pitchIn12)).toBe(inlineOriginal(ridgeHeightFt, pitchIn12));
      });
    }
  }

  it("⚠ reads the COLUMN PANEL's 25.5in, not the structural post's 15.5in", () => {
    /* What sets the drop is the width of the panel the peak box is cut into,
       not the post standing under it. The two are deliberately different
       numbers and swapping them moves the beam. */
    expect(ridgeBeamUndersideFt(14, 4)).not.toBe(
      14 - (gablePeakBeamTopBelowRidgeIn(15.5, 4) + ROOF_CATCHER_BEAM_DEPTH_IN) / 12,
    );
  });

  it("hangs BELOW the ridge, always", () => {
    for (const pitchIn12 of [0, 4, 12]) {
      expect(ridgeBeamUndersideFt(14, pitchIn12)).toBeLessThan(14);
    }
  });

  it("a steeper pitch drops it further, because the peak cap grows", () => {
    expect(ridgeBeamUndersideFt(14, 12)).toBeLessThan(ridgeBeamUndersideFt(14, 4));
    expect(ridgeBeamUndersideFt(14, 4)).toBeLessThan(ridgeBeamUndersideFt(14, 0));
  });
});
