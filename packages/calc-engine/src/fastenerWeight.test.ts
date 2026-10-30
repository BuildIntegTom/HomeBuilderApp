import { describe, expect, it } from "vitest";
import { buildStandardPanelMembers, buildBracedPanelMembers } from "@building-integrity/panel-catalog";
import {
  GRK_3IN_WEIGHT_LB,
  GRK_4IN_WEIGHT_LB,
  GRK_6IN_WEIGHT_LB,
  PLYWOOD_NAIL_WEIGHT_LB,
  T25_NO9_4IN_WEIGHT_LB,
  computeFastenerWeight,
  computeJackStudFastenerWeight,
} from "./fastenerWeight";

const WIDTH_IN = 40;
const DEPTH_IN = 15.5;
const HEIGHT_IN = 120;

describe("fastener weight constants", () => {
  it("scales roughly linearly with length (same effective diameter)", () => {
    expect(GRK_4IN_WEIGHT_LB).toBeGreaterThan(GRK_3IN_WEIGHT_LB);
    expect(GRK_6IN_WEIGHT_LB).toBeGreaterThan(GRK_4IN_WEIGHT_LB);
    expect(GRK_4IN_WEIGHT_LB / GRK_3IN_WEIGHT_LB).toBeCloseTo(4 / 3, 6);
    expect(PLYWOOD_NAIL_WEIGHT_LB).toBeGreaterThan(0);
  });
});

describe("computeFastenerWeight", () => {
  it("counts a nail every 4in along total plate + girt-bar length, for a standard panel", () => {
    const members = buildStandardPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false);
    const plateLengthIn = members.filter((m) => m.role === "plate").reduce((s, m) => s + m.actualDimsIn.lengthIn, 0);
    const girtBarLengthIn = members.filter((m) => m.role === "girt").reduce((s, m) => s + m.actualDimsIn.lengthIn, 0);
    const expectedNailCount = Math.round((plateLengthIn + girtBarLengthIn) / 4);

    const result = computeFastenerWeight(members);
    const nailItem = result.items.find((i) => i.label.includes("nail"))!;
    expect(nailItem.count).toBe(expectedNailCount);
    expect(nailItem.totalWeightLb).toBeCloseTo(expectedNailCount * PLYWOOD_NAIL_WEIGHT_LB, 9);
  });

  it("gives every lid (2 skins + 2 girt webs for a standard panel) 8x 4in GRK screws", () => {
    const members = buildStandardPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false);
    const lidCount = members.filter((m) => m.role === "skin" || m.role === "girt_web").length;
    expect(lidCount).toBe(4); // 2 skins + 2 girt webs (standard panel has 2 girt rows)

    const result = computeFastenerWeight(members);
    const lidItem = result.items.find((i) => i.label.includes("4in GRK"))!;
    expect(lidItem.count).toBe(lidCount * 8);
  });

  it("gives every girt bar 8x 3in GRK screws", () => {
    const members = buildStandardPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false);
    const girtBarCount = members.filter((m) => m.role === "girt").length;
    expect(girtBarCount).toBe(4); // 2 rows x 2 bars

    const result = computeFastenerWeight(members);
    const girtItem = result.items.find((i) => i.label.includes("3in GRK"))!;
    expect(girtItem.count).toBe(girtBarCount * 8);
  });

  it("omits the brace GRK line entirely for a standard panel (no brace members)", () => {
    const members = buildStandardPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false);
    const result = computeFastenerWeight(members);
    expect(result.items.some((i) => i.label.includes("6in GRK"))).toBe(false);
  });

  it("⚠ gives every brace member 4x 4in GRK screws — two at each end", () => {
    /* These were 6in until 2026-10-25, when Tommy gave the real spec: "Each
       end of each 2x4 on the diagonals has 2 5/16in GRKs 4in screws
       predrilled and driven." The count of four was already right, and it is
       four because it is TWO PER END, which is worth saying in the label so
       nobody re-derives it as four in one place. */
    const members = buildBracedPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "chevron", false);
    const braceCount = members.filter((m) => m.role === "brace").length;
    expect(braceCount).toBe(4); // upper+lower, each on both wythes

    const result = computeFastenerWeight(members);
    expect(result.items.some((i) => i.label.includes("6in GRK"))).toBe(false);
    const braceItem = result.items.find((i) => i.label.includes("brace members"))!;
    expect(braceItem.count).toBe(braceCount * 4);
    expect(braceItem.totalWeightLb).toBeCloseTo(braceCount * 4 * GRK_4IN_WEIGHT_LB, 9);
    // A 4in screw weighs two thirds of a 6in one, so the total really moved.
    expect(braceItem.totalWeightLb).toBeLessThan(braceCount * 4 * GRK_6IN_WEIGHT_LB);
  });

  it("sums every line item into totalWeightLb/Kg", () => {
    const members = buildBracedPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "chevron", false);
    const result = computeFastenerWeight(members);
    const expectedTotal = result.items.reduce((s, i) => s + i.totalWeightLb, 0);
    expect(result.totalWeightLb).toBeCloseTo(expectedTotal, 9);
    expect(result.totalWeightKg).toBeCloseTo(result.totalWeightLb * 0.453592, 6);
  });
});

describe("computeJackStudFastenerWeight", () => {
  it("counts 2 screws per 6in row along the jack sheet's height", () => {
    const result = computeJackStudFastenerWeight(120);
    const expectedRows = Math.round(120 / 6);
    expect(result.items[0]!.count).toBe(expectedRows * 2);
    expect(result.items[0]!.unitWeightLb).toBeCloseTo(T25_NO9_4IN_WEIGHT_LB, 9);
  });

  it("sums into totalWeightLb/Kg", () => {
    const result = computeJackStudFastenerWeight(120);
    expect(result.totalWeightLb).toBeCloseTo(result.items[0]!.count * T25_NO9_4IN_WEIGHT_LB, 9);
    expect(result.totalWeightKg).toBeCloseTo(result.totalWeightLb * 0.453592, 6);
  });
});
