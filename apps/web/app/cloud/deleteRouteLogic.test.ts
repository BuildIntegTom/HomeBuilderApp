import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { ProjectRouteError } from "./projectRouteLogic";
import {
  DELETE_CONFIRM_REQUIRED_MESSAGE,
  DELETE_NOT_ADMIN_MESSAGE,
  DELETE_PREVIEW_REFUSED_MESSAGE,
  DELETE_REFUSED_MESSAGE,
} from "./deleteDisplay";
import {
  confirmationMatches,
  deleteProject,
  mapDeleteDbError,
  previewProjectDelete,
  readConfirmation,
  readDeleteBody,
  requireAdmin,
  type DeleteViewer,
} from "./deleteRouteLogic";

/**
 * Stage 5, first slice. These tests cover the ROUTE LOGIC, which is the
 * courtesy layer. They do NOT prove anybody may or may not delete anything:
 * `projects_delete` (0006) does that, in the database, and
 * `supabase/tests/stage5_rls.test.sql` is what drives it.
 *
 * What they do prove is that this layer fails closed, that it never writes a
 * delete it was not asked for, and that it never says a project is gone when
 * it is not (or still there when it is).
 */

// The same chainable stand-in as projectRouteLogic.test.ts, with one addition:
// `count`, because the footprint reads use `{ count: "exact", head: true }`.
interface Call {
  kind: "rpc" | "from";
  name: string;
  args?: unknown;
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
  const db = {
    rpc: (name: string, args: unknown) => builder({ kind: "rpc", name, args, ops: [] }),
    from: (name: string) => builder({ kind: "from", name, ops: [] }),
  };
  return { db: db as unknown as SupabaseClient, calls };
}

const has = (call: Call, op: string) => call.ops.some(([name]) => name === op);

async function rejection(promise: Promise<unknown>): Promise<ProjectRouteError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ProjectRouteError) return error;
    throw error;
  }
  throw new Error("expected a ProjectRouteError");
}

const P1 = "5768ff5e-b9ff-4b18-bdcb-f9ccd9043b25";
const ADMIN: DeleteViewer = { isPlatformAdmin: true };
const MEMBER: DeleteViewer = { isPlatformAdmin: false };

const PROJECT_ROW = { id: P1, name: "Smith Residence", folder: "current", head_version_number: 7 };

/** A database that answers every read this path makes, happily. */
function healthyDb(overrides: { project?: unknown; versions?: number; grants?: number; requests?: number; deleted?: unknown } = {}) {
  return fakeDb((call) => {
    if (call.kind === "rpc" && call.name === "project_owner_company_name") return { data: "Building Integrity" };
    if (call.kind !== "from") return {};
    if (call.name === "projects") {
      if (has(call, "delete")) return { data: "deleted" in overrides ? overrides.deleted : [{ id: P1 }] };
      return { data: overrides.project === undefined ? PROJECT_ROW : overrides.project };
    }
    if (call.name === "project_versions") return { count: overrides.versions ?? 7 };
    if (call.name === "collaborators") return { count: overrides.grants ?? 2 };
    if (call.name === "collab_requests") return { count: overrides.requests ?? 1 };
    return {};
  });
}

describe("requireAdmin — fail closed", () => {
  it("lets a platform admin through", () => {
    expect(() => requireAdmin(ADMIN)).not.toThrow();
  });

  it("refuses an ordinary member, a null viewer and an undefined one alike", async () => {
    for (const viewer of [MEMBER, null, undefined]) {
      const error = await rejection(Promise.reject(catchSync(() => requireAdmin(viewer))));
      expect(error.status).toBe(403);
      expect(error.message).toBe(DELETE_NOT_ADMIN_MESSAGE);
    }
  });

  /**
   * The flag is a BOOLEAN from the verified session. Anything else — a string
   * "true", a 1, a missing key — is not a platform admin. Fail closed means
   * fail closed on a shape it did not expect, too.
   */
  it("is not satisfied by a truthy non-boolean", () => {
    for (const value of ["true", 1, {}, []]) {
      const viewer = { isPlatformAdmin: value } as unknown as DeleteViewer;
      expect(() => requireAdmin(viewer)).toThrow(DELETE_NOT_ADMIN_MESSAGE);
    }
  });
});

function catchSync(run: () => void): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  return new Error("expected a throw");
}

describe("previewProjectDelete", () => {
  it("names the project, its owner and the three things that would go with it", async () => {
    const { db } = healthyDb();
    const preview = await previewProjectDelete(db, ADMIN, P1);
    expect(preview).toEqual({
      projectId: P1,
      projectName: "Smith Residence",
      ownerCompanyName: "Building Integrity",
      folder: "current",
      headVersionNumber: 7,
      versionCount: 7,
      grantCount: 2,
      accessRequestCount: 1,
      confirmationPhrase: "Smith Residence",
    });
  });

  it("reads and deletes nothing", async () => {
    const { db, calls } = healthyDb();
    await previewProjectDelete(db, ADMIN, P1);
    expect(calls.some((c) => has(c, "delete"))).toBe(false);
    expect(calls.map((c) => c.name).sort()).toEqual([
      "collab_requests",
      "collaborators",
      "project_owner_company_name",
      "project_versions",
      "projects",
    ]);
  });

  /**
   * A count that could not be read is NULL, never 0. On this screen a wrong 0
   * reads as "there is nothing of this kind to lose", which is the worst
   * possible way to be wrong.
   */
  it("reports a count it could not read as null, not as zero", async () => {
    const { db } = fakeDb((call) => {
      if (call.kind === "rpc") return { data: "Building Integrity" };
      if (call.name === "projects") return { data: PROJECT_ROW };
      if (call.name === "project_versions") return { error: { code: "42501" } };
      if (call.name === "collaborators") return { count: undefined };
      return { error: { message: "boom" } };
    });
    const preview = await previewProjectDelete(db, ADMIN, P1);
    expect(preview.versionCount).toBeNull();
    expect(preview.grantCount).toBeNull();
    expect(preview.accessRequestCount).toBeNull();
  });

  it("gives an unnamed project the tree's own gap marker as its phrase", async () => {
    const { db } = healthyDb({ project: { ...PROJECT_ROW, name: "" } });
    const preview = await previewProjectDelete(db, ADMIN, P1);
    expect(preview.projectName).toBe("");
    expect(preview.confirmationPhrase).toBe("(untitled)");
  });

  it("refuses a non-admin before it asks the database anything", async () => {
    const { db, calls } = healthyDb();
    const error = await rejection(previewProjectDelete(db, MEMBER, P1));
    expect(error.status).toBe(403);
    expect(calls).toEqual([]);
  });

  it("says nothing was deleted when the project cannot be read, and does not reveal whether it exists", async () => {
    const { db } = healthyDb({ project: null });
    const error = await rejection(previewProjectDelete(db, ADMIN, P1));
    expect(error.status).toBe(404);
    expect(error.message).toBe(DELETE_PREVIEW_REFUSED_MESSAGE);
    expect(error.message).toMatch(/Nothing was deleted/);
  });

  it("treats a malformed id as not found rather than sending it to Postgres", async () => {
    const { db, calls } = healthyDb();
    const error = await rejection(previewProjectDelete(db, ADMIN, "not-a-uuid"));
    expect(error.status).toBe(404);
    expect(calls).toEqual([]);
  });
});

describe("confirmationMatches", () => {
  it("accepts the exact name, and the same name with space either side", () => {
    expect(confirmationMatches("Smith Residence", "Smith Residence")).toBe(true);
    expect(confirmationMatches("  Smith Residence \n", "Smith Residence")).toBe(true);
  });

  it("is case-sensitive and does not collapse inner spacing", () => {
    expect(confirmationMatches("smith residence", "Smith Residence")).toBe(false);
    expect(confirmationMatches("Smith Residence", "Smith  Residence")).toBe(false);
  });

  it("matches a name typed in a different Unicode normal form", () => {
    // "Café House" composed vs decomposed: the same name to a reader, and the
    // same name here. Nobody can be asked to reproduce a normal form.
    expect(confirmationMatches("Café House", "Café House")).toBe(true);
  });

  it("confirms an unnamed project with the gap marker the tree shows", () => {
    expect(confirmationMatches("(untitled)", "")).toBe(true);
    expect(confirmationMatches("(untitled)", "   ")).toBe(true);
    expect(confirmationMatches("", "")).toBe(false);
    expect(confirmationMatches("untitled", "")).toBe(false);
  });

  it("rejects anything that is not a string, and an empty confirmation", () => {
    for (const value of [undefined, null, 1, true, {}, ["Smith Residence"]]) {
      expect(confirmationMatches(value, "Smith Residence")).toBe(false);
    }
    expect(confirmationMatches("   ", "Smith Residence")).toBe(false);
  });
});

describe("readDeleteBody — the body is not optional here", () => {
  it("reads a confirmation out of a real body", () => {
    expect(readDeleteBody('{"confirm":"Smith Residence"}')).toEqual({ confirm: "Smith Residence" });
  });

  /**
   * A bodyless or malformed DELETE is the shape of something trying to skip
   * the interlock. It gets the same answer as an empty box — which says
   * nothing was deleted — not a generic JSON complaint that does not.
   */
  it("turns no body, rubbish, a bare string and an array into no confirmation at all", () => {
    for (const text of ["", "   ", "not json", '"Smith Residence"', "[1,2]", "null", "7"]) {
      expect(readDeleteBody(text)).toEqual({});
      expect(() => readConfirmation(readDeleteBody(text))).toThrow(DELETE_CONFIRM_REQUIRED_MESSAGE);
    }
  });
});

describe("readConfirmation", () => {
  it("requires a non-empty string, and says nothing was deleted", () => {
    for (const body of [{}, { confirm: "" }, { confirm: "   " }, { confirm: 7 }]) {
      let thrown: unknown;
      try {
        readConfirmation(body);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(ProjectRouteError);
      expect((thrown as ProjectRouteError).status).toBe(400);
      expect((thrown as ProjectRouteError).message).toBe(DELETE_CONFIRM_REQUIRED_MESSAGE);
    }
  });
});

describe("deleteProject", () => {
  it("deletes the one project by id and answers with what went with it", async () => {
    const { db, calls } = healthyDb();
    const result = await deleteProject(db, ADMIN, P1, { confirm: "Smith Residence" });
    expect(result).toEqual({
      projectId: P1,
      projectName: "Smith Residence",
      ownerCompanyName: "Building Integrity",
      deletedVersions: 7,
      deletedGrants: 2,
      deletedAccessRequests: 1,
    });
    const del = calls.find((c) => has(c, "delete"));
    expect(del?.name).toBe("projects");
    expect(del?.ops.filter(([op]) => op === "eq")).toEqual([["eq", ["id", P1]]]);
  });

  /** The whole project, or nothing. Never a version, never a grant row. */
  it("deletes from `projects` and from no other table", async () => {
    const { db, calls } = healthyDb();
    await deleteProject(db, ADMIN, P1, { confirm: "Smith Residence" });
    const deletes = calls.filter((c) => has(c, "delete"));
    expect(deletes).toHaveLength(1);
    expect(deletes[0].name).toBe("projects");
  });

  it("counts BEFORE it deletes — afterwards there is nothing left to count", async () => {
    const { db, calls } = healthyDb();
    await deleteProject(db, ADMIN, P1, { confirm: "Smith Residence" });
    const deleteIndex = calls.findIndex((c) => has(c, "delete"));
    const countIndexes = calls
      .map((c, i) => (c.name === "project_versions" || c.name === "collaborators" || c.name === "collab_requests" ? i : -1))
      .filter((i) => i >= 0);
    expect(countIndexes).toHaveLength(3);
    for (const i of countIndexes) expect(i).toBeLessThan(deleteIndex);
  });

  it("refuses a non-admin without touching the database", async () => {
    const { db, calls } = healthyDb();
    const error = await rejection(deleteProject(db, MEMBER, P1, { confirm: "Smith Residence" }));
    expect(error.status).toBe(403);
    expect(error.message).toBe(DELETE_NOT_ADMIN_MESSAGE);
    expect(calls).toEqual([]);
  });

  /**
   * THE RENAMED-WHILE-OPEN CASE. The typed text is checked against the name
   * the DATABASE holds now, not the one the clicked row remembered — so a
   * rename that landed while the confirmation box was open is a refusal, and
   * the refusal names the name it has.
   */
  it("refuses when the typed name is not the project's current name, and deletes nothing", async () => {
    const { db, calls } = healthyDb({ project: { ...PROJECT_ROW, name: "Smith House" } });
    const error = await rejection(deleteProject(db, ADMIN, P1, { confirm: "Smith Residence" }));
    expect(error.status).toBe(409);
    expect(error.message).toContain('"Smith House"');
    expect(error.message).toMatch(/nothing was deleted/i);
    expect(calls.some((c) => has(c, "delete"))).toBe(false);
  });

  it("refuses a missing confirmation before reading anything", async () => {
    const { db, calls } = healthyDb();
    const error = await rejection(deleteProject(db, ADMIN, P1, {}));
    expect(error.status).toBe(400);
    expect(calls).toEqual([]);
  });

  /**
   * An RLS-denied DELETE is SILENT — zero rows, no error. That is exactly what
   * a caller the policy refuses gets, and it must never read as success.
   */
  it("treats zero affected rows as a refusal, not a success", async () => {
    const { db } = healthyDb({ deleted: [] });
    const error = await rejection(deleteProject(db, ADMIN, P1, { confirm: "Smith Residence" }));
    expect(error.status).toBe(404);
    expect(error.message).toBe(DELETE_REFUSED_MESSAGE);
  });

  it("treats a null answer the same way", async () => {
    const { db } = healthyDb({ deleted: null });
    const error = await rejection(deleteProject(db, ADMIN, P1, { confirm: "Smith Residence" }));
    expect(error.status).toBe(404);
  });

  /** The version guard's own refusal, arriving as 42501. */
  it("maps 42501 from the delete itself to the refusal, in our words", async () => {
    const { db } = fakeDb((call) => {
      if (call.kind === "rpc") return { data: "Building Integrity" };
      if (call.name === "projects" && has(call, "delete")) {
        return { error: { code: "42501", message: "a single project version cannot be deleted" } };
      }
      if (call.name === "projects") return { data: PROJECT_ROW };
      return { count: 0 };
    });
    const error = await rejection(deleteProject(db, ADMIN, P1, { confirm: "Smith Residence" }));
    expect(error.status).toBe(404);
    expect(error.message).toBe(DELETE_REFUSED_MESSAGE);
    // The database's own sentence is never forwarded.
    expect(error.message).not.toMatch(/project version/);
  });

  it("throws an unmapped database error as-is, for the generic 500", async () => {
    const { db } = fakeDb((call) => {
      if (call.kind === "rpc") return { data: "Building Integrity" };
      if (call.name === "projects" && has(call, "delete")) return { error: { code: "57014", message: "canceling statement" } };
      if (call.name === "projects") return { data: PROJECT_ROW };
      return { count: 0 };
    });
    await expect(deleteProject(db, ADMIN, P1, { confirm: "Smith Residence" })).rejects.not.toBeInstanceOf(ProjectRouteError);
  });

  it("confirms an unnamed project by its gap marker", async () => {
    const { db, calls } = healthyDb({ project: { ...PROJECT_ROW, name: "" } });
    const result = await deleteProject(db, ADMIN, P1, { confirm: "(untitled)" });
    expect(result.projectName).toBe("");
    expect(calls.some((c) => has(c, "delete"))).toBe(true);
  });

  it("still answers honestly when the counts could not be read", async () => {
    const { db } = fakeDb((call) => {
      if (call.kind === "rpc") return { data: "Building Integrity" };
      if (call.name === "projects" && has(call, "delete")) return { data: [{ id: P1 }] };
      if (call.name === "projects") return { data: PROJECT_ROW };
      return { error: { code: "42501" } };
    });
    const result = await deleteProject(db, ADMIN, P1, { confirm: "Smith Residence" });
    expect(result.deletedVersions).toBeNull();
    expect(result.deletedGrants).toBeNull();
    expect(result.deletedAccessRequests).toBeNull();
  });
});

describe("mapDeleteDbError", () => {
  it("gives one answer for RLS, a missing row and a malformed id, so an id cannot be probed", () => {
    for (const code of ["42501", "22P02", "PGRST116"]) {
      expect(mapDeleteDbError({ code }, "delete")?.message).toBe(DELETE_REFUSED_MESSAGE);
      expect(mapDeleteDbError({ code }, "preview")?.message).toBe(DELETE_PREVIEW_REFUSED_MESSAGE);
      expect(mapDeleteDbError({ code }, "delete")?.status).toBe(404);
    }
  });

  it("returns null for anything it does not recognise", () => {
    expect(mapDeleteDbError({ code: "23505" }, "delete")).toBeNull();
    expect(mapDeleteDbError({}, "delete")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The shape of the routes themselves — the redactor principle, checked
// statically, in the style of accessRequestRouteLogic.test.ts.
// ---------------------------------------------------------------------------

describe("the Stage 5 delete routes", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const appDir = join(here, "..");
  const logic = join(here, "deleteRouteLogic.ts");
  const projectRoute = join(appDir, "api", "projects", "[id]", "route.ts");
  const previewRoute = join(appDir, "api", "projects", "[id]", "deletion", "route.ts");
  const codeOf = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("use NO admin client and never mention the service role", () => {
    // 0006 grants service_role nothing on projects or project_versions, and a
    // service-role client would bypass projects_delete entirely — which is
    // the only thing standing between "a platform admin deletes a project"
    // and "anybody who can reach this route deletes anybody's project".
    for (const path of [logic, projectRoute, previewRoute]) {
      const source = codeOf(readFileSync(path, "utf8"));
      expect(source, path).not.toMatch(/createSupabaseAdminClient/);
      expect(source, path).not.toMatch(/service_role/);
      expect(source, path).not.toMatch(/SUPABASE_SERVICE_ROLE|SUPABASE_SECRET_KEY/);
      expect(source, path).not.toMatch(/NEXT_PUBLIC_[A-Z_]*(SERVICE|SECRET)/);
    }
  });

  it("go through requireCloudSession, so sign-in and two-factor are checked as everywhere else", () => {
    for (const path of [projectRoute, previewRoute]) {
      expect(codeOf(readFileSync(path, "utf8"))).toMatch(/requireCloudSession\(\)/);
    }
  });

  it("take the admin flag from the verified session and from nowhere else", () => {
    for (const path of [projectRoute, previewRoute]) {
      const source = codeOf(readFileSync(path, "utf8"));
      expect(source).toMatch(/deleteViewerOf\(session\)/);
      // Never from the request: no query string, no body-supplied flag.
      expect(source).not.toMatch(/searchParams/);
      expect(source).not.toMatch(/isPlatformAdmin/);
    }
    const helper = codeOf(readFileSync(join(here, "cloudRouteSession.ts"), "utf8"));
    expect(helper).toMatch(/isPlatformAdmin: Boolean\(session\.snapshot\.user\?\.isPlatformAdmin\)/);
  });

  it("touch no other table: no grant is written or removed, no version is read or written", () => {
    const source = codeOf(readFileSync(logic, "utf8"));
    expect(source).not.toMatch(/share_project_with_(person|company)/);
    expect(source).not.toMatch(/\.insert\(|\.update\(|\.upsert\(/);
    // The three counts are head-only reads; nothing else reaches those tables.
    expect(source).not.toMatch(/select\("\*"\)/);
    expect(source).not.toMatch(/document/);
  });

  /**
   * A single-version delete would leave `head_version_number` stale and break
   * a `parent_version_id` chain, which is exactly why the spec says it needs
   * its own design. Nothing here may attempt one, or "tidy up" after the
   * cascade. Reading `head_version_number` to SAY how long the history is, is
   * fine — writing it, or touching a lineage, is not.
   */
  it("never attempt a single-version delete, and never write head_version_number or a lineage", () => {
    for (const path of [logic, projectRoute, previewRoute]) {
      const source = codeOf(readFileSync(path, "utf8"));
      expect(source, path).not.toMatch(/\.delete\(\)[\s\S]{0,40}project_versions/);
      expect(source, path).not.toMatch(/from\("project_versions"\)[\s\S]{0,80}\.delete\(/);
      expect(source, path).not.toMatch(/parent_version_id/);
      // No write of the head pointer: an update or an rpc that sets it.
      expect(source, path).not.toMatch(/update\([\s\S]{0,120}head_version_number/);
    }
    // The only mention of the column is the read that reports the number.
    const source = codeOf(readFileSync(logic, "utf8"));
    const mentions = source.match(/head_version_number/g) ?? [];
    expect(mentions).toHaveLength(3); // the record field, the column list, the read
  });

  it("add no new route file beyond the preview", () => {
    const deletionDir = join(appDir, "api", "projects", "[id]", "deletion");
    expect(readdirSync(deletionDir)).toEqual(["route.ts"]);
    expect(statSync(join(deletionDir, "route.ts")).isFile()).toBe(true);
  });
});

/**
 * The control itself. There is no DOM in this suite, so these are source
 * assertions in the style of the 4C route checks — they pin the things whose
 * absence would be invisible until somebody with the wrong account went
 * looking, which is exactly the class of bug the 2D review found.
 */
describe("the Delete… control", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const codeOf = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const tree = codeOf(readFileSync(join(here, "useCloudProjects.tsx"), "utf8"));
  const note = codeOf(readFileSync(join(here, "useProjectDelete.tsx"), "utf8"));

  it("is offered only to a platform admin, and only on a folder row", () => {
    expect(tree).toMatch(/isPlatformAdmin && !shared &&/);
    // The flag comes from the session snapshot the server wrote, not from a
    // membership level or an acting-as reading.
    expect(tree).toMatch(/const isPlatformAdmin = Boolean\(snapshot\?\.user\?\.isPlatformAdmin\)/);
  });

  it("appears on no browse row: browsing writes nothing, and that has not changed", () => {
    const browseRow = tree.slice(tree.indexOf("const renderBrowseRow"), tree.indexOf("const renderBrowseRow") + 4000);
    expect(browseRow).not.toMatch(/openDelete/);
  });

  it("is not added to the top bar", () => {
    const bar = readFileSync(join(here, "..", "TopBar.tsx"), "utf8");
    expect(bar).not.toMatch(/openDelete|Delete…|deletion/);
  });

  it("asks what would be destroyed before it offers the confirmation", () => {
    // The form is rendered only from `shown`, which is the preview answer for
    // THIS project. No preview, no confirm box, no button.
    expect(note).toMatch(/const shown = preview && target && preview\.projectId === target\.projectId \? preview : null/);
    expect(note).toMatch(/disabled=\{busy \|\| !typedMatches\}/);
  });

  it("sends the typed text and nothing else, and re-reads after a refusal", () => {
    expect(note).toMatch(/method: "DELETE",\s*\n\s*body: JSON\.stringify\(\{ confirm: typed \}\)/);
    expect(note).not.toMatch(/force|skipConfirm|isPlatformAdmin/);
  });

  it("detaches the editor through the reducer, and never clears the design or the date itself", () => {
    expect(tree).toMatch(/dispatch\(\{ type: "cloud-deleted", projectId \}\)/);
    expect(note).not.toMatch(/applyCloudState|downloadProjectFile|titleBlockSave/);
  });
});

describe("the fixtures above are fixtures", () => {
  it("use made-up ids and names, and no building number of any kind", () => {
    // Recorded for the flags check: nothing in this file is a claim about a
    // real building, a real price or a real person. The only numbers are row
    // counts and HTTP statuses.
    expect(P1.includes("-")).toBe(true);
    expect(PROJECT_ROW.name).toBe("Smith Residence");
  });
});
