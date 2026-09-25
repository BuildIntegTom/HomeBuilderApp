import type { SupabaseClient } from "@supabase/supabase-js";
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
  askNoteTooLongMessage,
} from "./browseDisplay";
import {
  ASK_STATUSES,
  DECIDE_STATUSES,
  GRANTING_DECIDE_STATUSES,
  type AccessRequestStatus,
  type AskForAccessResponse,
  type AskStatus,
  type DecideAccessRequestResponse,
  type DecideStatus,
  type MyAccessRequestRow,
  type MyAccessRequestsResponse,
  type PendingAccessRequestRow,
} from "./cloudTypes";
import { ProjectRouteError, isUuid, type Body } from "./projectRouteLogic";

/**
 * Stage 4C: `collab_requests` end to end — the one thing in Stage 4 that
 * writes. The Supabase client is passed in, the same arrangement
 * `browseRouteLogic.ts` and `projectRouteLogic.ts` have, so the route files can
 * keep `next/headers` to themselves and the unit tests can drive a mock.
 *
 * FIVE RULES THIS FILE EXISTS TO KEEP:
 *
 * 1. **⚠ `decided_by` NEVER REACHES THE CLIENT.** `collab_requests_select`
 *    lets a requester read their own rows, `decided_by` included, and 4A's
 *    review recorded that it is harmless in the database — a uuid identifies
 *    nobody — but that 4C is where it would be forwarded without thinking.
 *    So it is not in the response shapes, it is not in the column lists here,
 *    and `accessRequestRouteLogic.test.ts` asserts on the column strings AND
 *    on a serialized response built from a row that carries one.
 *
 * 2. **The session client only. No admin client, ever.** Both write functions
 *    are SECURITY DEFINER and check the caller — seed entitlement and the
 *    browse set for asking, membership of the OWNER company for deciding —
 *    against `auth.uid()`. A service-role client would make every one of those
 *    checks pass for anybody. Asserted by reading the route files.
 *
 * 3. **A refusal is final: it never falls back to another route.** 42501 on
 *    either path is one uniform answer covering "no such thing" and "not
 *    yours", so neither can be used to probe which ids exist, and neither is a
 *    reason to try a different request. `mapAccessRequestDbError` maps; nothing
 *    retries.
 *
 * 4. **No database text is surfaced.** Every mapped SQLSTATE gets our own
 *    words; anything unmapped is rethrown and becomes a 500 with no Postgres
 *    message in it. Ids are validated first, and a malformed one reads exactly
 *    like "not found".
 *
 * 5. **Nothing here widens what browsing shows.** The requester's own list
 *    resolves project and company names against `browse_projects()` — the
 *    browse surface itself — and shows nothing for a project that has left
 *    that set. A request is not a way to learn about a project, a company or a
 *    person beyond what 4B already shows.
 *
 * AND THE ONE THING THIS FILE DOES NOT DO: it never writes a `collaborators`
 * row. `decide_collab_request` calls `share_project_with_person` inside the
 * database, so a granted request IS an ordinary Stage 3 grant, and the Shared
 * with us tab, the 3C notice, the access list and the backup rule all already
 * understand it. There is no second grant-writing path in this stage.
 */

interface DbError {
  code?: string;
  message?: string;
}

export type AccessRequestOperation = "ask" | "decide" | "mine" | "pending";

/**
 * Explicit columns, never `*`, and `decided_by` is absent from both on purpose.
 * A `select("*")` here would pull the uuid into the route's hands, where the
 * next person to add a field to the response would find it already loaded.
 */
export const MY_REQUEST_COLUMNS = "id, project_id, message, status, created_at, decided_by_name, decided_at";
export const PENDING_REQUEST_COLUMNS = "id, requested_by_name, message, created_at";

/**
 * 0009's SQLSTATEs, read off the migration's own RAISE statements:
 *   42501  request_project_access: "project not found, or you cannot ask about
 *          it" — not entitled, not in the browse set, or no such project, all
 *          one answer. decide_collab_request: "request not found, or you
 *          cannot decide it" — not an owner member, not a platform admin, or
 *          no such request. Also raised by both below the required assurance
 *          level.
 *   22023  request_project_access: a note over 500 characters.
 *          decide_collab_request: `p_grant` was null.
 *   23514  either: an account with no name or email to snapshot, or (deciding)
 *          the requester's account could not be found, or the grant did not
 *          reach the requester. In every one of those NOTHING was written.
 * Plus PostgREST's PGRST116 (`.single()` with no row) and 22P02 (not a uuid —
 * checked up front, this is the backstop).
 */
export function mapAccessRequestDbError(error: DbError, operation: AccessRequestOperation): ProjectRouteError | null {
  switch (error.code) {
    case "42501":
    case "22P02":
    case "PGRST116":
      if (operation === "ask") return new ProjectRouteError(404, ASK_REFUSED_MESSAGE);
      if (operation === "decide") return new ProjectRouteError(404, DECIDE_REFUSED_MESSAGE);
      // A list refused is not a 404: the list exists, this account may not have it.
      return new ProjectRouteError(403, MY_REQUESTS_REFUSED_MESSAGE);
    case "22023":
      // No length in this one: the route caps the note before sending, so
      // getting here means the length is not in hand, and naming one would be
      // inventing it.
      return operation === "ask"
        ? new ProjectRouteError(400, ASK_NOTE_TOO_LONG_MESSAGE)
        : new ProjectRouteError(400, DECIDE_GRANT_REQUIRED_MESSAGE);
    case "23514":
      return operation === "ask"
        ? new ProjectRouteError(409, ASK_UNATTRIBUTABLE_MESSAGE)
        : new ProjectRouteError(409, DECIDE_UNATTRIBUTABLE_MESSAGE);
    default:
      // Unmapped: rethrown as-is, which errorResponse turns into a 500 without
      // echoing a Postgres message.
      return null;
  }
}

function fail(error: DbError, operation: AccessRequestOperation): never {
  throw mapAccessRequestDbError(error, operation) ?? error;
}

// ---------------------------------------------------------------------------
// POST /api/projects/[id]/access-requests  — asking
// ---------------------------------------------------------------------------

/**
 * The note, checked here as well as in the database. Both checks are real:
 * ours gives the person a sentence that names the length, and 0009's
 * `collab_requests_message_length` is what actually holds — this one runs in a
 * browser-facing route and could be gone around.
 *
 * A blank note is `null`, never an empty string: the constraint is 1–500, so
 * an empty string would be refused by the database as if something were wrong.
 */
export function readRequestNote(body: Body): string | null {
  const value = body.message;
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new ProjectRouteError(400, "A request note has to be text. Nothing was sent.");
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > REQUEST_NOTE_MAX_CHARS) throw new ProjectRouteError(400, askNoteTooLongMessage(trimmed.length));
  return trimmed;
}

export async function requestProjectAccess(db: SupabaseClient, projectIdParam: string, body: Body): Promise<AskForAccessResponse> {
  // Malformed reads exactly like "not found, or you can't ask about it", which
  // is the same answer 0009 gives for a project outside the browse set.
  if (!isUuid(projectIdParam)) throw new ProjectRouteError(404, ASK_REFUSED_MESSAGE);
  const message = readRequestNote(body);

  const { data, error } = await db.rpc("request_project_access", { p_project: projectIdParam, p_message: message }).single();
  if (error) fail(error, "ask");
  const reply = data as { status: string; request_id: string | null } | null;
  if (!reply || !(ASK_STATUSES as readonly string[]).includes(reply.status)) {
    // An unexpected status is a bug, not an answer to show: a generic 500
    // beats inventing a sentence about what the database may have written.
    throw new Error(`unexpected access-request status ${reply?.status ?? "none"}`);
  }
  const status = reply.status as AskStatus;
  return {
    status,
    // The caller's own pending row. `already-has-access` wrote nothing and
    // there is no row to name.
    requestId: status === "already-has-access" ? null : (reply.request_id ?? null),
    message: ASK_STATUS_MESSAGE[status],
  };
}

// ---------------------------------------------------------------------------
// POST /api/access-requests/[id]  — deciding
// ---------------------------------------------------------------------------

/** `{ grant: true }` or `{ grant: false }`. Nothing else, and never a default:
 * guessing which way a decision went is not a mistake to make quietly. */
export function readGrantDecision(body: Body): boolean {
  const value = body.grant;
  if (typeof value !== "boolean") throw new ProjectRouteError(400, DECIDE_GRANT_REQUIRED_MESSAGE);
  return value;
}

export async function decideAccessRequest(db: SupabaseClient, requestIdParam: string, body: Body): Promise<DecideAccessRequestResponse> {
  if (!isUuid(requestIdParam)) throw new ProjectRouteError(404, DECIDE_REFUSED_MESSAGE);
  const grant = readGrantDecision(body);

  const { data, error } = await db.rpc("decide_collab_request", { p_request: requestIdParam, p_grant: grant }).single();
  if (error) fail(error, "decide");
  const reply = data as { status: string; grant_id: string | null } | null;
  if (!reply || !(DECIDE_STATUSES as readonly string[]).includes(reply.status)) {
    throw new Error(`unexpected decision status ${reply?.status ?? "none"}`);
  }
  const status = reply.status as DecideStatus;
  // `grant_id` is deliberately NOT forwarded: the access list is re-read after
  // a decision and carries the grant with everything else about it, so there is
  // nothing for an id on its own to do here.
  return { status, granted: GRANTING_DECIDE_STATUSES.includes(status), message: DECIDE_STATUS_MESSAGE[status] };
}

// ---------------------------------------------------------------------------
// GET /api/access-requests  — the requester's own list
// ---------------------------------------------------------------------------

interface MyRequestRecord {
  id: string;
  project_id: string;
  message: string | null;
  status: string;
  created_at: string;
  decided_by_name: string | null;
  decided_at: string | null;
}

function isAccessRequestStatus(value: unknown): value is AccessRequestStatus {
  return value === "pending" || value === "granted" || value === "declined";
}

/**
 * Project and owner names for the requester's list, from `browse_projects()`
 * AND NOWHERE ELSE.
 *
 * This is the rule "nothing here may widen what browsing shows", made
 * structural rather than remembered: the only source of a name is the same
 * function the browse tab reads, so a project that has left the browse set
 * (its owner left the consortium, or this account's entitlement changed) comes
 * back nameless and is shown as one. Reading `projects` directly would answer
 * for a granted project too — which is not wider today, but would be the line
 * crossed the first time somebody widened either policy.
 *
 * Enrichment only. A failure here is not a failure of the list: the requests
 * are still shown, without names. `browse_projects` returns NO ROWS (not an
 * error) to a caller who is not seed-entitled.
 */
async function browseNames(db: SupabaseClient): Promise<Map<string, { name: string; ownerCompanyName: string }>> {
  const names = new Map<string, { name: string; ownerCompanyName: string }>();
  try {
    const { data, error } = await db.rpc("browse_projects", { p_company: null, p_folder: null });
    if (error) return names;
    for (const row of (data ?? []) as { project_id: string; name: string; owner_company_name: string }[]) {
      names.set(row.project_id, { name: row.name, ownerCompanyName: row.owner_company_name });
    }
  } catch {
    return names;
  }
  return names;
}

/**
 * YOUR OWN requests, newest first.
 *
 * ⚠ THE `requested_by` FILTER IS LOAD-BEARING, not tidiness.
 * `collab_requests_select` also lets an owner member and a platform admin read
 * every request on their own company's projects, so without it this "your
 * requests" list would quietly become "every request I can see" for exactly the
 * people who should be reading them in the Access… note instead. The id comes
 * from the verified session, never from the request.
 */
export async function listMyAccessRequests(db: SupabaseClient, userId: string): Promise<MyAccessRequestsResponse> {
  if (!isUuid(userId)) throw new ProjectRouteError(403, MY_REQUESTS_REFUSED_MESSAGE);

  const { data, error } = await db
    .from("collab_requests")
    .select(MY_REQUEST_COLUMNS)
    .eq("requested_by", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) fail(error, "mine");
  const records = (data ?? []) as MyRequestRecord[];
  if (records.length === 0) return { requests: [] };

  const names = await browseNames(db);
  const requests: MyAccessRequestRow[] = [];
  for (const r of records) {
    // A status outside the three would mean a row the check constraint should
    // have refused; it is dropped rather than shown as something invented.
    if (!isAccessRequestStatus(r.status)) continue;
    const known = names.get(r.project_id) ?? null;
    requests.push({
      requestId: r.id,
      projectId: r.project_id,
      projectName: known?.name ?? null,
      ownerCompanyName: known?.ownerCompanyName ?? null,
      message: r.message,
      status: r.status,
      createdAt: r.created_at,
      decidedAt: r.decided_at,
      // ⚠ `decided_by_name` — the snapshot — and never `decided_by`, the
      // auth.users id of a person at another company.
      decidedByName: r.decided_by_name,
    });
  }
  return { requests };
}

// ---------------------------------------------------------------------------
// The owner's side, inside the existing GET /api/projects/[id]/access
// ---------------------------------------------------------------------------

interface PendingRequestRecord {
  id: string;
  requested_by_name: string;
  message: string | null;
  created_at: string;
}

/**
 * The PENDING requests on one project, oldest first, for the existing Access…
 * note. Called only when the viewer is owner-side; `collab_requests_select`
 * is the gate underneath, and `decide_collab_request` checks the decider
 * again for itself.
 *
 * Only `pending`: a decided request is the requester's own business and is on
 * their list, not a standing entry on somebody else's project. A failure is
 * swallowed to an empty list rather than taking the whole access list down
 * with it — the grants are the point of that note, and a missing request row
 * is not a reason to hide who can already open the project.
 */
export async function listPendingRequests(db: SupabaseClient, projectId: string): Promise<PendingAccessRequestRow[]> {
  if (!isUuid(projectId)) return [];
  try {
    const { data, error } = await db
      .from("collab_requests")
      .select(PENDING_REQUEST_COLUMNS)
      .eq("project_id", projectId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (error) return [];
    return ((data ?? []) as PendingRequestRecord[]).map((r) => ({
      requestId: r.id,
      requestedByName: r.requested_by_name,
      message: r.message,
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}
