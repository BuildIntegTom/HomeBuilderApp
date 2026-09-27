import type { SpanningHeaderPlacementResult } from "@building-integrity/geometry";
import type { FormatLengthIn } from "./placementNotice";

/**
 * What the spanning-header controls say when they refuse, or when they act.
 *
 * Composed here, beside `placementNotice.ts` and for the same reason: **the
 * decision of which sentence to show is made from a real discriminant
 * (`result.outcome` / `result.reason`), never by reading a sentence back.**
 * This repo has paid for the other shape twice — `combinedPanelLabel` parsing
 * the panel label's hyphen, and `applyPlacementResult` branching on the
 * display verb — and both were correct on the day they were written.
 *
 * Every refusal quotes the number the arithmetic produced. The 48in-144in
 * span range is `bigHeaderWidthInRange`, which is **pending BI confirmation**
 * and is not widened to fit a drawing; the sentence says so, because a limit
 * a user is bumping into is exactly when its provisionality matters.
 */
export function spanningHeaderRefusalNotice(
  result: Extract<SpanningHeaderPlacementResult, { outcome: "refuse" }>,
  formatLength: FormatLengthIn,
): string {
  switch (result.reason) {
    case "out-of-range":
      return "Refused: that is not a real run of panels on this wall. Nothing was changed.";
    case "single-slot-span":
      return "Refused: a spanning header has to sit on at least two panels. A header above ONE panel is already a panel of its own — set that panel's type instead. Nothing was changed.";
    case "overlaps-existing":
      return "Refused: another spanning header already covers one of those panels, and two headers cannot sit on the same panel. Remove the other one first. Nothing was changed.";
    case "span-out-of-range":
      return `Refused: those panels span ${formatLength(result.spanWidthIn)}, and a header is built between ${formatLength(result.minIn)} and ${formatLength(result.maxIn)} — a range Building Integrity has not confirmed yet, so it is not widened to fit a drawing. Nothing was changed.`;
    case "taller-than-story":
      return `Refused: that header's top would land at ${formatLength(result.headerTopIn)} on a ${formatLength(result.storyHeightIn)} story, or its own height is outside what the shop builds a header at. Nothing was changed.`;
    default:
      return "Refused, so nothing was changed.";
  }
}

/** The notice after a spanning header actually lands — its building-wide
 * name (which carries no direction, so the wall is stated in words) and what
 * it sits on. */
export function spanningHeaderCommitNotice(facts: {
  /** `H1`. Composed elsewhere from a real number; this module never builds
   * or parses one. */
  name: string;
  /** "East wall — spans E4, E5". */
  location: string;
  spanWidthIn: number;
  formatLength: FormatLengthIn;
}): string {
  return `Placed ${facts.name}: ${facts.location}, spanning ${facts.formatLength(facts.spanWidthIn)}. Its name carries no direction — every header in the building is numbered in one H series, so H1 may be on one wall and H2 on another.`;
}

/**
 * What a wall-run stop says when it would leave a spanning header standing on
 * fewer panels than it spans.
 *
 * **Refusing is the answer, not adjusting.** A header whose span quietly
 * shrank because the wall under it got shorter is a fabricated part cut to a
 * length nobody chose — the same class of defect as half a gable window,
 * which Stage 3 also refuses by name.
 */
export function spanningHeaderRunStopRefusal(headerNames: string[]): string {
  const names = headerNames.join(", ");
  const plural = headerNames.length === 1 ? "" : "s";
  return `Refused: stopping this wall there would take panels out from under spanning header${plural} ${names}. A header's own width is the panels it spans, so shortening the wall would silently re-cut it. Remove the header${plural} first, or stop the wall somewhere else. Nothing was changed.`;
}
