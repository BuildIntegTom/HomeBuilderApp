import { BOX_BEAM_CAP_THICKNESS_IN, BOX_BEAM_LVL_HEIGHT_IN } from "./boxBeamMembers";
import { PLATE_2X6_THICKNESS_IN } from "./trussPlateMembers";

/**
 * The roof-bearing member's own overall height (Truss Plate for a
 * single-story building, Box Beam for two-story) — the thin cap assembly
 * that sits directly atop every wall's own top plate, which every other
 * roofline-driven reference (gable-end panel tiling, the live 3D view, the
 * OBJ export) needs to agree on so a real truss's own bottom chord — which
 * bears on top of THIS assembly, not the bare wall top — lines up
 * identically everywhere it's computed. Previously duplicated inline at
 * every consumer (trussPlateMembers.ts/boxBeamMembers.ts's own schema
 * builders, page.tsx, Building3DView.tsx) — one shared source now.
 */
export function computeRoofBearingAssemblyHeightIn(hasSecondStory: boolean): number {
  return hasSecondStory ? 2 * BOX_BEAM_CAP_THICKNESS_IN + BOX_BEAM_LVL_HEIGHT_IN : PLATE_2X6_THICKNESS_IN + 0.75;
}
