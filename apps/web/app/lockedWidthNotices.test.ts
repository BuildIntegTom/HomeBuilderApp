import { formatLengthIn } from "@building-integrity/calc-engine";
import type { LockedWidthRefusal } from "@building-integrity/geometry";
import { describe, expect, it } from "vitest";
import { unhonouredLockedWidthReviewNote, unhonouredLockedWidthSentence } from "./lockedWidthNotices";

/** The real catalog pair — `fabricationMinPanelWidthIn` (24in, confirmed) and
 * `panelWidthInRange.maxIn` (48in, manufacturer). Written out rather than
 * imported so a change to either shows up here as a diff rather than silently
 * rewording every sentence below. */
const LIMITS = { minIn: 24, maxIn: 48 };
const imperial = (valueIn: number) => formatLengthIn(valueIn, "imperial");
const metric = (valueIn: number) => formatLengthIn(valueIn, "metric");

/** The named 150in case: `corner | window | gap | standard 36¾ | corner`, one
 * standard-family slot on the whole wall and it is the pinned one. */
const NO_ROOM_AT_ALL: LockedWidthRefusal = {
  slotIndex: 3,
  lockedWidthIn: 48,
  tiledWidthIn: 36.75,
  freePanelCount: 0,
  canGiveUpIn: 0,
  canAbsorbIn: 0,
};

/** A wall with automatic panels that simply cannot spare enough. */
const NOT_ENOUGH_SLACK: LockedWidthRefusal = {
  slotIndex: 2,
  lockedWidthIn: 48,
  tiledWidthIn: 36,
  freePanelCount: 2,
  canGiveUpIn: 6,
  canAbsorbIn: 18,
};

/** A pin NARROWER than the tiler's width, whose surplus has nowhere to go. */
const NOWHERE_TO_PUT_IT: LockedWidthRefusal = {
  slotIndex: 1,
  lockedWidthIn: 24,
  tiledWidthIn: 40,
  freePanelCount: 1,
  canGiveUpIn: 24,
  canAbsorbIn: 0,
};

describe("unhonouredLockedWidthSentence", () => {
  it("names what is in the way and the only legal width, on the named 150in case", () => {
    const sentence = unhonouredLockedWidthSentence(NO_ROOM_AT_ALL, LIMITS, imperial);
    expect(sentence).toBe(
      'Hand-set at 48", but NOT in force on this wall: every other panel on this wall is an opening, a corner, a Safety/Gap spacer or hand-set itself, so there is no panel left to take the 11¼" from. This panel is built at 36¾", the width the tiler gives it, so the wall\'s own length stays exact. The only width this panel can have right now is 36¾". Nothing was changed to make it fit: lengthen the wall, remove an opening, or reset another panel to automatic, and this width comes back by itself.',
    );
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
      { slotIndex: 0, lockedWidthIn: 30, tiledWidthIn: 20, freePanelCount: 0, canGiveUpIn: 0, canAbsorbIn: 0 },
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
