import {
  dimensionalLumberCostPerBoardFoot,
  fastenerAllowanceFraction,
  lvlCostPerSectionSqInPerFt,
  sheetGoodsCostPerSqFtPerInch,
  shopItemMaterialsMarkup,
  type PanelMember,
} from "@building-integrity/panel-catalog";
import { computeBoardFeet } from "./boardFeet";

/**
 * ⚠ **SHOP ITEMS ARE PRICED AT 2.2x WHAT THEY ARE MADE OF — his own rule,
 * 2026-11-15.**
 *
 * > *"lets research some prices and set some prices where the price we come up
 * > with the app is somewhere roughly 2.2x the raw materials cost of lumber
 * > and nails for each beam/column/truss plate/safety gap."*
 *
 * ⚠ **THIS REPLACES THE $4 / $10 / $60 PER-SQUARE-FOOT TABLE SHIPPED EARLIER
 * THE SAME DAY, AND THAT TABLE WAS BADLY WRONG IN BOTH DIRECTIONS.** Measured
 * against researched November 2026 stock prices:
 *
 * | piece | old rate charged | multiple of materials |
 * |---|---|---|
 * | one 2x4, 10ft | $175.00 | **27.6x** |
 * | one 2x12, 10ft | $562.50 | **29.6x** |
 * | safety gap sheet | $51.67 | 2.8x |
 * | one 2x9 LVL web, 10ft | $75.00 | **0.8x — under cost** |
 *
 * So his $4/sq ft on plywood was close to right, his $60/sq ft on dimensional
 * lumber was about thirteen times too high, and his $10/sq ft on LVL did not
 * cover the stock. A truss plate — which is in essentially every building this
 * app draws — was being quoted at roughly thirteen times its materials. That
 * went out on `main` before this correction, which is the honest reason this
 * file now derives rather than tabulates.
 *
 * ⚠ **WHY A SQUARE-FOOT RATE COULD NOT HAVE WORKED.** A rate per square foot
 * of largest face is a rate per unit of SURFACE, and a stick of lumber is sold
 * by VOLUME. The two track each other only while the section is fixed: double
 * a 2x4's depth to a 2x8 and its face doubles while its cost doubles, so it
 * survives; but a 3/4in plywood sheet and a 2x12 of the same face area differ
 * in cost by fifteen times. One rate across both was never going to land, at
 * any value.
 *
 * ---
 *
 * ## ⚠ ITEMS AND PANELS: two methods, on purpose
 *
 * He asked to *"uniformly address how 'items' are treated with price compared
 * to panels"*. The uniform answer is not one formula — it is one RULE about
 * which formula applies, and the rule is what the thing is:
 *
 * - **A straw panel is priced by its FACE**, at `priceRates.coveragePerSqFt`
 *   ($25/sq ft), unchanged. What a panel sells is enclosure — a square foot of
 *   finished wall, floor or roof — and its cost is mostly straw and the labour
 *   to stuff and skin it, neither of which this app can cost. Area is the only
 *   honest unit for it.
 * - **A shop item is priced by its MATERIALS**, at 2.2x. What an item sells is
 *   a piece of stock, cut and assembled. Its cost IS the stock, which can be
 *   looked up, so looking it up beats charging it by the square foot of a face
 *   that has nothing to do with what it cost.
 *
 * ⚠ **Both are still per PIECE and both still exclude labour**, which is the
 * part that makes them comparable. And `countsAsPanel` remains the single
 * switch that decides which applies, exactly as it decides which face an
 * export measures and whether a crew tallies it.
 *
 * ⚠ **The LARGEST-FACE rule is untouched** — it is still what the exported
 * `Sq ft` column reports for a shop item, because that column is about what a
 * crew handles and is credited for, not about what the piece cost. See
 * `shopItemFace.ts`. Area stopped being the basis of the PRICE; it did not
 * stop being the measure of the PIECE.
 */

export type ShopItemPieceClass = "sheet" | "lvl" | "dimensional" | "unpriced";

/**
 * Which stock a piece is cut from.
 *
 * ⚠ **LVL IS CHECKED FIRST, AND IT IS A `speciesGrade`.** A Box Beam's web
 * carries `material: "dimensional_lumber"` with `speciesGrade: "LVL"`, because
 * an LVL is dimensional lumber as far as weight, board feet and every other
 * consumer is concerned. Reading `material` alone would price a $97 LVL web as
 * $19 of framing lumber, and the total would still reconcile against its own
 * printed working, so nothing would show it.
 */
export function shopItemPieceClass(member: PanelMember): ShopItemPieceClass {
  if ((member.speciesGrade ?? "").toUpperCase() === "LVL") return "lvl";
  if (member.material === "plywood" || member.material === "osb") return "sheet";
  if (member.material === "dimensional_lumber") return "dimensional";
  /* wire_mesh, wood_fiber_board, fastener — no stock price researched. See
     `materialCosts.ts`. Zero, and said out loud, rather than folded into
     whichever neighbouring rate looks closest. */
  return "unpriced";
}

/**
 * Nominal section from a dressed one — 1.5in reads as 2, 3.5in as 4, 11.25in
 * as 12.
 *
 * ⚠ **Board feet are a NOMINAL measure and lumber is sold that way**, so
 * costing a 2x4 off its real 1.5in x 3.5in would under-count by a quarter.
 * Used only when a member carries no `nominalSize` of its own; most do.
 *
 * The rule is "up to the next even inch", which is how dressed softwood
 * sizing works across the whole 2x range this catalog uses. The epsilon stops
 * an exact 2.0in from being read as a 4.
 */
export function nominalSectionIn(actualIn: number): number {
  return Math.max(1, Math.ceil((actualIn - 1e-6) / 2) * 2);
}

function parseNominalSize(nominalSize: string | null): { thicknessIn: number; widthIn: number } | null {
  if (!nominalSize) return null;
  const match = /(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i.exec(nominalSize);
  if (!match) return null;
  return { thicknessIn: Number(match[1]), widthIn: Number(match[2]) };
}

/**
 * What one piece of this stock costs to buy, before any markup.
 *
 * ⚠ **`qty` is NOT applied here** — this is one piece. The multiplying is done
 * by `computeShopItemPrice`, which also has `copies` to apply, and doing it in
 * two places is how a building comes up short.
 */
export function memberMaterialCost(member: PanelMember): number {
  const { thicknessIn, widthIn, lengthIn } = member.actualDimsIn;
  switch (shopItemPieceClass(member)) {
    case "lvl":
      /* Priced off its real section: an LVL is sold as an engineered beam of a
         given depth, not by the board foot. */
      return thicknessIn * widthIn * (lengthIn / 12) * lvlCostPerSectionSqInPerFt.value;
    case "sheet":
      return ((widthIn * lengthIn) / 144) * thicknessIn * sheetGoodsCostPerSqFtPerInch.value;
    case "dimensional": {
      const nominal = parseNominalSize(member.nominalSize) ?? {
        thicknessIn: nominalSectionIn(thicknessIn),
        widthIn: nominalSectionIn(widthIn),
      };
      return (
        computeBoardFeet(lengthIn / 12, nominal.thicknessIn, nominal.widthIn) *
        dimensionalLumberCostPerBoardFoot.value
      );
    }
    case "unpriced":
      return 0;
  }
}

export interface ShopItemPieceLine {
  memberId: string;
  pieceClass: ShopItemPieceClass;
  /** This piece's own largest face, once — reported, not priced. */
  faceSqFt: number;
  /** `qty` x `copies` — how many of this piece the building needs. */
  pieces: number;
  /** Stock cost of ONE piece, before fasteners and before the markup. */
  materialCostEach: number;
  /** Every copy's stock cost, with the fastener allowance. */
  materialCost: number;
  total: number;
}

export interface ShopItemPrice {
  lines: ShopItemPieceLine[];
  /** Summed largest faces, for the exported `Sq ft` and the printed working. */
  faceSqFt: number;
  /** Lumber, sheet goods and the fastener allowance — what the 2.2x multiplies. */
  materialCost: number;
  total: number;
  /** Face area carrying no stock price, because none was researched for it. */
  unpricedFaceSqFt: number;
}

/**
 * One shop item's price: every piece's stock cost, plus the fastener
 * allowance, times his 2.2.
 *
 * ⚠ **`member.qty` AND `copies` both multiply.** A jack stud's `qty: 1` means
 * "one of a pair" by its own note, and a fabrication group is one drawing
 * covering N identical items. Dropping either is how a building comes up
 * short — the same confusion `ExportableAssembly.copies` carries a warning
 * about, arriving here as money instead of as stock.
 */
export function computeShopItemPrice(members: readonly PanelMember[], copies = 1): ShopItemPrice {
  const lines: ShopItemPieceLine[] = [];
  let materialCost = 0;
  let faceSqFt = 0;
  let unpricedFaceSqFt = 0;
  const withFasteners = 1 + fastenerAllowanceFraction.value;
  for (const member of members) {
    const pieceClass = shopItemPieceClass(member);
    const pieces = member.qty * copies;
    const { thicknessIn, widthIn, lengthIn } = member.actualDimsIn;
    const memberFaceSqFt =
      Math.max(
        Math.abs(thicknessIn * widthIn),
        Math.abs(thicknessIn * lengthIn),
        Math.abs(widthIn * lengthIn),
      ) / 144;
    const each = memberMaterialCost(member);
    const lineMaterial = each * pieces * withFasteners;
    lines.push({
      memberId: member.memberId,
      pieceClass,
      faceSqFt: memberFaceSqFt,
      pieces,
      materialCostEach: each,
      materialCost: lineMaterial,
      total: lineMaterial * shopItemMaterialsMarkup.value,
    });
    materialCost += lineMaterial;
    faceSqFt += memberFaceSqFt * pieces;
    if (pieceClass === "unpriced") unpricedFaceSqFt += memberFaceSqFt * pieces;
  }
  return {
    lines,
    faceSqFt,
    materialCost,
    total: materialCost * shopItemMaterialsMarkup.value,
    unpricedFaceSqFt,
  };
}

/**
 * ⚠ **The plywood jack studs inside a straw panel — the one shop item that is
 * not its own assembly.**
 *
 * Every other shop item is a row on the export seam of its own. A jack stud
 * is a piece of the window, door, Big Header or gable-window panel it stands
 * beside, so there is nothing to look it up by except its own role, and its
 * panel keeps counting as one panel and keeps being priced by its full
 * standing face.
 *
 * ⚠ **`material` is the second half of the test, and it is doing real work.**
 * `role: "jack_stud"` also covers the optional 2x4 jack studs that stand one
 * per wythe beside the sheet (see `jackStudMembers.ts`). He priced *plywood*
 * jack studs. The 2x4s are not in his list, so they stay inside the flat rate
 * where his 2026-11-08 answer left them.
 */
export function plywoodJackStuds(members: readonly PanelMember[]): PanelMember[] {
  return members.filter((m) => m.role === "jack_stud" && (m.material === "plywood" || m.material === "osb"));
}
