import type { PanelPlacementResult, PanelSlotType } from "@building-integrity/geometry";

/**
 * What the panel placement tool says after it acts, composed here rather than
 * inline in page.tsx — because two of these sentences change depending on
 * WHICH operation was asked for, and that decision must not be made by
 * reading the sentence.
 *
 * ### The hazard this module exists to remove
 *
 * `applyPlacementResult` used to take a display string (`verb`) and branch on
 * it: `verb.startsWith("Deleted")` for one clause, `verb === "Inserted"` for
 * another. Both were correct on the day they were written, and both were a
 * trap — **reword a notice, which is a copy edit nobody runs a browser
 * harness for, and a clause silently stops appearing with no test failing.**
 * The asymmetry was the tell: one check needed `startsWith` and the other
 * `===`, purely because "Deleted a panel" is not shaped like "Inserted".
 *
 * This repo has paid for exactly this shape once already. `combinedPanelLabel`
 * parsed the panel label's hyphen, so dropping the hyphen for the stencil
 * rack would have rendered `N4-undefined+undefined` on every window — quietly.
 * Logic reading a string whose job is to be displayed is the defect; the fix
 * is the same one that worked there: carry the real field (`PlacementOp`) and
 * let the display text be DERIVED from it, so the two cannot drift apart at
 * all.
 *
 * Lengths are formatted by an injected `formatLength` so this module knows
 * nothing about the unit system and a test can read its output exactly.
 */

/** The operation the user asked for. The discriminant every branch below
 * reads — never the notice text. */
export type PlacementOp = "replace" | "insert" | "delete";

/** Display text, DERIVED from the operation. One source, so a copy edit here
 * cannot change what any branch decides. */
export const PLACEMENT_VERBS: Record<PlacementOp, string> = {
  replace: "Replaced",
  insert: "Inserted",
  delete: "Deleted a panel",
};

export type FormatLengthIn = (valueIn: number) => string;

/** What `shiftSlotCoverageRecords` removed, counted per component because
 * they have different names and calling the roofline Box Beam a "mid-wall
 * beam" is simply wrong about what just went. */
export interface EmptiedCoverage {
  midWallBeams: number;
  boxBeam: boolean;
  /** Spanning headers (Stage 2b) the edit left standing on fewer than two
   * panels. A header's own fabricated width IS the panels it spans, so one
   * that has lost them is not a header any more — it is removed, and saying
   * so is the difference between a removal and a disappearance. */
  spanningHeaders: number;
}

/**
 * A spanning header whose own FABRICATED WIDTH changed because the panels
 * under it changed — not a removal, a re-cut.
 *
 * ### Why this is said out loud rather than counted
 *
 * A spanning header's width is derived from the panels it spans, so an
 * insert or a delete elsewhere on the wall moves its range correctly and
 * still hands the shop a different part. The branch's own harness measured
 * it: deleting a panel to the LEFT of a header moved 2..4 to 1..3 — the same
 * two panels — while the header's own cut width went **80in to 85¾in**, and
 * the app said only "14 panels, 12 still automatic".
 *
 * ⚠ **That second number is NOT reproducible, and nothing here should be read
 * as if it were.** Re-running the same harness against the same checkout on
 * 2026-09-26 produced **82⅜in, 84¾in and 85¾in** on three runs of the same
 * 549in wall: the harness draws its footprint in pixels, so the free run's
 * baseline tiling lands slightly differently, and the redistribution after the
 * delete depends on which widths are locked by the time it happens. `80in ->`
 * whatever-it-is is the invariant; the second figure is an artifact of the run.
 * Always quote the committed `evidence.json` rather than a remembered number —
 * an earlier round of these comments quoted one that the evidence beside it no
 * longer matched.
 *
 * A header already on a sheet being quietly re-cut is the hazard, so both
 * numbers are printed. `outsideRangeIn` is set when the new width has landed
 * outside the span range the app REFUSES at placement — the same range,
 * `bigHeaderWidthInRange`, still pending BI confirmation and never widened:
 * a shift is not allowed to smuggle in a span a placement could not have
 * made.
 */
export interface SpanningHeaderWidthChange {
  /** `H1`. Composed elsewhere from a real number; never parsed here. */
  name: string;
  fromIn: number;
  toIn: number;
  /** The range the new width is outside of, or null when it is still inside. */
  outsideRangeIn: { minIn: number; maxIn: number } | null;
}

/** Exactly the commit fields these sentences read. Narrower than the whole
 * result on purpose: it keeps the module's inputs obvious and its tests
 * free of fixture-building. */
export interface PlacementCommitFacts {
  slotCountBefore: number;
  slotCountAfter: number;
  freeCountAfter: number;
  droppedTypes: PanelSlotType[];
}

/**
 * The refusal sentence, with the number the arithmetic produced in it.
 *
 * **Operation-independent on purpose** — the width edit's own
 * count-preserving path shows these same sentences and has no placement
 * operation to name. Anything that depends on which operation was asked for
 * belongs in `placementRefusalNotice` below.
 *
 * Returns null for a result that is not a refusal at all.
 */
export function placementRefusalSentence(result: PanelPlacementResult, formatLength: FormatLengthIn): string | null {
  switch (result.outcome) {
    case "no-change":
      return "That panel is already what the tool is set to, so nothing changed.";
    case "refuse-not-placeable":
      return result.reason === "rule-placed-slot"
        ? "Corner and safety-gap panels are placed by rule, not by hand — the app positions them and would overwrite a hand-placed one. Nothing was changed."
        : "There is nowhere on this wall to put a panel there. Nothing was changed.";
    case "refuse-width-out-of-range":
      return `Refused: a ${formatLength(result.widthIn)} panel is outside what the shop builds (${formatLength(result.minIn)} to ${formatLength(result.maxIn)}). Nothing was changed.`;
    case "refuse-no-room":
      // "this change", not "that panel": the same sentence serves the
      // placement tool AND the width edit, where there is no new panel to
      // point at. A pronoun with no antecedent is what the first shared
      // version left behind.
      return `Refused: there is ${formatLength(result.freeBudgetIn)} of automatic panel width on this wall and this change needs ${formatLength(result.requestedIn)} of it — with whatever is left over still at least ${formatLength(result.minIn)}. A corner or an opening is never shrunk to make room. Nothing was changed.`;
    case "refuse-no-free-run":
      return `Refused: every other panel on this wall is hand-set, an opening or a corner, so there is nothing automatic to give that ${formatLength(result.freedWidthIn)} back to. Reset a panel to automatic first. Nothing was changed.`;
    case "refuse-would-exceed-maximum":
      return `Refused: that would leave an automatic panel ${formatLength(result.wouldBeIn)} wide, over the ${formatLength(result.maxIn)} maximum. Nothing was changed.`;
    default:
      return null;
  }
}

/**
 * The whole refusal notice for a placement, including the one clause that
 * depends on which operation was refused.
 *
 * **"This wall has no way to hold fewer panels" is true of a DELETE and false
 * of anything else**, which is why it is added here by operation rather than
 * living in the shared sentence: a replace or an insert refused for the same
 * arithmetic reason has not been told it cannot shrink, because that is not
 * what it asked for.
 */
export function placementRefusalNotice(op: PlacementOp, result: PanelPlacementResult, formatLength: FormatLengthIn): string {
  const sentence = placementRefusalSentence(result, formatLength) ?? "That couldn't be applied, so nothing was changed.";
  const whyItCannotShrink = op === "delete" && result.outcome === "refuse-would-exceed-maximum" ? " This wall has no way to hold fewer panels." : "";
  return `${sentence}${whyItCannotShrink}`;
}

/**
 * The notice after a placement actually lands.
 *
 * Two riders, both saying out loud what would otherwise be found by counting
 * panels on a drawing:
 *
 * - **An INSERT that the automatic run had to pay for by giving panels up**
 *   leaves the wall's count where it was, or lower. It says how many went and
 *   how many of those were braced, since an automatic panel can still carry a
 *   style the run just took with it. Only an insert: a replace or a delete
 *   that drops a panel is doing what it was asked to.
 * - **Coverage ranges the edit emptied**, named by component, and not
 *   claiming the panel the user clicked was the one that emptied them — a
 *   range can just as well be emptied by an automatic panel the run dropped.
 * - **Spanning headers this edit RE-CUT** (`widthChanges`) — see
 *   `SpanningHeaderWidthChange`. A header that survives the edit intact can
 *   still come out a different part, and that is the one outcome here that
 *   reaches a saw.
 */
export function placementCommitNotice(
  op: PlacementOp,
  wallId: string,
  facts: PlacementCommitFacts,
  emptied: EmptiedCoverage,
  widthChanges: SpanningHeaderWidthChange[],
  formatLength: FormatLengthIn,
): string {
  const gaveUp = facts.droppedTypes.length;
  const bracedGaveUp = facts.droppedTypes.filter((t) => t === "braced").length;
  const countNote =
    op === "insert" && gaveUp > 0
      ? ` The automatic run gave up ${gaveUp} panel${gaveUp === 1 ? "" : "s"}${bracedGaveUp > 0 ? ` (${bracedGaveUp} of them braced)` : ""} to pay for it, so this wall now has ${facts.slotCountAfter} panels — narrow a panel to make room for another.`
      : "";
  const beamNote = [
    emptied.midWallBeams > 0
      ? ` ${emptied.midWallBeams} Mid-Wall Bond Beam${emptied.midWallBeams === 1 ? "" : "s"} covered only panels this edit removed, so ${emptied.midWallBeams === 1 ? "it was" : "they were"} removed too.`
      : "",
    emptied.boxBeam ? " The roofline Box Beam covered only panels this edit removed, so it was removed too." : "",
    emptied.spanningHeaders > 0
      ? ` ${emptied.spanningHeaders} spanning header${emptied.spanningHeaders === 1 ? "" : "s"} ${emptied.spanningHeaders === 1 ? "was" : "were"} left standing on fewer than two panels, so ${emptied.spanningHeaders === 1 ? "it was" : "they were"} removed too — a header's own width is the panels it spans.`
      : "",
  ].join("");
  // One clause per re-cut header, with BOTH widths in it. Plural-agnostic
  // wording per header rather than a count, because "2 headers changed width"
  // does not tell a shop which part to re-cut.
  const widthNote = widthChanges
    .map(
      (change) =>
        ` Spanning header ${change.name} still spans its panels, but those panels are now a different width: it is cut ${formatLength(change.toIn)} instead of ${formatLength(change.fromIn)}.${
          change.outsideRangeIn
            ? ` That is OUTSIDE the ${formatLength(change.outsideRangeIn.minIn)}-${formatLength(change.outsideRangeIn.maxIn)} span a header can be placed at — a range Building Integrity has not confirmed yet, so it is reported rather than widened. Re-place or remove ${change.name}.`
            : ""
        }`,
    )
    .join("");
  return `${PLACEMENT_VERBS[op]} on wall ${wallId}: ${facts.slotCountBefore} panels → ${facts.slotCountAfter}, ${facts.freeCountAfter} still automatic.${countNote}${beamNote}${widthNote}`;
}
