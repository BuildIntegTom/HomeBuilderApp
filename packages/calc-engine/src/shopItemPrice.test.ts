import { describe, expect, it } from "vitest";
import {
  buildBoxBeamMembers,
  buildSafetyGapMembers,
  buildTrussPlateMembers,
  buildOpeningAssemblyMembers,
  buildBigHeaderBeamMembers,
  buildWindowHeaderMembers,
  memberLargestFaceSqFt,
  shopItemRates,
  type PanelMember,
} from "@building-integrity/panel-catalog";
import { computeShopItemPrice, plywoodJackStuds, shopItemPieceClass } from "./shopItemPrice";

const DEPTH_IN = 15.5;
const HEIGHT_IN = 120;

describe("⚠ his acceptance check — a safety gap is 12.9 sq ft at $4", () => {
  it("measures the sheet, not the gap it fills", () => {
    /* > *"For a safety gap that is the plywood seen edge-on: 0.75in x 120in
       > = 0.63 sq ft. He wants the piece's largest face instead — for that
       > same gap, the sheet: 15.5in x 120in = 12.9 sq ft."* */
    const members = buildSafetyGapMembers(DEPTH_IN, HEIGHT_IN);
    expect(members).toHaveLength(1);
    expect(memberLargestFaceSqFt(members[0])).toBeCloseTo(12.92, 2);

    const priced = computeShopItemPrice(members);
    expect(priced.lines[0].pieceClass).toBe("sheet");
    expect(priced.total).toBeCloseTo(((15.5 * 120) / 144) * shopItemRates.sheetPerSqFt, 6);
    expect(priced.total.toFixed(2)).toBe("51.67");
  });

  it("⚠ the rate went DOWN and the bill went UP, which is the whole point", () => {
    /* $25 of a 3/4in sliver is $15.63; $4 of the real 15.5in sheet is
       $51.67. If this ever reverses, the piece is being measured by the gap
       again. */
    const priced = computeShopItemPrice(buildSafetyGapMembers(DEPTH_IN, HEIGHT_IN));
    const oldFlatRateBill = ((0.75 * HEIGHT_IN) / 144) * 25;
    expect(oldFlatRateBill.toFixed(2)).toBe("15.63");
    expect(priced.total).toBeGreaterThan(oldFlatRateBill);
  });

  it("copies and member qty both multiply", () => {
    const members = buildSafetyGapMembers(DEPTH_IN, HEIGHT_IN);
    const one = computeShopItemPrice(members, 1).total;
    expect(computeShopItemPrice(members, 7).total).toBeCloseTo(one * 7, 6);
  });
});

describe("⚠ LVL is a speciesGrade, not a material", () => {
  it("a Box Beam's web prices at $10, not the $60 its `material` would give", () => {
    /* The trap this test exists for: a Box Beam web carries
       `material: "dimensional_lumber"` with `speciesGrade: "LVL"`.
       Classifying on material alone charges 6x and the total still
       reconciles against its own printed working. */
    const members = buildBoxBeamMembers(120, DEPTH_IN);
    const webs = members.filter((m) => m.memberId.includes("lvl"));
    expect(webs.length).toBeGreaterThan(0);
    for (const web of webs) {
      expect(web.material).toBe("dimensional_lumber");
      expect(shopItemPieceClass(web)).toBe("lvl");
    }
    const priced = computeShopItemPrice(members);
    const webLines = priced.lines.filter((l) => l.pieceClass === "lvl");
    expect(webLines).toHaveLength(webs.length);
    for (const line of webLines) expect(line.ratePerSqFt).toBe(shopItemRates.lvlPerSqFt);
  });

  it("⚠ PER LVL — each one on its own largest face, his own clarification", () => {
    /* > *"each LVL is priced on its own largest face: a header made of two
       > LVLs is two of them."* */
    const priced = computeShopItemPrice(buildBoxBeamMembers(120, DEPTH_IN));
    const webLines = priced.lines.filter((l) => l.pieceClass === "lvl");
    expect(webLines).toHaveLength(2);
    expect(webLines[0].total).toBeCloseTo(webLines[1].total, 6);
  });
});

describe("⚠ a dimensional-lumber beam prices stick by stick at $60", () => {
  it("a Truss Plate is its two 2x4s plus its skin, three prices", () => {
    const members = buildTrussPlateMembers(120, DEPTH_IN);
    const priced = computeShopItemPrice(members);
    const sticks = priced.lines.filter((l) => l.pieceClass === "dimensional");
    expect(sticks.length).toBeGreaterThanOrEqual(2);
    for (const stick of sticks) expect(stick.ratePerSqFt).toBe(shopItemRates.dimensionalLumberPerSqFt);
    expect(priced.lines.some((l) => l.pieceClass === "sheet")).toBe(true);
    /* Reconciles to the sum of its own lines — the printed working's one job. */
    expect(priced.total).toBeCloseTo(
      priced.lines.reduce((sum, l) => sum + l.total, 0),
      6,
    );
  });
});

describe("⚠ nothing in a shop item is unpriced today", () => {
  it("no safety gap, box beam or truss plate piece falls through the table", () => {
    /* He named three rates and no fourth. Wire mesh, wood fiber board and
       fasteners price at zero, which is honest only as long as none of them
       is in a shop item — so that is asserted rather than assumed. If this
       fails, a piece is being given away free. */
    const items: PanelMember[][] = [
      buildSafetyGapMembers(DEPTH_IN, HEIGHT_IN),
      buildBoxBeamMembers(120, DEPTH_IN),
      buildTrussPlateMembers(120, DEPTH_IN),
      /* The other two shop-item pipelines: a Mid-Wall Beam's Big Header kind,
         and a Spanning Header. Every shop item the export seam can carry is
         represented here, so "nothing is unpriced" is asserted rather than
         grepped. */
      buildBigHeaderBeamMembers(96, DEPTH_IN, 12),
      buildWindowHeaderMembers(48, DEPTH_IN, 12),
    ];
    for (const members of items) {
      expect(computeShopItemPrice(members).unpricedFaceSqFt).toBe(0);
    }
  });
});

describe("⚠ plywood jack studs — the shop item that lives inside a straw panel", () => {
  it("picks the plywood sheet and leaves the 2x4s inside the flat rate", () => {
    /* `role: "jack_stud"` covers both the plywood sheet and the optional
       per-wythe 2x4s. He priced the PLYWOOD ones; the 2x4s stay where his
       2026-11-08 "rolled into the $25" answer left them. */
    const members = buildOpeningAssemblyMembers(
      48,
      DEPTH_IN,
      "window",
      "plywood+2x4",
      36,
      84,
      96,
      0,
      [],
      false,
    );
    const jacks = plywoodJackStuds(members);
    expect(jacks.length).toBeGreaterThan(0);
    for (const jack of jacks) {
      expect(jack.material).toBe("plywood");
      expect(shopItemPieceClass(jack)).toBe("sheet");
    }
    const all = members.filter((m) => m.role === "jack_stud");
    expect(all.length).toBeGreaterThan(jacks.length);
  });

  it("is charged on the face the panel's own coverage never contained", () => {
    /* Not a double charge: the panel's standing face only ever saw the jack
       stud's 3/4in edge, and this is the 15.5in-deep face beside it. */
    const members = buildOpeningAssemblyMembers(
      48,
      DEPTH_IN,
      "window",
      "plywood",
      36,
      84,
      96,
      0,
      [],
      false,
    );
    const jacks = plywoodJackStuds(members);
    const priced = computeShopItemPrice(jacks);
    expect(priced.total).toBeGreaterThan(0);
    for (const jack of jacks) {
      expect(jack.actualDimsIn.widthIn).toBeCloseTo(DEPTH_IN, 6);
      expect(memberLargestFaceSqFt(jack)).toBeCloseTo((DEPTH_IN * jack.actualDimsIn.lengthIn) / 144, 6);
    }
  });
});

describe("largest face does not depend on how a piece is turned over", () => {
  it("reads actualDimsIn, so orientation cannot change the price", () => {
    const [flat] = buildSafetyGapMembers(DEPTH_IN, HEIGHT_IN);
    const turned: PanelMember = { ...flat, orientation: "flat", position: { ...flat.position, rotationDeg: 90 } };
    expect(memberLargestFaceSqFt(turned)).toBeCloseTo(memberLargestFaceSqFt(flat), 6);
  });
});
