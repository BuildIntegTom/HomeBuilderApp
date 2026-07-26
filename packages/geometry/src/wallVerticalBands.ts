import { isSlotBoxBeamCovered, type BoxBeamCoverage } from "./roofBearingSegments";

/** One Mid-Wall Bond Beam's own real geometry, pre-resolved by the caller
 * (which knows the real MidWallBeam type + BOX_BEAM_SIZE_OPTIONS catalog)
 * — this package has no business knowing about box-beam sizes, mirroring
 * how BoxBeamCoverage itself carries no sizeId. Structurally satisfies
 * BoxBeamCoverage (same startSlotIndex/endSlotIndex fields), so it works
 * directly with isSlotBoxBeamCovered with no adapter. */
export interface MidWallBeamGeometry extends BoxBeamCoverage {
  heightIn: number;
  assemblyHeightIn: number;
}

export interface WallVerticalBand {
  /** 0 = lowest band, increasing upward — a slot covered by N beams
   * produces up to N+1 bands. */
  bandIndex: number;
  bottomIn: number;
  topIn: number;
}

/**
 * Splits ONE slot's own story height into 1-(N+1) bands around every beam
 * that actually covers that slot (by its own horizontal range) — a slot
 * covered by 0 beams gets a single band spanning the full story height.
 * Different slots of the same wall can see different beam subsets (each
 * beam has its own horizontal coverage), so this is deliberately a
 * per-slot computation, not a per-wall one.
 *
 * Two covering beams with overlapping height ranges never produce a
 * negative-height band — each beam's own bottom/top is clamped against
 * the running cursor, so they stack with zero gap instead of throwing.
 * Their real fabricated members may still visually interpenetrate in
 * that case — an accepted, unvalidated edge case (same as a beam placed
 * across a window opening).
 */
export function computeWallVerticalBandsForSlot(
  slotIndex: number,
  storyHeightIn: number,
  beams: MidWallBeamGeometry[],
): WallVerticalBand[] {
  const covering = beams.filter((b) => isSlotBoxBeamCovered(slotIndex, b)).sort((a, b) => a.heightIn - b.heightIn);
  const bands: WallVerticalBand[] = [];
  let cursorIn = 0;
  for (const beam of covering) {
    const beamBottomIn = Math.min(Math.max(beam.heightIn, cursorIn), storyHeightIn);
    const beamTopIn = Math.min(Math.max(beamBottomIn + beam.assemblyHeightIn, beamBottomIn), storyHeightIn);
    if (beamBottomIn > cursorIn) bands.push({ bandIndex: bands.length, bottomIn: cursorIn, topIn: beamBottomIn });
    cursorIn = beamTopIn;
  }
  if (storyHeightIn > cursorIn) bands.push({ bandIndex: bands.length, bottomIn: cursorIn, topIn: storyHeightIn });
  return bands;
}
