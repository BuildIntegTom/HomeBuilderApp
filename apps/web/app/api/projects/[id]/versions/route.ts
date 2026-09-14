import { readJsonBody } from "@/app/auth/serverSession";
import { NO_STORE, cloudErrorResponse, requireCloudSession } from "@/app/cloud/cloudRouteSession";
import { listVersions, saveVersion } from "@/app/cloud/projectRouteLogic";

/**
 * GET  /api/projects/[id]/versions — Version history (Stage 2C). Metadata
 *      only: number, kind, label, author name, time, schema version, parent.
 *      `document` is never selected. Unreadable and nonexistent are the same
 *      404, so another company's project id cannot be probed.
 * POST /api/projects/[id]/versions — { parentVersionId, label?, document }
 *      -> save_project_version. Returns the new version plus `diverged` and the
 *      intervening versions' number, author and time, for the divergence notice.
 *
 * No acting-as check on either: an existing project is governed by its own
 * ownership, not by the switcher (spec, "Acting-as"). RLS decides.
 *
 * Next.js 16: `context.params` is a Promise.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireCloudSession();
    const result = await listVersions(session.supabase, id);
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireCloudSession();
    const body = await readJsonBody(request);
    const result = await saveVersion(session.supabase, id, body);
    return Response.json(result, { status: 201, headers: NO_STORE });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
