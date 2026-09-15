import { parseSaveTimestamp } from "../titleBlockDate";
import type { BackupFileSink } from "./backupZip";
import type { BackupPageResponse, BackupVersionEntry, CloudVersionKind } from "./cloudTypes";
import { classifyCloudSchemaVersion, type CloudSchemaOutcome } from "./schemaOutcome";

/**
 * Stage 2D: turning backup pages into a zip's contents, in the browser. Pure
 * apart from `crypto.subtle`, so every rule here is unit-tested. Spec: "Stage 2
 * plan", "Company backup (29) — concrete shape", and Open Item 4.
 *
 * Layout:
 *   manifest.json
 *   projects/<folder>/<project-name-slug>--<project-id>/v0007--2026-09-13T1402Z.json
 *
 * Each version file is the stored `ProjectFile` untouched, written as 2-space
 * JSON exactly as Save Project writes a file, so plain Load Project opens any
 * version inside the app's file-format window. Versions outside it (older app
 * versions) are still included, raw, and marked in the manifest: a backup is a
 * backup.
 *
 * FAILURE: a backup either completes or produces NO FILE. A page that still
 * fails after retries, a version the server could not include, or a version
 * number missing from a project's run all stop the backup with a message; no
 * zip with a quietly missing version is ever offered.
 */

export const BACKUP_MANIFEST_FORMAT = "building-integrity-company-backup";
export const BACKUP_MANIFEST_FORMAT_VERSION = 1;

/** Administrative, not building values. */
export const BACKUP_SLUG_MAX_CHARS = 60;
/**
 * The company slug in the zip's file name is shorter than a project slug:
 * Windows' "Extract All" makes a folder named after the zip, so the company
 * slug is repeated in front of every extracted path. Worst case with 30:
 * "C:\Users\Tommy\Downloads\" (25) + "company-backup--<30>--2026-09-13T1402Z" (64)
 * + "\" + "projects\proposals\<60>--<36-char id>\v0007--2026-09-13T1402Z.json"
 * (146) = 236 characters, under the 260 MAX_PATH. With 60 it was 266.
 */
export const BACKUP_COMPANY_SLUG_MAX_CHARS = 30;
const PAGE_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

// ---------------------------------------------------------------------------
// File names. Project names are user text; these must be safe on Windows.
// ---------------------------------------------------------------------------

/**
 * A project or company name as a path segment: ASCII letters and digits in
 * lower case, everything else a single hyphen, accents folded ("Café" ->
 * "cafe"), at most 60 characters, "untitled" when nothing is left. So never
 * `<>:"/\|?*`, a control character, a trailing dot or space, or a Windows
 * device name on its own. Lower case, because Windows paths are
 * case-insensitive: "Smith" and "smith" must not be two different folders.
 */
export function backupNameSlug(name: string | null | undefined, maxChars: number = BACKUP_SLUG_MAX_CHARS): string {
  const slug = (name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxChars)
    .replace(/-+$/g, "");
  return slug || "untitled";
}

/** "2026-09-13T1402Z" (UTC, no colons), or null when the time is unusable. */
export function backupTimestamp(value: string): string | null {
  const date = parseSaveTimestamp(value);
  if (!date || !value.includes("T")) return null;
  const iso = date.toISOString(); // 2026-09-13T14:02:05.000Z
  const year = date.getUTCFullYear();
  if (year < 1000 || year > 9999) return null;
  return `${iso.slice(0, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}Z`;
}

/**
 * Two projects with the same name never collide, because the project id is in
 * the directory. The folder is a fixed label; anything unexpected is slugged
 * like a name.
 */
export function backupProjectDirectory(folder: string, projectName: string, projectId: string): string {
  return `projects/${backupNameSlug(folder)}/${backupNameSlug(projectName)}--${backupNameSlug(projectId)}`;
}

/** "v0007--2026-09-13T1402Z.json". Numbers keep sorting past 9999 by growing. */
export function backupVersionFileName(versionNumber: number, createdAt: string): string {
  const n = `v${String(Math.max(0, Math.trunc(versionNumber))).padStart(4, "0")}`;
  return `${n}--${backupTimestamp(createdAt) ?? "time-not-recorded"}.json`;
}

export function backupZipFileName(companyName: string, exportedAt: string): string {
  return `company-backup--${backupNameSlug(companyName, BACKUP_COMPANY_SLUG_MAX_CHARS)}--${backupTimestamp(exportedAt) ?? "time-not-recorded"}.zip`;
}

const WINDOWS_FORBIDDEN = /[<>:"\\|?*\u0000-\u001f]/;
const WINDOWS_DEVICE = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;

/** True when every segment of a forward-slash zip path is a legal Windows name. */
export function isWindowsSafePath(path: string): boolean {
  return path.split("/").every(
    (segment) =>
      segment.length > 0 &&
      segment.length <= 255 &&
      !WINDOWS_FORBIDDEN.test(segment) &&
      !/[. ]$/.test(segment) &&
      !WINDOWS_DEVICE.test(segment),
  );
}

/**
 * Case-insensitive de-duplication: paths are unique by construction (folder,
 * project id, version number), so this only fires on a server bug, and then a
 * "-2" beats silently overwriting a file inside the zip.
 */
export function claimUniquePath(path: string, used: Set<string>): string {
  const dot = path.lastIndexOf(".");
  const stem = dot > path.lastIndexOf("/") ? path.slice(0, dot) : path;
  const ext = dot > path.lastIndexOf("/") ? path.slice(dot) : "";
  let candidate = path;
  for (let i = 2; used.has(candidate.toLowerCase()); i++) candidate = `${stem}-${i}${ext}`;
  used.add(candidate.toLowerCase());
  return candidate;
}

// ---------------------------------------------------------------------------
// The manifest
// ---------------------------------------------------------------------------

export interface BackupManifestVersion {
  path: string;
  projectId: string;
  /** The project's name when the backup read it (the tree's name, not necessarily this version's). */
  projectName: string;
  folder: string;
  /** Stage 3 adds "granted" without a format change. */
  ownership: "owned";
  versionNumber: number;
  kind: CloudVersionKind;
  label: string | null;
  authorName: string;
  /** The cloud's own record of when this version was saved. */
  createdAt: string;
  parentVersionId: string | null;
  schemaVersion: number;
  /** How this app treats the file's format: see `classifyCloudSchemaVersion`. */
  fileFormat: CloudSchemaOutcome["kind"];
  /** False for a version outside this app's file-format window. Included raw regardless. */
  opensWithLoadProject: boolean;
  /** Hex SHA-256 of the file's bytes as written into the zip. */
  sha256: string;
}

export interface BackupManifest {
  format: typeof BACKUP_MANIFEST_FORMAT;
  formatVersion: typeof BACKUP_MANIFEST_FORMAT_VERSION;
  company: { id: string; name: string };
  exportedAt: string;
  exportedBy: { id: string; email: string; name: string };
  appProjectFileVersion: number;
  projectCount: number;
  versionCount: number;
  /** Versions this app's Load Project can't open (older or newer file format), still included. */
  outsideFileFormatWindowCount: number;
  notes: string[];
  versions: BackupManifestVersion[];
}

export const BACKUP_MANIFEST_NOTES = [
  "Every version of every project this company owns. Projects shared with the company by another company are not included in this stage.",
  "Each file under projects/ is the project document exactly as it is stored in the cloud, written as 2-space JSON the way Save Project writes a file. Load Project opens any file whose opensWithLoadProject is true.",
  "Files whose opensWithLoadProject is false were saved by an older (or newer) version of the app than this backup's appProjectFileVersion allows. They are included untouched so nothing is lost.",
  "createdAt is the cloud's record of when a version was saved. The savedAt inside a file is the saving browser's clock (and a rename copies the previous version's), so a loaded file's title block may show a different date.",
  "A project renamed or moved while the backup ran keeps the name and folder it had when the backup reached it. Versions saved after the backup had already passed a project are not included.",
];

export function describeFileFormat(schemaVersion: number, versionNumber: number, appVersion: number) {
  const outcome = classifyCloudSchemaVersion(schemaVersion, versionNumber, appVersion);
  return { fileFormat: outcome.kind, opensWithLoadProject: outcome.kind === "opens" || outcome.kind === "opens-via-migration" };
}

export function projectFileText(document: unknown): string {
  // The same call Save Project makes on the same shape.
  return JSON.stringify(document, null, 2);
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Completeness: versions are numbered 1..head with no gaps (no single-version
// delete exists in Stage 2), so a missing number is a version the zip lacks.
// ---------------------------------------------------------------------------

export interface ProjectRun {
  projectName: string;
  numbers: number[];
  /** The highest head any page reported for this project. */
  head: number;
}

/** Null when every project's run is 1..max(head, highest received), else a message. */
export function findMissingVersions(runs: Map<string, ProjectRun>): string | null {
  const problems: string[] = [];
  for (const run of runs.values()) {
    const have = new Set(run.numbers);
    const top = Math.max(run.head, ...run.numbers);
    const missing: number[] = [];
    for (let n = 1; n <= top; n++) if (!have.has(n)) missing.push(n);
    if (missing.length > 0) {
      const list = missing.length > 5 ? `${missing.slice(0, 5).join(", ")} and ${missing.length - 5} more` : missing.join(", ");
      problems.push(`${run.projectName || "(untitled)"} is missing version${missing.length === 1 ? "" : "s"} ${list}`);
    }
  }
  return problems.length === 0 ? null : problems.join("; ");
}

// ---------------------------------------------------------------------------
// Running a backup
// ---------------------------------------------------------------------------

export type BackupPageResult = { ok: true; data: BackupPageResponse } | { ok: false; status: number; message: string };

export interface BackupProgress {
  versions: number;
  projectsSeen: number;
  projectCount: number | null;
  /** Uncompressed bytes of version files so far. */
  bytes: number;
}

export type BackupOutcome =
  | { ok: true; manifest: BackupManifest; fileName: string }
  | { ok: false; reason: "cancelled" | "failed"; message: string };

export const BACKUP_CANCELLED_MESSAGE = "Backup cancelled. No file was saved.";

export interface CollectBackupOptions {
  companyId: string;
  appProjectFileVersion: number;
  fetchPage: (after: string | null, signal: AbortSignal) => Promise<BackupPageResult>;
  sink: BackupFileSink;
  signal: AbortSignal;
  onProgress?: (progress: BackupProgress) => void;
  /** Injected so tests do not wait. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function omissionMessage(entry: BackupVersionEntry): string {
  const name = entry.projectName || "(untitled)";
  return entry.omitted === "too-large"
    ? `Version ${entry.versionNumber} of ${name} is too large to download in one piece, so the backup can't include it.`
    : `Version ${entry.versionNumber} of ${name} couldn't be read back, so the backup can't include it.`;
}

export async function collectCompanyBackup(options: CollectBackupOptions): Promise<BackupOutcome> {
  const { companyId, appProjectFileVersion, fetchPage, sink, signal, onProgress } = options;
  const sleep = options.sleep ?? defaultSleep;
  const encoder = new TextEncoder();
  const cancelled = (): BackupOutcome => ({ ok: false, reason: "cancelled", message: BACKUP_CANCELLED_MESSAGE });
  const failed = (count: number, why: string): BackupOutcome => ({
    ok: false,
    reason: "failed",
    message: `The backup stopped after ${count} version${count === 1 ? "" : "s"}: ${why} No file was saved; try again.`,
  });

  let first: BackupPageResponse | null = null;
  let after: string | null = null;
  const versions: BackupManifestVersion[] = [];
  const usedPaths = new Set<string>(["manifest.json"]);
  const directories = new Map<string, string>();
  const runs = new Map<string, ProjectRun>();
  let bytes = 0;

  for (;;) {
    if (signal.aborted) return cancelled();

    let result: BackupPageResult | null = null;
    for (let attempt = 0; attempt <= PAGE_RETRIES; attempt++) {
      try {
        result = await fetchPage(after, signal);
      } catch {
        if (signal.aborted) return cancelled();
        result = { ok: false, status: 0, message: "Couldn't reach the server." };
      }
      if (signal.aborted) return cancelled();
      // Only a network failure or a server error is worth another try; a
      // refusal (401/403/404/409) will say the same thing again.
      if (result.ok || (result.status !== 0 && result.status < 500)) break;
      if (attempt < PAGE_RETRIES) await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
    if (!result || !result.ok) return failed(versions.length, result?.message ?? "Couldn't reach the server.");
    const page = result.data;

    if (page.company.id !== companyId) return failed(versions.length, "the server answered for a different company.");
    if (!first) first = page;

    for (const entry of page.versions) {
      if (signal.aborted) return cancelled();
      if (entry.omitted || entry.document === null || entry.document === undefined) {
        return failed(versions.length, omissionMessage(entry));
      }
      let directory = directories.get(entry.projectId);
      if (!directory) {
        directory = backupProjectDirectory(entry.folder, entry.projectName, entry.projectId);
        directories.set(entry.projectId, directory);
      }
      const path = claimUniquePath(`${directory}/${backupVersionFileName(entry.versionNumber, entry.createdAt)}`, usedPaths);
      const data = encoder.encode(projectFileText(entry.document));
      const sha256 = await sha256Hex(data);
      sink.add(path, data, parseSaveTimestamp(entry.createdAt));
      bytes += data.length;

      const run = runs.get(entry.projectId) ?? { projectName: entry.projectName, numbers: [], head: 0 };
      run.numbers.push(entry.versionNumber);
      run.head = Math.max(run.head, entry.projectHeadVersionNumber);
      runs.set(entry.projectId, run);

      versions.push({
        path,
        projectId: entry.projectId,
        projectName: runs.get(entry.projectId)!.projectName,
        folder: entry.folder,
        ownership: "owned",
        versionNumber: entry.versionNumber,
        kind: entry.kind,
        label: entry.label,
        authorName: entry.authorName,
        createdAt: entry.createdAt,
        parentVersionId: entry.parentVersionId,
        schemaVersion: entry.schemaVersion,
        ...describeFileFormat(entry.schemaVersion, entry.versionNumber, appProjectFileVersion),
        sha256,
      });
    }

    onProgress?.({ versions: versions.length, projectsSeen: runs.size, projectCount: first.projectCount, bytes });

    if (page.done) break;
    if (!page.nextAfter || page.nextAfter === after) {
      return failed(versions.length, "the server's pages stopped advancing.");
    }
    after = page.nextAfter;
  }

  const missing = findMissingVersions(runs);
  if (missing) return failed(versions.length, `${missing}.`);

  const manifest: BackupManifest = {
    format: BACKUP_MANIFEST_FORMAT,
    formatVersion: BACKUP_MANIFEST_FORMAT_VERSION,
    company: first.company,
    exportedAt: first.serverTime,
    exportedBy: { id: first.exportedBy.id, email: first.exportedBy.email, name: first.exportedBy.displayName },
    appProjectFileVersion,
    projectCount: runs.size,
    versionCount: versions.length,
    outsideFileFormatWindowCount: versions.filter((v) => !v.opensWithLoadProject).length,
    notes: BACKUP_MANIFEST_NOTES,
    versions,
  };
  sink.add("manifest.json", encoder.encode(JSON.stringify(manifest, null, 2)), parseSaveTimestamp(first.serverTime));
  return { ok: true, manifest, fileName: backupZipFileName(first.company.name, first.serverTime) };
}
