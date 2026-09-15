import { readJsonBody } from "@/app/auth/serverSession";
import { NO_STORE, cloudErrorResponse, requireCloudSession, sharingViewerOf } from "@/app/cloud/cloudRouteSession";
import { getProjectAccess, shareProject } from "@/app/cloud/sharingRouteLogic";

/**
 * GET  /api/projects/[id]/access — the access list (Stage 3B): the owner line,
 *      with the owner's name through `project_owner_company_name`, and one row
 *      per grant, oldest first. Unreadable and nonexistent are the same 404.
 * POST /api/projects/[id]/access — `{ kind: "person", email }` or
 *      `{ kind: "company", companyId }` -> share_project_with_person /
 *      share_project_with_company. `shared` is 201; every other status is 200
 *      with its message. 42501 ("not found, or you cannot share it") is 404.
 *
 * Next.js 16: `context.params` is a Promise.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireCloudSession();
    const result = await getProjectAccess(session.supabase, sharingViewerOf(session), id);
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
    const result = await shareProject(session.supabase, id, body);
    return Response.json(result, { status: result.status === "shared" ? 201 : 200, headers: NO_STORE });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
