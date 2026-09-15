import type { ZipCollector } from "./backupZip";
import { BACKUP_CANCELLED_MESSAGE, collectCompanyBackup, type BackupPageResult, type BackupProgress } from "./companyBackup";

/**
 * One company backup from start to download, without React: the part of
 * useCompanyBackup that decides whether a file is ever produced, so it can be
 * unit-tested.
 *
 * Two rules live here:
 *
 *  - The zip writer (`backupZip`, which pulls in fflate) is loaded with a
 *    dynamic import when a backup starts, so it is not in the page's initial
 *    JavaScript. A failed load (offline) is an ordinary failure: no file.
 *  - A cancel at ANY point ends as "Backup cancelled. No file was saved." with
 *    no download. The signal is checked after the last page arrives, again
 *    before the zip is closed, and again right before the download, because a
 *    Cancel pressed after the final page used to still save a complete zip.
 */

export type ZipModule = { createZipCollector: () => ZipCollector };

export type CompanyBackupRunOutcome =
  | { status: "done"; fileName: string; versionCount: number; projectCount: number; outsideWindowCount: number; zipBytes: number }
  | { status: "failed" | "cancelled"; message: string };

export interface RunCompanyBackupOptions {
  companyId: string;
  appProjectFileVersion: number;
  fetchPage: (after: string | null, signal: AbortSignal) => Promise<BackupPageResult>;
  signal: AbortSignal;
  /** `() => import("./backupZip")` in the app. */
  loadZip: () => Promise<ZipModule>;
  download: (fileName: string, blob: Blob) => void;
  onProgress?: (progress: BackupProgress) => void;
  sleep?: (ms: number) => Promise<void>;
}

const stoppedMessage = (why: string) => `The backup stopped: ${why}. No file was saved; try again.`;

export async function runCompanyBackup(options: RunCompanyBackupOptions): Promise<CompanyBackupRunOutcome> {
  const { signal } = options;
  const cancelled: CompanyBackupRunOutcome = { status: "cancelled", message: BACKUP_CANCELLED_MESSAGE };

  let zipModule: ZipModule;
  try {
    zipModule = await options.loadZip();
  } catch {
    if (signal.aborted) return cancelled;
    return { status: "failed", message: stoppedMessage("the zip writer couldn't be loaded (are you offline?)") };
  }
  if (signal.aborted) return cancelled;

  try {
    const zip = zipModule.createZipCollector();
    const outcome = await collectCompanyBackup({
      companyId: options.companyId,
      appProjectFileVersion: options.appProjectFileVersion,
      fetchPage: options.fetchPage,
      sink: zip,
      signal,
      onProgress: options.onProgress,
      sleep: options.sleep,
    });
    if (!outcome.ok) return signal.aborted ? cancelled : { status: outcome.reason, message: outcome.message };

    // The last page has arrived; a Cancel pressed since then still wins.
    if (signal.aborted) return cancelled;
    const chunks = zip.finish();
    const blob = new Blob(chunks as BlobPart[], { type: "application/zip" });
    if (signal.aborted) return cancelled;
    options.download(outcome.fileName, blob);
    return {
      status: "done",
      fileName: outcome.fileName,
      versionCount: outcome.manifest.versionCount,
      projectCount: outcome.manifest.projectCount,
      outsideWindowCount: outcome.manifest.outsideFileFormatWindowCount,
      zipBytes: blob.size,
    };
  } catch (error) {
    if (signal.aborted) return cancelled;
    return { status: "failed", message: stoppedMessage(error instanceof Error ? error.message : "something went wrong") };
  }
}
