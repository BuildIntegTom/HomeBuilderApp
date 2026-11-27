import {
  plasterShearAspectRatio2to1Factor,
  plasterShearReferenceRows,
  plasterShearWindIncreaseFactor,
  type PlasterShearReferenceRow,
} from "@building-integrity/panel-catalog";

/**
 * The **comparison-only** plaster shear figure.
 *
 * ⚠⚠ **NOTHING STRUCTURAL MAY CONSUME THIS.** The shear derivation sheet
 * counts bracing, screws and plywood, and that is the app's one structural
 * path. This module answers a different, narrower question Tommy asked for:
 * *"if 7lbs/cuft straw actually has any sheer associated with it as well as
 * exterior plaster"* — i.e. what would a wall of this length be worth if it
 * were the site-plastered straw-bale wall the code tested, rather than the
 * panelised wall he actually builds.
 *
 * The answer is always returned together with the reasons it does not apply,
 * and `applicable` is **never true** for a Building Integrity panel. That is
 * not a placeholder; it is the finding. See
 * docs/plaster-perm-and-shear-research-2026-11-26.md §4.
 */

export type PlasterBinder = PlasterShearReferenceRow["binder"];

export interface PlasterShearIndicatorInput {
  /** Total length of plastered shear wall, feet. */
  wallLengthFt: number;
  /** Wall height, feet — drives the aspect-ratio knockdown of footnote (f). */
  wallHeightFt: number;
  binder: PlasterBinder;
  /** True for wind, which footnote (h) permits a 40% increase for. Seismic
   *  takes the tabulated value with no increase. */
  forWind?: boolean;
}

export interface PlasterShearIndicatorResult {
  /** ⚠ ALWAYS false for a BI panel. Present so a caller must look at it. */
  applicable: false;
  /** The table row this figure came from, or null when the binder has no row. */
  row: PlasterShearReferenceRow | null;
  /** Indicative allowable shear per foot after the aspect-ratio and wind
   *  adjustments, or null when there is no row. */
  indicativePlf: number | null;
  /** indicativePlf x wallLengthFt, or null. */
  indicativeTotalLb: number | null;
  /** The aspect-ratio factor applied: 1 at 1:1 or better, 0.5 at 2:1,
   *  linearly interpolated between, and null above 2:1 where the table stops. */
  aspectRatioFactor: number | null;
  /** Every reason this number must not be designed to. Never empty. */
  inapplicabilityReasons: string[];
}

/**
 * Footnote (f): full value at an aspect ratio (height:length) of 1:1 or
 * better, 50% at 2:1, linear interpolation between, and **the table does not
 * extend past 2:1** — above that it returns null rather than extrapolating.
 *
 * ⚠ Aspect ratio here is HEIGHT over LENGTH. A long low wall is the good
 * case; a narrow tall pier is the penalised one.
 */
export function plasterShearAspectRatioFactor(
  wallLengthFt: number,
  wallHeightFt: number,
): number | null {
  if (!(wallLengthFt > 0) || !(wallHeightFt > 0)) return null;
  const ratio = wallHeightFt / wallLengthFt;
  if (ratio <= 1) return 1;
  if (ratio > 2) return null;
  // Linear between (1 -> 1.0) and (2 -> 0.5).
  return 1 - (ratio - 1) * (1 - plasterShearAspectRatio2to1Factor);
}

/** The stiffest row available for a binder — the table gives several per
 *  binder and they differ only by mesh and fastening. */
function bestRowFor(binder: PlasterBinder): PlasterShearReferenceRow | null {
  const rows = plasterShearReferenceRows.filter((r) => r.binder === binder);
  if (rows.length === 0) return null;
  return rows.reduce((a, b) => (b.allowableShearPlf > a.allowableShearPlf ? b : a));
}

export function plasterShearIndicator(
  input: PlasterShearIndicatorInput,
): PlasterShearIndicatorResult {
  const { wallLengthFt, wallHeightFt, binder, forWind = false } = input;
  const row = bestRowFor(binder);
  const aspectRatioFactor = plasterShearAspectRatioFactor(wallLengthFt, wallHeightFt);

  /* ⚠ These are not boilerplate. Each one is an independent reason the table
     does not describe a BI panel, and any ONE of them is sufficient. They are
     stated in full on every result so the number can never travel without
     them — a figure like "20,250 lb" copied into an email with the caveats
     left behind is exactly the failure this guards against. */
  const inapplicabilityReasons = [
    "Table 106.16 describes a site-plastered straw-BALE wall. A Building Integrity panel is a stud-framed, straw-filled panel, which the table does not cover.",
    "The table's mechanism is the bale core transferring shear between two plaster skins bonded directly to the straw (IRC Appendix S §105.6.1 forbids any membrane between straw and plaster for exactly this reason). BI plaster goes over paper and lath, so that mechanism is absent by construction.",
    "The table requires mesh running continuous from sill plate to top plate, or lapped at least 8 inches (§106.10.1), stapled at 2in o.c. to the top plate and 4in at the sill. A pre-plastered panel's mesh stops at the panel edge inside cured plaster and cannot lap.",
    "Both faces must be plastered to the tabulated thickness; the table has no single-skin row.",
    "No Building Integrity panel has been tested against this table.",
  ];
  if (aspectRatioFactor === null && wallLengthFt > 0 && wallHeightFt > 0) {
    inapplicabilityReasons.push(
      `This wall's aspect ratio is ${(wallHeightFt / wallLengthFt).toFixed(2)}:1, beyond the 2:1 limit of footnote (f), so the table gives no value at all — it is not extrapolated.`,
    );
  }
  if (row === null) {
    inapplicabilityReasons.push(`Table 106.16 has no row for a ${binder} binder.`);
  }

  const indicativePlf =
    row === null || aspectRatioFactor === null
      ? null
      : row.allowableShearPlf * aspectRatioFactor * (forWind ? plasterShearWindIncreaseFactor : 1);

  return {
    applicable: false,
    row,
    indicativePlf,
    indicativeTotalLb: indicativePlf === null ? null : indicativePlf * wallLengthFt,
    aspectRatioFactor,
    inapplicabilityReasons,
  };
}
