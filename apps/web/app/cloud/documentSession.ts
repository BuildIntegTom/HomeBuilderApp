import type { TitleBlockSave } from "../titleBlockDate";
import type { BrowseContext, CloudContext, CloudFolder } from "./cloudTypes";

/**
 * Where the design on screen came from: the cloud project it belongs to (if
 * any) and the date its title block prints. Held together because the same
 * actions move both, and the bugs this prevents are about them drifting apart.
 *
 * The four writers of `titleBlockSave` (spec, "The cloud row of the date
 * table") are the only actions that touch it:
 *
 *   local-load   Load Project           -> file's savedAt,  clears cloudContext
 *   local-save   Save Project           -> file's savedAt,  cloudContext kept
 *   cloud-open   Open from cloud        -> version created_at, context = it
 *   cloud-create Save to cloud (new) /
 *                Save as new project   -> returned created_at, context = new v1
 *   cloud-save   Save to cloud (open)  -> returned created_at, base moves
 *   cloud-rename Rename from the tree  -> returned created_at, base moves,
 *                of the project open      ONLY when base was head (2C; see
 *                in this editor           renameOutcome)
 *   browse-open  Browse the consortium -> version created_at, browseContext
 *                                          = it, cloudContext CLEARED (4B)
 *
 * OPENING AN OLDER VERSION (2C) is an ordinary cloud-open: base becomes that
 * version, so the next Save to cloud names it as the parent and the database
 * reports the save as diverged. `latestKnownVersionNumber` remembers the head
 * seen at open time, so the notice can say "you started from an older version"
 * rather than "someone saved while you had it open".
 *
 * `cloud-refused` exists so a refused or failed action is an explicit no-op
 * rather than an absent branch: it writes nothing.
 *
 * WHY LOAD CLEARS THE CONTEXT. Otherwise a local file loaded while a cloud
 * project is open is appended into that unrelated project on the next cloud
 * save — silent, plausible, and exactly what the switcher exists to prevent.
 *
 * LATE ANSWERS. Every cloud action is a round trip, and the design can be
 * replaced while it is in flight. `designGeneration` sits beside
 * `cloudContext` and counts replacements of the design on screen: local-load,
 * a current cloud-open, a current cloud-create, and a real account change
 * bump it; local-save, cloud-save and a folder move do not (see
 * `generationAfter`). Every cloud answer carries the generation it was SENT at,
 * and an answer whose generation no longer matches describes a design that is
 * not on screen: it is ignored entirely — no context, no date.
 *
 * A local Save does not void an in-flight cloud save: both describe the same
 * design, and whichever completes last sets the date. Sheets print the day, so
 * that ordering only ever shows across midnight.
 */
export interface DocumentSession {
  cloudContext: CloudContext | null;
  /**
   * STAGE 4B. A read-only browsed design from another member company, served
   * redacted by `browse_version`. Set INSTEAD OF `cloudContext`, never beside
   * it — `bothContextsSet` below asserts the invariant and the reducer keeps
   * it — so no save path can attach to a browsed project even if an export
   * control were missed. Same shape of rule as 2B's "Load Project clears
   * cloudContext", and for the same reason: the failure it prevents is silent.
   */
  browseContext: BrowseContext | null;
  titleBlockSave: TitleBlockSave | null;
  designGeneration: number;
}

export const INITIAL_DOCUMENT_SESSION: DocumentSession = {
  cloudContext: null,
  browseContext: null,
  titleBlockSave: null,
  designGeneration: 0,
};

/**
 * True while the design on screen is another company's, served with its costs
 * removed. The one question the editor asks: every price display is gated on
 * it, and the export controls are gated on it.
 */
export function costsRedacted(state: DocumentSession): boolean {
  return state.browseContext !== null;
}

/** The invariant, as a function so a test can state it: never both. */
export function bothContextsSet(state: DocumentSession): boolean {
  return state.cloudContext !== null && state.browseContext !== null;
}

interface VersionFacts {
  projectId: string;
  companyId: string;
  companyName: string;
  folder: CloudFolder;
  versionId: string;
  versionNumber: number;
  createdAt: string;
}

export type CloudOpenAction = {
  type: "cloud-open";
  sentAtGeneration: number;
  /** `headVersionNumber` is the project's head as the open read it: newer than
   * `versionNumber` when an older version was opened. */
  version: VersionFacts & { headVersionNumber: number };
};
export type CloudCreateAction = { type: "cloud-create"; sentAtGeneration: number; result: VersionFacts };
export type CloudSaveAction = {
  type: "cloud-save";
  sentAtGeneration: number;
  /** The project the save was sent to. */
  projectId: string;
  /** The base the save was sent from. */
  parentVersionId: string;
  result: { versionId: string; versionNumber: number; createdAt: string };
};
/** Stage 2C: a rename from the tree succeeded. It appended `result`, a copy of
 * the head at that moment (always `versionNumber - 1`) with a new name. */
export type CloudRenameAction = {
  type: "cloud-rename";
  sentAtGeneration: number;
  projectId: string;
  result: { versionId: string; versionNumber: number; createdAt: string };
};

/**
 * Stage 4B: a redacted document from another member company went on screen.
 * It REPLACES the design exactly as a cloud open does — same generation guard,
 * same date writer (the version's `created_at`, through the existing
 * `cloud-version` source) — and it clears `cloudContext`, which is what makes
 * every save path unreachable rather than merely unoffered.
 */
export type BrowseOpenAction = {
  type: "browse-open";
  sentAtGeneration: number;
  version: BrowseContext;
};

export type DocumentSessionAction =
  | { type: "local-load"; savedAt: string | undefined }
  | { type: "local-save"; savedAt: string }
  | CloudOpenAction
  | CloudCreateAction
  | CloudSaveAction
  | CloudRenameAction
  | BrowseOpenAction
  | { type: "cloud-moved"; projectId: string; folder: CloudFolder }
  /** Stage 5: that project was permanently deleted. Not a save, not a load. */
  | { type: "cloud-deleted"; projectId: string }
  /** A REAL account change: a different account signed in, or an explicit
   * sign-out. Not a transient signed-out reading (see trackSignedInAccount). */
  | { type: "account-changed" }
  | { type: "cloud-refused" };

/**
 * The one rule for how an action moves `designGeneration`. The reducer uses
 * it, and so does the synchronous mirror, so the two cannot disagree.
 */
export function generationAfter(generation: number, action: DocumentSessionAction): number {
  switch (action.type) {
    case "local-load":
    case "account-changed":
      return generation + 1;
    case "cloud-open":
    case "cloud-create":
    case "browse-open":
      return action.sentAtGeneration === generation ? generation + 1 : generation;
    default:
      return generation;
  }
}

/**
 * Does this answer still describe the design on screen? The reducer applies
 * exactly the answers this says yes to, and the editor asks the same question
 * (of the synchronous mirror) before applying an opened document or wording a
 * save notice.
 */
export function answerIsCurrent(
  state: DocumentSession,
  action: CloudOpenAction | CloudCreateAction | CloudSaveAction | BrowseOpenAction,
): boolean {
  if (action.sentAtGeneration !== state.designGeneration) return false;
  if (action.type !== "cloud-save") return true;
  // Same generation, but the base must still be the one the save was sent
  // from: a second answer for an older base is not this editor's state.
  const ctx = state.cloudContext;
  return Boolean(ctx && ctx.projectId === action.projectId && ctx.baseVersionId === action.parentVersionId);
}

/**
 * What a successful rename means for THIS editor (spec, "Name sync"):
 *
 *   not-open-here  another project was renamed: nothing here changes.
 *   late           the renamed project is open, but the design was replaced
 *                  while the rename was in flight: a late answer writes
 *                  nothing, not even the name field.
 *   base-moved     base WAS head, so the rename version is exactly base with a
 *                  new name: base moves to it and the date becomes its
 *                  created_at, as for a save.
 *   base-stays     base was NOT head (an older version was opened, or someone
 *                  saved meanwhile). The rename copied someone else's head, not
 *                  the design on screen, so base stays put and the DATE DOES
 *                  NOT MOVE: the date says when the design on screen was saved,
 *                  and this rename did not save it. The editor's name field
 *                  still takes the new name, so the next save keeps it; the
 *                  divergence notice explains that save.
 *
 * The rename's parent is always `versionNumber - 1` (rename_project copies the
 * head under the project-row lock), and version numbers are unique within a
 * project, so comparing numbers is comparing versions.
 */
export type RenameOutcome = "not-open-here" | "late" | "base-moved" | "base-stays";

export function renameOutcome(state: DocumentSession, action: CloudRenameAction): RenameOutcome {
  const ctx = state.cloudContext;
  if (!ctx || ctx.projectId !== action.projectId) return "not-open-here";
  if (action.sentAtGeneration !== state.designGeneration) return "late";
  return ctx.baseVersionNumber === action.result.versionNumber - 1 ? "base-moved" : "base-stays";
}

export function documentSessionReducer(state: DocumentSession, action: DocumentSessionAction): DocumentSession {
  switch (action.type) {
    case "local-load":
      return {
        cloudContext: null,
        browseContext: null,
        titleBlockSave: { savedAt: action.savedAt, source: "local-file" },
        designGeneration: generationAfter(state.designGeneration, action),
      };

    case "local-save":
      return { ...state, titleBlockSave: { savedAt: action.savedAt, source: "local-file" } };

    case "cloud-open":
    case "cloud-create": {
      if (!answerIsCurrent(state, action)) return state;
      const v = action.type === "cloud-open" ? action.version : action.result;
      const latestKnown = action.type === "cloud-open" ? Math.max(action.version.headVersionNumber, v.versionNumber) : v.versionNumber;
      return {
        cloudContext: {
          projectId: v.projectId,
          companyId: v.companyId,
          companyName: v.companyName,
          folder: v.folder,
          baseVersionId: v.versionId,
          baseVersionNumber: v.versionNumber,
          baseCreatedAt: v.createdAt,
          latestKnownVersionNumber: latestKnown,
        },
        // A full open ends the browse: the design on screen is no longer the
        // read-only copy, so the costs gate and the export controls come back.
        browseContext: null,
        titleBlockSave: { savedAt: v.createdAt, source: "cloud-version" },
        designGeneration: generationAfter(state.designGeneration, action),
      };
    }

    case "browse-open": {
      if (!answerIsCurrent(state, action)) return state;
      return {
        // Cleared, not merely unused: with no cloudContext there is no project
        // for Save to cloud to attach to, so a missed control cannot save a
        // browsed design into someone's tree.
        cloudContext: null,
        browseContext: action.version,
        // The date is that version's created_at, through the same cloud-version
        // writer an ordinary open uses — the title block of a browsed sheet
        // says when the owner saved it, which is the true answer.
        titleBlockSave: { savedAt: action.version.createdAt, source: "cloud-version" },
        designGeneration: generationAfter(state.designGeneration, action),
      };
    }

    case "cloud-save": {
      if (!answerIsCurrent(state, action)) return state;
      const ctx = state.cloudContext!;
      return {
        ...state,
        cloudContext: {
          ...ctx,
          baseVersionId: action.result.versionId,
          baseVersionNumber: action.result.versionNumber,
          baseCreatedAt: action.result.createdAt,
          // The notice for this save has just named everything in between.
          latestKnownVersionNumber: action.result.versionNumber,
        },
        titleBlockSave: { savedAt: action.result.createdAt, source: "cloud-version" },
      };
    }

    case "cloud-rename": {
      if (renameOutcome(state, action) !== "base-moved") return state;
      const ctx = state.cloudContext!;
      return {
        ...state,
        cloudContext: {
          ...ctx,
          baseVersionId: action.result.versionId,
          baseVersionNumber: action.result.versionNumber,
          baseCreatedAt: action.result.createdAt,
          latestKnownVersionNumber: Math.max(ctx.latestKnownVersionNumber, action.result.versionNumber),
        },
        titleBlockSave: { savedAt: action.result.createdAt, source: "cloud-version" },
      };
    }

    case "cloud-moved":
      // Filing, not saving: the date does not move.
      if (!state.cloudContext || state.cloudContext.projectId !== action.projectId) return state;
      return { ...state, cloudContext: { ...state.cloudContext, folder: action.folder } };

    case "cloud-deleted":
      // Stage 5. The project this editor was attached to no longer exists, so
      // the attachment goes — the same detach-without-replacing that an
      // account change does, and for the same reason: there is nowhere to save
      // to any more.
      //
      // THE DESIGN ON SCREEN IS NOT TOUCHED, and neither is its title-block
      // date. A delete is not one of the four date writers: the drawing still
      // came from whatever save or load put it there, and saying otherwise
      // would print a confident wrong date on the sheet.
      //
      // `designGeneration` DOES NOT MOVE either, because the design was not
      // replaced. The consequence, accepted and recorded: an `open` of this
      // same project already in flight would still be applied and would
      // re-attach to a project that is gone. The next save then gets a clean
      // refusal with Download project file, which is the same place any other
      // lost-access save lands. A generation bump would void that answer by
      // claiming the design had been replaced, which is false and is read by
      // every other cloud path.
      if (!state.cloudContext || state.cloudContext.projectId !== action.projectId) return state;
      return { ...state, cloudContext: null };

    case "account-changed":
      // The design on screen is not replaced, so its date stays: it still came
      // from that save or load (only the four writers move the date). What
      // goes is the attachment to a cloud project the new account may not be
      // able to reach, and any answer still in flight for the old account.
      //
      // `browseContext` DELIBERATELY STAYS, unlike `cloudContext`. The two are
      // not the same kind of fact. `cloudContext` is a save target, and the new
      // account may have no right to it; `browseContext` describes THE DESIGN
      // STILL ON SCREEN — whose it is, and that its costs were removed before
      // it was sent. That has not changed because somebody signed in. Clearing
      // it would drop the price gate while the redacted design is still drawn,
      // which is the one thing this stage must not do.
      return { ...state, cloudContext: null, designGeneration: generationAfter(state.designGeneration, action) };

    case "cloud-refused":
      return state;
  }
}

/**
 * A synchronous copy of the session, advanced by the same reducer at the
 * moment of dispatch. React applies a dispatch on its next render, so any value
 * copied from rendered state lags by up to a frame — long enough for an open
 * answer landing just after a Load's dispatch to pass a pre-apply check and put
 * the cloud design on screen under the loaded file's date. Checks that must see
 * the latest dispatch read this instead.
 */
export interface DocumentSessionMirror {
  read: () => DocumentSession;
  apply: (action: DocumentSessionAction) => DocumentSession;
}

export function createDocumentSessionMirror(initial: DocumentSession = INITIAL_DOCUMENT_SESSION): DocumentSessionMirror {
  let current = initial;
  return {
    read: () => current,
    apply: (action) => {
      current = documentSessionReducer(current, action);
      return current;
    },
  };
}

/**
 * Whether a change in the signed-in user is a REAL account change.
 *
 * `/api/session` reports a guest (with 200) whenever `getUser` errors, and the
 * editor re-reads the session after every 401/403, so a network blip or an
 * expired token reads as signed out for a moment. Detaching on that would make
 * the next Save to cloud open the new-project dialog and invite a duplicate
 * project. So a signed-out reading changes nothing, and the same account
 * coming back finds its project still attached. Only a DIFFERENT non-null
 * account detaches. An explicit sign-out through the app detaches separately
 * (the AuthProvider's SIGNED_OUT_EVENT), and resets the last known account.
 */
export function trackSignedInAccount(
  lastKnownUserId: string | null,
  currentUserId: string | null,
): { lastKnownUserId: string | null; detach: boolean } {
  if (currentUserId === null) return { lastKnownUserId, detach: false };
  if (lastKnownUserId === null || lastKnownUserId === currentUserId) return { lastKnownUserId: currentUserId, detach: false };
  return { lastKnownUserId: currentUserId, detach: true };
}
