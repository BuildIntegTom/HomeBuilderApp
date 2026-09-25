/**
 * Shapes shared by the Stage 2B cloud routes and the editor that calls them.
 * Spec: "Stage 2 plan — Cloud projects and versions". Imports nothing, so both
 * the route logic and the browser can use it.
 */

/** Three fixed folders per company (decision 12). A status label, never a
 * permission boundary. Matches the `projects.folder` check constraint. */
export type CloudFolder = "current" | "past" | "proposals";

export const CLOUD_FOLDERS: readonly CloudFolder[] = ["current", "past", "proposals"];

export const FOLDER_LABEL: Record<CloudFolder, string> = {
  current: "Current Projects",
  past: "Past Projects",
  proposals: "Proposals",
};

export function isCloudFolder(value: unknown): value is CloudFolder {
  return typeof value === "string" && (CLOUD_FOLDERS as readonly string[]).includes(value);
}

/**
 * The cloud project this editor state came from, or null.
 *
 * "Base" is the version the editor started from; a save names it as the
 * parent. `folder` is carried beyond the spec's listed fields only so the
 * Project ▾ status line can name it without another request.
 */
export interface CloudContext {
  projectId: string;
  companyId: string;
  companyName: string;
  folder: CloudFolder;
  baseVersionId: string;
  baseVersionNumber: number;
  baseCreatedAt: string;
  /**
   * Stage 2C. The newest version number this editor KNEW existed when base was
   * last set: the project's head at the moment a version was opened, or the
   * version a save or create just wrote. Equal to `baseVersionNumber` unless an
   * older version was opened on purpose (from Version history, or a stale
   * list). It is what lets the divergence notice tell "you started from an
   * older version you chose" apart from "someone saved while you had it open",
   * which 2B's wording would otherwise claim for both.
   */
  latestKnownVersionNumber: number;
}

/** `projects.name` is empty when the document had no name. Shown as a visible
 * gap rather than a substituted name. */
export const UNTITLED_LABEL = "(untitled)";

export function displayProjectName(name: string | null | undefined): string {
  return name && name.trim().length > 0 ? name : UNTITLED_LABEL;
}

export type CloudUnavailableReason = "no-company" | "consortium";

export interface CloudProjectRow {
  id: string;
  name: string;
  folder: CloudFolder;
  headVersionNumber: number;
  /** Null only if the head version could not be read back. */
  headVersionId: string | null;
  headAuthorName: string | null;
  updatedAt: string;
}

export interface ListProjectsResponse {
  company: { id: string; name: string } | null;
  folder: CloudFolder;
  projects: CloudProjectRow[];
  /** Set when there is deliberately nothing to list, and why. */
  unavailable: CloudUnavailableReason | null;
}

export interface CreateProjectResponse {
  projectId: string;
  versionId: string;
  versionNumber: number;
  createdAt: string;
  companyId: string;
  companyName: string;
  folder: CloudFolder;
}

export interface InterveningVersion {
  versionNumber: number;
  authorName: string;
  createdAt: string;
  kind: "save" | "rename";
  projectName: string;
}

export interface SaveVersionResponse {
  projectId: string;
  versionId: string;
  versionNumber: number;
  createdAt: string;
  headBefore: number;
  diverged: boolean;
  /** The saved-from version's number, as the database has it. */
  baseVersionNumber: number | null;
  /** Versions saved between the base and this one, oldest first. Empty unless
   * `diverged`. */
  intervening: InterveningVersion[];
}

export interface MoveProjectResponse {
  projectId: string;
  folder: CloudFolder;
}

export interface CloudVersionResponse {
  projectId: string;
  companyId: string;
  companyName: string;
  folder: CloudFolder;
  projectName: string;
  headVersionNumber: number;
  versionId: string;
  versionNumber: number;
  createdAt: string;
  schemaVersion: number;
  authorName: string;
  document: unknown;
}

export type CloudVersionKind = "save" | "rename";

/** One row of Version history. Metadata only: the route never selects
 * `document`. */
export interface CloudVersionRow {
  versionId: string;
  versionNumber: number;
  parentVersionId: string | null;
  /** The parent's number when the parent is in this list, else null. */
  parentVersionNumber: number | null;
  kind: CloudVersionKind;
  label: string | null;
  authorName: string;
  createdAt: string;
  schemaVersion: number;
  /**
   * For a `kind = 'rename'` row, the name that version carries, or null when
   * it could not be read back. Null on every save row.
   *
   * NOT PROOF THAT ONLY THE NAME CHANGED (supabase/README.md, "Two things the
   * app stages must know"): a client inserting directly can mark any version
   * `rename`. The history labels the row and never skips, collapses or
   * trust-diffs it.
   */
  renamedTo: string | null;
}

export interface ListVersionsResponse {
  projectId: string;
  companyId: string;
  companyName: string;
  /** The project's current name (the head document's). */
  projectName: string;
  folder: CloudFolder;
  headVersionNumber: number;
  /** Newest first. */
  versions: CloudVersionRow[];
  /**
   * How many of the project's versions this list does not include. Versions
   * are numbered 1..head with no gaps (a single version cannot be deleted in
   * Stage 2), so a shorter list means the API's row cap cut it off, and the
   * history says so instead of looking complete.
   */
  notListedCount: number;
}

export interface RenameProjectResponse {
  projectId: string;
  /** The name as stored (trimmed). */
  name: string;
  versionId: string;
  versionNumber: number;
  createdAt: string;
  /**
   * The version the rename copied: always the head at the moment of the
   * rename, which rename_project locks, so always `versionNumber - 1`.
   */
  renamedFromVersionNumber: number;
}

/** `rename_project`'s own check (0006): 1–200 characters after trimming. An
 * administrative limit, not a building value. */
export const PROJECT_NAME_MAX_CHARS = 200;

export const NAME_LENGTH_MESSAGE = `A project name must be 1 to ${PROJECT_NAME_MAX_CHARS} characters. Nothing was changed.`;

/**
 * The database refuses a document whose `document::text` exceeds 4 MB (0006,
 * Open Item 5: picked, not measured, accepted by Tommy). An administrative
 * guard, not a building value, so not a CatalogValue.
 *
 * PostgreSQL's jsonb text output adds a space after every `:` and `,`, so it is
 * LONGER than the minified JSON the app sends. A minified document already over
 * the ceiling is therefore certain to be refused and is not sent at all; one
 * under it may still be refused by the database, which is handled as its own
 * outcome (supabase/README.md, "Two things the app stages must know").
 */
export const CLOUD_DOCUMENT_CEILING_BYTES = 4 * 1024 * 1024;

export function isCertainlyTooLargeForCloud(minifiedJson: string): boolean {
  return new TextEncoder().encode(minifiedJson).length > CLOUD_DOCUMENT_CEILING_BYTES;
}

export const DOCUMENT_TOO_LARGE_MESSAGE =
  "This project is too large to save to the cloud (the limit is 4 MB). Nothing was saved. Download project file keeps a copy on this computer.";

export const NO_COMPANY_MESSAGE =
  "You're signed in, but you aren't a member of any company yet, so there's no company to save a cloud project into. Ask a company admin for an invite. Save Project still downloads the file to this computer.";

/**
 * Acting as the consortium company, the three folder tabs still list nothing:
 * a consortium entitlement is not a membership, so RLS gives them no row.
 *
 * STAGE 4B REPLACED THIS STRING (it was `consortiumLaterStageMessage`, and it
 * said "Its folders open in a later stage"). That stopped being true the moment
 * browsing shipped: the consortium's own tree is now readable — through the
 * browse path, redacted, because a consortium entitlement is not a Seed
 * membership. The sentence now points at the tab that does show it rather than
 * at a stage that has arrived.
 */
export function consortiumFolderTabsMessage(companyName: string): string {
  return `You're acting as ${companyName} through the consortium, which isn't a membership in it, so these folder tabs list nothing. ${companyName}'s own projects are in ${BROWSE_TAB_NAME}, read-only and with costs not shown.`;
}

/**
 * The SAME situation said differently in the Project ▾ menu, which is printed
 * directly above "Open from cloud…" — and which, since 3D, sits above a note
 * that genuinely does have something to list (Shared with us).
 *
 * STAGE 4B REPLACED THIS STRING TOO, for the same reason: "Its own folders open
 * in a later stage" is no longer true.
 */
export function consortiumMenuMessage(companyName: string): string {
  return `You're acting as ${companyName} through the consortium. Open from cloud… has ${BROWSE_TAB_NAME}, where every member company's work is read-only with costs not shown; projects shared with you, and ones you create here, are in Shared with us.`;
}

/** Named here (rather than imported from `browseDisplay.ts`) so `cloudTypes.ts`
 * keeps importing nothing. `browseDisplay.test.ts` asserts the two agree. */
const BROWSE_TAB_NAME = "Browse the consortium";

/**
 * Stage 3 Open Item 5, Tommy's accepted default: ONE line in the create dialog.
 * A project created in the consortium's tree is owned by it and carries your own
 * `priceModifier`, so its members open it costs included (the ownership rule).
 * The line says so rather than implying a redaction, because none exists.
 */
export function seedTreeCostWarning(companyName: string): string {
  return `Owned by ${companyName}: its members will see this design's costs.`;
}

// ---------------------------------------------------------------------------
// Stage 2D: company backup. GET /api/companies/[id]/backup?after=&limit=
// ---------------------------------------------------------------------------

/**
 * Why one version could not be put in a page. Either makes the whole backup
 * fail in the browser: a backup must never look complete when it is not.
 * - `too-large`: the version alone would not fit under the platform's response
 *   limit. 0006's 4 MB ceiling should make this unreachable; it is a guard.
 * - `missing`: its metadata was listed but its document could not be read back.
 */
export type BackupOmission = "too-large" | "missing";

/**
 * Stage 3E: how the backing-up company reaches this project.
 * - `owned`: `projects.company_id` is that company (Stage 2D's only case).
 * - `granted`: a `collaborators` row grants the project TO THAT COMPANY.
 *
 * A PERSONAL grant is neither, and is in no company's backup (Open Item 2): it
 * belongs to a person, not to a company.
 */
export type BackupOwnership = "owned" | "granted";

/** One version of one project the company owns OR holds a company grant on,
 * with its stored document. */
export interface BackupVersionEntry {
  projectId: string;
  /** The project's name as it was when this page read the project row. */
  projectName: string;
  folder: CloudFolder;
  /** The project's head when this page read it; used to prove nothing was skipped. */
  projectHeadVersionNumber: number;
  versionId: string;
  versionNumber: number;
  parentVersionId: string | null;
  kind: CloudVersionKind;
  label: string | null;
  authorName: string;
  createdAt: string;
  schemaVersion: number;
  /** The stored `ProjectFile`, untouched. Null only when `omitted` says why. */
  document: unknown;
  omitted: BackupOmission | null;
  /** Stage 3E. `owned` entries are exactly what 2D sent. */
  ownership: BackupOwnership;
  /**
   * Who owns a `granted` project — another company, named through
   * `project_owner_company_name` because `companies_select` hides that row from
   * a collaborator. Null for an owned project (the backing-up company owns it).
   * The name is empty, never substituted, if the helper could not read it.
   */
  ownerCompany: { id: string; name: string } | null;
}

export interface BackupPageResponse {
  company: { id: string; name: string };
  exportedBy: { id: string; email: string; displayName: string };
  /** The server's clock when this page was read. The first page's is the backup's `exportedAt`. */
  serverTime: string;
  /** How many projects the company owns: on the first page only, otherwise null. */
  projectCount: number | null;
  /**
   * Stage 3E: how many projects are granted to the company (one `collaborators`
   * row per project per company), on the first page only, otherwise null.
   * Counted from the grant rows, so it is an upper bound in the two cases the
   * walk skips: a grant removed mid-backup, and a project the company also owns.
   */
  grantedProjectCount: number | null;
  /** Ordered by phase (owned, then granted), then project id, then version number. */
  versions: BackupVersionEntry[];
  /** Pass back as `after` for the next page. Null when `done`. */
  nextAfter: string | null;
  done: boolean;
}

// ---------------------------------------------------------------------------
// Stage 3B: sharing, the access list and the "Shared with us" tab.
// Spec: "Stage 3 plan — Collaboration" → "Who sees what", "The owner's access
// list, and sharing UI", Routes.
// ---------------------------------------------------------------------------

/** How a grant reaches you: to you personally, to the company you act as, or
 * the creator grant (answer 1). */
export type ReachedVia = "person" | "company" | "creator";

/** One entry of `list_shared_projects.reached_via`. Names are snapshots taken
 * when the grant was made ("as shared"). */
export interface SharedReach {
  via: ReachedVia;
  granteeName: string;
  /** Null only for a creator grant. */
  grantedByName: string | null;
  createdAt: string;
}

/** One row of the Shared tab. Metadata only: the route never selects `document`. */
export interface SharedProjectRow extends CloudProjectRow {
  ownerCompanyId: string;
  /** Through `project_owner_company_name`; empty only if it could not be read. */
  ownerCompanyName: string;
  /** Oldest first. One project reached two ways is ONE row with two entries. */
  reachedVia: SharedReach[];
}

export interface ListSharedProjectsResponse {
  /** The verified acting-as company the list was filtered by, or null (no membership). */
  actingAs: { id: string; name: string } | null;
  projects: SharedProjectRow[];
}

export type GrantKind = "shared" | "creator";

/** One row of a project's access list, as the route shapes it. No user ids
 * are sent: removal rights are decided server-side (and again by RLS). */
export interface AccessGrantRow {
  grantId: string;
  kind: GrantKind;
  granteeKind: "person" | "company";
  /** The person's or company's name when the grant was made. */
  granteeName: string;
  /** True when the grantee company is The Seed Collaborative (own members only). */
  granteeIsConsortium: boolean;
  grantedByName: string | null;
  /** The signed-in person made this grant. */
  grantedByYou: boolean;
  /** This grant is to the signed-in person. */
  isYou: boolean;
  createdAt: string;
  /** Whether the database would let the signed-in person remove it (the
   * button is the courtesy; RLS is the gate). */
  canRemove: boolean;
  /** For a personal grant: the ids of the grants THAT person made on this
   * project (the Remove offer, Open Item 1). Empty for company and creator grants. */
  sharesMadeByGrantee: string[];
}

export interface ProjectAccessResponse {
  projectId: string;
  projectName: string;
  owner: { id: string; name: string };
  /** The signed-in person is a member of the owner company (or a platform admin). */
  viewerIsOwnerSide: boolean;
  grants: AccessGrantRow[];
  /**
   * Stage 4C: pending access requests on this project, oldest first, ABOVE the
   * grant rows. Always empty unless `viewerIsOwnerSide` — the database is the
   * gate (only an owner member or a platform admin may decide) and this list is
   * the courtesy, exactly as Remove is.
   */
  requests: PendingAccessRequestRow[];
}

export type PersonShareStatus = "shared" | "already-shared" | "no-account" | "self" | "already-member";
export type CompanyShareStatus = "shared" | "already-shared" | "owner-company" | "not-shareable";

export interface ShareResponse {
  kind: "person" | "company";
  status: PersonShareStatus | CompanyShareStatus;
  grantId: string | null;
  /** The answer in words, ready to show. */
  message: string;
}

export interface RemoveGrantResponse {
  removedGrantId: string;
  /** Of the "shares they made" the remover chose to remove too. */
  alsoRemoved: number;
  /** Chosen, but already gone or not removable by you. */
  alsoNotRemoved: number;
}

export interface ShareableCompany {
  id: string;
  name: string;
  isConsortium: boolean;
}

export interface ShareableCompaniesResponse {
  companies: ShareableCompany[];
}

export function actingAsChangedMessage(companyName: string): string {
  return `You're now acting as ${companyName} (changed in another tab). Nothing was saved.`;
}

// ---------------------------------------------------------------------------
// Stage 3C: the in-app "shared with you" notice (answer 7).
// Spec: "Stage 3 plan — Collaboration" → "The in-app notice (7)".
// ---------------------------------------------------------------------------

/**
 * One pending notice: one `shared` grant that reaches you and is newer than
 * your own `share_notice_state.seen_through`. Column for column
 * `pending_share_notices()` (0008), whose result type was read off local
 * PostgreSQL 17.4 rather than assumed:
 *
 *   TABLE(grant_id uuid, project_id uuid, project_name text,
 *         owner_company_name text, granted_by_name text, grantee_kind text,
 *         grantee_name text, created_at timestamptz)
 *
 * What is NOT here is the point of it: no user ids, and no `document`. The
 * function already excludes creator grants, grants you made yourself, and
 * company grants made before you joined that company.
 */
export interface ShareNoticeRow {
  grantId: string;
  projectId: string;
  projectName: string;
  /** Through `project_owner_company_name`; empty only if it could not be read. */
  ownerCompanyName: string;
  /**
   * Who shared it, as snapshotted when the grant was made. The table's check
   * constraint makes this non-null for every `shared` grant, so a null here
   * would mean a row that should not exist — shown as a visible gap, never a
   * substituted name.
   */
  grantedByName: string | null;
  /** Whether the grant is to you personally or to a company you belong to. */
  granteeKind: "person" | "company";
  /** Your name, or the company's, as shared. */
  granteeName: string;
  createdAt: string;
}

export interface PendingShareNoticesResponse {
  notices: ShareNoticeRow[];
}

/** `dismiss_share_notices()` returns void; the route answers with this so the
 * browser can tell a real success from an empty body. */
export interface DismissShareNoticesResponse {
  dismissed: true;
}

// ---------------------------------------------------------------------------
// Stage 4B: consortium browsing. Column for column the four browse functions in
// migration 0009, whose result types were read off local PostgreSQL 17.4 rather
// than assumed. Every one of them is SECURITY DEFINER and checks seed
// entitlement, the browse set and `meets_required_aal()` for itself.
// Spec: "Stage 4 plan — Consortium browsing" → "What browsing shows".
// ---------------------------------------------------------------------------

/**
 * How a browsed row will open (`browse_projects.access`, decided in SQL by
 * `can_read_project`, which 0009 calls and does not widen).
 *
 * - `full`: the caller can already read it — membership, a grant, or platform
 *   admin — so the row opens through the Stage 2 route, WITH costs.
 * - `redacted`: it opens through `browse_version`, which always redacts.
 *
 * `browse_version` ALWAYS redacts, for every caller including one who could
 * read the project in full (Open Item 2, answered): one always-redacting
 * function has fewer branches and so fewer holes.
 */
export type BrowseAccess = "full" | "redacted";

export interface BrowseCompany {
  id: string;
  name: string;
}

export interface BrowseCompaniesResponse {
  companies: BrowseCompany[];
}

export interface BrowseProjectRow {
  projectId: string;
  name: string;
  folder: CloudFolder;
  headVersionNumber: number;
  /** Null only if the head version could not be read back. */
  headVersionId: string | null;
  /**
   * Masked in SQL (`browse_author_name`) when the snapshot is an email address,
   * to "a member of <company>". A REAL VALUE, not a missing one: it is shown as
   * it came back and is never blanked or re-masked in the browser.
   */
  headAuthorName: string | null;
  headSchemaVersion: number | null;
  /**
   * False means the database has no redaction classification for that file
   * format, so `browse_version` will REFUSE it (SQLSTATE `0A000`) rather than
   * serve it. The row says it cannot be shown and offers no download.
   */
  headRedactionKnown: boolean;
  updatedAt: string;
  ownerCompanyId: string;
  ownerCompanyName: string;
  access: BrowseAccess;
}

export interface BrowseProjectsResponse {
  /** The company the list was narrowed to, when one was asked for. */
  company: BrowseCompany | null;
  /** The folder the list was narrowed to, when one was asked for. */
  folder: CloudFolder | null;
  projects: BrowseProjectRow[];
}

/** One row of the version list while browsing. Metadata only: `browse_versions`
 * selects no document except `state.projectName`. */
export interface BrowseVersionRow {
  versionId: string;
  versionNumber: number;
  parentVersionId: string | null;
  kind: CloudVersionKind;
  /**
   * ALWAYS null on this path, and not by accident: `browse_versions` returns
   * `null::text` for it (narrowed 2026-09-23, after 4A's review, when a probe
   * read back a save note saying "Quoted at 1.35 markup" to another company).
   * The column stays in the signature; the value does not. Stage 2's and Stage
   * 3's own paths keep labels.
   */
  label: null;
  /** Masked in SQL when it was an email address — see `headAuthorName`. */
  authorName: string | null;
  createdAt: string;
  schemaVersion: number;
  redactionKnown: boolean;
  /** The name this version was saved under, for a "Renamed to …" row. */
  projectName: string | null;
}

export interface BrowseVersionsResponse {
  projectId: string;
  /** Newest first. */
  versions: BrowseVersionRow[];
}

/**
 * One browsed version, with its REDACTED document. The only path that serves a
 * browsed document at all, and it always redacts. The Stage 2 version route and
 * the backup route are never borrowed for this.
 */
export interface BrowseVersionResponse {
  projectId: string;
  folder: CloudFolder;
  ownerCompanyId: string;
  ownerCompanyName: string;
  versionId: string;
  versionNumber: number;
  kind: CloudVersionKind;
  /** Masked in SQL when it was an email address. */
  authorName: string | null;
  createdAt: string;
  schemaVersion: number;
  /** The stored document minus every classified money path, plus the top-level
   * `redaction` marker naming what went. Opened by `parseRedactedProjectFile`,
   * never by `parseProjectFile`. */
  document: unknown;
}

/**
 * Where a READ-ONLY browsed design on screen came from. The mirror image of
 * `CloudContext`, and deliberately a different field on the session so that no
 * save path can attach to a browsed project even if a control were missed:
 * `cloudContext` is null whenever this is set, and the reducer enforces it.
 */
export interface BrowseContext {
  projectId: string;
  ownerCompanyId: string;
  ownerCompanyName: string;
  folder: CloudFolder;
  versionId: string;
  versionNumber: number;
  createdAt: string;
  /** The name the version was saved under, for the banner. */
  projectName: string;
  /**
   * Stage 4C: the browse row's own `access`, carried so the banner can gate
   * Ask for access exactly as the row does.
   *
   * ⚠ IT IS NOT ALWAYS `redacted`. A `full` row reaches this state through
   * **Versions** — `browse_version` always redacts, for every caller, which is
   * the whole reason `BROWSE_VERSION_LIST_FULL_ACCESS_NOTE` exists — so a
   * browsed design on screen may well be one its viewer can open in full
   * through the Stage 2 door. It says how the ROW opens, never what this
   * document is: what is on screen here is redacted either way.
   */
  access: BrowseAccess;
}

// ---------------------------------------------------------------------------
// Stage 4C: access requests — `collab_requests`, `request_project_access` and
// `decide_collab_request` in migration 0009, column for column and status for
// status. Spec: "Stage 4 plan — Consortium browsing" → "Access requests".
//
// ⚠ `decided_by` HAS NO FIELD HERE, AND THAT IS THE POINT. The requester can
// read their own request row through `collab_requests_select`, `decided_by`
// included, and it is harmless in the database where a uuid identifies nobody.
// Forwarding it would hand a browser an `auth.users` id for a person at
// another company, which nothing else in this app does. The shapes below carry
// `status`, `decidedAt` and `decidedByName` and stop there ("Two narrowings",
// item 4, and the 4C handoff).
// ---------------------------------------------------------------------------

/** `collab_requests.status`, and its check constraint. */
export type AccessRequestStatus = "pending" | "granted" | "declined";

/**
 * `request_project_access`'s own answers. Statuses, not errors (Stage 3's
 * convention): a second pending request answers `already-pending` and WRITES
 * NOTHING, and asking about something you can already read answers
 * `already-has-access`. Anything outside your browse set raises 42501 instead,
 * the same as a project that does not exist.
 */
export const ASK_STATUSES = ["requested", "already-pending", "already-has-access"] as const;
export type AskStatus = (typeof ASK_STATUSES)[number];

/**
 * `decide_collab_request`'s answers. The first four are
 * `share_project_with_person`'s own statuses, forwarded unchanged — a granted
 * request becomes AN ORDINARY STAGE 3 GRANT, written by that function and by
 * no other path — and in all four the request is closed as `granted`.
 */
export const DECIDE_STATUSES = [
  "shared",
  "already-shared",
  "already-member",
  "self",
  "declined",
  "already-granted",
  "already-declined",
] as const;
export type DecideStatus = (typeof DECIDE_STATUSES)[number];

/** Which decide statuses mean the requester can now read the project. */
export const GRANTING_DECIDE_STATUSES: readonly DecideStatus[] = ["shared", "already-shared", "already-member", "self"];

export interface AskForAccessResponse {
  status: AskStatus;
  /** The pending request's id — the caller's own row. Null for
   * `already-has-access`, where nothing was written and nothing exists. */
  requestId: string | null;
  /** The answer in words, ready to show. */
  message: string;
}

export interface DecideAccessRequestResponse {
  status: DecideStatus;
  /** True when the requester can now read the project — the four granting
   * statuses. False for a decline and for a request already decided. */
  granted: boolean;
  message: string;
}

/**
 * One PENDING request, as the owner company's members see it in the existing
 * Access… note. Served only to an owner-side viewer, and only for requests
 * still waiting: a decided request is the requester's business, not a standing
 * entry on somebody else's project.
 *
 * No `requestedBy` user id, no `decided_by`: a name snapshot and a note.
 */
export interface PendingAccessRequestRow {
  requestId: string;
  /** The snapshot taken when the request was written, by
   * `prepare_project_version`'s rule (display name, then email). */
  requestedByName: string;
  message: string | null;
  createdAt: string;
}

/**
 * One of YOUR OWN requests, in Your access requests.
 *
 * `projectName` and `ownerCompanyName` are resolved against `browse_projects()`
 * and nothing else, so this list can never name a project the browse tab would
 * not. Both are null for a project that has left your browse set.
 */
export interface MyAccessRequestRow {
  requestId: string;
  projectId: string;
  projectName: string | null;
  ownerCompanyName: string | null;
  /** The note you sent, shown back to you. */
  message: string | null;
  status: AccessRequestStatus;
  createdAt: string;
  decidedAt: string | null;
  /** A name snapshot of whoever decided. ⚠ NEVER `decided_by`, the raw uuid. */
  decidedByName: string | null;
}

export interface MyAccessRequestsResponse {
  requests: MyAccessRequestRow[];
}

// ---------------------------------------------------------------------------
// Stage 5, first slice: permanent delete of a WHOLE project (decision 13).
// ---------------------------------------------------------------------------

/**
 * What a permanent delete would destroy, read BEFORE anything is deleted.
 *
 * Every count is `number | null`. Null means the count could not be read, and
 * the note says so rather than printing 0 — on the one screen in this app
 * where a wrong 0 would read as "there is nothing of this kind here", a
 * visible gap beats a plausible substitute (the flag convention's own rule).
 *
 * Exactly three tables reference `projects`, all `on delete cascade`: its
 * versions (0006), its grants (0008) and its access requests (0009). Nothing
 * else in the schema names a project, so those three are the whole footprint.
 */
export interface DeletePreviewResponse {
  projectId: string;
  /** The name the DATABASE holds now, not the name the clicked row remembered:
   * a rename since the tree was listed has to be visible here. */
  projectName: string;
  ownerCompanyName: string;
  folder: CloudFolder;
  headVersionNumber: number;
  versionCount: number | null;
  grantCount: number | null;
  accessRequestCount: number | null;
  /** Exactly what has to be typed to confirm, computed by the route from the
   * name above — so `(untitled)` is the phrase for a project with no name, and
   * it is the same text the tree shows for it. */
  confirmationPhrase: string;
}

/** What a permanent delete actually destroyed. The counts are the ones read
 * just before the delete: afterwards there is nothing left to count. */
export interface DeleteProjectResponse {
  projectId: string;
  projectName: string;
  ownerCompanyName: string;
  deletedVersions: number | null;
  deletedGrants: number | null;
  deletedAccessRequests: number | null;
}
