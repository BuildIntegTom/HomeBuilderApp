import { NO_STORE, cloudErrorResponse, requireCloudSession } from "@/app/cloud/cloudRouteSession";
import { revokeShareLink } from "@/app/cloud/shareLinkRouteLogic";

/**
 * DELETE /api/share-links/[id] — turn a link off.
 *
 * ⚠ It REVOKES; it does not delete. `revoke_share_link` stamps `revoked_at`
 * and the row stays, which is why this route exists under a DELETE verb and
 * still leaves something behind. That is 0011's choice and the right one: the
 * links list is a record of who was given access and by whom, and a deleted
 * row would take the claims with it (`via_link_id` is `on delete set null`),
 * quietly orphaning grants that are still live.
 *
 * ⚠ Revoking a link does NOT remove the grants already claimed through it.
 * Somebody who already opened the link keeps their access until that grant is
 * removed on the access list. Revoking stops NEW claims. The UI has to say so
 * — a person who revokes a link expecting to have cut off the people holding
 * it would be wrong, and would not find out.
 *
 * The id is a link id, not a project id, so this route does not live under
 * /api/projects: a link is revoked by its creator or by the owning company,
 * and `revoke_share_link` resolves the project itself. Routing it through a
 * project id would invite a caller to pass a project they can read and a link
 * they cannot.
 *
 * Next.js 16: `context.params` is a Promise.
 */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireCloudSession();
    const result = await revokeShareLink(session.supabase, id);
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
