const LB_TO_KG = 0.453592;

export interface InsulationWeightResult {
  weightLb: number;
  weightKg: number;
}

/** Weight = volume x density — shared by both the truss plate's Timber HP
 * fill and the box beam's dense-pack cellulose fill (see
 * trussPlateMembers.ts / boxBeamMembers.ts in @building-integrity/panel-catalog). */
export function computeInsulationWeight(volumeFt3: number, densityLbFt3: number): InsulationWeightResult {
  const weightLb = volumeFt3 * densityLbFt3;
  return { weightLb, weightKg: weightLb * LB_TO_KG };
}
