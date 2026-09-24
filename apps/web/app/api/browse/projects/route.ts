import { NO_STORE, cloudErrorResponse, requireCloudSession } from "@/app/cloud/cloudRouteSession";
import { browseProjects } from "@/app/cloud/browseRouteLogic";

/**
 * GET /api/browse/projects?company=&folder= — the browse set, optionally
 * narrowed to one member company and one folder (Stage 4B).
 *
 * Listing columns only: `browse_projects` selects no document at all. Each row
 * carries `access`, which is `full` when the caller can already read the
 * project (membership, a grant, or platform admin) and `redacted` otherwise —
 * decided in the database by `can_read_project`, which 0009 calls and does not
 * widen.
 */
export async function GET(request: Request) {
  try {
    const session = await requireCloudSession();
    const params = new URL(request.url).searchParams;
    const result = await browseProjects(session.supabase, params.get("company"), params.get("folder"));
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
