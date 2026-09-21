import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Entitlement } from "../auth/actingAs";
import {
  BACKUP_COMPANY_NOT_FOUND_MESSAGE,
  BACKUP_CURSOR_MESSAGE,
  BACKUP_DOCUMENT_BATCH_SIZE,
  BACKUP_PAGE_BYTE_BUDGET,
  BACKUP_PAGE_MAX_VERSIONS,
  checkBackupAccess,
  formatBackupCursor,
  jsonByteLength,
  parseBackupCursor,
  parseBackupLimit,
  readBackupPage,
  type BackupCaller,
} from "./backupRouteLogic";
import { BACKUP_REFUSED_MESSAGE, ProjectRouteError, VERSION_LIST_COLUMNS } from "./projectRouteLogic";

// ---------------------------------------------------------------------------
// A chainable stand-in for the supabase-js query builder, as in
// projectRouteLogic.test.ts. Every call is recorded; `respond` decides what the
// database "returned".
// ---------------------------------------------------------------------------
interface Call {
  kind: "from" | "rpc";
  name: string;
  ops: [string, unknown[]][];
  terminal?: string;
  /** For an rpc call: the single arguments object. */
  args?: Record<string, unknown>;
}
type Reply = { data?: unknown; error?: unknown; count?: number };

function fakeDb(respond: (call: Call) => Reply) {
  const calls: Call[] = [];
  const builder = (call: Call): unknown => {
    const finish = (terminal?: string) => {
      call.terminal = terminal;
      calls.push(call);
      return Promise.resolve()
        .then(() => respond(call))
        .then((r) => ({ data: r.data ?? null, error: r.error ?? null, count: r.count ?? null }));
    };
    const chain: unknown = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === "then") {
            return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => finish().then(resolve, reject);
          }
          if (prop === "single" || prop === "maybeSingle") return () => finish(prop);
          return (...args: unknown[]) => {
            call.ops.push([String(prop), args]);
            return chain;
          };
        },
      },
    );
    return chain;
  };
  const db = {
    from: (name: string) => builder({ kind: "from", name, ops: [] }),
    // 3E calls one RPC: project_owner_company_name, for a granted project's owner.
    rpc: (name: string, args: Record<string, unknown>) => {
      const call: Call = { kind: "rpc", name, ops: [], args };
      calls.push(call);
      return Promise.resolve()
        .then(() => respond(call))
        .then((r) => ({ data: r.data ?? null, error: r.error ?? null, count: r.count ?? null }));
    },
  };
  return { db: db as unknown as SupabaseClient, calls };
}

const opArgs = (call: Call, op: string) => call.ops.find(([name]) => name === op)?.[1];
const opsNamed = (call: Call, op: string) => call.ops.filter(([name]) => name === op).map(([, args]) => args);

const BI_ID = "11111111-0000-0000-0000-000000000001";
const RF_ID = "22222222-0000-0000-0000-000000000001";
const PA = "0a000000-0000-4000-8000-000000000001";
const PB = "0b000000-0000-4000-8000-000000000002";

const ent = (companyId: string, companyName: string, source: Entitlement["source"], level: Entitlement["level"]): Entitlement => ({
  companyId,
  companyName,
  source,
  level,
  isDefault: false,
});
const BI_ADMIN = ent(BI_ID, "Building Integrity", "membership", "admin");
const BI_MEMBER = ent(BI_ID, "Building Integrity", "membership", "member");

const caller = (actingAs: Entitlement | null, isPlatformAdmin = false): BackupCaller => ({
  actingAs,
  user: { id: "u1", email: "a@bi.test", displayName: "Alice", isPlatformAdmin },
});

// ---------------------------------------------------------------------------
// A small in-memory company: projects and their versions, served the way the
// route queries them (and only through the filters it applies).
// ---------------------------------------------------------------------------
interface FakeVersion {
  id: string;
  version_number: number;
  document: unknown;
}
interface FakeProject {
  id: string;
  company_id: string;
  name: string;
  folder: string;
  head_version_number: number;
  versions: FakeVersion[];
}

/** A `collaborators` row. A PERSONAL grant has `grantee_company_id` null. */
interface FakeGrant {
  project_id: string;
  grantee_company_id: string | null;
  grantee_user_id?: string | null;
}

interface CompanyDbOptions {
  latency?: boolean;
  /** 3E: rows of `collaborators`, served only through their own filters. */
  grants?: FakeGrant[];
  /** Company names, as `project_owner_company_name` would answer. */
  companyNames?: Record<string, string>;
  /** Make that RPC fail, to prove an unreadable owner name is a gap, not a guess. */
  ownerNameFails?: boolean;
}

function companyDb(projects: FakeProject[], options: CompanyDbOptions = {}) {
  const stats = { docReads: 0, inFlightDocReads: 0, maxConcurrentDocReads: 0 };
  const serve = serveCompany(projects, options);
  const fake = fakeDb((call) => {
    const isDocRead = call.name === "project_versions" && opArgs(call, "select")?.[0] === "document";
    if (!isDocRead || !options.latency) {
      if (isDocRead) stats.docReads++;
      return serve(call);
    }
    // A document read that takes a moment, so reads issued together overlap.
    stats.docReads++;
    stats.inFlightDocReads++;
    stats.maxConcurrentDocReads = Math.max(stats.maxConcurrentDocReads, stats.inFlightDocReads);
    return new Promise<Reply>((resolve) =>
      setTimeout(() => {
        stats.inFlightDocReads--;
        resolve(serve(call));
      }, 2),
    ) as unknown as Reply;
  });
  return { ...fake, stats };
}

function serveCompany(projects: FakeProject[], options: CompanyDbOptions = {}) {
  const grants = options.grants ?? [];
  return (call: Call): Reply => {
    if (call.kind === "rpc") {
      if (call.name !== "project_owner_company_name") throw new Error(`unexpected rpc ${call.name}`);
      if (options.ownerNameFails) return { error: { code: "42501", message: "permission denied" } };
      const project = projects.find((p) => p.id === call.args?.p_project);
      return { data: project ? (options.companyNames?.[project.company_id] ?? null) : null };
    }
    const eq = new Map(opsNamed(call, "eq").map(([k, v]) => [k as string, v]));
    const gt = new Map(opsNamed(call, "gt").map(([k, v]) => [k as string, v]));
    const limit = (opArgs(call, "limit")?.[0] as number | undefined) ?? Infinity;
    if (call.name === "collaborators") {
      const selectArgs = opArgs(call, "select");
      // Served ONLY through the filters the route applies. A personal grant's
      // grantee_company_id is null, so `.eq('grantee_company_id', …)` never
      // matches one — which is Open Item 2, in the fake as in PostgREST.
      let rows = grants.filter((g) => g.grantee_company_id === eq.get("grantee_company_id"));
      if (eq.has("project_id")) rows = rows.filter((g) => g.project_id === eq.get("project_id"));
      if (gt.has("project_id")) rows = rows.filter((g) => g.project_id > (gt.get("project_id") as string));
      rows = [...rows].sort((a, b) => a.project_id.localeCompare(b.project_id)).slice(0, limit);
      if ((selectArgs?.[1] as { head?: boolean } | undefined)?.head) return { count: rows.length };
      return { data: rows.map(({ project_id }) => ({ project_id })) };
    }
    if (call.name === "projects") {
      const selectArgs = opArgs(call, "select");
      // RLS lets a platform admin read every company's projects, so this fake
      // filters by company ONLY when the route asked it to. That is what makes
      // the "every read is filtered" assertions below mean something.
      let rows = eq.has("company_id") ? projects.filter((p) => p.company_id === eq.get("company_id")) : projects;
      if (eq.has("id")) rows = rows.filter((p) => p.id === eq.get("id"));
      if (gt.has("id")) rows = rows.filter((p) => p.id > (gt.get("id") as string));
      rows = [...rows].sort((a, b) => a.id.localeCompare(b.id)).slice(0, limit);
      if ((selectArgs?.[1] as { head?: boolean } | undefined)?.head) return { count: rows.length };
      const shaped = rows.map(({ id, company_id, name, folder, head_version_number }) => ({ id, company_id, name, folder, head_version_number }));
      return call.terminal === "maybeSingle" ? { data: shaped[0] ?? null } : { data: shaped };
    }
    // project_versions
    const project = projects.find((p) => p.id === eq.get("project_id"));
    if (!project) return call.terminal === "maybeSingle" ? { data: null } : { data: [] };
    if (eq.has("id")) {
      const v = project.versions.find((x) => x.id === eq.get("id"));
      return { data: v ? { document: v.document } : null };
    }
    const rows = project.versions
      .filter((v) => v.version_number > ((gt.get("version_number") as number) ?? 0))
      .sort((a, b) => a.version_number - b.version_number)
      .slice(0, limit)
      .map((v) => ({
        id: v.id,
        version_number: v.version_number,
        parent_version_id: null,
        kind: "save",
        label: null,
        author_name: "Alice",
        created_at: "2026-09-13T14:02:05.123456+00:00",
        schema_version: 24,
      }));
    return { data: rows };
  };
}

const vid = (p: string, n: number) => `${p.slice(0, 8)}-${String(n).padStart(4, "0")}-4000-8000-000000000000`;
const project = (id: string, name: string, count: number, doc: (n: number) => unknown = (n) => ({ schemaVersion: 24, state: { projectName: name, n } })): FakeProject => ({
  id,
  company_id: BI_ID,
  name,
  folder: "current",
  head_version_number: count,
  versions: Array.from({ length: count }, (_, i) => ({ id: vid(id, i + 1), version_number: i + 1, document: doc(i + 1) })),
});

async function refusal(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ProjectRouteError) return { status: error.status, message: error.message };
    throw error;
  }
  throw new Error("expected a refusal");
}

describe("checkBackupAccess — the same people as the account panel's isAdminHere", () => {
  it("lets a company admin of the acting-as company back it up", () => {
    expect(checkBackupAccess(BI_ADMIN, false, BI_ID)).toEqual({ ok: true, companyId: BI_ID, companyName: "Building Integrity" });
  });

  it("lets a platform admin acting as the company back it up, whatever their own level there", () => {
    expect(checkBackupAccess(ent(RF_ID, "Rare Forms", "platform-admin", null), true, RF_ID).ok).toBe(true);
    expect(checkBackupAccess(BI_MEMBER, true, BI_ID).ok).toBe(true);
  });

  it("refuses an ordinary member", () => {
    expect(checkBackupAccess(BI_MEMBER, false, BI_ID)).toEqual({
      ok: false,
      status: 403,
      message: "Only a company admin of Building Integrity can download its backup.",
    });
  });

  it("refuses someone acting as Seed through the consortium (no level there)", () => {
    expect(checkBackupAccess(ent(BI_ID, "The Seed Collaborative", "consortium", null), false, BI_ID)).toMatchObject({ ok: false, status: 403 });
  });

  it("refuses a company other than the verified acting-as one with a 409, even for a platform admin", () => {
    const result = checkBackupAccess(BI_ADMIN, true, RF_ID);
    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(!result.ok && result.message).toContain("You're now acting as Building Integrity (changed in another tab). The backup stopped; no file was saved.");
  });

  it("refuses when acting as no company", () => {
    expect(checkBackupAccess(null, true, BI_ID)).toMatchObject({ ok: false, status: 403 });
  });
});

describe("cursor and limit", () => {
  it("round-trips a cursor and treats an empty one as the first page", () => {
    expect(parseBackupCursor(null)).toBeNull();
    expect(parseBackupCursor("")).toBeNull();
    expect(parseBackupCursor(`owned:${PA}:7`)).toEqual({ phase: "owned", projectId: PA, versionNumber: 7 });
    expect(parseBackupCursor(`granted:${PA}:7`)).toEqual({ phase: "granted", projectId: PA, versionNumber: 7 });
    expect(formatBackupCursor({ phase: "granted", projectId: PA, versionNumber: 7 })).toBe(`granted:${PA}:7`);
  });

  it("3E: a Stage 2D cursor with no phase is read as `owned`, so a backup in flight survives the deploy", () => {
    expect(parseBackupCursor(`${PA}:7`)).toEqual({ phase: "owned", projectId: PA, versionNumber: 7 });
  });

  it("refuses anything that isn't a uuid and a whole number, before any query", () => {
    for (const bad of [`${PA}`, `${PA}:x`, `${PA}:-1`, `nope:1`, `${PA}:1,and(x)`, `${PA}:1.5`, `shared:${PA}:1`, `owned:${PA}`, `owned::1`]) {
      expect(() => parseBackupCursor(bad), bad).toThrow(BACKUP_CURSOR_MESSAGE);
    }
  });

  it("defaults to 25, caps at 50, and refuses nonsense", () => {
    expect(parseBackupLimit(null)).toBe(25);
    expect(parseBackupLimit("10")).toBe(10);
    expect(parseBackupLimit("5000")).toBe(BACKUP_PAGE_MAX_VERSIONS);
    for (const bad of ["0", "-3", "abc", "2.5"]) expect(() => parseBackupLimit(bad), bad).toThrow(BACKUP_CURSOR_MESSAGE);
  });
});

describe("readBackupPage", () => {
  it("refuses a malformed company id as not found, and a member with 403, without querying", async () => {
    const { db, calls } = companyDb([]);
    expect(await refusal(readBackupPage(db, caller(BI_ADMIN), "not-a-uuid", {}))).toEqual({ status: 404, message: BACKUP_COMPANY_NOT_FOUND_MESSAGE });
    expect((await refusal(readBackupPage(db, caller(BI_MEMBER), BI_ID, {}))).status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("a company with zero projects is one page: done, nothing listed, projectCount 0", async () => {
    const { db } = companyDb([]);
    const page = await readBackupPage(db, caller(BI_ADMIN), BI_ID, {}, () => new Date("2026-09-14T12:00:00Z"));
    expect(page).toEqual({
      company: { id: BI_ID, name: "Building Integrity" },
      exportedBy: { id: "u1", email: "a@bi.test", displayName: "Alice" },
      serverTime: "2026-09-14T12:00:00.000Z",
      projectCount: 0,
      grantedProjectCount: 0,
      versions: [],
      nextAfter: null,
      done: true,
    });
  });

  it("filters every projects read by the company, so a platform admin's backup holds only that company's projects", async () => {
    const other = { ...project(PA, "Rare Forms Barn", 2), company_id: RF_ID };
    const { db, calls } = companyDb([other, project(PB, "Smith House", 1)]);
    const page = await readBackupPage(db, caller(BI_ADMIN, true), BI_ID, {});
    expect(page.versions.map((v) => v.projectName)).toEqual(["Smith House"]);
    for (const call of calls.filter((c) => c.name === "projects")) expect(opsNamed(call, "eq")).toContainEqual(["company_id", BI_ID]);
  });

  it("reads version metadata by named columns (never `document`), and each document by its own .eq() read", async () => {
    const { db, calls } = companyDb([project(PA, "Smith House", 3)]);
    await readBackupPage(db, caller(BI_ADMIN), BI_ID, {});
    const versionCalls = calls.filter((c) => c.name === "project_versions");
    const metaCalls = versionCalls.filter((c) => opArgs(c, "select")?.[0] === VERSION_LIST_COLUMNS);
    expect(metaCalls.length).toBeGreaterThan(0);
    expect(VERSION_LIST_COLUMNS).not.toMatch(/document/);
    const docCalls = versionCalls.filter((c) => opArgs(c, "select")?.[0] === "document");
    expect(docCalls).toHaveLength(3);
    for (const c of docCalls) expect(opsNamed(c, "eq").map(([k]) => k).sort()).toEqual(["id", "project_id"]);
    // Only .eq/.gt/.order/.limit/.select/maybeSingle: no in(), or(), or filter strings.
    for (const c of calls) for (const [op] of c.ops) expect(["select", "eq", "gt", "order", "limit"]).toContain(op);
  });

  it("reads documents in parallel batches of BACKUP_DOCUMENT_BATCH_SIZE, not one after another", async () => {
    const { db, stats } = companyDb([project(PA, "Smith House", 12)], { latency: true });
    const page = await readBackupPage(db, caller(BI_ADMIN), BI_ID, {});
    expect(page.versions.map((v) => v.versionNumber)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(stats.maxConcurrentDocReads).toBe(BACKUP_DOCUMENT_BATCH_SIZE);
    expect(stats.docReads).toBe(12);
  });

  it("pages across projects in id order, then version order, and every page's cursor picks up exactly where it left off", async () => {
    const { db, calls } = companyDb([project(PB, "Second", 2), project(PA, "First", 3)]);
    const seen: string[] = [];
    let after: string | null = null;
    let pages = 0;
    for (;;) {
      const page = await readBackupPage(db, caller(BI_ADMIN), BI_ID, { after, limit: "2" });
      pages++;
      seen.push(...page.versions.map((v) => `${v.projectName} v${v.versionNumber}`));
      expect(page.projectCount).toBe(after === null ? 2 : null);
      if (page.done) break;
      after = page.nextAfter;
      expect(after).toMatch(/^owned:[0-9a-f-]{36}:\d+$/);
    }
    expect(seen).toEqual(["First v1", "First v2", "First v3", "Second v1", "Second v2"]);
    expect(pages).toBe(3);
    // Nothing from the request was spliced into a filter string: no or() at all.
    expect(calls.every((c) => opsNamed(c, "or").length === 0)).toBe(true);
  });

  it("each entry carries what the manifest needs, including the project's head at read time", async () => {
    const { db } = companyDb([project(PA, "Smith House", 1)]);
    const [entry] = (await readBackupPage(db, caller(BI_ADMIN), BI_ID, {})).versions;
    expect(entry).toEqual({
      projectId: PA,
      projectName: "Smith House",
      folder: "current",
      projectHeadVersionNumber: 1,
      versionId: vid(PA, 1),
      versionNumber: 1,
      parentVersionId: null,
      kind: "save",
      label: null,
      authorName: "Alice",
      createdAt: "2026-09-13T14:02:05.123456+00:00",
      schemaVersion: 24,
      document: { schemaVersion: 24, state: { projectName: "Smith House", n: 1 } },
      omitted: null,
      ownership: "owned",
      ownerCompany: null,
    });
  });

  it("carries on from the next project when the cursor's project has gone", async () => {
    const { db } = companyDb([project(PB, "Second", 1)]);
    const page = await readBackupPage(db, caller(BI_ADMIN), BI_ID, { after: `${PA}:4` });
    expect(page.versions.map((v) => v.projectName)).toEqual(["Second"]);
    expect(page.done).toBe(true);
  });

  it("maps a database refusal to the backup's own message", async () => {
    const { db } = fakeDb(() => ({ error: { code: "42501", message: "permission denied" } }));
    expect(await refusal(readBackupPage(db, caller(BI_ADMIN), BI_ID, {}))).toEqual({ status: 403, message: BACKUP_REFUSED_MESSAGE });
  });

  describe("the byte budget: no page nears the platform's ~4.5 MB response limit", () => {
    const big = (bytes: number) => (n: number) => ({ schemaVersion: 24, state: { projectName: "Big", n, pad: "x".repeat(bytes) } });

    it("stops a page before the version that would push it over the budget, and the next page starts with that version", async () => {
      const { db } = companyDb([project(PA, "Big", 4, big(1_500_000))]);
      const first = await readBackupPage(db, caller(BI_ADMIN), BI_ID, {});
      expect(first.versions.map((v) => v.versionNumber)).toEqual([1, 2]);
      expect(jsonByteLength(first)).toBeLessThanOrEqual(BACKUP_PAGE_BYTE_BUDGET + 1024);
      expect(first.done).toBe(false);
      const second = await readBackupPage(db, caller(BI_ADMIN), BI_ID, { after: first.nextAfter });
      expect(second.versions.map((v) => v.versionNumber)).toEqual([3, 4]);
      expect(second.done).toBe(true);
    });

    /** Every page from the first, checking each one's bytes and document reads. */
    async function walkPages(projects: FakeProject[]) {
      const { db, stats } = companyDb(projects);
      const pages: { numbers: number[]; nextAfter: string | null; docReads: number; versionBytes: number; pageBytes: number }[] = [];
      let after: string | null = null;
      for (let guard = 0; guard < 50; guard++) {
        const readsBefore = stats.docReads;
        const page = await readBackupPage(db, caller(BI_ADMIN), BI_ID, { after, limit: "50" });
        pages.push({
          numbers: page.versions.map((v) => v.versionNumber),
          nextAfter: page.nextAfter,
          docReads: stats.docReads - readsBefore,
          versionBytes: page.versions.reduce((sum, v) => sum + jsonByteLength(v) + 1, 0),
          pageBytes: jsonByteLength(page),
        });
        if (page.done) break;
        after = page.nextAfter;
      }
      return pages;
    }

    it("a batch that straddles the budget: the page stops at the first version over it, mid-batch, and the next page resumes exactly there", async () => {
      // ~600 KB each: six fit under 4,000,000, the seventh does not. With
      // batches of 5, versions 6-10 are one batch, so the cut falls inside it.
      expect(BACKUP_DOCUMENT_BATCH_SIZE).toBe(5);
      const pages = await walkPages([project(PA, "Big", 14, big(600_000))]);
      expect(pages.map((p) => p.numbers)).toEqual([[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12], [13, 14]]);
      expect(pages[0].nextAfter).toBe(`owned:${PA}:6`);
      expect(pages[1].nextAfter).toBe(`owned:${PA}:12`);
      for (const p of pages) {
        expect(p.versionBytes).toBeLessThanOrEqual(BACKUP_PAGE_BYTE_BUDGET);
        expect(p.pageBytes).toBeLessThan(BACKUP_PAGE_BYTE_BUDGET + 1024);
        // Reads at most one batch's worth of documents it leaves out.
        expect(p.docReads).toBeLessThanOrEqual(p.numbers.length + BACKUP_DOCUMENT_BATCH_SIZE);
      }
      expect(pages[0].docReads).toBe(10); // batches 1-5 and 6-10; 7-10 left for page two
      // No skips, no duplicates.
      expect(pages.flatMap((p) => p.numbers)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
    });

    it("a budget crossed exactly at the first version of a batch, and across a project boundary", async () => {
      // ~790 KB each: five fit, the sixth (the first of the second batch) does not.
      const pages = await walkPages([project(PA, "First", 7, big(790_000)), project(PB, "Second", 4, big(790_000))]);
      const seen = pages.flatMap((p, i) => p.numbers.map((n) => `${i}:${n}`));
      expect(pages.map((p) => p.numbers)).toEqual([[1, 2, 3, 4, 5], [6, 7, 1, 2, 3], [4]]);
      expect(pages[0].nextAfter).toBe(`owned:${PA}:5`);
      expect(pages[1].nextAfter).toBe(`owned:${PB}:3`);
      expect(seen).toHaveLength(11);
      for (const p of pages) {
        expect(p.versionBytes).toBeLessThanOrEqual(BACKUP_PAGE_BYTE_BUDGET);
        expect(p.docReads).toBeLessThanOrEqual(p.numbers.length + BACKUP_DOCUMENT_BATCH_SIZE);
      }
    });

    it("a single version near the 4 MB ceiling still goes, alone, in a page under 4.5 MB", async () => {
      const { db } = companyDb([project(PA, "Big", 2, big(3_990_000))]);
      const first = await readBackupPage(db, caller(BI_ADMIN), BI_ID, {});
      expect(first.versions.map((v) => v.versionNumber)).toEqual([1]);
      expect(first.versions[0].omitted).toBeNull();
      expect(jsonByteLength(first)).toBeLessThan(4_500_000);
    });

    it("a version too large to send is marked, not dropped, so the browser can refuse to call the backup complete", async () => {
      const { db } = companyDb([project(PA, "Huge", 1, big(4_500_000))]);
      const [entry] = (await readBackupPage(db, caller(BI_ADMIN), BI_ID, {})).versions;
      expect(entry).toMatchObject({ versionNumber: 1, document: null, omitted: "too-large" });
    });
  });
});

// ---------------------------------------------------------------------------
// Stage 3E: the second source — projects granted TO this company.
// ---------------------------------------------------------------------------

describe("readBackupPage: projects granted to the company (3E)", () => {
  /** A project owned by Rare Forms, i.e. a candidate for the granted phase. */
  const rf = (id: string, name: string, count: number, doc?: (n: number) => unknown): FakeProject => ({
    ...project(id, name, count, doc),
    company_id: RF_ID,
  });
  const grant = (projectId: string, companyId: string = BI_ID): FakeGrant => ({ project_id: projectId, grantee_company_id: companyId });
  const NAMES = { [RF_ID]: "Rare Forms", [BI_ID]: "Building Integrity" };
  /** A granted project whose id sorts BEFORE every owned one, on purpose. */
  const PG_LOW = "00000000-0000-4000-8000-000000000009";
  const PG2 = "0c000000-0000-4000-8000-000000000003";
  const shape = (page: Awaited<ReturnType<typeof readBackupPage>>) =>
    page.versions.map((v) => `${v.ownership}:${v.projectName} v${v.versionNumber}`);

  it("adds granted projects after every owned one, marked `granted` and naming the owning company", async () => {
    const { db } = companyDb([project(PB, "Ours", 2), rf(PG_LOW, "Theirs", 1)], { grants: [grant(PG_LOW)], companyNames: NAMES });
    const page = await readBackupPage(db, caller(BI_ADMIN), BI_ID, {});
    // The granted project's id sorts first, and it STILL comes last: the phase
    // dominates the ordering, which is what makes the cursor total.
    expect(shape(page)).toEqual(["owned:Ours v1", "owned:Ours v2", "granted:Theirs v1"]);
    expect(page.versions[0].ownerCompany).toBeNull();
    expect(page.versions.at(-1)!.ownerCompany).toEqual({ id: RF_ID, name: "Rare Forms" });
    expect(page.projectCount).toBe(1);
    expect(page.grantedProjectCount).toBe(1);
    expect(page.done).toBe(true);
  });

  it("pages across the owned/granted seam with no skipped or duplicated version, and each cursor names its own phase", async () => {
    const { db } = companyDb([project(PA, "First", 2), project(PB, "Second", 1), rf(PG_LOW, "Shared", 2)], {
      grants: [grant(PG_LOW)],
      companyNames: NAMES,
    });
    const seen: string[] = [];
    const cursors: (string | null)[] = [];
    let after: string | null = null;
    for (let guard = 0; guard < 20; guard++) {
      const page: Awaited<ReturnType<typeof readBackupPage>> = await readBackupPage(db, caller(BI_ADMIN), BI_ID, { after, limit: "2" });
      seen.push(...shape(page));
      if (page.done) break;
      expect(page.nextAfter).toMatch(/^(owned|granted):[0-9a-f-]{36}:\d+$/);
      cursors.push(page.nextAfter);
      after = page.nextAfter;
    }
    expect(seen).toEqual(["owned:First v1", "owned:First v2", "owned:Second v1", "granted:Shared v1", "granted:Shared v2"]);
    expect(new Set(seen).size).toBe(seen.length);
    expect(cursors).toEqual([`owned:${PA}:2`, `granted:${PG_LOW}:1`]);
  });

  it("a byte budget that runs out ACROSS the seam: the page stops mid-way and the next resumes on the granted side", async () => {
    const big = (bytes: number) => (n: number) => ({ schemaVersion: 24, state: { projectName: "Big", n, pad: "x".repeat(bytes) } });
    const { db } = companyDb([project(PA, "Ours", 3, big(1_500_000)), rf(PG2, "Theirs", 3, big(1_500_000))], {
      grants: [grant(PG2)],
      companyNames: NAMES,
    });
    const pages: { shape: string[]; nextAfter: string | null; bytes: number }[] = [];
    let after: string | null = null;
    for (let guard = 0; guard < 20; guard++) {
      const page: Awaited<ReturnType<typeof readBackupPage>> = await readBackupPage(db, caller(BI_ADMIN), BI_ID, { after, limit: "50" });
      pages.push({
        shape: shape(page),
        nextAfter: page.nextAfter,
        bytes: page.versions.reduce((sum, v) => sum + jsonByteLength(v) + 1, 0),
      });
      if (page.done) break;
      after = page.nextAfter;
    }
    expect(pages.map((p) => p.shape)).toEqual([
      ["owned:Ours v1", "owned:Ours v2"],
      // The seam falls INSIDE this page: the cursor must carry the last
      // entry's own phase, or the next page would re-read the owned project.
      ["owned:Ours v3", "granted:Theirs v1"],
      ["granted:Theirs v2", "granted:Theirs v3"],
    ]);
    expect(pages[1].nextAfter).toBe(`granted:${PG2}:1`);
    for (const p of pages) expect(p.bytes).toBeLessThanOrEqual(BACKUP_PAGE_BYTE_BUDGET);
    expect(pages.flatMap((p) => p.shape)).toHaveLength(6);
    expect(new Set(pages.flatMap((p) => p.shape)).size).toBe(6);
  });

  it("a phase-less cursor mid-backup finishes the owned phase and goes on into the granted one", async () => {
    const { db } = companyDb([project(PA, "First", 3), rf(PG_LOW, "Shared", 1)], { grants: [grant(PG_LOW)], companyNames: NAMES });
    const page = await readBackupPage(db, caller(BI_ADMIN), BI_ID, { after: `${PA}:1` });
    expect(shape(page)).toEqual(["owned:First v2", "owned:First v3", "granted:Shared v1"]);
    // Counts are first-page-only, and this is not the first page.
    expect(page.projectCount).toBeNull();
    expect(page.grantedProjectCount).toBeNull();
  });

  it("a project both OWNED and granted to the same company appears once, in the owned phase", async () => {
    const both = project(PA, "Ours", 2); // owned by Building Integrity…
    const { db } = companyDb([both], { grants: [grant(PA)], companyNames: NAMES }); // …and granted to it
    const whole = await readBackupPage(db, caller(BI_ADMIN), BI_ID, {});
    expect(shape(whole)).toEqual(["owned:Ours v1", "owned:Ours v2"]);
    expect(whole.versions.every((v) => v.ownerCompany === null)).toBe(true);

    // And it is not re-emitted when the pages are walked one version at a time.
    const seen: string[] = [];
    let after: string | null = null;
    for (let guard = 0; guard < 10; guard++) {
      const page: Awaited<ReturnType<typeof readBackupPage>> = await readBackupPage(db, caller(BI_ADMIN), BI_ID, { after, limit: "1" });
      seen.push(...shape(page));
      if (page.done) break;
      after = page.nextAfter;
    }
    expect(seen).toEqual(["owned:Ours v1", "owned:Ours v2"]);
  });

  it("a project shared with a PERSON is in no company's backup (Open Item 2)", async () => {
    const { db } = companyDb([rf(PG_LOW, "Theirs", 2)], {
      // A personal grant: grantee_company_id is null, grantee_user_id is set.
      grants: [{ project_id: PG_LOW, grantee_company_id: null, grantee_user_id: "u1" }],
      companyNames: NAMES,
    });
    const page = await readBackupPage(db, caller(BI_ADMIN), BI_ID, {});
    expect(page.versions).toEqual([]);
    expect(page.grantedProjectCount).toBe(0);
    expect(page.done).toBe(true);
  });

  it("a grant to ANOTHER company never enters this company's backup, even for a platform admin", async () => {
    const { db, calls } = companyDb([project(PB, "Ours", 1), rf(PG_LOW, "Shared with us", 1), rf(PG2, "Rare Forms' own", 1)], {
      grants: [grant(PG_LOW, BI_ID), grant(PG2, RF_ID)],
      companyNames: NAMES,
    });
    const page = await readBackupPage(db, caller(BI_ADMIN, true), BI_ID, {});
    expect(shape(page)).toEqual(["owned:Ours v1", "granted:Shared with us v1"]);
    // Every grant read is filtered to this company; every projects read is
    // either company-filtered or a by-id read of a project the grant filter
    // just returned. Nothing from the request reaches a filter string.
    for (const call of calls.filter((c) => c.name === "collaborators")) {
      expect(opsNamed(call, "eq")).toContainEqual(["grantee_company_id", BI_ID]);
    }
    for (const call of calls.filter((c) => c.name === "projects")) {
      const keys = opsNamed(call, "eq").map(([k]) => k);
      expect(keys.includes("company_id") || keys.includes("id")).toBe(true);
    }
    for (const call of calls.filter((c) => c.kind === "from")) {
      for (const [op] of call.ops) expect(["select", "eq", "gt", "order", "limit"]).toContain(op);
    }
  });

  it("a grant removed mid-backup: the next page carries on from the next granted project", async () => {
    // The cursor names a project whose grant has since gone.
    const { db } = companyDb([rf(PG_LOW, "Gone", 3), rf(PG2, "Still shared", 1)], { grants: [grant(PG2)], companyNames: NAMES });
    const page = await readBackupPage(db, caller(BI_ADMIN), BI_ID, { after: `granted:${PG_LOW}:1` });
    expect(shape(page)).toEqual(["granted:Still shared v1"]);
    expect(page.done).toBe(true);
  });

  it("a granted cursor naming a project this company holds NO grant on reads nothing of it", async () => {
    // `after` comes from the browser. A platform admin can read every project
    // through RLS, so without the grant check this would page out another
    // company's versions — more than this company could export by hand (29).
    const { db, calls } = companyDb([rf(PG_LOW, "Not yours", 3)], { grants: [], companyNames: NAMES });
    const page = await readBackupPage(db, caller(BI_ADMIN, true), BI_ID, { after: `granted:${PG_LOW}:0` });
    expect(page.versions).toEqual([]);
    expect(page.done).toBe(true);
    expect(calls.some((c) => c.name === "project_versions")).toBe(false);
  });

  it("the owner's name comes from project_owner_company_name, and an unreadable one is empty, not invented", async () => {
    const { db, calls } = companyDb([rf(PG_LOW, "Theirs", 1)], { grants: [grant(PG_LOW)], companyNames: NAMES });
    const page = await readBackupPage(db, caller(BI_ADMIN), BI_ID, {});
    expect(page.versions[0].ownerCompany).toEqual({ id: RF_ID, name: "Rare Forms" });
    // Through the helper, never a `companies` read: companies_select hides the
    // owner's row from a company that only holds a grant.
    expect(calls.some((c) => c.kind === "rpc" && c.name === "project_owner_company_name")).toBe(true);
    expect(calls.some((c) => c.name === "companies")).toBe(false);

    const failing = companyDb([rf(PG_LOW, "Theirs", 1)], { grants: [grant(PG_LOW)], ownerNameFails: true });
    const gap = await readBackupPage(failing.db, caller(BI_ADMIN), BI_ID, {});
    expect(gap.versions[0].ownerCompany).toEqual({ id: RF_ID, name: "" });
  });

  it("documents for granted projects are read in the same parallel batches, by their own .eq() reads", async () => {
    const { db, stats, calls } = companyDb([rf(PG_LOW, "Theirs", 12)], { grants: [grant(PG_LOW)], companyNames: NAMES, latency: true });
    const page = await readBackupPage(db, caller(BI_ADMIN), BI_ID, {});
    expect(page.versions).toHaveLength(12);
    expect(stats.maxConcurrentDocReads).toBe(BACKUP_DOCUMENT_BATCH_SIZE);
    const docCalls = calls.filter((c) => c.name === "project_versions" && opArgs(c, "select")?.[0] === "document");
    for (const c of docCalls) expect(opsNamed(c, "eq").map(([k]) => k).sort()).toEqual(["id", "project_id"]);
  });
});

describe("the backup route", () => {
  it("uses the session client and never imports the admin (service-role) client", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const route = readFileSync(join(here, "..", "api", "companies", "[id]", "backup", "route.ts"), "utf8");
    expect(route).toMatch(/requireCloudSession\(\)/);
    expect(route).not.toMatch(/createSupabaseAdminClient|SUPABASE_SECRET_KEY|service_role/);
    const logic = readFileSync(join(here, "backupRouteLogic.ts"), "utf8");
    expect(logic).not.toMatch(/^import .*createSupabaseAdminClient/m);
  });
});
