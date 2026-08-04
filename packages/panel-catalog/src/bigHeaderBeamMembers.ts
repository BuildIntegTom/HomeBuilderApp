import type { PanelMember } from "./componentSchema";
import {
  LUMBER_SPECIES_GRADE,
  PLATE_2X4_THICKNESS_IN,
  PLATE_2X4_WIDTH_IN,
  SKIN_PLY_SPEC,
  SKIN_THICKNESS_IN,
  buildHeaderTrussWebBraces,
  computeTrussWebPeakCount,
} from "./panelMemberHelpers";

/**
 * Top + bottom chord 2x4s, on both wythes, plus a plywood cap tying each
 * chord's 2 wythes into one rigid plate — mirrors `buildHeaderChords` in
 * headerMembers.ts exactly (same skin-then-plate layering, same "plywood
 * outer face, 2x4s facing the truss web cavity" convention), but this is a
 * Mid-Wall Bond Beam's own Big Header, not a window/door header sub-assembly
 * — its own notes describe it as such rather than referencing an RO/jack
 * studs it isn't actually built against.
 */
function buildBigHeaderBeamChords(widthIn: number, depthIn: number, heightIn: number): PanelMember[] {
  const members: PanelMember[] = [];
  const bottomPlyZIn = 0;
  const bottom2x4ZIn = SKIN_THICKNESS_IN;
  const topPlyZIn = heightIn - SKIN_THICKNESS_IN;
  const top2x4ZIn = heightIn - SKIN_THICKNESS_IN - PLATE_2X4_THICKNESS_IN;

  for (const [chord, zIn, otherChord] of [
    ["bottom", bottom2x4ZIn, "top"],
    ["top", top2x4ZIn, "bottom"],
  ] as const) {
    for (const [wythe, yIn] of [
      ["ext", 0],
      ["int", depthIn - PLATE_2X4_WIDTH_IN],
    ] as const) {
      members.push({
        memberId: `${chord}_chord_2x4_${wythe}`,
        material: "dimensional_lumber",
        speciesGrade: LUMBER_SPECIES_GRADE,
        plySpec: null,
        nominalSize: "2x4",
        actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: widthIn },
        orientation: "flat",
        position: { xIn: 0, yIn, zIn, rotationDeg: 0 },
        role: "plate",
        qty: 1,
        notes: `${chord} chord, ${wythe} wythe — inside the ${chord} plywood cap, facing the cavity; the truss web braces span between this and the ${otherChord} chord.`,
      });
    }
  }

  for (const [chord, zIn] of [
    ["bottom", bottomPlyZIn],
    ["top", topPlyZIn],
  ] as const) {
    members.push({
      memberId: `${chord}_chord_ply`,
      material: "plywood",
      speciesGrade: null,
      plySpec: SKIN_PLY_SPEC,
      nominalSize: null,
      actualDimsIn: { thicknessIn: SKIN_THICKNESS_IN, widthIn: depthIn, lengthIn: widthIn },
      orientation: "flat",
      position: { xIn: 0, yIn: 0, zIn, rotationDeg: 0 },
      role: "skin",
      qty: 1,
      notes: `${chord} plate plywood cap — this Big Header's own outer face, ties both wythes' ${chord} chord 2x4s into one rigid plate from the inside.`,
    });
  }
  return members;
}

/** The Big Header's own 2 end caps — a full-depth x full-height sheet on each
 * end, thin in width, mirroring `buildHeaderEndCaps`'s own construction
 * (same "plywood on the panel thickness side, open front/back showing the
 * truss web" convention). */
function buildBigHeaderBeamEndCaps(widthIn: number, depthIn: number, heightIn: number): PanelMember[] {
  return (["left", "right"] as const).map((side) => ({
    memberId: `${side}_end_ply`,
    material: "plywood",
    speciesGrade: null,
    plySpec: SKIN_PLY_SPEC,
    nominalSize: null,
    actualDimsIn: { thicknessIn: SKIN_THICKNESS_IN, widthIn: depthIn, lengthIn: heightIn },
    orientation: "vertical",
    position: { xIn: side === "left" ? 0 : widthIn - SKIN_THICKNESS_IN, yIn: 0, zIn: 0, rotationDeg: 0 },
    role: "skin",
    qty: 1,
    notes: `${side} end — this Big Header's own "panel thickness" face (full depth x full height, thin in width).`,
  }));
}

/** The rise (in) available to the truss web between the chords' plywood-
 * capped facing edges — same formula as headerMembers.ts's own
 * `headerWebRiseIn`, duplicated here rather than imported since a Big
 * Header's own overall height is an independent, continuously user-
 * adjustable dimension, not derived from any rough opening. */
function bigHeaderBeamWebRiseIn(heightIn: number): number {
  return heightIn - 2 * PLATE_2X4_THICKNESS_IN - 2 * SKIN_THICKNESS_IN;
}

/**
 * Every physical member of a Big Header (Mid-Wall Beam) — Tommy: "another
 * option for mid[-wall] box beams... elongated header panels that have W
 * bracing" (originally called "Web Braced Lintel", renamed to avoid clashing
 * with the separate opening-spanning Big Header panel type — see the Review
 * Log). A Mid-Wall Bond Beam construction alternative to the insulated Box
 * Beam: the same flat top/bottom chord + repeating W-truss web (on both
 * wythes) a window header already uses (see headerMembers.ts's own
 * `buildWindowHeaderMembers`/`buildHeaderMembers`), just installed mid-wall
 * rather than over a rough opening — always the "however many peaks keep
 * every web segment at or above the 30deg minimum" path (no `isDoor`-style
 * single-peak fork; this beam has no door-like "always 1 peak" convention).
 * No fill/insulation component — like a header, this is a solid framed +
 * braced panel, not an insulated cavity assembly the way a Box Beam is.
 */
export function buildBigHeaderBeamMembers(widthIn: number, depthIn: number, heightIn: number): PanelMember[] {
  const bottomChordTopZIn = SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN;
  const topChordBottomZIn = heightIn - SKIN_THICKNESS_IN - PLATE_2X4_THICKNESS_IN;
  const riseIn = bigHeaderBeamWebRiseIn(heightIn);
  const peakCount = computeTrussWebPeakCount(widthIn, riseIn);

  const members: PanelMember[] = [
    ...buildBigHeaderBeamChords(widthIn, depthIn, heightIn),
    ...buildBigHeaderBeamEndCaps(widthIn, depthIn, heightIn),
  ];
  for (const [wythe, yIn] of [
    ["ext", PLATE_2X4_THICKNESS_IN / 2],
    ["int", depthIn - PLATE_2X4_THICKNESS_IN / 2],
  ] as const) {
    members.push(
      ...buildHeaderTrussWebBraces(peakCount, widthIn, bottomChordTopZIn, topChordBottomZIn, yIn, `truss_brace_${wythe}`),
    );
  }
  return members;
}
