export interface OpeningWidth {
  widthIn: number;
}

/**
 * Sill tape linear length — Tommy: "Exto Seal is for window and door sills
 * linear length plus 1 foot" — the +1ft allowance is PER opening (overlap/
 * waste allowance at each individual sill), not once for the whole run.
 */
export function computeSillTapeLengthFt(openings: OpeningWidth[]): number {
  return openings.reduce((sum, o) => sum + o.widthIn / 12 + 1, 0);
}

export interface WallRun {
  lengthFt: number;
  heightFt: number;
}

export interface MembraneCoverageResult {
  areaSqFt: number;
  seamLengthFt: number;
}

/**
 * Fewest-seams roll-goods coverage (Tommy: "Intello ... is laid out in the
 * 3D model in the most efficient way (fewest seams for Tescon Vana)") —
 * for each wall run, compares running the roll vertically (strips the
 * full height, tiled across the run's length) against horizontally
 * (strips the full length, tiled up the height), keeping whichever
 * orientation needs less total seam length. `roofAreaSqFt` is added to
 * the area total only — see computeFootprintAreaSqFt's own doc comment
 * for why roof seams aren't computed (no real roof geometry exists yet).
 */
export function computeMembraneCoverage(walls: WallRun[], rollWidthFt: number, roofAreaSqFt: number): MembraneCoverageResult {
  let areaSqFt = roofAreaSqFt;
  let seamLengthFt = 0;
  for (const w of walls) {
    areaSqFt += w.lengthFt * w.heightFt;
    if (rollWidthFt <= 0) continue;
    const verticalStrips = Math.ceil(w.lengthFt / rollWidthFt);
    const verticalSeamFt = Math.max(0, verticalStrips - 1) * w.heightFt;
    const horizontalStrips = Math.ceil(w.heightFt / rollWidthFt);
    const horizontalSeamFt = Math.max(0, horizontalStrips - 1) * w.lengthFt;
    seamLengthFt += Math.min(verticalSeamFt, horizontalSeamFt);
  }
  return { areaSqFt, seamLengthFt };
}
