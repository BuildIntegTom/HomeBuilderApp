const IN_TO_FT = 1 / 12;

export interface ConcretePierVolumeResult {
  volumeFt3PerPier: number;
  totalVolumeFt3: number;
}

/** Volume of cast cylindrical concrete piers (diameter x depth) times the
 * pier count from the grid layout (see computePierGrid, @building-integrity/geometry). */
export function computeConcretePierVolume(
  pierCount: number,
  diameterIn: number,
  depthFt: number,
): ConcretePierVolumeResult {
  const radiusFt = (diameterIn * IN_TO_FT) / 2;
  const volumeFt3PerPier = Math.PI * radiusFt * radiusFt * depthFt;
  return { volumeFt3PerPier, totalVolumeFt3: volumeFt3PerPier * pierCount };
}
