"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import StickyNote from "../StickyNote";
import { cloudFetch } from "./cloudFetch";
import type { DismissShareNoticesResponse, PendingShareNoticesResponse, ShareNoticeRow } from "./cloudTypes";
import { shareNoticeCheckDecision, type NoticeAudience } from "./shareNoticeCheck";
import {
  SHARE_NOTICE_DURABLE_NOTE,
  SHARE_NOTICE_GOT_IT,
  SHARE_NOTICE_OPEN_SHARED,
  dismissFailureMessage,
  groupShareNotices,
  shareNoticeHeading,
} from "./shareNoticeDisplay";
import styles from "./CloudProjects.module.css";

/**
 * Stage 3C: the in-app "shared with you" notice, as one StickyNote — the same
 * pattern every other notice in this app uses. NOTHING IS ADDED TO THE TOP BAR
 * (Stage 2 Open Item 6, restated for 3B and unchanged here).
 *
 * It holds no permissions and decides nobody's access. Which grants are news is
 * `pending_share_notices()`'s answer; when to ask is shareNoticeCheck.ts's;
 * this only shows the result and offers the two buttons.
 *
 * WHEN IT CLEARS: Got it, and only Got it. Opening the Shared tab does not
 * clear it (the spec is explicit), because reading a list is not the same as
 * having seen the news — and the tab is reachable without ever noticing this.
 */

export interface UseShareNoticeOptions {
  /** From the verified session: who, if anyone, may be notified. */
  audience: NoticeAudience;
  /** The notice's way into Open from cloud → Shared with us. */
  onOpenSharedTab: () => void;
  /** Re-read the session after a 401/403, as every other cloud action does. */
  onAuthProblem: () => void;
}

export function useShareNotice({ audience, onOpenSharedTab, onAuthProblem }: UseShareNoticeOptions): { note: ReactNode } {
  const [notices, setNotices] = useState<ShareNoticeRow[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dismissError, setDismissError] = useState<string | null>(null);

  /** Counts checks, so an answer for an earlier account is never shown. */
  const request = useRef(0);
  /** The audience the last decision was made against; null before the first. */
  const previous = useRef<NoticeAudience | null>(null);

  const load = useCallback(async () => {
    const id = ++request.current;
    const result = await cloudFetch<PendingShareNoticesResponse>("/api/share-notices");
    if (id !== request.current) return;
    if (!result.ok) {
      // A failed CHECK is silent: there is no news to report, and an error
      // where a notice would go is worse than nothing. A failed DISMISS is
      // loud, because that one the person actually asked for.
      if (result.status === 401 || result.status === 403) onAuthProblem();
      return;
    }
    if (result.data.notices.length === 0) return;
    setNotices(result.data.notices);
    setDismissError(null);
    setIsOpen(true);
  }, [onAuthProblem]);

  const { userId, mfaPending } = audience;
  useEffect(() => {
    const next: NoticeAudience = { userId, mfaPending };
    const decision = shareNoticeCheckDecision(previous.current, next);
    previous.current = next;
    if (decision === "clear") {
      // Signed out, or two-factor still pending: another account's news must
      // not be left on screen. Answers in flight are voided.
      request.current += 1;
      setNotices([]);
      setIsOpen(false);
      setDismissError(null);
      return;
    }
    if (decision === "check") void load();
  }, [userId, mfaPending, load]);

  const dismiss = async () => {
    if (busy) return;
    setBusy(true);
    setDismissError(null);
    const result = await cloudFetch<DismissShareNoticesResponse>("/api/share-notices/dismiss", { method: "POST" });
    setBusy(false);
    if (!result.ok) {
      // THE NOTICE STAYS. `seen_through` did not move, so clearing it here
      // would hide news this person never dismissed — and it would be back on
      // the next check anyway, which looks like a bug rather than a failure.
      if (result.status === 401 || result.status === 403) onAuthProblem();
      setDismissError(dismissFailureMessage(result.status, result.message));
      return;
    }
    setNotices([]);
    setDismissError(null);
    setIsOpen(false);
  };

  const groups = groupShareNotices(notices);

  const note = (
    <StickyNote
      id="cloud-share-notice-note"
      label={shareNoticeHeading(groups.length)}
      isOpen={isOpen && groups.length > 0}
      isFullscreen={fullscreen}
      // Cascade 0, like the tree and history: cascade 1 already overhangs a
      // 360px screen by 2px, and this note can be the first thing a person
      // sees on a phone after signing in.
      cascadeIndex={0}
      onClose={() => {
        // Closing is not dismissing: the server's seen_through is untouched,
        // so this returns on the next sign-in or page load. Only Got it ends it.
        setIsOpen(false);
        setFullscreen(false);
      }}
      onToggleFullscreen={() => setFullscreen((was) => !was)}
    >
      <div className={styles.stack} data-share-notice="">
        <ul className={styles.rows}>
          {groups.map((group) => (
            <li key={group.projectId} className={styles.row} data-notice-project-id={group.projectId}>
              <span className={styles.rowTitle}>{group.projectName}</span>
              {group.lines.map((line) => (
                <span key={line} className={styles.rowMeta}>
                  {line}
                </span>
              ))}
            </li>
          ))}
        </ul>
        <p className={styles.muted}>{SHARE_NOTICE_DURABLE_NOTE}</p>
        {dismissError && (
          <p className={styles.error} data-dismiss-error="">
            {dismissError}
          </p>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            data-open-shared=""
            onClick={() => {
              onOpenSharedTab();
              setFullscreen(false);
            }}
          >
            {SHARE_NOTICE_OPEN_SHARED}
          </button>
          <button type="button" className={styles.primary} data-got-it="" disabled={busy} onClick={() => void dismiss()}>
            {busy ? "Working…" : SHARE_NOTICE_GOT_IT}
          </button>
        </div>
      </div>
    </StickyNote>
  );

  return { note };
}
