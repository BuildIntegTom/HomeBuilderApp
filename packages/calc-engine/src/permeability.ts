import {
  vaporOpenBothSidesThresholdPerm,
  type WallAssemblyLayer,
} from "@building-integrity/panel-catalog";

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
  /**
   * True when BOTH sides are at or above
   * `vaporOpenBothSidesThresholdPerm` — neither layer is acting as a
   * retarder, so which one is tighter does not matter and `passes` should
   * not be shown. ⚠ Callers must branch on this BEFORE `passes`, or they
   * will print a FAIL for a wall that dries freely in both directions.
   * False whenever the result is not computable.
   */
  bothSidesOpen: boolean;
  interiorPerm: number | null;
  exteriorPerm: number | null;
}

/**
 * Validation rule: the exterior side must be more vapor-open (higher perm)
 * than the interior side, so a wall that wets dries outward rather than
 * trapping moisture in the straw.
 *
 * ⚠ **The rule only means something when one side is actually a retarder.**
 * Where both sides are wide open it is a category error, and saying FAIL is
 * worse than saying nothing — see `bothSidesOpen` and
 * `vaporOpenBothSidesThresholdPerm`'s doc comment for the case that forced
 * this (the app's own default clay-interior/lime-exterior wall, where lime
 * measures tighter than clay and the bare rule failed it).
 */
export function validateVaporOpenness(
  interior: WallAssemblyLayer,
  exterior: WallAssemblyLayer,
  season: Season,
): VaporOpennessResult {
  const interiorPerm = permAtSeason(interior, season);
  const exteriorPerm = permAtSeason(exterior, season);
  if (interiorPerm === null || exteriorPerm === null) {
    return { computable: false, passes: null, bothSidesOpen: false, interiorPerm, exteriorPerm };
  }
  const threshold = vaporOpenBothSidesThresholdPerm.value;
  return {
    computable: true,
    passes: exteriorPerm > interiorPerm,
    bothSidesOpen: interiorPerm >= threshold && exteriorPerm >= threshold,
    interiorPerm,
    exteriorPerm,
  };
}

export interface VaporOpennessDisplay {
  label: string;
  /** True ONLY for a genuine failure, so it alone should drive a red cell.
   *  Neither "not computable" nor "open both ways" is a failure. */
  isFailure: boolean;
}

/**
 * The one place the vapor-openness verdict becomes words.
 *
 * ⚠ **Exists because page.tsx had this three-way branch written out THREE
 * times** — the Project Summary page, the engineer's sheet and the proposal —
 * each with its own copy of the PASS/FAIL strings and its own
 * `vaporCheck.passes === false` test for the red cell. Adding the
 * `bothSidesOpen` outcome to three hand-copied branches is how two of them
 * end up disagreeing. One function, three callers, and it is testable
 * without a browser.
 */
export function vaporOpennessDisplay(result: VaporOpennessResult): VaporOpennessDisplay {
  if (!result.computable) {
    return {
      label: "not computable — one or both finishes lack a numeric perm rating",
      isFailure: false,
    };
  }
  // ⚠ Checked BEFORE `passes`, deliberately. Where both sides are wide open
  // the direction is immaterial and `passes` is a category error, not a
  // verdict worth printing.
  if (result.bothSidesOpen) {
    return {
      label: `open both ways — both finishes are at or above ${vaporOpenBothSidesThresholdPerm.value} perm, so neither side traps moisture and the rule does not apply`,
      isFailure: false,
    };
  }
  return result.passes
    ? { label: "PASS — exterior is more vapor-open than interior", isFailure: false }
    : { label: "FAIL — exterior is not more vapor-open than interior", isFailure: true };
}
