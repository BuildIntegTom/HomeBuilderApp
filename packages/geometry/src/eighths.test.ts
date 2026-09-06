import { describe, expect, it } from "vitest";
import {
  EIGHTH_IN,
  distributeEighths,
  fromEighths,
  isWholeEighthIn,
  quantizeFootprint,
  repairWallToEighths,
  roundToEighthIn,
  toEighths,
  wallFabricationLengthIn,
} from "./eighths";
import { buildOctagonFootprint } from "./octagon";
import type { Footprint, PanelSlot } from "./types";

describe("EIGHTH_IN", () => {
  it("is exactly 1/8 inch and exactly representable", () => {
    expect(EIGHTH_IN).toBe(0.125);
    expect(EIGHTH_IN * 8).toBe(1);
  });
});

describe("toEighths / fromEighths / roundToEighthIn", () => {
  it("round-trips every eighth in a real panel-width range bit-identically", () => {
    for (let e = 0; e <= 48 * 8; e++) {
      const valueIn = fromEighths(e);
      expect(toEighths(valueIn)).toBe(e);
      expect(roundToEighthIn(valueIn)).toBe(valueIn);
    }
  });

  it("rounds half up, matching formatImperialFractionIn's own rule", () => {
    expect(roundToEighthIn(23.5625)).toBe(23.625); // the exact half-eighth
    expect(roundToEighthIn(15.7)).toBe(15.75);
    expect(roundToEighthIn(15.68)).toBe(15.625);
  });

  it("handles negatives without flipping sign", () => {
    expect(roundToEighthIn(-15.7)).toBe(-15.75);
    expect(toEighths(-0.75)).toBe(-6);
  });

  it("recognizes whole eighths, including ones reached through float arithmetic", () => {
    expect(isWholeEighthIn(0.75)).toBe(true);
    expect(isWholeEighthIn(25.5)).toBe(true);
    expect(isWholeEighthIn(15.75)).toBe(true);
    expect(isWholeEighthIn(23.5625)).toBe(false); // a sixteenth
    expect(isWholeEighthIn((30 * 12) / 3)).toBe(true);
  });
});

describe("distributeEighths", () => {
  it("splits evenly when the budget divides cleanly", () => {
    expect(distributeEighths(400, 4)).toEqual([100, 100, 100, 100]);
  });

  it("gives the extra eighth(s) to the lowest-index parts", () => {
    expect(distributeEighths(377, 2)).toEqual([189, 188]);
    expect(distributeEighths(10, 4)).toEqual([3, 3, 2, 2]);
  });

  it("always sums back to the budget exactly, across a swept product", () => {
    for (let budget = 0; budget <= 400; budget++) {
      for (let count = 1; count <= 9; count++) {
        const parts = distributeEighths(budget, count);
        expect(parts).toHaveLength(count);
        expect(parts.reduce((s, p) => s + p, 0)).toBe(budget);
        expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
        for (const p of parts) expect(p).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("returns zero-width parts (not negatives) when the budget is smaller than the count", () => {
    // Dropping them is the caller's call — see buildEvenMiddle, which does.
    expect(distributeEighths(2, 5)).toEqual([1, 1, 0, 0, 0]);
  });

  it("never produces a negative part from a zero or negative budget", () => {
    expect(distributeEighths(0, 3)).toEqual([0, 0, 0]);
    expect(distributeEighths(-40, 3)).toEqual([0, 0, 0]);
  });

  it("returns an empty array for a non-positive count", () => {
    expect(distributeEighths(40, 0)).toEqual([]);
    expect(distributeEighths(40, -2)).toEqual([]);
  });
});

describe("wallFabricationLengthIn", () => {
  const wall = (lengthFt: number) => ({ id: "AB", startCorner: "A", endCorner: "B", lengthFt });

  it("is a no-op for a rectilinear wall already on the grid", () => {
    expect(wallFabricationLengthIn(wall(30))).toBe(360);
    expect(wallFabricationLengthIn(wall(30 + 0.625 / 12))).toBe(360.625);
  });

  it("cleans up the float noise in lengthFt * 12", () => {
    const drifted = wall(360.125 / 12 + 1e-13);
    expect(wallFabricationLengthIn(drifted)).toBe(360.125);
  });

  it("moves an octagon's 45deg wall by at most 1/16in — the accepted exception", () => {
    const fp = buildOctagonFootprint(40, 40);
    for (const diagonal of fp.walls.filter((_, i) => i % 2 === 1)) {
      const residualIn = Math.abs(wallFabricationLengthIn(diagonal) - diagonal.lengthFt * 12);
      expect(residualIn).toBeLessThanOrEqual(1 / 16);
      expect(residualIn).toBeGreaterThan(0); // it really is off-grid, by design
    }
  });
});

describe("quantizeFootprint", () => {
  const square = (size: number): Footprint => ({
    corners: [
      { id: "A", point: { x: 0, y: 0 } },
      { id: "B", point: { x: size, y: 0 } },
      { id: "C", point: { x: size, y: size } },
      { id: "D", point: { x: 0, y: size } },
    ],
    walls: [
      { id: "AB", startCorner: "A", endCorner: "B", lengthFt: size },
      { id: "BC", startCorner: "B", endCorner: "C", lengthFt: size },
      { id: "CD", startCorner: "C", endCorner: "D", lengthFt: size },
      { id: "DA", startCorner: "D", endCorner: "A", lengthFt: size },
    ],
  });

  it("puts every rectilinear wall length exactly on the grid", () => {
    const fp = quantizeFootprint(square(30.007));
    for (const wall of fp.walls) {
      expect(isWholeEighthIn(wall.lengthFt * 12)).toBe(true);
    }
  });

  it("moves a corner by at most 1/16in", () => {
    const fp = quantizeFootprint(square(30.007));
    expect(Math.abs(fp.corners[1]!.point.x - 30.007) * 12).toBeLessThanOrEqual(1 / 16);
  });

  it("is idempotent — a second pass changes nothing", () => {
    const once = quantizeFootprint(square(41.3333));
    const twice = quantizeFootprint(once);
    expect(twice.corners).toEqual(once.corners);
    expect(twice.walls.map((w) => w.lengthFt)).toEqual(once.walls.map((w) => w.lengthFt));
  });

  it("recomputes lengthFt from the snapped corners rather than trusting the input", () => {
    const lying = square(20);
    lying.walls[0]!.lengthFt = 999;
    expect(quantizeFootprint(lying).walls[0]!.lengthFt).toBe(20);
  });

  it("leaves a wall referencing a missing corner alone instead of zeroing it", () => {
    const broken = square(20);
    broken.walls.push({ id: "XY", startCorner: "X", endCorner: "Y", lengthFt: 7 });
    expect(quantizeFootprint(broken).walls[4]!.lengthFt).toBe(7);
  });
});

describe("repairWallToEighths", () => {
  const slot = (type: PanelSlot["type"], widthIn: number): PanelSlot => ({ type, widthIn });

  it("returns the same array reference when nothing needs repair", () => {
    const slots = [slot("corner", 25.5), slot("standard", 40), slot("safety-gap", 0.75)];
    expect(repairWallToEighths(slots, 66.25)).toBe(slots);
  });

  it("rounds each width and sheds the residual to the widest standard slot", () => {
    // Two sixteenths, exactly the pre-fix halving's output.
    const slots = [slot("corner", 25.5), slot("standard", 23.5625), slot("standard", 23.5625), slot("safety-gap", 0.75)];
    const repaired = repairWallToEighths(slots, 73.375);
    expect(repaired.map((s) => s.widthIn)).toEqual([25.5, 23.5, 23.625, 0.75]);
    expect(repaired.reduce((sum, s) => sum + toEighths(s.widthIn), 0)).toBe(toEighths(73.375));
  });

  it("never moves a corner, gap or opening slot's own rounded width", () => {
    const slots = [slot("corner", 25.5), slot("window", 36), slot("standard", 30.1), slot("safety-gap", 0.75)];
    const repaired = repairWallToEighths(slots, 100);
    expect(repaired[0]!.widthIn).toBe(25.5);
    expect(repaired[1]!.widthIn).toBe(36);
    expect(repaired[3]!.widthIn).toBe(0.75);
    expect(repaired[2]!.widthIn).toBe(100 - 25.5 - 36 - 0.75);
  });

  it("spreads a multi-eighth residual round-robin, widest first then by index", () => {
    const slots = [slot("standard", 40), slot("braced", 40), slot("standard", 20)];
    const repaired = repairWallToEighths(slots, 100.5);
    // +4 eighths over 3 slots: one lap each, then the widest takes the 4th.
    expect(repaired.map((s) => s.widthIn)).toEqual([40.25, 40.125, 20.125]);
    expect(repaired.reduce((sum, s) => sum + s.widthIn, 0)).toBe(100.5);
  });

  it("leaves the residual outstanding rather than resizing a corner when there is no adjustable slot", () => {
    const slots = [slot("corner", 25.5)];
    // A merged-corner wall: nothing here is the tiling engine's to move.
    expect(repairWallToEighths(slots, 25.5625)).toBe(slots);
  });

  it("never drives an adjustable slot negative when it has to take width away", () => {
    const slots = [slot("corner", 25.5), slot("standard", 1)];
    const repaired = repairWallToEighths(slots, 25.5);
    for (const s of repaired) expect(s.widthIn).toBeGreaterThanOrEqual(0);
  });

  it("repairs a user-dragged lockedWidthIn alongside the width it pins", () => {
    const slots: PanelSlot[] = [
      { type: "standard", widthIn: 23.5625, lockedWidthIn: 23.5625 },
      { type: "standard", widthIn: 23.5625 },
    ];
    const repaired = repairWallToEighths(slots, 47.125);
    expect(repaired[0]!.lockedWidthIn).toBe(23.625);
    expect(repaired.reduce((sum, s) => sum + toEighths(s.widthIn), 0)).toBe(toEighths(47.125));
  });

  it("leaves an empty slot list alone", () => {
    expect(repairWallToEighths([], 120)).toEqual([]);
  });

  it("makes every slot a whole eighth across a swept set of off-grid inputs", () => {
    for (let sixteenths = 0; sixteenths < 400; sixteenths++) {
      const wallLengthIn = 96 + sixteenths / 16;
      const slots = [
        slot("corner", 25.5),
        slot("standard", (wallLengthIn - 51 - 0.75) / 2),
        slot("safety-gap", 0.75),
        slot("standard", (wallLengthIn - 51 - 0.75) / 2),
        slot("corner", 25.5),
      ];
      const repaired = repairWallToEighths(slots, wallLengthIn);
      for (const s of repaired) {
        expect(isWholeEighthIn(s.widthIn)).toBe(true);
        expect(s.widthIn).toBeGreaterThanOrEqual(0);
      }
      expect(repaired.reduce((sum, s) => sum + toEighths(s.widthIn), 0)).toBe(toEighths(wallLengthIn));
    }
  });
});
