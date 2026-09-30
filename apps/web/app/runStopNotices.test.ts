import { describe, expect, it } from "vitest";
import {
  WITHHELD_RESTORE_CHANGED_SENTENCE,
  runStopFitRefusalSentence,
  withheldOpeningTotal,
  withheldOpeningsElevationClause,
  withheldOpeningsReviewNote,
  withheldRestoreIsExact,
  type WithheldOpeningsOnStory,
} from "./runStopNotices";

const ground = (count: number, fidelity: WithheldOpeningsOnStory["fidelity"]): WithheldOpeningsOnStory => ({
  story: "ground",
  count,
  fidelity,
});
const second = (count: number, fidelity: WithheldOpeningsOnStory["fidelity"]): WithheldOpeningsOnStory => ({
  story: "second",
  count,
  fidelity,
});

describe("withheldRestoreIsExact", () => {
  it("is false for a wall that withheld nothing — silent, not exact", () => {
    expect(withheldRestoreIsExact([])).toBe(false);
    expect(withheldRestoreIsExact([ground(0, "nothing-withheld")])).toBe(false);
  });

  it("is true only while every story that withheld something can restore it", () => {
    expect(withheldRestoreIsExact([ground(1, "exact")])).toBe(true);
    expect(withheldRestoreIsExact([ground(1, "exact"), second(0, "nothing-withheld")])).toBe(true);
    expect(withheldRestoreIsExact([ground(1, "exact"), second(2, "approximate")])).toBe(false);
  });
});

describe("withheldOpeningsReviewNote", () => {
  it("says nothing at all when nothing was withheld", () => {
    expect(withheldOpeningsReviewNote([ground(0, "nothing-withheld")])).toBe("");
  });

  it("names the count on every story it happened on", () => {
    const note = withheldOpeningsReviewNote([ground(1, "exact"), second(2, "exact")]);
    expect(note).toContain("1 opening and 2 openings on the second story");
    expect(note).toContain("no cut list, fabrication group or shop drawing");
  });

  /**
   * **The third review's must-fix, in one assertion.** This text promised
   * "exactly as drawn" unconditionally, and a delete or an insert on the wall
   * while it was stopped makes that false — see `runStopOpenings.ts`. The claim
   * now appears only where the geometry says it holds.
   */
  it("promises exactly-as-drawn only when the restore really is exact", () => {
    expect(withheldOpeningsReviewNote([ground(1, "exact")])).toContain("back exactly as drawn");
    const hedged = withheldOpeningsReviewNote([ground(1, "approximate")]);
    expect(hedged).not.toContain("exactly as drawn");
    expect(hedged).toContain("back on this wall");
    expect(hedged).toContain(WITHHELD_RESTORE_CHANGED_SENTENCE);
  });

  /** Never lost, whatever the fidelity — the half of the promise that IS
   * unconditional, and the one Tommy's decision actually made. */
  it("says held-not-deleted either way", () => {
    expect(withheldOpeningsReviewNote([ground(1, "exact")])).toContain("held, not deleted");
    expect(withheldOpeningsReviewNote([ground(1, "approximate")])).toContain("held, not deleted");
  });
});

describe("withheldOpeningsElevationClause", () => {
  it("says nothing at all when nothing was withheld", () => {
    expect(withheldOpeningsElevationClause([ground(0, "nothing-withheld")])).toBe("");
  });

  it("agrees its verb with the total across stories", () => {
    expect(withheldOpeningsElevationClause([ground(1, "exact")])).toContain("span is not built");
    expect(withheldOpeningsElevationClause([ground(1, "exact"), second(1, "exact")])).toContain("span are not built");
  });

  it("promises exactly-as-drawn only when the restore really is exact", () => {
    expect(withheldOpeningsElevationClause([ground(1, "exact")])).toContain("back exactly as drawn");
    const hedged = withheldOpeningsElevationClause([ground(2, "approximate")]);
    expect(hedged).not.toContain("exactly as drawn");
    expect(hedged).toContain(WITHHELD_RESTORE_CHANGED_SENTENCE);
  });

  it("counts the total across both stories", () => {
    expect(withheldOpeningTotal([ground(1, "exact"), second(2, "exact")])).toBe(3);
  });
});

describe("runStopFitRefusalSentence", () => {
  const inches = (valueIn: number) => `${valueIn}in`;
  const feet = (valueFt: number) => `${valueFt}ft`;
  const refusal = {
    builtLengthIn: 160,
    openingCount: 2,
    cornerCount: 2,
    requiredIn: 174,
    minPanelWidthIn: 24,
    basisIn: 360,
    onWall: "",
    storyLabel: "",
  };

  /**
   * **Tommy's own case, in the words he would now see.** He was shown "the
   * panel wall doesnt add up" for a wall whose 2 windows and 2 corner panels
   * needed 174in of a shorter run; this names the constraint and quotes the
   * number.
   */
  it("names the openings, the corner panels and their real total", () => {
    const sentence = runStopFitRefusalSentence(refusal, inches, feet);
    expect(sentence).toContain("leaves 160in of this wall built");
    expect(sentence).toContain("the 2 openings and 2 corner panels still on it need 174in");
    // Exactly that, or enough left over to be a panel: 174 + 24.
    expect(sentence).toContain("at least 198in");
    expect(sentence).toContain("stop all 30ft of the wall");
    // The way out that does not delete anything, which is the decision this
    // whole feature implements.
    expect(sentence).toContain("it is remembered and comes straight back");
  });

  it("agrees its nouns with the counts", () => {
    const single = runStopFitRefusalSentence({ ...refusal, openingCount: 1, cornerCount: 1 }, inches, feet);
    expect(single).toContain("the 1 opening and 1 corner panel still on it");
  });

  /** A run with no corner panel left (both ends stopped) says nothing about
   * corners rather than saying "0 corner panels". */
  it("leaves the corner clause out when the run builds none", () => {
    const sentence = runStopFitRefusalSentence({ ...refusal, cornerCount: 0 }, inches, feet);
    expect(sentence).toContain("the 2 openings still on it");
    expect(sentence).not.toContain("corner");
  });

  /** Since the orphan-corner rule, stopping one wall lengthens whichever wall
   * was butting into the corner it removes — so the refusal can be about a wall
   * the user did not touch, on either story, and has to say which. */
  it("says which wall and which story when the refusal is not about the edited wall", () => {
    const sentence = runStopFitRefusalSentence(
      { ...refusal, onWall: " on wall BC", storyLabel: " on the second story" },
      inches,
      feet,
    );
    expect(sentence).toContain("built on wall BC on the second story");
  });
});
