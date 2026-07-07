import type { WallAssemblyLayer } from "@building-integrity/panel-catalog";

export type Season = "winter" | "summer";

function permAtSeason(layer: WallAssemblyLayer, season: Season): number | null {
  return season === "winter" ? layer.permWinter : layer.permSummer;
}

/** 1/perm_total = sum(1/perm_i) — resistance-in-series, not perm itself. */
export function resistanceInSeries(perms: number[]): number {
  const totalResistance = perms.reduce((sum, p) => sum + 1 / p, 0);
  return 1 / totalResistance;
}

export interface AssemblyPermResult {
  computable: boolean;
  permTotal: number | null;
  unratedLayers: WallAssemblyLayer[];
}

/** Combines an interior + exterior finish layer into one assembly-total perm rating for a season. */
export function computeAssemblyPerm(
  interior: WallAssemblyLayer,
  exterior: WallAssemblyLayer,
  season: Season,
): AssemblyPermResult {
  const unratedLayers = [interior, exterior].filter(
    (l) => permAtSeason(l, season) === null,
  );
  if (unratedLayers.length > 0) {
    return { computable: false, permTotal: null, unratedLayers };
  }
  const permTotal = resistanceInSeries([
    permAtSeason(interior, season) as number,
    permAtSeason(exterior, season) as number,
  ]);
  return { computable: true, permTotal, unratedLayers: [] };
}

export interface VaporOpennessResult {
  computable: boolean;
  passes: boolean | null;
  interiorPerm: number | null;
  exteriorPerm: number | null;
}

/** Validation rule: exterior side must be more vapor-open (higher perm) than interior side. */
export function validateVaporOpenness(
  interior: WallAssemblyLayer,
  exterior: WallAssemblyLayer,
  season: Season,
): VaporOpennessResult {
  const interiorPerm = permAtSeason(interior, season);
  const exteriorPerm = permAtSeason(exterior, season);
  if (interiorPerm === null || exteriorPerm === null) {
    return { computable: false, passes: null, interiorPerm, exteriorPerm };
  }
  return {
    computable: true,
    passes: exteriorPerm > interiorPerm,
    interiorPerm,
    exteriorPerm,
  };
}
