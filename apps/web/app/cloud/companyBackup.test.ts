import { createHash } from "node:crypto";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { PROJECT_FILE_VERSION, parseProjectFile, serializeProject, type ProjectState } from "../projectFile";
import { createZipCollector, type BackupFileSink } from "./backupZip";
import type { BackupPageResponse, BackupVersionEntry } from "./cloudTypes";
import {
  BACKUP_CANCELLED_MESSAGE,
  BACKUP_COMPANY_SLUG_MAX_CHARS,
  backupNameSlug,
  backupProjectDirectory,
  backupSharedProjectDirectory,
  backupVersionFileName,
  backupZipFileName,
  claimUniquePath,
  collectCompanyBackup,
  findMissingVersions,
  isWindowsSafePath,
  pageProjectCount,
  type BackupManifest,
  type BackupPageResult,
} from "./companyBackup";

/** A complete, loadable ProjectState: the same fixture shape projectFile.test.ts uses. */
function makeState(overrides: Partial<ProjectState> = {}): ProjectState {
  return {
    editorTab: "wall",
    viewMode: "plan",
    shapeTool: "rectangle",
    footprint: {
      corners: [
        { id: "A", point: { x: 0, y: 0 } },
        { id: "B", point: { x: 20, y: 0 } },
      ],
      walls: [{ id: "AB", startCorner: "A", endCorner: "B", lengthFt: 20 }],
    },
    isBumpedOut: false,
    primaryCornerIds: new Set(["A", "B"]),
    offsetPx: { x: 60, y: 60 },
    baseWallSlots: { AB: [{ type: "standard", widthIn: 40 }, { type: "standard", widthIn: 40 }] },
    leastAccessibleCorner: "A",
    standardWidthIn: 40,
    thicknessIn: 15.5,
    densityLbFt3: 7,
    wallHeightFt: 10,
    includeNailer: false,
    checkedInteriorIds: new Set(["intello-plus"]),
    checkedExteriorIds: new Set(["mento"]),
    season: "winter",
    seismicZone: "moderate",
    foundationTypeId: "vented-crawlspace-helical",
    pierSpacingFt: 8,
    zipCode: "97201",
    role: "fabricator",
    unitSystem: "imperial",
    priceModifier: 1.3,
    floorSystemId: null,
    perpendicular2x4Enabled: false,
    baleFoundationTopDepthIn: 5.5,
    baleFoundationBottomDepthIn: 5.5,
    baleFoundationGapIn: 1.5,
    baleFoundationFieldSpacingIn: 16,
    floorBottomSkinEnabled: true,
    roofSystemTypeId: "truss",
    roofProfileType: "peaked",
    roofProfilePointHeightsFt: [16],
    gableProfilePositionsInByWallId: {},
    gableWindowAnchorsByWallId: {},
    maxGablePanelHeightIn: 96,
    maxPanelHeightIn: 120,
    trussPlateInsetIn: 5.5,
    heelHeightIn: 6,
    roofBearingAnchorMode: "truss-heel",
    boxBeamCoverageByWallId: {},
    boxBeamSizeId: "9x2-lvl",
    midWallBeamsByStoryAndWallId: { ground: {}, second: {} },
    roofCatcherBeamOffsetIn: 11.25,
    roofCatcherBeamShape: "Built-up 2-ply 2x12",
    octagonRingDiameterFt: 3,
    roofTrussCategory: "classic",
    selectedClassicTrussId: "king-post",
    highPerfTrussTypeId: "energy-heel",
    highPerfTrussCavityDepthIn: 18,
    highPerfTrussBearingShapeId: "built-up-3ply-2x12",
    roofTrussSpacingIn: 24,
    roofTrussDoublingStrategy: "single",
    gableEndWallIds: new Set(),
    gableStructuralPanelWallIds: new Set(),
    stories: [
      {
        id: "ground",
        label: "Ground Floor",
        wallHeightFt: 10,
        wallSlots: { AB: [{ type: "standard", widthIn: 40 }, { type: "standard", widthIn: 40 }] },
      },
    ],
    panelizationType: "loose-packed-braced",
    timberFrameCurtainPanelType: "standard",
    timberFrameCurtainWidthIn: 36,
    nailerOffsetIn: 0,
    squareBaleStudConfig: "single-2x4",
    bracingStyle: "chevron",
    bracedStateSeeded: true,
    projectName: "Smith House",
    wallsEnabled: true,
    floorsEnabled: false,
    roofEnabled: false,
    wallReviewNotes: [],
    ...overrides,
  };
}

/** What the cloud hands back: the serialized file after a JSON round trip (jsonb has no Sets). */
const storedDocument = (overrides: Partial<ProjectState> = {}, schemaVersion = PROJECT_FILE_VERSION) =>
  ({ ...JSON.parse(JSON.stringify(serializeProject(makeState(overrides)))), schemaVersion }) as Record<string, unknown>;

// ---------------------------------------------------------------------------
// File names
// ---------------------------------------------------------------------------

describe("file names are safe on Windows", () => {
  it("slugs user text to lower-case ASCII, folding accents, with no forbidden characters", () => {
    expect(backupNameSlug('Smith <House>: "v2" / A\\B | C? D*')).toBe("smith-house-v2-a-b-c-d");
    expect(backupNameSlug("Café Olé")).toBe("cafe-ole");
    expect(backupNameSlug("  trailing dots... ")).toBe("trailing-dots");
    expect(backupNameSlug("")).toBe("untitled");
    expect(backupNameSlug("房子")).toBe("untitled");
    expect(backupNameSlug("CON")).toBe("con");
  });

  it("caps a long name at 60 characters without leaving a trailing hyphen", () => {
    const slug = backupNameSlug(`${"a".repeat(59)} bbbbbb`);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug).not.toMatch(/-$/);
  });

  it("names a version by zero-padded number and UTC minute, with no colons", () => {
    expect(backupVersionFileName(7, "2026-09-13T14:02:05.123456+00:00")).toBe("v0007--2026-09-13T1402Z.json");
    expect(backupVersionFileName(7, "2026-09-13T07:02:05-07:00")).toBe("v0007--2026-09-13T1402Z.json");
    expect(backupVersionFileName(12345, "2026-09-13T14:02:05Z")).toBe("v12345--2026-09-13T1402Z.json");
    expect(backupVersionFileName(3, "not a time")).toBe("v0003--time-not-recorded.json");
    expect(backupZipFileName("Building Integrity", "2026-09-14T12:00:00.000Z")).toBe("company-backup--building-integrity--2026-09-14T1200Z.zip");
  });

  it("caps the company slug in the zip name at 30 characters, so extracted paths stay under Windows' 260", () => {
    const longCompany = "The Very Long Company Name Of Straw Bale Builders Incorporated Northwest";
    const name = backupZipFileName(longCompany, "2026-09-14T12:00:00.000Z");
    expect(name).toBe("company-backup--the-very-long-company-name-of--2026-09-14T1200Z.zip");
    const companySlug = name.slice("company-backup--".length, -"--2026-09-14T1200Z.zip".length);
    expect(companySlug.length).toBeLessThanOrEqual(BACKUP_COMPANY_SLUG_MAX_CHARS);
    expect(companySlug).not.toMatch(/-$/);
    // Project slugs keep their 60.
    expect(backupNameSlug(longCompany)).toHaveLength(60);

    // Worst case, as Windows "Extract All" lays it out: a folder named after
    // the zip (with a full 30-character company slug), then the longest
    // project path this backup can write.
    const fullName = backupZipFileName("Building Integrity Straw Panels Northwest Cooperative", "2026-09-14T12:00:00.000Z");
    expect(fullName).toBe("company-backup--building-integrity-straw-panel--2026-09-14T1200Z.zip");
    const project = backupProjectDirectory("proposals", "P".repeat(500), "9320be5d-515c-4b62-bbfd-19a419a0729e");
    const extracted = `C:\\Users\\Tommy\\Downloads\\${fullName.replace(/\.zip$/, "")}\\${project.replace(/\//g, "\\")}\\${backupVersionFileName(1234, "2026-09-13T14:02:00Z")}`;
    expect(extracted.length).toBe(236);
    expect(extracted.length).toBeLessThan(260);
  });

  it("every generated path passes the Windows check, however hostile the name", () => {
    const hostile = ['CON', 'a<b>c', 'x:"y"', "dots...", "  ", "nul.txt", "ctl", "../../etc", "A".repeat(500)];
    for (const name of hostile) {
      const path = `${backupProjectDirectory("current", name, "9320be5d-515c-4b62-bbfd-19a419a0729e")}/${backupVersionFileName(1, "2026-09-13T14:02:00Z")}`;
      expect(isWindowsSafePath(path), path).toBe(true);
      expect(path.length).toBeLessThan(200);
    }
    expect(isWindowsSafePath("projects/current/con")).toBe(false);
    expect(isWindowsSafePath("projects/current/a:b")).toBe(false);
    expect(isWindowsSafePath("projects/current/trailing.")).toBe(false);
  });

  it("two projects with the same name land in different directories, because the id is in the name", () => {
    const a = backupProjectDirectory("current", "Smith House", "9320be5d-515c-4b62-bbfd-19a419a0729e");
    const b = backupProjectDirectory("current", "smith house", "5a0f3a8e-6c1d-4b8e-9f2a-0c7d1e2b3a4f");
    expect(a).toBe("projects/current/smith-house--9320be5d-515c-4b62-bbfd-19a419a0729e");
    expect(a.toLowerCase()).not.toBe(b.toLowerCase());
  });

  it("a duplicate path (case-insensitively) gets a suffix rather than overwriting a file in the zip", () => {
    const used = new Set<string>();
    expect(claimUniquePath("projects/current/x/v0001.json", used)).toBe("projects/current/x/v0001.json");
    expect(claimUniquePath("projects/current/X/V0001.json", used)).toBe("projects/current/X/V0001-2.json");
    expect(claimUniquePath("projects/current/x/v0001.json", used)).toBe("projects/current/x/v0001-3.json");
  });
});

// ---------------------------------------------------------------------------
// Completeness
// ---------------------------------------------------------------------------

describe("findMissingVersions", () => {
  it("is quiet when every project has 1..head", () => {
    expect(findMissingVersions(new Map([["p", { projectName: "A", numbers: [1, 2, 3], head: 3 }]]))).toBeNull();
  });

  it("names a gap in the middle and a missing latest version", () => {
    expect(findMissingVersions(new Map([["p", { projectName: "A", numbers: [1, 3], head: 3 }]]))).toBe("A is missing version 2");
    expect(findMissingVersions(new Map([["p", { projectName: "", numbers: [1, 2], head: 5 }]]))).toBe("(untitled) is missing versions 3, 4, 5");
  });
});

// ---------------------------------------------------------------------------
// collectCompanyBackup
// ---------------------------------------------------------------------------

const BI = { id: "11111111-0000-0000-0000-000000000001", name: "Building Integrity" };
/** The company that OWNS a granted project: not the one taking the backup. */
const OWNER = { id: "22222222-0000-0000-0000-000000000001", name: "Rare Forms" };
const P1 = "9320be5d-515c-4b62-bbfd-19a419a0729e";
const P2 = "5a0f3a8e-6c1d-4b8e-9f2a-0c7d1e2b3a4f";
const P3 = "7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f";

function entry(projectId: string, projectName: string, n: number, head: number, extra: Partial<BackupVersionEntry> = {}): BackupVersionEntry {
  return {
    projectId,
    projectName,
    folder: "current",
    projectHeadVersionNumber: head,
    versionId: `${projectId.slice(0, 8)}-000${n}`,
    versionNumber: n,
    parentVersionId: n === 1 ? null : `${projectId.slice(0, 8)}-000${n - 1}`,
    kind: "save",
    label: n === 1 ? "first" : null,
    authorName: "Virgil",
    createdAt: `2026-09-1${n}T14:02:05.123456+00:00`,
    schemaVersion: PROJECT_FILE_VERSION,
    document: storedDocument({ projectName: projectName }),
    omitted: null,
    ownership: "owned",
    ownerCompany: null,
    ...extra,
  };
}

/** The same version, reached by a company grant from another company (3E). */
function grantedEntry(
  projectId: string,
  projectName: string,
  n: number,
  head: number,
  owner: { id: string; name: string } = OWNER,
  extra: Partial<BackupVersionEntry> = {},
): BackupVersionEntry {
  return entry(projectId, projectName, n, head, { ownership: "granted", ownerCompany: owner, ...extra });
}

function page(versions: BackupVersionEntry[], extra: Partial<BackupPageResponse> = {}): BackupPageResponse {
  return {
    company: BI,
    exportedBy: { id: "u1", email: "alice@bi.test", displayName: "Alice" },
    serverTime: "2026-09-14T12:00:00.000Z",
    projectCount: null,
    grantedProjectCount: null,
    versions,
    nextAfter: null,
    done: true,
    ...extra,
  };
}

/** Pages served in order; asserts each request's cursor is the previous page's. */
function servePages(pages: BackupPageResult[]) {
  const requested: (string | null)[] = [];
  let i = 0;
  let expectedAfter: string | null = null;
  const fetchPage = async (after: string | null) => {
    requested.push(after);
    expect(after).toBe(expectedAfter);
    const result = pages[Math.min(i++, pages.length - 1)];
    if (result.ok) expectedAfter = result.data.nextAfter;
    return result;
  };
  return { fetchPage, requested };
}

function recordingSink() {
  const files = new Map<string, Uint8Array>();
  const sink: BackupFileSink = { add: (path, data) => void files.set(path, data) };
  return { sink, files };
}

const noSleep = async () => {};

describe("collectCompanyBackup", () => {
  it("builds the manifest the plan specifies, over several pages, with a file per version", async () => {
    const { fetchPage } = servePages([
      { ok: true, data: page([entry(P2, "Smith House", 1, 2), entry(P2, "Smith House", 2, 2)], { projectCount: 2, done: false, nextAfter: `${P2}:2` }) },
      { ok: true, data: page([entry(P1, "Smith House", 1, 1)], { serverTime: "2026-09-14T12:00:09.000Z" }) },
    ]);
    const { sink, files } = recordingSink();
    const progress: number[] = [];
    const outcome = await collectCompanyBackup({
      companyId: BI.id,
      appProjectFileVersion: PROJECT_FILE_VERSION,
      fetchPage,
      sink,
      signal: new AbortController().signal,
      onProgress: (p) => progress.push(p.versions),
      sleep: noSleep,
    });
    if (!outcome.ok) throw new Error(outcome.message);
    const m = outcome.manifest;
    expect(outcome.fileName).toBe("company-backup--building-integrity--2026-09-14T1200Z.zip");
    expect(progress).toEqual([2, 3]);
    expect(m).toMatchObject({
      format: "building-integrity-company-backup",
      formatVersion: 2,
      company: BI,
      exportedAt: "2026-09-14T12:00:00.000Z",
      exportedBy: { id: "u1", email: "alice@bi.test", name: "Alice" },
      appProjectFileVersion: PROJECT_FILE_VERSION,
      projectCount: 2,
      versionCount: 3,
      outsideFileFormatWindowCount: 0,
    });
    expect(m.versions[1]).toEqual({
      path: `projects/current/smith-house--${P2}/v0002--2026-09-12T1402Z.json`,
      projectId: P2,
      projectName: "Smith House",
      folder: "current",
      ownership: "owned",
      versionNumber: 2,
      kind: "save",
      label: null,
      authorName: "Virgil",
      createdAt: "2026-09-12T14:02:05.123456+00:00",
      parentVersionId: `${P2.slice(0, 8)}-0001`,
      schemaVersion: PROJECT_FILE_VERSION,
      fileFormat: "opens",
      opensWithLoadProject: true,
      sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    // Same-named projects don't collide.
    expect(new Set(m.versions.map((v) => v.path)).size).toBe(3);
    expect(m.versions.map((v) => v.path.split("/")[2])).toEqual([`smith-house--${P2}`, `smith-house--${P2}`, `smith-house--${P1}`]);
    // The manifest is the last file, and every listed path exists with the hash it states.
    expect([...files.keys()].at(-1)).toBe("manifest.json");
    for (const v of m.versions) {
      expect(isWindowsSafePath(v.path)).toBe(true);
      expect(createHash("sha256").update(files.get(v.path)!).digest("hex")).toBe(v.sha256);
    }
    expect(JSON.parse(strFromU8(files.get("manifest.json")!))).toEqual(JSON.parse(JSON.stringify(m)));
  });

  it("writes each file as 2-space JSON of the stored document, the same bytes Save Project writes", async () => {
    const doc = storedDocument();
    const { fetchPage } = servePages([{ ok: true, data: page([entry(P1, "Smith House", 1, 1, { document: doc })], { projectCount: 1 }) }]);
    const { sink, files } = recordingSink();
    const outcome = await collectCompanyBackup({ companyId: BI.id, appProjectFileVersion: PROJECT_FILE_VERSION, fetchPage, sink, signal: new AbortController().signal, sleep: noSleep });
    if (!outcome.ok) throw new Error(outcome.message);
    expect(strFromU8(files.get(outcome.manifest.versions[0].path)!)).toBe(JSON.stringify(doc, null, 2));
  });

  it("includes out-of-window versions raw, and marks them in the manifest", async () => {
    const tooOld = entry(P1, "Old", 1, 3, { schemaVersion: PROJECT_FILE_VERSION - 2, document: storedDocument({}, PROJECT_FILE_VERSION - 2) });
    const prior = entry(P1, "Old", 2, 3, { schemaVersion: PROJECT_FILE_VERSION - 1, document: storedDocument({}, PROJECT_FILE_VERSION - 1) });
    const tooNew = entry(P1, "Old", 3, 3, { schemaVersion: PROJECT_FILE_VERSION + 1, document: storedDocument({}, PROJECT_FILE_VERSION + 1) });
    const { fetchPage } = servePages([{ ok: true, data: page([tooOld, prior, tooNew], { projectCount: 1 }) }]);
    const { sink, files } = recordingSink();
    const outcome = await collectCompanyBackup({ companyId: BI.id, appProjectFileVersion: PROJECT_FILE_VERSION, fetchPage, sink, signal: new AbortController().signal, sleep: noSleep });
    if (!outcome.ok) throw new Error(outcome.message);
    expect(outcome.manifest.versions.map((v) => [v.versionNumber, v.fileFormat, v.opensWithLoadProject])).toEqual([
      [1, "too-old", false],
      [2, "opens-via-migration", true],
      [3, "too-new", false],
    ]);
    expect(outcome.manifest.outsideFileFormatWindowCount).toBe(2);
    expect(files.size).toBe(4);
    const oldFile = JSON.parse(strFromU8(files.get(outcome.manifest.versions[0].path)!));
    expect(oldFile.schemaVersion).toBe(PROJECT_FILE_VERSION - 2);
  });

  it("a company with zero projects is a zip holding only the manifest", async () => {
    const { fetchPage } = servePages([{ ok: true, data: page([], { projectCount: 0 }) }]);
    const { sink, files } = recordingSink();
    const outcome = await collectCompanyBackup({ companyId: BI.id, appProjectFileVersion: PROJECT_FILE_VERSION, fetchPage, sink, signal: new AbortController().signal, sleep: noSleep });
    expect(outcome.ok && outcome.manifest).toMatchObject({ projectCount: 0, versionCount: 0, versions: [] });
    expect([...files.keys()]).toEqual(["manifest.json"]);
  });

  describe("a backup never looks complete when it isn't", () => {
    const run = (pages: BackupPageResult[], signal = new AbortController().signal) => {
      const { fetchPage, requested } = servePages(pages);
      const { sink, files } = recordingSink();
      return collectCompanyBackup({ companyId: BI.id, appProjectFileVersion: PROJECT_FILE_VERSION, fetchPage, sink, signal, sleep: noSleep }).then((outcome) => ({ outcome, files, requested }));
    };

    it("a page that keeps failing stops the backup with the server's words, and no manifest is written", async () => {
      const { outcome, files, requested } = await run([
        { ok: true, data: page([entry(P1, "A", 1, 2)], { done: false, nextAfter: `${P1}:1` }) },
        { ok: false, status: 503, message: "Service unavailable." },
      ]);
      expect(outcome).toEqual({ ok: false, reason: "failed", message: "The backup stopped after 1 version: Service unavailable. No file was saved; try again." });
      expect(files.has("manifest.json")).toBe(false);
      expect(requested).toEqual([null, `${P1}:1`, `${P1}:1`, `${P1}:1`]); // retried twice
    });

    it("a transient failure is retried and the backup completes", async () => {
      const { outcome } = await run([
        { ok: false, status: 0, message: "Couldn't reach the server." },
        { ok: true, data: page([entry(P1, "A", 1, 1)]) },
      ]);
      expect(outcome.ok).toBe(true);
    });

    it("a refusal is not retried", async () => {
      const { outcome, requested } = await run([{ ok: false, status: 403, message: "Only a company admin of Building Integrity can download its backup." }]);
      expect(outcome).toMatchObject({ ok: false, reason: "failed" });
      expect(requested).toHaveLength(1);
    });

    it("a version the server could not include fails the backup, naming it", async () => {
      const { outcome, files } = await run([{ ok: true, data: page([entry(P1, "A", 1, 2), entry(P1, "A", 2, 2, { document: null, omitted: "too-large" })]) }]);
      expect(outcome).toEqual({
        ok: false,
        reason: "failed",
        message: "The backup stopped after 1 version: Version 2 of A is too large to download in one piece, so the backup can't include it. No file was saved; try again.",
      });
      expect(files.has("manifest.json")).toBe(false);
    });

    it("a version number missing from a project's run fails the backup", async () => {
      const { outcome } = await run([{ ok: true, data: page([entry(P1, "Smith House", 1, 3), entry(P1, "Smith House", 3, 3)]) }]);
      expect(outcome).toMatchObject({ ok: false, reason: "failed", message: expect.stringContaining("Smith House is missing version 2.") });
    });

    it("pages that stop advancing fail rather than loop", async () => {
      const { outcome } = await run([{ ok: true, data: page([entry(P1, "A", 1, 1)], { done: false, nextAfter: null }) }]);
      expect(outcome).toMatchObject({ ok: false, message: expect.stringContaining("stopped advancing") });
    });

    it("a page for a different company fails", async () => {
      const { outcome } = await run([{ ok: true, data: page([], { company: { id: "22222222-0000-0000-0000-000000000001", name: "Rare Forms" } }) }]);
      expect(outcome).toMatchObject({ ok: false, message: expect.stringContaining("different company") });
    });

    it("cancel stops between pages and writes no manifest", async () => {
      const controller = new AbortController();
      const { sink, files } = recordingSink();
      let calls = 0;
      const outcome = await collectCompanyBackup({
        companyId: BI.id,
        appProjectFileVersion: PROJECT_FILE_VERSION,
        fetchPage: async () => {
          calls++;
          controller.abort();
          return { ok: true, data: page([entry(P1, "A", 1, 2)], { done: false, nextAfter: `${P1}:1` }) };
        },
        sink,
        signal: controller.signal,
        sleep: noSleep,
      });
      expect(outcome).toEqual({ ok: false, reason: "cancelled", message: BACKUP_CANCELLED_MESSAGE });
      expect(calls).toBe(1);
      expect(files.has("manifest.json")).toBe(false);
    });

    it("an aborted fetch reads as cancelled, not failed", async () => {
      const controller = new AbortController();
      const outcome = await collectCompanyBackup({
        companyId: BI.id,
        appProjectFileVersion: PROJECT_FILE_VERSION,
        fetchPage: async () => {
          controller.abort();
          throw new DOMException("aborted", "AbortError");
        },
        sink: recordingSink().sink,
        signal: controller.signal,
        sleep: noSleep,
      });
      expect(outcome).toMatchObject({ ok: false, reason: "cancelled" });
    });
  });
});

// ---------------------------------------------------------------------------
// Stage 3E: projects another company shared with this one
// ---------------------------------------------------------------------------

describe("granted projects in a company backup (3E)", () => {
  const run = (pages: BackupPageResult[]) => {
    const { fetchPage } = servePages(pages);
    const { sink, files } = recordingSink();
    const progress: { versions: number; projectCount: number | null }[] = [];
    return collectCompanyBackup({
      companyId: BI.id,
      appProjectFileVersion: PROJECT_FILE_VERSION,
      fetchPage,
      sink,
      signal: new AbortController().signal,
      sleep: noSleep,
      onProgress: (p) => progress.push({ versions: p.versions, projectCount: p.projectCount }),
    }).then((outcome) => ({ outcome, files, progress }));
  };

  it("files a granted project under shared/<owner>/, marks it granted and names the owner; owned entries are untouched", async () => {
    const { outcome, files } = await run([
      {
        ok: true,
        data: page([entry(P1, "Ours", 1, 1), grantedEntry(P2, "Theirs", 1, 1)], { projectCount: 1, grantedProjectCount: 1 }),
      },
    ]);
    if (!outcome.ok) throw new Error(outcome.message);
    const m = outcome.manifest;
    expect(m.formatVersion).toBe(2);

    const [owned, granted] = m.versions;
    expect(owned.path).toBe(`projects/current/ours--${P1}`.concat("/v0001--2026-09-11T1402Z.json"));
    expect(owned.ownership).toBe("owned");
    // An owned entry is byte for byte 2D's: no ownerCompany key at all.
    expect("ownerCompany" in owned).toBe(false);

    expect(granted.ownership).toBe("granted");
    expect(granted.ownerCompany).toEqual(OWNER);
    expect(granted.path).toBe(`shared/rare-forms/theirs--${P2}/v0001--2026-09-11T1402Z.json`);
    expect(granted.path.startsWith("shared/")).toBe(true);
    // The owner's FOLDER never becomes a directory of this company's backup.
    expect(granted.path).not.toMatch(/^projects\//);

    // Counts, and a correct SHA-256 for the shared file as well as the owned one.
    expect(m.projectCount).toBe(2);
    expect(m.grantedProjectCount).toBe(1);
    expect(m.versionCount).toBe(2);
    for (const v of m.versions) {
      expect(isWindowsSafePath(v.path)).toBe(true);
      expect(createHash("sha256").update(files.get(v.path)!).digest("hex")).toBe(v.sha256);
    }
  });

  it("two owners' projects of the same name stay apart, and one owner's projects share one directory", async () => {
    const other = { id: "33333333-0000-0000-0000-000000000001", name: "New Frameworks" };
    const { outcome } = await run([
      {
        ok: true,
        data: page(
          [grantedEntry(P2, "Barn", 1, 1), grantedEntry(P3, "Barn", 1, 1, other), grantedEntry(P2, "Barn", 2, 2)],
          { projectCount: 0, grantedProjectCount: 2 },
        ),
      },
    ]);
    if (!outcome.ok) throw new Error(outcome.message);
    const paths = outcome.manifest.versions.map((v) => v.path);
    expect(paths[0]).toBe(`shared/rare-forms/barn--${P2}/v0001--2026-09-11T1402Z.json`);
    expect(paths[1]).toBe(`shared/new-frameworks/barn--${P3}/v0001--2026-09-11T1402Z.json`);
    expect(paths[2]).toBe(`shared/rare-forms/barn--${P2}/v0002--2026-09-12T1402Z.json`);
    expect(new Set(paths).size).toBe(3);
    expect(outcome.manifest.grantedProjectCount).toBe(2);
    expect(outcome.manifest.projectCount).toBe(2);
  });

  it("an owner whose name could not be read back is a visible gap, not a substituted name", async () => {
    const { outcome } = await run([
      { ok: true, data: page([grantedEntry(P2, "Barn", 1, 1, { id: OWNER.id, name: "" })], { projectCount: 0, grantedProjectCount: 1 }) },
    ]);
    if (!outcome.ok) throw new Error(outcome.message);
    const [v] = outcome.manifest.versions;
    // The id still identifies the owner, and the project id is in the path.
    expect(v.ownerCompany).toEqual({ id: OWNER.id, name: "" });
    expect(v.path).toBe(`shared/untitled/barn--${P2}/v0001--2026-09-11T1402Z.json`);
  });

  it("the completeness check covers granted projects too: a missing version saves no file", async () => {
    const { outcome, files } = await run([
      { ok: true, data: page([grantedEntry(P2, "Barn", 1, 3), grantedEntry(P2, "Barn", 3, 3)], { projectCount: 0, grantedProjectCount: 1 }) },
    ]);
    expect(outcome).toMatchObject({ ok: false, reason: "failed", message: expect.stringContaining("Barn is missing version 2.") });
    expect(files.has("manifest.json")).toBe(false);
  });

  it("the progress line counts owned and granted projects together", async () => {
    const { progress } = await run([
      { ok: true, data: page([entry(P1, "Ours", 1, 1), grantedEntry(P2, "Theirs", 1, 1)], { projectCount: 4, grantedProjectCount: 3 }) },
    ]);
    expect(progress.at(-1)).toEqual({ versions: 2, projectCount: 7 });
    // A page that knows neither total keeps 2D's "no total known" branch.
    expect(pageProjectCount(page([], { projectCount: null, grantedProjectCount: null }))).toBeNull();
    expect(pageProjectCount(page([], { projectCount: 2, grantedProjectCount: null }))).toBe(2);
  });

  it("the manifest's notes say what is in a backup, what is not, and that a backup cannot be recalled", async () => {
    const { outcome } = await run([{ ok: true, data: page([], { projectCount: 0, grantedProjectCount: 0 }) }]);
    if (!outcome.ok) throw new Error(outcome.message);
    const notes = outcome.manifest.notes.join(" ");
    expect(notes).toMatch(/shared with this company/);
    expect(notes).toMatch(/shared with one person, rather than with this company, is not here/);
    expect(notes).toMatch(/cannot be recalled/);
    // The 2D note that said shared projects were excluded is gone.
    expect(notes).not.toMatch(/not included in this stage/);
  });

  it("a shared path stays inside Windows' 260 characters, which is why the owner slug is capped at 30", () => {
    // Any owner name is capped…
    expect(
      backupSharedProjectDirectory("The Very Long Company Name Of Straw Bale Builders Incorporated Northwest", "x", "id").split("/")[1].length,
    ).toBeLessThanOrEqual(BACKUP_COMPANY_SLUG_MAX_CHARS);

    // …and this is the WORST case: a name that fills all 30 characters with no
    // trailing hyphen to trim, the longest project name, and a full uuid.
    const worstOwner = "Building Integrity Straw Panels Northwest Cooperative";
    const directory = backupSharedProjectDirectory(worstOwner, "P".repeat(500), "9320be5d-515c-4b62-bbfd-19a419a0729e");
    const ownerSlug = directory.split("/")[1];
    expect(ownerSlug).toHaveLength(BACKUP_COMPANY_SLUG_MAX_CHARS);

    const zipName = backupZipFileName(worstOwner, "2026-09-14T12:00:00.000Z");
    const extracted = `C:\\Users\\Tommy\\Downloads\\${zipName.replace(/\.zip$/, "")}\\${directory.replace(/\//g, "\\")}\\${backupVersionFileName(1234, "2026-09-13T14:02:00Z")}`;
    expect(extracted.length).toBe(255);
    expect(extracted.length).toBeLessThan(260);
    expect(isWindowsSafePath(`${directory}/${backupVersionFileName(1, "2026-09-13T14:02:00Z")}`)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The real zip, and the round trip through Load Project's parser
// ---------------------------------------------------------------------------

describe("the zip round trip", () => {
  it("a zipped version file loads through parseProjectFile, and the manifest unzips intact", async () => {
    const zip = createZipCollector();
    const doc = storedDocument({ projectName: "Smith House", zipCode: "97201" });
    const { fetchPage } = servePages([
      {
        ok: true,
        data: page(
          [
            entry(P1, "Smith House", 1, 2, { document: doc }),
            entry(P1, "Smith House", 2, 2, { schemaVersion: PROJECT_FILE_VERSION - 2, document: storedDocument({}, PROJECT_FILE_VERSION - 2) }),
          ],
          { projectCount: 1 },
        ),
      },
    ]);
    const outcome = await collectCompanyBackup({ companyId: BI.id, appProjectFileVersion: PROJECT_FILE_VERSION, fetchPage, sink: zip, signal: new AbortController().signal, sleep: noSleep });
    if (!outcome.ok) throw new Error(outcome.message);

    const bytes = new Uint8Array(zip.finish().reduce<number[]>((all, chunk) => (all.push(...chunk), all), []));
    expect(bytes.length).toBe(zip.byteLength());
    const unzipped = unzipSync(bytes);
    const manifest = JSON.parse(strFromU8(unzipped["manifest.json"])) as BackupManifest;
    expect(Object.keys(unzipped).sort()).toEqual(["manifest.json", ...manifest.versions.map((v) => v.path)].sort());

    const loadable = manifest.versions.find((v) => v.opensWithLoadProject)!;
    const parsed = parseProjectFile(strFromU8(unzipped[loadable.path]));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.state.projectName).toBe("Smith House");
    expect(parsed.state.zipCode).toBe("97201");
    expect(parsed.state.primaryCornerIds).toEqual(new Set(["A", "B"]));
    expect(parsed.savedAt).toBe(doc.savedAt);
    expect(createHash("sha256").update(unzipped[loadable.path]).digest("hex")).toBe(loadable.sha256);

    // The out-of-window file is in the zip, untouched, and plain Load Project refuses it as the manifest says.
    const raw = manifest.versions.find((v) => !v.opensWithLoadProject)!;
    const refused = parseProjectFile(strFromU8(unzipped[raw.path]));
    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.error).toContain("Unsupported project file version");
  });
});
