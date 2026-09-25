import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  ASK_NOTE_TOO_LONG_MESSAGE,
  ASK_REFUSED_MESSAGE,
  ASK_STATUS_MESSAGE,
  ASK_UNATTRIBUTABLE_MESSAGE,
  DECIDE_GRANT_REQUIRED_MESSAGE,
  DECIDE_REFUSED_MESSAGE,
  DECIDE_STATUS_MESSAGE,
  DECIDE_UNATTRIBUTABLE_MESSAGE,
  MY_REQUESTS_REFUSED_MESSAGE,
  REQUEST_NOTE_MAX_CHARS,
  browseRowRequestState,
  myRequestStatusLine,
} from "./browseDisplay";
import {
  MY_REQUEST_COLUMNS,
  PENDING_REQUEST_COLUMNS,
  decideAccessRequest,
  listMyAccessRequests,
  listPendingRequests,
  mapAccessRequestDbError,
  readGrantDecision,
  readRequestNote,
  requestProjectAccess,
} from "./accessRequestRouteLogic";
import { ProjectRouteError } from "./projectRouteLogic";

// The same chainable stand-in browseRouteLogic.test.ts and
// projectRouteLogic.test.ts drive, so a query's whole shape — table, columns,
// filters and terminal — is inspectable after the fact.
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

const P1 = "240320ca-651c-4f2e-bf95-f97346d0fd51";
const P2 = "8f1f3b9a-0c2e-49ab-9b1c-6f9a9a0b1c2d";
const REQ1 = "0a95472c-79f6-42e4-b059-e907aa1549c1";
const ME = "5b2f1a44-2f8e-4b3a-9d21-6b7f0c8e1a33";
const RF_ID = "22222222-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// Asking
// ---------------------------------------------------------------------------

describe("asking for access", () => {
  it("sends the project id and the trimmed note, and answers `requested`", async () => {
    const { db, calls } = fakeDb(() => ({ data: { status: "requested", request_id: REQ1 } }));
    const result = await requestProjectAccess(db, P1, { message: "  Could we see this one?  " });
    expect(result).toEqual({ status: "requested", requestId: REQ1, message: ASK_STATUS_MESSAGE.requested });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      kind: "rpc",
      name: "request_project_access",
      args: { p_project: P1, p_message: "Could we see this one?" },
      terminal: "single",
    });
  });

  /**
   * Stage 3's convention, and Tommy's own decision: a second pending request
   * ANSWERS, it does not fail. 0009 writes nothing in that case (its insert is
   * `on conflict … do nothing`) and names the first request, so the status is
   * shown as an answer and the existing row's id comes back.
   */
  it("answers `already-pending` and names the request that is already open", async () => {
    const { db, calls } = fakeDb(() => ({ data: { status: "already-pending", request_id: REQ1 } }));
    const result = await requestProjectAccess(db, P1, {});
    expect(result).toEqual({ status: "already-pending", requestId: REQ1, message: ASK_STATUS_MESSAGE["already-pending"] });
    expect(result.message).toMatch(/Nothing was sent again/);
    // One call. Nothing retried, nothing "fixed up" by asking a second way.
    expect(calls).toHaveLength(1);
  });

  it("answers `already-has-access` with no request id, because nothing was written", async () => {
    const { db } = fakeDb(() => ({ data: { status: "already-has-access", request_id: null } }));
    expect(await requestProjectAccess(db, P1, {})).toEqual({
      status: "already-has-access",
      requestId: null,
      message: ASK_STATUS_MESSAGE["already-has-access"],
    });
  });

  it("drops a request id the database sent back beside `already-has-access`", async () => {
    // Defensive: that status means nothing was written, so there is no row for
    // an id to name. It is not passed on whatever came back beside it.
    const { db } = fakeDb(() => ({ data: { status: "already-has-access", request_id: REQ1 } }));
    expect((await requestProjectAccess(db, P1, {})).requestId).toBeNull();
  });

  it("sends null rather than an empty string for a blank note", async () => {
    // collab_requests_message_length is `1–500`, so an empty string would be
    // refused by the database as though something had gone wrong.
    const { db, calls } = fakeDb(() => ({ data: { status: "requested", request_id: REQ1 } }));
    await requestProjectAccess(db, P1, { message: "   " });
    expect(calls[0].args).toMatchObject({ p_message: null });
  });

  it("a malformed project id reads exactly like a project you cannot ask about, and sends nothing", async () => {
    const { db, calls } = fakeDb(() => ({ data: null }));
    const error = await rejection(requestProjectAccess(db, "not-a-uuid", {}));
    expect(error.status).toBe(404);
    expect(error.message).toBe(ASK_REFUSED_MESSAGE);
    expect(calls).toHaveLength(0);
  });

  it("an unexpected status is a bug, not a sentence: it is never shown", async () => {
    const { db } = fakeDb(() => ({ data: { status: "granted", request_id: REQ1 } }));
    await expect(requestProjectAccess(db, P1, {})).rejects.toThrow(/unexpected access-request status/);
  });
});

describe("the 500-character cap on a request note", () => {
  it("is 500, the database's own number", () => {
    expect(REQUEST_NOTE_MAX_CHARS).toBe(500);
  });

  it("accepts a note of exactly 500 characters", async () => {
    const note = "x".repeat(500);
    const { db, calls } = fakeDb(() => ({ data: { status: "requested", request_id: REQ1 } }));
    await requestProjectAccess(db, P1, { message: note });
    expect(calls[0].args).toMatchObject({ p_message: note });
  });

  it("refuses 501 characters BEFORE sending anything, and says the length", async () => {
    const { db, calls } = fakeDb(() => ({ data: null }));
    const error = await rejection(requestProjectAccess(db, P1, { message: "x".repeat(501) }));
    expect(error.status).toBe(400);
    expect(error.message).toMatch(/at most 500 characters/);
    expect(error.message).toMatch(/501/);
    expect(error.message).toMatch(/Nothing was sent/);
    expect(calls).toHaveLength(0);
  });

  it("counts the TRIMMED note, so trailing spaces do not push a good note over", () => {
    expect(readRequestNote({ message: `${"x".repeat(500)}     ` })).toHaveLength(500);
  });

  it("refuses a note that is not text at all", () => {
    expect(() => readRequestNote({ message: 42 })).toThrow(ProjectRouteError);
  });

  it("treats a missing note as no note", () => {
    expect(readRequestNote({})).toBeNull();
    expect(readRequestNote({ message: null })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Deciding
// ---------------------------------------------------------------------------

describe("deciding a request", () => {
  it("grants through decide_collab_request, and reports the share's own status", async () => {
    const { db, calls } = fakeDb(() => ({ data: { status: "shared", grant_id: REQ1 } }));
    const result = await decideAccessRequest(db, REQ1, { grant: true });
    expect(result).toEqual({ status: "shared", granted: true, message: DECIDE_STATUS_MESSAGE.shared });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ kind: "rpc", name: "decide_collab_request", args: { p_request: REQ1, p_grant: true } });
  });

  /**
   * THE RULE THIS STAGE TURNS ON: a granted request is an ORDINARY STAGE 3
   * GRANT. `decide_collab_request` writes it by calling
   * `share_project_with_person` inside the database, so nothing in the app
   * writes a `collaborators` row of its own — asserted here on behaviour (only
   * one call, and it is the decide function) and below on the source.
   */
  it("writes no grant of its own: one call, and it is not share_project_with_person", async () => {
    const { db, calls } = fakeDb(() => ({ data: { status: "shared", grant_id: REQ1 } }));
    await decideAccessRequest(db, REQ1, { grant: true });
    expect(calls.map((c) => c.name)).toEqual(["decide_collab_request"]);
    expect(calls.some((c) => c.kind === "from" && c.name === "collaborators")).toBe(false);
  });

  it("declines, and says plainly that nothing was shared", async () => {
    const { db, calls } = fakeDb(() => ({ data: { status: "declined", grant_id: null } }));
    const result = await decideAccessRequest(db, REQ1, { grant: false });
    expect(result).toEqual({ status: "declined", granted: false, message: DECIDE_STATUS_MESSAGE.declined });
    expect(result.message).toMatch(/no reason attached/);
    expect(calls[0].args).toMatchObject({ p_grant: false });
  });

  it.each([
    ["already-shared", true],
    ["already-member", true],
    ["self", true],
    ["already-granted", false],
    ["already-declined", false],
  ] as const)("reports %s as granted=%s", async (status, granted) => {
    const { db } = fakeDb(() => ({ data: { status, grant_id: null } }));
    const result = await decideAccessRequest(db, REQ1, { grant: true });
    expect(result.status).toBe(status);
    expect(result.granted).toBe(granted);
    expect(result.message).toBe(DECIDE_STATUS_MESSAGE[status]);
  });

  it("will not guess which way a decision went", async () => {
    const { db, calls } = fakeDb(() => ({ data: null }));
    const error = await rejection(decideAccessRequest(db, REQ1, {}));
    expect(error.status).toBe(400);
    expect(error.message).toBe(DECIDE_GRANT_REQUIRED_MESSAGE);
    expect(calls).toHaveLength(0);
    expect(() => readGrantDecision({ grant: "yes" })).toThrow(ProjectRouteError);
  });

  it("a malformed request id reads exactly like a request you cannot decide", async () => {
    const { db, calls } = fakeDb(() => ({ data: null }));
    const error = await rejection(decideAccessRequest(db, "nope", { grant: true }));
    expect(error.status).toBe(404);
    expect(error.message).toBe(DECIDE_REFUSED_MESSAGE);
    expect(calls).toHaveLength(0);
  });

  it("never forwards the grant id: the access list carries the grant, not this answer", async () => {
    const { db } = fakeDb(() => ({ data: { status: "shared", grant_id: REQ1 } }));
    expect(Object.keys(await decideAccessRequest(db, REQ1, { grant: true })).sort()).toEqual(["granted", "message", "status"]);
  });
});

// ---------------------------------------------------------------------------
// ⚠ decided_by
// ---------------------------------------------------------------------------

/**
 * 4A's review found that a requester can read `decided_by` on their own row,
 * and recorded that 4C is where it would be forwarded without thinking. It is
 * an `auth.users` id for a person at another company, and nothing else in this
 * app hands one out. These are the assertions that keep it server-side.
 */
describe("decided_by never reaches the client", () => {
  const DECIDER = "9c3e7d21-4f5a-4c2b-8e9f-1a2b3c4d5e6f";

  const rowWithDecider = {
    id: REQ1,
    project_id: P1,
    message: "please",
    status: "declined",
    created_at: "2026-09-24T10:00:00.000Z",
    decided_by_name: "Dana at Rare Forms",
    decided_at: "2026-09-24T11:00:00.000Z",
    // Present in the reply even though the column list did not ask for it:
    // the point is that the mapping never copies it, not that PostgREST is
    // trusted to withhold it.
    decided_by: DECIDER,
  };

  it("is absent from the column list the route asks for", () => {
    expect(MY_REQUEST_COLUMNS).not.toMatch(/decided_by\b(?!_name)/);
    expect(MY_REQUEST_COLUMNS).toContain("decided_by_name");
    expect(PENDING_REQUEST_COLUMNS).not.toMatch(/decided_by/);
    // Never a wildcard: `*` would pull it into the route's hands, where the
    // next person to add a field would find it already loaded.
    expect(MY_REQUEST_COLUMNS).not.toContain("*");
    expect(PENDING_REQUEST_COLUMNS).not.toContain("*");
  });

  it("is absent from the requester's list even when the database sends it anyway", async () => {
    const { db } = fakeDb((call) => (call.kind === "from" ? { data: [rowWithDecider] } : { data: [] }));
    const result = await listMyAccessRequests(db, ME);
    expect(result.requests).toHaveLength(1);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(DECIDER);
    expect(serialized).not.toContain("decidedBy\"");
    expect(Object.keys(result.requests[0]).sort()).toEqual([
      "createdAt",
      "decidedAt",
      "decidedByName",
      "message",
      "ownerCompanyName",
      "projectId",
      "projectName",
      "requestId",
      "status",
    ]);
    // What IS served: status, when, and the name snapshot.
    expect(result.requests[0]).toMatchObject({ status: "declined", decidedByName: "Dana at Rare Forms" });
  });

  it("is absent from the owner's pending list too", async () => {
    const { db } = fakeDb(() => ({
      data: [{ id: REQ1, requested_by_name: "Mo", message: null, created_at: "2026-09-24T10:00:00.000Z", decided_by: DECIDER }],
    }));
    const rows = await listPendingRequests(db, P1);
    expect(JSON.stringify(rows)).not.toContain(DECIDER);
    expect(Object.keys(rows[0]).sort()).toEqual(["createdAt", "message", "requestId", "requestedByName"]);
  });

  it("is named nowhere in the response shapes, asserted on the source", () => {
    const types = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "cloudTypes.ts"), "utf8");
    // Only as `decidedByName`, and only in comments as `decided_by`.
    expect(types).not.toMatch(/^\s*decidedBy\??:/m);
  });
});

// ---------------------------------------------------------------------------
// The requester's own list
// ---------------------------------------------------------------------------

describe("the requester's own list", () => {
  const row = (over: Partial<Record<string, unknown>> = {}) => ({
    id: REQ1,
    project_id: P1,
    message: null,
    status: "pending",
    created_at: "2026-09-24T10:00:00.000Z",
    decided_by_name: null,
    decided_at: null,
    ...over,
  });

  it("asks only for the signed-in account's own rows", async () => {
    const { db, calls } = fakeDb((call) => (call.kind === "from" ? { data: [row()] } : { data: [] }));
    await listMyAccessRequests(db, ME);
    const table = calls.find((c) => c.kind === "from");
    expect(table?.name).toBe("collab_requests");
    // ⚠ Load-bearing: collab_requests_select ALSO serves an owner member every
    // request on their own company's projects. Without this filter, "your
    // requests" would silently become "every request I can see" for exactly
    // the people who should read them in the Access… note instead.
    expect(table?.ops).toContainEqual(["eq", ["requested_by", ME]]);
  });

  it("names a project only through browse_projects — never through `projects`", async () => {
    const { db, calls } = fakeDb((call) =>
      call.kind === "from"
        ? { data: [row()] }
        : { data: [{ project_id: P1, name: "Smith House", owner_company_name: "Rare Forms" }] },
    );
    const result = await listMyAccessRequests(db, ME);
    expect(result.requests[0]).toMatchObject({ projectName: "Smith House", ownerCompanyName: "Rare Forms" });
    expect(calls.map((c) => c.name)).toEqual(["collab_requests", "browse_projects"]);
    expect(calls.some((c) => c.kind === "from" && c.name === "projects")).toBe(false);
  });

  /**
   * "Nothing here may widen what browsing shows", made structural. A project
   * that has left the browse set comes back NAMELESS, because the only source
   * of a name is the same function the browse tab reads.
   */
  it("shows no name at all for a project that has left the browse set", async () => {
    const { db } = fakeDb((call) => (call.kind === "from" ? { data: [row({ project_id: P2 })] } : { data: [] }));
    const result = await listMyAccessRequests(db, ME);
    expect(result.requests[0]).toMatchObject({ projectId: P2, projectName: null, ownerCompanyName: null });
  });

  it("does not go looking for names when there is nothing to name", async () => {
    const { db, calls } = fakeDb(() => ({ data: [] }));
    expect(await listMyAccessRequests(db, ME)).toEqual({ requests: [] });
    expect(calls.map((c) => c.name)).toEqual(["collab_requests"]);
  });

  it("keeps the requests when the name lookup fails, rather than losing the list", async () => {
    const { db } = fakeDb((call) => (call.kind === "from" ? { data: [row()] } : { error: { code: "42501" } }));
    const result = await listMyAccessRequests(db, ME);
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0].projectName).toBeNull();
  });

  it("drops a row whose status is not one of the three", async () => {
    const { db } = fakeDb((call) => (call.kind === "from" ? { data: [row({ status: "withdrawn" })] } : { data: [] }));
    expect((await listMyAccessRequests(db, ME)).requests).toEqual([]);
  });

  it("refuses without a signed-in id, and asks the database nothing", async () => {
    const { db, calls } = fakeDb(() => ({ data: [] }));
    const error = await rejection(listMyAccessRequests(db, ""));
    expect(error.status).toBe(403);
    expect(error.message).toBe(MY_REQUESTS_REFUSED_MESSAGE);
    expect(calls).toHaveLength(0);
  });
});

describe("the owner's pending list", () => {
  it("asks for this project's PENDING requests, oldest first", async () => {
    const { db, calls } = fakeDb(() => ({ data: [] }));
    await listPendingRequests(db, P1);
    expect(calls[0].ops).toContainEqual(["eq", ["project_id", P1]]);
    // A decided request is the requester's own business and is on their list,
    // not a standing entry on somebody else's project.
    expect(calls[0].ops).toContainEqual(["eq", ["status", "pending"]]);
    expect(calls[0].ops).toContainEqual(["order", ["created_at", { ascending: true }]]);
  });

  it("is an empty list, not a failure, when the read is refused", async () => {
    // The grants are the point of the Access… note; a missing request row is
    // no reason to hide who can already open the project.
    const { db } = fakeDb(() => ({ error: { code: "42501" } }));
    expect(await listPendingRequests(db, P1)).toEqual([]);
  });

  it("asks nothing at all for a malformed project id", async () => {
    const { db, calls } = fakeDb(() => ({ data: [] }));
    expect(await listPendingRequests(db, "nope")).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Error mapping — 4B's discipline, kept
// ---------------------------------------------------------------------------

describe("refusals are final, and carry none of the database's words", () => {
  it("maps 42501 to one uniform answer per path", () => {
    expect(mapAccessRequestDbError({ code: "42501" }, "ask")).toMatchObject({ status: 404, message: ASK_REFUSED_MESSAGE });
    expect(mapAccessRequestDbError({ code: "42501" }, "decide")).toMatchObject({ status: 404, message: DECIDE_REFUSED_MESSAGE });
    expect(mapAccessRequestDbError({ code: "42501" }, "mine")).toMatchObject({ status: 403, message: MY_REQUESTS_REFUSED_MESSAGE });
  });

  it("maps a not-a-uuid and an empty .single() the same way, so ids cannot be probed", () => {
    for (const code of ["22P02", "PGRST116"]) {
      expect(mapAccessRequestDbError({ code }, "ask")?.message).toBe(ASK_REFUSED_MESSAGE);
      expect(mapAccessRequestDbError({ code }, "decide")?.message).toBe(DECIDE_REFUSED_MESSAGE);
    }
  });

  it("maps 22023 and 23514 to our own words on each path", () => {
    // The database's own 22023 carries no length, and neither does this
    // message: the route caps the note before sending, so reaching here means
    // the length is not in hand and naming one would be inventing it.
    expect(mapAccessRequestDbError({ code: "22023" }, "ask")?.message).toBe(ASK_NOTE_TOO_LONG_MESSAGE);
    expect(ASK_NOTE_TOO_LONG_MESSAGE).toMatch(/at most 500 characters/);
    expect(ASK_NOTE_TOO_LONG_MESSAGE).not.toMatch(/\b501\b/);
    expect(mapAccessRequestDbError({ code: "22023" }, "decide")?.message).toBe(DECIDE_GRANT_REQUIRED_MESSAGE);
    expect(mapAccessRequestDbError({ code: "23514" }, "ask")?.message).toBe(ASK_UNATTRIBUTABLE_MESSAGE);
    expect(mapAccessRequestDbError({ code: "23514" }, "decide")?.message).toBe(DECIDE_UNATTRIBUTABLE_MESSAGE);
  });

  it("leaves an unmapped code alone, so no Postgres message reaches the screen", () => {
    expect(mapAccessRequestDbError({ code: "42P01", message: 'relation "collab_requests" does not exist' }, "ask")).toBeNull();
  });

  it("forwards no database text in any mapped message", () => {
    const raw = "duplicate key value violates unique constraint collab_requests_one_pending";
    for (const code of ["42501", "22023", "23514", "22P02", "PGRST116"]) {
      for (const op of ["ask", "decide", "mine", "pending"] as const) {
        const mapped = mapAccessRequestDbError({ code, message: raw }, op);
        if (mapped) expect(mapped.message).not.toContain("constraint");
      }
    }
  });

  /**
   * 4B's rule, kept: a refusal is FINAL. Neither path may reach for another
   * route when the database says no — the Stage 2 read hands over the
   * untouched stored document, and `share_project_with_person` called directly
   * would be a second grant-writing path.
   */
  it("makes no second call after a refusal, on either path", async () => {
    const asking = fakeDb(() => ({ error: { code: "42501" } }));
    await rejection(requestProjectAccess(asking.db, P1, {}));
    expect(asking.calls).toHaveLength(1);

    const deciding = fakeDb(() => ({ error: { code: "42501" } }));
    await rejection(decideAccessRequest(deciding.db, REQ1, { grant: true }));
    expect(deciding.calls).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// The words the requester and the owner actually read
// ---------------------------------------------------------------------------

describe("what a request says on screen", () => {
  it("a decline carries no reason — only that it was declined, by whom", () => {
    expect(myRequestStatusLine({ status: "declined", decidedByName: "Dana" })).toBe("Declined by Dana. No reason is recorded.");
    expect(myRequestStatusLine({ status: "declined", decidedByName: null })).toBe("Declined. No reason is recorded.");
    // Open Item 4, answered: no free-text reason exists to show.
    expect(myRequestStatusLine({ status: "declined", decidedByName: "Dana" })).not.toMatch(/because|reason:/i);
  });

  it("a granted request points at the ordinary Stage 3 machinery, not a new place", () => {
    expect(myRequestStatusLine({ status: "granted", decidedByName: "Dana" })).toMatch(/Shared with us/);
    expect(myRequestStatusLine({ status: "granted", decidedByName: null })).toMatch(/opens with its costs/);
  });

  it("a pending request says it is waiting, not that it failed", () => {
    expect(myRequestStatusLine({ status: "pending", decidedByName: null })).toBe("Waiting for an answer.");
  });

  it("offers no second ask while one is still pending", () => {
    const state = browseRowRequestState([{ projectId: P1, status: "pending" }], P1);
    expect(state.canAsk).toBe(false);
    expect(state.line).toMatch(/waiting for an answer/i);
  });

  it("allows a re-ask after a decline, and says the earlier one was declined", () => {
    const state = browseRowRequestState([{ projectId: P1, status: "declined" }], P1);
    expect(state.canAsk).toBe(true);
    expect(state.line).toMatch(/declined/i);
  });

  it("says where a granted project went", () => {
    expect(browseRowRequestState([{ projectId: P1, status: "granted" }], P1).line).toMatch(/Shared with us/);
  });

  it("says nothing about a project this account never asked about", () => {
    expect(browseRowRequestState([{ projectId: P2, status: "pending" }], P1)).toEqual({ line: null, canAsk: true });
    // Not loaded yet is not "no request": the ask is offered and the database
    // answers `already-pending` if there is one.
    expect(browseRowRequestState(null, P1)).toEqual({ line: null, canAsk: true });
  });

  it("a pending request anywhere in the list wins over a decided one on the same project", () => {
    const rows = [
      { projectId: P1, status: "declined" as const },
      { projectId: P1, status: "pending" as const },
    ];
    expect(browseRowRequestState(rows, P1).canAsk).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Route-level invariants, read off the source (the established style)
// ---------------------------------------------------------------------------

function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("the access-request routes", () => {
  const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
  const logic = join(appDir, "cloud", "accessRequestRouteLogic.ts");
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : [path];
    });
  const routes = [...files(join(appDir, "api", "access-requests")), join(appDir, "api", "projects", "[id]", "access-requests", "route.ts")];

  it("are exactly the three 4C needs", () => {
    const listed = files(join(appDir, "api", "access-requests"))
      .map((p) => p.slice(join(appDir, "api", "access-requests").length).replace(/\\/g, "/"))
      .sort();
    expect(listed).toEqual(["/[id]/route.ts", "/route.ts"]);
  });

  it("use NO admin client and never mention the service role", () => {
    // request_project_access and decide_collab_request are SECURITY DEFINER
    // and check auth.uid() for themselves — seed entitlement and the browse
    // set for asking, membership of the OWNER company for deciding. A
    // service-role client would make every one of those pass for anybody.
    for (const path of [...routes, logic]) {
      const source = codeOf(readFileSync(path, "utf8"));
      expect(source).not.toMatch(/createSupabaseAdminClient/);
      expect(source).not.toMatch(/service_role/);
      expect(source).not.toMatch(/SUPABASE_SERVICE_ROLE/);
    }
  });

  it("go through requireCloudSession, so sign-in and two-factor are checked as everywhere else", () => {
    for (const path of routes) expect(codeOf(readFileSync(path, "utf8"))).toMatch(/requireCloudSession\(\)/);
  });

  /**
   * THE NO-PARALLEL-MECHANISM ASSERTION. A granted request must become an
   * ordinary Stage 3 grant, written by `share_project_with_person` INSIDE
   * `decide_collab_request`. Nothing in 4C may write a `collaborators` row, and
   * nothing may call the share function directly to "help".
   */
  it("write no grant of their own, anywhere", () => {
    for (const path of [...routes, logic]) {
      const source = codeOf(readFileSync(path, "utf8"));
      expect(source).not.toMatch(/share_project_with_person/);
      expect(source).not.toMatch(/share_project_with_company/);
      expect(source).not.toMatch(/from\("collaborators"\)/);
    }
  });

  it("read no document, and borrow no Stage 2 or browse read", () => {
    for (const path of [...routes, logic]) {
      const source = codeOf(readFileSync(path, "utf8"));
      expect(source).not.toMatch(/from\("project_versions"\)/);
      expect(source).not.toMatch(/browse_version\b/);
      expect(source).not.toMatch(/\/api\/projects\/\$\{/);
      expect(source).not.toMatch(/backup/i);
    }
  });

  it("never select `decided_by` out of collab_requests", () => {
    const source = codeOf(readFileSync(logic, "utf8"));
    expect(source).not.toMatch(/select\("\*"\)/);
    expect(source).not.toMatch(/decided_by\b(?!_name)/);
  });

  it("the ask route answers `requested` with a 201 and every other status with a 200", () => {
    const source = readFileSync(join(appDir, "api", "projects", "[id]", "access-requests", "route.ts"), "utf8");
    expect(source).toMatch(/status === "requested" \? 201 : 200/);
    expect(codeOf(source)).not.toMatch(/export async function (GET|PUT|PATCH|DELETE)/);
  });

  it("the requester's list is a GET and the decision is a POST — nothing deletes a request", () => {
    const mine = codeOf(readFileSync(join(appDir, "api", "access-requests", "route.ts"), "utf8"));
    expect(mine).toMatch(/export async function GET/);
    expect(mine).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
    const decide = codeOf(readFileSync(join(appDir, "api", "access-requests", "[id]", "route.ts"), "utf8"));
    expect(decide).toMatch(/export async function POST/);
    expect(decide).not.toMatch(/export async function (GET|PUT|PATCH|DELETE)/);
  });

  it("the requester's list filters on the VERIFIED session id, never a request parameter", () => {
    const source = codeOf(readFileSync(join(appDir, "api", "access-requests", "route.ts"), "utf8"));
    expect(source).toMatch(/session\.snapshot\.user\?\.id/);
    expect(source).not.toMatch(/searchParams/);
  });
});

describe("the owner's side stays inside the existing Access… list", () => {
  const cloudDir = dirname(fileURLToPath(import.meta.url));

  it("is served by getProjectAccess, and only to an owner-side viewer", () => {
    const source = codeOf(readFileSync(join(cloudDir, "sharingRouteLogic.ts"), "utf8"));
    expect(source).toMatch(/ownerSide \? await listPendingRequests\(db, projectId\) : \[\]/);
  });

  it("puts nothing new on the top bar", () => {
    // 4C's surfaces are the browse tab, the banner note, the Ask note and the
    // existing Access… note. The bar is not touched.
    const bar = readFileSync(join(cloudDir, "..", "TopBar.tsx"), "utf8");
    expect(bar).not.toMatch(/access-requests/);
    expect(bar).not.toMatch(/Ask for access/);
  });
});

describe("the fixtures above are fixtures", () => {
  it("uses ids and names that are made up, and no building number of any kind", () => {
    // Recorded for the flags check: nothing in this file is a claim about a
    // real building, a real price or a real person. `500` is the database's
    // own character cap, which is administrative.
    expect([P1, P2, REQ1, ME, RF_ID].every((id) => id.includes("-"))).toBe(true);
    expect(REQUEST_NOTE_MAX_CHARS).toBe(500);
  });
});
