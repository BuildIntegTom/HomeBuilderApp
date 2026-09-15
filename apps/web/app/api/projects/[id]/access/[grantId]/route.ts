import { NO_STORE, cloudErrorResponse, requireCloudSession } from "@/app/cloud/cloudRouteSession";
import { parseOptionalJsonBody, removeGrant } from "@/app/cloud/sharingRouteLogic";

/**
 * DELETE /api/projects/[id]/access/[grantId] — remove one grant (Stage 3B).
 *
 * Deletes a row of `collaborators` through RLS (collaborators_delete): any
 * owner-company member or platform admin removes any grant; anyone else only a
 * grant they made. ZERO ROWS IS 404, "You can remove only the shares you made,
 * or this share is already gone. Nothing was changed."
 *
 * This removes a GRANT. Nothing here can delete a project or a version
 * (decision 13), and the owner company's access is not a row (answer 14).
 *
 * Optional body `{ alsoRemove: [grantId, …] }`: the pre-ticked "also remove the
 * shares they made" offer (Open Item 1), for a personal grant only. No body is
 * fine.
 *
 * Next.js 16: `context.params` is a Promise.
 */
export async function DELETE(request: Request, context: { params: Promise<{ id: string; grantId: string }> }) {
  try {
    const { id, grantId } = await context.params;
    const session = await requireCloudSession();
    const body = parseOptionalJsonBody(await request.text());
    const result = await removeGrant(session.supabase, id, grantId, body);
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
