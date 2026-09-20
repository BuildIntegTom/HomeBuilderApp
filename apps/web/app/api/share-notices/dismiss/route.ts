import { NO_STORE, cloudErrorResponse, requireCloudSession } from "@/app/cloud/cloudRouteSession";
import { dismissShareNotices } from "@/app/cloud/shareNoticeLogic";

/**
 * POST /api/share-notices/dismiss — "Got it" (Stage 3C, answer 7).
 * `dismiss_share_notices()` upserts the SERVER's `now()` into
 * `share_notice_state`, which is what clears a second computer too.
 *
 * It takes NO BODY, deliberately: there is nothing for the client to choose.
 * The high-water mark is the server's clock, and `authenticated` holds no
 * insert or update on that table (confirmed locally), so a browser cannot
 * propose a time of its own — only ask for now().
 *
 * A failure here is reported as a failure: the route never answers "dismissed"
 * unless the write really happened, so the notice stays on screen.
 */
export async function POST() {
  try {
    const session = await requireCloudSession();
    const result = await dismissShareNotices(session.supabase);
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
