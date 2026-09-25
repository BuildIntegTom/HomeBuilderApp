import {
  FOLDER_LABEL,
  displayProjectName,
  type AccessRequestStatus,
  type AskStatus,
  type BrowseAccess,
  type BrowseProjectRow,
  type BrowseVersionRow,
  type CloudFolder,
  type DecideStatus,
} from "./cloudTypes";
import { classifyCloudSchemaVersion } from "./schemaOutcome";

/**
 * Stage 4B's words: the Browse the consortium tab, the browse banner, the price
 * gap, the version list, and the refusals — and Stage 4C's, at the end of the
 * file: asking for access, the requester's own list, and the owner's Grant and
 * Decline. Pure, so every string is testable
 * without a browser, and imported by the routes too, so the server's messages
 * and the UI's wording cannot drift apart — the same arrangement
 * `sharingDisplay.ts` has for Stage 3.
 *
 * THE ONE RULE THIS FILE IS HELD TO, AND WHY IT IS A TEST AND NOT A CONVENTION
 * (decision 23, and the plan's "the wording that must go with them"):
 *
 *   NO STRING HERE MAY SAY OR IMPLY THAT THE APP PREVENTS COPYING.
 *
 * Redaction (21) is a guarantee — the price modifier never leaves the server —
 * and may be stated as one. Export blocking (23) is friction: the document has
 * to reach the browser to draw the drawings at all, so anyone with a developer
 * console can lift it out. Hiding Save Project and Export as OBJ removes the
 * easy path, not the possible one. Decision 23 says overstating this once is
 * worse than never claiming it, because it is the kind of promise a company
 * joins on. `browseDisplay.test.ts` asserts the banned phrasings against every
 * exported string in this file.
 */

// ---------------------------------------------------------------------------
// The tab
// ---------------------------------------------------------------------------

export const BROWSE_TAB_LABEL = "Browse the consortium";

/** The line under the tab, before a company is picked. */
export const BROWSE_TAB_LEAD =
  "Every member company's projects, in all three of their folders. Read-only, and costs are not shown.";

export const BROWSE_NO_COMPANIES_MESSAGE =
  "No member companies came back just now. Reload the page and try again.";

export function browseEmptyFolderMessage(companyName: string, folder: CloudFolder): string {
  return `${companyName} has nothing in ${FOLDER_LABEL[folder]}.`;
}

/**
 * The right-hand half of a browse row: whose it is, where they file it, and
 * whether you are getting it in full or with the costs taken out.
 *
 * "Owned by Rare Forms › Current Projects · read-only, costs not shown"
 * "Owned by Building Integrity › Current Projects · you can open this in full"
 */
export function browseRowDetail(row: Pick<BrowseProjectRow, "ownerCompanyName" | "folder" | "access">): string {
  const owner = row.ownerCompanyName.trim().length > 0 ? row.ownerCompanyName : "a company whose name couldn't be read";
  const how = row.access === "full" ? "you can open this in full" : "read-only, costs not shown";
  return `Owned by ${owner} › ${FOLDER_LABEL[row.folder]} · ${how}`;
}

/** The marker on the row itself, matching `browse_projects.access`. */
export function browseAccessBadge(access: BrowseAccess): string {
  return access === "full" ? "full" : "redacted";
}

// ---------------------------------------------------------------------------
// The banner over a browsed design
// ---------------------------------------------------------------------------

/**
 * The plan's own wording, kept word for word because every clause of it was
 * argued for. The last sentence is the honest one: the app does not hand you a
 * copy, and taking one another way is a breach of the TERMS — never a claim
 * that the software stops you.
 */
export function browseBannerLines(projectName: string, ownerCompanyName: string): string[] {
  const owner = ownerCompanyName.trim().length > 0 ? ownerCompanyName : "another member company";
  return [
    `You're viewing ${displayProjectName(projectName)}, owned by ${owner}, as a member of the consortium.`,
    "Costs are not shown. You can print this or save a PDF.",
    "This app doesn't hand you an editable copy — taking one another way is a breach of the terms rather than something the software prevents.",
  ];
}

/** Why Save to cloud, Save Project and the OBJ buttons are not on screen. */
export const BROWSE_EXPORT_ABSENT_NOTE =
  "Saving and the OBJ exports aren't offered on another company's project. Printing and Save as PDF still are.";

/** A grant that arrives while a browsed copy is on screen does not swap it. */
export function browseAccessChangedNote(projectName: string): string {
  return `Your access to ${displayProjectName(projectName)} may have changed since you opened it. What's on screen is still the read-only copy, with costs removed. Open it again to see it as it is now.`;
}

// ---------------------------------------------------------------------------
// The price gap (decision 21, and the flag convention's own rule)
// ---------------------------------------------------------------------------

/** An em dash. Never a 0, never a defaulted 1.0 or 1.3, never a blank cell. */
export const PRICE_GAP = "—";

export const PRICE_REDACTED_NOTE = "Cost is not shown for another company's project.";

/**
 * Open Item 6, Tommy's accepted default: ONE line on the Shipping and Plaster
 * Master cards. Those seven dollar figures are `useState` in the editor and do
 * not round-trip in the document at all, so what a browser sees on those cards
 * is their OWN defaults — not the owner's numbers, and not redacted either,
 * because there was never anything of the owner's there to redact. Said rather
 * than left to be mistaken for the owner's pricing.
 */
export const VIEWER_OWN_DEFAULTS_NOTE =
  "These dollar figures are your own defaults, not this project's owner's. They aren't saved in a project file, so they don't travel with it.";

// ---------------------------------------------------------------------------
// The version list while browsing
// ---------------------------------------------------------------------------

/**
 * Two things Version history shows that the browse path does not, both narrowed
 * in SQL on 2026-09-23 and neither a missing value to paper over:
 *   * no save notes — free text is exactly where a price gets written;
 *   * an author who never set a display name reads "a member of <company>"
 *     rather than their email address.
 */
export const BROWSE_VERSION_LIST_NOTE =
  "Save notes aren't shown on another company's project, and an author who hasn't set a display name is named as a member of their company.";

/**
 * A SECOND line, shown **only on a project the caller can open in full**
 * (`browse_projects.access === "full"` — membership, a grant, or platform
 * admin). Added 2026-09-24 after 4B's review, on Tommy's decision.
 *
 * WHY IT EXISTS. The browse tab has two doors onto one row, and they answer
 * differently on purpose:
 *   * **Open** honours Open Item 2 — a project you can already read opens
 *     through the Stage 2 route, WITH its costs;
 *   * **Versions → Open** goes through `browse_version`, which always redacts,
 *     for every caller including one who owns the project. That is Open Item 7
 *     and decision 20's ownership rule: "another company" means the company you
 *     are ACTING AS is not the owner.
 *
 * Both are defensible and neither leaks — the review confirmed there is no path
 * from either to an owner's costs that should not carry them. **The risk was
 * confusion, not exposure**, so the answer is a sentence rather than a branch:
 * Tommy chose to keep both doors and say so, rather than make one of them
 * behave like the other.
 *
 * It is NOT shown on a `redacted` row, where there is no second door and the
 * sentence would be a puzzle ("open the project itself" does not exist for a
 * project you cannot open in full). `browseDisplay.test.ts` pins that.
 */
export const BROWSE_VERSION_LIST_FULL_ACCESS_NOTE =
  "Versions here always come with costs removed, even on a project you can open in full. Open the project itself to see it with its costs.";

/** The lines above the browse version list, for a row with this access. */
export function browseVersionListNotes(access: BrowseAccess): string[] {
  return access === "full" ? [BROWSE_VERSION_LIST_NOTE, BROWSE_VERSION_LIST_FULL_ACCESS_NOTE] : [BROWSE_VERSION_LIST_NOTE];
}

export interface BrowseVersionRowModel {
  versionId: string;
  versionNumber: number;
  /** "Saved" or "Renamed to 'Smith Residence'". A label only: `kind` is not
   * proof of what changed (supabase/README.md). */
  title: string;
  /** Already masked in SQL when it was an email address. A real masked name is
   * shown as it came back — never blanked, never re-masked here. */
  authorName: string;
  createdAt: string;
  canOpen: boolean;
  /** Set when this version cannot be served at all. There is NO download in
   * its place: Stage 2C's raw file is the untouched stored document, which on
   * this path would be a hole straight through decision 21. */
  cannotShowReason: string | null;
}

/**
 * Why a version cannot be shown across a company line. `redactionKnown` false
 * means the database has no classification row for that file format and
 * `browse_version` will refuse it (SQLSTATE `0A000`) — the fail-closed case.
 * Format 23 is deliberately unclassified, so an older-but-still-openable
 * version is refused here even though your own Version history opens it.
 */
export function browseVersionCannotShowReason(schemaVersion: number, redactionKnown: boolean, currentSchemaVersion: number): string | null {
  if (!redactionKnown) return cannotShowFormatMessage(schemaVersion);
  const outcome = classifyCloudSchemaVersion(schemaVersion, 0, currentSchemaVersion);
  if (outcome.kind === "opens" || outcome.kind === "opens-via-migration") return null;
  if (outcome.kind === "too-new") return "Saved by a newer app version. Reload the page and try again.";
  if (outcome.kind === "unreadable") return "This version's file format wasn't recorded, so it can't be shown.";
  return cannotShowFormatMessage(schemaVersion);
}

export function cannotShowFormatMessage(schemaVersion: number): string {
  return `This version can't be shown (file format ${schemaVersion}). Nothing is offered in its place.`;
}

/** What the browse path answers when the database refuses to serve a version
 * (SQLSTATE `0A000`). NEVER a reason to try the Stage 2 route instead: that
 * route serves the UNTOUCHED stored document, and reaching for it here would
 * go around the redactor entirely. */
export const BROWSE_CANNOT_SHOW_MESSAGE =
  "This version can't be shown. Its file format hasn't been cleared for showing to another company, so nothing was sent.";

export const BROWSE_NOT_FOUND_MESSAGE = "That project version doesn't exist, or you can't browse it.";

export const BROWSE_PROJECT_NOT_FOUND_MESSAGE = "That project doesn't exist, or you can't browse it.";

export const BROWSE_LIST_REFUSED_MESSAGE =
  "Couldn't list the consortium's projects. Your access may have changed; reload the page and try again.";

export function buildBrowseVersionRows(versions: readonly BrowseVersionRow[], currentSchemaVersion: number): BrowseVersionRowModel[] {
  return versions.map((v) => {
    const cannotShowReason = browseVersionCannotShowReason(v.schemaVersion, v.redactionKnown, currentSchemaVersion);
    return {
      versionId: v.versionId,
      versionNumber: v.versionNumber,
      title: v.kind === "rename" ? `Renamed to '${displayProjectName(v.projectName ?? "")}'` : "Saved",
      authorName: v.authorName !== null && v.authorName.trim().length > 0 ? v.authorName : "author not recorded",
      createdAt: v.createdAt,
      canOpen: cannotShowReason === null,
      cannotShowReason,
    };
  });
}

// ---------------------------------------------------------------------------
// Stage 4C: access requests (`collab_requests`) — the one thing in Stage 4
// that writes. Its words live HERE rather than in `sharingDisplay.ts` because
// the handoff puts them here, and because this file's banned-phrasing test
// scans every string literal in it: a request is the other end of browsing,
// and it must not promise anything browsing does not.
//
// A GRANTED REQUEST IS AN ORDINARY STAGE 3 GRANT. `decide_collab_request`
// writes it by calling `share_project_with_person`, so the Shared with us tab,
// the 3C notice and the access list already understand it. Nothing here builds
// a parallel mechanism, and no wording implies one.
// ---------------------------------------------------------------------------

/** The database's own cap (`collab_requests_message_length`, 1–500). */
export const REQUEST_NOTE_MAX_CHARS = 500;

export const ASK_FOR_ACCESS_LABEL = "Ask for access";

export function askForAccessLead(projectName: string, ownerCompanyName: string): string {
  const owner = ownerCompanyName.trim().length > 0 ? ownerCompanyName : "the owner company";
  return `Ask ${owner} to share ${displayProjectName(projectName)} with you. A member of theirs decides.`;
}

/**
 * What a request is and is not, said before it is sent. THREE FACTS, each of
 * which someone would otherwise have to guess at:
 *   * it is personal (Open Item 3, answered): it asks for you, not for your
 *     company, and what comes back is a personal grant;
 *   * a grant is a handoff (decision 24), so the project then opens with its
 *     costs, exactly as any other shared project does;
 *   * there is no email (Stage 3 answer 7) — the answer appears in this app or
 *     nowhere.
 */
export const ASK_FOR_ACCESS_EXPLAINER =
  "This asks for you personally, not for your company. If it's granted, the project appears in Shared with us and opens with its costs, like any other project shared with you. There's no email: the answer shows up in Your access requests.";

export const ASK_NOTE_FIELD_LABEL = "A short note (optional)";

export function askNoteTooLongMessage(used: number): string {
  return `A note can be at most ${REQUEST_NOTE_MAX_CHARS} characters; that one is ${used}. Nothing was sent.`;
}

/**
 * The same refusal WITHOUT a length, for the database's own 22023. The route
 * checks the cap before sending, so this is the belt behind that: reaching it
 * means the length is not known here, and stating one would be inventing a
 * number. A gap rather than a plausible substitute, which is the flag
 * convention's own rule applied to a count.
 */
export const ASK_NOTE_TOO_LONG_MESSAGE = `A note can be at most ${REQUEST_NOTE_MAX_CHARS} characters. Nothing was sent.`;

export function askNoteCharactersLeft(used: number): string {
  return `${Math.max(0, REQUEST_NOTE_MAX_CHARS - used)} characters left`;
}

/**
 * The answers to asking. Every one is a STATUS, not an error — Stage 3's
 * convention, kept (4A as built, item 5). Deliberately NAME-FREE: the route
 * answers with these, and it has no business reading a project's name back out
 * of the database to decorate a status whose subject the caller already knows.
 */
export const ASK_STATUS_MESSAGE: Record<AskStatus, string> = {
  requested: "Your request was sent. You'll see the answer in Your access requests — there's no email.",
  // Stage 3's convention: a second pending request writes nothing at all and
  // says so, rather than quietly making a duplicate row.
  "already-pending":
    "You've already asked for access to this project, and that request is still waiting for an answer. Nothing was sent again.",
  "already-has-access": "You can already open this project, so nothing was sent.",
};

/** 42501 on the ask path: one uniform answer for "no such project", "not in
 * your browse set" and "not entitled", so asking cannot probe for project ids. */
export const ASK_REFUSED_MESSAGE = "That project doesn't exist, or you can't ask about it. Nothing was sent.";

export const ASK_UNATTRIBUTABLE_MESSAGE =
  "That request couldn't be recorded because your account has no name or email. Nothing was sent.";

// --- The requester's own list ----------------------------------------------

export const MY_REQUESTS_HEADING = "Your access requests";

export const MY_REQUESTS_EMPTY_MESSAGE = "You haven't asked anyone for access to a project.";

/**
 * A project this account asked about but can no longer browse — its owner left
 * the consortium, or this account's own entitlement changed. THE NAME IS NOT
 * SERVED IN THAT CASE: the requester's list is resolved against
 * `browse_projects()` and nothing else, so it can never show more than the
 * browse tab would.
 */
export const REQUEST_PROJECT_UNKNOWN_NAME = "a project you can no longer browse";

/**
 * "Declined" is all a decline says. Open Item 4, answered: no free-text reason,
 * because a reason invites a negotiation the app cannot host. Who and when are
 * shown; why is not, and there is nothing recorded to show.
 */
export function myRequestStatusLine(row: { status: AccessRequestStatus; decidedByName: string | null }): string {
  if (row.status === "pending") return "Waiting for an answer.";
  const who = row.decidedByName !== null && row.decidedByName.trim().length > 0 ? row.decidedByName : null;
  if (row.status === "granted") {
    return who
      ? `Granted by ${who}. It's in Shared with us now, and it opens with its costs.`
      : "Granted. It's in Shared with us now, and it opens with its costs.";
  }
  return who ? `Declined by ${who}. No reason is recorded.` : "Declined. No reason is recorded.";
}

export const MY_REQUESTS_REFUSED_MESSAGE = "Couldn't list your access requests just now. Reload the page and try again.";

// --- The owner's side, in the existing Access… note -------------------------

/** The heading above the grant rows, owner-side only. */
export const PENDING_REQUESTS_HEADING = "Asked for access";

export const PENDING_REQUESTS_NOTE =
  "Granting shares this project with that person, exactly as the box below would. You can remove it afterwards like any other share.";

export function pendingRequestRowTitle(requestedByName: string): string {
  const who = requestedByName.trim().length > 0 ? requestedByName : "someone whose name couldn't be read";
  return `${who} asked for access`;
}

export function pendingRequestNoteLine(message: string | null): string | null {
  if (message === null || message.trim().length === 0) return null;
  return `Note: ${message}`;
}

export const GRANT_REQUEST_LABEL = "Grant";
export const DECLINE_REQUEST_LABEL = "Decline";

/**
 * The answers to deciding. `shared`, `already-shared`, `already-member` and
 * `self` are all `share_project_with_person`'s own statuses, forwarded: in
 * every one of them the requester can now read the project, so the request is
 * closed as granted (4A as built, item 5).
 */
export const DECIDE_STATUS_MESSAGE: Record<DecideStatus, string> = {
  shared: "Granted. It's an ordinary share now — it's in the list below, and you can remove it like any other.",
  "already-shared": "They already had access from another share, so nothing new was written. The request is closed.",
  "already-member": "They've since joined this project's owner company, so they can already open it. The request is closed.",
  // `self` is 0008's `v_grantee = auth.uid()`: the person who asked IS the
  // caller. Not `already-member`'s situation, which is about somebody else.
  self: "You're the person who asked — you've since joined this project's owner company, so you can already open it. The request is closed.",
  declined: "Declined. They'll see that it was declined, with no reason attached. Nothing was shared.",
  "already-granted": "That request had already been granted. Nothing was changed.",
  "already-declined": "That request had already been declined. Nothing was changed.",
};

/** 42501 on the decide path: not a member of the owner company, not a platform
 * admin, or no such request — one answer for all three. */
export const DECIDE_REFUSED_MESSAGE = "That request doesn't exist, or you can't decide it. Nothing was changed.";

export const DECIDE_GRANT_REQUIRED_MESSAGE = "Say whether to grant or decline. Nothing was changed.";

export const DECIDE_UNATTRIBUTABLE_MESSAGE =
  "That decision couldn't be recorded because an account has no name or email. Nothing was changed.";

/**
 * What a browse row says about a request this account has already made on it,
 * and whether Ask for access is offered again.
 *
 * Re-asking after a DECISION is allowed and writes a new row (0009's partial
 * unique index covers pending rows only): with no notification channel there is
 * nothing to spam. Re-asking while one is still PENDING is not offered, because
 * the database would answer `already-pending` and write nothing.
 */
export function browseRowRequestState(
  requests: readonly { projectId: string; status: AccessRequestStatus }[] | null,
  projectId: string,
): { line: string | null; canAsk: boolean } {
  if (requests === null) return { line: null, canAsk: true };
  const mine = requests.filter((r) => r.projectId === projectId);
  if (mine.some((r) => r.status === "pending")) return { line: "You've asked for access — waiting for an answer.", canAsk: false };
  if (mine.some((r) => r.status === "granted")) return { line: "Access was granted; it's in Shared with us.", canAsk: true };
  if (mine.length > 0) return { line: "Your earlier request was declined. You can ask again.", canAsk: true };
  return { line: null, canAsk: true };
}
