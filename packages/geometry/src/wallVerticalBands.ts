export interface WallVerticalBand {
  band: "below-beam" | "above-beam";
  bottomIn: number;
  topIn: number;
}

/**
 * Splits one wall's own story height into 1-2 bands around a single
 * mid-wall bond beam (Stage 1: at most one beam per wall, full width).
 * beamHeightIn undefined = no beam, one band spanning the full story
 * height (mirrors computeRoofBearingSegments' `coverage: X | undefined`
 * convention). Clamped so a beam at/near the floor omits the below band
 * and one at/near the ceiling omits the above band; can return 0 bands if
 * the beam's own assembly consumes the whole story — callers must not
 * assume exactly 1 or 2 results.
 */
export function computeWallVerticalBands(
  storyHeightIn: number,
  beamHeightIn: number | undefined,
  beamAssemblyHeightIn: number,
): WallVerticalBand[] {
  if (beamHeightIn === undefined) return [{ band: "below-beam", bottomIn: 0, topIn: storyHeightIn }];
  const beamBottomIn = Math.min(Math.max(beamHeightIn, 0), storyHeightIn);
  const beamTopIn = Math.min(beamBottomIn + beamAssemblyHeightIn, storyHeightIn);
  const bands: WallVerticalBand[] = [];
  if (beamBottomIn > 0) bands.push({ band: "below-beam", bottomIn: 0, topIn: beamBottomIn });
  if (storyHeightIn > beamTopIn) bands.push({ band: "above-beam", bottomIn: beamTopIn, topIn: storyHeightIn });
  return bands;
}
