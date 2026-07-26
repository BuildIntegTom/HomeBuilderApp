import { describe, expect, it } from "vitest";
import { computeWallVerticalBandsForSlot, type MidWallBeamGeometry } from "./wallVerticalBands";

const beam = (heightIn: number, assemblyHeightIn: number, startSlotIndex: number, endSlotIndex: number): MidWallBeamGeometry => ({
  heightIn,
  assemblyHeightIn,
  startSlotIndex,
  endSlotIndex,
});

describe("computeWallVerticalBandsForSlot", () => {
  it("returns a single band spanning the whole story when there are no beams", () => {
    expect(computeWallVerticalBandsForSlot(0, 120, [])).toEqual([{ bandIndex: 0, bottomIn: 0, topIn: 120 }]);
  });

  it("returns a single band when no beam's coverage includes this slot", () => {
    const beams = [beam(60, 11, 3, 5)];
    expect(computeWallVerticalBandsForSlot(0, 120, beams)).toEqual([{ bandIndex: 0, bottomIn: 0, topIn: 120 }]);
  });

  it("omits the below-band when a covering beam sits at the floor", () => {
    const beams = [beam(0, 11, 0, 5)];
    expect(computeWallVerticalBandsForSlot(2, 120, beams)).toEqual([{ bandIndex: 0, bottomIn: 11, topIn: 120 }]);
  });

  it("omits the above-band when a covering beam's own top reaches the ceiling", () => {
    const beams = [beam(109, 11, 0, 5)];
    expect(computeWallVerticalBandsForSlot(2, 120, beams)).toEqual([{ bandIndex: 0, bottomIn: 0, topIn: 109 }]);
  });

  it("returns two bands for a single beam placed mid-wall, with no gap/overlap", () => {
    const beams = [beam(60, 11, 0, 5)];
    const bands = computeWallVerticalBandsForSlot(2, 120, beams);
    expect(bands).toEqual([
      { bandIndex: 0, bottomIn: 0, topIn: 60 },
      { bandIndex: 1, bottomIn: 71, topIn: 120 },
    ]);
  });

  it("returns zero bands when a covering beam's own assembly consumes the entire story", () => {
    expect(computeWallVerticalBandsForSlot(0, 10, [beam(0, 11, 0, 1)])).toEqual([]);
  });

  it("splits into 3 contiguous bands when two non-overlapping-height beams both cover the same slot", () => {
    const beams = [beam(80, 10, 0, 5), beam(30, 10, 0, 5)];
    const bands = computeWallVerticalBandsForSlot(2, 120, beams);
    expect(bands.map((b) => b.bandIndex)).toEqual([0, 1, 2]);
    expect(bands).toEqual([
      { bandIndex: 0, bottomIn: 0, topIn: 30 },
      { bandIndex: 1, bottomIn: 40, topIn: 80 },
      { bandIndex: 2, bottomIn: 90, topIn: 120 },
    ]);
    // no gaps/overlaps: every band's own topIn/bottomIn is internally
    // consistent and monotonically increasing.
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i]!.bottomIn).toBeGreaterThanOrEqual(bands[i - 1]!.topIn);
    }
  });

  it("only splits by beams whose own horizontal range actually covers this slot — disjoint coverage stays independent", () => {
    const beamA = beam(30, 10, 0, 3); // covers slots 0-2
    const beamB = beam(70, 10, 3, 6); // covers slots 3-5
    // Slot in range A only: split by A alone.
    expect(computeWallVerticalBandsForSlot(1, 120, [beamA, beamB]).length).toBe(2);
    // Slot in range B only: split by B alone.
    expect(computeWallVerticalBandsForSlot(4, 120, [beamA, beamB]).length).toBe(2);
    // Slot in neither range: unaffected.
    expect(computeWallVerticalBandsForSlot(10, 120, [beamA, beamB])).toEqual([{ bandIndex: 0, bottomIn: 0, topIn: 120 }]);
  });

  it("splits into 3 bands for a slot covered by both beams when their horizontal ranges overlap", () => {
    const beamA = beam(30, 10, 0, 5);
    const beamB = beam(70, 10, 2, 8);
    const bands = computeWallVerticalBandsForSlot(3, 120, [beamA, beamB]);
    expect(bands.length).toBe(3);
  });

  it("never throws and never produces a negative/zero-width band for beams with overlapping height ranges on the same slot", () => {
    const beams = [beam(50, 20, 0, 5), beam(55, 20, 0, 5)];
    const bands = computeWallVerticalBandsForSlot(1, 120, beams);
    for (const b of bands) expect(b.topIn).toBeGreaterThan(b.bottomIn);
  });

  it("clamps an out-of-range beam height instead of throwing", () => {
    expect(computeWallVerticalBandsForSlot(0, 120, [beam(-50, 11, 0, 5)])).toEqual([{ bandIndex: 0, bottomIn: 11, topIn: 120 }]);
    expect(computeWallVerticalBandsForSlot(0, 120, [beam(5000, 11, 0, 5)])).toEqual([{ bandIndex: 0, bottomIn: 0, topIn: 120 }]);
  });
});
