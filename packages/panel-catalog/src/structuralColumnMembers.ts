import type { PanelMember } from "./componentSchema";
import { LUMBER_SPECIES_GRADE, SKIN_PLY_SPEC, SKIN_THICKNESS_IN } from "./panelMemberHelpers";

/**
 * The column that carries a roof catcher beam down to the foundation.
 *
 * > *"coulmn panels should default as 15.5" wide directly centered under the
 * > roof catcher beam... The columns should be a 4 pack of 2x8s and be
 * > adjustable to make into other types of stud packs like 3 2x6s."* — Tommy,
 * > 2026-10-25
 *
 * ⚠ **This is not the existing Column Panel.** That one is 25.5in wide
 * (`COLUMN_TOTAL_WIDTH_IN`) and is a wall panel type. This is a square post
 * standing under a beam, as wide as the wall is thick, and the two should not
 * be confused: a wall tiled with these would be wrong, and a beam landing on
 * the other would be sitting on something 10in wider than he asked for.
 */

/** Dressed sizes. Universal lumber sizing, not Building-Integrity figures. */
const LUMBER_ACTUAL_IN: Record<string, { thicknessIn: number; widthIn: number }> = {
  "2x4": { thicknessIn: 1.5, widthIn: 3.5 },
  "2x6": { thicknessIn: 1.5, widthIn: 5.5 },
  "2x8": { thicknessIn: 1.5, widthIn: 7.25 },
  "2x10": { thicknessIn: 1.5, widthIn: 9.25 },
  "2x12": { thicknessIn: 1.5, widthIn: 11.25 },
};

/** His default: *"15.5in wide"*, which is also the wall's thickness, so the
 * column sits square within the wall it stands in. */
export const STRUCTURAL_COLUMN_WIDTH_IN = 15.5;

export interface StudPackSpec {
  count: number;
  nominalSize: keyof typeof LUMBER_ACTUAL_IN & string;
}

/** *"a 4 pack of 2x8s"* — the default, with the pack adjustable. */
export const DEFAULT_STUD_PACK: StudPackSpec = { count: 4, nominalSize: "2x8" };
/** The alternative he named outright. */
export const ALTERNATIVE_STUD_PACKS: StudPackSpec[] = [
  { count: 3, nominalSize: "2x6" },
  { count: 4, nominalSize: "2x6" },
  { count: 3, nominalSize: "2x8" },
  { count: 4, nominalSize: "2x10" },
];

export interface StructuralColumnOptions {
  heightIn: number;
  /** Square by default: as wide as the wall is thick. */
  widthIn?: number;
  depthIn?: number;
  pack?: StudPackSpec;
  /** ⚠ *"3/4" plywood skins similar to safety gap plywood nailed on with
   * sheathing nails 2 per 6 inches"* — his 2026-10-24 spec for what carries
   * the hips. Both faces, so the pack is sandwiched. */
  includeSkins?: boolean;
}

export interface StructuralColumnResult {
  members: PanelMember[];
  /** How wide the pack itself comes out, so a caller can see the slack. */
  packWidthIn: number;
  /** ⚠ Non-null when the pack will not fit the column. */
  refusal: string | null;
}

/**
 * ⚠ **Sheathing nails, 2 per 6 inches.** His number, counted as a real
 * fastener line so it reaches the material totals: *"nailed on with sheathing
 * nails 2 per 6 inches count those for material counts."*
 *
 * ⚠ Read as 2 nails per 6in **down each vertical edge of each skin**, which
 * is where a skin is nailed to the pack behind it. Two edges, two skins. A
 * different reading — per 6in of perimeter, say — would give a different
 * number, and nobody has said which.
 */
export const COLUMN_SKIN_NAILS_PER_6IN = 2;

export function columnSkinNailCount(heightIn: number, skinCount = 2): number {
  const edgesPerSkin = 2;
  return Math.ceil((heightIn / 6) * COLUMN_SKIN_NAILS_PER_6IN) * edgesPerSkin * skinCount;
}

/**
 * Build one column: a stud pack, centred, optionally skinned both faces.
 *
 * The pack's boards stand side by side across the column's width, so a 4-pack
 * of 2x8s is 6in of width and 7.25in of depth inside a 15.5in square — which
 * leaves real slack, and `packWidthIn` reports it rather than quietly
 * centring something much smaller than the hole it sits in.
 */
export function buildStructuralColumnMembers(options: StructuralColumnOptions): StructuralColumnResult {
  const widthIn = options.widthIn ?? STRUCTURAL_COLUMN_WIDTH_IN;
  const depthIn = options.depthIn ?? STRUCTURAL_COLUMN_WIDTH_IN;
  const pack = options.pack ?? DEFAULT_STUD_PACK;
  const actual = LUMBER_ACTUAL_IN[pack.nominalSize];

  if (!actual) {
    return { members: [], packWidthIn: 0, refusal: `No dressed size is known for ${pack.nominalSize}.` };
  }
  if (!(pack.count >= 1)) {
    return { members: [], packWidthIn: 0, refusal: "A stud pack needs at least one board." };
  }
  if (!(options.heightIn > 0)) {
    return { members: [], packWidthIn: 0, refusal: "A column needs a height." };
  }

  const packWidthIn = pack.count * actual.thicknessIn;
  if (packWidthIn > widthIn + 1e-9 || actual.widthIn > depthIn + 1e-9) {
    return {
      members: [],
      packWidthIn,
      refusal:
        `A ${pack.count}-pack of ${pack.nominalSize}s measures ${packWidthIn}in by ${actual.widthIn}in, which does ` +
        `not fit a ${widthIn}in by ${depthIn}in column.`,
    };
  }

  const skinIn = options.includeSkins === false ? 0 : SKIN_THICKNESS_IN;
  const members: PanelMember[] = [];

  if (skinIn > 0) {
    for (const [face, yIn] of [
      ["exterior", 0],
      ["interior", depthIn - skinIn],
    ] as [string, number][]) {
      members.push({
        memberId: `column_skin_${face}`,
        material: "plywood",
        speciesGrade: null,
        plySpec: SKIN_PLY_SPEC,
        nominalSize: null,
        /* ⚠ "horizontal" at rotation 0, not "vertical". `memberBoxSizeIn`
           maps a vertical member to (thickness, width, length), which would
           stand this sheet on its edge against the column's left side
           instead of laying it over a face. Horizontal maps to (length,
           thickness, width), which is the face: the column's width across X,
           the sheet's own 3/4in through Y, its height up Z. Measured — the
           first version overlapped the pack. */
        actualDimsIn: { thicknessIn: skinIn, widthIn: options.heightIn, lengthIn: widthIn },
        orientation: "horizontal",
        position: { xIn: 0, yIn, zIn: 0, rotationDeg: 0 },
        role: "skin",
        qty: 1,
        notes:
          face === "exterior"
            ? `3/4in plywood skin, nailed with ${COLUMN_SKIN_NAILS_PER_6IN} sheathing nails per 6in down each edge`
            : undefined,
      });
    }
  }

  /* Centred across the width, and centred through the depth between the two
     skins so neither face is proud of the other. */
  const startXIn = (widthIn - packWidthIn) / 2;
  const packYIn = (depthIn - actual.widthIn) / 2;
  for (let i = 0; i < pack.count; i++) {
    members.push({
      memberId: `column_stud_${i + 1}`,
      material: "dimensional_lumber",
      speciesGrade: LUMBER_SPECIES_GRADE,
      plySpec: null,
      nominalSize: pack.nominalSize,
      actualDimsIn: { thicknessIn: actual.thicknessIn, widthIn: actual.widthIn, lengthIn: options.heightIn },
      orientation: "vertical",
      position: { xIn: startXIn + i * actual.thicknessIn, yIn: packYIn, zIn: 0, rotationDeg: 0 },
      role: "stud",
      qty: 1,
      notes: i === 0 ? `${pack.count}-ply ${pack.nominalSize} pack, carrying the roof catcher beam above` : undefined,
    });
  }

  return { members, packWidthIn, refusal: null };
}
