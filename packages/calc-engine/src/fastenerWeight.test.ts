import { describe, expect, it } from "vitest";
import { buildStandardPanelMembers, buildBracedPanelMembers } from "@building-integrity/panel-catalog";
import {
  GRK_3IN_WEIGHT_LB,
  GRK_4IN_WEIGHT_LB,
  GRK_6IN_WEIGHT_LB,
  PLYWOOD_NAIL_WEIGHT_LB,
  computeFastenerWeight,
  computeRoofPanelSeamFastenerWeight,
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
  it("⚠ follows THE ONE SCHEDULE: 16in o.c. exterior + 24in o.c. interior, GRK screws", () => {
    /* Tommy, 2026-11-19: "might as well just have jack studs also get big
       screws. just the one schedule." This supersedes his 2-every-6in T25 #9
       rule, which was the only one the app counted while the catalog schedule
       quoted a GRK for the same joint. */
    const result = computeJackStudFastenerWeight(120);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.count).toBe(Math.round(120 / 16) + Math.round(120 / 24));
    expect(result.items[0]!.unitWeightLb).toBeCloseTo(GRK_4IN_WEIGHT_LB, 9);
    /* ⚠ The label is read by the Reference Points page to find this row. */
    expect(result.items[0]!.label).toContain("jack sheet to panel");
    expect(result.items[0]!.label).toContain("GRK");
  });

  it("⚠ counts far FEWER, far bigger screws than the rule it replaced", () => {
    /* The direction matters: 2 screws every 6in is four a foot; this is one
       every 16in outside and one every 24in inside. A change that quietly
       raised the count would mean the new rule had been applied per face per
       row rather than per face. */
    const result = computeJackStudFastenerWeight(96);
    expect(result.items[0]!.count).toBe(10);
    expect(Math.round(96 / 6) * 2).toBe(32);
  });

  it("sums into totalWeightLb/Kg", () => {
    const result = computeJackStudFastenerWeight(120);
    expect(result.totalWeightLb).toBeCloseTo(result.items[0]!.count * GRK_4IN_WEIGHT_LB, 9);
    expect(result.totalWeightKg).toBeCloseTo(result.totalWeightLb * 0.453592, 6);
  });
});

describe("⚠ a roof panel's own screws (2026-11-20) — its first fastener count", () => {
  /* > "the roof panels need to have grk's 18" on all the seams as well as a
     > truss screw at each seam. so basically 4 per panel."

     Until this, `computeFastenerWeight` read ZERO on a roof panel — it is
     written over wall-panel roles (plate and girt-bar length, lids, girt
     bars) and a roof panel is joists with no girt at all — so the sheet
     correctly said "unmodeled" rather than "none". */

  it("his \"basically 4 per panel\" comes out exactly, on every panel size", () => {
    for (const [widthIn, lengthIn] of [[24, 150], [15.5, 96], [48, 240], [12, 36]]) {
      const truss = computeRoofPanelSeamFastenerWeight(widthIn, lengthIn).items.find((i) =>
        /truss/i.test(i.label),
      )!;
      expect(truss.count).toBe(4);
    }
  });

  it("counts each seam as its OWN run, so a short edge still gets a screw", () => {
    /* ⚠ A 24in edge is under the 18in spacing. Dividing one PERIMETER by 18
       would let the two long edges pay for the short ones and leave a seam
       with nothing on it — "on all the seams" says otherwise. */
    const narrow = computeRoofPanelSeamFastenerWeight(12, 150);
    const grk = narrow.items.find((i) => /GRK/.test(i.label))!;
    /* 2 x round(150/18)=8, plus 2 x max(1, round(12/18)=1) = 16 + 2. */
    expect(grk.count).toBe(18);
    /* The floor of one really binds: a 12in edge rounds to 1 anyway, but a
       6in one rounds to 0 and must not. */
    const tiny = computeRoofPanelSeamFastenerWeight(6, 18);
    expect(tiny.items.find((i) => /GRK/.test(i.label))!.count).toBe(2 * 1 + 2 * 1);
  });

  it("scales with the seam length, which is the whole point of an o.c. rule", () => {
    const short = computeRoofPanelSeamFastenerWeight(24, 72);
    const long = computeRoofPanelSeamFastenerWeight(24, 288);
    const n = (r: typeof short) => r.items.find((i) => /GRK/.test(i.label))!.count;
    expect(n(long)).toBeGreaterThan(n(short));
    /* Four times the span, so the LONG edges' share quadruples while the two
       short edges contribute the same 1 screw each either way. Both panels
       are 24in wide, so that share is exactly 2. */
    const shortEdgeShare = 2;
    expect(n(short)).toBe(2 * 4 + shortEdgeShare); // round(72/18) = 4
    expect(n(long)).toBe(2 * 16 + shortEdgeShare); // round(288/18) = 16
    expect(n(long) - shortEdgeShare).toBe(4 * (n(short) - shortEdgeShare));
  });

  it("⚠ carries the truss screws at ZERO weight and SAYS so on the label", () => {
    /* The honest half. No type, diameter or length has been given, so there
       is no cylinder to weigh — but dropping the screws from the sheet would
       leave a fitter not knowing four go in. The total is LOW by four screws
       a panel, and `gap-ridge-truss-screw-spec` says that too. */
    const result = computeRoofPanelSeamFastenerWeight(24, 150);
    const truss = result.items.find((i) => /truss/i.test(i.label))!;
    expect(truss.unitWeightLb).toBe(0);
    expect(truss.totalWeightLb).toBe(0);
    expect(truss.label).toContain("WEIGHT NOT MODELLED");
    /* ⚠ And the total must be the GRKs alone — if a weight ever appears for
       the truss screw without a spec arriving, something was invented. */
    const grk = result.items.find((i) => /GRK/.test(i.label))!;
    expect(result.totalWeightLb).toBeCloseTo(grk.totalWeightLb, 12);
    expect(result.totalWeightLb).toBeGreaterThan(0);
  });

  it("⚠ errs HIGH, never low — which is the right direction for a shop count", () => {
    /* A mitred roof panel's two long edges are different lengths, and the
       caller only has the ENVELOPE (`spanIn`) to give — the short edge is not
       carried as a field. So both long seams are counted at the envelope and
       a mitred panel gets a screw or two more than it needs. Pinned as a
       DIRECTION rather than a number: a count that errs high leaves the shop
       with a spare screw, where one that errs low leaves a seam unfastened. */
    const envelope = computeRoofPanelSeamFastenerWeight(24, 150);
    const realShortEdge = computeRoofPanelSeamFastenerWeight(24, 120);
    const n = (r: typeof envelope) => r.items.find((i) => /GRK/.test(i.label))!.count;
    expect(n(envelope)).toBeGreaterThanOrEqual(n(realShortEdge));
  });

  it("⚠ is NOT what computeFastenerWeight would say, which read zero", () => {
    /* The reason this function exists. A roof panel's member list has no
       plate/girt roles for the wall-panel rules to find. */
    const roofish = computeRoofPanelSeamFastenerWeight(24, 150);
    expect(roofish.totalWeightKg).toBeGreaterThan(0);
    expect(computeFastenerWeight([]).totalWeightKg).toBe(0);
  });
});
