import { readJsonBody } from "@/app/auth/serverSession";
import { NO_STORE, cloudErrorResponse, deleteViewerOf, requireCloudSession } from "@/app/cloud/cloudRouteSession";
import { deleteProject, readDeleteBody } from "@/app/cloud/deleteRouteLogic";
import { moveProject } from "@/app/cloud/projectRouteLogic";

/**
 * PATCH /api/projects/[id] — { folder }. Moving between folders is filing: it
 * creates no version and changes nothing about who can see the project
 * (decision 12). Zero affected rows is a 404, because an RLS-denied UPDATE is
 * silent. Stage 2 had no DELETE anywhere (decision 13); Stage 5 adds the one
 * below, for a platform admin and a whole project only.
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

/**
 * DELETE /api/projects/[id] — PERMANENT, and the whole project (Stage 5,
 * first slice; decision 13: only a platform admin can permanently delete).
 *
 * The body carries `{ confirm }`, the project's name typed out. That is an
 * interlock against deleting the wrong project, checked against the name the
 * DATABASE holds at that moment — not a permission check. The permission is
 * `projects_delete` (0006), `using (public.is_platform_admin())`, and the
 * version cascade is admitted only by `refuse_project_version_change`. This
 * route holds the caller's own JWT-bound client and no admin client, so a
 * caller the policy refuses deletes zero rows and gets a 404.
 *
 * SINGLE-VERSION DELETE IS NOT HERE AND IS NOT COMING FROM THIS ROUTE. It
 * would leave `head_version_number` stale and break a `parent_version_id`
 * chain, and the spec says it needs its own design.
 */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireCloudSession();
    // Not readJsonBody: a bodyless or malformed DELETE must read as "you did
    // not confirm", which says nothing was deleted, rather than as a generic
    // JSON complaint that does not.
    const body = readDeleteBody(await request.text());
    const result = await deleteProject(session.supabase, deleteViewerOf(session), id, body);
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
