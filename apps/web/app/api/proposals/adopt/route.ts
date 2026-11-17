import { readJsonBody, requireString } from "@/app/auth/serverSession";
import { hashProposalToken } from "@/app/auth/proposalToken";
import { NO_STORE, cloudErrorResponse, requireCloudSession } from "@/app/cloud/cloudRouteSession";
import { adoptProposal } from "@/app/cloud/proposalRouteLogic";
import { requireToken } from "@/app/cloud/shareLinkRouteLogic";

/**
 * POST /api/proposals/adopt — the proposal becomes a real project.
 *
 * > *"and then adopt the project as their own and send a link for that new
 * > project with link invite."* — Tommy, 2026-11-08
 *
 * It lands in the **`proposals` folder**, which already exists in the schema's
 * own folder constraint and in the app's folder tabs — reused rather than
 * invented, because an adopted design arriving in `current` would be
 * indistinguishable from one the company drew itself.
 *
 * ⚠ **The company comes from the BODY and is checked in the database.**
 * `adopt_proposal` is `security definer`, so RLS is not doing the checking,
 * and it asks `is_member_of` itself — this route cannot talk it into writing
 * a project into a company the caller does not belong to. The body carries the
 * id rather than the route reading the acting-as cookie for the same reason
 * `/api/projects` takes `expectedCompanyId`: somebody with two companies open
 * in two tabs must land the design in the one they are looking at, and the
 * server answering "you are not a member of that" is better than it quietly
 * choosing.
 *
 * ⚠ **Adoption is ONCE.** The second caller gets a 409 naming the company that
 * got there first, not a second project — enforced inside the transaction by
 * re-reading the row `for update`, so two people pressing Adopt at the same
 * moment cannot both win.
 */
export async function POST(request: Request) {
  try {
    const session = await requireCloudSession();
    const body = await readJsonBody(request);
    const token = requireToken(body);
    const companyId = requireString(body, "companyId");
    const result = await adoptProposal(session.supabase, hashProposalToken(token), companyId);
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
