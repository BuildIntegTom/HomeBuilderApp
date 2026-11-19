/**
 * **WHERE A NUMBER CAME FROM — the one vocabulary every derivation uses.**
 *
 * > *"Id rather have a pattern be described to an engineer with estimated
 * > values rather than prescribe an engineer seismic zone thing."*
 * > — Tommy, 2026-11-02, commissioning the Shear Derivation sheet
 *
 * > *"this app should prime an engioneer to look at and make it really easy
 * > for them to do the calculations and see how the estimated values here were
 * > derrived."*
 * > — Tommy, 2026-11-18, commissioning the Reference Points page
 *
 * The same rule, stated twice, sixteen days apart. It only works if a reader
 * can tell at a glance which numbers on a sheet are published, which are code,
 * which are this app's own simplifications and which came off the drawing in
 * front of them — so the tag travels with the number, and there is one set of
 * tags rather than one per sheet.
 *
 * ⚠ **THIS UNION IS DELIBERATELY A SUPERSET OF `CatalogStatus`.** The catalog
 * has two states, `confirmed` and `pending-BI-confirmation`, which answer
 * "has Building Integrity signed off on this figure?". A derivation needs
 * three more, because most of the numbers in one were never BI's to confirm:
 * a code constant is not theirs to accept or reject, an app assumption is not
 * a figure at all, and a measured length is not a spec. Collapsing those three
 * into `pending-BI-confirmation` would ask him to confirm arithmetic.
 */
export type DerivationStatus =
  /** Building Integrity has stated this figure first-hand: a number and a
   *  unit, unhedged. The same bar `CatalogStatus`'s `confirmed` sets. */
  | "confirmed"
  /** A published figure, cited, that Building Integrity has not yet confirmed
   *  against its own engineering — NDS supplements, a manufacturer's data
   *  sheet, a reference table. */
  | "pending-BI-confirmation"
  /** A value the code specifies outright — a code constant, not a choice. */
  | "code-constant"
  /** An explicit simplification this app makes, named rather than hidden. */
  | "app-assumption"
  /** Measured off the drawing: a real length, angle, section or count. */
  | "from-the-drawing";

/**
 * What each tag means, for a legend printed beside the numbers.
 *
 * ⚠ **A sheet that uses these tags must print this legend.** A bracketed
 * `[app-assumption]` beside a figure is worse than no tag at all if the reader
 * has to guess whether it means "estimated" or "wrong" — and the whole point
 * of the page is that an engineer can act on it without asking anybody.
 */
export const DERIVATION_STATUS_MEANINGS: Record<DerivationStatus, string> = {
  confirmed: "Building Integrity's own stated figure — a number and a unit, first-hand.",
  "pending-BI-confirmation": "A published figure, cited below, that Building Integrity has not yet confirmed.",
  "code-constant": "The code specifies it outright. Not a choice this app made.",
  "app-assumption": "A simplification this app makes, named here rather than hidden.",
  "from-the-drawing": "Measured off the building that was drawn — a real length, section or count.",
};

/** The legend, in the order it reads best: strongest provenance first. */
export const DERIVATION_STATUS_ORDER: readonly DerivationStatus[] = [
  "confirmed",
  "code-constant",
  "from-the-drawing",
  "pending-BI-confirmation",
  "app-assumption",
];

/**
 * ⚠ **Which tags mean "an engineer still has to supply this".**
 *
 * `pending-BI-confirmation` and `app-assumption`, and nothing else. A
 * `code-constant` needs no sign-off and a `from-the-drawing` length is not a
 * judgement; marking either as outstanding would bury the two that are.
 */
export function derivationStatusNeedsReview(status: DerivationStatus): boolean {
  return status === "pending-BI-confirmation" || status === "app-assumption";
}
