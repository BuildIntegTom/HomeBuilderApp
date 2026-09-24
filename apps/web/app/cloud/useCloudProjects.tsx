"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import StickyNote from "../StickyNote";
import { OPEN_ACCOUNT_CONTROL_EVENT } from "../auth/AccountControl";
import { SIGNED_OUT_EVENT, useOptionalAuth } from "../auth/AuthProvider";
import { PROJECT_FILE_VERSION, parseProjectFile, parseRedactedProjectFile, type ProjectFile, type ProjectState } from "../projectFile";
import { parseSaveTimestamp } from "../titleBlockDate";
import { absoluteSaveTime, buildCloudMenu, cloudStatusLines, relativeSaveTime, type CloudMenu } from "./cloudMenu";
import {
  CLOUD_FOLDERS,
  DOCUMENT_TOO_LARGE_MESSAGE,
  FOLDER_LABEL,
  NAME_LENGTH_MESSAGE,
  NO_COMPANY_MESSAGE,
  PROJECT_NAME_MAX_CHARS,
  consortiumFolderTabsMessage,
  displayProjectName,
  isCertainlyTooLargeForCloud,
  seedTreeCostWarning,
  type BrowseCompaniesResponse,
  type BrowseCompany,
  type BrowseProjectRow,
  type BrowseProjectsResponse,
  type BrowseVersionResponse,
  type BrowseVersionsResponse,
  type CloudFolder,
  type CloudProjectRow,
  type CloudVersionResponse,
  type CreateProjectResponse,
  type ListProjectsResponse,
  type ListSharedProjectsResponse,
  type ListVersionsResponse,
  type MoveProjectResponse,
  type RenameProjectResponse,
  type SaveVersionResponse,
  type SharedProjectRow,
} from "./cloudTypes";
import { cloudFetch } from "./cloudFetch";
import { SHARED_TAB_LABEL, copyOwnedByLine, refileHeading, sharedEmptyLines, sharedRowDetail } from "./sharingDisplay";
import { useProjectAccess } from "./useProjectAccess";
import { useShareNotice } from "./useShareNotice";
import { divergenceNotice, movedOnSaveNotice, replacedWhileSavingNotice, staleOpenNotice } from "./divergenceNotice";
import {
  answerIsCurrent,
  renameOutcome,
  trackSignedInAccount,
  type BrowseOpenAction,
  type CloudCreateAction,
  type CloudOpenAction,
  type CloudRenameAction,
  type CloudSaveAction,
  type DocumentSession,
  type DocumentSessionAction,
} from "./documentSession";
import {
  BROWSE_CANNOT_SHOW_MESSAGE,
  BROWSE_EXPORT_ABSENT_NOTE,
  BROWSE_NO_COMPANIES_MESSAGE,
  BROWSE_TAB_LABEL,
  BROWSE_TAB_LEAD,
  browseBannerLines,
  browseEmptyFolderMessage,
  browseRowDetail,
  browseVersionListNotes,
  buildBrowseVersionRows,
  cannotShowFormatMessage,
} from "./browseDisplay";
import { classifyCloudSchemaVersion, cloudVersionFileName } from "./schemaOutcome";
import { buildHistoryRows, historySummary, openedOlderVersionNotice, renameNotice, type HistoryRowModel } from "./versionHistory";
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
 *
 * STAGE 2C adds Version history (reached from each tree row, from Project ▾
 * while a cloud project is open, and from a save notice), opening ANY version,
 * a raw download for versions outside this app's file-format window, and
 * Rename from the tree. Opening from history goes through the same
 * `openVersion` as the tree's Open, so it gets the same generation guard and
 * the same date writer; its base is the version opened, so the next Save to
 * cloud is a new version whose parent is that older one.
 */

/** What TopBar needs to render the Project ▾ cloud group and status line. */
export interface CloudMenuModel {
  statusLines: string[];
  menu: CloudMenu;
  busy: boolean;
  /** Stage 4B: a read-only browsed design is on screen. TopBar drops the local
   * Save Project while it is; the 3D views drop their OBJ buttons through
   * `BrowseModeProvider` rather than through this. */
  browsing: boolean;
  onSaveToCloud: () => void;
  onSaveAsNew: () => void;
  onOpenFromCloud: () => void;
  /** Stage 2C: the open project's Version history. */
  onVersionHistory: () => void;
  /** Stage 3B: the open project's access list and share form. */
  onSharing: () => void;
  /** Stage 3B: Move to… on the status line, into the OWNER's folders. Null
   * with no cloud project open. */
  refile: { heading: string; folder: CloudFolder; busy: boolean; onMove: (folder: CloudFolder) => void } | null;
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
  /** Stage 2C: a rename of the project open in this editor sets the name
   * field, so the next save keeps the new name instead of setting it back. */
  setEditorProjectName: (name: string) => void;
  /** The document exactly as Save Project would serialize it. */
  buildProjectFile: () => ProjectFile;
  /** Apply a parsed document to the editor, keeping the viewer's own role. */
  applyCloudState: (state: ProjectState) => void;
  /** Save Project: offered whenever a cloud save is refused, so work is never
   * stranded. */
  downloadProjectFile: () => void;
}

/**
 * Open from cloud's tabs: the three folders, Stage 3B's Shared with us, and
 * Stage 4B's Browse the consortium — the fifth.
 *
 * The fifth is offered ONLY while browsing is the acting-as state: the
 * entitlement you are acting through is the consortium one, or the company you
 * are acting as is itself a member company. Browsing is never ambient
 * (hand-test step 25), so acting as your own non-consortium company the tab is
 * not there at all.
 */
type OpenTab = CloudFolder | "shared" | "browse";

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
  /** The spec's "[Open version history]" link (2C), for this project. */
  history?: { projectId: string; projectName: string };
}

interface OpenProblem {
  message: string;
  raw?: { fileName: string; document: unknown };
}

type NoteId = "save" | "open" | "notice" | "history" | "browse";

/** "latest" is the tree's Open (head-only, 2B); "chosen" is a specific
 * version picked in Version history (2C). Only the notice differs. */
type OpenIntent = "latest" | "chosen";

export function useCloudProjects({
  documentSession,
  readDocumentSession,
  dispatch,
  editorProjectName,
  setEditorProjectName,
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
  const { cloudContext, browseContext } = documentSession;
  /**
   * Stage 4B. Browsing is the ACTING-AS STATE, never an ambient one: the fifth
   * tab exists only while the company you are acting as IS the Seed
   * Collaborative — through the consortium entitlement, or through a real
   * membership in it (a Seed member acting as Seed, the matrix's other Seed
   * row). Acting as your own company, member company or not, the tab is not
   * there at all; hand-test step 25 checks exactly that.
   *
   * It offers, it does not permit. Every browse function checks
   * `is_seed_entitled()` itself, in the database.
   */
  const canBrowse = actingAsEntitlement?.isConsortium === true;

  const [openNote, setOpenNote] = useState<NoteId | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState<NoteId | null>(null);
  const [busy, setBusy] = useState(false);

  const [dialogFolder, setDialogFolder] = useState<CloudFolder>("current");
  const [dialogLabel, setDialogLabel] = useState("");
  const [dialogError, setDialogError] = useState<{ message: string; offerDownload: boolean } | null>(null);

  const [tab, setTab] = useState<OpenTab>("current");
  const [list, setList] = useState<ListProjectsResponse | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  // Stage 3B: the Shared with us tab. Kept after the tab is left, so the
  // status line can still say how an opened shared project reached you.
  const [sharedList, setSharedList] = useState<ListSharedProjectsResponse | null>(null);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [sharedError, setSharedError] = useState<string | null>(null);
  // Stage 4B: the Browse the consortium tab. The company list, the picked
  // company and folder, and the rows. Kept separate from `list` so switching
  // tabs never shows one tree's rows under the other's heading.
  const [browseCompanies, setBrowseCompanies] = useState<BrowseCompany[] | null>(null);
  const [browseCompanyId, setBrowseCompanyId] = useState<string | null>(null);
  const [browseFolder, setBrowseFolder] = useState<CloudFolder>("current");
  const [browseList, setBrowseList] = useState<BrowseProjectsResponse | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  // The browse version list, in the same note Version history uses. Its own
  // state, because a browse history is not a `ListVersionsResponse` and must
  // never be rendered with Stage 2C's controls beside it (no Download this
  // version's file, no Rename, no Access…): browsing writes nothing, and the
  // raw download in particular would be a hole straight through decision 21.
  const [browseHistory, setBrowseHistory] = useState<BrowseVersionsResponse | null>(null);
  const [browseHistoryTarget, setBrowseHistoryTarget] = useState<BrowseProjectRow | null>(null);
  /** The browse banner's note. Opened by every successful browse open. */
  const [browseNoteOpen, setBrowseNoteOpen] = useState(false);
  /** Bumped to reload whichever tab is showing (after a move, rename, share or removal). */
  const [listNonce, setListNonce] = useState(0);
  const reloadTab = useCallback(() => setListNonce((n) => n + 1), []);
  const [openProblem, setOpenProblem] = useState<OpenProblem | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const [notice, setNotice] = useState<Notice | null>(null);

  // Stage 2C: Version history and rename.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<{ projectId: string; projectName: string } | null>(null);
  const [history, setHistory] = useState<ListVersionsResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyProblem, setHistoryProblem] = useState<OpenProblem | null>(null);
  const [historyBusy, setHistoryBusy] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ projectId: string; draft: string; error: string | null } | null>(null);
  /** Counts history requests, so a slower answer for an earlier request (a
   * different project, or before an account change) is never shown. */
  const historyRequest = useRef(0);
  /** The project whose history is on screen, readable after an await. */
  const historyShowing = useRef<string | null>(null);
  useEffect(() => {
    historyShowing.current = historyOpen && historyTarget ? historyTarget.projectId : null;
  }, [historyOpen, historyTarget]);

  // The banner belongs to the browsed design, so it goes when the design does
  // — a full open, a create, or a Load Project. It is NOT closed on an account
  // change, because `browseContext` deliberately survives one: the redacted
  // design is still on screen, so the statement about it is still true.
  const browsing = documentSession.browseContext !== null;
  useEffect(() => {
    if (!browsing) setBrowseNoteOpen(false);
  }, [browsing]);

  const showNotice = (next: Notice) => {
    setNotice(next);
    setNoticeOpen(true);
  };

  const closeNote = (id: NoteId) => {
    if (id === "notice") setNoticeOpen(false);
    else if (id === "history") setHistoryOpen(false);
    else if (id === "browse") setBrowseNoteOpen(false);
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

  // Stage 3B: the access list note. A share or removal reloads the tab.
  const refreshSession = useCallback(() => void auth?.refresh(), [auth]);
  const access = useProjectAccess({ onAuthProblem: refreshSession, onChanged: reloadTab });
  const resetAccess = access.reset;

  // Stage 3C: the "shared with you" notice. It lives here rather than beside
  // the account control (the handoff's suggestion) because both of its actions
  // already do: Open from cloud's Shared tab is this hook's own state, and the
  // session, cloudFetch and the 401/403 refresh are all in hand. Nothing is
  // added to the top bar either way.
  const openSharedTab = useCallback(() => {
    setTab("shared");
    setOpenNote("open");
  }, []);
  const shareNotice = useShareNotice({
    audience: { userId, mfaPending },
    onOpenSharedTab: openSharedTab,
    onAuthProblem: refreshSession,
  });

  const detachForAccountChange = useCallback(() => {
    dispatch({ type: "account-changed" });
    setList(null);
    setSharedList(null);
    setSharedError(null);
    // The consortium tree read by the old account is not left on screen for
    // the new one, which may not be seed-entitled at all. The DESIGN on screen
    // stays, and so does its browseContext, so the price gap stays with it.
    setBrowseCompanies(null);
    setBrowseCompanyId(null);
    setBrowseList(null);
    setBrowseError(null);
    setBrowseHistory(null);
    setBrowseHistoryTarget(null);
    resetAccess();
    setOpenProblem(null);
    setDialogError(null);
    // A history read by the old account is not left on screen for the new
    // one, and an answer still in flight for it is ignored.
    historyRequest.current += 1;
    setHistory(null);
    setHistoryTarget(null);
    setHistoryOpen(false);
    setHistoryLoading(false);
    setHistoryProblem(null);
    setRenaming(null);
  }, [dispatch, resetAccess]);

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

  // --- Version history (2C) ---------------------------------------------

  const loadHistory = useCallback(async (projectId: string) => {
    const request = ++historyRequest.current;
    setHistoryLoading(true);
    setHistoryError(null);
    const result = await cloudFetch<ListVersionsResponse>(`/api/projects/${encodeURIComponent(projectId)}/versions`);
    if (request !== historyRequest.current) return;
    setHistoryLoading(false);
    if (!result.ok) {
      setHistory(null);
      setHistoryError(result.message);
      return;
    }
    setHistory(result.data);
  }, []);

  const showHistory = (projectId: string, projectName: string) => {
    setHistoryTarget({ projectId, projectName });
    setHistory((was) => (was && was.projectId === projectId ? was : null));
    // The two lists share one note, so opening the Stage 2C one puts the browse
    // one down. Otherwise a browsed list could still be rendered underneath
    // with Stage 2C's Download and Rename beside it.
    setBrowseHistory(null);
    setBrowseHistoryTarget(null);
    setHistoryProblem(null);
    setHistoryOpen(true);
    void loadHistory(projectId);
  };

  /** After a save or rename of a project whose history is on screen. */
  const refreshHistoryIfShowing = (projectId: string) => {
    if (historyShowing.current === projectId) void loadHistory(projectId);
  };

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
    refreshHistoryIfShowing(ctx.projectId);
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
      latestKnownVersionNumber: ctx.latestKnownVersionNumber,
      intervening: result.data.intervening,
      savedProjectName: file.state.projectName,
      formatTime: formatSaveTime,
    });
    const startedOlder = ctx.latestKnownVersionNumber > ctx.baseVersionNumber;
    showNotice({
      tone: "info",
      title: !result.data.diverged ? "Saved to the cloud" : startedOlder ? "Saved from an older version" : "Saved: someone else saved too",
      lines: text.detail ? [text.headline, text.detail] : [text.headline],
      offerDownload: false,
      history: result.data.diverged ? { projectId: ctx.projectId, projectName: file.state.projectName } : undefined,
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

  const loadShared = useCallback(async () => {
    setSharedLoading(true);
    setSharedError(null);
    const result = await cloudFetch<ListSharedProjectsResponse>("/api/projects/shared");
    setSharedLoading(false);
    if (!result.ok) {
      setSharedList(null);
      setSharedError(result.message);
      return;
    }
    setSharedList(result.data);
  }, []);

  // --- Browse the consortium (4B) ----------------------------------------

  const loadBrowseCompanies = useCallback(async () => {
    setBrowseError(null);
    const result = await cloudFetch<BrowseCompaniesResponse>("/api/browse/companies");
    if (!result.ok) {
      setBrowseCompanies(null);
      setBrowseError(result.message);
      return;
    }
    setBrowseCompanies(result.data.companies);
  }, []);

  const loadBrowseProjects = useCallback(async (companyId: string, folder: CloudFolder) => {
    setBrowseLoading(true);
    setBrowseError(null);
    const result = await cloudFetch<BrowseProjectsResponse>(
      `/api/browse/projects?company=${encodeURIComponent(companyId)}&folder=${encodeURIComponent(folder)}`,
    );
    setBrowseLoading(false);
    if (!result.ok) {
      setBrowseList(null);
      setBrowseError(result.message);
      return;
    }
    setBrowseList(result.data);
  }, []);

  // Reloads when the note opens, the tab changes, or the acting-as company
  // changes (the tree follows the switcher; an open project does not).
  // Stage 3B: an account with no company has only the Shared tab.
  // Stage 4B: the fifth tab falls back to Shared the moment browsing stops
  // being the acting-as state, so switching company never leaves it selected.
  const actingAsCompanyId = snapshot?.actingAsCompanyId ?? null;
  const shownTab: OpenTab = tab === "browse" ? (canBrowse ? "browse" : "shared") : actingAs ? tab : "shared";
  useEffect(() => {
    if (openNote !== "open" || !userId || mfaPending) return;
    if (shownTab === "browse") {
      void loadBrowseCompanies();
      if (browseCompanyId) void loadBrowseProjects(browseCompanyId, browseFolder);
      return;
    }
    if (shownTab === "shared") void loadShared();
    else void loadList(shownTab);
  }, [
    openNote,
    shownTab,
    actingAsCompanyId,
    userId,
    mfaPending,
    loadList,
    loadShared,
    loadBrowseCompanies,
    loadBrowseProjects,
    browseCompanyId,
    browseFolder,
    listNonce,
  ]);

  const openFromCloud = () => {
    setOpenProblem(null);
    setOpenNote("open");
  };

  /**
   * The ONE open path, for the tree's Open (the head) and Version history's
   * Open (any version). Same generation guard, same date writer (cloud-open:
   * the version's created_at), same schema outcomes. Returns whether the
   * version was put on screen.
   */
  const openVersion = async (
    projectId: string,
    versionId: string,
    intent: OpenIntent,
    report: (problem: OpenProblem) => void,
  ): Promise<boolean> => {
    const sentAtGeneration = readDocumentSession().designGeneration;
    const result = await cloudFetch<CloudVersionResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}`,
    );
    if (!result.ok) {
      refuse();
      if (result.status === 401 || result.status === 403) void auth?.refresh();
      report({ message: result.message });
      return false;
    }
    const version = result.data;
    const raw = { fileName: cloudVersionFileName(version.projectName, version.versionNumber), document: version.document };
    const outcome = classifyCloudSchemaVersion(version.schemaVersion, version.versionNumber, PROJECT_FILE_VERSION);
    if (outcome.kind === "too-old" || outcome.kind === "too-new" || outcome.kind === "unreadable") {
      refuse();
      report({ message: outcome.message, raw: outcome.offerDownload ? raw : undefined });
      return false;
    }
    const parsed = parseProjectFile(JSON.stringify(version.document));
    if (!parsed.ok) {
      refuse();
      report({ message: `Version ${version.versionNumber} couldn't be opened: ${parsed.error}`, raw });
      return false;
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
        headVersionNumber: version.headVersionNumber,
      },
    };
    // Read the MIRROR, not rendered state: a Load dispatched a moment ago is
    // already counted here, even if React has not re-rendered yet.
    if (!answerIsCurrent(readDocumentSession(), action)) {
      refuse();
      report({
        message: `${displayProjectName(version.projectName)} wasn't opened: the design on screen was replaced while it was loading. Open it again if you still want it.`,
      });
      return false;
    }
    // Role is ignored on a cloud open (decision 9): the viewer's own toggle wins.
    applyCloudState(parsed.state);
    dispatch(action);
    const history = { projectId: version.projectId, projectName: version.projectName };
    if (intent === "latest") {
      const stale = staleOpenNotice(version.versionNumber, version.headVersionNumber);
      if (stale) showNotice({ tone: "info", title: "Opened an older version", lines: [stale], offerDownload: false, history });
    } else {
      const older = openedOlderVersionNotice({
        versionNumber: version.versionNumber,
        headVersionNumber: version.headVersionNumber,
        projectName: version.projectName,
        authorName: version.authorName,
        savedWhen: absoluteSaveTime(version.createdAt),
      });
      if (older) showNotice({ tone: "info", title: "Opened an older version", lines: [older], offerDownload: false, history });
    }
    return true;
  };

  /**
   * THE BROWSE OPEN. Its own path, beside `openVersion`, and the differences
   * are all deliberate:
   *
   *   * it calls `/api/browse/...`, which is `browse_version`, which ALWAYS
   *     redacts. The Stage 2 version route is never used here, and there is no
   *     fallback to it — not on a refusal, not on a `full` row, not ever;
   *   * it parses with `parseRedactedProjectFile`, because `priceModifier` is a
   *     required key and a stripped document would otherwise be rejected as
   *     corrupt;
   *   * it dispatches `browse-open`, which CLEARS `cloudContext`, so no save
   *     path can attach to what it put on screen;
   *   * it offers NO raw download when a version cannot be shown. Stage 2C's
   *     honest "Download this version's file" hands over the untouched stored
   *     document; copied here it would be a hole straight through decision 21.
   */
  const openBrowsedVersion = async (
    row: Pick<BrowseProjectRow, "projectId" | "name" | "folder" | "ownerCompanyId" | "ownerCompanyName">,
    versionId: string,
    report: (problem: OpenProblem) => void,
  ): Promise<boolean> => {
    const sentAtGeneration = readDocumentSession().designGeneration;
    const result = await cloudFetch<BrowseVersionResponse>(
      `/api/browse/projects/${encodeURIComponent(row.projectId)}/versions/${encodeURIComponent(versionId)}`,
    );
    if (!result.ok) {
      refuse();
      if (result.status === 401 || result.status === 403) void auth?.refresh();
      // 422 is the redactor's own refusal (SQLSTATE 0A000): a file format it
      // has no classification for. It is FINAL — it is not a reason to reach
      // for the Stage 2 route, which would serve the untouched document.
      report({ message: result.status === 422 ? BROWSE_CANNOT_SHOW_MESSAGE : result.message });
      return false;
    }
    const version = result.data;
    // No `raw` on any of these, at any point: nothing is offered in place of a
    // version that cannot be shown except the fact that it cannot.
    const outcome = classifyCloudSchemaVersion(version.schemaVersion, version.versionNumber, PROJECT_FILE_VERSION);
    if (outcome.kind !== "opens" && outcome.kind !== "opens-via-migration") {
      refuse();
      report({ message: cannotShowFormatMessage(version.schemaVersion) });
      return false;
    }
    const parsed = parseRedactedProjectFile(JSON.stringify(version.document));
    if (!parsed.ok) {
      refuse();
      report({ message: `Version ${version.versionNumber} couldn't be opened: ${parsed.error}` });
      return false;
    }
    const action: BrowseOpenAction = {
      type: "browse-open",
      sentAtGeneration,
      version: {
        projectId: version.projectId,
        ownerCompanyId: version.ownerCompanyId,
        ownerCompanyName: version.ownerCompanyName,
        folder: version.folder,
        versionId: version.versionId,
        versionNumber: version.versionNumber,
        createdAt: version.createdAt,
        projectName: row.name,
      },
    };
    if (!answerIsCurrent(readDocumentSession(), action)) {
      refuse();
      report({
        message: `${displayProjectName(row.name)} wasn't opened: the design on screen was replaced while it was loading. Open it again if you still want it.`,
      });
      return false;
    }
    // Role is ignored here too (decision 9), and the price is NaN in the state
    // this applies: every price display is gated on `costsRedacted`, and the
    // NaN is what a missed gate would show instead of a plausible number.
    applyCloudState(parsed.state);
    dispatch(action);
    // The banner, every time: it is the first thing said about a design that
    // is not yours, and it is said again on the Project ▾ status line for as
    // long as the design is on screen.
    setBrowseNoteOpen(true);
    return true;
  };

  /**
   * A browse row's **Open**, which is the row's ordinary action.
   *
   * A row the database marked `full` opens through the STAGE 2 route, WITH
   * costs (Open Item 2, answered): the caller can already read it — membership,
   * a grant, or platform admin — and showing them their own project's price as
   * `—` would be a worse answer than the real one. This is which request to
   * send, not which permission to apply: RLS decides the Stage 2 read, and
   * `browse_version` would redact the same project either way.
   *
   * ⚠ THE BROWSE PATH IS STILL ALWAYS REDACTED, AND IT IS REACHABLE FROM HERE.
   * **Versions** on the same row goes through `browse_version`, which redacts
   * for every caller including this one — so a Building Integrity member acting
   * as Seed who opens a Building Integrity version that way sees `—`, which is
   * decision 20's ownership rule and Open Item 7 working, not a bug. Hand-test
   * step 18 is where Tommy looks at that before it is final.
   */
  const openBrowseRow = async (row: BrowseProjectRow) => {
    setOpenProblem(null);
    if (!row.headVersionId) {
      setOpenProblem({ message: "This project's latest version couldn't be read just now. Try again." });
      return;
    }
    if (row.access === "redacted" && !row.headRedactionKnown) {
      setOpenProblem({ message: cannotShowFormatMessage(row.headSchemaVersion ?? PROJECT_FILE_VERSION) });
      return;
    }
    setRowBusy(row.projectId);
    const opened =
      row.access === "full"
        ? await openVersion(row.projectId, row.headVersionId, "latest", setOpenProblem)
        : await openBrowsedVersion(row, row.headVersionId, setOpenProblem);
    setRowBusy(null);
    if (opened) closeNote("open");
  };

  // --- The version list while browsing (4B) -------------------------------

  const loadBrowseHistory = useCallback(async (projectId: string) => {
    const request = ++historyRequest.current;
    setHistoryLoading(true);
    setHistoryError(null);
    const result = await cloudFetch<BrowseVersionsResponse>(`/api/browse/projects/${encodeURIComponent(projectId)}/versions`);
    if (request !== historyRequest.current) return;
    setHistoryLoading(false);
    if (!result.ok) {
      setBrowseHistory(null);
      setHistoryError(result.message);
      return;
    }
    setBrowseHistory(result.data);
  }, []);

  const showBrowseHistory = (row: BrowseProjectRow) => {
    setBrowseHistoryTarget(row);
    setHistoryTarget({ projectId: row.projectId, projectName: row.name });
    setHistory(null);
    setBrowseHistory((was) => (was && was.projectId === row.projectId ? was : null));
    setHistoryProblem(null);
    setHistoryOpen(true);
    void loadBrowseHistory(row.projectId);
  };

  const openBrowseHistoryRow = async (versionId: string) => {
    const target = browseHistoryTarget;
    if (!target) return;
    setHistoryProblem(null);
    setHistoryBusy(versionId);
    const opened = await openBrowsedVersion(target, versionId, setHistoryProblem);
    setHistoryBusy(null);
    if (opened) {
      closeNote("history");
      closeNote("open");
    }
  };

  const openRow = async (row: CloudProjectRow) => {
    setOpenProblem(null);
    if (!row.headVersionId) {
      setOpenProblem({ message: "This project's latest version couldn't be read just now. Try again." });
      return;
    }
    setRowBusy(row.id);
    const opened = await openVersion(row.id, row.headVersionId, "latest", setOpenProblem);
    setRowBusy(null);
    if (opened) closeNote("open");
    // A share removed while this list was open: the 404 is shown, and the
    // list is re-read so the row goes.
    else if (shownTab === "shared") reloadTab();
  };

  const openHistoryRow = async (row: HistoryRowModel) => {
    if (!historyTarget) return;
    setHistoryProblem(null);
    setHistoryBusy(row.versionId);
    const opened = await openVersion(historyTarget.projectId, row.versionId, "chosen", setHistoryProblem);
    setHistoryBusy(null);
    if (opened) {
      closeNote("history");
      closeNote("open");
    }
  };

  /** The untouched stored file, for a version this app cannot open. Changes
   * nothing on screen, so it writes no date and needs no generation guard. */
  const downloadHistoryRow = async (row: HistoryRowModel) => {
    if (!historyTarget) return;
    setHistoryProblem(null);
    setHistoryBusy(row.versionId);
    const result = await cloudFetch<CloudVersionResponse>(
      `/api/projects/${encodeURIComponent(historyTarget.projectId)}/versions/${encodeURIComponent(row.versionId)}`,
    );
    setHistoryBusy(null);
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) void auth?.refresh();
      setHistoryProblem({ message: result.message });
      return;
    }
    downloadJson(cloudVersionFileName(result.data.projectName, result.data.versionNumber), result.data.document);
  };

  // --- Rename from the tree (2C) -----------------------------------------

  const startRename = (row: CloudProjectRow) => {
    setOpenProblem(null);
    setRenaming({ projectId: row.id, draft: row.name, error: null });
  };

  const submitRename = async (row: CloudProjectRow) => {
    if (!renaming || renaming.projectId !== row.id || busy || rowBusy !== null) return;
    const name = renaming.draft.trim();
    if ([...name].length < 1 || [...name].length > PROJECT_NAME_MAX_CHARS) {
      setRenaming({ ...renaming, error: NAME_LENGTH_MESSAGE });
      return;
    }
    // Unchanged: appending a version that changes nothing would only add noise.
    if (name === row.name) {
      setRenaming(null);
      return;
    }
    const sentAtGeneration = readDocumentSession().designGeneration;
    // `busy` too: a Save to cloud sent while this rename is in flight would
    // name a base the rename is about to move, and carry the old name.
    setBusy(true);
    setRowBusy(row.id);
    const result = await cloudFetch<RenameProjectResponse>(`/api/projects/${encodeURIComponent(row.id)}/rename`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    setRowBusy(null);
    setBusy(false);
    if (!result.ok) {
      refuse();
      if (result.status === 401 || result.status === 403) void auth?.refresh();
      setRenaming((was) => (was && was.projectId === row.id ? { ...was, error: result.message } : was));
      return;
    }
    const action: CloudRenameAction = { type: "cloud-rename", sentAtGeneration, projectId: row.id, result: result.data };
    const before = readDocumentSession();
    const outcome = renameOutcome(before, action);
    dispatch(action);
    if (outcome === "base-moved" || outcome === "base-stays") setEditorProjectName(result.data.name);
    setRenaming(null);
    reloadTab();
    refreshHistoryIfShowing(row.id);
    showNotice({
      tone: "info",
      title: "Renamed",
      lines: [
        renameNotice({
          outcome,
          name: result.data.name,
          versionNumber: result.data.versionNumber,
          renamedFromVersionNumber: result.data.renamedFromVersionNumber,
          editorVersionNumber: before.cloudContext?.baseVersionNumber ?? null,
        }),
      ],
      offerDownload: false,
      history: { projectId: row.id, projectName: result.data.name },
    });
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
    reloadTab();
  };

  /** Stage 3B: Move to… on the status line, for the project open here. */
  const moveOpenProject = async (folder: CloudFolder) => {
    const ctx = readDocumentSession().cloudContext;
    if (!ctx || rowBusy !== null) return;
    setRowBusy(ctx.projectId);
    const result = await cloudFetch<MoveProjectResponse>(`/api/projects/${encodeURIComponent(ctx.projectId)}`, {
      method: "PATCH",
      body: JSON.stringify({ folder }),
    });
    setRowBusy(null);
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) void auth?.refresh();
      showNotice({ tone: "error", title: "Not moved", lines: [result.message], offerDownload: false });
      return;
    }
    dispatch({ type: "cloud-moved", projectId: ctx.projectId, folder: result.data.folder });
    showNotice({
      tone: "info",
      title: "Moved",
      lines: [`Refiled in ${ctx.companyName} › ${FOLDER_LABEL[result.data.folder]}. Nothing was saved; this is filing only.`],
      offerDownload: false,
    });
    reloadTab();
  };

  // --- Model for the Project ▾ menu --------------------------------------

  const menu = buildCloudMenu({
    backendConfigured: Boolean(snapshot?.backendConfigured),
    loading: auth ? auth.loading : false,
    signedIn,
    mfaPending,
    actingAs,
    cloudProjectOpen: cloudContext !== null,
    browsing: browseContext !== null,
  });

  // How the open project reached you, when the Shared tab listed it.
  const openReach = cloudContext ? (sharedList?.projects.find((p) => p.id === cloudContext.projectId)?.reachedVia ?? []) : [];

  const menuModel: CloudMenuModel = {
    statusLines: cloudStatusLines(cloudContext, editorProjectName, actingAs, openReach, browseContext),
    menu,
    busy,
    // Stage 4B: TopBar drops the local Save Project while this is true. The
    // honest reading of decision 23 — the app does not hand you a copy; it
    // does not, and this comment does not, claim to stop you taking one.
    browsing: browseContext !== null,
    onSaveToCloud: () => void saveToOpenProject(),
    onSaveAsNew: openSaveDialog,
    onOpenFromCloud: openFromCloud,
    onVersionHistory: () => {
      const ctx = readDocumentSession().cloudContext;
      if (ctx) showHistory(ctx.projectId, editorProjectName);
    },
    onSharing: () => {
      const ctx = readDocumentSession().cloudContext;
      if (ctx) access.openAccess(ctx.projectId, editorProjectName);
    },
    refile: cloudContext
      ? {
          heading: refileHeading(cloudContext.companyName),
          folder: cloudContext.folder,
          busy: rowBusy !== null,
          onMove: (folder) => void moveOpenProject(folder),
        }
      : null,
    onSignIn: () => window.dispatchEvent(new CustomEvent(OPEN_ACCOUNT_CONTROL_EVENT)),
  };

  // --- Notes -------------------------------------------------------------

  const noteProps = (id: NoteId, cascadeIndex: number) => ({
    isOpen: id === "notice" ? noticeOpen : id === "history" ? historyOpen : id === "browse" ? browseNoteOpen : openNote === id,
    isFullscreen: fullscreen === id,
    cascadeIndex,
    onClose: () => closeNote(id),
    onToggleFullscreen: () => setFullscreen((was) => (was === id ? null : id)),
  });

  // Stage 3D: a consortium entitlement creates in the consortium's own tree.
  const canCreateHere = actingAs !== null;
  const now = new Date();
  const shownHistory = history && historyTarget && history.projectId === historyTarget.projectId ? history : null;
  const shownBrowseHistory =
    browseHistory && browseHistoryTarget && browseHistory.projectId === browseHistoryTarget.projectId ? browseHistory : null;
  const historyRows = shownHistory ? buildHistoryRows(shownHistory, cloudContext, PROJECT_FILE_VERSION) : [];
  const historyName = shownHistory ? shownHistory.projectName : (historyTarget?.projectName ?? "");

  /**
   * One Open from cloud row. A folder row (2B/2C) and a Shared row (3B) differ
   * only in the owner line and the Move to… picker: a Shared row's folders are
   * the OWNER's, and the picker says so. Every row gets Access… (3B).
   */
  const renderRow = (row: CloudProjectRow | SharedProjectRow, shared: SharedProjectRow | null) => {
    const isOpenHere = cloudContext?.projectId === row.id;
    const renamingThis = renaming?.projectId === row.id ? renaming : null;
    const name = displayProjectName(row.name);
    return (
      <li key={row.id} className={isOpenHere ? styles.rowOpen : styles.row} data-project-id={row.id}>
        <span className={styles.rowTitle}>
          {name}
          {isOpenHere ? " (open in this editor)" : ""}
        </span>
        <span className={styles.rowMeta}>
          v{row.headVersionNumber} · {row.headAuthorName ?? "author not recorded"} · {relativeSaveTime(row.updatedAt, now)}
        </span>
        {shared && (
          <span className={styles.rowMeta} data-shared-detail="">
            {sharedRowDetail(shared)}
          </span>
        )}
        <span className={styles.rowActions}>
          <button type="button" className={styles.button} disabled={rowBusy !== null} onClick={() => void openRow(row)}>
            {rowBusy === row.id ? "Working…" : "Open"}
          </button>
          <button
            type="button"
            className={styles.button}
            title="Every saved version of this project: who saved it and when. Any of them can be opened."
            onClick={() => showHistory(row.id, row.name)}
          >
            Versions
          </button>
          {shared ? (
            <select
              className={styles.inlineSelect}
              aria-label={`Move ${name}: ${refileHeading(shared.ownerCompanyName)}`}
              value=""
              disabled={rowBusy !== null}
              onChange={(e) => {
                if (e.target.value) void moveRow(row, e.target.value as CloudFolder);
              }}
            >
              <option value="">Move to…</option>
              <optgroup label={refileHeading(shared.ownerCompanyName)}>
                {CLOUD_FOLDERS.map((f) => (
                  <option key={f} value={f} disabled={f === row.folder}>
                    {FOLDER_LABEL[f]}
                    {f === row.folder ? " (here now)" : ""}
                  </option>
                ))}
              </optgroup>
            </select>
          ) : (
            <select
              className={styles.inlineSelect}
              aria-label={`Move ${name} to another folder`}
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
          )}
          {!renamingThis && (
            <button
              type="button"
              className={styles.button}
              title="Rename this project. Adds a version marked Renamed; earlier versions keep their old name."
              disabled={rowBusy !== null || busy}
              onClick={() => startRename(row)}
            >
              Rename
            </button>
          )}
          <button
            type="button"
            className={styles.button}
            title="Who has access to this project, and share it with a person or a company"
            onClick={() => access.openAccess(row.id, row.name)}
          >
            Access…
          </button>
        </span>
        {renamingThis && (
          <form
            className={styles.renameForm}
            onSubmit={(e) => {
              e.preventDefault();
              void submitRename(row);
            }}
          >
            <input
              className={styles.input}
              type="text"
              aria-label={`New name for ${name}`}
              maxLength={PROJECT_NAME_MAX_CHARS}
              value={renamingThis.draft}
              autoFocus
              onChange={(e) => setRenaming({ ...renamingThis, draft: e.target.value, error: null })}
            />
            <button type="submit" className={styles.primary} disabled={rowBusy !== null || busy}>
              {rowBusy === row.id ? "Renaming…" : "Save name"}
            </button>
            <button type="button" className={styles.button} disabled={rowBusy === row.id} onClick={() => setRenaming(null)}>
              Cancel
            </button>
          </form>
        )}
        {renamingThis?.error && <p className={styles.error}>{renamingThis.error}</p>}
      </li>
    );
  };

  /**
   * One Browse the consortium row (4B). Deliberately short on controls: Open,
   * Versions, and nothing else. No Move to…, no Rename, no Access… — browsing
   * writes nothing — and NO DOWNLOAD OF ANY KIND, including for a version that
   * cannot be shown, where Stage 2C would offer the raw file.
   */
  const renderBrowseRow = (row: BrowseProjectRow) => {
    const isOpenHere = browseContext?.projectId === row.projectId || cloudContext?.projectId === row.projectId;
    const name = displayProjectName(row.name);
    const cannotShow = row.access === "redacted" && !row.headRedactionKnown;
    return (
      <li key={row.projectId} className={isOpenHere ? styles.rowOpen : styles.row} data-project-id={row.projectId}>
        <span className={styles.rowTitle}>
          {name}
          {isOpenHere ? " (open in this editor)" : ""}
        </span>
        <span className={styles.rowMeta}>
          v{row.headVersionNumber} · {/* Already masked in SQL when it was an email address. Shown as it
              came back: "a member of Rare Forms" is a real value, not a blank
              to paper over. */}
          {row.headAuthorName ?? "author not recorded"} · {relativeSaveTime(row.updatedAt, now)}
        </span>
        <span className={styles.rowMeta} data-browse-detail="">
          {browseRowDetail(row)}
        </span>
        {cannotShow && (
          <p className={styles.rowLabel} data-browse-cannot-show="">
            {cannotShowFormatMessage(row.headSchemaVersion ?? PROJECT_FILE_VERSION)}
          </p>
        )}
        <span className={styles.rowActions}>
          {!cannotShow && (
            <button type="button" className={styles.button} disabled={rowBusy !== null} onClick={() => void openBrowseRow(row)}>
              {rowBusy === row.projectId ? "Working…" : "Open"}
            </button>
          )}
          <button
            type="button"
            className={styles.button}
            title="Every saved version of this project: who saved it and when. They open read-only, with costs removed."
            onClick={() => showBrowseHistory(row)}
          >
            Versions
          </button>
        </span>
      </li>
    );
  };

  const notes = (
    <>
      <StickyNote id="cloud-save-note" label="Save to cloud" {...noteProps("save", 0)}>
        <div className={styles.stack}>
          {!signedIn ? (
            <p className={styles.message}>Sign in to save projects to the cloud.</p>
          ) : !actingAs ? (
            <p className={styles.message}>{NO_COMPANY_MESSAGE}</p>
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
              {/* Stage 3D / Open Item 5: ONE line, only in the consortium's
                  tree. Creating there hands your price modifier to its members,
                  and nothing redacts it. */}
              {actingAs.source === "consortium" && (
                <p className={styles.muted} data-seed-cost-warning="">
                  {seedTreeCostWarning(actingAs.companyName)}
                </p>
              )}
              <p className={styles.muted}>
                The company is the one you are acting as. Name: <strong>{displayProjectName(editorProjectName)}</strong>, from
                the project name field.
              </p>
              {/* Stage 3B: from another company's (shared) project, this is a copy. */}
              {cloudContext && cloudContext.companyId !== actingAs.companyId && (
                <p className={styles.muted} data-copy-note="">
                  {copyOwnedByLine(actingAs.companyName, cloudContext.companyName)}
                </p>
              )}
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
          ) : (
            <>
              <div className={styles.tabs} role="group" aria-label="Folder">
                {/* No company: only Shared with us (a personal grant needs none). */}
                {actingAs &&
                  CLOUD_FOLDERS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={shownTab === f ? styles.tabActive : styles.tab}
                      aria-pressed={shownTab === f}
                      onClick={() => setTab(f)}
                    >
                      {FOLDER_LABEL[f]}
                    </button>
                  ))}
                <button
                  type="button"
                  className={shownTab === "shared" ? styles.tabActive : styles.tab}
                  aria-pressed={shownTab === "shared"}
                  onClick={() => setTab("shared")}
                >
                  {SHARED_TAB_LABEL}
                </button>
                {/* Stage 4B, the fifth tab. Present only while the company you
                    are acting as IS the consortium: browsing is the acting-as
                    state, never an ambient one (hand-test step 25). */}
                {canBrowse && (
                  <button
                    type="button"
                    className={shownTab === "browse" ? styles.tabActive : styles.tab}
                    aria-pressed={shownTab === "browse"}
                    data-browse-tab=""
                    onClick={() => setTab("browse")}
                  >
                    {BROWSE_TAB_LABEL}
                  </button>
                )}
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
              {shownTab === "browse" ? (
                // Stage 4B. Every member company, then that company's three
                // folders. No Move to…, no Rename, no Access…: browsing writes
                // nothing, and none of those would be the browser's to press.
                <div className={styles.stack} data-browse-panel="">
                  <p className={styles.muted}>{BROWSE_TAB_LEAD}</p>
                  {browseError && <p className={styles.error}>{browseError}</p>}
                  {browseCompanies === null ? (
                    <p className={styles.muted}>Loading…</p>
                  ) : browseCompanies.length === 0 ? (
                    <p className={styles.muted}>{BROWSE_NO_COMPANIES_MESSAGE}</p>
                  ) : (
                    <>
                      <div className={styles.tabs} role="group" aria-label="Member company">
                        {browseCompanies.map((company) => (
                          <button
                            key={company.id}
                            type="button"
                            className={browseCompanyId === company.id ? styles.tabActive : styles.tab}
                            aria-pressed={browseCompanyId === company.id}
                            data-browse-company={company.id}
                            onClick={() => {
                              setBrowseCompanyId(company.id);
                              setBrowseList(null);
                              setOpenProblem(null);
                            }}
                          >
                            {company.name}
                          </button>
                        ))}
                      </div>
                      {browseCompanyId === null ? (
                        <p className={styles.muted}>Pick a company to see its three folders.</p>
                      ) : (
                        <>
                          <div className={styles.tabs} role="group" aria-label="Folder">
                            {CLOUD_FOLDERS.map((f) => (
                              <button
                                key={f}
                                type="button"
                                className={browseFolder === f ? styles.tabActive : styles.tab}
                                aria-pressed={browseFolder === f}
                                onClick={() => {
                                  setBrowseFolder(f);
                                  setOpenProblem(null);
                                }}
                              >
                                {FOLDER_LABEL[f]}
                              </button>
                            ))}
                          </div>
                          {browseLoading && !browseList ? (
                            <p className={styles.muted}>Loading…</p>
                          ) : browseList && browseList.projects.length === 0 ? (
                            <p className={styles.muted}>
                              {browseEmptyFolderMessage(
                                browseCompanies.find((c) => c.id === browseCompanyId)?.name ?? "That company",
                                browseFolder,
                              )}
                            </p>
                          ) : (
                            <ul className={styles.rows} data-browse-list="">
                              {(browseList?.projects ?? []).map(renderBrowseRow)}
                            </ul>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              ) : shownTab === "shared" ? (
                // Stage 3B. No folders of its own: every row prints the owner's.
                sharedLoading && !sharedList ? (
                  <p className={styles.muted}>Loading…</p>
                ) : sharedError ? (
                  <p className={styles.error}>{sharedError}</p>
                ) : sharedList && sharedList.projects.length === 0 ? (
                  <div className={styles.stack} data-shared-empty="">
                    {sharedEmptyLines(snapshot?.entitlements.length ?? 0).map((line) => (
                      <p key={line} className={styles.muted}>
                        {line}
                      </p>
                    ))}
                  </div>
                ) : (
                  <ul className={styles.rows} data-shared-list="">
                    {(sharedList?.projects ?? []).map((row) => renderRow(row, row))}
                  </ul>
                )
              ) : actingAs && actingAs.source === "consortium" ? (
                // Said in words; no empty tree dressed up as a real one. Stage
                // 4B replaced this sentence: its own tree IS readable now, on
                // the browse tab, so it points there instead of at a stage.
                <p className={styles.message}>{consortiumFolderTabsMessage(actingAs.companyName)}</p>
              ) : listLoading && !list ? (
                <p className={styles.muted}>Loading…</p>
              ) : listError ? (
                <p className={styles.error}>{listError}</p>
              ) : list && list.projects.length === 0 ? (
                <p className={styles.muted}>No projects in {FOLDER_LABEL[shownTab]} yet.</p>
              ) : (
                <ul className={styles.rows}>{(list?.projects ?? []).map((row) => renderRow(row, null))}</ul>
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
              {notice.history && (
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => notice.history && showHistory(notice.history.projectId, notice.history.projectName)}
                >
                  Open version history
                </button>
              )}
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

      {/* Stage 2C. Rendered LAST: notes share one z-index, so DOM order decides
          stacking, and history must land on top of the tree it was opened
          from and of the notice whose link opened it. Cascade 0, like the
          tree, so it stays inside a 360px screen (cascade 1 already overhangs
          by 2px there, and the notice keeps 2B's cascade 1 unchanged). */}
      <StickyNote
        id="cloud-history-note"
        label={`Version history · ${displayProjectName(historyName)}`}
        {...noteProps("history", 0)}
      >
        <div className={styles.stack}>
          {historyProblem && (
            <div className={styles.stack}>
              <p className={styles.error}>{historyProblem.message}</p>
              {historyProblem.raw && (
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.button}
                    onClick={() => historyProblem.raw && downloadJson(historyProblem.raw.fileName, historyProblem.raw.document)}
                  >
                    Download this version&apos;s file
                  </button>
                </div>
              )}
            </div>
          )}
          {historyLoading && !shownBrowseHistory && !shownHistory ? (
            <p className={styles.muted}>Loading…</p>
          ) : historyError ? (
            <p className={styles.error}>{historyError}</p>
          ) : shownBrowseHistory ? (
            // Stage 4B. THE ALWAYS-REDACTING PATH: every row here opens through
            // `browse_version`, including a project this account could read in
            // full — which is decision 20's ownership rule (Open Item 7) and is
            // what hand-test step 18 looks at. No save notes (they are not
            // served at all on this path), no Download of any kind, no Rename,
            // no Access….
            <>
              {/* The second line appears only on a `full` row, where the two
                  doors really do answer differently. `browseHistoryTarget` is
                  the row itself, already in hand from `showBrowseHistory`, so
                  its `access` needs no extra request. */}
              {browseVersionListNotes(browseHistoryTarget?.access ?? "redacted").map((line) => (
                <p key={line} className={styles.muted} data-browse-history-note="">
                  {line}
                </p>
              ))}
              <ul className={styles.rows} data-browse-history="">
                {buildBrowseVersionRows(shownBrowseHistory.versions, PROJECT_FILE_VERSION).map((row) => (
                  <li key={row.versionId} className={styles.row} data-version-number={row.versionNumber}>
                    <span className={styles.rowTitle}>
                      v{row.versionNumber} · {row.title}
                    </span>
                    <span className={styles.rowMeta}>
                      {row.authorName} · {absoluteSaveTime(row.createdAt)}
                    </span>
                    {row.cannotShowReason && (
                      <p className={styles.rowLabel} data-browse-cannot-show="">
                        {row.cannotShowReason}
                      </p>
                    )}
                    <span className={styles.rowActions}>
                      {row.canOpen && (
                        <button
                          type="button"
                          className={styles.button}
                          disabled={historyBusy !== null}
                          onClick={() => void openBrowseHistoryRow(row.versionId)}
                        >
                          {historyBusy === row.versionId ? "Working…" : "Open"}
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <p className={styles.muted}>
                Opening replaces the design on screen with that version, read-only and with costs removed.
              </p>
            </>
          ) : shownHistory ? (
            <>
              <p className={styles.muted}>{historySummary(shownHistory)}</p>
              <ul className={styles.rows}>
                {historyRows.map((row) => (
                  <li key={row.versionId} className={row.isBase ? styles.rowOpen : styles.row} data-version-number={row.versionNumber}>
                    <span className={styles.rowHeading}>
                      <span className={styles.rowTitle}>
                        v{row.versionNumber} · {row.title}
                      </span>
                      {row.isLatest && <span className={styles.marker}>latest</span>}
                      {row.isBase && <span className={styles.markerBase}>you started from this one</span>}
                    </span>
                    <span className={styles.rowMeta}>
                      {row.authorName} · {absoluteSaveTime(row.createdAt)}
                      {row.startedFromVersionNumber !== null ? ` · started from v${row.startedFromVersionNumber}` : ""}
                    </span>
                    {row.label && <p className={styles.rowLabel}>Note: {row.label}</p>}
                    {row.badge && <span className={styles.badge}>{row.badge}</span>}
                    <span className={styles.rowActions}>
                      {row.canOpen && (
                        <button
                          type="button"
                          className={styles.button}
                          disabled={historyBusy !== null}
                          onClick={() => void openHistoryRow(row)}
                        >
                          {historyBusy === row.versionId ? "Working…" : "Open"}
                        </button>
                      )}
                      {row.offerDownload && (
                        <button
                          type="button"
                          className={styles.button}
                          disabled={historyBusy !== null}
                          onClick={() => void downloadHistoryRow(row)}
                        >
                          {historyBusy === row.versionId ? "Working…" : "Download this version's file"}
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <p className={styles.muted}>
                Opening replaces the design on screen with that version. Saving to the cloud afterwards adds a new version that
                starts from it; no saved version is ever changed.
              </p>
            </>
          ) : null}
          <div className={styles.actions}>
            {historyTarget && (
              <button
                type="button"
                className={styles.button}
                disabled={historyLoading}
                onClick={() =>
                  // A browsed list refreshes through the BROWSE route. Sending
                  // the Stage 2 one here would 404 for a browser — and would be
                  // the wrong request to send even if it did not.
                  void (browseHistoryTarget ? loadBrowseHistory(browseHistoryTarget.projectId) : loadHistory(historyTarget.projectId))
                }
              >
                {historyLoading ? "Loading…" : "Refresh"}
              </button>
            )}
            <button type="button" className={styles.button} onClick={() => closeNote("history")}>
              Close
            </button>
          </div>
        </div>
      </StickyNote>

      {/* Stage 3B. Last, so it lands on top of the row or menu it was opened from. */}
      {access.note}

      {/* Stage 3C. The notice arrives on its own at sign-in or page load, so it
          is rendered last of all: nothing it could cover is open yet, and if
          the tree is opened from it, the tree lands on top. */}
      {shareNotice.note}

      {/* Stage 4B. THE BROWSE BANNER.
          Placement, decided against the layout rather than guessed: NOTHING
          new goes on the top bar, and there is no flow position under it to
          put a strip in — the bar is `position: fixed` and `.main` is a fixed
          layer pinned below it, so an inline strip lands UNDER the bar (seen,
          on the first build, in a headless screenshot at 1200). It is a note
          instead, which is this app's own idiom for exactly this and which
          fits every width by construction.
          It is not the only place the wording lives: the SAME three sentences
          are on the Project ▾ status line for as long as the browsed design is
          on screen, so dismissing the note does not dismiss the statement. */}
      <StickyNote
        id="cloud-browse-note"
        label={browseContext ? `Viewing ${displayProjectName(browseContext.projectName)}` : "Viewing another company's project"}
        {...noteProps("browse", 1)}
      >
        {browseContext && (
          <div className={styles.stack} data-browse-banner="">
            {browseBannerLines(browseContext.projectName, browseContext.ownerCompanyName).map((line, i) => (
              <p key={i} className={i === 0 ? styles.lead : styles.message}>
                {line}
              </p>
            ))}
            <p className={styles.muted}>{BROWSE_EXPORT_ABSENT_NOTE}</p>
            <div className={styles.actions}>
              <button type="button" className={styles.button} onClick={() => closeNote("browse")}>
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
