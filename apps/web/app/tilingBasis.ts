import type { BracePattern } from "@building-integrity/panel-catalog";

/**
 * REPANELIZE, R0 — the settings the current tiling was PRODUCED UNDER.
 *
 * Tile-once stops the tiler running behind the user's back, which means a
 * setting can be changed without the existing building changing with it.
 * Tommy, 2026-10-07: *"Deferred setting, activates when retiled"*, with
 * *"a small triangle caution icon that's red and orange... next to any
 * settings that have been changed but not implemented"*.
 *
 * ⚠ **Nothing can be marked without this.** "Changed but not applied" is
 * meaningless unless the app remembers what the building was last tiled
 * *with*; comparing a setting to itself always says "unchanged". So the
 * basis is recorded at every re-tile and the marker (R1) is a comparison
 * against it.
 *
 * ## What belongs here, and what does not
 *
 * Exactly the values that reach the tiler — the arguments `page.tsx`'s
 * `retilePreservingOpenings` wrapper binds, plus the least-accessible
 * corner that travels alongside them. A setting that does NOT change a
 * tiling has no business here: it would raise a marker telling the user to
 * repanelize for a change that repanelizing would not make.
 *
 * ⚠ Some of these are **derived** rather than typed by the user —
 * `cornerWidthIn` and `cornerMayWiden` come from the panelization type,
 * `bracedSpacingIn` from the seismic zone. The basis stores the derived
 * value because that is what actually determines the output; mapping a
 * difference back to the control the user can see is R1's job, not this
 * module's.
 */
export interface TilingBasis {
  standardWidthIn: number;
  thicknessIn: number;
  /** Which end of each run the safety gap sits at, via `computeGapEnd`. */
  leastAccessibleCorner: string;
  /** Derived from the panelization type, not typed directly. */
  cornerWidthIn: number;
  /** Derived from the panelization type: false for Square Bale, whose
   * whole-bale corner cannot be fabricated off its nominal width. */
  cornerMayWiden: boolean;
  /** Derived from the seismic zone. */
  bracedSpacingIn: number;
  bracedDefaultPattern: BracePattern;
  bracedDefaultMirrored: boolean;
}

export type TilingBasisField = keyof TilingBasis;

/** What to call each field when telling the user what is pending. Keyed by
 * field so a new basis field cannot be added without naming it. */
export const TILING_BASIS_FIELD_LABELS: Record<TilingBasisField, string> = {
  standardWidthIn: "Standard width",
  thicknessIn: "Thickness",
  leastAccessibleCorner: "Least-accessible corner",
  cornerWidthIn: "Corner panel width",
  cornerMayWiden: "Corner panel width rule",
  bracedSpacingIn: "Braced panel spacing",
  bracedDefaultPattern: "Bracing pattern",
  bracedDefaultMirrored: "Bracing mirrored",
};

/** Widths are held on the eighth-inch grid and the derived ones are products
 * (`seismicBracedPanelSpacingFt[zone] * 12`), so compare with a tolerance far
 * below an eighth rather than exactly — a float artefact must not raise a
 * marker telling the user to repanelize for a change nobody made. */
const SAME_WITHIN_IN = 1e-6;

function sameValue(a: TilingBasis[TilingBasisField], b: TilingBasis[TilingBasisField]): boolean {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < SAME_WITHIN_IN;
  return a === b;
}

/**
 * Which basis fields the live settings no longer agree with — i.e. exactly
 * what a Repanelize would change, and therefore exactly what should carry a
 * caution marker.
 *
 * ⚠ **An absent basis returns nothing, deliberately.** Every project saved
 * before this existed has no basis, and so does a project with no footprint
 * yet. "I do not know what this was tiled with" is not "everything has
 * changed" — claiming a pending change the user never made would be
 * substituting a value for a gap, which is the opposite of this app's rule.
 */
export function tilingBasisDifferences(basis: TilingBasis | null | undefined, live: TilingBasis): TilingBasisField[] {
  if (!basis) return [];
  return (Object.keys(TILING_BASIS_FIELD_LABELS) as TilingBasisField[]).filter(
    (field) => !sameValue(basis[field], live[field]),
  );
}

/** True when a Repanelize would change nothing about how walls are tiled.
 * An absent basis is NOT "up to date" — it is unknown, and the caller has to
 * decide what to do about that rather than being told a comforting answer. */
export function tilingBasisIsCurrent(basis: TilingBasis | null | undefined, live: TilingBasis): boolean | "unknown" {
  if (!basis) return "unknown";
  return tilingBasisDifferences(basis, live).length === 0;
}
