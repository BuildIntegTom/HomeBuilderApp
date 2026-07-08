import { describe, expect, it } from "vitest";
import { computeConcretePierVolume } from "./concreteVolume";

describe("computeConcretePierVolume", () => {
  it("computes a single pier's volume as pi x r^2 x depth, in ft3", () => {
    // 12in diameter -> 0.5ft radius; depth 4ft -> pi * 0.25 * 4 = pi ft3
    const result = computeConcretePierVolume(1, 12, 4);
    expect(result.volumeFt3PerPier).toBeCloseTo(Math.PI, 6);
    expect(result.totalVolumeFt3).toBeCloseTo(Math.PI, 6);
  });

  it("scales linearly with pier count", () => {
    const one = computeConcretePierVolume(1, 12, 4);
    const ten = computeConcretePierVolume(10, 12, 4);
    expect(ten.totalVolumeFt3).toBeCloseTo(one.volumeFt3PerPier * 10, 6);
  });
});
