const IN_TO_M = 0.0254;
const KG_TO_LB = 2.20462;

export interface StrawWeightResult {
  volumeM3: number;
  weightKg: number;
  weightLb: number;
  /** Wood (studs/plates/girts) and nails/fasteners aren't included — no BOM/lumber-weight data in spec yet. */
  woodAndFastenersModeled: false;
}

/**
 * Straw-core weight only: volume x density. Spec's full weight formula is
 * "straw volume x density-at-moisture + wood + nails" — the wood/nail term
 * needs a bill of materials (stud/plate/girt sizes, nail counts) that isn't
 * in the spec yet, so it's deliberately left out rather than guessed.
 */
export function computeStrawWeight(
  widthIn: number,
  thicknessIn: number,
  heightIn: number,
  densityKgM3: number,
): StrawWeightResult {
  const volumeM3 = widthIn * IN_TO_M * thicknessIn * IN_TO_M * heightIn * IN_TO_M;
  const weightKg = volumeM3 * densityKgM3;
  return {
    volumeM3,
    weightKg,
    weightLb: weightKg * KG_TO_LB,
    woodAndFastenersModeled: false,
  };
}
