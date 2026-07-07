import { referenceDensities, standardPanelBom } from "@building-integrity/panel-catalog";

const IN3_PER_FT3 = 1728;
const LB_TO_KG = 0.453592;

// Standard dressed 2x4 actual dimensions (1.5in x 3.5in) — universal lumber
// industry sizing, not a Building-Integrity-specific number.
const TWO_BY_FOUR_THICKNESS_IN = 1.5;
const TWO_BY_FOUR_WIDTH_IN = 3.5;

export interface PanelWoodWeightResult {
  plywoodVolumeFt3: number;
  lumberVolumeFt3: number;
  weightLb: number;
  weightKg: number;
  includesNailer: boolean;
}

/**
 * Wood-only weight for one standard (or braced — same BOM) panel, from
 * Panel Set 1's component list. Top plate assembly mirrors the bottom plate
 * assembly (1 skin + 2x 2x4s each), per the BOM note.
 */
export function computeStandardPanelWoodWeight(includeNailer = false): PanelWoodWeightResult {
  const bom = standardPanelBom;

  const skinVolIn3 =
    bom.bottomPlateSkin.thicknessIn * bom.bottomPlateSkin.widthIn * bom.bottomPlateSkin.lengthIn;
  const girtWebVolIn3 = bom.girts.web.thicknessIn * bom.girts.web.widthIn * bom.girts.web.lengthIn;

  const plywoodVolIn3 =
    skinVolIn3 * bom.bottomPlateSkin.qty * 2 + // bottom + mirrored top plate skin
    girtWebVolIn3 * bom.girts.qty;

  const twoByFourVolIn3 = (lengthIn: number) =>
    TWO_BY_FOUR_THICKNESS_IN * TWO_BY_FOUR_WIDTH_IN * lengthIn;

  const lumberVolIn3 =
    twoByFourVolIn3(bom.bottomPlate2x4s.lengthIn) * bom.bottomPlate2x4s.qty * 2 + // bottom + mirrored top plate 2x4s
    twoByFourVolIn3(bom.studs.lengthIn) * bom.studs.qty +
    twoByFourVolIn3(bom.girts.block.lengthIn) * bom.girts.qty +
    (includeNailer ? twoByFourVolIn3(bom.nailer.lengthIn) * bom.nailer.qty : 0);

  const plywoodVolumeFt3 = plywoodVolIn3 / IN3_PER_FT3;
  const lumberVolumeFt3 = lumberVolIn3 / IN3_PER_FT3;

  const weightLb =
    plywoodVolumeFt3 * referenceDensities.plywoodLbFt3.value +
    lumberVolumeFt3 * referenceDensities.framingLumberLbFt3.value;

  return {
    plywoodVolumeFt3,
    lumberVolumeFt3,
    weightLb,
    weightKg: weightLb * LB_TO_KG,
    includesNailer: includeNailer,
  };
}
