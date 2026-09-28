import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CHROME_NOTE_IDS, isChromeNoteId } from "./chromeNotes";

describe("CHROME_NOTE_IDS", () => {
  it("is exactly the two ids U0 added, and nothing else", () => {
    expect([...CHROME_NOTE_IDS]).toEqual(["read-me", "report-bug"]);
  });

  it("does not claim selected-panel, which is docked and selection-driven", () => {
    // A third id in no collection, but pre-existing and not chrome in the
    // same sense. Recorded in the doc comment; pinned here so "tidying" it
    // into the list is a decision rather than an edit.
    expect(isChromeNoteId("selected-panel")).toBe(false);
  });

  it("does not claim any id the tray or the packet lists", () => {
    for (const id of ["detail-summary", "project-totals", "review-log", "detail-material-totals"]) {
      expect(isChromeNoteId(id)).toBe(false);
    }
  });

  it("names ids that page.tsx really renders as notes", () => {
    // The whole value of the constant is that it matches the app. If a note
    // id is renamed in page.tsx and not here, the name stops being a
    // description of anything — which is the failure this constant exists
    // to prevent, so it is asserted rather than assumed.
    const page = readFileSync(join(__dirname, "page.tsx"), "utf8");
    for (const id of CHROME_NOTE_IDS) {
      expect(page).toMatch(new RegExp(`<StickyNote\\s+id="${id}"`));
    }
  });
});
