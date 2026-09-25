import { readJsonBody } from "@/app/auth/serverSession";
import { NO_STORE, cloudErrorResponse, requireCloudSession } from "@/app/cloud/cloudRouteSession";
import { requestProjectAccess } from "@/app/cloud/accessRequestRouteLogic";

/**
 * POST /api/projects/[id]/access-requests — ask this project's owner company
 * for access (Stage 4C). Body: `{ message?: string }`, at most 500 characters.
 *
 * `request_project_access` is SECURITY DEFINER and decides everything for
 * itself against `auth.uid()`: seed entitlement, the project being in the
 * caller's browse set, `meets_required_aal()`, and whether the caller can
 * already read it. This route validates the id, caps the note, and turns the
 * answer into a sentence.
 *
 * EVERY ANSWER IS A STATUS, NOT AN ERROR — Stage 3's convention. `requested`
 * is 201; `already-pending` (which writes NOTHING) and `already-has-access`
 * are 200 with their own words. A project outside the browse set is one
 * uniform 404 that reads the same as a project that does not exist, so asking
 * cannot be used to probe for project ids, and it is never a reason to try
 * another route.
 *
 * Next.js 16: `context.params` is a Promise.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireCloudSession();
    const body = await readJsonBody(request);
    const result = await requestProjectAccess(session.supabase, id, body);
    return Response.json(result, { status: result.status === "requested" ? 201 : 200, headers: NO_STORE });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
