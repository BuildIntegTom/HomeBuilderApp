import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { ProjectRouteError } from "./projectRouteLogic";
import {
  DISMISS_REFUSED_MESSAGE,
  SHARE_NOTICES_REFUSED_MESSAGE,
  dismissShareNotices,
  listPendingShareNotices,
  mapShareNoticeDbError,
} from "./shareNoticeLogic";

// The same chainable stand-in as sharingRouteLogic.test.ts.
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

const P1 = "c2aba1e8-9393-44af-a9d0-872819a14263";
const P2 = "a9ff174a-21c6-4972-bced-7e92cab3f7ea";
const G1 = "c206eead-31f0-4fd2-9675-14c36398732b";
const G2 = "400bcf6f-f95c-4e9f-886b-7d50a17a947f";
const AT = "2026-09-20T12:13:28.972611-05:00";

/** A row exactly as pending_share_notices() returned it locally. */
const record = (over: Record<string, unknown> = {}) => ({
  grant_id: G1,
  project_id: P1,
  project_name: "Smith House",
  owner_company_name: "Building Integrity",
  granted_by_name: "Mia Member",
  grantee_kind: "person",
  grantee_name: "Rory Rare",
  created_at: AT,
  ...over,
});

describe("GET /api/share-notices", () => {
  it("calls pending_share_notices, which takes no acting-as and no arguments", async () => {
    const { db, calls } = fakeDb(() => ({ data: [] }));
    await listPendingShareNotices(db);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ kind: "rpc", name: "pending_share_notices" });
    expect(calls[0].args).toBeUndefined();
  });

  it("reads no table itself: the function is the whole query", async () => {
    const { db, calls } = fakeDb(() => ({ data: [record()] }));
    await listPendingShareNotices(db);
    expect(calls.filter((c) => c.kind === "from")).toHaveLength(0);
  });

  it("maps the columns the database really returns", async () => {
    const { db } = fakeDb(() => ({ data: [record()] }));
    expect(await listPendingShareNotices(db)).toEqual({
      notices: [
        {
          grantId: G1,
          projectId: P1,
          projectName: "Smith House",
          ownerCompanyName: "Building Integrity",
          grantedByName: "Mia Member",
          granteeKind: "person",
          granteeName: "Rory Rare",
          createdAt: AT,
        },
      ],
    });
  });

  it("keeps the database's oldest-first order", async () => {
    const { db } = fakeDb(() => ({
      data: [record(), record({ grant_id: G2, project_id: P2, project_name: "Jones House", created_at: "2026-09-20T13:00:00.000000-05:00" })],
    }));
    const result = await listPendingShareNotices(db);
    expect(result.notices.map((n) => n.projectName)).toEqual(["Smith House", "Jones House"]);
  });

  it("carries a company grant's kind and the company's name", async () => {
    const { db } = fakeDb(() => ({ data: [record({ grantee_kind: "company", grantee_name: "Rare Forms" })] }));
    const [notice] = (await listPendingShareNotices(db)).notices;
    expect(notice.granteeKind).toBe("company");
    expect(notice.granteeName).toBe("Rare Forms");
  });

  it("turns an unreadable owner name into an empty string for the display's gap, not a crash", async () => {
    const { db } = fakeDb(() => ({ data: [record({ owner_company_name: null })] }));
    expect((await listPendingShareNotices(db)).notices[0].ownerCompanyName).toBe("");
  });

  it("keeps a null sharer name null rather than inventing one", async () => {
    const { db } = fakeDb(() => ({ data: [record({ granted_by_name: null })] }));
    expect((await listPendingShareNotices(db)).notices[0].grantedByName).toBeNull();
  });

  it("skips a row whose grantee kind is neither person nor company rather than guessing", async () => {
    const { db } = fakeDb(() => ({ data: [record(), record({ grant_id: G2, grantee_kind: "creator" })] }));
    const result = await listPendingShareNotices(db);
    expect(result.notices).toHaveLength(1);
    expect(result.notices[0].grantId).toBe(G1);
  });

  it("answers an empty list as no notices, not as an error", async () => {
    const { db } = fakeDb(() => ({ data: null }));
    expect(await listPendingShareNotices(db)).toEqual({ notices: [] });
  });

  it("refuses with 403 and our own words when the database says 42501", async () => {
    const { db } = fakeDb(() => ({ error: { code: "42501", message: "permission denied for function pending_share_notices" } }));
    const error = await rejection(listPendingShareNotices(db));
    expect(error.status).toBe(403);
    expect(error.message).toBe(SHARE_NOTICES_REFUSED_MESSAGE);
  });

  it("never forwards the database's own message", async () => {
    const { db } = fakeDb(() => ({ error: { code: "42501", message: "permission denied for relation collaborators" } }));
    const error = await rejection(listPendingShareNotices(db));
    expect(error.message).not.toContain("collaborators");
    expect(error.message).not.toContain("permission denied");
  });

  it("rethrows an unmapped database error as-is, for the generic 500", async () => {
    const raw = { code: "08006", message: "connection failure" };
    const { db } = fakeDb(() => ({ error: raw }));
    await expect(listPendingShareNotices(db)).rejects.toBe(raw);
  });
});

describe("POST /api/share-notices/dismiss", () => {
  it("calls dismiss_share_notices with no arguments: the time is the server's", async () => {
    const { db, calls } = fakeDb(() => ({ data: null }));
    await dismissShareNotices(db);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ kind: "rpc", name: "dismiss_share_notices" });
    expect(calls[0].args).toBeUndefined();
  });

  it("never writes share_notice_state directly", async () => {
    const { db, calls } = fakeDb(() => ({ data: null }));
    await dismissShareNotices(db);
    expect(calls.some((c) => c.kind === "from")).toBe(false);
  });

  it("confirms a real dismissal, so the browser can tell success from an empty body", async () => {
    const { db } = fakeDb(() => ({ data: null }));
    expect(await dismissShareNotices(db)).toEqual({ dismissed: true });
  });

  it("refuses with 403 when two-factor is pending or the session is gone", async () => {
    const { db } = fakeDb(() => ({ error: { code: "42501", message: "sign in (and finish two-factor) to dismiss notices" } }));
    const error = await rejection(dismissShareNotices(db));
    expect(error.status).toBe(403);
    expect(error.message).toBe(DISMISS_REFUSED_MESSAGE);
  });

  it("says the notices are still there, and claims nothing was changed", async () => {
    expect(DISMISS_REFUSED_MESSAGE).toContain("still here");
    expect(DISMISS_REFUSED_MESSAGE).toContain("Nothing was changed");
  });

  it("does not forward the database's two-factor wording", async () => {
    const { db } = fakeDb(() => ({ error: { code: "42501", message: "sign in (and finish two-factor) to dismiss notices" } }));
    const error = await rejection(dismissShareNotices(db));
    expect(error.message).not.toContain("sign in (and finish two-factor)");
  });

  it("rethrows an unmapped error as-is", async () => {
    const raw = { code: "57014", message: "canceling statement due to statement timeout" };
    const { db } = fakeDb(() => ({ error: raw }));
    await expect(dismissShareNotices(db)).rejects.toBe(raw);
  });
});

describe("the SQLSTATE mapping itself", () => {
  it("maps the three PostgREST/Postgres codes the sharing routes map, per operation", () => {
    for (const code of ["42501", "22P02", "PGRST116"]) {
      expect(mapShareNoticeDbError({ code }, "list")?.status).toBe(403);
      expect(mapShareNoticeDbError({ code }, "list")?.message).toBe(SHARE_NOTICES_REFUSED_MESSAGE);
      expect(mapShareNoticeDbError({ code }, "dismiss")?.message).toBe(DISMISS_REFUSED_MESSAGE);
    }
  });

  it("maps nothing else, so an unknown failure cannot be dressed up as a refusal", () => {
    expect(mapShareNoticeDbError({ code: "23514" }, "list")).toBeNull();
    expect(mapShareNoticeDbError({ code: "21000" }, "dismiss")).toBeNull();
    expect(mapShareNoticeDbError({}, "list")).toBeNull();
  });
});
