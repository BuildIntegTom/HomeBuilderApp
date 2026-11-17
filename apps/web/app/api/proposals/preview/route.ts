import { HttpError, errorResponse, readJsonBody } from "@/app/auth/serverSession";
import { hashProposalToken } from "@/app/auth/proposalToken";
import { createSupabaseServerClient, isBackendConfigured } from "@/app/auth/supabaseServer";
import { ProjectRouteError } from "@/app/cloud/projectRouteLogic";
import { previewProposal } from "@/app/cloud/proposalRouteLogic";
import { requireToken } from "@/app/cloud/shareLinkRouteLogic";

/**
 * POST /api/proposals/preview — what a proposal link may say about itself.
 *
 * ⚠ **Reachable without an account on BOTH sides, which is unusual and
 * intended.** A share link's preview is for the recipient; this one is also
 * for the SENDER, who has no account by definition and is following their own
 * link to find out whether anybody took their design up. That is the whole
 * reason `proposal_preview` stays answerable after adoption.
 *
 * What a stranger can learn is bounded by the FUNCTION and not by this
 * handler: a submitter's NAME, when it was sent, when it lapses, and whether
 * some company has adopted it. **Never the design, and never the submitter's
 * email address** — the database does not return either, which is where that
 * decision belongs.
 *
 * ⚠ POST with the token in the BODY, not `?token=`. Same reasoning the share
 * preview records: the token is already unavoidably in the page's own URL, and
 * there is no reason to put a credential in a second place that lands in
 * access logs, `Referer` headers and browser history.
 *
 * ⚠ 200 even when the proposal is dead, with `found: false` and NO reason.
 * "No such proposal" and "expired" are one answer on purpose — anything
 * finer-grained turns this into an oracle for probing tokens.
 */
export async function POST(request: Request) {
  try {
    if (!isBackendConfigured()) {
      throw new HttpError(503, "Proposals are not configured on this deployment");
    }

    const token = requireToken(await readJsonBody(request));
    const supabase = await createSupabaseServerClient();
    const preview = await previewProposal(supabase, hashProposalToken(token));

    return Response.json(preview, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof ProjectRouteError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return errorResponse(error);
  }
}
