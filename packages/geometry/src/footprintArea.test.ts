import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { computeFootprintAreaSqFt } from "./footprintArea";
import type { Footprint } from "./types";

describe("computeFootprintAreaSqFt", () => {
  it("computes width x depth for a plain rectangle", () => {
    const fp = buildRectangleFootprint(30, 20);
    expect(computeFootprintAreaSqFt(fp)).toBeCloseTo(600, 6);
  });

  it("is unaffected by winding direction (counter-clockwise corners)", () => {
    const fp: Footprint = {
      corners: [
        { id: "A", point: { x: 0, y: 0 } },
        { id: "D", point: { x: 0, y: 20 } },
        { id: "C", point: { x: 30, y: 20 } },
        { id: "B", point: { x: 30, y: 0 } },
      ],
      walls: [],
    };
    expect(computeFootprintAreaSqFt(fp)).toBeCloseTo(600, 6);
  });

  it("computes a known non-rectangular polygon's area (right triangle)", () => {
    const fp: Footprint = {
      corners: [
        { id: "A", point: { x: 0, y: 0 } },
        { id: "B", point: { x: 12, y: 0 } },
        { id: "C", point: { x: 0, y: 8 } },
      ],
      walls: [],
    };
    // 1/2 * base * height = 1/2 * 12 * 8 = 48
    expect(computeFootprintAreaSqFt(fp)).toBeCloseTo(48, 6);
  });

  it("returns 0 for fewer than 3 corners", () => {
    expect(computeFootprintAreaSqFt({ corners: [], walls: [] })).toBe(0);
    expect(computeFootprintAreaSqFt({ corners: [{ id: "A", point: { x: 0, y: 0 } }], walls: [] })).toBe(0);
  });
});
