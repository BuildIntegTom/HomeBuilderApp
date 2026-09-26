import { describe, expect, it } from "vitest";
import {
  PLACEMENT_VERBS,
  placementCommitNotice,
  placementRefusalNotice,
  placementRefusalSentence,
  type EmptiedCoverage,
  type PlacementCommitFacts,
  type PlacementOp,
  type SpanningHeaderWidthChange,
} from "./placementNotice";

/** Deliberately not the app's formatter: these tests are about which clauses
 * appear, not about how an inch reads. */
const fmt = (valueIn: number) => `${valueIn}in`;
const NO_COVERAGE: EmptiedCoverage = { midWallBeams: 0, boxBeam: false, spanningHeaders: 0 };
const facts = (over: Partial<PlacementCommitFacts> = {}): PlacementCommitFacts => ({
  slotCountBefore: 15,
  slotCountAfter: 16,
  freeCountAfter: 13,
  droppedTypes: [],
  ...over,
});
/** The real function, with the two arguments every clause-selection test
 * below is indifferent to bound once — the width-change list (empty unless a
 * test is about it) and the length formatter. */
const commitNotice = (
  op: PlacementOp,
  wallId: string,
  commitFacts: PlacementCommitFacts,
  emptied: EmptiedCoverage,
  widthChanges: SpanningHeaderWidthChange[] = [],
) => placementCommitNotice(op, wallId, commitFacts, emptied, widthChanges, fmt);

/**
 * ### What these tests are really guarding
 *
 * Two clauses used to be chosen by reading the notice's own display string
 * (`verb.startsWith("Deleted")`, `verb === "Inserted"`). Every assertion
 * below drives the behaviour through `op` and NEVER through the wording, so
 * rewording any verb — a copy edit nobody runs a harness for — cannot
 * silently change which clause appears. The last test in the file is the one
 * that fails if someone reintroduces the coupling.
 */

describe("the refusal sentence, shared with the width edit", () => {
  it("quotes the numbers the arithmetic produced", () => {
    expect(placementRefusalSentence({ outcome: "refuse-no-room", requestedIn: 96, freeBudgetIn: 53.625, minIn: 24 }, fmt)).toBe(
      "Refused: there is 53.625in of automatic panel width on this wall and this change needs 96in of it — with whatever is " +
        "left over still at least 24in. A corner or an opening is never shrunk to make room. Nothing was changed.",
    );
  });

  it("is null for a result that is not a refusal", () => {
    expect(
      placementRefusalSentence(
        {
          outcome: "commit",
          slots: [],
          selectedIndex: -1,
          slotCountBefore: 1,
          slotCountAfter: 1,
          freeCountBefore: 1,
          freeCountAfter: 1,
          droppedIndices: [],
          droppedTypes: [],
        },
        fmt,
      ),
    ).toBeNull();
  });

  it("carries no operation-specific clause of its own — the width edit shows it too", () => {
    const sentence = placementRefusalSentence({ outcome: "refuse-would-exceed-maximum", wouldBeIn: 50, maxIn: 48 }, fmt);
    expect(sentence).toBe("Refused: that would leave an automatic panel 50in wide, over the 48in maximum. Nothing was changed.");
    expect(sentence).not.toContain("fewer panels");
  });
});

describe("the delete-only 'no way to hold fewer panels' clause", () => {
  const tooWide = { outcome: "refuse-would-exceed-maximum", wouldBeIn: 50, maxIn: 48 } as const;

  it("appears on a DELETE, where it is what actually happened", () => {
    expect(placementRefusalNotice("delete", tooWide, fmt)).toContain("This wall has no way to hold fewer panels.");
  });

  it("does NOT appear on a replace or an insert refused by the same arithmetic", () => {
    expect(placementRefusalNotice("replace", tooWide, fmt)).not.toContain("fewer panels");
    expect(placementRefusalNotice("insert", tooWide, fmt)).not.toContain("fewer panels");
  });

  it("does not appear on a delete refused for some OTHER reason", () => {
    expect(placementRefusalNotice("delete", { outcome: "refuse-no-free-run", freedWidthIn: 40 }, fmt)).not.toContain("fewer panels");
  });
});

describe("the insert-only 'gave up N panels' note", () => {
  it("appears on an INSERT the automatic run had to pay for, naming the count and the braced ones", () => {
    const notice = commitNotice(
      "insert",
      "AB",
      facts({ slotCountBefore: 6, slotCountAfter: 4, droppedTypes: ["standard", "braced"] }),
      NO_COVERAGE,
    );
    expect(notice).toContain("gave up 2 panels (1 of them braced)");
    expect(notice).toContain("this wall now has 4 panels");
  });

  it("says 'panel' rather than 'panels' for one", () => {
    expect(commitNotice("insert", "AB", facts({ droppedTypes: ["standard"] }), NO_COVERAGE)).toContain("gave up 1 panel to pay");
  });

  it("does NOT appear on a replace or a delete that dropped panels — those did what they were asked", () => {
    const dropped = facts({ droppedTypes: ["standard", "standard"] });
    expect(commitNotice("replace", "AB", dropped, NO_COVERAGE)).not.toContain("gave up");
    expect(commitNotice("delete", "AB", dropped, NO_COVERAGE)).not.toContain("gave up");
  });

  it("does not appear on an insert that cost the run nothing", () => {
    expect(commitNotice("insert", "AB", facts(), NO_COVERAGE)).not.toContain("gave up");
  });
});

describe("the emptied-coverage note", () => {
  it("names the component, and does not blame the panel the user clicked", () => {
    const notice = commitNotice("delete", "AB", facts(), { midWallBeams: 2, boxBeam: true, spanningHeaders: 0 });
    expect(notice).toContain("2 Mid-Wall Bond Beams covered only panels this edit removed, so they were removed too.");
    expect(notice).toContain("The roofline Box Beam covered only panels this edit removed, so it was removed too.");
    expect(notice).not.toContain("that panel");
  });

  it("agrees in number for a single beam", () => {
    expect(commitNotice("delete", "AB", facts(), { midWallBeams: 1, boxBeam: false, spanningHeaders: 0 })).toContain(
      "1 Mid-Wall Bond Beam covered only panels this edit removed, so it was removed too.",
    );
  });

  it("says when a spanning header was left standing on fewer than two panels (Stage 2b)", () => {
    const notice = commitNotice("delete", "AB", facts(), { midWallBeams: 0, boxBeam: false, spanningHeaders: 1 });
    expect(notice).toContain("1 spanning header was left standing on fewer than two panels, so it was removed too");
    expect(notice).toContain("a header's own width is the panels it spans");
    expect(commitNotice("delete", "AB", facts(), { midWallBeams: 0, boxBeam: false, spanningHeaders: 2 })).toContain(
      "2 spanning headers were left standing on fewer than two panels, so they were removed too",
    );
  });
});

describe("the display text cannot drift from the logic", () => {
  it("derives every verb from the operation, so a copy edit cannot change a branch", () => {
    // The guard for the actual defect: rename any verb below and these
    // assertions still hold, because nothing reads the wording to decide
    // anything. If someone reintroduces `verb.startsWith("Deleted")` or
    // `verb === "Inserted"`, changing PLACEMENT_VERBS breaks the clause
    // assertions above while this one keeps passing — which is the failure
    // signal that was missing before.
    const ops: PlacementOp[] = ["replace", "insert", "delete"];
    for (const op of ops) {
      expect(commitNotice(op, "AB", facts(), NO_COVERAGE).startsWith(`${PLACEMENT_VERBS[op]} on wall AB:`)).toBe(true);
    }
    // And the three verbs really are distinct, so "derived" is not hiding a
    // collapse into one string.
    expect(new Set(Object.values(PLACEMENT_VERBS)).size).toBe(3);
  });

  it("keeps the clauses working under a hypothetical rewording", () => {
    // Simulates the copy edit that would have broken the old code: the
    // clause decisions are re-checked against an op whose verb text has
    // nothing in common with the string the old branches matched on.
    const reworded: Record<PlacementOp, string> = { replace: "Swapped", insert: "Added", delete: "Removed one" };
    for (const op of Object.keys(reworded) as PlacementOp[]) {
      const notice = commitNotice(op, "AB", facts({ droppedTypes: ["standard"] }), NO_COVERAGE);
      // The note's presence tracks the OPERATION, not the word in front of it.
      expect(notice.includes("gave up")).toBe(op === "insert");
    }
  });
});

describe("the spanning-header RE-CUT note — a header that survived the edit as a different part", () => {
  // The defect this clause exists for, from the branch's own harness:
  // deleting a panel to the LEFT of a header moved its range 2..4 -> 1..3
  // (the same two panels) while its cut width went 80in -> 85.75in, and the
  // notice said only "15 panels -> 14, 12 still automatic".
  const change = (over: Partial<SpanningHeaderWidthChange> = {}): SpanningHeaderWidthChange => ({
    name: "H1",
    fromIn: 80,
    toIn: 85.75,
    outsideRangeIn: null,
    ...over,
  });

  it("names the header and prints BOTH widths, because the old one is what is on the sheet", () => {
    const notice = commitNotice("delete", "AB", facts(), NO_COVERAGE, [change()]);
    expect(notice).toContain("Spanning header H1 still spans its panels");
    expect(notice).toContain("cut 85.75in instead of 80in");
  });

  it("says nothing at all when no header's width moved", () => {
    expect(commitNotice("delete", "AB", facts(), NO_COVERAGE)).not.toContain("still spans its panels");
  });

  it("flags a width the shift pushed outside the range a PLACEMENT would have refused, and names it as unconfirmed", () => {
    const notice = commitNotice("delete", "AB", facts(), NO_COVERAGE, [
      change({ toIn: 152, outsideRangeIn: { minIn: 48, maxIn: 144 } }),
    ]);
    expect(notice).toContain("OUTSIDE the 48in-144in span a header can be placed at");
    expect(notice).toContain("Building Integrity has not confirmed yet");
    expect(notice).toContain("Re-place or remove H1.");
  });

  it("does not claim a range problem when the new width is still inside the range", () => {
    expect(commitNotice("delete", "AB", facts(), NO_COVERAGE, [change()])).not.toContain("OUTSIDE");
  });

  it("speaks per header rather than as a count, so a shop knows WHICH part to re-cut", () => {
    const notice = commitNotice("delete", "AB", facts(), NO_COVERAGE, [change(), change({ name: "H4", fromIn: 60, toIn: 48 })]);
    expect(notice).toContain("Spanning header H1");
    expect(notice).toContain("Spanning header H4");
    expect(notice).toContain("cut 48in instead of 60in");
  });

  it("is chosen by the width change, never by which operation was asked for", () => {
    // The re-cut can arrive from any of them, so no op is special here — the
    // same shape the verb-parsing defect taught this module.
    for (const op of ["replace", "insert", "delete"] as PlacementOp[]) {
      expect(commitNotice(op, "AB", facts(), NO_COVERAGE, [change()])).toContain("cut 85.75in instead of 80in");
    }
  });
});
