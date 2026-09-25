import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Entitlement } from "../auth/actingAs";
import { DOCUMENT_TOO_LARGE_MESSAGE, NAME_LENGTH_MESSAGE, NO_COMPANY_MESSAGE } from "./cloudTypes";
import {
  INVALID_ID_MESSAGE,
  LIST_REFUSED_MESSAGE,
  PROJECT_NOT_FOUND_MESSAGE,
  ProjectRouteError,
  RENAME_NOT_FOUND_MESSAGE,
  SAVE_ACCESS_LOST_MESSAGE,
  VERSION_LIST_COLUMNS,
  VERSION_NOT_FOUND_MESSAGE,
  checkCreateTarget,
  createProject,
  getVersion,
  isUuid,
  listProjects,
  listVersions,
  mapProjectDbError,
  moveProject,
  readLabel,
  renameProject,
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

const BI: Entitlement = {
  companyId: BI_ID,
  companyName: "Building Integrity",
  source: "membership",
  level: "member",
  isDefault: true,
  isConsortium: false,
};
const RF_ADMIN: Entitlement = {
  companyId: RF_ID,
  companyName: "Rare Forms",
  source: "platform-admin",
  level: null,
  isDefault: false,
  isConsortium: false,
};
const SEED: Entitlement = {
  companyId: SEED_ID,
  companyName: "The Seed Collaborative",
  source: "consortium",
  level: null,
  isDefault: false,
  isConsortium: true,
};

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

  it("3D: the two-tab 409 still fires for the consortium entitlement, word for word", () => {
    expect(checkCreateTarget(SEED, BI_ID)).toEqual({
      ok: false,
      status: 409,
      message: "You're now acting as The Seed Collaborative (changed in another tab). Nothing was saved.",
    });
  });

  it("3D: allows the consortium entitlement when it matches, into the consortium's own tree", () => {
    expect(checkCreateTarget(SEED, SEED_ID)).toEqual({ ok: true, companyId: SEED_ID, companyName: "The Seed Collaborative" });
  });

  it("3D opened ONE company: every other wrong-company create is still refused", () => {
    // The company the client names never decides anything; the verified
    // entitlement does. A consortium entitlement names only the consortium
    // company (computeEntitlements), so there is no other company it reaches.
    const wrong = [
      [BI, RF_ID],
      [BI, SEED_ID],
      [RF_ADMIN, BI_ID],
      [RF_ADMIN, SEED_ID],
      [SEED, BI_ID],
      [SEED, RF_ID],
    ] as const;
    for (const [actingAs, named] of wrong) {
      expect(checkCreateTarget(actingAs, named)).toMatchObject({ ok: false, status: 409 });
    }
    expect(checkCreateTarget(null, SEED_ID)).toMatchObject({ ok: false, status: 403, message: NO_COMPANY_MESSAGE });
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

  it("403s for no company, without saving", async () => {
    const { db, calls } = ok();
    expect((await rejection(createProject(db, null, { expectedCompanyId: BI_ID, document: DOC }))).message).toBe(NO_COMPANY_MESSAGE);
    expect(calls).toHaveLength(0);
  });

  it("3D: creates in the consortium's tree, and the answer names Seed as the owner", async () => {
    const { db, calls } = ok();
    const result = await createProject(db, SEED, { expectedCompanyId: SEED_ID, document: DOC });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ kind: "rpc", name: "create_project", terminal: "single", args: { p_company_id: SEED_ID } });
    // Ownership stays with Seed (answer 1). The creator's grant is the
    // database trigger's job, so nothing here writes or claims one.
    expect(result).toMatchObject({ companyId: SEED_ID, companyName: "The Seed Collaborative", folder: "current" });
  });

  it("3D: the database staying the gate — a refused consortium create is the create 403, not a save or list message", async () => {
    const { db } = fakeDb(() => ({ error: { code: "42501", message: "new row violates row-level security policy" } }));
    const error = await rejection(createProject(db, SEED, { expectedCompanyId: SEED_ID, document: DOC }));
    expect(error.status).toBe(403);
    expect(error.message).toBe("You can't create a project in that company. Nothing was saved.");
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
      if (call.name === "project_owner_company_name") return { data: "Building Integrity" };
      return {};
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

// ---------------------------------------------------------------------------
// Stage 2C
// ---------------------------------------------------------------------------

describe("listVersions — GET /api/projects/[id]/versions", () => {
  const PROJECT = { id: P1, company_id: BI_ID, name: "Smith Residence", folder: "current", head_version_number: 4 };
  const ROWS = [
    { id: V4, version_number: 4, parent_version_id: V2, kind: "save", label: "from v2", author_name: "Tommy", created_at: CREATED_AT, schema_version: 24 },
    { id: V3, version_number: 3, parent_version_id: V2, kind: "rename", label: null, author_name: "Virgil", created_at: CREATED_AT, schema_version: 24 },
    { id: V2, version_number: 2, parent_version_id: V1, kind: "save", label: null, author_name: "M", created_at: CREATED_AT, schema_version: 23 },
    { id: V1, version_number: 1, parent_version_id: null, kind: "save", label: null, author_name: "M", created_at: CREATED_AT, schema_version: 22 },
  ];
  const isRenameNames = (call: Call) => call.ops.some(([op, args]) => op === "eq" && args[0] === "kind");

  const standard = (over: { names?: Reply; versions?: Reply; project?: Reply } = {}) =>
    fakeDb((call) => {
      if (call.name === "projects") return over.project ?? { data: PROJECT };
      if (call.name === "project_owner_company_name") return { data: "Building Integrity" };
      if (call.name === "project_versions" && isRenameNames(call)) return over.names ?? { data: [{ id: V3, project_name: "Smith Residence" }] };
      if (call.name === "project_versions") return over.versions ?? { data: ROWS };
      return {};
    });

  it("returns every version newest first with author, time, kind, label and schema version", async () => {
    const { db } = standard();
    const result = await listVersions(db, P1);
    expect(result).toMatchObject({ projectId: P1, companyId: BI_ID, companyName: "Building Integrity", projectName: "Smith Residence", folder: "current", headVersionNumber: 4, notListedCount: 0 });
    expect(result.versions).toEqual([
      { versionId: V4, versionNumber: 4, parentVersionId: V2, parentVersionNumber: 2, kind: "save", label: "from v2", authorName: "Tommy", createdAt: CREATED_AT, schemaVersion: 24, renamedTo: null },
      { versionId: V3, versionNumber: 3, parentVersionId: V2, parentVersionNumber: 2, kind: "rename", label: null, authorName: "Virgil", createdAt: CREATED_AT, schemaVersion: 24, renamedTo: "Smith Residence" },
      { versionId: V2, versionNumber: 2, parentVersionId: V1, parentVersionNumber: 1, kind: "save", label: null, authorName: "M", createdAt: CREATED_AT, schemaVersion: 23, renamedTo: null },
      { versionId: V1, versionNumber: 1, parentVersionId: null, parentVersionNumber: null, kind: "save", label: null, authorName: "M", createdAt: CREATED_AT, schemaVersion: 22, renamedTo: null },
    ]);
  });

  it("NEVER selects document: the list names its columns, and the rename-name read extracts one key from rename rows only", async () => {
    const { db, calls } = standard();
    await listVersions(db, P1);
    const versionCalls = calls.filter((c) => c.name === "project_versions");
    expect(versionCalls).toHaveLength(2);
    const [list, names] = [versionCalls.find((c) => !isRenameNames(c))!, versionCalls.find(isRenameNames)!];
    const listColumns = String(opArgs(list, "select")?.[0]).split(",").map((c) => c.trim());
    expect(listColumns).toEqual(["id", "version_number", "parent_version_id", "kind", "label", "author_name", "created_at", "schema_version"]);
    expect(VERSION_LIST_COLUMNS).not.toMatch(/document/);
    expect(opArgs(list, "eq")).toEqual(["project_id", P1]);
    expect(opArgs(list, "order")).toEqual(["version_number", { ascending: false }]);
    const nameColumns = String(opArgs(names, "select")?.[0]).split(",").map((c) => c.trim());
    expect(nameColumns).toEqual(["id", "project_name:document->state->>projectName"]);
    expect(names.ops.filter(([op]) => op === "eq").map(([, a]) => a)).toEqual([["project_id", P1], ["kind", "rename"]]);
    // Nothing filters with a spliced string built from the path id.
    expect(calls.some((c) => c.ops.some(([op]) => op === "or"))).toBe(false);
  });

  it("makes no rename-name read when there are no renames", async () => {
    const { db, calls } = standard({ versions: { data: ROWS.filter((r) => r.kind === "save") } });
    await listVersions(db, P1);
    expect(calls.filter((c) => c.name === "project_versions")).toHaveLength(1);
  });

  it("a failing rename-name read leaves the list standing, with the rename's name as a visible gap", async () => {
    const { db } = standard({ names: { error: { code: "XX000", message: "boom" } } });
    const result = await listVersions(db, P1);
    expect(result.versions.find((v) => v.kind === "rename")?.renamedTo).toBeNull();
    expect(result.versions).toHaveLength(4);
  });

  it("says how many versions are not listed when the API row cap cut the list short", async () => {
    const { db } = standard({ project: { data: { ...PROJECT, head_version_number: 1003 } }, versions: { data: ROWS.slice(0, 2).map((r, i) => ({ ...r, version_number: 1003 - i })) } });
    const result = await listVersions(db, P1);
    expect(result).toMatchObject({ headVersionNumber: 1003, notListedCount: 1001 });
  });

  it("a save landing between the two reads makes the newest row the head, not a negative gap", async () => {
    const { db } = standard({ project: { data: { ...PROJECT, head_version_number: 3 } } });
    await expect(listVersions(db, P1)).resolves.toMatchObject({ headVersionNumber: 4, notListedCount: 0 });
  });

  it("unreadable, nonexistent and malformed are the same 404, and malformed never reaches the database", async () => {
    const none = fakeDb(() => ({ data: null }));
    const a = await rejection(listVersions(none.db, P1));
    const refused = fakeDb(() => ({ error: { code: "42501", message: "permission denied" } }));
    const b = await rejection(listVersions(refused.db, P1));
    const malformed = fakeDb(() => ({}));
    const c = await rejection(listVersions(malformed.db, `${P1},and(id.neq.0)`));
    for (const e of [a, b, c]) expect(e).toMatchObject({ status: 404, message: PROJECT_NOT_FOUND_MESSAGE });
    expect(malformed.calls).toHaveLength(0);
  });
});

describe("renameProject — POST /api/projects/[id]/rename", () => {
  const renamed = () =>
    fakeDb((call) => (call.kind === "rpc" ? { data: { version_id: V4, version_number: 8, created_at: CREATED_AT } } : {}));

  it("calls rename_project once with the trimmed name, and reports the version it copied", async () => {
    const { db, calls } = renamed();
    await expect(renameProject(db, P1, { name: "  Smith Residence \t" })).resolves.toEqual({
      projectId: P1,
      name: "Smith Residence",
      versionId: V4,
      versionNumber: 8,
      createdAt: CREATED_AT,
      renamedFromVersionNumber: 7,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ kind: "rpc", name: "rename_project", args: { p_project_id: P1, p_name: "Smith Residence" }, terminal: "single" });
    // Never a row-only rename: a direct update of projects.name would be undone by the next save.
    expect(calls.some((c) => c.name === "projects")).toBe(false);
  });

  it("refuses an empty, blank, non-string or over-200-character name before touching the database", async () => {
    for (const body of [{}, { name: "" }, { name: "   " }, { name: 42 }, { name: "n".repeat(201) }]) {
      const { db, calls } = renamed();
      expect(await rejection(renameProject(db, P1, body))).toMatchObject({ status: 400, message: NAME_LENGTH_MESSAGE });
      expect(calls).toHaveLength(0);
    }
    const { db } = renamed();
    await expect(renameProject(db, P1, { name: "n".repeat(200) })).resolves.toMatchObject({ versionNumber: 8 });
    // Counted as code points, as char_length counts them.
    await expect(renameProject(renamed().db, P1, { name: "🏠".repeat(200) })).resolves.toMatchObject({ versionNumber: 8 });
  });

  it("a malformed path id is a 404 that never reaches the database", async () => {
    for (const id of MALFORMED_IDS) {
      const { db, calls } = renamed();
      expect(await rejection(renameProject(db, id, { name: "Smith" }))).toMatchObject({ status: 404, message: RENAME_NOT_FOUND_MESSAGE });
      expect(calls).toHaveLength(0);
    }
  });

  it("another company's project (42501) reads the same as a missing one", async () => {
    const { db } = fakeDb(() => ({ error: { code: "42501", message: "project not found, or you cannot save to it" } }));
    expect(await rejection(renameProject(db, P1, { name: "Frank's Now" }))).toMatchObject({ status: 404, message: RENAME_NOT_FOUND_MESSAGE });
  });

  it("maps the database's own name-length refusal (22023) to the same 400", async () => {
    const { db } = fakeDb(() => ({ error: { code: "22023", message: "a project name must be 1 to 200 characters" } }));
    expect(await rejection(renameProject(db, P1, { name: "ok" }))).toMatchObject({ status: 400, message: NAME_LENGTH_MESSAGE });
  });
});

describe("the owner's name for a collaborator (Stage 3B)", () => {
  // Reproduces what live code did: a Rare Forms collaborator reads the project
  // and its versions through the grant, but companies_select hides Building
  // Integrity's row, so a `companies` read comes back empty.
  const asCollaborator = (ownerName: Reply = { data: "Building Integrity" }) =>
    fakeDb((call) => {
      if (call.name === "project_versions" && call.terminal === "maybeSingle") {
        return { data: { id: V3, project_id: P1, version_number: 3, created_at: CREATED_AT, schema_version: 24, author_name: "Rory Rare", document: DOC } };
      }
      if (call.name === "project_versions") return { data: [] };
      if (call.name === "projects") return { data: { id: P1, company_id: BI_ID, name: "Smith House", folder: "proposals", head_version_number: 3 } };
      if (call.name === "companies") return { data: null };
      if (call.name === "project_owner_company_name") return ownerName;
      return {};
    });

  it("getVersion and listVersions take it from project_owner_company_name, and never read companies", async () => {
    for (const run of [(db: SupabaseClient) => getVersion(db, P1, V3), (db: SupabaseClient) => listVersions(db, P1)]) {
      const { db, calls } = asCollaborator();
      await expect(run(db)).resolves.toMatchObject({ companyId: BI_ID, companyName: "Building Integrity" });
      expect(calls.find((c) => c.name === "project_owner_company_name")).toMatchObject({ kind: "rpc", args: { p_project: P1 } });
      expect(calls.some((c) => c.name === "companies")).toBe(false);
    }
  });

  it("a null or failing helper is an empty name, never a refused read (the project read already decided access)", async () => {
    for (const reply of [{ data: null }, { error: { code: "XX000", message: "boom" } }]) {
      await expect(getVersion(asCollaborator(reply).db, P1, V3)).resolves.toMatchObject({ companyName: "" });
      await expect(listVersions(asCollaborator(reply).db, P1)).resolves.toMatchObject({ companyName: "" });
    }
  });
});

describe("mapProjectDbError — 2C operations", () => {
  it("history and rename give 404 for 42501, 22P02 and PGRST116, with their own messages", () => {
    for (const code of ["42501", "22P02", "PGRST116"]) {
      expect(mapProjectDbError({ code }, "history")).toMatchObject({ status: 404, message: PROJECT_NOT_FOUND_MESSAGE });
      expect(mapProjectDbError({ code }, "rename")).toMatchObject({ status: 404, message: RENAME_NOT_FOUND_MESSAGE });
    }
  });

  it("22023 is only a rename's name-length refusal; elsewhere it stays unmapped", () => {
    expect(mapProjectDbError({ code: "22023" }, "rename")).toMatchObject({ status: 400 });
    expect(mapProjectDbError({ code: "22023" }, "save")).toBeNull();
  });

  it("leaves 2B's mappings as they were", () => {
    expect(mapProjectDbError({ code: "42501" }, "read")).toMatchObject({ status: 404, message: VERSION_NOT_FOUND_MESSAGE });
    expect(mapProjectDbError({ code: "42501" }, "move")).toMatchObject({ status: 404, message: PROJECT_NOT_FOUND_MESSAGE });
  });
});

describe("the project routes", () => {
  const apiDir = join(dirname(fileURLToPath(import.meta.url)), "..", "api", "projects");
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : [path];
    });

  it("exist for 2B, 2C (version list, rename), 3B (shared list, access list), 4C (asking for access) and Stage 5 (the delete preview), and not for 2D's backup", () => {
    const routes = files(apiDir).map((p) => p.slice(apiDir.length).replace(/\\/g, "/"));
    expect(routes.sort()).toEqual([
      "/[id]/access-requests/route.ts",
      "/[id]/access/[grantId]/route.ts",
      "/[id]/access/route.ts",
      "/[id]/deletion/route.ts",
      "/[id]/rename/route.ts",
      "/[id]/route.ts",
      "/[id]/versions/[versionId]/route.ts",
      "/[id]/versions/route.ts",
      "/route.ts",
      "/shared/route.ts",
    ]);
    // Stage 5's preview READS. It is a GET and nothing else, so the note that
    // describes a delete can never be the thing that performs one.
    const deletion = readFileSync(join(apiDir, "[id]", "deletion", "route.ts"), "utf8");
    expect(deletion).toMatch(/export async function GET/);
    expect(deletion).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
    const versions = readFileSync(join(apiDir, "[id]", "versions", "route.ts"), "utf8");
    expect(versions).toMatch(/export async function GET/);
    expect(versions).toMatch(/export async function POST/);
    const rename = readFileSync(join(apiDir, "[id]", "rename", "route.ts"), "utf8");
    expect(rename).toMatch(/export async function POST/);
    expect(rename).not.toMatch(/export async function (GET|PATCH|DELETE)/);
  });

  /**
   * There are exactly TWO DELETEs under /api/projects, and each is a different
   * thing. 3B's removes one grant. Stage 5's removes one WHOLE PROJECT, and
   * lets the database cascade to its versions — it must never reach
   * `project_versions` itself, because a single-version delete would leave
   * `head_version_number` stale and break a `parent_version_id` chain. The
   * spec says that operation needs its own design and this is not it.
   */
  it("delete a grant (3B) and a whole project (Stage 5) — and nothing anywhere deletes a version", () => {
    const seen: string[] = [];
    for (const path of files(apiDir)) {
      const source = readFileSync(path, "utf8");
      const route = path.replace(/\\/g, "/");
      const isGrantRoute = route.endsWith("/[id]/access/[grantId]/route.ts");
      const isProjectRoute = route.endsWith("/api/projects/[id]/route.ts");
      if (isGrantRoute) {
        expect(source).toMatch(/export async function DELETE/);
        expect(source).toMatch(/removeGrant\(/);
        expect(source).not.toMatch(/from\("projects"\)|from\("project_versions"\)/);
        seen.push("grant");
      } else if (isProjectRoute) {
        expect(source).toMatch(/export async function DELETE/);
        expect(source).toMatch(/deleteProject\(/);
        seen.push("project");
      } else {
        expect(source, path).not.toMatch(/export async function DELETE/);
      }
      // No route deletes a version, whatever else it does.
      expect(source, path).not.toMatch(/from\("project_versions"\)[\s\S]{0,80}\.delete\(/);
    }
    expect(seen.sort()).toEqual(["grant", "project"]);
    // And neither does the logic behind the project delete.
    const deleteLogic = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "deleteRouteLogic.ts"), "utf8");
    expect(deleteLogic).not.toMatch(/from\("project_versions"\)[\s\S]{0,80}\.delete\(/);
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
