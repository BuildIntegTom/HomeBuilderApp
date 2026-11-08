import { describe, expect, it } from "vitest";
import {
  TUTORIALS,
  TUTORIAL_MEMORY_NOTE,
  TUTORIAL_TOOL_IDS,
  TUTORIALS_SEEN_STORAGE_KEY,
  markTutorialSeen,
  mergeTutorialsSeen,
  parseTutorialsSeen,
  serialiseTutorialsSeen,
  shouldShowTutorial,
  type TutorialToolId,
  type TutorialsSeen,
} from "./tutorials";

describe("a tutorial shows until it has been seen at its current version", () => {
  it("shows the first time, for every tool", () => {
    for (const id of TUTORIAL_TOOL_IDS) {
      expect(shouldShowTutorial({}, id), `${id} should show to a new browser`).toBe(true);
    }
  });

  it("stops showing once it is dismissed", () => {
    for (const id of TUTORIAL_TOOL_IDS) {
      expect(shouldShowTutorial(markTutorialSeen({}, id), id)).toBe(false);
    }
  });

  it("⚠ comes back when the tool changes and its version is bumped", () => {
    const id: TutorialToolId = "panel-editor";
    const seen = markTutorialSeen({}, id);
    expect(shouldShowTutorial(seen, id)).toBe(false);
    /* The next version of the tool, as `TUTORIALS[id].version + 1` would be. */
    const stale: TutorialsSeen = { ...seen, [id]: TUTORIALS[id].version - 1 };
    expect(shouldShowTutorial(stale, id)).toBe(true);
  });

  it("dismissing one tool's cards does not dismiss another's", () => {
    const seen = markTutorialSeen({}, "panel-menu");
    expect(shouldShowTutorial(seen, "panel-menu")).toBe(false);
    expect(shouldShowTutorial(seen, "panel-editor")).toBe(true);
    expect(shouldShowTutorial(seen, "panelizer")).toBe(true);
  });

  it("⚠ a boolean would not have worked, which is why the stored value is a number", () => {
    /* `true` loses the one fact the feature needs: WHICH version was read. */
    for (const id of TUTORIAL_TOOL_IDS) {
      expect(typeof markTutorialSeen({}, id)[id]).toBe("number");
    }
  });
});

describe("⚠ reading storage never throws and never trusts what it finds", () => {
  it("an empty or missing value means seen nothing", () => {
    expect(parseTutorialsSeen(null)).toEqual({});
    expect(parseTutorialsSeen("")).toEqual({});
  });

  it.each([
    ["not json at all", "{{{"],
    ["an array", "[1,2,3]"],
    ["a bare string", '"panel-editor"'],
    ["a number", "7"],
    ["null", "null"],
    ["a boolean", "true"],
  ])("%s is discarded rather than crashing the app on load", (_name, raw) => {
    expect(parseTutorialsSeen(raw)).toEqual({});
  });

  it("keeps the good entries out of a half-bad object", () => {
    const raw = JSON.stringify({
      "panel-editor": 2,
      "panel-menu": true,
      panelizer: "yes",
      other: null,
      negative: -4,
      zero: 0,
      fractional: 2.7,
      huge: Number.POSITIVE_INFINITY,
    });
    expect(parseTutorialsSeen(raw)).toEqual({ "panel-editor": 2, fractional: 2 });
  });

  it("⚠ an unknown tool id survives rather than being dropped", () => {
    /* A browser that saw a tutorial this build has since renamed should not
       have that record thrown away: the rename might come back, and the cost
       of keeping it is one key. */
    expect(parseTutorialsSeen(JSON.stringify({ "a-tool-from-the-future": 3 }))).toEqual({
      "a-tool-from-the-future": 3,
    });
  });

  it("round-trips anything it accepted", () => {
    const seen: TutorialsSeen = { "panel-menu": 1, "panel-editor": 4, panelizer: 2 };
    expect(parseTutorialsSeen(serialiseTutorialsSeen(seen))).toEqual(seen);
  });

  it("the key is namespaced, because it shares an origin with everything else", () => {
    expect(TUTORIALS_SEEN_STORAGE_KEY.startsWith("bi.")).toBe(true);
  });
});

describe("⚠ merging takes the higher version per tool", () => {
  it("anything dismissed signed out stays dismissed signed in", () => {
    const local = markTutorialSeen({}, "panel-menu");
    const account: TutorialsSeen = {};
    expect(mergeTutorialsSeen(local, account)["panel-menu"]).toBe(TUTORIALS["panel-menu"].version);
  });

  it("anything dismissed on another machine does not come back here", () => {
    const local: TutorialsSeen = {};
    const account = markTutorialSeen({}, "panelizer");
    expect(shouldShowTutorial(mergeTutorialsSeen(local, account), "panelizer")).toBe(false);
  });

  it("⚠ the HIGHER version wins, not whichever was loaded last", () => {
    expect(mergeTutorialsSeen({ x: 5 }, { x: 2 })).toEqual({ x: 5 });
    expect(mergeTutorialsSeen({ x: 2 }, { x: 5 })).toEqual({ x: 5 });
  });

  it("is commutative and idempotent, so the order of two loads cannot matter", () => {
    const a: TutorialsSeen = { "panel-menu": 3, panelizer: 1 };
    const b: TutorialsSeen = { "panel-menu": 1, "panel-editor": 2 };
    expect(mergeTutorialsSeen(a, b)).toEqual(mergeTutorialsSeen(b, a));
    expect(mergeTutorialsSeen(mergeTutorialsSeen(a, b), a)).toEqual(mergeTutorialsSeen(a, b));
  });

  it("neither side is mutated — a merge must not edit the thing it read", () => {
    const a: TutorialsSeen = { x: 1 };
    const b: TutorialsSeen = { x: 9 };
    mergeTutorialsSeen(a, b);
    expect(a).toEqual({ x: 1 });
    expect(b).toEqual({ x: 9 });
  });
});

describe("⚠ the writing is the work: every tutorial is actually written", () => {
  it("there are exactly three tools, and the inventory matches the content", () => {
    expect(TUTORIAL_TOOL_IDS).toHaveLength(3);
    expect([...TUTORIAL_TOOL_IDS].sort()).toEqual(Object.keys(TUTORIALS).sort());
  });

  it("each tool has its id, its own name, and a version that starts at one or more", () => {
    for (const id of TUTORIAL_TOOL_IDS) {
      const tutorial = TUTORIALS[id];
      expect(tutorial.id).toBe(id);
      expect(tutorial.tool.length).toBeGreaterThan(3);
      expect(Number.isInteger(tutorial.version)).toBe(true);
      expect(tutorial.version).toBeGreaterThanOrEqual(1);
    }
  });

  it("⚠ THREE cards each — the teardown asked for three, not 'some'", () => {
    for (const id of TUTORIAL_TOOL_IDS) {
      expect(TUTORIALS[id].cards, `${id} must have three cards`).toHaveLength(3);
    }
  });

  it("every card has a title, a body that says something, and its own art", () => {
    const seenArt = new Set<string>();
    for (const id of TUTORIAL_TOOL_IDS) {
      for (const card of TUTORIALS[id].cards) {
        expect(card.title.length, `${id}: "${card.title}" is too short to be a title`).toBeGreaterThan(8);
        expect(card.body.length, `${id}: "${card.title}" has too little body`).toBeGreaterThan(80);
        /* ⚠ Short enough to read standing up. The teardown's own rule is
           "not a manual"; a card nobody finishes teaches nothing. */
        expect(card.body.length, `${id}: "${card.title}" is a manual, not a card`).toBeLessThan(420);
        seenArt.add(card.art);
      }
    }
    /* Nine cards, nine different schematics — a repeated picture means one of
       them is not illustrating its own card. */
    expect(seenArt.size).toBe(9);
  });

  it("no card title is reused, so the dots and the Back button are never ambiguous", () => {
    const titles = TUTORIAL_TOOL_IDS.flatMap((id) => TUTORIALS[id].cards.map((c) => c.title));
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("⚠ the memory note states the limits rather than only the promise", () => {
    const note = TUTORIAL_MEMORY_NOTE.toLowerCase();
    for (const limit of ["another browser", "another machine", "private window", "clearing site data"]) {
      expect(note, `the note must admit it does not survive ${limit}`).toContain(limit);
    }
    /* And it says how to get the cards back, because a tutorial you cannot
       reopen is one you resent dismissing. */
    expect(note).toContain("reopen");
  });
});
