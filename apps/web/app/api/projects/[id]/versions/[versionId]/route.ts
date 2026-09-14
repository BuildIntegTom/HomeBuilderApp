import { NO_STORE, cloudErrorResponse, requireCloudSession } from "@/app/cloud/cloudRouteSession";
import { getVersion } from "@/app/cloud/projectRouteLogic";

/**
 * GET /api/projects/[id]/versions/[versionId] — one version with its document.
 * Unreadable and nonexistent are the same 404, so the route cannot be used to
 * learn whether another company's project id exists. This URL pasted into
 * another company's browser is hand-test step 2: 404 and no document.
 *
 * Next.js 16: `context.params` is a Promise.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string; versionId: string }> }) {
  try {
    const { id, versionId } = await context.params;
    const session = await requireCloudSession();
    const result = await getVersion(session.supabase, id, versionId);
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
