import type { RunStopRestoreFidelity } from "@building-integrity/geometry";

/**
 * The sentences the Stop Wall tool shows a user: what a wall's unbuilt span
 * swallowed (the Review Log entry and the elevation notice), and the refusal
 * when a stop leaves a run that cannot be panelized.
 *
 * Composed here rather than inline in page.tsx, because the first two make the
 * same promise and it has to be the same promise — and because the third is the
 * whole user-visible point of this change and was testable only through a
 * browser.
 *
 * ### The defect this module exists for
 *
 * Both places said the openings come back **"exactly as drawn"**, and the
 * module doc comment in `runStopOpenings.ts` said the same thing about order.
 * **It is not true in every case**, and the third review measured two shapes
 * where it is not: openings inserted or deleted on the wall while it is stopped
 * leave the memory with no correspondence to rebase through, and a restored
 * opening can come back beside a different panel or on the other side of a
 * survivor. Nothing is lost in either case — that half of the promise is
 * unconditional — but *"exactly as drawn"* is a claim about a drawing, and a
 * drawing that comes back different from the one that was promised is worse
 * than one that was never promised.
 *
 * So the wording is CONDITIONED on `runStopRestoreFidelity`, which is the
 * geometry's own answer to "can this be put back where it was", and the two
 * pieces of text read that one answer rather than each carrying a copy of the
 * claim. A copy edit in one of them cannot silently promise something the other
 * does not.
 *
 * Counts and fidelity are passed IN. This module composes sentences; it does not
 * decide what a wall withheld.
 */

/** One story's withheld tally for one wall. `fidelity` is
 * `runStopRestoreFidelity` for that story's own current openings. */
export interface WithheldOpeningsOnStory {
  story: "ground" | "second";
  count: number;
  fidelity: RunStopRestoreFidelity;
}

export const withheldOpeningTotal = (stories: readonly WithheldOpeningsOnStory[]): number =>
  stories.reduce((total, story) => total + story.count, 0);

/**
 * True only when every story that withheld something can put it back where it
 * was. **The one gate on the words "exactly as drawn" anywhere in the app.**
 *
 * A story with nothing withheld says nothing about fidelity and is ignored; a
 * wall that withheld nothing at all is not exact, it is silent, which is why
 * this is false rather than true for it.
 */
export function withheldRestoreIsExact(stories: readonly WithheldOpeningsOnStory[]): boolean {
  const withheld = stories.filter((story) => story.count > 0);
  return withheld.length > 0 && withheld.every((story) => story.fidelity === "exact");
}

/**
 * The caution that replaces the exactness promise. Says what CHANGED (a fact)
 * and what may follow from it ("may"), rather than claiming the restore will be
 * wrong — a survivor whose own width was edited reports approximate and in fact
 * restores exactly, and this sentence is true of that case too.
 */
export const WITHHELD_RESTORE_CHANGED_SENTENCE =
  "Openings on this wall have changed since the stop was set, so a restored one may come back beside a different panel, or on the other side of another opening, rather than exactly where it was — nothing is lost, but check the layout.";

const countPhrase = (story: WithheldOpeningsOnStory): string =>
  `${story.count} ${story.count === 1 ? "opening" : "openings"}${story.story === "second" ? " on the second story" : ""}`;

/**
 * The Review Log's own sentence about a stopped wall's withheld openings,
 * appended to that wall's entry. Empty when the wall withheld nothing.
 *
 * A reviewer reading a drawing of a stopped wall cannot tell a window that was
 * never drawn from one that was drawn and then set aside, and the difference is
 * the whole point of Tommy's "drop them, and remember" — silence here would make
 * a non-destructive decision look like a deletion.
 */
export function withheldOpeningsReviewNote(stories: readonly WithheldOpeningsOnStory[]): string {
  const withheld = stories.filter((story) => story.count > 0);
  if (withheld.length === 0) return "";
  const counts = withheld.map(countPhrase).join(" and ");
  const promise = withheldRestoreIsExact(stories)
    ? "They are held, not deleted: shortening or clearing this stop puts every one of them back exactly as drawn."
    : `They are held, not deleted: shortening or clearing this stop puts every one of them back on this wall. ${WITHHELD_RESTORE_CHANGED_SENTENCE}`;
  return ` ${counts} sit inside the unbuilt span and are NOT built — they appear on no cut list, fabrication group or shop drawing. ${promise}`;
}

/**
 * The elevation notice's own clause, which follows a bold count the caller
 * renders itself (`2 openings`). Empty when the wall withheld nothing.
 */
export function withheldOpeningsElevationClause(stories: readonly WithheldOpeningsOnStory[]): string {
  const total = withheldOpeningTotal(stories);
  if (total === 0) return "";
  const verb = total === 1 ? "is" : "are";
  return withheldRestoreIsExact(stories)
    ? `in the unbuilt span ${verb} not built — set aside, not deleted, and back exactly as drawn the moment this stop is shortened or cleared.`
    : `in the unbuilt span ${verb} not built — set aside, not deleted, and back on this wall the moment this stop is shortened or cleared. ${WITHHELD_RESTORE_CHANGED_SENTENCE}`;
}

/**
 * What a stop that cannot be panelized needs to say — the refusal that names
 * the REAL constraint instead of the arithmetic symptom Tommy was shown.
 *
 * `runStopOpeningFit` decides whether a run refuses; this composes the
 * sentence, and the two are separate so the numbers can be tested without a
 * browser and the wording without a tiler.
 */
export interface RunStopFitRefusal {
  /** What the candidate stop would leave built on this wall. */
  builtLengthIn: number;
  /** `runStopOpeningFit`'s own counts and total for that run. */
  openingCount: number;
  cornerCount: number;
  requiredIn: number;
  /** The narrowest panel the shop can build — `fabricationMinPanelWidthIn`. */
  minPanelWidthIn: number;
  /** The whole wall, as the stop field measures it (`wallRunStopBasisIn`).
   *
   * ⚠ **Pre-existing cosmetic quirk, deliberately left alone:** when the
   * refusal is about a NEIGHBOUR wall (`onWall` non-empty — the orphan-corner
   * rule means stopping one wall lengthens another), this is still the EDITED
   * wall's length, so the closing "or stop all N of it" quotes the wrong wall.
   * The sum-invariant message on the line below this one in page.tsx has always
   * done the same. Named here rather than fixed, because fixing it belongs with
   * whoever revisits both. */
  basisIn: number;
  /** `" on wall BC"` when the refusal is about a neighbour, `""` for the wall
   * the user is editing. */
  onWall: string;
  /** `" on the second story"`, or `""`. */
  storyLabel: string;
}

export type FormatLengthIn = (valueIn: number) => string;
export type FormatFeetInches = (valueFt: number) => string;

export function runStopFitRefusalSentence(
  refusal: RunStopFitRefusal,
  formatLengthIn: FormatLengthIn,
  formatFeetInches: FormatFeetInches,
): string {
  const openings = `${refusal.openingCount} ${refusal.openingCount === 1 ? "opening" : "openings"}`;
  const corners =
    refusal.cornerCount > 0
      ? ` and ${refusal.cornerCount} corner ${refusal.cornerCount === 1 ? "panel" : "panels"}`
      : "";
  return `That leaves ${formatLengthIn(refusal.builtLengthIn)} of this wall built${refusal.onWall}${refusal.storyLabel}, and the ${openings}${corners} still on it need ${formatLengthIn(refusal.requiredIn)} of that. A run has to be exactly that, or at least ${formatLengthIn(refusal.requiredIn + refusal.minPanelWidthIn)}, so the leftover is a panel the shop can build. Remove an opening first, stop far enough to clear one (it is remembered and comes straight back), or stop all ${formatFeetInches(refusal.basisIn / 12)} of the wall.`;
}
