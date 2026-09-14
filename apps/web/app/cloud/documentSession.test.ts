import { describe, expect, it } from "vitest";
import { formatTitleBlockDate, resolveTitleBlockDate, titleBlockDateLabel } from "../titleBlockDate";
import {
  INITIAL_DOCUMENT_SESSION,
  answerIsCurrent,
  createDocumentSessionMirror,
  documentSessionReducer,
  generationAfter,
  renameOutcome,
  trackSignedInAccount,
  type CloudCreateAction,
  type CloudOpenAction,
  type CloudRenameAction,
  type CloudSaveAction,
  type DocumentSession,
  type DocumentSessionAction,
} from "./documentSession";

const NOW = new Date("2026-09-14T15:00:00.000Z");
const OLD_FILE_2025 = "2025-03-14T12:00:00.000Z";
// Exactly the shape PostgREST sends (captured from the local 0006 harness).
const CLOUD_V3 = "2026-09-10T09:30:00.123456+00:00";
const CLOUD_V4 = "2026-09-14T14:59:00.654321+00:00";

const openV3 = (sentAtGeneration = 0): CloudOpenAction => ({
  type: "cloud-open",
  sentAtGeneration,
  version: { projectId: "p1", companyId: "bi", companyName: "Building Integrity", folder: "current", versionId: "v3", versionNumber: 3, createdAt: CLOUD_V3, headVersionNumber: 3 },
});

const createP2 = (sentAtGeneration: number): CloudCreateAction => ({
  type: "cloud-create",
  sentAtGeneration,
  result: { projectId: "p2", companyId: "rf", companyName: "Rare Forms", folder: "proposals", versionId: "p2v1", versionNumber: 1, createdAt: CLOUD_V4 },
});

const saveFrom = (sentAtGeneration: number, parentVersionId = "v3", versionNumber = 4): CloudSaveAction => ({
  type: "cloud-save",
  sentAtGeneration,
  projectId: "p1",
  parentVersionId,
  result: { versionId: `v${versionNumber}`, versionNumber, createdAt: CLOUD_V4 },
});

const loadOld: DocumentSessionAction = { type: "local-load", savedAt: OLD_FILE_2025 };

const run = (...actions: DocumentSessionAction[]): DocumentSession => actions.reduce(documentSessionReducer, INITIAL_DOCUMENT_SESSION);
const dateOf = (session: DocumentSession) => resolveTitleBlockDate({ lastSave: session.titleBlockSave, now: NOW });

// --- Stage 2C fixtures ------------------------------------------------------
const CLOUD_V3_OLD = "2026-08-01T08:00:00.000000+00:00";
const CLOUD_RENAME = "2026-09-14T14:30:00.111111+00:00";

/** v3 opened from Version history while v7 is the head. */
const openOlderV3 = (sentAtGeneration = 0): CloudOpenAction => ({
  type: "cloud-open",
  sentAtGeneration,
  version: { projectId: "p1", companyId: "bi", companyName: "Building Integrity", folder: "current", versionId: "v3", versionNumber: 3, createdAt: CLOUD_V3_OLD, headVersionNumber: 7 },
});

const renameTo = (sentAtGeneration: number, versionNumber: number, projectId = "p1"): CloudRenameAction => ({
  type: "cloud-rename",
  sentAtGeneration,
  projectId,
  result: { versionId: `v${versionNumber}`, versionNumber, createdAt: CLOUD_RENAME },
});

describe("2C: opening an older version goes through the same guard and date writer as Open", () => {
  it("base becomes the OLD version, the date is its created_at, and the head it saw is remembered", () => {
    const session = run(openOlderV3());
    expect(session.cloudContext).toMatchObject({ projectId: "p1", baseVersionId: "v3", baseVersionNumber: 3, baseCreatedAt: CLOUD_V3_OLD, latestKnownVersionNumber: 7 });
    expect(session.titleBlockSave).toEqual({ savedAt: CLOUD_V3_OLD, source: "cloud-version" });
    expect(session.designGeneration).toBe(1);
  });

  it("the next Save to cloud names the old version as its parent, applies, and moves base to the new version", () => {
    const opened = run(openOlderV3());
    // The editor sends parentVersionId = cloudContext.baseVersionId.
    expect(opened.cloudContext?.baseVersionId).toBe("v3");
    const save = saveFrom(1, "v3", 8);
    expect(answerIsCurrent(opened, save)).toBe(true);
    const saved = documentSessionReducer(opened, save);
    expect(saved.cloudContext).toMatchObject({ baseVersionId: "v8", baseVersionNumber: 8, latestKnownVersionNumber: 8 });
    expect(saved.titleBlockSave).toEqual({ savedAt: CLOUD_V4, source: "cloud-version" });
  });

  it("an older-version open that lands after a Load writes nothing: no context, the file's date", () => {
    const session = run(loadOld, openOlderV3(0));
    expect(session.cloudContext).toBeNull();
    expect(dateOf(session).date?.toISOString()).toBe(OLD_FILE_2025);
  });

  it("a head open never records a head older than the version itself", () => {
    const stale: CloudOpenAction = { ...openV3(), version: { ...openV3().version, headVersionNumber: 2 } };
    expect(run(stale).cloudContext?.latestKnownVersionNumber).toBe(3);
  });

  it("create sets latestKnown to v1", () => {
    expect(run(createP2(0)).cloudContext?.latestKnownVersionNumber).toBe(1);
  });
});

describe("2C: rename from the tree", () => {
  it("renaming a project that is NOT open here changes nothing at all", () => {
    const opened = run(openV3());
    const action = renameTo(1, 9, "p2");
    expect(renameOutcome(opened, action)).toBe("not-open-here");
    expect(documentSessionReducer(opened, action)).toBe(opened);
    expect(renameOutcome(INITIAL_DOCUMENT_SESSION, action)).toBe("not-open-here");
  });

  it("base WAS head: base moves to the rename version and the date becomes its created_at", () => {
    const opened = run(openV3()); // v3, head 3
    const action = renameTo(1, 4);
    expect(renameOutcome(opened, action)).toBe("base-moved");
    const renamed = documentSessionReducer(opened, action);
    expect(renamed.cloudContext).toMatchObject({ baseVersionId: "v4", baseVersionNumber: 4, baseCreatedAt: CLOUD_RENAME, latestKnownVersionNumber: 4 });
    expect(renamed.titleBlockSave).toEqual({ savedAt: CLOUD_RENAME, source: "cloud-version" });
    expect(renamed.designGeneration).toBe(opened.designGeneration);
  });

  it("base was NOT head (the handoff's edge case): base stays put and the date does not move", () => {
    const opened = run(openOlderV3()); // v3, head 7
    const action = renameTo(1, 8);
    expect(renameOutcome(opened, action)).toBe("base-stays");
    const renamed = documentSessionReducer(opened, action);
    expect(renamed).toBe(opened);
    expect(renamed.cloudContext).toMatchObject({ baseVersionId: "v3", latestKnownVersionNumber: 7 });
    expect(dateOf(renamed).date?.toISOString()).toBe(new Date(CLOUD_V3_OLD).toISOString());
  });

  it("base not head because a colleague saved meanwhile: base stays too", () => {
    // v3 open as head; someone saved v4; the rename copies v4 into v5.
    expect(renameOutcome(run(openV3()), renameTo(1, 5))).toBe("base-stays");
  });

  it("a late rename answer (the design was replaced in flight) writes nothing, even if the same project is open again", () => {
    // Rename sent at generation 1; the project is then re-opened (generation 2).
    const reopened = run(openV3(0), openV3(1));
    const action = renameTo(1, 4);
    expect(renameOutcome(reopened, action)).toBe("late");
    expect(documentSessionReducer(reopened, action)).toBe(reopened);
  });

  it("a rename after a Load finds no project open here", () => {
    const loaded = run(openV3(0), loadOld);
    expect(renameOutcome(loaded, renameTo(1, 4))).toBe("not-open-here");
    expect(documentSessionReducer(loaded, renameTo(1, 4))).toBe(loaded);
  });

  it("rename never moves the generation, and the mirror agrees with the reducer", () => {
    expect(generationAfter(4, renameTo(4, 9))).toBe(4);
    const actions: DocumentSessionAction[] = [openV3(0), renameTo(1, 4), saveFrom(1, "v4", 5), openOlderV3(1), renameTo(2, 9)];
    const mirror = createDocumentSessionMirror();
    for (const a of actions) mirror.apply(a);
    expect(mirror.read()).toEqual(run(...actions));
  });
});

describe("title-block date: last save wins (the two Stage 0 regressions)", () => {
  it("REGRESSION: open a cloud version, then Load an old local file -> the sheet shows that file's date", () => {
    const resolved = dateOf(run(openV3(), loadOld));
    expect(resolved.source).toBe("local-file");
    expect(resolved.date?.toISOString()).toBe(OLD_FILE_2025);
  });

  it("REGRESSION: open a cloud version, then Save Project locally -> the sheet shows now", () => {
    // Save Project writes serializeProject's own savedAt (new Date() at the
    // moment of saving) and hands that same string to the reducer.
    const resolved = dateOf(run(openV3(), { type: "local-save", savedAt: NOW.toISOString() }));
    expect(resolved.source).toBe("local-file");
    expect(resolved.date?.getTime()).toBe(NOW.getTime());
    expect(titleBlockDateLabel(resolved)).toBe(formatTitleBlockDate(NOW));
  });
});

describe("late answers: an answer for a design that was replaced in flight is ignored", () => {
  it("create answer after local-load: no context, the loaded file's date, so the next save cannot append into it", () => {
    // Save as new sent at generation 0; the Load lands first (generation 1).
    const session = run(loadOld, createP2(0));
    expect(session.cloudContext).toBeNull();
    expect(dateOf(session).date?.toISOString()).toBe(OLD_FILE_2025);
  });

  it("create answer after cloud-open: the opened project stays attached", () => {
    const session = run(openV3(0), createP2(0));
    expect(session.cloudContext?.projectId).toBe("p1");
    expect(session.titleBlockSave).toEqual({ savedAt: CLOUD_V3, source: "cloud-version" });
  });

  it("open answer after local-load: the loaded file stays, unattached", () => {
    const session = run(loadOld, openV3(0));
    expect(session.cloudContext).toBeNull();
    expect(dateOf(session).date?.toISOString()).toBe(OLD_FILE_2025);
  });

  it("open answer after another open: the later-arriving, earlier-sent open is ignored", () => {
    const session = run(createP2(0), openV3(0));
    expect(session.cloudContext?.projectId).toBe("p2");
  });

  it("save answer after local-load is ignored entirely", () => {
    const session = run(openV3(0), loadOld, saveFrom(1));
    expect(session.cloudContext).toBeNull();
    expect(dateOf(session).date?.toISOString()).toBe(OLD_FILE_2025);
  });

  it("a matching answer is still applied: create, open and save sent at the current generation", () => {
    const afterLoad = run(loadOld); // generation 1
    const created = documentSessionReducer(afterLoad, createP2(1));
    expect(created.cloudContext?.projectId).toBe("p2");
    expect(created.designGeneration).toBe(2);

    const opened = documentSessionReducer(created, openV3(2));
    expect(opened.cloudContext?.projectId).toBe("p1");
    expect(opened.designGeneration).toBe(3);

    const saved = documentSessionReducer(opened, saveFrom(3));
    expect(saved.cloudContext).toMatchObject({ baseVersionId: "v4", baseVersionNumber: 4 });
    expect(saved.designGeneration).toBe(3); // a save does not replace the design
  });

  it("answerIsCurrent agrees with the reducer", () => {
    const opened = run(openV3(0)); // generation 1
    expect(answerIsCurrent(opened, saveFrom(1))).toBe(true);
    expect(answerIsCurrent(opened, saveFrom(0))).toBe(false);
    expect(answerIsCurrent(opened, saveFrom(1, "v2"))).toBe(false);
    expect(answerIsCurrent(opened, createP2(1))).toBe(true);
    expect(answerIsCurrent(opened, openV3(0))).toBe(false);
  });
});

describe("documentSessionReducer", () => {
  it("starts with no cloud project and today's date", () => {
    expect(INITIAL_DOCUMENT_SESSION).toEqual({ cloudContext: null, titleBlockSave: null, designGeneration: 0 });
    expect(dateOf(INITIAL_DOCUMENT_SESSION).source).toBe("today");
  });

  it("Open from cloud sets the context at that version and dates the sheet from created_at", () => {
    const session = run(openV3());
    expect(session.cloudContext).toEqual({
      projectId: "p1",
      companyId: "bi",
      companyName: "Building Integrity",
      folder: "current",
      baseVersionId: "v3",
      baseVersionNumber: 3,
      baseCreatedAt: CLOUD_V3,
      latestKnownVersionNumber: 3,
    });
    expect(dateOf(session)).toEqual({ source: "cloud-version", date: new Date("2026-09-10T09:30:00.123Z") });
  });

  it("Load Project clears the cloud context, so the next cloud save asks for a NEW project", () => {
    expect(run(openV3(), loadOld).cloudContext).toBeNull();
  });

  it("local Save keeps the cloud context and does not bump the generation", () => {
    const session = run(openV3(), { type: "local-save", savedAt: NOW.toISOString() });
    expect(session.cloudContext?.baseVersionId).toBe("v3");
    expect(session.designGeneration).toBe(1);
  });

  it("Save to cloud moves base to the new version and dates the sheet from the DATABASE's created_at", () => {
    const session = run(openV3(0), saveFrom(1));
    expect(session.cloudContext).toMatchObject({ baseVersionId: "v4", baseVersionNumber: 4, baseCreatedAt: CLOUD_V4 });
    expect(session.titleBlockSave).toEqual({ savedAt: CLOUD_V4, source: "cloud-version" });
  });

  it("consecutive own saves chain: the second is sent from the first's result", () => {
    expect(run(openV3(0), saveFrom(1), saveFrom(1, "v4", 5)).cloudContext?.baseVersionNumber).toBe(5);
  });

  it("a refused save (409, 403, 413...) writes nothing: context and date are unchanged", () => {
    const before = run(openV3());
    const after = documentSessionReducer(before, { type: "cloud-refused" });
    expect(after).toBe(before);
  });

  it("a save answer for a base the editor has already moved past is ignored", () => {
    const afterFirst = run(openV3(0), saveFrom(1));
    expect(documentSessionReducer(afterFirst, saveFrom(1, "v3", 9))).toBe(afterFirst);
  });

  it("Save as new cloud project replaces an open project's context with the new project at v1", () => {
    const session = run(openV3(0), createP2(1));
    expect(session.cloudContext).toMatchObject({ projectId: "p2", companyId: "rf", baseVersionNumber: 1, folder: "proposals" });
    expect(session.titleBlockSave).toEqual({ savedAt: CLOUD_V4, source: "cloud-version" });
  });

  it("moving the open project changes its folder and not the date; moving another project changes nothing", () => {
    const opened = run(openV3());
    const moved = documentSessionReducer(opened, { type: "cloud-moved", projectId: "p1", folder: "past" });
    expect(moved.cloudContext?.folder).toBe("past");
    expect(moved.titleBlockSave).toBe(opened.titleBlockSave);
    expect(documentSessionReducer(opened, { type: "cloud-moved", projectId: "other", folder: "past" })).toBe(opened);
  });

  it("an account change clears the cloud project, keeps the date, and voids answers still in flight", () => {
    const opened = run(openV3(0)); // generation 1
    const changed = documentSessionReducer(opened, { type: "account-changed" });
    expect(changed.cloudContext).toBeNull();
    expect(changed.titleBlockSave).toBe(opened.titleBlockSave);
    expect(documentSessionReducer(changed, saveFrom(1))).toBe(changed);
  });

  it('a Load of a file with no savedAt after a cloud open prints "Date not recorded", never today', () => {
    expect(titleBlockDateLabel(dateOf(run(openV3(), { type: "local-load", savedAt: undefined })))).toBe("Date not recorded");
  });

  it('a cloud version whose created_at is unusable prints "Date not recorded", never today', () => {
    const bad = openV3();
    const session = run({ ...bad, version: { ...bad.version, createdAt: "2026-09-10 09:30:00" } });
    expect(titleBlockDateLabel(dateOf(session))).toBe("Date not recorded");
  });

  it("a local Save does not void an in-flight cloud save: the later-completing cloud save still applies", () => {
    const session = run(openV3(0), { type: "local-save", savedAt: NOW.toISOString() }, saveFrom(1));
    expect(session.titleBlockSave).toEqual({ savedAt: CLOUD_V4, source: "cloud-version" });
  });
});

describe("generationAfter — what moves designGeneration", () => {
  it("bumps for local-load and a real account change", () => {
    expect(generationAfter(3, loadOld)).toBe(4);
    expect(generationAfter(3, { type: "account-changed" })).toBe(4);
  });

  it("bumps for a CURRENT cloud-open or cloud-create only", () => {
    expect(generationAfter(3, openV3(3))).toBe(4);
    expect(generationAfter(3, openV3(2))).toBe(3);
    expect(generationAfter(3, createP2(3))).toBe(4);
  });

  it("does not bump for local-save, cloud-save, a folder move or a refusal", () => {
    const same: DocumentSessionAction[] = [
      { type: "local-save", savedAt: NOW.toISOString() },
      saveFrom(3),
      { type: "cloud-moved", projectId: "p1", folder: "past" },
      { type: "cloud-refused" },
    ];
    for (const action of same) expect(generationAfter(3, action)).toBe(3);
  });

  it("is exactly what the reducer does, over a mixed sequence", () => {
    const actions: DocumentSessionAction[] = [openV3(0), loadOld, openV3(1), openV3(1), { type: "account-changed" }, loadOld, createP2(4), { type: "cloud-refused" }];
    let generation = 0;
    let state = INITIAL_DOCUMENT_SESSION;
    for (const action of actions) {
      generation = generationAfter(generation, action);
      state = documentSessionReducer(state, action);
      expect(state.designGeneration).toBe(generation);
    }
  });
});

describe("createDocumentSessionMirror — the pre-apply check that cannot lag a frame", () => {
  it("sees a Load the instant it is dispatched, so an open answer landing before React re-renders is refused", () => {
    const mirror = createDocumentSessionMirror();
    const sentAt = mirror.read().designGeneration; // Open clicked
    mirror.apply(loadOld); // Load dispatched; React has not re-rendered yet
    expect(answerIsCurrent(mirror.read(), openV3(sentAt))).toBe(false);
  });

  it("stays identical to React's reducer state after every dispatch", () => {
    const mirror = createDocumentSessionMirror();
    let reactState = INITIAL_DOCUMENT_SESSION;
    const actions: DocumentSessionAction[] = [openV3(0), loadOld, createP2(1), saveFrom(2, "p2v1"), { type: "account-changed" }];
    for (const action of actions) {
      mirror.apply(action);
      reactState = documentSessionReducer(reactState, action);
      expect(mirror.read()).toEqual(reactState);
    }
  });

  it("still lets a matching answer through", () => {
    const mirror = createDocumentSessionMirror();
    mirror.apply(loadOld);
    expect(answerIsCurrent(mirror.read(), openV3(1))).toBe(true);
  });
});

describe("trackSignedInAccount — detach only on a real account change", () => {
  it("a blip to signed-out, then the SAME user returns: never detaches", () => {
    let tracking = trackSignedInAccount(null, "u1");
    expect(tracking.detach).toBe(false);
    tracking = trackSignedInAccount(tracking.lastKnownUserId, null); // getUser errored: a guest reading
    expect(tracking).toEqual({ lastKnownUserId: "u1", detach: false });
    tracking = trackSignedInAccount(tracking.lastKnownUserId, "u1"); // back, same account
    expect(tracking).toEqual({ lastKnownUserId: "u1", detach: false });
  });

  it("a DIFFERENT account detaches, directly or across a signed-out reading", () => {
    expect(trackSignedInAccount("u1", "u2")).toEqual({ lastKnownUserId: "u2", detach: true });
    const blip = trackSignedInAccount("u1", null);
    expect(trackSignedInAccount(blip.lastKnownUserId, "u2").detach).toBe(true);
  });

  it("an explicit sign-out detaches (account-changed) and resets tracking, so the next sign-in is not a second detach", () => {
    const opened = run(openV3(0));
    expect(documentSessionReducer(opened, { type: "account-changed" }).cloudContext).toBeNull();
    // The editor resets its last known account to null on the sign-out event.
    expect(trackSignedInAccount(null, "u1")).toEqual({ lastKnownUserId: "u1", detach: false });
  });

  it("the page's first sign-in is not a change", () => {
    expect(trackSignedInAccount(null, null)).toEqual({ lastKnownUserId: null, detach: false });
    expect(trackSignedInAccount(null, "u1")).toEqual({ lastKnownUserId: "u1", detach: false });
  });
});
