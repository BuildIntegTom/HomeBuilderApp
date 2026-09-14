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

export function consortiumLaterStageMessage(companyName: string): string {
  return `You're acting as ${companyName} through the consortium. Its folders open in a later stage, so there's nothing to list here and you can't create a project in it yet.`;
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

/** One version of one project the company owns, with its stored document. */
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
}

export interface BackupPageResponse {
  company: { id: string; name: string };
  exportedBy: { id: string; email: string; displayName: string };
  /** The server's clock when this page was read. The first page's is the backup's `exportedAt`. */
  serverTime: string;
  /** How many projects the company owns: on the first page only, otherwise null. */
  projectCount: number | null;
  /** Ordered by project id, then version number. */
  versions: BackupVersionEntry[];
  /** Pass back as `after` for the next page. Null when `done`. */
  nextAfter: string | null;
  done: boolean;
}

export function actingAsChangedMessage(companyName: string): string {
  return `You're now acting as ${companyName} (changed in another tab). Nothing was saved.`;
}
