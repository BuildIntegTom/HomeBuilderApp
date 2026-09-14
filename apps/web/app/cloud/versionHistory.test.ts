import { describe, expect, it } from "vitest";
import type { CloudContext, CloudVersionRow, ListVersionsResponse } from "./cloudTypes";
import { buildHistoryRows, historySummary, openedOlderVersionNotice, renameNotice } from "./versionHistory";

const CURRENT = 24;

const row = (n: number, over: Partial<CloudVersionRow> = {}): CloudVersionRow => ({
  versionId: `v${n}`,
  versionNumber: n,
  parentVersionId: n === 1 ? null : `v${n - 1}`,
  parentVersionNumber: n === 1 ? null : n - 1,
  kind: "save",
  label: null,
  authorName: "Virgil",
  createdAt: `2026-09-1${n % 10}T12:00:00+00:00`,
  schemaVersion: CURRENT,
  renamedTo: null,
  ...over,
});

const history = (versions: CloudVersionRow[], over: Partial<ListVersionsResponse> = {}): ListVersionsResponse => ({
  projectId: "p1",
  companyId: "bi",
  companyName: "Building Integrity",
  projectName: "Smith Residence",
  folder: "current",
  headVersionNumber: versions[0]?.versionNumber ?? 0,
  versions,
  notListedCount: 0,
  ...over,
});

const ctx = (over: Partial<CloudContext> = {}): CloudContext => ({
  projectId: "p1",
  companyId: "bi",
  companyName: "Building Integrity",
  folder: "current",
  baseVersionId: "v3",
  baseVersionNumber: 3,
  baseCreatedAt: "2026-09-13T12:00:00+00:00",
  latestKnownVersionNumber: 5,
  ...over,
});

describe("buildHistoryRows", () => {
  const list = history([
    row(5, { kind: "rename", renamedTo: "Smith Residence", authorName: "M" }),
    row(4, { parentVersionId: "v2", parentVersionNumber: 2, label: "roof pitch 6/12" }),
    row(3, { schemaVersion: CURRENT - 1 }),
    row(2, { schemaVersion: CURRENT - 2 }),
    row(1, { schemaVersion: CURRENT + 1, authorName: "  " }),
  ]);

  it("keeps every version, newest first, and never collapses a rename row", () => {
    const rows = buildHistoryRows(list, null, CURRENT);
    expect(rows.map((r) => r.versionNumber)).toEqual([5, 4, 3, 2, 1]);
  });

  it("labels saves and renames; a rename whose name couldn't be read is still a row, just 'Renamed'", () => {
    const rows = buildHistoryRows(list, null, CURRENT);
    expect(rows[0].title).toBe("Renamed to 'Smith Residence'");
    expect(rows[1].title).toBe("Saved");
    const unread = buildHistoryRows(history([row(2, { kind: "rename", renamedTo: null }), row(1)]), null, CURRENT);
    expect(unread[0].title).toBe("Renamed");
    const emptyName = buildHistoryRows(history([row(2, { kind: "rename", renamedTo: "" }), row(1)]), null, CURRENT);
    expect(emptyName[0].title).toBe("Renamed to '(untitled)'");
  });

  it("every row carries who and when; a blank author says so instead of vanishing", () => {
    const rows = buildHistoryRows(list, null, CURRENT);
    expect(rows[0]).toMatchObject({ authorName: "M", createdAt: list.versions[0].createdAt });
    expect(rows[4].authorName).toBe("author not recorded");
  });

  it("marks latest, and 'you started from this one' only for this editor's base in THIS project", () => {
    const mine = buildHistoryRows(list, ctx(), CURRENT);
    expect(mine.filter((r) => r.isLatest).map((r) => r.versionNumber)).toEqual([5]);
    expect(mine.filter((r) => r.isBase).map((r) => r.versionNumber)).toEqual([3]);
    const otherProject = buildHistoryRows(list, ctx({ projectId: "p2" }), CURRENT);
    expect(otherProject.some((r) => r.isBase)).toBe(false);
  });

  it("says 'started from' only when a save's parent is not the version just before it", () => {
    const rows = buildHistoryRows(list, null, CURRENT);
    expect(rows.find((r) => r.versionNumber === 4)?.startedFromVersionNumber).toBe(2);
    expect(rows.find((r) => r.versionNumber === 5)?.startedFromVersionNumber).toBeNull();
    expect(rows.find((r) => r.versionNumber === 1)?.startedFromVersionNumber).toBeNull();
  });

  it("in-window versions open (current and one back); out-of-window carry a badge and a raw download instead", () => {
    const rows = buildHistoryRows(list, null, CURRENT);
    const by = (n: number) => rows.find((r) => r.versionNumber === n)!;
    expect(by(5)).toMatchObject({ canOpen: true, offerDownload: false, badge: null, schema: "opens" });
    expect(by(3)).toMatchObject({ canOpen: true, offerDownload: false, badge: null, schema: "opens-via-migration" });
    expect(by(2)).toMatchObject({ canOpen: false, offerDownload: true, schema: "too-old" });
    expect(by(2).badge).toBe(`Saved by an older app version (file format ${CURRENT - 2}); this app can't open it`);
    expect(by(1)).toMatchObject({ canOpen: false, offerDownload: true, schema: "too-new" });
    expect(by(1).badge).toMatch(/newer app version; reload the page/);
  });

  it("carries the save-time note", () => {
    expect(buildHistoryRows(list, null, CURRENT)[1].label).toBe("roof pitch 6/12");
  });
});

describe("historySummary", () => {
  it("a complete list says so", () => {
    expect(historySummary(history([row(2), row(1)]))).toBe("2 versions, newest first. Every version is kept.");
    expect(historySummary(history([row(1)]))).toBe("1 version, newest first. Every version is kept.");
  });

  it("a list cut short by the API row cap says so rather than looking complete", () => {
    expect(historySummary(history([row(1200), row(1199)], { headVersionNumber: 1200, notListedCount: 1198 }))).toBe(
      "The newest 2 versions of 1200. 1198 older versions aren't listed here; every version is still kept.",
    );
  });
});

describe("openedOlderVersionNotice — what the next Save to cloud will do, said before it happens", () => {
  it("names the version, who saved it and when, the latest, and that the next save starts from it", () => {
    expect(
      openedOlderVersionNotice({ versionNumber: 3, headVersionNumber: 7, projectName: "Smith House", authorName: "Virgil", savedWhen: "Sep 12, 2026, 2:14 pm" }),
    ).toBe(
      "You opened version 3 of Smith House, saved by Virgil on Sep 12, 2026, 2:14 pm. The latest is version 7. Save to cloud will add a new version that starts from version 3; versions 4–7 stay exactly as they are.",
    );
  });

  it("uses the singular for one newer version", () => {
    expect(openedOlderVersionNotice({ versionNumber: 6, headVersionNumber: 7, projectName: "", authorName: "M", savedWhen: "x" })).toMatch(
      /of \(untitled\),.*starts from version 6; version 7 stays exactly as it is\.$/,
    );
  });

  it("is null when the version opened is the latest", () => {
    expect(openedOlderVersionNotice({ versionNumber: 7, headVersionNumber: 7, projectName: "S", authorName: "M", savedWhen: "x" })).toBeNull();
  });
});

describe("renameNotice", () => {
  const base = { name: "Smith Residence", versionNumber: 8, renamedFromVersionNumber: 7 };
  it("a project not open here", () => {
    expect(renameNotice({ ...base, outcome: "not-open-here", editorVersionNumber: null })).toBe(
      "Renamed to 'Smith Residence'. That added version 8: version 7, the latest, with only the name changed.",
    );
  });
  it("base moved", () => {
    expect(renameNotice({ ...base, outcome: "base-moved", editorVersionNumber: 7 })).toMatch(/Your editor is on version 8 now, and its project name reads 'Smith Residence'\.$/);
  });
  it("base stayed: the editor stays, its date is unchanged, and the next save keeps the new name", () => {
    expect(renameNotice({ ...base, outcome: "base-stays", editorVersionNumber: 3 })).toMatch(
      /Your editor stays on version 3, the one you started from, so its title-block date is unchanged\. Its project name now reads 'Smith Residence', so your next save keeps the new name\.$/,
    );
  });
  it("late", () => {
    expect(renameNotice({ ...base, outcome: "late", editorVersionNumber: 3 })).toMatch(/replaced while the rename was in progress, so it was not changed\.$/);
  });
});
