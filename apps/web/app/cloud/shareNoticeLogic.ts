import type { SupabaseClient } from "@supabase/supabase-js";
import type { DismissShareNoticesResponse, PendingShareNoticesResponse, ShareNoticeRow } from "./cloudTypes";
import { ProjectRouteError } from "./projectRouteLogic";

/**
 * The logic behind Stage 3C's two routes, with the Supabase client passed in,
 * in the same shape as projectRouteLogic.ts and sharingRouteLogic.ts:
 *
 *   GET  /api/share-notices          listPendingShareNotices
 *   POST /api/share-notices/dismiss  dismissShareNotices
 *
 * NEITHER FUNCTION ACCEPTS AN ADMIN CLIENT. The session's JWT-bound client is
 * the only one, so 0008 is the access control: `pending_share_notices()` is
 * SECURITY INVOKER and filters by `auth.uid()` itself, and
 * `dismiss_share_notices()` checks `meets_required_aal()` before writing.
 * `authenticated` holds no insert or update on `share_notice_state`, so "Got
 * it" cannot be forged into anything but the server's own `now()`.
 *
 * No database message is ever forwarded: every mapped SQLSTATE gets our own
 * words, and anything unmapped is thrown as-is for errorResponse's generic 500.
 */

interface DbError {
  code?: string;
  message?: string;
}

export const SHARE_NOTICES_REFUSED_MESSAGE =
  "Couldn't check what's been shared with you. Your access may have changed; reload the page and try again.";

/**
 * A failed dismiss says plainly that the notice is still there. It must not
 * read as "cleared", because the server's `seen_through` did not move and the
 * same notices will be back on the next check.
 */
export const DISMISS_REFUSED_MESSAGE = "Couldn't clear those notices, so they're still here. Nothing was changed; try again.";

export type ShareNoticeOperation = "list" | "dismiss";

function refusalFor(operation: ShareNoticeOperation): ProjectRouteError {
  // 403, not 404: neither call names a project, so there is no id whose
  // existence could be given away by the difference.
  return operation === "list"
    ? new ProjectRouteError(403, SHARE_NOTICES_REFUSED_MESSAGE)
    : new ProjectRouteError(403, DISMISS_REFUSED_MESSAGE);
}

/**
 * 0008's SQLSTATEs, confirmed on local PostgreSQL 17.4 (stage3c probe):
 *   42501  dismiss_share_notices below the required assurance level, or with
 *          no auth.uid(): "sign in (and finish two-factor) to dismiss notices".
 *          `pending_share_notices` does not raise — it returns 0 rows — so this
 *          is reachable through the dismiss path, and kept for the read as a
 *          backstop.
 * Plus PostgREST's PGRST116 and 22P02, as the sharing routes map them.
 */
export function mapShareNoticeDbError(error: DbError, operation: ShareNoticeOperation): ProjectRouteError | null {
  switch (error.code) {
    case "42501":
    case "22P02":
    case "PGRST116":
      return refusalFor(operation);
    default:
      return null;
  }
}

function fail(error: DbError, operation: ShareNoticeOperation): never {
  throw mapShareNoticeDbError(error, operation) ?? error;
}

/** The record as `pending_share_notices()` returns it. */
interface NoticeRecord {
  grant_id: string;
  project_id: string;
  project_name: string;
  owner_company_name: string | null;
  granted_by_name: string | null;
  grantee_kind: string;
  grantee_name: string;
  created_at: string;
}

/**
 * Every `shared` grant that reaches the caller and is newer than their own
 * `seen_through`, oldest first (0008 orders by `created_at`, then `id`).
 *
 * WHO IS EXCLUDED IS THE DATABASE'S ANSWER, NOT THIS FUNCTION'S. 0008 already
 * drops creator grants, grants you made yourself, and company grants made
 * before your membership began — the last of these through
 * `m.created_at < c.created_at`, which means someone who joins a company today
 * is not told about last year's shares as news. They still see those projects
 * in Shared with us; confirmed locally, where a member who joined after the
 * grant read 0 notices and 2 shared projects.
 *
 * A row whose `grantee_kind` is neither `person` nor `company` is skipped
 * rather than guessed at, the same way listSharedProjects skips an unknown
 * folder.
 */
export async function listPendingShareNotices(db: SupabaseClient): Promise<PendingShareNoticesResponse> {
  const { data, error } = await db.rpc("pending_share_notices");
  if (error) fail(error, "list");
  const notices: ShareNoticeRow[] = [];
  for (const r of (data ?? []) as NoticeRecord[]) {
    if (r.grantee_kind !== "person" && r.grantee_kind !== "company") continue;
    notices.push({
      grantId: r.grant_id,
      projectId: r.project_id,
      projectName: r.project_name,
      ownerCompanyName: r.owner_company_name ?? "",
      grantedByName: r.granted_by_name ?? null,
      granteeKind: r.grantee_kind,
      granteeName: r.grantee_name,
      createdAt: r.created_at,
    });
  }
  return { notices };
}

/**
 * "Got it". Stores the SERVER's `now()` in `share_notice_state`, which is why a
 * second computer is cleared too: the high-water mark is a row, not a cookie or
 * anything held in this browser.
 *
 * THE ACCEPTED RACE (3A review, recorded in the spec): a grant's `created_at`
 * is its sharing transaction's start time, so a share still committing when Got
 * it is pressed can end up not newer than the `seen_through` this writes, and
 * that one notice is never shown. Reproduced deliberately on local PostgreSQL
 * 17.4. It is accepted rather than fixed because the project still appears in
 * Shared with us, which is the durable signal — and the notice says so.
 */
export async function dismissShareNotices(db: SupabaseClient): Promise<DismissShareNoticesResponse> {
  const { error } = await db.rpc("dismiss_share_notices");
  if (error) fail(error, "dismiss");
  return { dismissed: true };
}
