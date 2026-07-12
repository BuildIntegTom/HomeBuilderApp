import type { PanelMember } from "@building-integrity/panel-catalog";

/**
 * Board foot: the standard softwood-lumber volume/purchasing unit —
 * (thickness_in x width_in x length_ft) / 12, using NOMINAL dimensions
 * (e.g. a "2x4" is 2in x 4in nominal, not its actual 1.5in x 3.5in), per
 * standard lumber-industry convention (cross-referenced against board
 * foot calculators — see PR notes). Tommy: "you should be able to have a
 * way to read how many boardfeet of 2x4's (and any other dimensional
 * lumber) are in a panel."
 */
export function computeBoardFeet(lengthFt: number, nominalThicknessIn: number, nominalWidthIn: number): number {
  return (nominalThicknessIn * nominalWidthIn * lengthFt) / 12;
}

/** Nominal (not actual) cross-section for each dimensional-lumber size
 * this catalog uses — a "2x4" is 2in x 4in nominal (1.5in x 3.5in
 * actual), a "2x6" is 2in x 6in nominal (1.5in x 5.5in actual). Board
 * feet is always computed from the NOMINAL size, per lumber-industry
 * convention, never the actual (planed/dried) dimension. */
const NOMINAL_DIMS_IN: Record<string, { thicknessIn: number; widthIn: number }> = {
  "2x4": { thicknessIn: 2, widthIn: 4 },
  "2x6": { thicknessIn: 2, widthIn: 6 },
  "2x8": { thicknessIn: 2, widthIn: 8 },
};

export interface BoardFeetBySize {
  nominalSize: string;
  /** Total board feet across every member of this nominal size. */
  totalBoardFeet: number;
  /** The stock length (ft) each purchased stick comes in — e.g. the
   * standard panel height, since Tommy: "if the panel height standard is
   * 10ft, then we're getting 10ft 2x4s." */
  stockLengthFt: number;
  /** Board feet in ONE stick of this size at stockLengthFt. */
  boardFeetPerStick: number;
  /** Purchase count: total board feet needed, divided by how many board
   * feet one stock-length stick provides, rounded up (you can't buy a
   * fraction of a stick). */
  stickCount: number;
}

/**
 * Sums board feet per nominal dimensional-lumber size across a set of
 * panel members, then converts to a "how many standard stock-length
 * sticks do I need to buy" purchase count (Tommy: "that total should be
 * put onto the materials total and divided by the panel height to count
 * 2x4's... if the panel height standard is 10ft, then we're getting 10ft
 * 2x4s so divide the board feet by 10") — dividing by how many board feet
 * ONE 10ft stick of that size provides (not literally "10"), so the
 * result scales correctly for every nominal size (a 2x6 stick has more
 * board feet than a 2x4 stick at the same stock length).
 */
export function computeBoardFeetByNominalSize(members: PanelMember[], stockLengthFt: number): BoardFeetBySize[] {
  const totals = new Map<string, number>();
  for (const m of members) {
    if (m.material !== "dimensional_lumber" || !m.nominalSize) continue;
    const dims = NOMINAL_DIMS_IN[m.nominalSize];
    if (!dims) continue;
    const lengthFt = m.actualDimsIn.lengthIn / 12;
    const boardFeet = computeBoardFeet(lengthFt, dims.thicknessIn, dims.widthIn) * m.qty;
    totals.set(m.nominalSize, (totals.get(m.nominalSize) ?? 0) + boardFeet);
  }
  return [...totals.entries()].map(([nominalSize, totalBoardFeet]) => {
    const dims = NOMINAL_DIMS_IN[nominalSize]!;
    const boardFeetPerStick = computeBoardFeet(stockLengthFt, dims.thicknessIn, dims.widthIn);
    return {
      nominalSize,
      totalBoardFeet,
      stockLengthFt,
      boardFeetPerStick,
      stickCount: boardFeetPerStick > 0 ? Math.ceil(totalBoardFeet / boardFeetPerStick) : 0,
    };
  });
}
