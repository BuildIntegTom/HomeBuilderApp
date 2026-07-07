import { describe, expect, it } from "vitest";
import { wallAssemblyLayers } from "@building-integrity/panel-catalog";
import {
  computeAssemblyPerm,
  resistanceInSeries,
  validateVaporOpenness,
} from "./permeability";

const intello = wallAssemblyLayers.find((l) => l.id === "intello-plus")!;
const mento = wallAssemblyLayers.find((l) => l.id === "mento")!;
const clayPlaster = wallAssemblyLayers.find((l) => l.id === "clay-plaster")!;

describe("resistanceInSeries", () => {
  it("combines two perms into a single lower-than-either total", () => {
    // 1/x = 1/10 + 1/10 => x = 5
    expect(resistanceInSeries([10, 10])).toBeCloseTo(5, 6);
  });
});

describe("computeAssemblyPerm — spec's own worked example (Intello + Mento)", () => {
  it("matches spec's ~0.13 perm winter figure", () => {
    const result = computeAssemblyPerm(intello, mento, "winter");
    expect(result.computable).toBe(true);
    expect(result.permTotal).toBeCloseTo(0.13, 2);
  });

  it("matches spec's ~9.8 perm summer figure", () => {
    const result = computeAssemblyPerm(intello, mento, "summer");
    expect(result.computable).toBe(true);
    expect(result.permTotal).toBeCloseTo(9.8, 1);
  });

  it("flags as not computable when a layer has no numeric perm rating", () => {
    const result = computeAssemblyPerm(clayPlaster, mento, "winter");
    expect(result.computable).toBe(false);
    expect(result.permTotal).toBeNull();
    expect(result.unratedLayers).toHaveLength(1);
    expect(result.unratedLayers[0]?.id).toBe("clay-plaster");
  });
});

describe("validateVaporOpenness", () => {
  it("passes for Intello (interior) + Mento (exterior) in both seasons", () => {
    expect(validateVaporOpenness(intello, mento, "winter").passes).toBe(true);
    expect(validateVaporOpenness(intello, mento, "summer").passes).toBe(true);
  });

  it("fails when the interior layer is more vapor-open than the exterior layer", () => {
    // swapped: exterior=intello (low/variable perm), interior=mento (38, fixed)
    const result = validateVaporOpenness(mento, intello, "winter");
    expect(result.computable).toBe(true);
    expect(result.passes).toBe(false);
  });

  it("reports not computable when a layer lacks a perm rating", () => {
    const result = validateVaporOpenness(clayPlaster, mento, "winter");
    expect(result.computable).toBe(false);
    expect(result.passes).toBeNull();
  });
});
