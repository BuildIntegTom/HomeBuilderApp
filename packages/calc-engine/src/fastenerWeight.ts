import type { PanelMember } from "@building-integrity/panel-catalog";

const LB_TO_KG = 0.453592;

/**
 * Per-fastener weight estimates (Tommy: "look up approximate weight for
 * these based off of what you can cross reference from online") — no
 * manufacturer publishes a per-screw/per-nail weight spec sheet (checked
 * GRK Fasteners' own technical documentation and several retailer listings
 * for their RSS line), so these are physics-based estimates instead: each
 * fastener modeled as a plain steel cylinder (volume x steel density),
 * using its actual length and a reference shank diameter:
 * - GRK RSS structural screws are sold as a nominal 5/16in-diameter line
 *   (confirmed via retailer listings, e.g. "GRK 5/16 x 4 RSS"); the
 *   thread's fluted/tapered geometry removes real material versus a solid
 *   rod of that diameter, so 0.25in is used as a reduced "effective solid"
 *   diameter for the volume estimate.
 * - A 2in "plywood nail" is modeled on a standard 6d common nail's shank
 *   (0.113in diameter, ~2in length — a widely-published construction
 *   reference size).
 * - Steel density: 0.284 lb/in3 (standard reference value for mild steel).
 * Flag as illustrative/estimated wherever these numbers surface in the UI.
 */
const STEEL_DENSITY_LB_PER_IN3 = 0.284;
const GRK_EFFECTIVE_DIAMETER_IN = 0.25;
const NAIL_DIAMETER_IN = 0.113;
const NAIL_LENGTH_IN = 2;

function cylinderWeightLb(diameterIn: number, lengthIn: number): number {
  const areaIn2 = (Math.PI / 4) * diameterIn ** 2;
  return areaIn2 * lengthIn * STEEL_DENSITY_LB_PER_IN3;
}

export const PLYWOOD_NAIL_WEIGHT_LB = cylinderWeightLb(NAIL_DIAMETER_IN, NAIL_LENGTH_IN);
export const GRK_3IN_WEIGHT_LB = cylinderWeightLb(GRK_EFFECTIVE_DIAMETER_IN, 3);
export const GRK_4IN_WEIGHT_LB = cylinderWeightLb(GRK_EFFECTIVE_DIAMETER_IN, 4);
export const GRK_6IN_WEIGHT_LB = cylinderWeightLb(GRK_EFFECTIVE_DIAMETER_IN, 6);

const NAIL_SPACING_IN = 4;

export interface FastenerLineItem {
  label: string;
  count: number;
  unitWeightLb: number;
  totalWeightLb: number;
}

export interface FastenerWeightResult {
  items: FastenerLineItem[];
  totalWeightLb: number;
  totalWeightKg: number;
}

/**
 * Fastener count/weight for one panel's actual member list (Tommy):
 * - 2in plywood nails, staggered every 4in along every wood-to-plywood
 *   contact seam — counted as total (plate + girt bar) length / 4in. Skins
 *   nail to plates; girt webs ("lids") nail to girt bars — those are the
 *   2 seams Tommy named ("both plates and all girts"). Column/Corner
 *   panels' side plywood also contacts the corner studs, but that seam
 *   wasn't part of Tommy's spec, so it's not counted here — flagged as a
 *   known gap, not silently included.
 * - Every plywood "lid" (skins + girt webs) gets 8x 4in GRK screws.
 * - Every girt bar gets 8x 3in GRK screws.
 * - Every brace member (braced panels only) gets 4x 6in GRK screws.
 * Blocking (Column/Corner panels) has no fastener rule specified yet —
 * left out rather than guessed.
 */
export function computeFastenerWeight(members: PanelMember[]): FastenerWeightResult {
  const nailContactLengthIn = members
    .filter((m) => m.role === "plate" || m.role === "girt")
    .reduce((sum, m) => sum + m.actualDimsIn.lengthIn, 0);
  const nailCount = Math.round(nailContactLengthIn / NAIL_SPACING_IN);

  const lidCount = members.filter((m) => m.role === "skin" || m.role === "girt_web").length;
  const girtBarCount = members.filter((m) => m.role === "girt").length;
  const braceCount = members.filter((m) => m.role === "brace").length;

  const items: FastenerLineItem[] = [
    {
      label: "2in plywood nail (4in o.c., plates + girts)",
      count: nailCount,
      unitWeightLb: PLYWOOD_NAIL_WEIGHT_LB,
      totalWeightLb: nailCount * PLYWOOD_NAIL_WEIGHT_LB,
    },
    {
      label: "4in GRK screw (skins/girt webs, 8 each)",
      count: lidCount * 8,
      unitWeightLb: GRK_4IN_WEIGHT_LB,
      totalWeightLb: lidCount * 8 * GRK_4IN_WEIGHT_LB,
    },
    {
      label: "3in GRK screw (girt bars, 8 each)",
      count: girtBarCount * 8,
      unitWeightLb: GRK_3IN_WEIGHT_LB,
      totalWeightLb: girtBarCount * 8 * GRK_3IN_WEIGHT_LB,
    },
  ];
  if (braceCount > 0) {
    items.push({
      label: "6in GRK screw (braced-panel brace members, 4 each)",
      count: braceCount * 4,
      unitWeightLb: GRK_6IN_WEIGHT_LB,
      totalWeightLb: braceCount * 4 * GRK_6IN_WEIGHT_LB,
    });
  }

  const totalWeightLb = items.reduce((sum, i) => sum + i.totalWeightLb, 0);
  return { items, totalWeightLb, totalWeightKg: totalWeightLb * LB_TO_KG };
}
