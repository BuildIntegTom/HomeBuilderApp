import { NO_STORE, cloudErrorResponse, requireCloudSession } from "@/app/cloud/cloudRouteSession";
import { listMyAccessRequests } from "@/app/cloud/accessRequestRouteLogic";

/**
 * GET /api/access-requests — the signed-in person's OWN access requests
 * (Stage 4C): pending, granted and declined, newest first.
 *
 * ⚠ `decided_by` IS NOT SERVED. The requester can read it on their own row
 * through `collab_requests_select`, and it is harmless in the database, but
 * forwarding it would hand a browser an `auth.users` id for a person at
 * another company. The list carries `status`, `decidedAt` and the
 * `decided_by_name` snapshot, and stops there ("Two narrowings", item 4).
 *
 * The rows are filtered by `requested_by` against the VERIFIED session id,
 * never a request parameter — that policy also serves owner members and
 * platform admins every request on their own projects, and those belong in the
 * project's Access… note, not in "your requests".
 *
 * Project and owner names are resolved against `browse_projects()` and nothing
 * else, so this list can never name a project the browse tab would not.
 */
export async function GET() {
  try {
    const session = await requireCloudSession();
    const result = await listMyAccessRequests(session.supabase, session.snapshot.user?.id ?? "");
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
