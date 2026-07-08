const KG_TO_LB = 2.20462;
/** CO2 molar mass (44) / carbon molar mass (12) — fixed chemistry, not a
 * Building-Integrity-specific assumption, so unlike the rest of this
 * file's values it needs no confirmation/status tracking. */
const CARBON_TO_CO2E_RATIO = 44 / 12;

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

export interface EmbodiedCarbonCO2eResult {
  /** Straw's sequestered carbon, converted to CO2-equivalent — a credit
   * (positive contribution to the net total). */
  strawCO2eKg: number;
  /** Concrete's embodied emissions — a debit (subtracted from the net total). */
  concreteCO2eKg: number;
  /** strawCO2eKg - concreteCO2eKg: straw counts positive, concrete negative (Tommy). */
  netCO2eKg: number;
}

/**
 * Nets straw's sequestered carbon against concrete's embodied emissions
 * into one running CO2e total for the build. Straw's carbon mass is
 * converted to CO2-equivalent via the fixed CO2/C molar mass ratio;
 * concrete's factor is a literature/EPD-sourced value per unit volume
 * (see concreteEmbodiedCarbonKgPerFt3, @building-integrity/panel-catalog).
 */
export function computeNetEmbodiedCarbonCO2e(
  strawCarbonSequesteredKg: number,
  concreteVolumeFt3: number,
  concreteEmbodiedCarbonKgPerFt3: number,
): EmbodiedCarbonCO2eResult {
  const strawCO2eKg = strawCarbonSequesteredKg * CARBON_TO_CO2E_RATIO;
  const concreteCO2eKg = concreteVolumeFt3 * concreteEmbodiedCarbonKgPerFt3;
  return {
    strawCO2eKg,
    concreteCO2eKg,
    netCO2eKg: strawCO2eKg - concreteCO2eKg,
  };
}
