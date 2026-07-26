import { BOX_BEAM_CAP_THICKNESS_IN, BOX_BEAM_LVL_HEIGHT_IN, computeBoxBeamAssemblyHeightIn, type BoxBeamSizeId } from "./boxBeamMembers";
import { PLATE_2X6_THICKNESS_IN } from "./trussPlateMembers";

/**
 * The roof-bearing member's own overall height (Truss Plate for a
 * single-story building, Box Beam for two-story) — the thin cap assembly
 * that sits directly atop every wall's own top plate. Kept for callers that
 * need a SPECIFIC bearing member's own real assembly height (fabrication
 * pages, per-wall 3D placement) — this is NOT the shared roofline/eave
 * reference anymore (see computeSharedRooflineBearingHeightIn below), now
 * that box beam is a per-wall user choice rather than an automatic,
 * building-wide swap: `hasSecondStory` here only picks which member THIS
 * specific call is describing, not what the building's own eave sits at.
 */
export function computeRoofBearingAssemblyHeightIn(hasSecondStory: boolean): number {
  return hasSecondStory ? 2 * BOX_BEAM_CAP_THICKNESS_IN + BOX_BEAM_LVL_HEIGHT_IN : PLATE_2X6_THICKNESS_IN + 0.75;
}

/**
 * The shared roofline/eave reference every wall agrees on, regardless of
 * story count or box-beam coverage (Tommy: "the roof lines needs to be
 * respected" — a box-beam wall's own panels shrink to reach this same
 * height, rather than the beam changing the building's own roofline). This
 * is always the Truss Plate's own (shorter) assembly height — the "nominal"
 * height every story's own wallHeightFt is defined relative to.
 */
export function computeSharedRooflineBearingHeightIn(): number {
  return computeRoofBearingAssemblyHeightIn(false);
}

/**
 * How much shorter a box-beam-covered wall's own row of panels must be
 * built, vs. an uncovered (Truss Plate) wall, so both still reach the
 * exact same shared roofline height — see
 * computeSharedRooflineBearingHeightIn's own doc comment. Always >= 0:
 * every box-beam size is taller than a Truss Plate.
 */
export function computeBoxBeamHeightDeltaIn(sizeId: BoxBeamSizeId): number {
  return computeBoxBeamAssemblyHeightIn(sizeId) - computeSharedRooflineBearingHeightIn();
}
