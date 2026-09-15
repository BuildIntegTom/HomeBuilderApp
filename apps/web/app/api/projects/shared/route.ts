import { NO_STORE, cloudErrorResponse, requireCloudSession } from "@/app/cloud/cloudRouteSession";
import { listSharedProjects } from "@/app/cloud/sharingRouteLogic";

/**
 * GET /api/projects/shared — the "Shared with us" tab (Stage 3B).
 * `list_shared_projects(<verified acting-as id, or null>)`: your personal
 * grants under any acting-as company, plus grants to the company you are acting
 * as, minus that company's own projects when its folder tabs list them. Listing
 * columns only; the function never selects `document`.
 *
 * The acting-as id comes from loadSession, which re-verifies the cookie against
 * real memberships on every request. No admin client.
 */
export async function GET() {
  try {
    const session = await requireCloudSession();
    const result = await listSharedProjects(session.supabase, session.actingAs);
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
