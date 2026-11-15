import { memberLargestFaceSqFt, shopItemRates, type PanelMember } from "@building-integrity/panel-catalog";

/**
 * ⚠ **THE SHOP ITEMS' OWN PRICES — the first and only exception to "$25/sq ft
 * for absolutely everything".**
 *
 * > *"Plywood jack studs and safety gaps $4/sq ft. LVLs $10/sq ft, per LVL.
 * > Beams and columns built from dimensional lumber $60/sq ft."*
 * > — Tommy, 2026-11-15
 *
 * A straw panel is still `priceRates.coveragePerSqFt` by the face it stands
 * up as, unchanged. What has moved out from under the flat rate is everything
 * that is NOT a straw panel: the Safety Gap's filler sheet, the plywood jack
 * studs beside every opening, and the beams — Box Beam, Truss Plate, Mid-Wall
 * Beam, Spanning Header.
 *
 * ⚠ **PER PIECE, on each piece's own largest face**, which is his wording in
 * both halves of the instruction: *"the piece's largest face"*, and, on what
 * "per LVL" means, *"each LVL is priced on its own largest face: a header made
 * of two LVLs is two of them."* So a Box Beam is four prices — two webs and
 * two caps — not one price on the beam's envelope. The alternative reading
 * (one rate on the assembled thing's biggest face) is about 3x higher on a
 * Truss Plate and about the same on a Box Beam, and no printed arithmetic
 * would reveal which one was used. It is per piece.
 *
 * ⚠ **A plywood jack stud is priced here EVEN THOUGH IT LIVES INSIDE A STRAW
 * PANEL, and that supersedes a decision of his.** On 2026-11-08, asked
 * whether jack studs should carry a fee of their own, he chose *"explicitly
 * rolled into the $25"* on the grounds that one occupies almost no coverage
 * area. The $4 line names them, so they are charged. It is not a double
 * charge of the same square foot: a jack stud's own large face is the 15.5in
 * through the wall, and the panel's coverage area never contained it — the
 * panel's face only ever saw the 3/4in edge.
 *
 * ⚠ **IT IS A PRICE, NOT A COST**, the same caveat `priceRates` carries.
 * There is no cost data in this app, so nothing here says whether $60/sq ft
 * on a 2x4's face has margin in it.
 */

export type ShopItemPieceClass = "sheet" | "lvl" | "dimensional" | "unpriced";

/**
 * Which of his three rates a piece takes — or `unpriced`, for a material he
 * named no rate for.
 *
 * ⚠ **LVL IS CHECKED FIRST, AND IT IS A `speciesGrade`.** A Box Beam's web
 * carries `material: "dimensional_lumber"` with `speciesGrade: "LVL"`, because
 * an LVL is dimensional lumber as far as weight, board feet and every other
 * consumer is concerned. Reading `material` alone would put every LVL on the
 * $60 rate — six times his number — and the total would still reconcile
 * against its own printed working, so nothing would show it.
 */
export function shopItemPieceClass(member: PanelMember): ShopItemPieceClass {
  if ((member.speciesGrade ?? "").toUpperCase() === "LVL") return "lvl";
  if (member.material === "plywood" || member.material === "osb") return "sheet";
  if (member.material === "dimensional_lumber") return "dimensional";
  /* wire_mesh, wood_fiber_board, fastener — he named no rate. See
     `shopItemRates`' own note: zero, and said out loud, rather than folded
     into whichever neighbouring rate looks closest. */
  return "unpriced";
}

export function shopItemClassRatePerSqFt(pieceClass: ShopItemPieceClass): number {
  switch (pieceClass) {
    case "sheet":
      return shopItemRates.sheetPerSqFt;
    case "lvl":
      return shopItemRates.lvlPerSqFt;
    case "dimensional":
      return shopItemRates.dimensionalLumberPerSqFt;
    case "unpriced":
      return 0;
  }
}

export interface ShopItemPieceLine {
  memberId: string;
  pieceClass: ShopItemPieceClass;
  /** This piece's own largest face, once. */
  faceSqFt: number;
  /** `qty` x `copies` — how many of this piece the building needs. */
  pieces: number;
  ratePerSqFt: number;
  total: number;
}

export interface ShopItemPrice {
  lines: ShopItemPieceLine[];
  /** Summed face area, for the printed working. */
  faceSqFt: number;
  total: number;
  /** Face area the app could not price, because he named no rate for it. */
  unpricedFaceSqFt: number;
}

/**
 * One shop item's price: every piece in it, each on its own largest face, at
 * its own material's rate, times how many of the item the building needs.
 *
 * ⚠ **`member.qty` AND `copies` both multiply.** A jack stud's `qty: 1` means
 * "one of a pair" by its own note, and a fabrication group is one drawing
 * covering N identical items. Dropping either is how a building comes up
 * short — the same confusion `ExportableAssembly.copies` carries a warning
 * about, arriving here as money instead of as stock.
 */
export function computeShopItemPrice(members: readonly PanelMember[], copies = 1): ShopItemPrice {
  const lines: ShopItemPieceLine[] = [];
  let total = 0;
  let faceSqFt = 0;
  let unpricedFaceSqFt = 0;
  for (const member of members) {
    const pieceClass = shopItemPieceClass(member);
    const pieces = member.qty * copies;
    const memberFaceSqFt = memberLargestFaceSqFt(member);
    const ratePerSqFt = shopItemClassRatePerSqFt(pieceClass);
    const lineTotal = memberFaceSqFt * pieces * ratePerSqFt;
    lines.push({ memberId: member.memberId, pieceClass, faceSqFt: memberFaceSqFt, pieces, ratePerSqFt, total: lineTotal });
    total += lineTotal;
    faceSqFt += memberFaceSqFt * pieces;
    if (pieceClass === "unpriced") unpricedFaceSqFt += memberFaceSqFt * pieces;
  }
  return { lines, faceSqFt, total, unpricedFaceSqFt };
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
 * jack studs. The 2x4s are not in his table, so they stay inside the flat
 * rate where his 2026-11-08 answer left them.
 */
export function plywoodJackStuds(members: readonly PanelMember[]): PanelMember[] {
  return members.filter((m) => m.role === "jack_stud" && (m.material === "plywood" || m.material === "osb"));
}
