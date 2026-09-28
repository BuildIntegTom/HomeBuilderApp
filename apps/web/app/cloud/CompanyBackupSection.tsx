"use client";

import styles from "../auth/AccountControl.module.css";
import { BACKUP_TAB_NOTICE, showsBackupResult } from "./backupResultDisplay";
import type { CompanyBackupController } from "./useCompanyBackup";

/**
 * Stage 2D: "Download company backup…" in the account panel's company-admin
 * section, beside the people list and invite form (spec: "UI"). Not in
 * Project ▾, because it is about the company rather than the file on screen.
 */

function megabytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export default function CompanyBackupSection({
  backup,
  companyId,
  companyName,
}: {
  backup: CompanyBackupController;
  companyId: string;
  companyName: string;
}) {
  const { state } = backup;
  // NOT `state.companyId === companyId`: a run the acting-as switch aborted
  // belongs to the company that was left, so an equality gate hid the one
  // message written for it. See `showsBackupResult`.
  const here = showsBackupResult(state, companyId);
  const running = state.status === "running";

  return (
    <div className={styles.form} data-company-backup>
      <p className={styles.sectionTitle}>{companyName} — backup</p>
      <p className={styles.notice}>
        Every version of every project {companyName} owns, and of every project another company has
        shared with {companyName}, as one .zip: a manifest.json plus one project file per version,
        which Load Project opens. Shared ones are under shared/ in the zip. {BACKUP_TAB_NOTICE}
      </p>

      {running ? (
        <>
          <p className={styles.notice} role="status" data-backup-progress>
            {state.companyId !== companyId
              ? `Backing up ${state.companyName}…`
              : state.progress
                ? `Downloaded ${state.progress.versions} version${state.progress.versions === 1 ? "" : "s"} from ${state.progress.projectsSeen}${state.progress.projectCount !== null ? ` of ${state.progress.projectCount}` : ""} project${(state.progress.projectCount ?? state.progress.projectsSeen) === 1 ? "" : "s"} (${megabytes(state.progress.bytes)})…`
                : "Starting the backup…"}
          </p>
          <button className={styles.button} type="button" onClick={backup.cancel}>
            Cancel backup
          </button>
        </>
      ) : (
        <button
          className={styles.primaryButton}
          type="button"
          onClick={() => backup.start(companyId, companyName)}
        >
          Download company backup…
        </button>
      )}

      {here && state.status === "done" && (
        <p className={styles.ok} role="status" data-backup-result>
          Backup saved as {state.fileName}: {state.versionCount} version{state.versionCount === 1 ? "" : "s"} of{" "}
          {state.projectCount} project{state.projectCount === 1 ? "" : "s"}, {megabytes(state.zipBytes)} zipped.
          {state.outsideWindowCount > 0 &&
            ` ${state.outsideWindowCount} of them ${state.outsideWindowCount === 1 ? "was" : "were"} saved by a different app version and won't open with Load Project; they are included untouched and marked in manifest.json.`}{" "}
          Look in your downloads folder.
        </p>
      )}
      {here && (state.status === "failed" || state.status === "cancelled") && (
        <p className={state.status === "failed" ? styles.error : styles.notice} role="status" data-backup-result>
          {state.message}
        </p>
      )}
    </div>
  );
}
