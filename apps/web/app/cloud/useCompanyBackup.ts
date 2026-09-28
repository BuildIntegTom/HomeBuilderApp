"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PROJECT_FILE_VERSION } from "../projectFile";
import { backupSwitchedAwayMessage } from "./backupResultDisplay";
import type { BackupPageResponse } from "./cloudTypes";
import type { BackupPageResult, BackupProgress } from "./companyBackup";
import { runCompanyBackup } from "./companyBackupRun";

/**
 * Stage 2D: runs a company backup and downloads the zip.
 *
 * Held by AccountControl, which is always mounted, and handed to the account
 * panel as a prop: the panel lives in a StickyNote that unmounts its contents
 * when closed, and closing the note must not silently kill a long backup.
 *
 * Switching the acting-as company while a backup runs stops it: the pages are
 * that company's, and the route would refuse the next one with a 409 anyway.
 * That cancelled state is marked `switchedAway`, because the panel showing it is
 * by then the NEW company's and `showsBackupResult` needs to let it through —
 * without the mark the message was written and never rendered (Stage 2D defect,
 * fixed 2026-09-27; see `backupResultDisplay.ts`).
 *
 * The zip writer (backupZip, and fflate with it) is NOT imported here: it is
 * loaded by `import()` when a backup starts (companyBackupRun.ts), because this
 * hook sits in the page's initial bundle through AccountControl -> TopBar.
 */

export type CompanyBackupState =
  | { status: "idle" }
  | { status: "running"; companyId: string; companyName: string; progress: BackupProgress | null }
  | { status: "done"; companyId: string; fileName: string; versionCount: number; projectCount: number; outsideWindowCount: number; zipBytes: number }
  | { status: "failed"; companyId: string; message: string }
  /**
   * `switchedAway` is true ONLY for a run the acting-as switch aborted, whose
   * `companyId` is therefore the company that was left. It is what tells the
   * panel to report a run that belongs to a company no longer on screen; the
   * message names that company itself.
   */
  | { status: "cancelled"; companyId: string; message: string; switchedAway: boolean };

export interface CompanyBackupController {
  state: CompanyBackupState;
  start: (companyId: string, companyName: string) => void;
  cancel: () => void;
  dismiss: () => void;
}

async function fetchBackupPage(companyId: string, after: string | null, signal: AbortSignal): Promise<BackupPageResult> {
  const query = new URLSearchParams();
  if (after) query.set("after", after);
  const response = await fetch(`/api/companies/${encodeURIComponent(companyId)}/backup${query.size ? `?${query}` : ""}`, {
    cache: "no-store",
    signal,
  });
  const payload = (await response.json().catch(() => null)) as (BackupPageResponse & { error?: unknown }) | null;
  if (!response.ok || !payload) {
    const message =
      payload && typeof payload.error === "string" ? payload.error : `The server refused a backup page (${response.status}).`;
    return { ok: false, status: response.status, message };
  }
  return { ok: true, data: payload };
}

function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  // A large blob is revoked after the browser has had time to start writing it.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function useCompanyBackup(actingAsCompanyId: string | null): CompanyBackupController {
  const [state, setState] = useState<CompanyBackupState>({ status: "idle" });
  const controllerRef = useRef<AbortController | null>(null);
  const runningCompanyRef = useRef<string | null>(null);
  // Kept beside the id so the abort-on-switch message can NAME the company the
  // run was for: by the time it is read, the screen is showing another one.
  const runningCompanyNameRef = useRef<string | null>(null);

  const start = useCallback((companyId: string, companyName: string) => {
    if (controllerRef.current) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    runningCompanyRef.current = companyId;
    runningCompanyNameRef.current = companyName;
    setState({ status: "running", companyId, companyName, progress: null });

    void (async () => {
      try {
        const outcome = await runCompanyBackup({
          companyId,
          appProjectFileVersion: PROJECT_FILE_VERSION,
          fetchPage: (after, signal) => fetchBackupPage(companyId, after, signal),
          signal: controller.signal,
          loadZip: () => import("./backupZip"),
          download: downloadBlob,
          onProgress: (progress) => {
            if (!controller.signal.aborted) setState({ status: "running", companyId, companyName, progress });
          },
        });
        if (outcome.status === "done") {
          setState({ ...outcome, companyId });
        } else if (outcome.status === "failed") {
          setState({ status: "failed", companyId, message: outcome.message });
        } else {
          // A cancel caused by switching company has already set its own
          // message, and its own `switchedAway: true` with it.
          setState((was) =>
            was.status === "running" ? { status: "cancelled", companyId, message: outcome.message, switchedAway: false } : was,
          );
        }
      } finally {
        controllerRef.current = null;
        runningCompanyRef.current = null;
        runningCompanyNameRef.current = null;
      }
    })();
  }, []);

  const cancel = useCallback(() => controllerRef.current?.abort(), []);
  const dismiss = useCallback(() => setState((was) => (was.status === "running" ? was : { status: "idle" })), []);

  useEffect(() => {
    const running = runningCompanyRef.current;
    if (running && running !== actingAsCompanyId) {
      const runningName = runningCompanyNameRef.current;
      controllerRef.current?.abort();
      setState({
        status: "cancelled",
        companyId: running,
        // `.trim() ||`, NOT `??`. The one caller is AccountPanel, which passes
        // `session.actingAsCompanyName ?? ""` — so the value that can actually
        // arrive is the EMPTY STRING, which `??` sails straight past, yielding
        // "…switched away from ." The `??` guard guarded the case that cannot
        // happen and missed the one that can, which is the same shape of bug
        // this whole commit exists to fix.
        //
        // The `.trim()` is there because a bare `||` let a whitespace-only name
        // through — "   " is truthy — giving a sentence with no visible subject.
        // That was found by the test below asserting the PROPERTY ("always has a
        // subject") rather than the operator, which is why the property is the
        // thing worth asserting.
        message: backupSwitchedAwayMessage((runningName ?? "").trim() || "that company"),
        switchedAway: true,
      });
    }
  }, [actingAsCompanyId]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return { state, start, cancel, dismiss };
}
