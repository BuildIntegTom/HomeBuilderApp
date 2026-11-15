import { describe, expect, it } from "vitest";
import {
  buildBigHeaderBeamMembers,
  buildBoxBeamMembers,
  buildSafetyGapMembers,
  buildStructuralColumnMembers,
  buildTrussPlateMembers,
  buildOpeningAssemblyMembers,
  buildRoofCatcherBeamMembers,
  buildWindowHeaderMembers,
  memberLargestFaceSqFt,
  shopItemMaterialsMarkup,
  type PanelMember,
} from "@building-integrity/panel-catalog";
import {
  computeShopItemPrice,
  memberMaterialCost,
  nominalSectionIn,
  plywoodJackStuds,
  shopItemPieceClass,
} from "./shopItemPrice";

const DEPTH_IN = 15.5;
const HEIGHT_IN = 120;
const TEN_FEET_IN = 120;

/** How many times its own stock cost a piece is sold for. His target is 2.2. */
function markupOf(members: readonly PanelMember[]): number {
  const priced = computeShopItemPrice(members);
  return priced.total / priced.materialCost;
}

describe("⚠ his 2.2x — every shop item, measured against what it is made of", () => {
  /* > *"lets research some prices and set some prices where the price we come
     >  up with the app is somewhere roughly 2.2x the raw materials cost of
     >  lumber and nails for each beam/column/truss plate/safety gap."*
     He named four things. All of them are here, and the point is that the
     ratio holds for EACH rather than on average — a markup that is 2.2 across
     a building and 0.8 on its LVLs is the defect this replaced. */
  const items: [string, PanelMember[]][] = [
    ["safety gap", buildSafetyGapMembers(DEPTH_IN, HEIGHT_IN)],
    ["truss plate", buildTrussPlateMembers(TEN_FEET_IN, DEPTH_IN)],
    ["box beam", buildBoxBeamMembers(TEN_FEET_IN, DEPTH_IN)],
    ["ridge beam", buildRoofCatcherBeamMembers(TEN_FEET_IN)],
    ["big header beam", buildBigHeaderBeamMembers(96, DEPTH_IN, 12)],
  ];

  for (const [name, members] of items) {
    it(`a ${name} sells for exactly 2.2x its materials`, () => {
      expect(markupOf(members)).toBeCloseTo(shopItemMaterialsMarkup.value, 9);
    });
  }

  it('a structural column too — his word was "column", and this is the one', () => {
    /* ⚠ NOT the 25.5in Column PANEL, which is a straw panel and keeps the
       flat rate. This is the 4-pack of 2x8s standing under the ridge beam. */
    const built = buildStructuralColumnMembers({ heightIn: 96 });
    expect(built.refusal).toBeNull();
    expect(markupOf(built.members)).toBeCloseTo(shopItemMaterialsMarkup.value, 9);
  });
});

describe("⚠ the rates this replaced were wrong in BOTH directions", () => {
  /* Measured 2026-11-15 against researched November 2026 stock prices. The
     $4/$10/$60 per-square-foot table shipped that morning and was corrected
     the same day; these assertions are what caught it, kept so the old
     numbers can never quietly come back. */

  it("a 2x4 is about $14, not the $175 a $60/sq ft face rate charged", () => {
    const stick = buildTrussPlateMembers(TEN_FEET_IN, DEPTH_IN).find((m) => m.nominalSize === "2x4")!;
    const priced = computeShopItemPrice([stick]);
    /* 6.67 board feet at $0.95, plus 5% fasteners, times 2.2. */
    expect(priced.total).toBeGreaterThan(10);
    expect(priced.total).toBeLessThan(20);
    expect(memberLargestFaceSqFt(stick) * 60).toBeGreaterThan(priced.total * 10);
  });

  it("⚠ an LVL web is DEARER than the old rate, not cheaper — it was under cost", () => {
    /* The one error in the old table that under-charged: $10/sq ft of a 2x9
       web's face is $75 for a 10ft piece whose stock alone is about $97. */
    const web = buildBoxBeamMembers(TEN_FEET_IN, DEPTH_IN).find((m) => m.memberId.includes("lvl"))!;
    expect(shopItemPieceClass(web)).toBe("lvl");
    const materialCost = memberMaterialCost(web);
    expect(materialCost).toBeGreaterThan(memberLargestFaceSqFt(web) * 10);
    expect(computeShopItemPrice([web]).total).toBeGreaterThan(materialCost);
  });

  it("plywood was the one his own figure nearly got right", () => {
    /* $4/sq ft put a safety gap at $51.67 against ~$42 at 2.2x. Close, which
       is why it read as fine and the $60 beside it did not. */
    const gap = buildSafetyGapMembers(DEPTH_IN, HEIGHT_IN);
    const now = computeShopItemPrice(gap).total;
    const oldFaceRateBill = memberLargestFaceSqFt(gap[0]) * 4;
    expect(Math.abs(now - oldFaceRateBill) / oldFaceRateBill).toBeLessThan(0.3);
  });
});

describe("⚠ LVL is a speciesGrade, not a material", () => {
  it("a Box Beam's web costs like an engineered beam, not like framing lumber", () => {
    /* The trap: a Box Beam web carries `material: "dimensional_lumber"` with
       `speciesGrade: "LVL"`. Costing on material alone prices a $97 web as
       $19 of 2x stock, and the total still reconciles. */
    const webs = buildBoxBeamMembers(TEN_FEET_IN, DEPTH_IN).filter((m) => m.memberId.includes("lvl"));
    expect(webs.length).toBe(2);
    for (const web of webs) {
      expect(web.material).toBe("dimensional_lumber");
      expect(shopItemPieceClass(web)).toBe("lvl");
      expect(memberMaterialCost(web)).toBeGreaterThan(50);
    }
    /* Per piece, his own clarification: two LVLs are two of them. */
    expect(memberMaterialCost(webs[0])).toBeCloseTo(memberMaterialCost(webs[1]), 9);
  });
});

describe("nominalSectionIn — lumber is bought nominal", () => {
  it("rounds a dressed section up to the next even inch", () => {
    expect(nominalSectionIn(1.5)).toBe(2);
    expect(nominalSectionIn(3.5)).toBe(4);
    expect(nominalSectionIn(5.5)).toBe(6);
    expect(nominalSectionIn(7.25)).toBe(8);
    expect(nominalSectionIn(11.25)).toBe(12);
  });

  it("⚠ an exact nominal stays itself rather than jumping a size", () => {
    expect(nominalSectionIn(2)).toBe(2);
    expect(nominalSectionIn(4)).toBe(4);
  });
});

describe("⚠ nothing in a shop item is unpriced today", () => {
  it("no piece of any shop item falls through the stock table", () => {
    /* No stock price was researched for wire mesh, wood fiber board or
       fasteners-as-members. Those cost zero, which is honest only while no
       shop item contains one — so it is asserted rather than assumed. Every
       shop-item pipeline the export seam can carry is represented. */
    const items: PanelMember[][] = [
      buildSafetyGapMembers(DEPTH_IN, HEIGHT_IN),
      buildBoxBeamMembers(TEN_FEET_IN, DEPTH_IN),
      buildTrussPlateMembers(TEN_FEET_IN, DEPTH_IN),
      buildBigHeaderBeamMembers(96, DEPTH_IN, 12),
      buildWindowHeaderMembers(48, DEPTH_IN, 12),
      buildRoofCatcherBeamMembers(TEN_FEET_IN),
      buildStructuralColumnMembers({ heightIn: 96 }).members,
    ];
    for (const members of items) {
      expect(computeShopItemPrice(members).unpricedFaceSqFt).toBe(0);
    }
  });
});

describe("⚠ plywood jack studs — the shop item that lives inside a straw panel", () => {
  it("picks the plywood sheet and leaves the 2x4s inside the flat rate", () => {
    const members = buildOpeningAssemblyMembers(48, DEPTH_IN, "window", "plywood+2x4", 36, 84, 96, 0, [], false);
    const jacks = plywoodJackStuds(members);
    expect(jacks.length).toBeGreaterThan(0);
    for (const jack of jacks) expect(shopItemPieceClass(jack)).toBe("sheet");
    const all = members.filter((m) => m.role === "jack_stud");
    expect(all.length).toBeGreaterThan(jacks.length);
  });

  it("is charged on stock the panel's own coverage never contained", () => {
    const members = buildOpeningAssemblyMembers(48, DEPTH_IN, "window", "plywood", 36, 84, 96, 0, [], false);
    const jacks = plywoodJackStuds(members);
    expect(computeShopItemPrice(jacks).total).toBeGreaterThan(0);
    for (const jack of jacks) expect(jack.actualDimsIn.widthIn).toBeCloseTo(DEPTH_IN, 6);
  });
});

describe("copies and qty", () => {
  it("both multiply, and the markup is unaffected by either", () => {
    const members = buildSafetyGapMembers(DEPTH_IN, HEIGHT_IN);
    const one = computeShopItemPrice(members, 1).total;
    expect(computeShopItemPrice(members, 7).total).toBeCloseTo(one * 7, 6);
    expect(markupOf(members)).toBeCloseTo(shopItemMaterialsMarkup.value, 9);
  });
});
