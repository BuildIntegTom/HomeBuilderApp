"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import StickyNote from "../StickyNote";
import { OPEN_ACCOUNT_CONTROL_EVENT } from "../auth/AccountControl";
import { SIGNED_OUT_EVENT, useOptionalAuth } from "../auth/AuthProvider";
import { PROJECT_FILE_VERSION, parseProjectFile, type ProjectFile, type ProjectState } from "../projectFile";
import { parseSaveTimestamp } from "../titleBlockDate";
import { buildCloudMenu, cloudStatusLines, relativeSaveTime, type CloudMenu } from "./cloudMenu";
import {
  CLOUD_FOLDERS,
  DOCUMENT_TOO_LARGE_MESSAGE,
  FOLDER_LABEL,
  NO_COMPANY_MESSAGE,
  consortiumLaterStageMessage,
  displayProjectName,
  isCertainlyTooLargeForCloud,
  type CloudFolder,
  type CloudProjectRow,
  type CloudVersionResponse,
  type CreateProjectResponse,
  type ListProjectsResponse,
  type MoveProjectResponse,
  type SaveVersionResponse,
} from "./cloudTypes";
import { divergenceNotice, movedOnSaveNotice, replacedWhileSavingNotice, staleOpenNotice } from "./divergenceNotice";
import {
  answerIsCurrent,
  trackSignedInAccount,
  type CloudCreateAction,
  type CloudOpenAction,
  type CloudSaveAction,
  type DocumentSession,
  type DocumentSessionAction,
} from "./documentSession";
import { classifyCloudSchemaVersion, cloudVersionFileName } from "./schemaOutcome";
import styles from "./CloudProjects.module.css";

/**
 * Stage 2B in the editor: Save to cloud, Save as new cloud project, Open from
 * cloud with folder tabs and Move to…, and the notice a save leaves behind.
 * Spec: "Stage 2 plan — Cloud projects and versions".
 *
 * What it deliberately does not touch: local Save Project / Load Project. They
 * stay exactly as they were, and are never gated behind sign-in (decision 14).
 *
 * It holds no permissions. Every answer about who may save or read what comes
 * back from the routes, which come from RLS; this only decides what to offer
 * and how to phrase what the server said.
 *
 * LATE ANSWERS. Each request records `designGeneration` when it is sent, and
 * its answer is applied only if the design on screen has not been replaced
 * since (see documentSession.ts). Both the recording and the check read
 * `readDocumentSession()`, the synchronous mirror, never rendered state: a
 * rendered copy lags a dispatch by up to a frame, and an opened document must
 * not be applied in that frame after a Load.
 */

/** What TopBar needs to render the Project ▾ cloud group and status line. */
export interface CloudMenuModel {
  statusLines: string[];
  menu: CloudMenu;
  busy: boolean;
  onSaveToCloud: () => void;
  onSaveAsNew: () => void;
  onOpenFromCloud: () => void;
  onSignIn: () => void;
}

export interface UseCloudProjectsOptions {
  /** Rendered state, for display only. */
  documentSession: DocumentSession;
  /** The synchronous mirror: the latest dispatch, with no render lag. */
  readDocumentSession: () => DocumentSession;
  dispatch: (action: DocumentSessionAction) => void;
  /** The editor's project-name field, which IS the project's name. */
  editorProjectName: string;
  /** The document exactly as Save Project would serialize it. */
  buildProjectFile: () => ProjectFile;
  /** Apply a parsed document to the editor, keeping the viewer's own role. */
  applyCloudState: (state: ProjectState) => void;
  /** Save Project: offered whenever a cloud save is refused, so work is never
   * stranded. */
  downloadProjectFile: () => void;
}

type FetchResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

async function cloudFetch<T>(url: string, init?: RequestInit): Promise<FetchResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      ...init,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return { ok: false, status: 0, message: "Couldn't reach the server. Nothing was saved or changed." };
  }
  const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
  if (!response.ok) {
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : response.status === 413
          ? // A platform body-limit refusal arrives before our route and is not JSON.
            DOCUMENT_TOO_LARGE_MESSAGE
          : `The server refused that (${response.status}). Nothing was saved or changed.`;
    return { ok: false, status: response.status, message };
  }
  return { ok: true, data: payload as T };
}

/** "2:14 pm", from a created_at the strict parser accepts. */
export function formatSaveTime(createdAt: string): string {
  const date = parseSaveTimestamp(createdAt);
  if (!date) return "at a time that wasn't recorded";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).toLowerCase();
}

function downloadJson(fileName: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

interface Notice {
  tone: "info" | "error";
  title: string;
  lines: string[];
  offerDownload: boolean;
}

interface OpenProblem {
  message: string;
  raw?: { fileName: string; document: unknown };
}

type NoteId = "save" | "open" | "notice";

export function useCloudProjects({
  documentSession,
  readDocumentSession,
  dispatch,
  editorProjectName,
  buildProjectFile,
  applyCloudState,
  downloadProjectFile,
}: UseCloudProjectsOptions): { menuModel: CloudMenuModel; notes: ReactNode } {
  const auth = useOptionalAuth();
  const snapshot = auth?.session ?? null;
  const signedIn = Boolean(snapshot?.user);
  const mfaPending = Boolean(snapshot?.mfaPending);
  const actingAsEntitlement = snapshot?.entitlements.find((e) => e.companyId === snapshot.actingAsCompanyId) ?? null;
  const actingAs = actingAsEntitlement
    ? { companyId: actingAsEntitlement.companyId, companyName: actingAsEntitlement.companyName, source: actingAsEntitlement.source }
    : null;
  const { cloudContext } = documentSession;

  const [openNote, setOpenNote] = useState<NoteId | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState<NoteId | null>(null);
  const [busy, setBusy] = useState(false);

  const [dialogFolder, setDialogFolder] = useState<CloudFolder>("current");
  const [dialogLabel, setDialogLabel] = useState("");
  const [dialogError, setDialogError] = useState<{ message: string; offerDownload: boolean } | null>(null);

  const [tab, setTab] = useState<CloudFolder>("current");
  const [list, setList] = useState<ListProjectsResponse | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [openProblem, setOpenProblem] = useState<OpenProblem | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const [notice, setNotice] = useState<Notice | null>(null);

  const showNotice = (next: Notice) => {
    setNotice(next);
    setNoticeOpen(true);
  };

  const closeNote = (id: NoteId) => {
    if (id === "notice") setNoticeOpen(false);
    else setOpenNote((was) => (was === id ? null : was));
    setFullscreen((was) => (was === id ? null : was));
  };

  // --- A real change of signed-in account --------------------------------
  // Detach from the open cloud project (and void answers in flight) only when
  // a DIFFERENT account appears, or on an explicit sign-out through the app. A
  // guest reading of /api/session is not a sign-out: a getUser error or an
  // expired token produces one, and the editor re-reads the session after
  // every 401/403. Detaching on that would make the next Save to cloud offer a
  // new project and invite a duplicate. The design and its date always stay.
  const userId = snapshot?.user?.id ?? null;
  const lastKnownUserId = useRef<string | null>(null);

  const detachForAccountChange = useCallback(() => {
    dispatch({ type: "account-changed" });
    setList(null);
    setOpenProblem(null);
    setDialogError(null);
  }, [dispatch]);

  useEffect(() => {
    const next = trackSignedInAccount(lastKnownUserId.current, userId);
    lastKnownUserId.current = next.lastKnownUserId;
    if (next.detach) detachForAccountChange();
  }, [userId, detachForAccountChange]);

  useEffect(() => {
    const onSignedOut = () => {
      lastKnownUserId.current = null;
      detachForAccountChange();
    };
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut);
  }, [detachForAccountChange]);

  // --- Save --------------------------------------------------------------

  const openSaveDialog = () => {
    setDialogFolder("current");
    setDialogLabel("");
    setDialogError(null);
    setOpenNote("save");
  };

  const refuse = () => dispatch({ type: "cloud-refused" });

  const saveToOpenProject = async () => {
    const ctx = readDocumentSession().cloudContext;
    if (!ctx) {
      openSaveDialog();
      return;
    }
    if (busy) return;
    const sentAtGeneration = readDocumentSession().designGeneration;
    const file = buildProjectFile();
    if (isCertainlyTooLargeForCloud(JSON.stringify(file))) {
      refuse();
      showNotice({ tone: "error", title: "Not saved to the cloud", lines: [DOCUMENT_TOO_LARGE_MESSAGE], offerDownload: true });
      return;
    }
    setBusy(true);
    const result = await cloudFetch<SaveVersionResponse>(`/api/projects/${encodeURIComponent(ctx.projectId)}/versions`, {
      method: "POST",
      body: JSON.stringify({ parentVersionId: ctx.baseVersionId, document: file }),
    });
    setBusy(false);
    if (!result.ok) {
      refuse();
      if (result.status === 401 || result.status === 403) void auth?.refresh();
      showNotice({ tone: "error", title: "Not saved to the cloud", lines: [result.message], offerDownload: true });
      return;
    }
    const action: CloudSaveAction = {
      type: "cloud-save",
      sentAtGeneration,
      projectId: ctx.projectId,
      parentVersionId: ctx.baseVersionId,
      result: result.data,
    };
    const now = readDocumentSession();
    const applies = answerIsCurrent(now, action);
    dispatch(action);
    if (!applies) {
      // Two different reasons, worded differently: the design was replaced
      // (the generation moved), or it was not and a newer save from this
      // editor had already moved the base on.
      const replaced = now.designGeneration !== sentAtGeneration || !now.cloudContext;
      showNotice({
        tone: "info",
        title: "Saved to the cloud",
        lines: [
          replaced
            ? replacedWhileSavingNotice(result.data.versionNumber, file.state.projectName, null)
            : movedOnSaveNotice(result.data.versionNumber, now.cloudContext!.baseVersionNumber),
        ],
        offerDownload: false,
      });
      return;
    }
    const text = divergenceNotice({
      versionNumber: result.data.versionNumber,
      diverged: result.data.diverged,
      headBefore: result.data.headBefore,
      baseVersionNumber: ctx.baseVersionNumber,
      intervening: result.data.intervening,
      savedProjectName: file.state.projectName,
      formatTime: formatSaveTime,
    });
    showNotice({
      tone: "info",
      title: result.data.diverged ? "Saved: someone else saved too" : "Saved to the cloud",
      lines: text.detail ? [text.headline, text.detail] : [text.headline],
      offerDownload: false,
    });
  };

  const createFromDialog = async () => {
    // The company this dialog is displaying right now. If the cookie moved
    // under this tab, the server answers 409 instead of saving elsewhere.
    const expectedCompanyId = snapshot?.actingAsCompanyId;
    if (!expectedCompanyId || busy) return;
    const sentAtGeneration = readDocumentSession().designGeneration;
    const file = buildProjectFile();
    if (isCertainlyTooLargeForCloud(JSON.stringify(file))) {
      refuse();
      setDialogError({ message: DOCUMENT_TOO_LARGE_MESSAGE, offerDownload: true });
      return;
    }
    setBusy(true);
    setDialogError(null);
    const result = await cloudFetch<CreateProjectResponse>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ expectedCompanyId, folder: dialogFolder, label: dialogLabel, document: file }),
    });
    setBusy(false);
    if (!result.ok) {
      refuse();
      // 409: re-read the session so this dialog names the company the server
      // actually has, visibly, before anyone presses Save again.
      if (result.status === 409 || result.status === 401 || result.status === 403) void auth?.refresh();
      setDialogError({ message: result.message, offerDownload: result.status !== 409 });
      return;
    }
    const action: CloudCreateAction = { type: "cloud-create", sentAtGeneration, result: result.data };
    const applies = answerIsCurrent(readDocumentSession(), action);
    dispatch(action);
    closeNote("save");
    const where = `${result.data.companyName} › ${FOLDER_LABEL[result.data.folder]}`;
    showNotice({
      tone: "info",
      title: "Saved to the cloud",
      lines: [
        applies
          ? `Saved as version 1 of ${displayProjectName(file.state.projectName)} in ${where}.`
          : replacedWhileSavingNotice(1, file.state.projectName, where),
      ],
      offerDownload: false,
    });
  };

  // --- Open from cloud ---------------------------------------------------

  const loadList = useCallback(async (folder: CloudFolder) => {
    setListLoading(true);
    setListError(null);
    const result = await cloudFetch<ListProjectsResponse>(`/api/projects?folder=${folder}`);
    setListLoading(false);
    if (!result.ok) {
      setList(null);
      setListError(result.message);
      return;
    }
    setList(result.data);
  }, []);

  // Reloads when the note opens, the tab changes, or the acting-as company
  // changes (the tree follows the switcher; an open project does not).
  const actingAsCompanyId = snapshot?.actingAsCompanyId ?? null;
  useEffect(() => {
    if (openNote !== "open" || !userId || mfaPending) return;
    void loadList(tab);
  }, [openNote, tab, actingAsCompanyId, userId, mfaPending, loadList]);

  const openFromCloud = () => {
    setOpenProblem(null);
    setOpenNote("open");
  };

  const openRow = async (row: CloudProjectRow) => {
    setOpenProblem(null);
    if (!row.headVersionId) {
      setOpenProblem({ message: "This project's latest version couldn't be read just now. Try again." });
      return;
    }
    const sentAtGeneration = readDocumentSession().designGeneration;
    setRowBusy(row.id);
    const result = await cloudFetch<CloudVersionResponse>(
      `/api/projects/${encodeURIComponent(row.id)}/versions/${encodeURIComponent(row.headVersionId)}`,
    );
    setRowBusy(null);
    if (!result.ok) {
      refuse();
      if (result.status === 401 || result.status === 403) void auth?.refresh();
      setOpenProblem({ message: result.message });
      return;
    }
    const version = result.data;
    const raw = { fileName: cloudVersionFileName(version.projectName, version.versionNumber), document: version.document };
    const outcome = classifyCloudSchemaVersion(version.schemaVersion, version.versionNumber, PROJECT_FILE_VERSION);
    if (outcome.kind === "too-old" || outcome.kind === "too-new" || outcome.kind === "unreadable") {
      refuse();
      setOpenProblem({ message: outcome.message, raw: outcome.offerDownload ? raw : undefined });
      return;
    }
    const parsed = parseProjectFile(JSON.stringify(version.document));
    if (!parsed.ok) {
      refuse();
      setOpenProblem({ message: `Version ${version.versionNumber} couldn't be opened: ${parsed.error}`, raw });
      return;
    }
    // The date comes from the created_at column, never the document's savedAt.
    const action: CloudOpenAction = {
      type: "cloud-open",
      sentAtGeneration,
      version: {
        projectId: version.projectId,
        companyId: version.companyId,
        companyName: version.companyName,
        folder: version.folder,
        versionId: version.versionId,
        versionNumber: version.versionNumber,
        createdAt: version.createdAt,
      },
    };
    // Read the MIRROR, not rendered state: a Load dispatched a moment ago is
    // already counted here, even if React has not re-rendered yet.
    if (!answerIsCurrent(readDocumentSession(), action)) {
      refuse();
      setOpenProblem({
        message: `${displayProjectName(version.projectName)} wasn't opened: the design on screen was replaced while it was loading. Open it again if you still want it.`,
      });
      return;
    }
    // Role is ignored on a cloud open (decision 9): the viewer's own toggle wins.
    applyCloudState(parsed.state);
    dispatch(action);
    closeNote("open");
    const stale = staleOpenNotice(version.versionNumber, version.headVersionNumber);
    if (stale) showNotice({ tone: "info", title: "Opened an older version", lines: [stale], offerDownload: false });
  };

  const moveRow = async (row: CloudProjectRow, folder: CloudFolder) => {
    setOpenProblem(null);
    setRowBusy(row.id);
    const result = await cloudFetch<MoveProjectResponse>(`/api/projects/${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ folder }),
    });
    setRowBusy(null);
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) void auth?.refresh();
      setOpenProblem({ message: result.message });
    } else dispatch({ type: "cloud-moved", projectId: row.id, folder: result.data.folder });
    void loadList(tab);
  };

  // --- Model for the Project ▾ menu --------------------------------------

  const menu = buildCloudMenu({
    backendConfigured: Boolean(snapshot?.backendConfigured),
    loading: auth ? auth.loading : false,
    signedIn,
    mfaPending,
    actingAs,
    cloudProjectOpen: cloudContext !== null,
  });

  const menuModel: CloudMenuModel = {
    statusLines: cloudStatusLines(cloudContext, editorProjectName, actingAs),
    menu,
    busy,
    onSaveToCloud: () => void saveToOpenProject(),
    onSaveAsNew: openSaveDialog,
    onOpenFromCloud: openFromCloud,
    onSignIn: () => window.dispatchEvent(new CustomEvent(OPEN_ACCOUNT_CONTROL_EVENT)),
  };

  // --- Notes -------------------------------------------------------------

  const noteProps = (id: NoteId, cascadeIndex: number) => ({
    isOpen: id === "notice" ? noticeOpen : openNote === id,
    isFullscreen: fullscreen === id,
    cascadeIndex,
    onClose: () => closeNote(id),
    onToggleFullscreen: () => setFullscreen((was) => (was === id ? null : id)),
  });

  const canCreateHere = actingAs !== null && actingAs.source !== "consortium";
  const now = new Date();

  const notes = (
    <>
      <StickyNote id="cloud-save-note" label="Save to cloud" {...noteProps("save", 0)}>
        <div className={styles.stack}>
          {!signedIn ? (
            <p className={styles.message}>Sign in to save projects to the cloud.</p>
          ) : !actingAs ? (
            <p className={styles.message}>{NO_COMPANY_MESSAGE}</p>
          ) : !canCreateHere ? (
            <p className={styles.message}>{consortiumLaterStageMessage(actingAs.companyName)}</p>
          ) : (
            <>
              <p className={styles.lead}>
                New project in <strong>{actingAs.companyName}</strong> ›{" "}
                <select
                  className={styles.inlineSelect}
                  aria-label="Folder"
                  value={dialogFolder}
                  onChange={(e) => setDialogFolder(e.target.value as CloudFolder)}
                >
                  {CLOUD_FOLDERS.map((f) => (
                    <option key={f} value={f}>
                      {FOLDER_LABEL[f]}
                    </option>
                  ))}
                </select>
              </p>
              <p className={styles.muted}>
                The company is the one you are acting as. Name: <strong>{displayProjectName(editorProjectName)}</strong>, from
                the project name field.
              </p>
              <label className={styles.field}>
                Note (optional)
                <input
                  className={styles.input}
                  type="text"
                  maxLength={200}
                  value={dialogLabel}
                  onChange={(e) => setDialogLabel(e.target.value)}
                />
              </label>
            </>
          )}
          {dialogError && <p className={styles.error}>{dialogError.message}</p>}
          <div className={styles.actions}>
            {signedIn && canCreateHere && (
              <button type="button" className={styles.primary} disabled={busy} onClick={() => void createFromDialog()}>
                {busy ? "Saving…" : "Save"}
              </button>
            )}
            {dialogError?.offerDownload && (
              <button type="button" className={styles.button} onClick={downloadProjectFile}>
                Download project file
              </button>
            )}
            <button type="button" className={styles.button} onClick={() => closeNote("save")}>
              Cancel
            </button>
          </div>
        </div>
      </StickyNote>

      <StickyNote
        id="cloud-open-note"
        label={actingAs ? `Open from cloud · ${actingAs.companyName}` : "Open from cloud"}
        {...noteProps("open", 0)}
      >
        <div className={styles.stack}>
          {!signedIn ? (
            <p className={styles.message}>Sign in to open projects from the cloud.</p>
          ) : !actingAs ? (
            <p className={styles.message}>{NO_COMPANY_MESSAGE}</p>
          ) : actingAs.source === "consortium" ? (
            // Said in words; no empty tree dressed up as a real one.
            <p className={styles.message}>{consortiumLaterStageMessage(actingAs.companyName)}</p>
          ) : (
            <>
              <div className={styles.tabs} role="group" aria-label="Folder">
                {CLOUD_FOLDERS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={tab === f ? styles.tabActive : styles.tab}
                    aria-pressed={tab === f}
                    onClick={() => setTab(f)}
                  >
                    {FOLDER_LABEL[f]}
                  </button>
                ))}
              </div>
              {openProblem && (
                <div className={styles.stack}>
                  <p className={styles.error}>{openProblem.message}</p>
                  {openProblem.raw && (
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.button}
                        onClick={() => openProblem.raw && downloadJson(openProblem.raw.fileName, openProblem.raw.document)}
                      >
                        Download this version&apos;s file
                      </button>
                    </div>
                  )}
                </div>
              )}
              {listLoading && !list ? (
                <p className={styles.muted}>Loading…</p>
              ) : listError ? (
                <p className={styles.error}>{listError}</p>
              ) : list && list.projects.length === 0 ? (
                <p className={styles.muted}>No projects in {FOLDER_LABEL[tab]} yet.</p>
              ) : (
                <ul className={styles.rows}>
                  {(list?.projects ?? []).map((row) => {
                    const isOpenHere = cloudContext?.projectId === row.id;
                    return (
                      <li key={row.id} className={isOpenHere ? styles.rowOpen : styles.row}>
                        <span className={styles.rowTitle}>
                          {displayProjectName(row.name)}
                          {isOpenHere ? " (open in this editor)" : ""}
                        </span>
                        <span className={styles.rowMeta}>
                          v{row.headVersionNumber} · {row.headAuthorName ?? "author not recorded"} ·{" "}
                          {relativeSaveTime(row.updatedAt, now)}
                        </span>
                        <span className={styles.rowActions}>
                          <button
                            type="button"
                            className={styles.button}
                            disabled={rowBusy !== null}
                            onClick={() => void openRow(row)}
                          >
                            {rowBusy === row.id ? "Working…" : "Open"}
                          </button>
                          <select
                            className={styles.inlineSelect}
                            aria-label={`Move ${displayProjectName(row.name)} to another folder`}
                            value=""
                            disabled={rowBusy !== null}
                            onChange={(e) => {
                              if (e.target.value) void moveRow(row, e.target.value as CloudFolder);
                            }}
                          >
                            <option value="">Move to…</option>
                            {CLOUD_FOLDERS.filter((f) => f !== row.folder).map((f) => (
                              <option key={f} value={f}>
                                {FOLDER_LABEL[f]}
                              </option>
                            ))}
                          </select>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className={styles.muted}>Opening replaces the design on screen with the project&apos;s latest version.</p>
            </>
          )}
        </div>
      </StickyNote>

      <StickyNote id="cloud-notice-note" label={notice?.title ?? "Cloud"} {...noteProps("notice", 1)}>
        {notice && (
          <div className={styles.stack}>
            {notice.lines.map((line, i) => (
              <p key={i} className={notice.tone === "error" ? styles.error : i === 0 ? styles.lead : styles.message}>
                {line}
              </p>
            ))}
            <div className={styles.actions}>
              {notice.offerDownload && (
                <button type="button" className={styles.button} onClick={downloadProjectFile}>
                  Download project file
                </button>
              )}
              <button type="button" className={styles.button} onClick={() => closeNote("notice")}>
                Dismiss
              </button>
            </div>
          </div>
        )}
      </StickyNote>
    </>
  );

  return { menuModel, notes };
}
