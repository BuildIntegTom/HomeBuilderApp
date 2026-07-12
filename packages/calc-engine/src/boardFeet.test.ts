import { describe, expect, it } from "vitest";
import { computeBoardFeet, computeBoardFeetByNominalSize } from "./boardFeet";
import type { PanelMember } from "@building-integrity/panel-catalog";

describe("computeBoardFeet", () => {
  it("matches the textbook example: 2in x 6in x 10ft = 10 board feet", () => {
    expect(computeBoardFeet(10, 2, 6)).toBeCloseTo(10, 6);
  });

  it("uses nominal thickness x width x length(ft) / 12", () => {
    expect(computeBoardFeet(8, 2, 4)).toBeCloseTo((2 * 4 * 8) / 12, 6);
  });
});

function make2x4(lengthIn: number, qty = 1): PanelMember {
  return {
    memberId: "m",
    material: "dimensional_lumber",
    speciesGrade: null,
    plySpec: null,
    nominalSize: "2x4",
    actualDimsIn: { thicknessIn: 1.5, widthIn: 3.5, lengthIn },
    orientation: "vertical",
    position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0 },
    role: "stud",
    qty,
  };
}

describe("computeBoardFeetByNominalSize", () => {
  it("uses NOMINAL (not actual) dimensions for the board-foot math", () => {
    // A single 2x4, 120in (10ft) long: nominal 2x4x10 = 6.667 BF, not the
    // smaller actual-dims (1.5x3.5) figure.
    const members = [make2x4(120)];
    const [result] = computeBoardFeetByNominalSize(members, 10);
    expect(result!.totalBoardFeet).toBeCloseTo((2 * 4 * 10) / 12, 6);
  });

  it("sums board feet across multiple members of the same nominal size", () => {
    const members = [make2x4(120), make2x4(60)];
    const [result] = computeBoardFeetByNominalSize(members, 10);
    const expectedTotal = (2 * 4 * 10) / 12 + (2 * 4 * 5) / 12;
    expect(result!.totalBoardFeet).toBeCloseTo(expectedTotal, 6);
  });

  it("respects qty when summing board feet", () => {
    const members = [make2x4(120, 4)];
    const [result] = computeBoardFeetByNominalSize(members, 10);
    expect(result!.totalBoardFeet).toBeCloseTo(4 * ((2 * 4 * 10) / 12), 6);
  });

  it("computes stick count as total board feet / board feet per stock-length stick, rounded up", () => {
    // 3 studs at 120in (10ft) each -> 3 sticks worth of board feet exactly.
    const members = [make2x4(120, 3)];
    const [result] = computeBoardFeetByNominalSize(members, 10);
    expect(result!.boardFeetPerStick).toBeCloseTo((2 * 4 * 10) / 12, 6);
    expect(result!.stickCount).toBe(3);
  });

  it("rounds up a partial stick (can't buy a fraction of a board)", () => {
    const members = [make2x4(60)]; // half a 10ft stick's worth of board feet
    const [result] = computeBoardFeetByNominalSize(members, 10);
    expect(result!.stickCount).toBe(1);
  });

  it("groups separately by nominal size", () => {
    const members: PanelMember[] = [
      make2x4(120),
      { ...make2x4(120), memberId: "m2", nominalSize: "2x6", actualDimsIn: { thicknessIn: 1.5, widthIn: 5.5, lengthIn: 120 } },
    ];
    const results = computeBoardFeetByNominalSize(members, 10);
    expect(results).toHaveLength(2);
    const sizes = results.map((r) => r.nominalSize).sort();
    expect(sizes).toEqual(["2x4", "2x6"]);
  });

  it("ignores non-dimensional-lumber and plywood/null-nominalSize members", () => {
    const members: PanelMember[] = [
      make2x4(120),
      {
        memberId: "skin",
        material: "plywood",
        speciesGrade: null,
        plySpec: "3/4in_5ply_CDX",
        nominalSize: null,
        actualDimsIn: { thicknessIn: 0.75, widthIn: 48, lengthIn: 96 },
        orientation: "flat",
        position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0 },
        role: "skin",
        qty: 1,
      },
    ];
    const results = computeBoardFeetByNominalSize(members, 10);
    expect(results).toHaveLength(1);
    expect(results[0]!.nominalSize).toBe("2x4");
  });

  it("returns an empty array for an empty member list", () => {
    expect(computeBoardFeetByNominalSize([], 10)).toEqual([]);
  });
});
