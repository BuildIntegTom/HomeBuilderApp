import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Entitlement } from "../auth/actingAs";
import {
  BACKUP_COMPANY_NOT_FOUND_MESSAGE,
  BACKUP_CURSOR_MESSAGE,
  BACKUP_PAGE_BYTE_BUDGET,
  BACKUP_PAGE_MAX_VERSIONS,
  checkBackupAccess,
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
  kind: "from";
  name: string;
  ops: [string, unknown[]][];
  terminal?: string;
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
  const db = { from: (name: string) => builder({ kind: "from", name, ops: [] }) };
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

function companyDb(projects: FakeProject[]) {
  return fakeDb((call) => {
    const eq = new Map(opsNamed(call, "eq").map(([k, v]) => [k as string, v]));
    const gt = new Map(opsNamed(call, "gt").map(([k, v]) => [k as string, v]));
    const limit = (opArgs(call, "limit")?.[0] as number | undefined) ?? Infinity;
    if (call.name === "projects") {
      const selectArgs = opArgs(call, "select");
      let rows = projects.filter((p) => p.company_id === eq.get("company_id"));
      if (eq.has("id")) rows = rows.filter((p) => p.id === eq.get("id"));
      if (gt.has("id")) rows = rows.filter((p) => p.id > (gt.get("id") as string));
      rows = [...rows].sort((a, b) => a.id.localeCompare(b.id)).slice(0, limit);
      if ((selectArgs?.[1] as { head?: boolean } | undefined)?.head) return { count: rows.length };
      const shaped = rows.map(({ id, name, folder, head_version_number }) => ({ id, name, folder, head_version_number }));
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
  });
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
    expect(parseBackupCursor(`${PA}:7`)).toEqual({ projectId: PA, versionNumber: 7 });
  });

  it("refuses anything that isn't a uuid and a whole number, before any query", () => {
    for (const bad of [`${PA}`, `${PA}:x`, `${PA}:-1`, `nope:1`, `${PA}:1,and(x)`, `${PA}:1.5`]) {
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

  it("reads version metadata by named columns (never `document`), and documents one version at a time", async () => {
    const { db, calls } = companyDb([project(PA, "Smith House", 3)]);
    await readBackupPage(db, caller(BI_ADMIN), BI_ID, {});
    const versionCalls = calls.filter((c) => c.name === "project_versions");
    const metaCalls = versionCalls.filter((c) => opArgs(c, "select")?.[0] === VERSION_LIST_COLUMNS);
    expect(metaCalls.length).toBeGreaterThan(0);
    expect(VERSION_LIST_COLUMNS).not.toMatch(/document/);
    const docCalls = versionCalls.filter((c) => opArgs(c, "select")?.[0] === "document");
    expect(docCalls).toHaveLength(3);
    for (const c of docCalls) expect(opsNamed(c, "eq").map(([k]) => k).sort()).toEqual(["id", "project_id"]);
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
      expect(after).toMatch(/^[0-9a-f-]{36}:\d+$/);
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
