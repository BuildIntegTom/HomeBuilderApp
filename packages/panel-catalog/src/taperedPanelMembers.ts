import type { PanelMember } from "./componentSchema";
import { LUMBER_SPECIES_GRADE, PLATE_2X4_THICKNESS_IN, PLATE_2X4_WIDTH_IN, SKIN_THICKNESS_IN } from "./panelMemberHelpers";
import {
  ANTI_TWIST_SPACING_IN,
  ANTI_TWIST_WEB_PLY_SPEC,
  ANTI_TWIST_WEB_THICKNESS_IN,
  JOIST_2X6_THICKNESS_IN,
  JOIST_2X6_WIDTH_IN,
} from "./floorRoofPanelMembers";

/**
 * A floor/roof panel whose two ends are different widths — the panel a ring
 * roof is tiled with.
 *
 * `divideRingFacet` already decides how many of these a facet needs and how
 * wide each end is; this builds one. Scheme B, chosen 2026-10-23: *"Identical
 * tapered panels sounds awesome."*
 *
 * ⚠ **Its two side joists are not parallel.** That is the whole difference
 * from the rectangular panel, and it follows from the facet: a ring's outer
 * edge is longer than its inner one, so a panel spanning between them has to
 * splay. The joists are still straight boards — they just do not run square
 * to the ends.
 */

export interface TaperedPanelOptions {
  kind: "floor" | "roof";
  /** Width at the panel's start (the inner ring on a courtyard roof). */
  innerWidthIn: number;
  /** Width at the far end, which on a ring roof is the longer one. */
  outerWidthIn: number;
  depthIn: number;
  /** How far the panel reaches, inner wall to outer wall. */
  lengthIn: number;
}

export interface TaperedPanelResult {
  members: PanelMember[];
  /** How far each side leans off square, in degrees. */
  rakeDeg: number;
  /** The real cut length of a side joist, which is longer than the span
   * because it leans. */
  joistLengthIn: number;
  refusal: string | null;
}

export function buildTaperedPanelMembers(options: TaperedPanelOptions): TaperedPanelResult {
  const { innerWidthIn, outerWidthIn, depthIn, lengthIn } = options;
  const empty = { members: [], rakeDeg: 0, joistLengthIn: 0 };

  if (!(innerWidthIn > 0) || !(outerWidthIn > 0)) {
    return { ...empty, refusal: "A tapered panel needs a width at both ends." };
  }
  if (!(lengthIn > 0) || !(depthIn > 0)) {
    return { ...empty, refusal: "A tapered panel needs a span and a depth." };
  }
  if (Math.min(innerWidthIn, outerWidthIn) < 2 * JOIST_2X6_THICKNESS_IN) {
    return {
      ...empty,
      refusal:
        `The narrow end measures ${Math.min(innerWidthIn, outerWidthIn)}in, which cannot hold the two joists ` +
        `that are ${2 * JOIST_2X6_THICKNESS_IN}in on their own.`,
    };
  }

  /* Each side moves out by half the difference over the panel's length. */
  const halfSpreadIn = (outerWidthIn - innerWidthIn) / 2;
  const rakeDeg = (Math.atan2(halfSpreadIn, lengthIn) * 180) / Math.PI;
  const joistLengthIn = Math.hypot(lengthIn, halfSpreadIn);

  const members: PanelMember[] = [];

  /* ⚠ The joists follow the raked EDGES, so each is recorded by its centre
     with a tilt, the same convention a diagonal brace uses. A joist laid out
     square here would stick out of one end and fall short at the other. */
  for (const [side, sign] of [
    ["left", -1],
    ["right", 1],
  ] as [string, number][]) {
    const innerXIn = innerWidthIn / 2 + sign * (innerWidthIn / 2 - JOIST_2X6_THICKNESS_IN / 2);
    const outerXIn = innerWidthIn / 2 + sign * (outerWidthIn / 2 - JOIST_2X6_THICKNESS_IN / 2);
    for (const [face, yIn] of [
      ["bottom", 0],
      ["top", depthIn - JOIST_2X6_WIDTH_IN],
    ] as [string, number][]) {
      members.push({
        memberId: `tapered_joist_${side}_${face}`,
        material: "dimensional_lumber",
        speciesGrade: LUMBER_SPECIES_GRADE,
        plySpec: null,
        nominalSize: "2x6",
        actualDimsIn: { thicknessIn: JOIST_2X6_THICKNESS_IN, widthIn: JOIST_2X6_WIDTH_IN, lengthIn: joistLengthIn },
        orientation: "vertical",
        position: {
          xIn: (innerXIn + outerXIn) / 2,
          yIn,
          zIn: lengthIn / 2,
          rotationDeg: 0,
          tiltDeg: sign * rakeDeg,
        },
        role: "stud",
        qty: 1,
        notes:
          side === "left" && face === "bottom"
            ? `raked ${rakeDeg.toFixed(2)}deg off square — the panel splays from ${innerWidthIn}in to ${outerWidthIn}in`
            : undefined,
      });
    }
  }

  /* The two lids, each cut to its own end's width. */
  for (const [atEnd, zIn, widthAtEndIn] of [
    ["inner", 0, innerWidthIn],
    ["outer", lengthIn - SKIN_THICKNESS_IN, outerWidthIn],
  ] as [string, number, number][]) {
    members.push({
      memberId: `tapered_lid_${atEnd}_skin`,
      material: "plywood",
      speciesGrade: null,
      plySpec: "3/4in_5ply_CDX",
      nominalSize: null,
      actualDimsIn: { thicknessIn: SKIN_THICKNESS_IN, widthIn: depthIn, lengthIn: widthAtEndIn },
      orientation: "flat",
      position: { xIn: innerWidthIn / 2 - widthAtEndIn / 2, yIn: 0, zIn, rotationDeg: 0 },
      role: "skin",
      qty: 1,
      notes: `${atEnd} lid — ${widthAtEndIn}in wide, which is NOT the other end's width`,
    });
  }

  /* ⚠ Anti-twist girts are cut to the width AT THEIR OWN STATION, which
     changes down the panel. One cut length for all of them would be right in
     at most one place. */
  const firstFaceIn = SKIN_THICKNESS_IN;
  let index = 0;
  for (let zIn = firstFaceIn + ANTI_TWIST_SPACING_IN; zIn < lengthIn - firstFaceIn; zIn += ANTI_TWIST_SPACING_IN) {
    const t = zIn / lengthIn;
    const widthHereIn = innerWidthIn + (outerWidthIn - innerWidthIn) * t;
    const clearIn = widthHereIn - 2 * JOIST_2X6_THICKNESS_IN;
    if (clearIn <= 0) continue;
    members.push({
      memberId: `tapered_anti_twist_${index}_web`,
      material: "osb",
      speciesGrade: null,
      plySpec: ANTI_TWIST_WEB_PLY_SPEC,
      nominalSize: null,
      actualDimsIn: { thicknessIn: ANTI_TWIST_WEB_THICKNESS_IN, widthIn: depthIn, lengthIn: clearIn },
      orientation: "flat",
      position: { xIn: innerWidthIn / 2 - clearIn / 2, yIn: 0, zIn, rotationDeg: 0 },
      role: "girt_web",
      qty: 1,
      notes: index === 0 ? "cut to the panel's width at THIS station — every one differs" : undefined,
    });
    index++;
  }

  return { members, rakeDeg, joistLengthIn, refusal: null };
}

/** Re-exported so a caller sizing a tapered panel has the plate constants to
 * hand without reaching into the helpers module. */
export { PLATE_2X4_THICKNESS_IN, PLATE_2X4_WIDTH_IN };
