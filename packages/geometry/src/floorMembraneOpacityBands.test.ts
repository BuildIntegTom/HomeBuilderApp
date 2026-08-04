import { describe, expect, it } from "vitest";
import { computeFloorMembraneOpacityBands } from "./floorMembraneOpacityBands";

describe("computeFloorMembraneOpacityBands", () => {
  it("picks the width axis when the footprint is wider than deep, near the min-X end", () => {
    const plan = computeFloorMembraneOpacityBands(0, 40, 0, 20, { x: 0, y: 10 });
    expect(plan.axis).toBe("width");
    expect(plan.nearIsMax).toBe(false);
  });

  it("picks the width axis when the footprint is wider than deep, near the max-X end", () => {
    const plan = computeFloorMembraneOpacityBands(0, 40, 0, 20, { x: 40, y: 10 });
    expect(plan.axis).toBe("width");
    expect(plan.nearIsMax).toBe(true);
  });

  it("picks the depth axis when the footprint is deeper than wide, near the max-Y end", () => {
    const plan = computeFloorMembraneOpacityBands(0, 20, 0, 40, { x: 10, y: 40 });
    expect(plan.axis).toBe("depth");
    expect(plan.nearIsMax).toBe(true);
  });

  it("picks the depth axis when the footprint is deeper than wide, near the min-Y end", () => {
    const plan = computeFloorMembraneOpacityBands(0, 20, 0, 40, { x: 10, y: 0 });
    expect(plan.axis).toBe("depth");
    expect(plan.nearIsMax).toBe(false);
  });

  it("defaults to the width axis on a square footprint", () => {
    const plan = computeFloorMembraneOpacityBands(0, 30, 0, 30, { x: 30, y: 15 });
    expect(plan.axis).toBe("width");
  });

  it("is unaffected by an offset (non-zero-origin) bounding box", () => {
    const plan = computeFloorMembraneOpacityBands(100, 140, 50, 70, { x: 140, y: 60 });
    expect(plan.axis).toBe("width");
    expect(plan.nearIsMax).toBe(true);
  });
});
