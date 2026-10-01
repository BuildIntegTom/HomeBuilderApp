import {
  honourableLockedWidthRangeIn,
  type LockedWidthRefusal,
  type PanelWidthLimitsIn,
  type UnhonouredLockedWidth,
} from "@building-integrity/geometry";
import type { FormatLengthIn } from "./runStopNotices";

/**
 * What a hand-set panel width that the wall **cannot honour** has to say.
 *
 * Tommy's decision, 2026-09-29: *a locked/dragged width the wall length cannot
 * honour is* **refused outright** *— nothing changes, and the message names what
 * is in the way and the widest legal value. The wall's real length is never
 * violated.* `planLockedWidthReforce` is the refusal; this is the message, and
 * the two are separate for the reason `runStopNotices.ts` was extracted for —
 * the numbers can be tested without a browser and the wording without a tiler.
 *
 * **It is NOT the refusal of a gesture, and the wording has to be honest about
 * that.** The width edit itself already refuses before it commits anything
 * (`resolvePanelWidthEdit`'s `refuse-no-room`, plus `retileWallAroundPins`'
 * sum-and-pin guards), and those refusals read *"Refused: … Nothing was
 * changed"* in the present tense of something the user just tried. What this
 * module describes is a pin that was legal when it was set and stopped being
 * payable because of a LATER, unrelated edit — the wall dragged shorter, an
 * opening added, a run stop, a different standard width. So it is written as a
 * standing statement of fact about the panel ("not in force"), never as "that
 * didn't work": the user did not just do anything wrong, and the thing that is
 * refused is the re-force, not their last click.
 *
 * Two surfaces, one set of words:
 *
 *   1. the Selected Panel note, where it replaces the *"it survives a re-tile of
 *      this wall"* line — which on these walls is simply untrue;
 *   2. the Review Log, for every panel nobody has selected, because the wall it
 *      leaves behind is perfectly legal and nothing else would show it.
 */

/** What stands in the way, in the voice of `runStopFitRefusalSentence` — the
 * real constraint, not the arithmetic symptom. */
function obstacleClause(
  refusal: LockedWidthRefusal,
  limits: PanelWidthLimitsIn,
  formatLengthIn: FormatLengthIn,
): string {
  const owedIn = Math.abs(refusal.lockedWidthIn - refusal.tiledWidthIn);
  const widerThanTiled = refusal.lockedWidthIn > refusal.tiledWidthIn;
  if (refusal.freePanelCount === 0) {
    return `every other panel on this wall is an opening, a corner, a Safety/Gap spacer or hand-set itself, so there is no panel left to ${
      widerThanTiled ? "take the" : "put the"
    } ${formatLengthIn(owedIn)} ${widerThanTiled ? "from" : "into"}`;
  }
  const one = refusal.freePanelCount === 1;
  const panels = `${refusal.freePanelCount} automatic ${one ? "panel" : "panels"}`;
  const theOne = one ? "it drops" : "one of them drops";
  const theOnePasses = one ? "it passes" : "one of them passes";
  return widerThanTiled
    ? `it needs ${formatLengthIn(owedIn)} from the rest of the wall, and the ${panels} here can only give up ${formatLengthIn(refusal.canGiveUpIn)} before ${theOne} below the ${formatLengthIn(limits.minIn)} fabrication minimum`
    : `it hands ${formatLengthIn(owedIn)} back to the rest of the wall, and the ${panels} here can only absorb ${formatLengthIn(refusal.canAbsorbIn)} before ${theOnePasses} the ${formatLengthIn(limits.maxIn)} maximum`;
}

/** The widest legal value Tommy's decision asks for — and the narrowest, since
 * a pin NARROWER than the tiler's width is refused just as often and "the
 * widest" alone would be the wrong half of the answer for it. */
function legalWidthClause(
  refusal: LockedWidthRefusal,
  limits: PanelWidthLimitsIn,
  formatLengthIn: FormatLengthIn,
): string {
  const range = honourableLockedWidthRangeIn(refusal, limits);
  if (!range) {
    return `No hand-set width between ${formatLengthIn(limits.minIn)} and ${formatLengthIn(limits.maxIn)} fits this wall as it stands.`;
  }
  if (range.narrowestIn === range.widestIn) {
    return `The only width this panel can have right now is ${formatLengthIn(range.widestIn)}.`;
  }
  return `The widest this panel can be hand-set to right now is ${formatLengthIn(range.widestIn)}, and the narrowest is ${formatLengthIn(range.narrowestIn)}.`;
}

/** How to get the pin back, which is the one actionable half of the message. */
const RECOVERY_CLAUSE =
  "Nothing was changed to make it fit: lengthen the wall, remove an opening, or reset another panel to automatic, and this width comes back by itself.";

/**
 * The Selected Panel note's own sentence, replacing the *"it survives a re-tile
 * of this wall"* line for a pin that currently does not.
 */
export function unhonouredLockedWidthSentence(
  refusal: LockedWidthRefusal,
  limits: PanelWidthLimitsIn,
  formatLengthIn: FormatLengthIn,
): string {
  return `Hand-set at ${formatLengthIn(refusal.lockedWidthIn)}, but NOT in force on this wall: ${obstacleClause(
    refusal,
    limits,
    formatLengthIn,
  )}. This panel is built at ${formatLengthIn(refusal.tiledWidthIn)}, the width the tiler gives it, so the wall's own length stays exact. ${legalWidthClause(
    refusal,
    limits,
    formatLengthIn,
  )} ${RECOVERY_CLAUSE}`;
}

/**
 * The Review Log's own note for the same refusal.
 *
 * ⚠ **The wall id, the slot index and the story are repeated inside the note on
 * purpose** — the Review Log's dedupe compares `note` and nothing else, so two
 * entries whose notes match collapse into one however different their labels
 * are. Every other figure here is a function of the wall's tiling, and on a
 * plain rectangle the north and south walls tile identically; without the wall
 * id in the note one of two symmetric walls would never reach the engineer's
 * list. Same reasoning, and the same failure, as the corner-brace refusal entry.
 */
export function unhonouredLockedWidthReviewNote(
  refusal: UnhonouredLockedWidth & { story: "ground" | "second" },
  limits: PanelWidthLimitsIn,
  formatLengthIn: FormatLengthIn,
): string {
  return `Wall ${refusal.wallId}, panel slot ${refusal.slotIndex}, ${
    refusal.story === "second" ? "second" : "ground"
  } story. Somebody hand-set this panel to ${formatLengthIn(
    refusal.lockedWidthIn,
  )} and the wall can no longer honour it: ${obstacleClause(refusal, limits, formatLengthIn)}. **It is fabricated at ${formatLengthIn(
    refusal.tiledWidthIn,
  )}** — that is the width on the cut list, the fabrication sheet and the shop drawing, not the hand-set one. ${legalWidthClause(
    refusal,
    limits,
    formatLengthIn,
  )} The hand-set width is kept on the panel rather than deleted, so it reapplies by itself if the wall gets the room back; refusing to apply it is deliberate, and the wall's own length is exact because of it (Tommy, 2026-09-29: a locked width the wall cannot honour "is refused outright — nothing changes... The wall's real length is never violated"). What needs a human is which number was meant: a panel drawn at one width and built at another is the kind of thing nobody notices until it is cut.`;
}

/**
 * The width FIELD's own refusal, for the one case where the gesture and the
 * refusal really are the same act: a width typed now that the wall cannot pay
 * for now.
 *
 * ⚠ **This branch only became reachable on 2026-09-30, and what it replaces was
 * worse than a vague message.** `retileWallAroundPins` has always refused a pin
 * that did not come back at its own pinned width, but before the re-force could
 * refuse, it always DID come back — paid for by a neighbour shrunk below the
 * 24in fabrication minimum, which the old shed was happy to do. So the edit
 * committed and produced an unbuildable panel, reported after the fact by
 * `findSubMinimumPanelWidths` rather than refused. It is refused now, and that
 * makes the two width-edit paths agree: `redistributeFreeRun`, the path a
 * hand-edited wall takes, has always refused exactly these (see
 * `narrowestAcceptablePinWidthIn`'s own note). The generic
 * "couldn't be applied without moving this wall's own total length" sentence it
 * would otherwise fall through to is not true of this case — the total was
 * fine; a neighbouring panel was not.
 */
export function lockedWidthEditRefusalSentence(
  refusal: LockedWidthRefusal,
  limits: PanelWidthLimitsIn,
  formatLengthIn: FormatLengthIn,
): string {
  return `Refused: ${formatLengthIn(
    refusal.lockedWidthIn,
  )} is not a width this wall can hold — ${obstacleClause(refusal, limits, formatLengthIn)}. ${legalWidthClause(
    refusal,
    limits,
    formatLengthIn,
  )} Nothing was changed.`;
}
