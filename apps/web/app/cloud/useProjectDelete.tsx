"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import StickyNote from "../StickyNote";
import { cloudFetch } from "./cloudFetch";
import { UNTITLED_LABEL, displayProjectName, type DeletePreviewResponse, type DeleteProjectResponse } from "./cloudTypes";
import {
  DELETE_ARCHIVE_LINE,
  DELETE_CONFIRM_LABEL,
  DELETE_IRREVERSIBLE_LINE,
  DELETE_UNTITLED_HINT,
  DELETED_WAS_OPEN_HERE_LINE,
  deleteConfirmPrompt,
  deleteFootprintLines,
  deleteHeading,
  deletedMessage,
} from "./deleteDisplay";
import styles from "./CloudProjects.module.css";

/**
 * Stage 5, first slice: permanently deleting a WHOLE project, as one
 * StickyNote. Reached by Delete… on an Open from cloud folder row, and shown
 * only to a platform admin — decision 13, "only platform admin can
 * permanently delete anything".
 *
 * IT HOLDS NO PERMISSION. `projects_delete` (0006) is
 * `using (public.is_platform_admin())`, the route refuses a non-admin session
 * before it asks, and the database refuses again. The button is the courtesy.
 *
 * The shape, and why:
 *
 *  1. Delete… opens the note and asks the route WHAT WOULD BE DESTROYED. The
 *     confirmation is never offered before that answer arrives — a delete
 *     nobody could describe is a delete nobody should be invited to make.
 *  2. The note names the project, its owner company, and the counts of the
 *     three things that go with it: versions, shares, access requests.
 *  3. The exact name has to be TYPED. Not a second "are you sure": the whole
 *     point is that the fingers have to name the project the eyes read.
 *  4. The answer — success or refusal — is shown in the route's own words,
 *     and every refusal says the project is still there.
 */

export interface UseProjectDeleteOptions {
  /** Re-read the session after a 401/403, as every other cloud action does. */
  onAuthProblem: () => void;
  /** A project was destroyed: any list showing it must be re-read. */
  onDeleted: (projectId: string) => void;
  /** Is this project the one open in the editor right now? Read at the moment
   * the answer lands, not when the note was opened. */
  isOpenHere: (projectId: string) => boolean;
}

type Outcome = { tone: "info" | "error"; lines: string[] };

export function useProjectDelete({ onAuthProblem, onDeleted, isOpenHere }: UseProjectDeleteOptions): {
  openDelete: (projectId: string, projectName: string) => void;
  reset: () => void;
  note: ReactNode;
} {
  const [isOpen, setIsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [target, setTarget] = useState<{ projectId: string; projectName: string } | null>(null);
  const [preview, setPreview] = useState<DeletePreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  /** True once this note has actually destroyed its project: the form goes,
   * and only the answer is left. */
  const [done, setDone] = useState(false);

  /** Counts preview requests, so an older answer (another project, or one from
   * before an account change) is never shown against this one. */
  const request = useRef(0);

  const load = useCallback(
    async (projectId: string) => {
      const id = ++request.current;
      setLoading(true);
      setLoadError(null);
      const result = await cloudFetch<DeletePreviewResponse>(`/api/projects/${encodeURIComponent(projectId)}/deletion`);
      if (id !== request.current) return;
      setLoading(false);
      if (!result.ok) {
        if (result.status === 401 || result.status === 403) onAuthProblem();
        setPreview(null);
        setLoadError(result.message);
        return;
      }
      setPreview(result.data);
    },
    [onAuthProblem],
  );

  const openDelete = (projectId: string, projectName: string) => {
    setTarget({ projectId, projectName });
    setPreview(null);
    setTyped("");
    setOutcome(null);
    setDone(false);
    setIsOpen(true);
    void load(projectId);
  };

  const reset = useCallback(() => {
    request.current += 1;
    setIsOpen(false);
    setTarget(null);
    setPreview(null);
    setLoading(false);
    setLoadError(null);
    setTyped("");
    setOutcome(null);
    setDone(false);
  }, []);

  const shown = preview && target && preview.projectId === target.projectId ? preview : null;

  /**
   * The button is enabled only when the typed text matches the phrase the
   * ROUTE computed. This is a courtesy, exactly like Remove: the route checks
   * the same thing again, against the name the database holds at that moment,
   * which is what catches a rename landing while this box was open.
   */
  const typedMatches = shown !== null && typed.normalize("NFC").trim() === shown.confirmationPhrase.normalize("NFC").trim();

  const confirm = async () => {
    if (!shown || busy || !typedMatches) return;
    setBusy(true);
    setOutcome(null);
    const result = await cloudFetch<DeleteProjectResponse>(`/api/projects/${encodeURIComponent(shown.projectId)}`, {
      method: "DELETE",
      body: JSON.stringify({ confirm: typed }),
    });
    setBusy(false);
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) onAuthProblem();
      // Every refusal from this path already says the project was not
      // deleted, in the route's words. Nothing is added or reworded here.
      setOutcome({ tone: "error", lines: [result.message] });
      // A refusal may be a rename landing mid-flight, so re-read what is
      // there now rather than leaving a stale name on screen.
      void load(shown.projectId);
      return;
    }
    const wasOpenHere = isOpenHere(shown.projectId);
    setDone(true);
    setOutcome({
      tone: "info",
      lines: wasOpenHere ? [deletedMessage(result.data), DELETED_WAS_OPEN_HERE_LINE] : [deletedMessage(result.data)],
    });
    onDeleted(shown.projectId);
  };

  const heading = shown
    ? deleteHeading(shown.projectName, shown.ownerCompanyName)
    : deleteHeading(target?.projectName ?? "", "");

  const note = (
    <StickyNote
      id="cloud-delete-note"
      label={`Delete · ${displayProjectName(shown?.projectName ?? target?.projectName)}`}
      isOpen={isOpen}
      isFullscreen={fullscreen}
      cascadeIndex={0}
      onClose={reset}
      onToggleFullscreen={() => setFullscreen((was) => !was)}
    >
      <div className={styles.stack}>
        {loading && !shown ? (
          <p className={styles.muted}>Reading what this would destroy…</p>
        ) : loadError ? (
          <p className={styles.error}>{loadError}</p>
        ) : shown ? (
          <>
            <p className={styles.lead} data-delete-heading="">
              <strong>{heading}</strong>
            </p>
            {!done && (
              <>
                <p className={styles.error}>{DELETE_IRREVERSIBLE_LINE}</p>
                <ul className={styles.rows} data-delete-footprint="">
                  {deleteFootprintLines(shown).map((line) => (
                    <li key={line} className={styles.row}>
                      <span className={styles.rowTitle}>{line}</span>
                    </li>
                  ))}
                </ul>
                <p className={styles.muted}>{DELETE_ARCHIVE_LINE}</p>
                <label className={styles.field}>
                  {deleteConfirmPrompt(shown.confirmationPhrase)}
                  <input
                    className={styles.input}
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    aria-label={deleteConfirmPrompt(shown.confirmationPhrase)}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                  />
                </label>
                {shown.confirmationPhrase === UNTITLED_LABEL && <p className={styles.muted}>{DELETE_UNTITLED_HINT}</p>}
              </>
            )}
            {outcome && (
              <div className={styles.stack} data-delete-outcome="">
                {outcome.lines.map((line) => (
                  <p key={line} className={outcome.tone === "error" ? styles.error : styles.message}>
                    {line}
                  </p>
                ))}
              </div>
            )}
            <div className={styles.actions}>
              {!done && (
                <button type="button" className={styles.primary} disabled={busy || !typedMatches} onClick={() => void confirm()}>
                  {busy ? "Deleting…" : DELETE_CONFIRM_LABEL}
                </button>
              )}
              <button type="button" className={styles.button} disabled={busy} onClick={reset}>
                {done ? "Close" : "Keep this project"}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </StickyNote>
  );

  return { openDelete, reset, note };
}
