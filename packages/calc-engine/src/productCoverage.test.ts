import { describe, expect, it } from "vitest";
import { computeMembraneCoverage, computeSillTapeLengthFt } from "./productCoverage";

describe("computeSillTapeLengthFt", () => {
  it("returns 0 for no openings", () => {
    expect(computeSillTapeLengthFt([])).toBe(0);
  });

  it("adds 1ft per opening on top of its own width", () => {
    // 36in = 3ft + 1ft = 4ft
    expect(computeSillTapeLengthFt([{ widthIn: 36 }])).toBeCloseTo(4, 6);
  });

  it("sums independently per opening, not once for the whole run", () => {
    // (36/12+1) + (60/12+1) = 4 + 6 = 10
    expect(computeSillTapeLengthFt([{ widthIn: 36 }, { widthIn: 60 }])).toBeCloseTo(10, 6);
  });
});

describe("computeMembraneCoverage", () => {
  it("picks horizontal strips when the wall is wide and short (fewer seams that way)", () => {
    const result = computeMembraneCoverage([{ lengthFt: 20, heightFt: 10 }], 5, 0);
    // vertical: ceil(20/5)=4 strips -> 3 seams x 10ft = 30ft
    // horizontal: ceil(10/5)=2 strips -> 1 seam x 20ft = 20ft (wins)
    expect(result.seamLengthFt).toBeCloseTo(20, 6);
    expect(result.areaSqFt).toBeCloseTo(200, 6);
  });

  it("picks vertical strips when the wall is tall and narrow (fewer seams that way)", () => {
    const result = computeMembraneCoverage([{ lengthFt: 10, heightFt: 20 }], 5, 0);
    // vertical: ceil(10/5)=2 strips -> 1 seam x 20ft = 20ft (wins)
    // horizontal: ceil(20/5)=4 strips -> 3 seams x 10ft = 30ft
    expect(result.seamLengthFt).toBeCloseTo(20, 6);
  });

  it("sums area and seam length across multiple wall runs independently", () => {
    const result = computeMembraneCoverage(
      [
        { lengthFt: 20, heightFt: 10 },
        { lengthFt: 10, heightFt: 20 },
      ],
      5,
      0,
    );
    expect(result.areaSqFt).toBeCloseTo(400, 6);
    expect(result.seamLengthFt).toBeCloseTo(40, 6);
  });

  it("adds roofAreaSqFt to the area total only, never to seam length", () => {
    const result = computeMembraneCoverage([], 5, 500);
    expect(result.areaSqFt).toBe(500);
    expect(result.seamLengthFt).toBe(0);
  });

  it("needs no seams for a single strip that already covers the whole run", () => {
    const result = computeMembraneCoverage([{ lengthFt: 4, heightFt: 8 }], 5, 0);
    expect(result.seamLengthFt).toBe(0);
  });

  it("skips seam math (but still sums area) for a degenerate zero roll width", () => {
    const result = computeMembraneCoverage([{ lengthFt: 20, heightFt: 10 }], 0, 0);
    expect(result.areaSqFt).toBeCloseTo(200, 6);
    expect(result.seamLengthFt).toBe(0);
  });
});
