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

const KG_TO_METRIC_TON = 0.001;

/** EPA Greenhouse Gas Equivalencies Calculator reference factors (source:
 * epa.gov/energy/greenhouse-gas-equivalencies-calculator-calculations-and-references,
 * 2022 national-average data) — fixed published reference constants, not a
 * Building-Integrity-specific assumption, so (like CARBON_TO_CO2E_RATIO
 * above) they need no confirmation/status tracking of their own; only the
 * straw carbon assumptions feeding computeCarbonSequestration (moisture
 * content, carbon fraction) carry that. */
const CO2E_METRIC_TONS_PER_MILE_DRIVEN = 3.93e-4;
const CO2_METRIC_TONS_PER_LB_COAL = 9.0e-4;
const CO2E_METRIC_TONS_PER_SMARTPHONE_CHARGE = 1.24e-5;

export interface CO2eEquivalencies {
  milesDriven: number;
  lbCoalBurned: number;
  smartphonesCharged: number;
}

/**
 * Translates a CO2e mass into everyday-scale equivalents (Tommy: "its
 * respective conversions for average car driving miles, lbs of coal
 * burned, and smart phones charged equivalent") — see the EPA reference
 * constants above.
 */
export function computeCO2eEquivalencies(co2eKg: number): CO2eEquivalencies {
  const co2eMetricTons = co2eKg * KG_TO_METRIC_TON;
  return {
    milesDriven: co2eMetricTons / CO2E_METRIC_TONS_PER_MILE_DRIVEN,
    lbCoalBurned: co2eMetricTons / CO2_METRIC_TONS_PER_LB_COAL,
    smartphonesCharged: co2eMetricTons / CO2E_METRIC_TONS_PER_SMARTPHONE_CHARGE,
  };
}
