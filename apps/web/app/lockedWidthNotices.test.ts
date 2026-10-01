import { formatLengthIn } from "@building-integrity/calc-engine";
import type { LockedWidthRefusal } from "@building-integrity/geometry";
import { describe, expect, it } from "vitest";
import {
  lockedWidthEditRefusalSentence,
  unhonouredLockedWidthReviewNote,
  unhonouredLockedWidthSentence,
} from "./lockedWidthNotices";

/** The real catalog pair — `fabricationMinPanelWidthIn` (24in, confirmed) and
 * `panelWidthInRange.maxIn` (48in, manufacturer). Written out rather than
 * imported so a change to either shows up here as a diff rather than silently
 * rewording every sentence below. */
const LIMITS = { minIn: 24, maxIn: 48 };
const imperial = (valueIn: number) => formatLengthIn(valueIn, "imperial");
const metric = (valueIn: number) => formatLengthIn(valueIn, "metric");

/** The named 150in case: `corner | window | gap | standard 36¾ | corner`, one
 * standard-family slot on the whole wall and it is the pinned one — so there is
 * **one opening** on the wall and **no other hand-set panel**, which is exactly
 * the pair of facts the recovery advice is now allowed to turn on. */
const NO_ROOM_AT_ALL: LockedWidthRefusal = {
  slotIndex: 3,
  lockedWidthIn: 48,
  tiledWidthIn: 36.75,
  freePanelCount: 0,
  canGiveUpIn: 0,
  canAbsorbIn: 0,
  bracedFreePanelCount: 0,
  otherPinnedPanelCount: 0,
  openingCount: 1,
};

/** A wall with automatic panels that simply cannot spare enough. */
const NOT_ENOUGH_SLACK: LockedWidthRefusal = {
  slotIndex: 2,
  lockedWidthIn: 48,
  tiledWidthIn: 36,
  freePanelCount: 2,
  canGiveUpIn: 6,
  canAbsorbIn: 18,
  bracedFreePanelCount: 0,
  otherPinnedPanelCount: 0,
  openingCount: 0,
};

/** A pin NARROWER than the tiler's width, whose surplus has nowhere to go. */
const NOWHERE_TO_PUT_IT: LockedWidthRefusal = {
  slotIndex: 1,
  lockedWidthIn: 24,
  tiledWidthIn: 40,
  freePanelCount: 1,
  canGiveUpIn: 24,
  canAbsorbIn: 0,
  bracedFreePanelCount: 0,
  otherPinnedPanelCount: 0,
  openingCount: 0,
};

/** The wall the harness's step 12 refuses on, and the fixture behind the
 * sentence quoted verbatim in `smearforn-stage-0-1/README.md` and the spec's
 * Stage 1x: four panels, two already pinned at 48in, one 32in automatic panel
 * left. */
const HARNESS_STEP_12: LockedWidthRefusal = {
  slotIndex: 3,
  lockedWidthIn: 48,
  tiledWidthIn: 37,
  freePanelCount: 1,
  canGiveUpIn: 8,
  canAbsorbIn: 16,
  bracedFreePanelCount: 0,
  otherPinnedPanelCount: 2,
  openingCount: 0,
};

describe("unhonouredLockedWidthSentence", () => {
  it("names what is in the way and the only legal width, on the named 150in case", () => {
    const sentence = unhonouredLockedWidthSentence(NO_ROOM_AT_ALL, LIMITS, imperial);
    expect(sentence).toBe(
      'Hand-set at 48", but NOT in force on this wall: every other panel on this wall is an opening, a corner, a Safety/Gap spacer or hand-set itself, so there is no panel left to take the 11¼" from. This panel is built at 36¾", the width the tiler gives it, so the wall\'s own length stays exact. The only width this panel can have right now is 36¾". Nothing was changed to make it fit: drag this wall longer or remove the opening on it, and this width comes back by itself.',
    );
  });

  // -------------------------------------------------------------------------
  // THE RECOVERY ADVICE, which used to be one constant that over-promised three
  // different ways on this very wall. Each remedy is now offered only where it
  // is TRUE.
  // -------------------------------------------------------------------------
  it("does not offer to reset another hand-set panel when the wall has none", () => {
    const sentence = unhonouredLockedWidthSentence(NO_ROOM_AT_ALL, LIMITS, imperial);
    expect(sentence).not.toContain("hand-set panel on this wall to automatic");
  });

  it("offers to reset another hand-set panel when there IS one, and counts it", () => {
    expect(unhonouredLockedWidthSentence({ ...NO_ROOM_AT_ALL, otherPinnedPanelCount: 1 }, LIMITS, imperial)).toContain(
      "or reset the other hand-set panel on this wall to automatic",
    );
    expect(unhonouredLockedWidthSentence({ ...NO_ROOM_AT_ALL, otherPinnedPanelCount: 3 }, LIMITS, imperial)).toContain(
      "or reset one of the other hand-set panels on this wall to automatic",
    );
  });

  it("does not offer to remove an opening on a wall that has none", () => {
    const sentence = unhonouredLockedWidthSentence(NOT_ENOUGH_SLACK, LIMITS, imperial);
    expect(sentence).not.toContain("opening on it");
    expect(sentence).not.toContain("one of its openings");
    expect(sentence).toContain("Nothing was changed to make it fit: drag this wall longer, and this width comes back by itself.");
  });

  it("asks for a SHORTER wall, not a longer one, when the pin's surplus has nowhere to go", () => {
    // ⚠ The old constant said "lengthen the wall" here, and at a 48in standard
    // width lengthening creates no absorb headroom at all — the tiler refills to
    // the ceiling. A shorter wall is the remedy for this half of the problem.
    const sentence = unhonouredLockedWidthSentence(NOWHERE_TO_PUT_IT, LIMITS, imperial);
    expect(sentence).toContain("drag this wall shorter");
    expect(sentence).not.toContain("drag this wall longer");
    // Removing an opening would make THIS case worse, so it is not offered even
    // when the wall has one.
    expect(unhonouredLockedWidthSentence({ ...NOWHERE_TO_PUT_IT, openingCount: 2 }, LIMITS, imperial)).not.toContain("openings");
  });

  it("names the fabrication minimum when the automatic panels cannot spare enough", () => {
    const sentence = unhonouredLockedWidthSentence(NOT_ENOUGH_SLACK, LIMITS, imperial);
    expect(sentence).toContain('the 2 automatic panels here can only give up 6" before one of them drops below the 24" fabrication minimum');
    // 36in + the 6in they CAN spare.
    expect(sentence).toContain('The widest this panel can be hand-set to right now is 42", and the narrowest is 24"');
  });

  it("speaks of absorbing, not giving up, when the pin is NARROWER than the tiler's width", () => {
    const sentence = unhonouredLockedWidthSentence(NOWHERE_TO_PUT_IT, LIMITS, imperial);
    expect(sentence).toContain('it hands 16" back to the rest of the wall');
    expect(sentence).toContain('can only absorb 0" before it passes the 48" maximum');
  });

  it("says no width fits at all rather than quoting an illegal figure", () => {
    // A 20in slot the tiler itself produced, with no slack to move it into range:
    // the widest honourable value is under the shop's own floor.
    const sentence = unhonouredLockedWidthSentence(
      { slotIndex: 0, lockedWidthIn: 30, tiledWidthIn: 20, freePanelCount: 0, canGiveUpIn: 0, canAbsorbIn: 0, bracedFreePanelCount: 0, otherPinnedPanelCount: 0, openingCount: 0 },
      LIMITS,
      imperial,
    );
    expect(sentence).toContain('No hand-set width between 24" and 48" fits this wall as it stands.');
    expect(sentence).not.toContain("The only width");
  });

  it("quotes every length through the caller's formatter, so metric is metric throughout", () => {
    const sentence = unhonouredLockedWidthSentence(NO_ROOM_AT_ALL, LIMITS, metric);
    expect(sentence).toContain("1219mm"); // 48in
    expect(sentence).toContain("933mm"); // 36.75in
    expect(sentence).not.toContain('"');
  });
});

describe("unhonouredLockedWidthReviewNote", () => {
  const withWall = { ...NO_ROOM_AT_ALL, wallId: "AB", story: "ground" as const };

  it("names the wall, the slot and the story INSIDE the note, which is what keeps it off the dedupe's floor", () => {
    const note = unhonouredLockedWidthReviewNote(withWall, LIMITS, imperial);
    expect(note.startsWith("Wall AB, panel slot 3, ground story.")).toBe(true);
    // Two symmetric walls must not collapse into one entry.
    const other = unhonouredLockedWidthReviewNote({ ...withWall, wallId: "CD" }, LIMITS, imperial);
    expect(other).not.toBe(note);
    const second = unhonouredLockedWidthReviewNote({ ...withWall, story: "second" }, LIMITS, imperial);
    expect(second).toContain("second story.");
    expect(second).not.toBe(note);
  });

  it("says plainly which width is actually fabricated, and that the pin is kept rather than deleted", () => {
    const note = unhonouredLockedWidthReviewNote(withWall, LIMITS, imperial);
    expect(note).toContain('**It is fabricated at 36¾"**');
    expect(note).toContain("cut list, the fabrication sheet and the shop drawing");
    expect(note).toContain("kept on the panel rather than deleted");
  });

  it("says when the panel that would pay for the pin is a BRACED one, and nothing when it is not", () => {
    // `isFreePanel` includes "braced" — it always has, and so does
    // `planCornerBraceCombine` — so a width pin can move a braced panel, whose
    // placement comes from two figures Building Integrity has not confirmed. The
    // corner-brace entry says so; this one did not.
    const plain = unhonouredLockedWidthReviewNote({ ...NOT_ENOUGH_SLACK, wallId: "AB", story: "ground" }, LIMITS, imperial);
    expect(plain).not.toContain("braced");
    const braced = unhonouredLockedWidthReviewNote(
      { ...NOT_ENOUGH_SLACK, bracedFreePanelCount: 1, wallId: "AB", story: "ground" },
      LIMITS,
      imperial,
    );
    expect(braced).toContain("the panel that would pay for this width is a **braced** panel");
    expect(braced).toContain("neither of which Building Integrity has confirmed");
    const two = unhonouredLockedWidthReviewNote(
      { ...NOT_ENOUGH_SLACK, bracedFreePanelCount: 2, wallId: "AB", story: "ground" },
      LIMITS,
      imperial,
    );
    expect(two).toContain("one of the panels that would pay for this width is a **braced** panel");
    // ⚠ Future tense, deliberately: this note is about a pin that was REFUSED,
    // so nothing has been resized yet.
    expect(braced).not.toContain("was resized");
  });

  it("carries the same obstacle and legal-width clauses as the panel note, not a second wording of them", () => {
    const note = unhonouredLockedWidthReviewNote({ ...NOT_ENOUGH_SLACK, wallId: "AB", story: "ground" }, LIMITS, imperial);
    const panel = unhonouredLockedWidthSentence(NOT_ENOUGH_SLACK, LIMITS, imperial);
    for (const clause of [
      'the 2 automatic panels here can only give up 6" before one of them drops below the 24" fabrication minimum',
      'The widest this panel can be hand-set to right now is 42", and the narrowest is 24"',
    ]) {
      expect(panel).toContain(clause);
      expect(note).toContain(clause);
    }
  });
});

// ---------------------------------------------------------------------------
// THE WIDTH FIELD'S OWN REFUSAL.
//
// ⚠ **This had no test at all until 2026-09-30.** It is exported, wired into
// `handleSetPanelWidth`, quoted VERBATIM in `smearforn-stage-0-1/README.md` and
// in the spec's Stage 1x, and was asserted nowhere outside a browser — so the
// two places that quote it were the only check that it still said what they say
// it says, and a harness run is not a unit test. The verbatim case below is the
// one the harness recorded, so if the wording moves, this file goes red in a
// second rather than a browser run going red in four minutes.
// ---------------------------------------------------------------------------
describe("lockedWidthEditRefusalSentence", () => {
  it("is word for word the sentence the harness and the spec quote", () => {
    expect(lockedWidthEditRefusalSentence(HARNESS_STEP_12, LIMITS, imperial)).toBe(
      'Refused: 48" is not a width this wall can hold — it needs 11" from the rest of the wall, and the 1 automatic panel here can only give up 8" before it drops below the 24" fabrication minimum. The widest this panel can be hand-set to right now is 45", and the narrowest is 24". Nothing was changed.',
    );
  });

  it("is a GESTURE refusal, so it says nothing changed and does NOT promise the width comes back", () => {
    // The distinction the whole module is built on: the Selected Panel note and
    // the Review Log entry describe a standing fact about a pin that is dormant
    // and will reapply itself. This one describes a click that just happened and
    // committed nothing — there is no pin to come back.
    const sentence = lockedWidthEditRefusalSentence(HARNESS_STEP_12, LIMITS, imperial);
    expect(sentence.endsWith("Nothing was changed.")).toBe(true);
    expect(sentence).not.toContain("comes back by itself");
    expect(sentence).not.toContain("NOT in force");
    expect(sentence).not.toContain("drag this wall");
  });

  it("shares the obstacle and legal-width clauses with the other two surfaces rather than rewording them", () => {
    const field = lockedWidthEditRefusalSentence(NOT_ENOUGH_SLACK, LIMITS, imperial);
    const panel = unhonouredLockedWidthSentence(NOT_ENOUGH_SLACK, LIMITS, imperial);
    for (const clause of [
      'the 2 automatic panels here can only give up 6" before one of them drops below the 24" fabrication minimum',
      'The widest this panel can be hand-set to right now is 42", and the narrowest is 24"',
    ]) {
      expect(field).toContain(clause);
      expect(panel).toContain(clause);
    }
  });

  it("names the wall's own make-up when there is no automatic panel at all", () => {
    expect(lockedWidthEditRefusalSentence(NO_ROOM_AT_ALL, LIMITS, imperial)).toBe(
      'Refused: 48" is not a width this wall can hold — every other panel on this wall is an opening, a corner, a Safety/Gap spacer or hand-set itself, so there is no panel left to take the 11¼" from. The only width this panel can have right now is 36¾". Nothing was changed.',
    );
  });

  it("speaks of absorbing when the typed width is NARROWER than the tiler's", () => {
    const sentence = lockedWidthEditRefusalSentence(NOWHERE_TO_PUT_IT, LIMITS, imperial);
    expect(sentence).toContain('it hands 16" back to the rest of the wall');
    expect(sentence).toContain('can only absorb 0" before it passes the 48" maximum');
  });

  it("quotes every length through the caller's formatter", () => {
    const sentence = lockedWidthEditRefusalSentence(HARNESS_STEP_12, LIMITS, metric);
    expect(sentence).toContain("1219mm"); // 48in
    expect(sentence).not.toContain('"');
  });
});
