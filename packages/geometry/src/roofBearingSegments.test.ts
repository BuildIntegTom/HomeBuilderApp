import { describe, expect, it } from "vitest";
import { computeRoofBearingSegments, isSlotBoxBeamCovered, type BoxBeamCoverage } from "./roofBearingSegments";
import type { PanelSlot } from "./types";

const slots: PanelSlot[] = [
  { type: "standard", widthIn: 40 },
  { type: "standard", widthIn: 40 },
  { type: "standard", widthIn: 40 },
  { type: "standard", widthIn: 40 },
  { type: "standard", widthIn: 30 },
];
// cumulative offsets: 0, 40, 80, 120, 160, 190 (total 190in)

describe("computeRoofBearingSegments", () => {
  it("returns a single Truss Plate segment spanning the whole wall when coverage is undefined", () => {
    const segs = computeRoofBearingSegments(slots, undefined);
    expect(segs).toEqual([{ kind: "truss-plate", startXIn: 0, lengthIn: 190 }]);
  });

  it("returns a single Truss Plate segment when coverage is an empty/inverted range", () => {
    const segs = computeRoofBearingSegments(slots, { startSlotIndex: 3, endSlotIndex: 3 });
    expect(segs).toEqual([{ kind: "truss-plate", startXIn: 0, lengthIn: 190 }]);
    const inverted = computeRoofBearingSegments(slots, { startSlotIndex: 3, endSlotIndex: 1 });
    expect(inverted).toEqual([{ kind: "truss-plate", startXIn: 0, lengthIn: 190 }]);
  });

  it("returns a single Box Beam segment spanning the whole wall for full-range (ring) coverage", () => {
    const segs = computeRoofBearingSegments(slots, { startSlotIndex: 0, endSlotIndex: slots.length });
    expect(segs).toEqual([{ kind: "box-beam", startXIn: 0, lengthIn: 190 }]);
  });

  it("splits into 3 segments for coverage in the middle of the wall", () => {
    const segs = computeRoofBearingSegments(slots, { startSlotIndex: 1, endSlotIndex: 3 });
    expect(segs).toEqual([
      { kind: "truss-plate", startXIn: 0, lengthIn: 40 },
      { kind: "box-beam", startXIn: 40, lengthIn: 80 },
      { kind: "truss-plate", startXIn: 120, lengthIn: 70 },
    ]);
    // every segment boundary lands exactly on a real slot edge (0,40,80,120,160,190)
    const cumulativeOffsets = [0, 40, 80, 120, 160, 190];
    for (const seg of segs) {
      expect(cumulativeOffsets).toContain(seg.startXIn);
      expect(cumulativeOffsets).toContain(seg.startXIn + seg.lengthIn);
    }
  });

  it("omits the leading Truss Plate segment when coverage starts at slot 0", () => {
    const segs = computeRoofBearingSegments(slots, { startSlotIndex: 0, endSlotIndex: 2 });
    expect(segs).toEqual([
      { kind: "box-beam", startXIn: 0, lengthIn: 80 },
      { kind: "truss-plate", startXIn: 80, lengthIn: 110 },
    ]);
  });

  it("omits the trailing Truss Plate segment when coverage ends at the last slot", () => {
    const segs = computeRoofBearingSegments(slots, { startSlotIndex: 3, endSlotIndex: 5 });
    expect(segs).toEqual([
      { kind: "truss-plate", startXIn: 0, lengthIn: 120 },
      { kind: "box-beam", startXIn: 120, lengthIn: 70 },
    ]);
  });

  it("every set of segments sums exactly to the wall's own total length, no gaps or overlaps", () => {
    for (const coverage of [
      undefined,
      { startSlotIndex: 0, endSlotIndex: 5 },
      { startSlotIndex: 1, endSlotIndex: 3 },
      { startSlotIndex: 0, endSlotIndex: 1 },
      { startSlotIndex: 4, endSlotIndex: 5 },
    ]) {
      const segs = computeRoofBearingSegments(slots, coverage);
      const totalLengthIn = segs.reduce((sum, s) => sum + s.lengthIn, 0);
      expect(totalLengthIn).toBeCloseTo(190, 6);
      for (let i = 1; i < segs.length; i++) {
        expect(segs[i]!.startXIn).toBeCloseTo(segs[i - 1]!.startXIn + segs[i - 1]!.lengthIn, 6);
      }
    }
  });

  it("clamps an out-of-range coverage index instead of throwing", () => {
    const segs = computeRoofBearingSegments(slots, { startSlotIndex: -2, endSlotIndex: 999 });
    expect(segs).toEqual([{ kind: "box-beam", startXIn: 0, lengthIn: 190 }]);
  });

  it("returns no segments for an empty slot list", () => {
    expect(computeRoofBearingSegments([], undefined)).toEqual([]);
    expect(computeRoofBearingSegments([], { startSlotIndex: 0, endSlotIndex: 1 })).toEqual([]);
  });
});

describe("isSlotBoxBeamCovered", () => {
  const coverage: BoxBeamCoverage = { startSlotIndex: 1, endSlotIndex: 3 };

  it("is true for slot indices within [startSlotIndex, endSlotIndex)", () => {
    expect(isSlotBoxBeamCovered(1, coverage)).toBe(true);
    expect(isSlotBoxBeamCovered(2, coverage)).toBe(true);
  });

  it("is false for the exclusive end index and anything outside the range", () => {
    expect(isSlotBoxBeamCovered(0, coverage)).toBe(false);
    expect(isSlotBoxBeamCovered(3, coverage)).toBe(false);
    expect(isSlotBoxBeamCovered(10, coverage)).toBe(false);
  });

  it("is false for every index when coverage is undefined", () => {
    expect(isSlotBoxBeamCovered(1, undefined)).toBe(false);
  });
});
