"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PROJECT_FILE_VERSION } from "../projectFile";
import { createZipCollector } from "./backupZip";
import type { BackupPageResponse } from "./cloudTypes";
import { collectCompanyBackup, type BackupPageResult, type BackupProgress } from "./companyBackup";

/**
 * Stage 2D: runs a company backup and downloads the zip.
 *
 * Held by AccountControl, which is always mounted, and handed to the account
 * panel as a prop: the panel lives in a StickyNote that unmounts its contents
 * when closed, and closing the note must not silently kill a long backup.
 *
 * Switching the acting-as company while a backup runs stops it: the pages are
 * that company's, and the route would refuse the next one with a 409 anyway.
 */

export type CompanyBackupState =
  | { status: "idle" }
  | { status: "running"; companyId: string; companyName: string; progress: BackupProgress | null }
  | { status: "done"; companyId: string; fileName: string; versionCount: number; projectCount: number; outsideWindowCount: number; zipBytes: number }
  | { status: "failed" | "cancelled"; companyId: string; message: string };

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

  const start = useCallback((companyId: string, companyName: string) => {
    if (controllerRef.current) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    runningCompanyRef.current = companyId;
    setState({ status: "running", companyId, companyName, progress: null });
    const zip = createZipCollector();

    void (async () => {
      try {
        const outcome = await collectCompanyBackup({
          companyId,
          appProjectFileVersion: PROJECT_FILE_VERSION,
          fetchPage: (after, signal) => fetchBackupPage(companyId, after, signal),
          sink: zip,
          signal: controller.signal,
          onProgress: (progress) => {
            if (!controller.signal.aborted) setState({ status: "running", companyId, companyName, progress });
          },
        });
        if (!outcome.ok) {
          // A cancel caused by switching company has already set its own message.
          if (controller.signal.aborted && outcome.reason === "cancelled") {
            setState((was) => (was.status === "running" ? { status: "cancelled", companyId, message: outcome.message } : was));
          } else {
            setState({ status: outcome.reason, companyId, message: outcome.message });
          }
          return;
        }
        const chunks = zip.finish();
        const blob = new Blob(chunks as BlobPart[], { type: "application/zip" });
        downloadBlob(outcome.fileName, blob);
        setState({
          status: "done",
          companyId,
          fileName: outcome.fileName,
          versionCount: outcome.manifest.versionCount,
          projectCount: outcome.manifest.projectCount,
          outsideWindowCount: outcome.manifest.outsideFileFormatWindowCount,
          zipBytes: blob.size,
        });
      } catch (error) {
        setState({
          status: "failed",
          companyId,
          message: `The backup stopped: ${error instanceof Error ? error.message : "something went wrong"}. No file was saved; try again.`,
        });
      } finally {
        controllerRef.current = null;
        runningCompanyRef.current = null;
      }
    })();
  }, []);

  const cancel = useCallback(() => controllerRef.current?.abort(), []);
  const dismiss = useCallback(() => setState((was) => (was.status === "running" ? was : { status: "idle" })), []);

  useEffect(() => {
    const running = runningCompanyRef.current;
    if (running && running !== actingAsCompanyId) {
      controllerRef.current?.abort();
      setState({
        status: "cancelled",
        companyId: running,
        message: "Backup stopped because you switched company. No file was saved.",
      });
    }
  }, [actingAsCompanyId]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return { state, start, cancel, dismiss };
}
