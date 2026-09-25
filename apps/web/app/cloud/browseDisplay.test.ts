import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PROJECT_FILE_VERSION } from "../projectFile";
import {
  ASK_FOR_ACCESS_EXPLAINER,
  ASK_FOR_ACCESS_LABEL,
  ASK_NOTE_FIELD_LABEL,
  ASK_REFUSED_MESSAGE,
  ASK_STATUS_MESSAGE,
  BROWSE_CANNOT_SHOW_MESSAGE,
  BROWSE_EXPORT_ABSENT_NOTE,
  BROWSE_TAB_LABEL,
  BROWSE_TAB_LEAD,
  DECIDE_STATUS_MESSAGE,
  MY_REQUESTS_EMPTY_MESSAGE,
  MY_REQUESTS_HEADING,
  PENDING_REQUESTS_HEADING,
  PENDING_REQUESTS_NOTE,
  REQUEST_NOTE_MAX_CHARS,
  BROWSE_VERSION_LIST_FULL_ACCESS_NOTE,
  BROWSE_VERSION_LIST_NOTE,
  PRICE_GAP,
  PRICE_REDACTED_NOTE,
  VIEWER_OWN_DEFAULTS_NOTE,
  askForAccessLead,
  askNoteCharactersLeft,
  askNoteTooLongMessage,
  browseAccessBadge,
  browseBannerLines,
  browseEmptyFolderMessage,
  browseRowDetail,
  browseVersionCannotShowReason,
  browseVersionListNotes,
  buildBrowseVersionRows,
  cannotShowFormatMessage,
  pendingRequestNoteLine,
  pendingRequestRowTitle,
} from "./browseDisplay";
import { consortiumFolderTabsMessage, consortiumMenuMessage, type BrowseVersionRow } from "./cloudTypes";

const displaySource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "browseDisplay.ts"), "utf8");

describe("the tab and its rows", () => {
  it("is named as the plan names it, and cloudTypes' own copy of the name agrees", () => {
    expect(BROWSE_TAB_LABEL).toBe("Browse the consortium");
    // cloudTypes.ts imports nothing, so it spells the tab's name itself. If
    // the two ever drift, the two replaced consortium messages would point at
    // a tab that is not called that.
    expect(consortiumFolderTabsMessage("X")).toContain(BROWSE_TAB_LABEL);
    expect(consortiumMenuMessage("X")).toContain(BROWSE_TAB_LABEL);
  });

  it("the lead says read-only and costs-not-shown before anything is opened", () => {
    expect(BROWSE_TAB_LEAD).toMatch(/Read-only/);
    expect(BROWSE_TAB_LEAD).toMatch(/costs are not shown/i);
    expect(BROWSE_TAB_LEAD).toMatch(/all three of their folders/);
  });

  it("a redacted row reads the plan's own line: owner, folder, read-only, costs not shown", () => {
    expect(browseRowDetail({ ownerCompanyName: "Rare Forms", folder: "current", access: "redacted" })).toBe(
      "Owned by Rare Forms › Current Projects · read-only, costs not shown",
    );
  });

  it("a full row says you can open it in full instead", () => {
    expect(browseRowDetail({ ownerCompanyName: "Building Integrity", folder: "proposals", access: "full" })).toBe(
      "Owned by Building Integrity › Proposals · you can open this in full",
    );
  });

  it("a blank owner name is a visible gap, not an empty space in the sentence", () => {
    expect(browseRowDetail({ ownerCompanyName: "  ", folder: "past", access: "redacted" })).toMatch(
      /Owned by a company whose name couldn't be read/,
    );
  });

  it("marks each row exactly as browse_projects.access does", () => {
    expect(browseAccessBadge("full")).toBe("full");
    expect(browseAccessBadge("redacted")).toBe("redacted");
  });

  it("an empty folder names the company and the folder rather than saying nothing", () => {
    expect(browseEmptyFolderMessage("New Frameworks", "past")).toBe("New Frameworks has nothing in Past Projects.");
  });
});

describe("the banner (decision 23's honest wording)", () => {
  const lines = browseBannerLines("Smith House", "Rare Forms");

  it("is the plan's three sentences, word for word", () => {
    expect(lines).toEqual([
      "You're viewing Smith House, owned by Rare Forms, as a member of the consortium.",
      "Costs are not shown. You can print this or save a PDF.",
      "This app doesn't hand you an editable copy — taking one another way is a breach of the terms rather than something the software prevents.",
    ]);
  });

  it("ends by calling a copy a breach of the TERMS, not something the software stops", () => {
    expect(lines[2]).toMatch(/breach of the terms/);
    expect(lines[2]).toMatch(/rather than something the software prevents/);
  });

  it("keeps printing and PDF on the record (23 allows both)", () => {
    expect(lines[1]).toMatch(/print this or save a PDF/);
  });

  it("names an unreadable owner as a member company rather than leaving a hole", () => {
    expect(browseBannerLines("Smith House", "")[0]).toMatch(/owned by another member company/);
  });

  it("shows an empty project name as (untitled), never a blank", () => {
    expect(browseBannerLines("", "Rare Forms")[0]).toMatch(/You're viewing \(untitled\)/);
  });
});

/**
 * THE BANNED-PHRASING ASSERTION, which the plan asks for by name.
 *
 * Redaction (21) is a guarantee and may be stated as one. Export blocking (23)
 * is friction and must never be: the document reaches the browser to draw the
 * drawings at all, so hiding Save Project and Export as OBJ removes the easy
 * path, not the possible one. Decision 23: "Do not describe this to a joining
 * company as a guarantee, and do not let a summary, a marketing page, or an
 * onboarding email say 'other companies cannot take your files.'"
 */
describe("no string in this file claims the app prevents copying", () => {
  const banned = [
    /cannot take your files/i,
    /can't take your files/i,
    /copy[- ]protected/i,
    /your designs are protected/i,
    /\bprotected\b/i,
    /\bsecure(ly)?\b/i,
    /prevents? (you|them|anyone) from (copying|taking)/i,
    /can't be copied/i,
    /cannot be copied/i,
    /stops? (you|them|anyone) (from )?(copying|taking)/i,
  ];

  const strings: string[] = [
    BROWSE_TAB_LABEL,
    BROWSE_TAB_LEAD,
    BROWSE_VERSION_LIST_NOTE,
    BROWSE_VERSION_LIST_FULL_ACCESS_NOTE,
    BROWSE_CANNOT_SHOW_MESSAGE,
    BROWSE_EXPORT_ABSENT_NOTE,
    PRICE_GAP,
    PRICE_REDACTED_NOTE,
    VIEWER_OWN_DEFAULTS_NOTE,
    ...browseBannerLines("Smith House", "Rare Forms"),
    browseRowDetail({ ownerCompanyName: "Rare Forms", folder: "current", access: "redacted" }),
    browseRowDetail({ ownerCompanyName: "Rare Forms", folder: "current", access: "full" }),
    browseEmptyFolderMessage("Rare Forms", "current"),
    cannotShowFormatMessage(23),
    // Stage 4C's own strings. A request is the other end of browsing, and it
    // must not promise anything browsing does not.
    ASK_FOR_ACCESS_LABEL,
    ASK_FOR_ACCESS_EXPLAINER,
    ASK_NOTE_FIELD_LABEL,
    ASK_REFUSED_MESSAGE,
    MY_REQUESTS_HEADING,
    MY_REQUESTS_EMPTY_MESSAGE,
    PENDING_REQUESTS_HEADING,
    PENDING_REQUESTS_NOTE,
    ...Object.values(ASK_STATUS_MESSAGE),
    ...Object.values(DECIDE_STATUS_MESSAGE),
    askForAccessLead("Smith House", "Rare Forms"),
    askNoteTooLongMessage(501),
    pendingRequestRowTitle("Mo"),
  ];

  it.each(banned.map((pattern) => [String(pattern)] as const))("no exported string matches %s", (pattern) => {
    const re = banned.find((b) => String(b) === pattern)!;
    for (const line of strings) expect(line).not.toMatch(re);
  });

  it("catches a banned phrase anywhere in the FILE, including a string this test forgot to list", () => {
    // Every quoted string literal in browseDisplay.ts, not only the ones named
    // above: a string added later without being added here is still covered.
    const literals = [...displaySource.matchAll(/"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map((m) => m[1] ?? m[2] ?? "");
    for (const literal of literals) {
      // The file's own doc comments quote the banned phrasings in order to ban
      // them; comments are not strings, so they are not scanned here.
      for (const re of banned) expect(literal).not.toMatch(re);
    }
  });

  it("states the redaction guarantee plainly, which IS allowed", () => {
    // The asymmetry is the point: 21 may be stated, 23 may not.
    expect(PRICE_REDACTED_NOTE).toBe("Cost is not shown for another company's project.");
  });
});

describe("the price gap", () => {
  it("is an em dash, not a zero and not a blank", () => {
    expect(PRICE_GAP).toBe("—");
    expect(PRICE_GAP).not.toBe("");
    expect(PRICE_GAP).not.toMatch(/0|\$/);
  });

  it("carries a reason, so the gap is explained rather than merely empty", () => {
    expect(PRICE_REDACTED_NOTE).toMatch(/another company's project/);
  });
});

describe("the Shipping and Plaster line (Open Item 6)", () => {
  it("says those dollars are the viewer's own, not the owner's", () => {
    expect(VIEWER_OWN_DEFAULTS_NOTE).toMatch(/your own defaults/);
    expect(VIEWER_OWN_DEFAULTS_NOTE).toMatch(/not this project's owner's/);
    // And why, honestly: they are not in the document at all, so there was
    // never anything of the owner's here to redact.
    expect(VIEWER_OWN_DEFAULTS_NOTE).toMatch(/aren't saved in a project file/);
  });

  it("does not claim they were redacted, because they were not", () => {
    expect(VIEWER_OWN_DEFAULTS_NOTE).not.toMatch(/redact|removed|hidden/i);
  });
});

describe("which versions can be shown", () => {
  it("shows a current-format version whose format the redactor knows", () => {
    expect(browseVersionCannotShowReason(PROJECT_FILE_VERSION, true, PROJECT_FILE_VERSION)).toBeNull();
  });

  it("REFUSES the one-version-back format, because the redactor has no classification for it", () => {
    // Format 23 opens fine in your own Version history and is refused across a
    // company line. That pair is hand-test step 21.
    expect(browseVersionCannotShowReason(PROJECT_FILE_VERSION - 1, false, PROJECT_FILE_VERSION)).toBe(
      cannotShowFormatMessage(PROJECT_FILE_VERSION - 1),
    );
  });

  it("refuses an unclassified format even when it is inside this app's parse window", () => {
    expect(browseVersionCannotShowReason(PROJECT_FILE_VERSION, false, PROJECT_FILE_VERSION)).not.toBeNull();
  });

  it("says to reload for a format from a newer app version", () => {
    expect(browseVersionCannotShowReason(PROJECT_FILE_VERSION + 1, true, PROJECT_FILE_VERSION)).toMatch(/Reload the page/);
  });

  it("offers nothing in place of a version it cannot show", () => {
    // Said as an assertion because Stage 2C's honest raw download, copied here,
    // would be a hole straight through decision 21.
    expect(cannotShowFormatMessage(23)).toMatch(/Nothing is offered in its place/);
    expect(cannotShowFormatMessage(23)).not.toMatch(/download/i);
    expect(BROWSE_CANNOT_SHOW_MESSAGE).not.toMatch(/download/i);
  });

  it("the refusal message never suggests trying another route", () => {
    // 0A000 is final. Falling back to the Stage 2 read would serve the
    // untouched stored document across a company line.
    expect(BROWSE_CANNOT_SHOW_MESSAGE).toMatch(/nothing was sent/i);
    expect(BROWSE_CANNOT_SHOW_MESSAGE).not.toMatch(/try|instead|another way/i);
  });
});

describe("buildBrowseVersionRows", () => {
  const row = (overrides: Partial<BrowseVersionRow> = {}): BrowseVersionRow => ({
    versionId: "v1",
    versionNumber: 3,
    parentVersionId: null,
    kind: "save",
    label: null,
    authorName: "Frank",
    createdAt: "2026-09-14T13:00:00+00:00",
    schemaVersion: PROJECT_FILE_VERSION,
    redactionKnown: true,
    projectName: "Smith House",
    ...overrides,
  });

  it("labels a save and a rename, without claiming a rename changed only the name", () => {
    expect(buildBrowseVersionRows([row()], PROJECT_FILE_VERSION)[0].title).toBe("Saved");
    expect(buildBrowseVersionRows([row({ kind: "rename" })], PROJECT_FILE_VERSION)[0].title).toBe("Renamed to 'Smith House'");
  });

  it("shows a masked author name AS IT CAME BACK — never blanked, never re-masked", () => {
    // "a member of Rare Forms" is what browse_author_name returns for an
    // author who never set a display name. It is a real value.
    const rows = buildBrowseVersionRows([row({ authorName: "a member of Rare Forms" })], PROJECT_FILE_VERSION);
    expect(rows[0].authorName).toBe("a member of Rare Forms");
  });

  it("shows a genuinely absent author as a visible gap", () => {
    expect(buildBrowseVersionRows([row({ authorName: null })], PROJECT_FILE_VERSION)[0].authorName).toBe("author not recorded");
    expect(buildBrowseVersionRows([row({ authorName: "   " })], PROJECT_FILE_VERSION)[0].authorName).toBe("author not recorded");
  });

  it("carries no label field at all, because the browse path never serves one", () => {
    const rows = buildBrowseVersionRows([row()], PROJECT_FILE_VERSION);
    expect(rows[0]).not.toHaveProperty("label");
    // And the note says so, rather than leaving a row that looks like a save
    // with no note when the note exists and is withheld.
    expect(BROWSE_VERSION_LIST_NOTE).toMatch(/Save notes aren't shown/);
    expect(BROWSE_VERSION_LIST_NOTE).toMatch(/named as a member of their company/);
  });

  // -------------------------------------------------------------------------
  // The two doors, and the line that says so (Tommy's decision, 2026-09-24)
  // -------------------------------------------------------------------------

  it("a FULL row's version list carries the second line, word for word", () => {
    expect(browseVersionListNotes("full")).toEqual([
      BROWSE_VERSION_LIST_NOTE,
      "Versions here always come with costs removed, even on a project you can open in full. Open the project itself to see it with its costs.",
    ]);
    expect(BROWSE_VERSION_LIST_FULL_ACCESS_NOTE).toBe(browseVersionListNotes("full")[1]);
  });

  it("a REDACTED row does NOT get it — there is no second door there to explain", () => {
    // "Open the project itself to see it with its costs" is a puzzle on a row
    // whose Open also redacts. The line would create the confusion it exists
    // to remove.
    expect(browseVersionListNotes("redacted")).toEqual([BROWSE_VERSION_LIST_NOTE]);
    expect(browseVersionListNotes("redacted")).not.toContain(BROWSE_VERSION_LIST_FULL_ACCESS_NOTE);
  });

  it("the second line names BOTH doors and promises nothing about the redacted one", () => {
    expect(BROWSE_VERSION_LIST_FULL_ACCESS_NOTE).toMatch(/always come with costs removed/);
    expect(BROWSE_VERSION_LIST_FULL_ACCESS_NOTE).toMatch(/even on a project you can open in full/);
    expect(BROWSE_VERSION_LIST_FULL_ACCESS_NOTE).toMatch(/Open the project itself/);
    // It describes what the app does; it claims nothing about what it prevents.
    expect(BROWSE_VERSION_LIST_FULL_ACCESS_NOTE).not.toMatch(/cannot take|can't take|copy-protected|protected|secure|prevent/i);
  });

  it("offers no download on a row it cannot show, only the fact that it cannot", () => {
    const rows = buildBrowseVersionRows([row({ schemaVersion: 23, redactionKnown: false })], PROJECT_FILE_VERSION);
    expect(rows[0].canOpen).toBe(false);
    expect(rows[0].cannotShowReason).toBe(cannotShowFormatMessage(23));
    expect(rows[0]).not.toHaveProperty("offerDownload");
  });
});

/**
 * Stage 4C's words. The rules they are held to are Tommy's own decisions and
 * the plan's, not taste:
 *   * a request is PERSONAL (Open Item 3) and the wording says so;
 *   * a DECLINE CARRIES NO REASON (Open Item 4) — the requester sees
 *     "Declined", and there is no reason recorded to show;
 *   * a second pending request writes NOTHING (Stage 3's convention), and the
 *     answer says that rather than implying a duplicate was made;
 *   * a granted request becomes an ORDINARY STAGE 3 GRANT, so the wording
 *     points at Shared with us rather than at a new place.
 */
describe("asking for access (4C)", () => {
  it("says a request is personal, not on behalf of the company", () => {
    expect(ASK_FOR_ACCESS_EXPLAINER).toMatch(/for you personally, not for your company/);
  });

  it("says a grant is a handoff: the project then opens with its costs", () => {
    expect(ASK_FOR_ACCESS_EXPLAINER).toMatch(/Shared with us/);
    expect(ASK_FOR_ACCESS_EXPLAINER).toMatch(/opens with its costs/);
  });

  it("says there is no email, because there is none (Stage 3 answer 7)", () => {
    expect(ASK_FOR_ACCESS_EXPLAINER).toMatch(/There's no email/);
    expect(ASK_STATUS_MESSAGE.requested).toMatch(/there's no email/i);
  });

  it("names the owner company in the lead, and a gap when it has no name", () => {
    expect(askForAccessLead("Smith House", "Rare Forms")).toBe("Ask Rare Forms to share Smith House with you. A member of theirs decides.");
    expect(askForAccessLead("Smith House", "  ")).toMatch(/Ask the owner company/);
  });

  it("a second pending request says nothing was sent again, rather than implying a duplicate", () => {
    expect(ASK_STATUS_MESSAGE["already-pending"]).toMatch(/still waiting for an answer/);
    expect(ASK_STATUS_MESSAGE["already-pending"]).toMatch(/Nothing was sent again/);
  });

  it("asking about something you can already read says nothing was sent", () => {
    expect(ASK_STATUS_MESSAGE["already-has-access"]).toMatch(/nothing was sent/);
  });

  it("the note cap is the database's own 500, and the refusal names both numbers", () => {
    expect(REQUEST_NOTE_MAX_CHARS).toBe(500);
    expect(askNoteTooLongMessage(501)).toBe("A note can be at most 500 characters; that one is 501. Nothing was sent.");
    expect(askNoteCharactersLeft(0)).toBe("500 characters left");
    expect(askNoteCharactersLeft(500)).toBe("0 characters left");
    // Never a negative count: over the cap it reads 0 and the refusal says the rest.
    expect(askNoteCharactersLeft(700)).toBe("0 characters left");
  });

  it("the refusal is one answer for not-found and not-yours, and says nothing was sent", () => {
    expect(ASK_REFUSED_MESSAGE).toMatch(/doesn't exist, or you can't ask about it/);
    expect(ASK_REFUSED_MESSAGE).toMatch(/Nothing was sent/);
  });
});

describe("deciding, and what the requester is told (4C)", () => {
  it("a decline says nothing was shared, and carries no reason", () => {
    expect(DECIDE_STATUS_MESSAGE.declined).toMatch(/no reason attached/);
    expect(DECIDE_STATUS_MESSAGE.declined).toMatch(/Nothing was shared/);
  });

  it("a grant is described as the ordinary share it is, removable like any other", () => {
    expect(DECIDE_STATUS_MESSAGE.shared).toMatch(/ordinary share/);
    expect(DECIDE_STATUS_MESSAGE.shared).toMatch(/remove it like any other/);
  });

  /**
   * `self` and `already-member` are different events and must not read alike.
   * 0008 returns `self` when `v_grantee = auth.uid()` — the person who asked
   * IS the decider — and `already-member` when somebody else has joined the
   * owner company. The first build described the second on both.
   */
  it("`self` says the DECIDER is the person who asked; `already-member` says somebody else is", () => {
    expect(DECIDE_STATUS_MESSAGE.self).toMatch(/^You're the person who asked/);
    expect(DECIDE_STATUS_MESSAGE.self).not.toMatch(/\bthey\b/i);
    expect(DECIDE_STATUS_MESSAGE["already-member"]).toMatch(/^They've since joined/);
    expect(DECIDE_STATUS_MESSAGE["already-member"]).not.toMatch(/you're the person who asked/i);
    // Both still close the request, because in both the requester can read it.
    for (const s of ["self", "already-member"] as const) expect(DECIDE_STATUS_MESSAGE[s]).toMatch(/The request is closed\./);
  });

  it("every decide status has words of its own — none falls back to another's", () => {
    const messages = Object.values(DECIDE_STATUS_MESSAGE);
    expect(new Set(messages).size).toBe(messages.length);
    for (const m of messages) expect(m.length).toBeGreaterThan(0);
  });

  it("the owner's heading and note sit above the grant rows and explain what Grant does", () => {
    expect(PENDING_REQUESTS_HEADING).toBe("Asked for access");
    expect(PENDING_REQUESTS_NOTE).toMatch(/shares this project with that person/);
    expect(PENDING_REQUESTS_NOTE).toMatch(/remove it afterwards/);
  });

  it("a request row names who asked, and shows a gap rather than an empty space", () => {
    expect(pendingRequestRowTitle("Mo Fieser")).toBe("Mo Fieser asked for access");
    expect(pendingRequestRowTitle("   ")).toMatch(/someone whose name couldn't be read/);
  });

  it("an empty note is no note at all, not an empty 'Note:' line", () => {
    expect(pendingRequestNoteLine(null)).toBeNull();
    expect(pendingRequestNoteLine("   ")).toBeNull();
    expect(pendingRequestNoteLine("We'd like to reuse the truss layout")).toBe("Note: We'd like to reuse the truss layout");
  });

  it("the requester's list is headed plainly and says so when it is empty", () => {
    expect(MY_REQUESTS_HEADING).toBe("Your access requests");
    expect(MY_REQUESTS_EMPTY_MESSAGE).toMatch(/haven't asked/);
  });
});
