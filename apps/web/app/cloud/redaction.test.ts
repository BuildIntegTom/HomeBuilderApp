import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PROJECT_FILE_VERSION, serializeProject, type ProjectState } from "../projectFile";
import {
  MONEY_CLASSIFICATION,
  MONEY_DOCUMENT_PATHS,
  MONEY_STATE_KEYS,
  REDACTION_MARKER_KEY,
  isRedactablePath,
  readRedactionMarker,
} from "./redaction";

/**
 * Decision 21's "tested against `ProjectState`'s own key list", in the three
 * layers the plan names, plus the shape assertion (d).
 *
 * LAYER (a) IS NOT HERE, AND THAT IS THE POINT. `MONEY_CLASSIFICATION` is
 * `as const satisfies Record<keyof ProjectState, MoneyClassification>`, so
 * adding a field to `ProjectState` without classifying it fails `tsc --noEmit`,
 * naming the missing key — the build breaks, not a test that could be skipped.
 * What is here is everything the compiler cannot see.
 */

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "supabase", "migrations");

/** 0009 created `browse_schema_redaction` and seeded version 24. */
const migrationPath = join(migrationsDir, "0009_stage4_browsing.sql");

/** 0010 seeds version 25 — Smearforn Stage 0's format bump, and nothing else.
 * Its own conventions are asserted in describe (c). */
const v25SeedMigrationPath = join(migrationsDir, "0010_smearforn_v25_redaction_seed.sql");

/**
 * A REAL redacted document, captured from `browse_redact` running on local
 * PostgreSQL 17.4 with migrations 0001–0009 applied — not hand-written to look
 * like one. The input carried `state.priceModifier: 1.3777`, a value that
 * appears nowhere else, plus nested arrays, so "the value does not survive" is
 * checkable as text.
 */
const REAL_REDACTED_DOCUMENT =
  '{"state": {"stories": [{"wallSlots": {"w1": [{"type": "standard", "widthIn": 48}]}, "wallHeightFt": 8}], "zipCode": "05001", ' +
  '"projectName": "Smith House"}, "savedAt": "2026-09-14T13:00:00.000Z", "redaction": {"reason": "another company\'s cost information", ' +
  '"removedPaths": ["state.priceModifier"], "schemaVersion": 24}, "schemaVersion": 24}';

/** The margin that was in the document before the redactor ran. */
const REDACTED_VALUE = "1.3777";

/** The file format the capture above was taken at. Deliberately its own
 * constant rather than `PROJECT_FILE_VERSION`: the capture is a real artefact
 * of a real redactor run and does not move when the app's format does — see
 * the v25 note in describe (c). */
const REAL_REDACTED_DOCUMENT_VERSION = 24;

/** Is there a KEY of this name at any depth, arrays included? */
function hasKeyAtAnyDepth(value: unknown, key: string): boolean {
  if (Array.isArray(value)) return value.some((entry) => hasKeyAtAnyDepth(entry, key));
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(record, key)) return true;
    return Object.values(record).some((entry) => hasKeyAtAnyDepth(entry, key));
  }
  return false;
}

describe("(b) the runtime keys agree with the type", () => {
  // A whole, real project state — the same shape `serializeProject` writes to
  // a file and to the cloud. Built by hand rather than imported so this test
  // fails when a key is ADDED, which is exactly what it is for.
  //
  // EVERY NUMBER BELOW IS AN ARBITRARY FIXTURE VALUE, not a building figure and
  // not a catalog value: this test reads only the KEYS. Nothing here is a claim
  // about a real thickness, density, spacing or height, and none of it is
  // provisional in the flag convention's sense. (`projectFile.test.ts`'s
  // `makeState` is the same kind of fixture.)
  const state = {
    editorTab: "wall",
    viewMode: "plan",
    shapeTool: "rectangle",
    footprint: null,
    isBumpedOut: false,
    primaryCornerIds: new Set<string>(),
    offsetPx: { x: 0, y: 0 },
    baseWallSlots: {},
    leastAccessibleCorner: "c1",
    standardWidthIn: 48,
    thicknessIn: 18,
    densityLbFt3: 8,
    wallHeightFt: 8,
    includeNailer: true,
    checkedInteriorIds: new Set<string>(),
    checkedExteriorIds: new Set<string>(),
    season: "winter",
    seismicZone: "D",
    foundationTypeId: "pier",
    pierSpacingFt: 8,
    zipCode: "05001",
    role: "fabricator",
    unitSystem: "imperial",
    priceModifier: 1.3,
    floorSystemId: null,
    perpendicular2x4Enabled: false,
    roofSystemTypeId: "truss",
    roofProfileType: "peaked",
    roofProfilePointHeightsFt: [4],
    gableProfilePositionsInByWallId: {},
    maxGablePanelHeightIn: 96,
    trussPlateInsetIn: 1,
    heelHeightIn: 6,
    boxBeamCoverageByWallId: {},
    boxBeamSizeId: "b1",
    midWallBeamsByStoryAndWallId: { ground: {}, second: {} },
    roofCatcherBeamOffsetIn: 0,
    roofCatcherBeamShape: "rectangle",
    octagonRingDiameterFt: 12,
    gableEndWallIds: new Set<string>(),
    stories: [],
    panelizationType: "loose-packed-braced",
    timberFrameCurtainPanelType: "standard",
    timberFrameCurtainWidthIn: 24,
    nailerOffsetIn: 0,
    squareBaleStudConfig: "double-2x4",
    bracingStyle: "x",
    projectName: "Smith House",
    wallsEnabled: true,
    floorsEnabled: false,
    roofEnabled: false,
    foundationEnabled: false,
  } as unknown as ProjectState;

  it("every key a real serialized document carries is classified", () => {
    const unclassified = Object.keys(serializeProject(state).state).filter(
      (key) => !(key in MONEY_CLASSIFICATION),
    );
    expect(unclassified).toEqual([]);
  });

  it("classifies exactly one field as money, and it is the price modifier", () => {
    expect(MONEY_STATE_KEYS).toEqual(["priceModifier"]);
    expect(MONEY_DOCUMENT_PATHS).toEqual(["state.priceModifier"]);
  });

  it("the money field is a number, so NaN is a usable gap", () => {
    // The compile-time half of this lives in redaction.ts. This is the runtime
    // half: the field really is numeric in a real serialized document.
    expect(typeof serializeProject(state).state.priceModifier).toBe("number");
  });
});

describe("(c) the migration agrees with the classification", () => {
  const sql = readFileSync(migrationPath, "utf8");
  const v25Sql = readFileSync(v25SeedMigrationPath, "utf8");

  /** Every `browse_schema_redaction` seed row across every migration that
   * writes one, as they are written:
   *    (24, '[["state","priceModifier"]]'::jsonb, …) */
  const seedRowsIn = (text: string) => [...text.matchAll(/\(\s*(\d+)\s*,\s*'(\[[\s\S]*?\])'::jsonb/g)];
  const seededRows = () => [...seedRowsIn(sql), ...seedRowsIn(v25Sql)];

  /** Every format the shipped redactor knows how to strip. It is a property of
   * the DATABASE (the seed rows above), not of the app, so it does not follow
   * `PROJECT_FILE_VERSION` — 24 stays classified forever, because saved v24
   * documents are never migrated in place and must keep being servable. */
  const CLASSIFIED_SCHEMA_VERSIONS = [24, 25];

  it("seeds exactly the money keys for every format it does classify", () => {
    const rows = seededRows();
    const seeded = new Map(rows.map((m) => [Number(m[1]), JSON.parse(m[2]) as string[][]]));
    expect([...seeded.keys()].sort()).toEqual(CLASSIFIED_SCHEMA_VERSIONS);
    for (const version of CLASSIFIED_SCHEMA_VERSIONS) {
      const paths = (seeded.get(version) ?? []).map((p) => p.join("."));
      expect(paths.sort()).toEqual([...MONEY_DOCUMENT_PATHS].sort());
    }
  });

  it("classifies the format the app actually writes today — v25", () => {
    // **The gap this replaces was real and this test is its closing.**
    // Smearforn Stage 0 bumped PROJECT_FILE_VERSION 24 -> 25 for the
    // Foundation scope flag while stating it touched nothing in `supabase/`.
    // But the redactor classifies BY FORMAT, so from that moment every
    // project Tommy saved was a v25 document with no classification, and
    // `browse_version` refused it across a company line. Fail-closed —
    // refused, never served unredacted (the guard test below) — and
    // owner-side open/save/versioning was unaffected throughout.
    //
    // Migration 0010 seeds the row. Until it is APPLIED TO THE LIVE DATABASE
    // this test passing means only that the SQL is written, which is why the
    // README carries paste steps and a post-flight query for it.
    const rows = seededRows();
    expect(rows.some((m) => Number(m[1]) === PROJECT_FILE_VERSION)).toBe(true);
    expect(PROJECT_FILE_VERSION).toBe(25);
    // v24 keeps its row. A saved version is not migrated in place, so the
    // database holds both formats indefinitely and dropping 24 would make
    // every already-saved document unservable.
    expect(rows.some((m) => Number(m[1]) === 24)).toBe(true);
  });

  it("0010 is one transaction, re-runnable, and alters no existing object", () => {
    // The four properties that make a migration safe to paste into the live
    // SQL editor, asserted against the file rather than inherited from 0009.
    expect(v25Sql).toMatch(/^begin;$/m);
    expect(v25Sql.trimEnd()).toMatch(/commit;$/);
    // Re-runnable: the one statement is an upsert.
    expect(v25Sql).toMatch(/on conflict \(schema_version\) do update/);
    // Alters nothing that already exists. A seed row is the whole file, so
    // none of these verbs has any business appearing in it.
    for (const forbidden of [
      /\bcreate\s+(or\s+replace\s+)?(table|function|policy|index|trigger|type|view)\b/i,
      /\bdrop\b/i,
      /\balter\b/i,
      /\bgrant\b/i,
      /\brevoke\b/i,
      /\bdelete\s+from\b/i,
      /\btruncate\b/i,
    ]) {
      // Comments are stripped first: the header explains what it does NOT do,
      // and it says so using these very words.
      const statements = v25Sql
        .split(/\r?\n/)
        .filter((line) => !line.trimStart().startsWith("--"))
        .join("\n");
      expect(statements).not.toMatch(forbidden);
    }
    // Exactly one statement writes anything.
    expect([...v25Sql.matchAll(/\binsert\s+into\b/gi)]).toHaveLength(1);
  });

  it("the redactor refuses an unclassified format rather than serving it (the future-schema guard)", () => {
    expect(sql).toMatch(/has no redaction classification, so it cannot be shown to another company/);
    expect(sql).toMatch(/using errcode = '0A000'/);
  });

  it("carries the belt: a surviving priceModifier key at any depth refuses the whole document", () => {
    expect(sql).toMatch(/jsonb_path_exists\(v_doc, 'lax \$\.\*\*\.priceModifier'\)/);
  });
});

describe("(d) a redacted document's shape", () => {
  const document = JSON.parse(REAL_REDACTED_DOCUMENT) as Record<string, unknown>;

  it("has no key named priceModifier at any depth", () => {
    expect(hasKeyAtAnyDepth(document, "priceModifier")).toBe(false);
    for (const key of MONEY_STATE_KEYS) expect(hasKeyAtAnyDepth(document, key)).toBe(false);
  });

  it("does not contain the string priceModifier OUTSIDE the marker", () => {
    // Stated this way and not as "the whole string does not contain it": the
    // marker's own removedPaths SAYS `state.priceModifier`, so the whole-string
    // form both fails against a correct redactor and passes when only the
    // marker carries the name (4A as built, item 1).
    const { redaction: _marker, ...rest } = document;
    expect(JSON.stringify(rest)).not.toContain("priceModifier");
  });

  it("does not contain the modifier's VALUE anywhere, marker included", () => {
    expect(REAL_REDACTED_DOCUMENT).not.toContain(REDACTED_VALUE);
  });

  it("names what it removed, and why, at the format it was redacted for", () => {
    const marker = readRedactionMarker(document);
    expect(marker).toEqual({
      schemaVersion: REAL_REDACTED_DOCUMENT_VERSION,
      removedPaths: ["state.priceModifier"],
      reason: "another company's cost information",
    });
  });

  it("leaves the design alone: everything that is not money is still there", () => {
    const state = document.state as Record<string, unknown>;
    expect(state.projectName).toBe("Smith House");
    // Decision 12 already accepted that a browsing company sees the site.
    expect(state.zipCode).toBe("05001");
    expect(JSON.stringify(state.stories)).toContain("widthIn");
  });
});

describe("readRedactionMarker", () => {
  const good = { schemaVersion: 24, removedPaths: ["state.priceModifier"], reason: "another company's cost information" };

  it("reads a well-formed marker", () => {
    expect(readRedactionMarker({ [REDACTION_MARKER_KEY]: good })).toEqual(good);
  });

  it("returns null — the fail-closed answer — for anything else", () => {
    expect(readRedactionMarker(null)).toBeNull();
    expect(readRedactionMarker("a string")).toBeNull();
    expect(readRedactionMarker([good])).toBeNull();
    expect(readRedactionMarker({})).toBeNull();
    expect(readRedactionMarker({ redaction: null })).toBeNull();
    expect(readRedactionMarker({ redaction: [] })).toBeNull();
    expect(readRedactionMarker({ redaction: { ...good, schemaVersion: "24" } })).toBeNull();
    expect(readRedactionMarker({ redaction: { ...good, schemaVersion: 24.5 } })).toBeNull();
    expect(readRedactionMarker({ redaction: { ...good, removedPaths: "state.priceModifier" } })).toBeNull();
    expect(readRedactionMarker({ redaction: { ...good, removedPaths: [7] } })).toBeNull();
    expect(readRedactionMarker({ redaction: { ...good, reason: undefined } })).toBeNull();
  });
});

describe("isRedactablePath", () => {
  it("accepts only the paths the classification calls money", () => {
    expect(isRedactablePath("state.priceModifier")).toBe(true);
  });

  it("refuses a path that is a real design input, however plausible it looks", () => {
    // A marker claiming this was removed must NOT excuse it: the document
    // would then open with a hole in the design rather than in the money.
    for (const path of ["state.zipCode", "state.footprint", "state", "priceModifier", "state.PriceModifier", ""]) {
      expect(isRedactablePath(path)).toBe(false);
    }
  });
});
