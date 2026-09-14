import { readJsonBody } from "@/app/auth/serverSession";
import { NO_STORE, cloudErrorResponse, requireCloudSession } from "@/app/cloud/cloudRouteSession";
import { renameProject } from "@/app/cloud/projectRouteLogic";

/**
 * POST /api/projects/[id]/rename — { name } -> rename_project (Stage 2C).
 * Appends a `kind = 'rename'` version: the head document with only
 * `state.projectName` replaced (Open Item 3). A project you cannot write is the
 * same 404 as one that does not exist.
 *
 * Next.js 16: `context.params` is a Promise.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireCloudSession();
    const body = await readJsonBody(request);
    const result = await renameProject(session.supabase, id, body);
    return Response.json(result, { status: 201, headers: NO_STORE });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
