import { NO_STORE, cloudErrorResponse, requireCloudSession } from "@/app/cloud/cloudRouteSession";
import { browseCompanies } from "@/app/cloud/browseRouteLogic";

/**
 * GET /api/browse/companies — the consortium's member companies, by name
 * (Stage 4B). `browse_companies()` checks seed entitlement itself and returns a
 * caller who has none NO ROWS, so an empty list is a real answer rather than an
 * error to explain.
 *
 * The session's own JWT-bound client, as everywhere else on this path: the
 * browse functions are SECURITY DEFINER and read `auth.uid()`, so an admin
 * client would make every one of their checks pass for anybody. There is none
 * here, and none anywhere under /api/browse.
 */
export async function GET() {
  try {
    const session = await requireCloudSession();
    const result = await browseCompanies(session.supabase);
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
