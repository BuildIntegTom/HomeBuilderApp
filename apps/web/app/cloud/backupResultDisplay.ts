/**
 * The words and the one decision the company-backup panel makes about a
 * FINISHED run: whether this panel is the place to report it, and what a run
 * the acting-as switch killed says.
 *
 * Pure, and separate from `useCompanyBackup` for the reason `deleteDisplay.ts`
 * is separate from `useProjectDelete`: the hook sets the message, the panel
 * decides whether to show it, and the two must not drift apart.
 *
 * ⚠ WHY THE GATE IS NOT SIMPLY `state.companyId === companyId` (the Stage 2D
 * defect this file fixes). Switching the acting-as company ABORTS a running
 * backup — `useCompanyBackup`'s effect does that on purpose, because the pages
 * belong to the company that was left and the route would refuse the next one
 * with a 409. The cancelled state it writes therefore carries the OLD company's
 * id, while the panel on screen is the NEW company's. An equality gate is false
 * for exactly the run it was written to report, so the message never rendered
 * and the run simply vanished: it became visible only by switching back.
 */

/**
 * The part of `CompanyBackupState` this decision reads. Structural on purpose,
 * so this module does not import the hook (the hook imports it) — and the real
 * union is passed to `showsBackupResult` in its test, which is what keeps the
 * two shapes from drifting.
 */
export type BackupResultGateState = {
  status: "idle" | "running" | "done" | "failed" | "cancelled";
  /** The company the run was FOR — not necessarily the one being acted as now. */
  companyId?: string;
  /** Set only by the acting-as switch's abort. See the note above. */
  switchedAway?: boolean;
};

/**
 * Said before a backup starts, so the two nearby gestures are BOTH named.
 * Volunteering that closing the panel is safe while staying silent about the
 * switch was the misleading half: a platform admin backing up several companies
 * in a row switches, and that is the gesture that stops the run.
 */
export const BACKUP_TAB_NOTICE =
  "It is built in this browser, so keep this tab open until it finishes. Closing this panel does not stop it, " +
  "but switching to another company does — that stops the backup and saves no file.";

/**
 * A run the acting-as switch aborted. It NAMES the company it was for, because
 * by the time this is read the panel on screen belongs to a different company
 * and an unqualified "you switched company" would be about nothing visible.
 */
export function backupSwitchedAwayMessage(companyName: string): string {
  return `Backup stopped because you switched away from ${companyName}. No file was saved.`;
}

/**
 * Does this panel report that finished run? True for the company the run was
 * for, and ALWAYS for a run the switch killed — that run's company is by
 * definition not the one on screen, and its message names its own company.
 */
export function showsBackupResult(state: BackupResultGateState, companyId: string): boolean {
  if (state.status === "idle" || state.status === "running") return false;
  if (state.status === "cancelled" && state.switchedAway === true) return true;
  return state.companyId === companyId;
}
