import { readJsonBody } from "@/app/auth/serverSession";
import { NO_STORE, cloudErrorResponse, requireCloudSession } from "@/app/cloud/cloudRouteSession";
import { moveProject } from "@/app/cloud/projectRouteLogic";

/**
 * PATCH /api/projects/[id] — { folder }. Moving between folders is filing: it
 * creates no version and changes nothing about who can see the project
 * (decision 12). Zero affected rows is a 404, because an RLS-denied UPDATE is
 * silent. There is no DELETE here, or anywhere in Stage 2 (decision 13).
 *
 * Next.js 16: `context.params` is a Promise.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireCloudSession();
    const body = await readJsonBody(request);
    const result = await moveProject(session.supabase, id, body);
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
