import { NO_STORE, cloudErrorResponse, deleteViewerOf, requireCloudSession } from "@/app/cloud/cloudRouteSession";
import { previewProjectDelete } from "@/app/cloud/deleteRouteLogic";

/**
 * GET /api/projects/[id]/deletion — what permanently deleting this project
 * would destroy (Stage 5, first slice). It reads; it deletes nothing.
 *
 * Platform admin only, refused here from the VERIFIED session and refused
 * again by the database: `projects_delete` (0006) is `is_platform_admin()`,
 * and this route's reads go through the caller's own JWT-bound client.
 *
 * The counts are read now rather than guessed later, so the confirmation can
 * name what is at stake: the project, its versions, its shares and the access
 * requests made on it — the three tables that cascade off `projects`.
 *
 * Next.js 16: `context.params` is a Promise.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireCloudSession();
    const result = await previewProjectDelete(session.supabase, deleteViewerOf(session), id);
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
