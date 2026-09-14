import { readJsonBody } from "@/app/auth/serverSession";
import { NO_STORE, cloudErrorResponse, requireCloudSession } from "@/app/cloud/cloudRouteSession";
import { saveVersion } from "@/app/cloud/projectRouteLogic";

/**
 * POST /api/projects/[id]/versions — { parentVersionId, label?, document }
 * -> save_project_version. Returns the new version plus `diverged` and the
 * intervening versions' number, author and time, for the divergence notice.
 *
 * No acting-as check: saving into an existing project is governed by that
 * project's ownership, not by the switcher (spec, "Acting-as"). The database
 * decides, under the project-row lock.
 *
 * The version LIST (GET) is Stage 2C and deliberately not here.
 *
 * Next.js 16: `context.params` is a Promise.
 */
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
