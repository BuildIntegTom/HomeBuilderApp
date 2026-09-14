import { readJsonBody } from "@/app/auth/serverSession";
import { NO_STORE, cloudErrorResponse, requireCloudSession } from "@/app/cloud/cloudRouteSession";
import { createProject, listProjects } from "@/app/cloud/projectRouteLogic";

/**
 * GET  /api/projects?folder=  — the verified acting-as company's projects in
 *                               one folder. Listing columns only; never the
 *                               document.
 * POST /api/projects          — { expectedCompanyId, folder, label?, document }
 *                               -> create_project. 409 when the acting-as
 *                               company changed under the dialog, 403 for a
 *                               consortium entitlement or no company.
 *
 * Spec: "Stage 2 plan", Routes and Acting-as. The acting-as company comes from
 * `loadSession`, which re-verifies the cookie against real memberships on every
 * request; the client's claim is only ever compared against it.
 */
export async function GET(request: Request) {
  try {
    const session = await requireCloudSession();
    const folder = new URL(request.url).searchParams.get("folder") ?? undefined;
    const result = await listProjects(session.supabase, session.actingAs, folder);
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireCloudSession();
    const body = await readJsonBody(request);
    const result = await createProject(session.supabase, session.actingAs, body);
    return Response.json(result, { status: 201, headers: NO_STORE });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
