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

export function actingAsChangedMessage(companyName: string): string {
  return `You're now acting as ${companyName} (changed in another tab). Nothing was saved.`;
}
