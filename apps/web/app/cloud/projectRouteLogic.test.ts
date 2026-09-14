import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Entitlement } from "../auth/actingAs";
import { DOCUMENT_TOO_LARGE_MESSAGE, NO_COMPANY_MESSAGE } from "./cloudTypes";
import {
  INVALID_ID_MESSAGE,
  LIST_REFUSED_MESSAGE,
  PROJECT_NOT_FOUND_MESSAGE,
  ProjectRouteError,
  SAVE_ACCESS_LOST_MESSAGE,
  VERSION_NOT_FOUND_MESSAGE,
  checkCreateTarget,
  createProject,
  getVersion,
  isUuid,
  listProjects,
  mapProjectDbError,
  moveProject,
  readLabel,
  saveVersion,
  validateProjectDocument,
} from "./projectRouteLogic";

// ---------------------------------------------------------------------------
// A chainable stand-in for the supabase-js query builder. Every call is
// recorded; `respond` decides what the database "returned".
// ---------------------------------------------------------------------------
interface Call {
  kind: "rpc" | "from";
  name: string;
  args?: unknown;
  ops: [string, unknown[]][];
  terminal?: string;
}
type Reply = { data?: unknown; error?: unknown };

function fakeDb(respond: (call: Call) => Reply) {
  const calls: Call[] = [];
  const builder = (call: Call): unknown => {
    const finish = (terminal?: string) => {
      call.terminal = terminal;
      calls.push(call);
      return Promise.resolve()
        .then(() => respond(call))
        .then((r) => ({ data: r.data ?? null, error: r.error ?? null }));
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
    rpc: (name: string, args: unknown) => builder({ kind: "rpc", name, args, ops: [] }),
    from: (name: string) => builder({ kind: "from", name, ops: [] }),
  };
  return { db: db as unknown as SupabaseClient, calls };
}

const opArgs = (call: Call, op: string) => call.ops.find(([name]) => name === op)?.[1];

// Real-shaped ids. Seeded company ids need not be v4, so one is not.
const BI_ID = "11111111-0000-0000-0000-000000000001";
const RF_ID = "22222222-0000-0000-0000-000000000001";
const SEED_ID = "33333333-0000-0000-0000-000000000001";
const P1 = "9320be5d-515c-4b62-bbfd-19a419a0729e";
const P2 = "5a0f3a8e-6c1d-4b8e-9f2a-0c7d1e2b3a4f";
const V1 = "7cd35acb-906d-4527-872a-5b4957919e75";
const V2 = "157620e3-1239-431a-8542-0bde2e90ad3b";
const V3 = "240320ca-651c-4f2e-bf95-f97346d0fd51";
const V4 = "0a95472c-79f6-42e4-b059-e907aa1549c1";

const BI: Entitlement = { companyId: BI_ID, companyName: "Building Integrity", source: "membership", level: "member", isDefault: true };
const RF_ADMIN: Entitlement = { companyId: RF_ID, companyName: "Rare Forms", source: "platform-admin", level: null, isDefault: false };
const SEED: Entitlement = { companyId: SEED_ID, companyName: "The Seed Collaborative", source: "consortium", level: null, isDefault: false };

const DOC = { schemaVersion: 24, savedAt: "2026-09-14T13:00:00.000Z", state: { projectName: "Smith House" } };
const CREATED_AT = "2026-09-14T13:05:41.611591+00:00";

async function rejection(promise: Promise<unknown>): Promise<ProjectRouteError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ProjectRouteError) return error;
    throw error;
  }
  throw new Error("expected a ProjectRouteError");
}

const MALFORMED_IDS = ["p1", "", " ", "not-a-uuid", `${P1}x`, P1.replace(/-/g, ""), "' or 1=1 --", `${P1},and(id.neq.0)`];

// ---------------------------------------------------------------------------

describe("isUuid", () => {
  it("accepts database-shaped ids, including non-v4 seeded ones", () => {
    expect([BI_ID, P1, V4, P1.toUpperCase()].every(isUuid)).toBe(true);
  });

  it.each(MALFORMED_IDS)("refuses %j", (value) => {
    expect(isUuid(value)).toBe(false);
  });
});

describe("checkCreateTarget — the acting-as check", () => {
  it("refuses a signed-in person with no company, in words", () => {
    expect(checkCreateTarget(null, BI_ID)).toEqual({ ok: false, status: 403, message: NO_COMPANY_MESSAGE });
  });

  it("returns 409 when the dialog's company is not the verified one (switched in another tab)", () => {
    expect(checkCreateTarget(RF_ADMIN, BI_ID)).toEqual({
      ok: false,
      status: 409,
      message: "You're now acting as Rare Forms (changed in another tab). Nothing was saved.",
    });
  });

  it("reports the tab switch before the consortium refusal", () => {
    expect(checkCreateTarget(SEED, BI_ID)).toMatchObject({ status: 409, message: expect.stringContaining("The Seed Collaborative (changed in another tab)") });
  });

  it("refuses a consortium entitlement with 403 even when it matches", () => {
    expect(checkCreateTarget(SEED, SEED_ID)).toMatchObject({ ok: false, status: 403, message: expect.stringMatching(/later stage.*Nothing was saved/) });
  });

  it("allows membership and platform-admin entitlements, using the verified company", () => {
    expect(checkCreateTarget(BI, BI_ID)).toEqual({ ok: true, companyId: BI_ID, companyName: "Building Integrity" });
    expect(checkCreateTarget(RF_ADMIN, RF_ID)).toEqual({ ok: true, companyId: RF_ID, companyName: "Rare Forms" });
  });
});

describe("validateProjectDocument — shape only", () => {
  it.each([
    ["null", null],
    ["an array", []],
    ["a string", "{}"],
    ["no schemaVersion", { state: {} }],
    ["a string schemaVersion", { schemaVersion: "24", state: {} }],
    ["a fractional schemaVersion", { schemaVersion: 24.5, state: {} }],
    ["no state", { schemaVersion: 24 }],
    ["an array state", { schemaVersion: 24, state: [] }],
  ])("refuses %s with 400", (_label, value) => {
    expect(() => validateProjectDocument(value)).toThrow(ProjectRouteError);
  });

  it("passes a real document through untouched (no deep validation, no redaction)", () => {
    const doc = { ...DOC, state: { ...DOC.state, priceModifier: 1.3 } };
    expect(validateProjectDocument(doc)).toBe(doc);
  });
});

describe("readLabel", () => {
  it("treats absent or blank as no note", () => {
    expect(readLabel({})).toBeNull();
    expect(readLabel({ label: null })).toBeNull();
    expect(readLabel({ label: "   " })).toBeNull();
  });

  it("allows 200 characters and refuses 201", () => {
    expect(readLabel({ label: "x".repeat(200) })).toHaveLength(200);
    expect(() => readLabel({ label: "x".repeat(201) })).toThrow(/200 characters/);
  });

  it("refuses a non-string", () => {
    expect(() => readLabel({ label: 5 })).toThrow(ProjectRouteError);
  });
});

describe("mapProjectDbError — the codes 0006 actually raises", () => {
  it("maps 42501 by operation: list 403, create 403, save 403 with the download offer, move/read 404", () => {
    const err = { code: "42501", message: "project not found, or you cannot save to it" };
    expect(mapProjectDbError(err, "list")).toMatchObject({ status: 403, message: LIST_REFUSED_MESSAGE });
    expect(LIST_REFUSED_MESSAGE).not.toMatch(/version/);
    expect(mapProjectDbError(err, "create")).toMatchObject({ status: 403 });
    expect(mapProjectDbError(err, "save")).toMatchObject({ status: 403, message: SAVE_ACCESS_LOST_MESSAGE });
    expect(SAVE_ACCESS_LOST_MESSAGE).toMatch(/Download project file/);
    expect(mapProjectDbError(err, "move")).toMatchObject({ status: 404, message: PROJECT_NOT_FOUND_MESSAGE });
    expect(mapProjectDbError(err, "read")).toMatchObject({ status: 404, message: VERSION_NOT_FOUND_MESSAGE });
  });

  it("maps the 4 MB refusal (its exact trigger text) to 413 with its own message", () => {
    const err = { code: "23514", message: "this project document is 4194369 bytes, over the 4194304 byte limit" };
    expect(mapProjectDbError(err, "save")).toMatchObject({ status: 413, message: DOCUMENT_TOO_LARGE_MESSAGE });
    expect(mapProjectDbError(err, "create")).toMatchObject({ status: 413 });
  });

  it("maps the label, folder and lineage checks without echoing constraint names", () => {
    const label = mapProjectDbError({ code: "23514", message: 'new row for relation "project_versions" violates check constraint "project_versions_label_check"' }, "create");
    expect(label).toMatchObject({ status: 400 });
    expect(label?.message).not.toMatch(/relation|constraint/);
    expect(mapProjectDbError({ code: "23514", message: 'violates check constraint "projects_folder_check"' }, "create")).toMatchObject({ status: 400 });
    expect(mapProjectDbError({ code: "23514", message: "the parent version must be a version of the same project" }, "save")).toMatchObject({ status: 409 });
    expect(mapProjectDbError({ code: "23514", message: "something else" }, "save")?.message).toBe("The cloud refused that project document. Nothing was saved.");
  });

  it("backstops a malformed id that still reached Postgres: 400 for writes, 404 for reads, never 'access lost'", () => {
    expect(mapProjectDbError({ code: "22P02" }, "save")).toMatchObject({ status: 400, message: INVALID_ID_MESSAGE });
    expect(mapProjectDbError({ code: "22P02" }, "create")).toMatchObject({ status: 400 });
    expect(mapProjectDbError({ code: "22P02" }, "read")).toMatchObject({ status: 404 });
    expect(mapProjectDbError({ code: "22P02" }, "move")).toMatchObject({ status: 404 });
  });

  it("returns null for anything unmapped, so it becomes a quiet 500", () => {
    expect(mapProjectDbError({ code: "XX000", message: "internal" }, "save")).toBeNull();
  });
});

describe("listProjects — GET /api/projects?folder=", () => {
  it("makes no database call for a person with no company, and says so", async () => {
    const { db, calls } = fakeDb(() => ({}));
    await expect(listProjects(db, null, "current")).resolves.toEqual({ company: null, folder: "current", projects: [], unavailable: "no-company" });
    expect(calls).toHaveLength(0);
  });

  it("does not dress up an empty tree for the consortium entitlement", async () => {
    const { db, calls } = fakeDb(() => ({}));
    const result = await listProjects(db, SEED, "past");
    expect(result).toMatchObject({ unavailable: "consortium", projects: [], company: { id: SEED_ID } });
    expect(calls).toHaveLength(0);
  });

  it("lists the verified company's folder, newest first, never selecting document, with each head's author", async () => {
    const { db, calls } = fakeDb((call) => {
      if (call.name === "projects") {
        return {
          data: [
            { id: P1, name: "Smith House", folder: "current", head_version_number: 7, updated_at: CREATED_AT },
            { id: P2, name: "", folder: "current", head_version_number: 2, updated_at: CREATED_AT },
          ],
        };
      }
      return {
        data: [
          { id: V1, project_id: P1, version_number: 7, author_name: "Virgil" },
          // A head that moved between the two reads is not mislabelled.
          { id: V3, project_id: P2, version_number: 3, author_name: "Tommy" },
        ],
      };
    });

    const result = await listProjects(db, BI, undefined);
    expect(result.folder).toBe("current");
    expect(result.projects).toEqual([
      { id: P1, name: "Smith House", folder: "current", headVersionNumber: 7, headVersionId: V1, headAuthorName: "Virgil", updatedAt: CREATED_AT },
      { id: P2, name: "", folder: "current", headVersionNumber: 2, headVersionId: null, headAuthorName: null, updatedAt: CREATED_AT },
    ]);

    const [projects, heads] = calls;
    expect(opArgs(projects, "select")?.[0]).not.toMatch(/document/);
    expect(opArgs(heads, "select")?.[0]).not.toMatch(/document/);
    expect(projects.ops).toContainEqual(["eq", ["company_id", BI_ID]]);
    expect(projects.ops).toContainEqual(["eq", ["folder", "current"]]);
    expect(projects.ops).toContainEqual(["order", ["updated_at", { ascending: false }]]);
    expect(opArgs(heads, "or")?.[0]).toBe(`and(project_id.eq.${P1},version_number.eq.7),and(project_id.eq.${P2},version_number.eq.2)`);
  });

  it("a refused list says so in list terms, not as a missing version", async () => {
    const { db } = fakeDb(() => ({ error: { code: "42501", message: "permission denied" } }));
    expect(await rejection(listProjects(db, BI, "current"))).toMatchObject({ status: 403, message: LIST_REFUSED_MESSAGE });
  });

  it("refuses an unknown folder before touching the database", async () => {
    const { db, calls } = fakeDb(() => ({}));
    expect((await rejection(listProjects(db, BI, "archive"))).status).toBe(400);
    expect(calls).toHaveLength(0);
  });
});

describe("createProject — POST /api/projects", () => {
  const ok = () =>
    fakeDb((call) =>
      call.kind === "rpc" ? { data: { project_id: P1, version_id: V1, version_number: 1, created_at: CREATED_AT } } : {},
    );

  it("calls create_project as ONE rpc with .single(), into the verified company, never as table inserts", async () => {
    const { db, calls } = ok();
    const result = await createProject(db, BI, { expectedCompanyId: BI_ID, folder: "proposals", label: " first cut ", document: DOC });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      kind: "rpc",
      name: "create_project",
      terminal: "single",
      args: { p_company_id: BI_ID, p_folder: "proposals", p_document: DOC, p_label: "first cut" },
    });
    expect(result).toEqual({
      projectId: P1,
      versionId: V1,
      versionNumber: 1,
      createdAt: CREATED_AT,
      companyId: BI_ID,
      companyName: "Building Integrity",
      folder: "proposals",
    });
  });

  it("defaults to Current Projects", async () => {
    const { db, calls } = ok();
    await createProject(db, BI, { expectedCompanyId: BI_ID, document: DOC });
    expect((calls[0].args as { p_folder: string }).p_folder).toBe("current");
  });

  it("409s on an acting-as mismatch without saving anything", async () => {
    const { db, calls } = ok();
    const error = await rejection(createProject(db, RF_ADMIN, { expectedCompanyId: BI_ID, document: DOC }));
    expect(error.status).toBe(409);
    expect(calls).toHaveLength(0);
  });

  it.each(MALFORMED_IDS.filter((id) => id.trim().length > 0))("400s on a malformed expectedCompanyId %j — not a misleading 409", async (id) => {
    const { db, calls } = ok();
    const error = await rejection(createProject(db, RF_ADMIN, { expectedCompanyId: id, document: DOC }));
    expect(error.status).toBe(400);
    expect(error.message).not.toMatch(/another tab/);
    expect(calls).toHaveLength(0);
  });

  it("403s for a consortium entitlement and for no company, without saving", async () => {
    const { db, calls } = ok();
    expect((await rejection(createProject(db, SEED, { expectedCompanyId: SEED_ID, document: DOC }))).status).toBe(403);
    expect((await rejection(createProject(db, null, { expectedCompanyId: BI_ID, document: DOC }))).message).toBe(NO_COMPANY_MESSAGE);
    expect(calls).toHaveLength(0);
  });

  it("400s on a missing expectedCompanyId, a bad folder or a bad document, without saving", async () => {
    const { db, calls } = ok();
    expect((await rejection(createProject(db, BI, { document: DOC }))).status).toBe(400);
    expect((await rejection(createProject(db, BI, { expectedCompanyId: BI_ID, folder: "archive", document: DOC }))).status).toBe(400);
    expect((await rejection(createProject(db, BI, { expectedCompanyId: BI_ID, document: { state: {} } }))).status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("maps the database's own refusals", async () => {
    const { db } = fakeDb(() => ({ error: { code: "23514", message: "this project document is 5000000 bytes, over the 4194304 byte limit" } }));
    expect((await rejection(createProject(db, BI, { expectedCompanyId: BI_ID, document: DOC }))).status).toBe(413);
  });

  it("throws an unmapped database error as-is (a quiet 500 upstream)", async () => {
    const raw = { code: "XX000", message: "boom" };
    const { db } = fakeDb(() => ({ error: raw }));
    await expect(createProject(db, BI, { expectedCompanyId: BI_ID, document: DOC })).rejects.toBe(raw);
  });
});

describe("saveVersion — POST /api/projects/[id]/versions", () => {
  it("saves with parent = base and makes no extra reads when not diverged", async () => {
    const { db, calls } = fakeDb(() => ({
      data: { version_id: V2, version_number: 2, created_at: CREATED_AT, head_before: 1, diverged: false },
    }));
    const result = await saveVersion(db, P1, { parentVersionId: V1, document: DOC });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      kind: "rpc",
      name: "save_project_version",
      terminal: "single",
      args: { p_project_id: P1, p_parent_version_id: V1, p_document: DOC, p_label: null },
    });
    expect(result).toEqual({
      projectId: P1,
      versionId: V2,
      versionNumber: 2,
      createdAt: CREATED_AT,
      headBefore: 1,
      diverged: false,
      baseVersionNumber: null,
      intervening: [],
    });
  });

  it("when diverged, returns the intervening versions' number, author and time — without reading documents", async () => {
    const { db, calls } = fakeDb((call) => {
      if (call.kind === "rpc") return { data: { version_id: V4, version_number: 4, created_at: CREATED_AT, head_before: 3, diverged: true } };
      if (call.terminal === "maybeSingle") return { data: { version_number: 1 } };
      return {
        data: [
          { version_number: 2, author_name: "bob@bi.test", created_at: CREATED_AT, kind: "save", project_name: "Smith House" },
          { version_number: 3, author_name: "Virgil", created_at: CREATED_AT, kind: "save", project_name: "Smith Residence" },
        ],
      };
    });
    const result = await saveVersion(db, P1, { parentVersionId: V1, document: DOC });
    expect(result).toMatchObject({ diverged: true, headBefore: 3, baseVersionNumber: 1 });
    expect(result.intervening).toEqual([
      { versionNumber: 2, authorName: "bob@bi.test", createdAt: CREATED_AT, kind: "save", projectName: "Smith House" },
      { versionNumber: 3, authorName: "Virgil", createdAt: CREATED_AT, kind: "save", projectName: "Smith Residence" },
    ]);
    const range = calls[2];
    expect(range.ops).toContainEqual(["gt", ["version_number", 1]]);
    expect(range.ops).toContainEqual(["lt", ["version_number", 4]]);
    // Only the name is pulled out of the document; the document itself is not selected.
    const columns = String(opArgs(range, "select")?.[0]).split(",").map((c) => c.trim());
    expect(columns).not.toContain("document");
  });

  it("a failing follow-up read never turns a kept save into an error", async () => {
    const { db } = fakeDb((call) => {
      if (call.kind === "rpc") return { data: { version_id: V4, version_number: 4, created_at: CREATED_AT, head_before: 3, diverged: true } };
      throw new Error("network blip");
    });
    const result = await saveVersion(db, P1, { parentVersionId: V1, document: DOC });
    expect(result).toMatchObject({ versionNumber: 4, diverged: true, intervening: [] });
  });

  it("403s with the download offer when access was lost mid-session", async () => {
    const { db } = fakeDb(() => ({ error: { code: "42501", message: "project not found, or you cannot save to it" } }));
    const error = await rejection(saveVersion(db, P1, { parentVersionId: V1, document: DOC }));
    expect(error).toMatchObject({ status: 403, message: SAVE_ACCESS_LOST_MESSAGE });
  });

  it("413s on the size ceiling", async () => {
    const { db } = fakeDb(() => ({ error: { code: "23514", message: "this project document is 4194369 bytes, over the 4194304 byte limit" } }));
    expect((await rejection(saveVersion(db, P1, { parentVersionId: V1, document: DOC }))).status).toBe(413);
  });

  it("400s without a parentVersionId, and never calls the database", async () => {
    const { db, calls } = fakeDb(() => ({}));
    expect((await rejection(saveVersion(db, P1, { document: DOC }))).status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it.each(MALFORMED_IDS.filter((id) => id.trim().length > 0))("400s on a malformed parentVersionId %j — not 'access lost'", async (id) => {
    const { db, calls } = fakeDb(() => ({}));
    const error = await rejection(saveVersion(db, P1, { parentVersionId: id, document: DOC }));
    expect(error.status).toBe(400);
    expect(error.message).not.toBe(SAVE_ACCESS_LOST_MESSAGE);
    expect(calls).toHaveLength(0);
  });

  it.each(MALFORMED_IDS)("404s on a malformed project id in the path %j", async (id) => {
    const { db, calls } = fakeDb(() => ({}));
    expect(await rejection(saveVersion(db, id, { parentVersionId: V1, document: DOC }))).toMatchObject({ status: 404, message: PROJECT_NOT_FOUND_MESSAGE });
    expect(calls).toHaveLength(0);
  });
});

describe("moveProject — PATCH /api/projects/[id]", () => {
  it("updates only folder and returns it", async () => {
    const { db, calls } = fakeDb(() => ({ data: [{ id: P1, folder: "past" }] }));
    await expect(moveProject(db, P1, { folder: "past" })).resolves.toEqual({ projectId: P1, folder: "past" });
    expect(calls[0].ops).toContainEqual(["update", [{ folder: "past" }]]);
    expect(calls[0].ops).toContainEqual(["eq", ["id", P1]]);
  });

  it("404s when zero rows changed, because an RLS-denied UPDATE is silent", async () => {
    const { db } = fakeDb(() => ({ data: [] }));
    expect(await rejection(moveProject(db, P1, { folder: "past" }))).toMatchObject({ status: 404, message: PROJECT_NOT_FOUND_MESSAGE });
  });

  it("refuses a folder that does not exist before touching the database", async () => {
    const { db, calls } = fakeDb(() => ({}));
    expect((await rejection(moveProject(db, P1, { folder: "archive" }))).status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it.each(MALFORMED_IDS)("404s on a malformed project id %j without touching the database", async (id) => {
    const { db, calls } = fakeDb(() => ({}));
    expect((await rejection(moveProject(db, id, { folder: "past" }))).status).toBe(404);
    expect(calls).toHaveLength(0);
  });
});

describe("getVersion — GET /api/projects/[id]/versions/[versionId]", () => {
  it("returns the document with the project's company, folder and head", async () => {
    const { db } = fakeDb((call) => {
      if (call.name === "project_versions") {
        return { data: { id: V3, project_id: P1, version_number: 3, created_at: CREATED_AT, schema_version: 24, author_name: "Virgil", document: DOC } };
      }
      if (call.name === "projects") return { data: { id: P1, company_id: BI_ID, name: "Smith House", folder: "past", head_version_number: 5 } };
      return { data: { name: "Building Integrity" } };
    });
    await expect(getVersion(db, P1, V3)).resolves.toEqual({
      projectId: P1,
      companyId: BI_ID,
      companyName: "Building Integrity",
      folder: "past",
      projectName: "Smith House",
      headVersionNumber: 5,
      versionId: V3,
      versionNumber: 3,
      createdAt: CREATED_AT,
      schemaVersion: 24,
      authorName: "Virgil",
      document: DOC,
    });
  });

  it("gives unreadable, nonexistent and malformed the same 404", async () => {
    const none = fakeDb(() => ({ data: null }));
    const a = await rejection(getVersion(none.db, P1, V3));
    const malformed = fakeDb(() => ({}));
    const b = await rejection(getVersion(malformed.db, P1, "nope"));
    const c = await rejection(getVersion(malformed.db, "nope", V3));
    for (const e of [a, b, c]) expect(e).toMatchObject({ status: 404, message: VERSION_NOT_FOUND_MESSAGE });
    expect(malformed.calls).toHaveLength(0);
  });
});

describe("the project routes", () => {
  const apiDir = join(dirname(fileURLToPath(import.meta.url)), "..", "api", "projects");
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : [path];
    });

  it("exist for 2B, and not for the 2C/2D routes", () => {
    const routes = files(apiDir).map((p) => p.slice(apiDir.length).replace(/\\/g, "/"));
    expect(routes.sort()).toEqual(["/[id]/route.ts", "/[id]/versions/[versionId]/route.ts", "/[id]/versions/route.ts", "/route.ts"]);
    const versions = readFileSync(join(apiDir, "[id]", "versions", "route.ts"), "utf8");
    expect(versions).not.toMatch(/export async function GET/);
  });

  it("never import the admin (service-role) client", () => {
    for (const path of files(apiDir)) {
      const source = readFileSync(path, "utf8");
      expect(source, path).not.toMatch(/createSupabaseAdminClient|SUPABASE_SECRET_KEY|service_role/);
    }
    const logic = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "projectRouteLogic.ts"), "utf8");
    // Import lines only: the file's own doc comment names the admin client to
    // say it is never used.
    expect(logic).not.toMatch(/^import .*createSupabaseAdminClient/m);
  });
});
