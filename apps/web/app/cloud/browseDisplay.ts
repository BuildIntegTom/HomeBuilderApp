import { FOLDER_LABEL, displayProjectName, type BrowseAccess, type BrowseProjectRow, type BrowseVersionRow, type CloudFolder } from "./cloudTypes";
import { classifyCloudSchemaVersion } from "./schemaOutcome";

/**
 * Stage 4B's words: the Browse the consortium tab, the browse banner, the price
 * gap, the version list, and the refusals. Pure, so every string is testable
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
