import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { ProjectRouteError } from "./projectRouteLogic";
import {
  BROWSE_CANNOT_SHOW_MESSAGE,
  BROWSE_LIST_REFUSED_MESSAGE,
  BROWSE_NOT_FOUND_MESSAGE,
  BROWSE_PROJECT_NOT_FOUND_MESSAGE,
} from "./browseDisplay";
import { browseCompanies, browseProjects, browseVersion, browseVersions, mapBrowseDbError } from "./browseRouteLogic";

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

async function rejection(promise: Promise<unknown>): Promise<ProjectRouteError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ProjectRouteError) return error;
    throw error;
  }
  throw new Error("expected a ProjectRouteError");
}

const RF_ID = "22222222-0000-0000-0000-000000000001";
const BI_ID = "11111111-0000-0000-0000-000000000001";
const P1 = "240320ca-651c-4f2e-bf95-f97346d0fd51";
const V1 = "0a95472c-79f6-42e4-b059-e907aa1549c1";

/** The document `browse_version` serves: no priceModifier, plus the marker. */
const REDACTED_DOCUMENT = {
  schemaVersion: 24,
  savedAt: "2026-09-14T13:00:00.000Z",
  state: { projectName: "Smith House", zipCode: "05001" },
  redaction: { schemaVersion: 24, removedPaths: ["state.priceModifier"], reason: "another company's cost information" },
};

const PROJECT_ROW = {
  project_id: P1,
  name: "Smith House",
  folder: "current",
  head_version_number: 7,
  head_version_id: V1,
  head_author_name: "a member of Rare Forms",
  head_schema_version: 24,
  head_redaction_known: true,
  updated_at: "2026-09-14T13:00:00+00:00",
  owner_company_id: RF_ID,
  owner_company_name: "Rare Forms",
  access: "redacted",
};

// ---------------------------------------------------------------------------
// Error mapping — 0A000 above all
// ---------------------------------------------------------------------------

describe("mapBrowseDbError", () => {
  /**
   * 0A000 is `browse_redact` refusing to serve: a file format it has no
   * classification for, a document whose own schemaVersion disagrees with its
   * recorded one, or a cost field that survived redaction. Confirmed by
   * running all three on local PostgreSQL 17.4, not read off the migration.
   */
  it("maps 0A000 to 'this version can't be shown', on every operation", () => {
    for (const op of ["companies", "projects", "versions", "version"] as const) {
      const mapped = mapBrowseDbError({ code: "0A000" }, op);
      expect(mapped).toMatchObject({ status: 422, message: BROWSE_CANNOT_SHOW_MESSAGE });
    }
  });

  it("0A000 is NOT a 404 and NOT a 500 — it is final, not 'look somewhere else' or 'retry'", () => {
    const mapped = mapBrowseDbError({ code: "0A000" }, "version");
    expect(mapped?.status).not.toBe(404);
    expect(mapped?.status).not.toBe(500);
    // And its message does not send anyone to another route. The Stage 2 read
    // would serve the UNTOUCHED stored document across a company line.
    expect(mapped?.message).not.toMatch(/\/api\/projects/);
  });

  it("maps 42501 to one uniform not-found, so ids cannot be probed", () => {
    expect(mapBrowseDbError({ code: "42501" }, "version")).toMatchObject({ status: 404, message: BROWSE_NOT_FOUND_MESSAGE });
    expect(mapBrowseDbError({ code: "42501" }, "versions")).toMatchObject({ status: 404, message: BROWSE_PROJECT_NOT_FOUND_MESSAGE });
    expect(mapBrowseDbError({ code: "42501" }, "projects")).toMatchObject({ status: 403, message: BROWSE_LIST_REFUSED_MESSAGE });
    expect(mapBrowseDbError({ code: "42501" }, "companies")).toMatchObject({ status: 403, message: BROWSE_LIST_REFUSED_MESSAGE });
  });

  it("a malformed uuid reaching the database reads exactly like not-found", () => {
    expect(mapBrowseDbError({ code: "22P02" }, "version")).toEqual(mapBrowseDbError({ code: "42501" }, "version"));
  });

  it("maps 22023 to the folder message", () => {
    expect(mapBrowseDbError({ code: "22023" }, "projects")).toMatchObject({ status: 400 });
  });

  it("leaves anything else unmapped, so no Postgres text reaches the browser", () => {
    expect(mapBrowseDbError({ code: "XX000", message: "internal: pg_temp.foo" }, "version")).toBeNull();
    expect(mapBrowseDbError({}, "version")).toBeNull();
  });

  it("carries no database message into any mapped answer", () => {
    for (const code of ["0A000", "42501", "22P02", "22023", "PGRST116"]) {
      const mapped = mapBrowseDbError({ code, message: "relation project_versions does not exist" }, "version");
      expect(mapped?.message).not.toMatch(/project_versions|relation/);
    }
  });
});

// ---------------------------------------------------------------------------
// The four calls
// ---------------------------------------------------------------------------

describe("browseCompanies", () => {
  it("calls browse_companies and nothing else", async () => {
    const { db, calls } = fakeDb(() => ({ data: [{ id: RF_ID, name: "Rare Forms" }] }));
    expect(await browseCompanies(db)).toEqual({ companies: [{ id: RF_ID, name: "Rare Forms" }] });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ kind: "rpc", name: "browse_companies" });
  });

  it("an empty list is a real answer, not an error: a non-member company sees nothing", () => {
    // "Neither sees nor is seen": browse_companies returns no rows rather than
    // raising, so this must not be dressed up as a failure.
    const { db } = fakeDb(() => ({ data: [] }));
    return expect(browseCompanies(db)).resolves.toEqual({ companies: [] });
  });
});

describe("browseProjects", () => {
  it("passes the company and folder to browse_projects as named arguments", async () => {
    const { db, calls } = fakeDb(() => ({ data: [PROJECT_ROW] }));
    const result = await browseProjects(db, RF_ID, "current");
    expect(calls[0]).toMatchObject({ kind: "rpc", name: "browse_projects", args: { p_company: RF_ID, p_folder: "current" } });
    expect(result.projects[0]).toMatchObject({
      projectId: P1,
      ownerCompanyName: "Rare Forms",
      access: "redacted",
      headRedactionKnown: true,
      headAuthorName: "a member of Rare Forms",
    });
    expect(result.company).toEqual({ id: RF_ID, name: "Rare Forms" });
    expect(result.folder).toBe("current");
  });

  it("asks for everything when neither is given", async () => {
    const { db, calls } = fakeDb(() => ({ data: [] }));
    await browseProjects(db, null, null);
    expect(calls[0].args).toEqual({ p_company: null, p_folder: null });
  });

  it("refuses a malformed company id before it reaches the database", async () => {
    const { db, calls } = fakeDb(() => ({ data: [] }));
    const error = await rejection(browseProjects(db, "not-a-uuid", "current"));
    expect(error.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("refuses a folder that is not one of the three, before the database", async () => {
    const { db, calls } = fakeDb(() => ({ data: [] }));
    expect((await rejection(browseProjects(db, RF_ID, "archive"))).status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("anything the database does not call `full` opens through the redactor", async () => {
    // Defaulting the other way would open a mislabelled row WITH costs.
    for (const access of ["", "FULL", "partial", null, undefined]) {
      const { db } = fakeDb(() => ({ data: [{ ...PROJECT_ROW, access }] }));
      const result = await browseProjects(db, null, null);
      expect(result.projects[0].access).toBe("redacted");
    }
    const { db } = fakeDb(() => ({ data: [{ ...PROJECT_ROW, access: "full" }] }));
    expect((await browseProjects(db, null, null)).projects[0].access).toBe("full");
  });

  it("selects no document: the only call it makes is the listing rpc", async () => {
    const { db, calls } = fakeDb(() => ({ data: [PROJECT_ROW] }));
    await browseProjects(db, RF_ID, "current");
    expect(calls.every((c) => c.kind === "rpc")).toBe(true);
    expect(calls.some((c) => c.name === "project_versions" || c.name === "projects")).toBe(false);
  });
});

describe("browseVersions", () => {
  const VERSION_ROW = {
    version_id: V1,
    version_number: 3,
    parent_version_id: null,
    kind: "save",
    label: "Quoted at 1.35 markup",
    author_name: "a member of Rare Forms",
    created_at: "2026-09-14T13:00:00+00:00",
    schema_version: 24,
    redaction_known: true,
    project_name: "Smith House",
  };

  it("calls browse_versions with the validated project id", async () => {
    const { db, calls } = fakeDb(() => ({ data: [VERSION_ROW] }));
    const result = await browseVersions(db, P1);
    expect(calls[0]).toMatchObject({ kind: "rpc", name: "browse_versions", args: { p_project: P1 } });
    expect(result.versions[0]).toMatchObject({ versionId: V1, versionNumber: 3, redactionKnown: true });
  });

  it("DROPS the label even if the database ever started sending one", async () => {
    // The second lock on the same door. browse_versions returns null::text for
    // it (narrowed 2026-09-23, after a probe read back a note saying "Quoted at
    // 1.35 markup" to another company). This is the route half, so a future
    // edit to the function cannot start a label flowing through a route that
    // merely passed the column along.
    const { db } = fakeDb(() => ({ data: [VERSION_ROW] }));
    const result = await browseVersions(db, P1);
    expect(result.versions[0].label).toBeNull();
    expect(JSON.stringify(result)).not.toContain("1.35");
  });

  it("a malformed project id is the same 404 as not-found, with no database call", async () => {
    const { db, calls } = fakeDb(() => ({ data: [] }));
    const error = await rejection(browseVersions(db, "nope"));
    expect(error).toMatchObject({ status: 404, message: BROWSE_PROJECT_NOT_FOUND_MESSAGE });
    expect(calls).toHaveLength(0);
  });
});

describe("browseVersion", () => {
  const ROW = {
    project_id: P1,
    folder: "current",
    owner_company_id: RF_ID,
    owner_company_name: "Rare Forms",
    version_id: V1,
    version_number: 7,
    kind: "save",
    label: "Quoted at 1.35 markup",
    author_name: "a member of Rare Forms",
    created_at: "2026-09-14T13:00:00+00:00",
    schema_version: 24,
    document: REDACTED_DOCUMENT,
  };

  it("serves the document through browse_version, and through nothing else", async () => {
    const { db, calls } = fakeDb(() => ({ data: [ROW] }));
    const result = await browseVersion(db, P1, V1);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ kind: "rpc", name: "browse_version", args: { p_project: P1, p_version: V1 } });
    expect(result.document).toEqual(REDACTED_DOCUMENT);
    // NOT `project_versions`. There is no "read it raw, redact it here" step.
    expect(calls.some((c) => c.kind === "from")).toBe(false);
  });

  it("carries no label onto the response", async () => {
    const { db } = fakeDb(() => ({ data: [ROW] }));
    const result = await browseVersion(db, P1, V1);
    expect(result).not.toHaveProperty("label");
    expect(JSON.stringify(result)).not.toContain("1.35");
  });

  it("turns the redactor's refusal into 422 'can't be shown', not a retry and not a fallback", async () => {
    const { db } = fakeDb(() => ({ error: { code: "0A000", message: "file format 23 has no redaction classification" } }));
    const error = await rejection(browseVersion(db, P1, V1));
    expect(error).toMatchObject({ status: 422, message: BROWSE_CANNOT_SHOW_MESSAGE });
    expect(error.message).not.toMatch(/format 23|classification/);
  });

  it("makes NO second call after a refusal — the Stage 2 route is never tried", async () => {
    const { db, calls } = fakeDb(() => ({ error: { code: "0A000" } }));
    await rejection(browseVersion(db, P1, V1));
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("browse_version");
  });

  it("an empty result is a 404, not an undefined row read as a document", async () => {
    const { db } = fakeDb(() => ({ data: [] }));
    expect(await rejection(browseVersion(db, P1, V1))).toMatchObject({ status: 404, message: BROWSE_NOT_FOUND_MESSAGE });
  });

  it("a malformed project or version id is the same 404, with no database call", async () => {
    for (const [p, v] of [
      ["nope", V1],
      [P1, "nope"],
    ]) {
      const { db, calls } = fakeDb(() => ({ data: [ROW] }));
      expect(await rejection(browseVersion(db, p, v))).toMatchObject({ status: 404, message: BROWSE_NOT_FOUND_MESSAGE });
      expect(calls).toHaveLength(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Route-level invariants, read off the source (the established style)
// ---------------------------------------------------------------------------

/**
 * The CODE, with comments stripped. These files explain at length what they
 * must not do — "no createSupabaseAdminClient", "the backup route is never
 * borrowed" — and a naive scan would match those explanations and fail. The
 * rule is about what the code does, so the comments are removed first.
 */
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("the browse routes", () => {
  const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
  const apiDir = join(appDir, "api", "browse");
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : [path];
    });

  it("are exactly the four the plan names", () => {
    const routes = files(apiDir).map((p) => p.slice(apiDir.length).replace(/\\/g, "/"));
    expect(routes.sort()).toEqual([
      "/companies/route.ts",
      "/projects/[id]/versions/[versionId]/route.ts",
      "/projects/[id]/versions/route.ts",
      "/projects/route.ts",
    ]);
  });

  it("are READ-ONLY: GET and nothing else. Browsing writes nothing", () => {
    for (const path of files(apiDir)) {
      const source = codeOf(readFileSync(path, "utf8"));
      expect(source).toMatch(/export async function GET/);
      expect(source).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
    }
  });

  it("use NO admin client and never mention the service role", () => {
    // The browse functions are SECURITY DEFINER and read auth.uid(); a
    // service-role client would make every one of their checks pass for
    // anybody.
    for (const path of [...files(apiDir), join(appDir, "cloud", "browseRouteLogic.ts")]) {
      const source = codeOf(readFileSync(path, "utf8"));
      expect(source).not.toMatch(/createSupabaseAdminClient/);
      expect(source).not.toMatch(/service_role/);
      expect(source).not.toMatch(/SUPABASE_SERVICE_ROLE/);
    }
  });

  it("select no document out of project_versions anywhere on the browse path", () => {
    for (const path of [...files(apiDir), join(appDir, "cloud", "browseRouteLogic.ts")]) {
      const source = codeOf(readFileSync(path, "utf8"));
      expect(source).not.toMatch(/from\("project_versions"\)/);
      expect(source).not.toMatch(/from\("projects"\)/);
    }
  });

  it("never borrow the Stage 2 version route or the backup route", () => {
    for (const path of [...files(apiDir), join(appDir, "cloud", "browseRouteLogic.ts")]) {
      const source = codeOf(readFileSync(path, "utf8"));
      expect(source).not.toMatch(/getVersion\(/);
      expect(source).not.toMatch(/\/api\/projects\/\$\{/);
      expect(source).not.toMatch(/backup/i);
    }
  });

  it("go through requireCloudSession, so two-factor and sign-in are checked as everywhere else", () => {
    for (const path of files(apiDir)) {
      expect(codeOf(readFileSync(path, "utf8"))).toMatch(/requireCloudSession\(\)/);
    }
  });
});

// ---------------------------------------------------------------------------
// Backups (29): Stage 4 adds no third phase
// ---------------------------------------------------------------------------

describe("the backup is untouched by browsing", () => {
  const cloudDir = dirname(fileURLToPath(import.meta.url));

  it("the phase list is exactly owned and granted", () => {
    const source = readFileSync(join(cloudDir, "backupRouteLogic.ts"), "utf8");
    const declared = /export type BackupPhase = ([^;]+);/.exec(source)?.[1] ?? "";
    expect(declared.match(/"[a-z]+"/g)).toEqual(['"owned"', '"granted"']);
  });

  it("neither backup file mentions a browse function or the browse route", () => {
    // A project reachable only through browsing matches neither enumeration,
    // so no page can contain it — 29's rule that a backup never holds more
    // than its owner could export by hand.
    for (const name of ["backupRouteLogic.ts", "companyBackup.ts"]) {
      const source = codeOf(readFileSync(join(cloudDir, name), "utf8"));
      expect(source).not.toMatch(/browse_/);
      expect(source).not.toMatch(/\/api\/browse/);
      expect(source).not.toMatch(/browseRouteLogic/);
    }
  });
});
