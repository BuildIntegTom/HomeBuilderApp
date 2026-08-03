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

/**
 * Splits one band into 1+ bands no taller than `maxHeightIn`, greedy from
 * the bottom (full-height chunks stacked from the band's own bottom, the
 * remainder on top) — NOT evenly redistributed. Greedy keeps every lower
 * chunk's own boundary stable as the band's own total height changes (a
 * wall growing from 16ft to 17ft keeps its existing 10ft chunk exactly as
 * it was, only the top remainder grows from 6ft to 7ft) — even-redistribution
 * would instead silently reshape every chunk on every height change, which
 * both contradicts Tommy's own "16ft -> 10ft + 6ft" example and would make
 * every resize look like a fresh split to `reconcilePanelSlotZones`.
 * A remainder shorter than `minRemainderHeightIn` folds into the previous
 * full-height chunk instead of standing alone as a sliver zone.
 */
export function subdivideBandForMaxHeight(
  band: WallVerticalBand,
  maxHeightIn: number,
  minRemainderHeightIn: number,
  startBandIndex: number,
): WallVerticalBand[] {
  const heightIn = band.topIn - band.bottomIn;
  if (maxHeightIn <= 0 || heightIn <= maxHeightIn) return [{ ...band, bandIndex: startBandIndex }];

  const result: WallVerticalBand[] = [];
  let cursorIn = band.bottomIn;
  let bandIndex = startBandIndex;
  while (band.topIn - cursorIn > maxHeightIn) {
    result.push({ bandIndex: bandIndex++, bottomIn: cursorIn, topIn: cursorIn + maxHeightIn });
    cursorIn += maxHeightIn;
  }
  const remainderIn = band.topIn - cursorIn;
  if (remainderIn < minRemainderHeightIn && result.length > 0) {
    result[result.length - 1]!.topIn = band.topIn;
  } else {
    result.push({ bandIndex, bottomIn: cursorIn, topIn: band.topIn });
  }
  return result;
}

/**
 * Combines real beam bands (`computeWallVerticalBandsForSlot`, unchanged —
 * beams are real physical members, never themselves subdivided) with the
 * project's own max-panel-height rule (Tommy: "panels should have a
 * default max height of 10'... a wall taller than the selected max height
 * spawns a 10' panel and a 6' panel") — beams take priority; max-height
 * splitting only further subdivides the space between/around them.
 */
export function computeWallVerticalBandsForSlotWithMaxHeight(
  slotIndex: number,
  storyHeightIn: number,
  beams: MidWallBeamGeometry[],
  maxHeightIn: number,
  minRemainderHeightIn: number,
): WallVerticalBand[] {
  const beamBands = computeWallVerticalBandsForSlot(slotIndex, storyHeightIn, beams);
  const result: WallVerticalBand[] = [];
  for (const band of beamBands) {
    result.push(...subdivideBandForMaxHeight(band, maxHeightIn, minRemainderHeightIn, result.length));
  }
  return result;
}
