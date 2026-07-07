const KG_TO_LB = 2.20462;

export interface CarbonResult {
  moistureContent: number;
  dryWeightKg: number;
  carbonKg: number;
  carbonLb: number;
}

/**
 * dryWeight = moistWeight x (1 - moistureContent) — wet-basis convention.
 * carbon = dryWeight x carbonFractionOfDryMass.
 */
export function computeCarbonSequestration(
  moistWeightKg: number,
  moistureContent: number,
  carbonFractionOfDryMass: number,
): CarbonResult {
  const dryWeightKg = moistWeightKg * (1 - moistureContent);
  const carbonKg = dryWeightKg * carbonFractionOfDryMass;
  return {
    moistureContent,
    dryWeightKg,
    carbonKg,
    carbonLb: carbonKg * KG_TO_LB,
  };
}

export interface CarbonRangeResult {
  atMinMoisture: CarbonResult;
  atStandardMoisture: CarbonResult;
  atMaxMoisture: CarbonResult;
}

/**
 * Same measured (moist) panel weight, evaluated across a moisture-content
 * range — lower moisture means more of that weight is dry straw, so carbon
 * is highest at the low end of the range and lowest at the high end.
 */
export function computeCarbonRange(
  moistWeightKg: number,
  moistureRange: { min: number; standard: number; max: number },
  carbonFractionOfDryMass: number,
): CarbonRangeResult {
  return {
    atMinMoisture: computeCarbonSequestration(
      moistWeightKg,
      moistureRange.min,
      carbonFractionOfDryMass,
    ),
    atStandardMoisture: computeCarbonSequestration(
      moistWeightKg,
      moistureRange.standard,
      carbonFractionOfDryMass,
    ),
    atMaxMoisture: computeCarbonSequestration(
      moistWeightKg,
      moistureRange.max,
      carbonFractionOfDryMass,
    ),
  };
}
