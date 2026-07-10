import { computeStrawWeight } from "./weight";

const KG_TO_LB = 2.20462;

export interface PanelWeightComponent {
  label: string;
  /** null = applicable to this panel but not yet modeled (surfaced
   * honestly, never silently treated as 0 in the modeled total). */
  weightKg: number | null;
  weightLb: number | null;
}

export interface PanelWeightBreakdown {
  strawOnlyWeightKg: number;
  strawOnlyWeightLb: number;
  components: PanelWeightComponent[];
  /** Sum of every component that IS modeled (straw, plus wood when known)
   * — fasteners/clay/lime are flagged separately, not silently zeroed. */
  totalModeledWeightKg: number;
  totalModeledWeightLb: number;
}

export interface PanelWeightBreakdownInputs {
  widthIn: number;
  thicknessIn: number;
  heightIn: number;
  densityKgM3: number;
  /** A number when wood IS modeled for this panel type (standard/braced
   * today, via computeStandardPanelWoodWeight); null for a known-
   * applicable-but-unmodeled gap (corner/safety-gap — no BOM yet). */
  woodWeightKg: number | null;
  /** A number when fastener counts are modeled for this panel type
   * (standard/braced/column/corner, via computeFastenerWeight on its real
   * member list); null for a known-applicable-but-unmodeled gap
   * (header/sill/safety-gap — no member geometry yet). */
  fastenerWeightKg: number | null;
  /** True only when the interior or exterior finish actually applies a
   * clay-plaster coat directly on this panel's straw face. */
  hasClayPlaster: boolean;
  /** True only when the exterior finish actually applies a lime-plaster
   * coat directly on this panel's straw face. */
  hasLimePlaster: boolean;
}

/**
 * Full weight breakdown for one individual panel — straw is always
 * computable from its own dimensions; wood/fasteners/clay/lime are each
 * either a real number or an honest "not modeled" placeholder (clay/lime
 * are entirely omitted, not just unmodeled, when that finish isn't even
 * selected — they're not applicable to every panel).
 */
export function computePanelWeightBreakdown(inputs: PanelWeightBreakdownInputs): PanelWeightBreakdown {
  const straw = computeStrawWeight(inputs.widthIn, inputs.thicknessIn, inputs.heightIn, inputs.densityKgM3);

  const toLb = (kg: number | null) => (kg === null ? null : kg * KG_TO_LB);

  const components: PanelWeightComponent[] = [
    { label: "Straw", weightKg: straw.weightKg, weightLb: straw.weightLb },
    { label: "Wood (studs/plates/girts)", weightKg: inputs.woodWeightKg, weightLb: toLb(inputs.woodWeightKg) },
    { label: "Fasteners", weightKg: inputs.fastenerWeightKg, weightLb: toLb(inputs.fastenerWeightKg) },
    ...(inputs.hasClayPlaster ? [{ label: "Clay plaster", weightKg: null, weightLb: null }] : []),
    ...(inputs.hasLimePlaster ? [{ label: "Lime plaster", weightKg: null, weightLb: null }] : []),
  ];

  const totalModeledWeightKg = components.reduce((sum, c) => sum + (c.weightKg ?? 0), 0);

  return {
    strawOnlyWeightKg: straw.weightKg,
    strawOnlyWeightLb: straw.weightLb,
    components,
    totalModeledWeightKg,
    totalModeledWeightLb: totalModeledWeightKg * KG_TO_LB,
  };
}
