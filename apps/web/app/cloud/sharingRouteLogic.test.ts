import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Entitlement } from "../auth/actingAs";
import { PROJECT_NOT_FOUND_MESSAGE, ProjectRouteError } from "./projectRouteLogic";
import {
  ACCESS_COLUMNS,
  ALSO_REMOVE_MESSAGE,
  REMOVE_REFUSED_MESSAGE,
  SHAREABLE_REFUSED_MESSAGE,
  SHARED_LIST_REFUSED_MESSAGE,
  SHARE_COMPANY_ID_MESSAGE,
  SHARE_EMAIL_AMBIGUOUS_MESSAGE,
  SHARE_EMAIL_REQUIRED_MESSAGE,
  SHARE_KIND_MESSAGE,
  SHARE_NOT_FOUND_MESSAGE,
  SHARE_UNATTRIBUTABLE_MESSAGE,
  getProjectAccess,
  isOwnerSide,
  listShareableCompanies,
  listSharedProjects,
  mapSharingDbError,
  parseOptionalJsonBody,
  removeGrant,
  shareProject,
  type SharingOperation,
  type SharingViewer,
} from "./sharingRouteLogic";
import { NO_ACCOUNT_MESSAGE } from "./sharingDisplay";

// The same chainable stand-in as projectRouteLogic.test.ts.
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

const has = (call: Call, op: string) => call.ops.some(([name]) => name === op);
const opArgsAll = (call: Call, op: string) => call.ops.filter(([name]) => name === op).map(([, a]) => a);

async function rejection(promise: Promise<unknown>): Promise<ProjectRouteError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ProjectRouteError) return error;
    throw error;
  }
  throw new Error("expected a ProjectRouteError");
}

const BI_ID = "11111111-0000-0000-0000-000000000001";
const RF_ID = "22222222-0000-0000-0000-000000000001";
const SEED_ID = "44444444-0000-0000-0000-000000000001";
const NF_ID = "55555555-0000-0000-0000-000000000001";
const P1 = "5768ff5e-b9ff-4b18-bdcb-f9ccd9043b25";
const V1 = "9aed5b33-7f9e-49e9-a158-0d9941afd514";
const M = "bbbbbbbb-0000-0000-0000-000000000001";
const R = "f1f1f1f1-0000-0000-0000-000000000001";
const N = "f4f4f4f4-0000-0000-0000-000000000001";
const G_R = "1dc6411d-46c5-4004-b09d-7195b31ed928";
const G_RF = "a2191d6b-0285-4ea3-91f9-c5767253bd11";
const G_N = "1bdfbb19-94e2-4cae-b8a8-33e8795046fa";
const G_SEED = "3c1a8e0b-2f4d-4b6a-9c8e-7d6f5e4a3b2c";
// The exact timestamp text jsonb produced on local PostgreSQL 17.4.
const AT = "2026-09-15T09:29:25.617119-05:00";

const ent = (companyId: string, companyName: string, source: Entitlement["source"]): Entitlement => ({
  companyId,
  companyName,
  source,
  level: source === "membership" ? "member" : null,
  isDefault: false,
});

const VIEW_M: SharingViewer = { userId: M, isPlatformAdmin: false, entitlements: [ent(BI_ID, "Building Integrity", "membership")], actingAs: ent(BI_ID, "Building Integrity", "membership") };
const VIEW_R: SharingViewer = {
  userId: R,
  isPlatformAdmin: false,
  entitlements: [ent(RF_ID, "Rare Forms", "membership"), ent(SEED_ID, "The Seed Collaborative", "consortium")],
  actingAs: ent(RF_ID, "Rare Forms", "membership"),
};
const VIEW_T: SharingViewer = { userId: "aaaaaaaa-0000-0000-0000-000000000009", isPlatformAdmin: true, entitlements: [ent(BI_ID, "Building Integrity", "platform-admin")], actingAs: null };

const MALFORMED = ["p1", "", " ", "not-a-uuid", `${P1}x`, "' or 1=1 --", `${P1},and(id.neq.0)`];

// ---------------------------------------------------------------------------

describe("mapSharingDbError — every 0008 SQLSTATE the 3B routes use", () => {
  const ops: SharingOperation[] = ["shared-list", "access", "share", "remove", "shareable"];

  it("42501, 22P02 and PGRST116: 404 for a project-scoped operation (not yours reads as not found), 403 for a list", () => {
    for (const code of ["42501", "22P02", "PGRST116"]) {
      expect(mapSharingDbError({ code }, "share")).toMatchObject({ status: 404, message: SHARE_NOT_FOUND_MESSAGE });
      expect(mapSharingDbError({ code }, "access")).toMatchObject({ status: 404, message: PROJECT_NOT_FOUND_MESSAGE });
      expect(mapSharingDbError({ code }, "remove")).toMatchObject({ status: 404, message: REMOVE_REFUSED_MESSAGE });
      expect(mapSharingDbError({ code }, "shared-list")).toMatchObject({ status: 403, message: SHARED_LIST_REFUSED_MESSAGE });
      expect(mapSharingDbError({ code }, "shareable")).toMatchObject({ status: 403, message: SHAREABLE_REFUSED_MESSAGE });
    }
  });

  it("22023 (blank email) is 400, 21000 (two accounts, one email) is 409, 23514 (no name to snapshot) is 409 — for share only", () => {
    expect(mapSharingDbError({ code: "22023", message: "an email address is required" }, "share")).toMatchObject({ status: 400, message: SHARE_EMAIL_REQUIRED_MESSAGE });
    expect(mapSharingDbError({ code: "21000" }, "share")).toMatchObject({ status: 409, message: SHARE_EMAIL_AMBIGUOUS_MESSAGE });
    expect(mapSharingDbError({ code: "23514" }, "share")).toMatchObject({ status: 409, message: SHARE_UNATTRIBUTABLE_MESSAGE });
    for (const op of ops.filter((o) => o !== "share")) {
      for (const code of ["22023", "21000", "23514"]) expect(mapSharingDbError({ code }, op)).toBeNull();
    }
  });

  it("never forwards a database message, and leaves unknown codes unmapped (a generic 500)", () => {
    const secret = "policy collaborators_delete on public.collaborators";
    for (const op of ops) {
      for (const code of ["42501", "22023", "21000", "23514", "PGRST116", "22P02"]) {
        const mapped = mapSharingDbError({ code, message: secret }, op);
        if (mapped) expect(mapped.message).not.toContain("collaborators");
      }
      expect(mapSharingDbError({ code: "XX000", message: secret }, op)).toBeNull();
    }
  });
});

describe("listSharedProjects — GET /api/projects/shared", () => {
  const ROW = {
    project_id: P1,
    name: "Smith House",
    folder: "proposals",
    head_version_number: 7,
    head_version_id: V1,
    head_author_name: "Mia Member",
    updated_at: AT,
    owner_company_id: BI_ID,
    owner_company_name: "Building Integrity",
    reached_via: [
      { via: "person", created_at: AT, grantee_name: "Rory Rare", granted_by_name: "Mia Member" },
      { via: "company", created_at: AT, grantee_name: "Rare Forms", granted_by_name: "Mia Member" },
    ],
  };

  it("passes the VERIFIED acting-as id to list_shared_projects and maps one row per project, both reasons kept", async () => {
    const { db, calls } = fakeDb(() => ({ data: [ROW] }));
    const result = await listSharedProjects(db, VIEW_R.actingAs);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ kind: "rpc", name: "list_shared_projects", args: { p_acting_as: RF_ID } });
    expect(result).toEqual({
      actingAs: { id: RF_ID, name: "Rare Forms" },
      projects: [
        {
          id: P1,
          name: "Smith House",
          folder: "proposals",
          headVersionNumber: 7,
          headVersionId: V1,
          headAuthorName: "Mia Member",
          updatedAt: AT,
          ownerCompanyId: BI_ID,
          ownerCompanyName: "Building Integrity",
          reachedVia: [
            { via: "person", granteeName: "Rory Rare", grantedByName: "Mia Member", createdAt: AT },
            { via: "company", granteeName: "Rare Forms", grantedByName: "Mia Member", createdAt: AT },
          ],
        },
      ],
    });
  });

  it("an account with no membership asks with null (personal grants only)", async () => {
    const { db, calls } = fakeDb(() => ({ data: [] }));
    await expect(listSharedProjects(db, null)).resolves.toEqual({ actingAs: null, projects: [] });
    expect(calls[0].args).toEqual({ p_acting_as: null });
  });

  it("never selects document: one RPC and no table read at all", async () => {
    const { db, calls } = fakeDb(() => ({ data: [ROW] }));
    await listSharedProjects(db, VIEW_R.actingAs);
    expect(calls.every((c) => c.kind === "rpc")).toBe(true);
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "sharingRouteLogic.ts"), "utf8");
    const body = source.slice(source.indexOf("export async function listSharedProjects"), source.indexOf("// GET /api/projects/[id]/access"));
    expect(body).not.toMatch(/document/);
  });

  it("a null owner name is an empty string (shown as a gap), and an unknown reach kind is dropped", async () => {
    const { db } = fakeDb(() => ({ data: [{ ...ROW, owner_company_name: null, reached_via: [{ via: "browse", created_at: AT, grantee_name: "x", granted_by_name: null }] }] }));
    const result = await listSharedProjects(db, VIEW_R.actingAs);
    expect(result.projects[0]).toMatchObject({ ownerCompanyName: "", reachedVia: [] });
  });

  it("a refusal is a 403 in our words", async () => {
    const { db } = fakeDb(() => ({ error: { code: "42501", message: "permission denied for function list_shared_projects" } }));
    expect(await rejection(listSharedProjects(db, VIEW_R.actingAs))).toMatchObject({ status: 403, message: SHARED_LIST_REFUSED_MESSAGE });
  });
});

describe("getProjectAccess — GET /api/projects/[id]/access", () => {
  const PROJECT = { id: P1, company_id: BI_ID, name: "Smith House" };
  const GRANTS = [
    { id: G_R, kind: "shared", grantee_user_id: R, grantee_company_id: null, granted_by: M, granted_by_name: "Mia Member", grantee_name: "Rory Rare", created_at: AT },
    { id: G_RF, kind: "shared", grantee_user_id: null, grantee_company_id: RF_ID, granted_by: M, granted_by_name: "Mia Member", grantee_name: "Rare Forms", created_at: AT },
    { id: G_N, kind: "shared", grantee_user_id: N, grantee_company_id: null, granted_by: R, granted_by_name: "Rory Rare", grantee_name: "n@newframeworks.test", created_at: AT },
    { id: G_SEED, kind: "shared", grantee_user_id: null, grantee_company_id: SEED_ID, granted_by: R, granted_by_name: "Rory Rare", grantee_name: "The Seed Collaborative", created_at: AT },
  ];
  const standard = (over: { project?: Reply; owner?: Reply; grants?: Reply } = {}) =>
    fakeDb((call) => {
      if (call.name === "projects") return over.project ?? { data: PROJECT };
      if (call.name === "project_owner_company_name") return over.owner ?? { data: "Building Integrity" };
      if (call.name === "consortium_company_id") return { data: SEED_ID };
      if (call.name === "collaborators") return over.grants ?? { data: GRANTS };
      return {};
    });

  it("reads the owner's name through project_owner_company_name, never a companies read", async () => {
    const { db, calls } = standard();
    const result = await getProjectAccess(db, VIEW_R, P1);
    expect(result.owner).toEqual({ id: BI_ID, name: "Building Integrity" });
    expect(calls.find((c) => c.name === "project_owner_company_name")?.args).toEqual({ p_project: P1 });
    expect(calls.some((c) => c.name === "companies")).toBe(false);
  });

  it("reads grants by named columns, filtered to the project, oldest first", async () => {
    const { db, calls } = standard();
    await getProjectAccess(db, VIEW_M, P1);
    const read = calls.find((c) => c.name === "collaborators")!;
    expect(opArgsAll(read, "select")).toEqual([[ACCESS_COLUMNS]]);
    expect(opArgsAll(read, "eq")).toEqual([["project_id", P1]]);
    expect(opArgsAll(read, "order")).toEqual([["created_at", { ascending: true }], ["id", { ascending: true }]]);
    expect(ACCESS_COLUMNS).not.toMatch(/\*/);
  });

  it("an OWNER MEMBER may remove every grant", async () => {
    const result = await getProjectAccess(standard().db, VIEW_M, P1);
    expect(result.viewerIsOwnerSide).toBe(true);
    expect(result.grants.map((g) => g.canRemove)).toEqual([true, true, true, true]);
  });

  it("a PLATFORM ADMIN may remove every grant, even with no membership at the owner", async () => {
    const result = await getProjectAccess(standard().db, VIEW_T, P1);
    expect(result.grants.every((g) => g.canRemove)).toBe(true);
  });

  it("a COLLABORATOR may remove only the grants they made (not the one to themselves)", async () => {
    const result = await getProjectAccess(standard().db, VIEW_R, P1);
    expect(result.viewerIsOwnerSide).toBe(false);
    expect(result.grants.map((g) => [g.granteeName, g.canRemove, g.isYou, g.grantedByYou])).toEqual([
      ["Rory Rare", false, true, false],
      ["Rare Forms", false, false, false],
      ["n@newframeworks.test", true, false, true],
      ["The Seed Collaborative", true, false, true],
    ]);
  });

  it("a consortium entitlement to the owner is NOT owner-side (only a membership is)", () => {
    const viaConsortium: SharingViewer = { ...VIEW_R, entitlements: [ent(BI_ID, "Building Integrity", "consortium")] };
    expect(isOwnerSide(viaConsortium, BI_ID)).toBe(false);
    expect(isOwnerSide(VIEW_M, BI_ID)).toBe(true);
  });

  it("lists, for a personal grant, the shares that person made; nothing for a company grant", async () => {
    const result = await getProjectAccess(standard().db, VIEW_M, P1);
    const byName = Object.fromEntries(result.grants.map((g) => [g.granteeName, g.sharesMadeByGrantee]));
    expect(byName["Rory Rare"]).toEqual([G_N, G_SEED]);
    expect(byName["Rare Forms"]).toEqual([]);
    expect(byName["n@newframeworks.test"]).toEqual([]);
  });

  it("marks a grant to The Seed Collaborative as the consortium company, and sends no user ids", async () => {
    const result = await getProjectAccess(standard().db, VIEW_M, P1);
    expect(result.grants.map((g) => g.granteeIsConsortium)).toEqual([false, false, false, true]);
    expect(JSON.stringify(result)).not.toContain(R);
    expect(JSON.stringify(result)).not.toContain(M);
  });

  it("unreadable, nonexistent and malformed are the same 404; malformed never reaches the database", async () => {
    const none = await rejection(getProjectAccess(standard({ project: { data: null } }).db, VIEW_R, P1));
    const refusedOwner = await rejection(getProjectAccess(standard({ owner: { data: null } }).db, VIEW_R, P1));
    for (const e of [none, refusedOwner]) expect(e).toMatchObject({ status: 404, message: PROJECT_NOT_FOUND_MESSAGE });
    for (const id of MALFORMED) {
      const { db, calls } = standard();
      expect(await rejection(getProjectAccess(db, VIEW_R, id))).toMatchObject({ status: 404 });
      expect(calls).toHaveLength(0);
    }
  });
});

describe("shareProject — POST /api/projects/[id]/access", () => {
  const replying = (status: string, grantId: string | null, extra: (call: Call) => Reply | null = () => null) =>
    fakeDb((call) => {
      const e = extra(call);
      if (e) return e;
      if (call.name === "share_project_with_person" || call.name === "share_project_with_company") return { data: { status, grant_id: grantId } };
      if (call.name === "collaborators") return { data: { grantee_name: "Rory Rare" } };
      if (call.name === "project_owner_company_name") return { data: "Building Integrity" };
      return {};
    });

  it("person: calls share_project_with_person with .single() and the email as a parameter", async () => {
    const { db, calls } = replying("shared", G_R);
    const result = await shareProject(db, P1, { kind: "person", email: "  R@RareForms.test " });
    expect(calls[0]).toMatchObject({ kind: "rpc", name: "share_project_with_person", args: { p_project: P1, p_email: "R@RareForms.test" }, terminal: "single" });
    expect(result).toEqual({ kind: "person", status: "shared", grantId: G_R, message: "Shared with Rory Rare." });
  });

  it("company: calls share_project_with_company with .single() and a validated uuid", async () => {
    const { db, calls } = replying("shared", G_RF, (c) => (c.name === "collaborators" ? { data: { grantee_name: "Rare Forms" } } : null));
    const result = await shareProject(db, P1, { kind: "company", companyId: RF_ID });
    expect(calls[0]).toMatchObject({ kind: "rpc", name: "share_project_with_company", args: { p_project: P1, p_company: RF_ID }, terminal: "single" });
    expect(result.message).toBe("Shared with Rare Forms.");
  });

  it("each status is an answer with its own words", async () => {
    const person = async (status: string, grantId: string | null = null) => (await shareProject(replying(status, grantId).db, P1, { kind: "person", email: "x@y.test" })).message;
    const company = async (status: string) => (await shareProject(replying(status, null).db, P1, { kind: "company", companyId: RF_ID })).message;
    expect(await person("no-account")).toBe(NO_ACCOUNT_MESSAGE);
    expect(NO_ACCOUNT_MESSAGE).toBe("No account uses that email. Invite them to a company first; nothing was shared.");
    expect(await person("already-member")).toBe("They're a Building Integrity member and already have access.");
    expect(await person("self")).toMatch(/your own email/);
    expect(await person("already-shared", G_R)).toBe("It's already shared with Rory Rare. Nothing was changed; the original share stands.");
    expect(await company("owner-company")).toBe("Building Integrity owns this project, so its members already have access. Nothing was shared.");
    expect(await company("not-shareable")).toBe("That company isn't one you can share with. Nothing was shared.");
  });

  it("only reads the owner name for the two answers that mention it", async () => {
    const shared = replying("shared", G_R);
    await shareProject(shared.db, P1, { kind: "person", email: "x@y.test" });
    expect(shared.calls.some((c) => c.name === "project_owner_company_name")).toBe(false);
    const member = replying("already-member", null);
    await shareProject(member.db, P1, { kind: "person", email: "x@y.test" });
    expect(member.calls.some((c) => c.name === "project_owner_company_name")).toBe(true);
  });

  it("refuses a bad body before touching the database", async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{}, SHARE_KIND_MESSAGE],
      [{ kind: "team" }, SHARE_KIND_MESSAGE],
      [{ kind: "person" }, SHARE_EMAIL_REQUIRED_MESSAGE],
      [{ kind: "person", email: "   " }, SHARE_EMAIL_REQUIRED_MESSAGE],
      [{ kind: "person", email: 7 }, SHARE_EMAIL_REQUIRED_MESSAGE],
      [{ kind: "company" }, SHARE_COMPANY_ID_MESSAGE],
      [{ kind: "company", companyId: "rare-forms" }, SHARE_COMPANY_ID_MESSAGE],
      [{ kind: "company", companyId: `${RF_ID},or(id.neq.0)` }, SHARE_COMPANY_ID_MESSAGE],
    ];
    for (const [body, message] of cases) {
      const { db, calls } = replying("shared", G_R);
      expect(await rejection(shareProject(db, P1, body))).toMatchObject({ status: 400, message });
      expect(calls).toHaveLength(0);
    }
  });

  it("a malformed project id is the share 404, and never reaches the database", async () => {
    for (const id of MALFORMED) {
      const { db, calls } = replying("shared", G_R);
      expect(await rejection(shareProject(db, id, { kind: "person", email: "x@y.test" }))).toMatchObject({ status: 404, message: SHARE_NOT_FOUND_MESSAGE });
      expect(calls).toHaveLength(0);
    }
  });

  it("maps 42501, 22023, 21000 and 23514 from the RPC", async () => {
    const failing = (code: string) => fakeDb(() => ({ error: { code, message: "raw postgres text" } })).db;
    expect(await rejection(shareProject(failing("42501"), P1, { kind: "person", email: "x@y.test" }))).toMatchObject({ status: 404, message: SHARE_NOT_FOUND_MESSAGE });
    expect(await rejection(shareProject(failing("42501"), P1, { kind: "company", companyId: RF_ID }))).toMatchObject({ status: 404 });
    expect(await rejection(shareProject(failing("22023"), P1, { kind: "person", email: "x" }))).toMatchObject({ status: 400 });
    expect(await rejection(shareProject(failing("21000"), P1, { kind: "person", email: "x@y.test" }))).toMatchObject({ status: 409 });
    expect(await rejection(shareProject(failing("23514"), P1, { kind: "company", companyId: RF_ID }))).toMatchObject({ status: 409 });
  });

  it("an unknown status from the database is not dressed up as an answer", async () => {
    await expect(shareProject(replying("weird", null).db, P1, { kind: "person", email: "x@y.test" })).rejects.toThrow(/unexpected share status/);
    await expect(shareProject(replying("self", null).db, P1, { kind: "company", companyId: RF_ID })).rejects.toThrow(/unexpected share status/);
  });

  it("a failing name read after the share still answers, with what was typed", async () => {
    const { db } = replying("shared", G_N, (c) => (c.name === "collaborators" ? { error: { code: "XX000" } } : null));
    await expect(shareProject(db, P1, { kind: "person", email: "n@newframeworks.test" })).resolves.toMatchObject({ status: "shared", message: "Shared with n@newframeworks.test." });
  });
});

describe("removeGrant — DELETE /api/projects/[id]/access/[grantId]", () => {
  const removing = (over: { target?: Reply; deleted?: Reply; cascade?: Reply } = {}) =>
    fakeDb((call) => {
      if (call.name !== "collaborators") return {};
      if (!has(call, "delete")) return over.target ?? { data: { id: G_R, grantee_user_id: R } };
      if (opArgsAll(call, "eq").some(([col]) => col === "granted_by")) return over.cascade ?? { data: [{ id: G_N }] };
      return over.deleted ?? { data: [{ id: G_R }] };
    });

  it("deletes through RLS by id AND project, and returns what it removed", async () => {
    const { db, calls } = removing();
    await expect(removeGrant(db, P1, G_R, {})).resolves.toEqual({ removedGrantId: G_R, alsoRemoved: 0, alsoNotRemoved: 0 });
    const del = calls.find((c) => has(c, "delete"))!;
    expect(opArgsAll(del, "eq")).toEqual([["id", G_R], ["project_id", P1]]);
    expect(opArgsAll(del, "select")).toEqual([["id"]]);
    expect(calls.filter((c) => has(c, "delete"))).toHaveLength(1);
  });

  it("ZERO ROWS IS 404 with one message (a collaborator removing someone else's share: hand-test step 6)", async () => {
    const { db } = removing({ deleted: { data: [] } });
    expect(await rejection(removeGrant(db, P1, G_R, {}))).toMatchObject({ status: 404, message: REMOVE_REFUSED_MESSAGE });
    expect(REMOVE_REFUSED_MESSAGE).toBe("You can remove only the shares you made, or this share is already gone. Nothing was changed.");
  });

  it("an unreadable or missing grant is the same 404, and no delete is attempted", async () => {
    const { db, calls } = removing({ target: { data: null } });
    expect(await rejection(removeGrant(db, P1, G_R, {}))).toMatchObject({ status: 404, message: REMOVE_REFUSED_MESSAGE });
    expect(calls.some((c) => has(c, "delete"))).toBe(false);
  });

  it("the cascade removes only the listed ids that the removed PERSON made, after the main removal", async () => {
    const { db, calls } = removing();
    await expect(removeGrant(db, P1, G_R, { alsoRemove: [G_N, G_SEED, G_N, G_R] })).resolves.toEqual({ removedGrantId: G_R, alsoRemoved: 1, alsoNotRemoved: 1 });
    const deletes = calls.filter((c) => has(c, "delete"));
    expect(deletes).toHaveLength(2);
    const cascade = deletes[1];
    expect(opArgsAll(cascade, "eq")).toEqual([["project_id", P1], ["granted_by", R]]);
    // De-duplicated, and never the grant already removed.
    expect(opArgsAll(cascade, "in")).toEqual([["id", [G_N, G_SEED]]]);
  });

  it("offers nothing for a company grant: alsoRemove is ignored and reported as not removed", async () => {
    const { db, calls } = removing({ target: { data: { id: G_RF, grantee_user_id: null } }, deleted: { data: [{ id: G_RF }] } });
    await expect(removeGrant(db, P1, G_RF, { alsoRemove: [G_N] })).resolves.toEqual({ removedGrantId: G_RF, alsoRemoved: 0, alsoNotRemoved: 1 });
    expect(calls.filter((c) => has(c, "delete"))).toHaveLength(1);
  });

  it("a refused main removal cascades nothing", async () => {
    const { db, calls } = removing({ deleted: { data: [] } });
    await rejection(removeGrant(db, P1, G_R, { alsoRemove: [G_N] }));
    expect(calls.filter((c) => has(c, "delete"))).toHaveLength(1);
  });

  it("a failing cascade after a successful removal is a count, not an error", async () => {
    const { db } = removing({ cascade: { error: { code: "XX000" } } });
    await expect(removeGrant(db, P1, G_R, { alsoRemove: [G_N] })).resolves.toEqual({ removedGrantId: G_R, alsoRemoved: 0, alsoNotRemoved: 1 });
  });

  it("refuses malformed ids (404, no database) and a malformed alsoRemove (400)", async () => {
    for (const id of MALFORMED) {
      const a = removing();
      expect(await rejection(removeGrant(a.db, id, G_R, {}))).toMatchObject({ status: 404 });
      const b = removing();
      expect(await rejection(removeGrant(b.db, P1, id, {}))).toMatchObject({ status: 404 });
      expect([...a.calls, ...b.calls]).toHaveLength(0);
    }
    for (const alsoRemove of ["x", [1], ["not-a-uuid"], [`${G_N},or(id.neq.0)`], { id: G_N }]) {
      const { db, calls } = removing();
      expect(await rejection(removeGrant(db, P1, G_R, { alsoRemove }))).toMatchObject({ status: 400, message: ALSO_REMOVE_MESSAGE });
      expect(calls).toHaveLength(0);
    }
  });
});

describe("parseOptionalJsonBody", () => {
  it("an empty DELETE body is {}; an object is itself; anything else is 400", () => {
    expect(parseOptionalJsonBody("")).toEqual({});
    expect(parseOptionalJsonBody("  \n")).toEqual({});
    expect(parseOptionalJsonBody('{"alsoRemove":[]}')).toEqual({ alsoRemove: [] });
    for (const text of ["{", "[]", "null", "7", '"x"']) expect(() => parseOptionalJsonBody(text)).toThrow(ProjectRouteError);
  });
});

describe("listShareableCompanies — GET /api/companies/shareable", () => {
  it("returns shareable_companies with the consortium company marked, names and ids only", async () => {
    const { db, calls } = fakeDb((call) =>
      call.name === "consortium_company_id"
        ? { data: SEED_ID }
        : { data: [{ id: BI_ID, name: "Building Integrity" }, { id: NF_ID, name: "New Frameworks" }, { id: RF_ID, name: "Rare Forms" }, { id: SEED_ID, name: "The Seed Collaborative" }] },
    );
    await expect(listShareableCompanies(db)).resolves.toEqual({
      companies: [
        { id: BI_ID, name: "Building Integrity", isConsortium: false },
        { id: NF_ID, name: "New Frameworks", isConsortium: false },
        { id: RF_ID, name: "Rare Forms", isConsortium: false },
        { id: SEED_ID, name: "The Seed Collaborative", isConsortium: true },
      ],
    });
    expect(calls.map((c) => c.name)).toEqual(["shareable_companies", "consortium_company_id"]);
  });

  it("below the assurance level (42501) is a 403 in our words", async () => {
    const { db } = fakeDb(() => ({ error: { code: "42501", message: "sign in (and finish two-factor) to list companies" } }));
    expect(await rejection(listShareableCompanies(db))).toMatchObject({ status: 403, message: SHAREABLE_REFUSED_MESSAGE });
  });
});

describe("the 3B routes", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const api = join(here, "..", "api");
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : [path];
    });
  const routes = [
    join(api, "projects", "shared", "route.ts"),
    join(api, "projects", "[id]", "access", "route.ts"),
    join(api, "projects", "[id]", "access", "[grantId]", "route.ts"),
    join(api, "companies", "shareable", "route.ts"),
  ];

  it("exist, and each starts from requireCloudSession (the session's JWT-bound client)", () => {
    for (const path of routes) {
      const source = readFileSync(path, "utf8");
      expect(source, path).toMatch(/requireCloudSession\(\)/);
      expect(source, path).toMatch(/cloudErrorResponse\(error\)/);
    }
  });

  it("never import the admin client, here or in the logic", () => {
    for (const path of [...routes, ...files(join(api, "projects"))]) {
      expect(readFileSync(path, "utf8"), path).not.toMatch(/createSupabaseAdminClient|SUPABASE_SECRET_KEY|service_role/);
    }
    const logic = readFileSync(join(here, "sharingRouteLogic.ts"), "utf8");
    expect(logic).not.toMatch(/^import .*createSupabaseAdminClient/m);
  });

  it("add nothing for the notice (3C) or the backup (3E)", () => {
    expect(files(api).some((p) => /share-notices/.test(p))).toBe(false);
    const logic = readFileSync(join(here, "sharingRouteLogic.ts"), "utf8");
    expect(logic).not.toMatch(/pending_share_notices|dismiss_share_notices/);
  });
});
