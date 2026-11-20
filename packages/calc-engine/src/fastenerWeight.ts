import { RING_GIRT_ID_PREFIX, RING_GIRT_SCREWS_PER_RING, type PanelMember } from "@building-integrity/panel-catalog";

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
 * - ⚠ The "T25 #9" screw this file used to carry (jack sheet fastening) is
 *   GONE as of 2026-11-19: Tommy moved the jack sheet onto the GRK schedule
 *   ("just the one schedule"), so there is one fastener for that joint and
 *   `computeJackStudFastenerWeight` uses the 4in GRK figure above. The #9
 *   estimate is not kept "just in case" — an unused weight constant for a
 *   screw the app no longer specifies is a number waiting to be mis-cited.
 * - A "3.5in #10" screw (ring girts, Tommy 2026-11-05) is modeled the same
 *   way one step up: a #10 wood screw's ANSI major diameter is ~0.190in, and
 *   the same 0.791 ratio the #9 above uses gives a ~0.15in effective solid
 *   diameter. ⚠ Derived from the #9 figure rather than measured, so it
 *   carries exactly the estimate status every number in this file does.
 * - Steel density: 0.284 lb/in3 (standard reference value for mild steel).
 * Flag as illustrative/estimated wherever these numbers surface in the UI.
 */
const STEEL_DENSITY_LB_PER_IN3 = 0.284;
const GRK_EFFECTIVE_DIAMETER_IN = 0.25;
const NAIL_DIAMETER_IN = 0.113;
const NAIL_LENGTH_IN = 2;
const NO10_EFFECTIVE_DIAMETER_IN = 0.15;

function cylinderWeightLb(diameterIn: number, lengthIn: number): number {
  const areaIn2 = (Math.PI / 4) * diameterIn ** 2;
  return areaIn2 * lengthIn * STEEL_DENSITY_LB_PER_IN3;
}

export const PLYWOOD_NAIL_WEIGHT_LB = cylinderWeightLb(NAIL_DIAMETER_IN, NAIL_LENGTH_IN);
export const GRK_3IN_WEIGHT_LB = cylinderWeightLb(GRK_EFFECTIVE_DIAMETER_IN, 3);
export const GRK_4IN_WEIGHT_LB = cylinderWeightLb(GRK_EFFECTIVE_DIAMETER_IN, 4);
export const GRK_6IN_WEIGHT_LB = cylinderWeightLb(GRK_EFFECTIVE_DIAMETER_IN, 6);
export const NO10_3_5IN_WEIGHT_LB = cylinderWeightLb(NO10_EFFECTIVE_DIAMETER_IN, 3.5);

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
 * - Every brace member gets 4x 4in GRK screws — TWO AT EACH END.
 *   ⚠ These were 6in until 2026-10-25, when Tommy gave the real spec:
 *   *"Each end of each 2x4 on the diagonals has 2 5/16in GRKs 4in screws
 *   predrilled and driven."* The count of four was already right; the length
 *   was not, and 6in screws weigh half again what 4in ones do.
 * Blocking (Column/Corner panels) has no fastener rule specified yet —
 * left out rather than guessed.
 *
 * ⚠ **RING GIRTS are counted PER RING, not per board** — B31, 2026-11-06.
 * Tommy: *"4 3.5in #10 screws hold each corner of the 4 pieces of the ring
 * Girt. Each of the 4 places where the girt touches flush against the frame
 * each get 3 of the same screws."* That is 28 a ring, and it is a count of
 * JOINTS rather than of members, so the per-board rules above cannot express
 * it: a ring with a cut rail has 8 boards and the same 28 screws. Its members
 * are therefore taken out of the plywood-nail seam (a ring has no plywood to
 * nail to) and out of the 3in girt-bar rule, and counted by ring instead.
 *
 * ⚠ What his spec does NOT cover is how the 42in TIE laps the cut rail. Those
 * joints are carried at zero rather than estimated — the count below is his
 * number exactly, and a panel whose rings are cut is under-counted by however
 * many screws that lap turns out to take.
 */
export function computeFastenerWeight(members: PanelMember[]): FastenerWeightResult {
  const isRing = (m: PanelMember) => m.memberId.startsWith(RING_GIRT_ID_PREFIX);
  const nailContactLengthIn = members
    .filter((m) => (m.role === "plate" || m.role === "girt") && !isRing(m))
    .reduce((sum, m) => sum + m.actualDimsIn.lengthIn, 0);
  const nailCount = Math.round(nailContactLengthIn / NAIL_SPACING_IN);

  const lidCount = members.filter((m) => m.role === "skin" || m.role === "girt_web").length;
  const girtBarCount = members.filter((m) => m.role === "girt" && !isRing(m)).length;
  const braceCount = members.filter((m) => m.role === "brace").length;
  /* One ring per distinct row number in `ring_girt_<row>_...`, so a cut rail
     adds boards without adding rings. */
  const ringCount = new Set(
    members.filter(isRing).map((m) => m.memberId.slice(RING_GIRT_ID_PREFIX.length).split("_")[0]),
  ).size;

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
  if (ringCount > 0) {
    items.push({
      label: `3.5in #10 screw (ring girts, ${RING_GIRT_SCREWS_PER_RING} each)`,
      count: ringCount * RING_GIRT_SCREWS_PER_RING,
      unitWeightLb: NO10_3_5IN_WEIGHT_LB,
      totalWeightLb: ringCount * RING_GIRT_SCREWS_PER_RING * NO10_3_5IN_WEIGHT_LB,
    });
  }
  if (braceCount > 0) {
    items.push({
      label: "4in GRK screw (brace members, 2 at each end)",
      count: braceCount * 4,
      unitWeightLb: GRK_4IN_WEIGHT_LB,
      totalWeightLb: braceCount * 4 * GRK_4IN_WEIGHT_LB,
    });
  }

  const totalWeightLb = items.reduce((sum, i) => sum + i.totalWeightLb, 0);
  return { items, totalWeightLb, totalWeightKg: totalWeightLb * LB_TO_KG };
}

/**
 * ⚠ **ONE SCHEDULE, 2026-11-19.** Tommy: *"might as well just have jack studs
 * also get big screws. just the one schedule."*
 *
 * This replaced his earlier jack-stud rule — *"screwed to the adjacent wall
 * using 2 4in T25 #9 screws every 6in"* — which was the only one the app ever
 * counted, while the catalog's fastener schedule quoted a GRK 5/16"x4" for the
 * same joint and was counted nowhere. The Reference Points page put the two
 * side by side on the day it was built and he settled it in favour of the
 * schedule. So the jack sheet is now fastened exactly like a panel-to-panel
 * seam: one column of screws to each face, at that face's own spacing.
 *
 * ⚠ **THE COUNT FALLS A LOT, AND THAT IS THE INTENDED DIRECTION.** Two screws
 * every 6in is four a foot; this is one every 16in on the outside and one
 * every 24in on the inside. On a 96in sheet that is 32 screws down to 10. Each
 * one is far bigger (a 5/16in structural screw against a #9), which is the
 * trade he is describing — so the panel's fastener WEIGHT drops too, and the
 * jack-stud line on the shop sheets changes accordingly.
 */
const JACK_STUD_EXTERIOR_SPACING_IN = 16;
const JACK_STUD_INTERIOR_SPACING_IN = 24;

export function computeJackStudFastenerWeight(heightIn: number): FastenerWeightResult {
  /* Same round(length/spacing) convention as every other rule in this file. */
  const exteriorCount = Math.round(heightIn / JACK_STUD_EXTERIOR_SPACING_IN);
  const interiorCount = Math.round(heightIn / JACK_STUD_INTERIOR_SPACING_IN);
  const count = exteriorCount + interiorCount;
  const items: FastenerLineItem[] = [
    {
      label: `4in GRK screw (jack sheet to panel, ${JACK_STUD_EXTERIOR_SPACING_IN}in o.c. exterior + ${JACK_STUD_INTERIOR_SPACING_IN}in o.c. interior)`,
      count,
      unitWeightLb: GRK_4IN_WEIGHT_LB,
      totalWeightLb: count * GRK_4IN_WEIGHT_LB,
    },
  ];
  const totalWeightLb = items.reduce((sum, i) => sum + i.totalWeightLb, 0);
  return { items, totalWeightLb, totalWeightKg: totalWeightLb * LB_TO_KG };
}
