import { readJsonBody } from "@/app/auth/serverSession";
import { NO_STORE, cloudErrorResponse, requireCloudSession } from "@/app/cloud/cloudRouteSession";
import { decideAccessRequest } from "@/app/cloud/accessRequestRouteLogic";

/**
 * POST /api/access-requests/[id] — grant or decline one request (Stage 4C).
 * Body: `{ grant: true }` or `{ grant: false }`, and nothing is assumed when
 * it is missing.
 *
 * GRANTING WRITES AN ORDINARY STAGE 3 GRANT AND NOTHING ELSE.
 * `decide_collab_request` calls `share_project_with_person` inside the
 * database, with `granted_by` = the decider, so what comes out is exactly the
 * grant the share box would have made: the Shared with us tab, the 3C notice,
 * the access list, the cascade offer and the backup rule all already
 * understand it. There is no second grant-writing path in this route or
 * anywhere in 4C.
 *
 * Who may decide is the database's business — any member of the OWNER company,
 * or a platform admin — and it checks for itself against `auth.uid()`. A
 * request that does not exist and one this account may not decide are one
 * uniform 404, and it is final: it is never a reason to try another route.
 *
 * Next.js 16: `context.params` is a Promise.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireCloudSession();
    const body = await readJsonBody(request);
    const result = await decideAccessRequest(session.supabase, id, body);
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
