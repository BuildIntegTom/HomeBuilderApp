import { NO_STORE, cloudErrorResponse, requireCloudSession } from "@/app/cloud/cloudRouteSession";
import { listPendingShareNotices } from "@/app/cloud/shareNoticeLogic";

/**
 * GET /api/share-notices — the in-app notice (Stage 3C, answer 7).
 * `pending_share_notices()`: every `shared` grant that reaches you and is newer
 * than your own `seen_through`, oldest first. Metadata only; the function never
 * selects `document` and returns no user ids.
 *
 * WHO IS NEVER NOTIFIED IS DECIDED HERE AND AGAIN BELOW.
 * `requireCloudSession()` refuses a guest (401) and an account whose two-factor
 * is still pending (401) before any query, and 0004's restrictive policy means
 * a password-only session on an enrolled account reads nothing anyway —
 * confirmed locally, where the same call at aal1 returned 0 rows and at aal2
 * returned them all. No admin client.
 */
export async function GET() {
  try {
    const session = await requireCloudSession();
    const result = await listPendingShareNotices(session.supabase);
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
