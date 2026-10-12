/**
 * WHICH FULL PAGE OWNS WHICH SECTION — and the completeness check that lets
 * the right-hand tray be deleted.
 *
 * ⚠ **THIS MODULE IS TOMMY'S CONDITION, EXPRESSED AS CODE.** On 2026-10-11,
 * asked whether his "visiblize the right bar" idea or the plan's full pages
 * should win, he said: *"As long as everything is included in the tabs above,
 * let's delete it."* So the tray goes — but only once every section it holds is
 * reachable somewhere else. `unreachableSections` is that "as long as", and
 * U5.2 is not allowed to delete the tray while it returns anything.
 *
 * Checking it by eye is exactly the wrong instrument: `relevantDetailPages` is
 * DERIVED from what the design contains, so the list is different for a
 * one-storey slab-on-grade than for a two-storey bale foundation with a truss
 * roof. A section that only exists on some buildings is precisely the one that
 * would be missed.
 */

/**
 * The Summary page's sections, in the order they read.
 *
 * Tommy's own words, 2026-09-26, recorded in `TopBar.tsx` and not paraphrased
 * here: Summary holds *"project summary, project totals, and materials totals
 * pages that we have under summary"*. Those are exactly these three ids.
 */
export const SUMMARY_SECTION_IDS: readonly string[] = ["detail-summary", "project-totals", "detail-material-totals"];

/**
 * Sections that have their own front door in the editor chrome and therefore
 * need no page.
 *
 * ⚠ `review-log` is here for a safety reason and not a layout one. It is
 * `toReviewLog()`'s output — *"Items for Engineer/Contractor Review"* — where
 * every `pending-BI-confirmation` value and every sub-minimum panel width
 * surfaces, and **flags-check point 5 requires that gaps surface where a human
 * reviewer expects them.** U0 gave it a permanent icon in the left sidebar for
 * that reason. It is reachable, by design, without being on a page.
 */
export const ICON_REACHABLE_SECTION_IDS: readonly string[] = ["review-log"];

export type EditorSurface = "drawing" | "summary" | "print";

/**
 * Where a section renders, or `null` if no page claims it.
 *
 * Print takes every formal document — Tommy: Print holds *"all the shop
 * drawings"* — which is `formalDocumentNoteIds` in `page.tsx`, i.e.
 * `detail-summary` plus every relevant detail page.
 *
 * ⚠ **A section may belong to BOTH pages, and `detail-summary` does.** It is
 * the Project Summary you read on Summary and the first sheet of the packet you
 * print. That is not a conflict to resolve: `hostSurfaceForSection` answers
 * "where does this render *right now*", so the current surface decides, and
 * nothing renders twice.
 */
export function hostSurfaceForSection(
  sectionId: string,
  surface: EditorSurface,
  formalDocumentNoteIds: ReadonlySet<string>,
): EditorSurface | null {
  if (surface === "summary") return SUMMARY_SECTION_IDS.includes(sectionId) ? "summary" : null;
  if (surface === "print") return formalDocumentNoteIds.has(sectionId) ? "print" : null;
  return null;
}

/**
 * Every section id that no page and no icon can reach — Tommy's "as long as
 * everything is included", computed rather than eyeballed.
 *
 * Pass `allNoteSections`' ids and `formalDocumentNoteIds` straight from
 * `page.tsx`, so this is asked of the live, derived list for the building
 * actually on screen and not of a list written down once.
 */
export function unreachableSections(
  allSectionIds: readonly string[],
  formalDocumentNoteIds: ReadonlySet<string>,
): string[] {
  return allSectionIds.filter(
    (id) =>
      !SUMMARY_SECTION_IDS.includes(id) && !ICON_REACHABLE_SECTION_IDS.includes(id) && !formalDocumentNoteIds.has(id),
  );
}
