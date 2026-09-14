import { describe, expect, it } from "vitest";
import { formatTitleBlockDate, resolveTitleBlockDate, titleBlockDateLabel } from "../titleBlockDate";
import {
  INITIAL_DOCUMENT_SESSION,
  answerIsCurrent,
  createDocumentSessionMirror,
  documentSessionReducer,
  generationAfter,
  trackSignedInAccount,
  type CloudCreateAction,
  type CloudOpenAction,
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
  version: { projectId: "p1", companyId: "bi", companyName: "Building Integrity", folder: "current", versionId: "v3", versionNumber: 3, createdAt: CLOUD_V3 },
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
