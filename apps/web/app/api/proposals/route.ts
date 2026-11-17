import { HttpError, errorResponse, optionalString, readJsonBody } from "@/app/auth/serverSession";
import {
  PROPOSAL_EXPIRY_DAYS,
  generateProposalToken,
  hashProposalToken,
  proposalExpiresAt,
} from "@/app/auth/proposalToken";
import { createSupabaseServerClient, isBackendConfigured } from "@/app/auth/supabaseServer";
import { ProjectRouteError } from "@/app/cloud/projectRouteLogic";
import { submitProposal } from "@/app/cloud/proposalRouteLogic";
import { DOCUMENT_TOO_LARGE_MESSAGE, isCertainlyTooLargeForCloud } from "@/app/cloud/cloudTypes";

/**
 * POST /api/proposals — a design, from somebody with no account.
 *
 * > *"building integrity can recieve a link from a not signed in account"* —
 * > Tommy, 2026-11-08
 *
 * ⚠ **THE ONLY UNAUTHENTICATED WRITE IN THIS APP.** Every other route that
 * puts a row in the database goes through `requireCloudSession()`; this one
 * cannot, because having no account is the entire point of it. What bounds it
 * is written in 0014's own header and is worth repeating where somebody
 * editing this file will meet it:
 *
 *   * the document is held to the SAME rules a saved version is — object,
 *     `state`, integer `schemaVersion`, 4MB — by a trigger, so an unusable
 *     design is refused here rather than at adoption, after the sender has
 *     been told it was received;
 *   * every proposal expires, so an unadopted one removes itself;
 *   * there is no read path that LISTS proposals, so a flood is invisible
 *     rather than being presented to anybody.
 *
 * ⚠ **What is NOT bounded is the RATE.** Postgres cannot do it well and this
 * route does not do it either: an in-memory counter in a serverless function
 * is per-instance and therefore close to useless, so a real answer is an edge
 * rule in front of this route. Deferred deliberately and recorded in the
 * migration, against a date rather than a feeling: nobody uses this app for
 * real until it is hardened off, and Tommy set that at **1 February 2027** on
 * 2026-11-16. **This is the thing to build first when that window opens.**
 *
 * ⚠ **THE TOKEN IS MINTED HERE AND RETURNED EXACTLY ONCE.** The database
 * stores only its SHA-256, so this response is the only copy that will ever
 * exist — which is why the page that calls this puts it in front of the sender
 * and tells them to keep it, rather than relying on them finding it again.
 */
export async function POST(request: Request) {
  try {
    if (!isBackendConfigured()) {
      throw new HttpError(503, "Proposals are not configured on this deployment");
    }

    const body = await readJsonBody(request);
    const document = body.document;
    if (document === undefined || document === null || typeof document !== "object") {
      throw new ProjectRouteError(400, "A proposal needs a design.");
    }

    /* ⚠ Refused HERE as well as by the trigger, because the two refusals are
       not the same experience: this one happens before the request leaves the
       browser's patience, and it can say what to do instead. The trigger is
       the one that cannot be bypassed; this is the one that is kind. */
    if (isCertainlyTooLargeForCloud(JSON.stringify(document))) {
      throw new ProjectRouteError(413, DOCUMENT_TOO_LARGE_MESSAGE);
    }

    const token = generateProposalToken();
    const expiresAt = proposalExpiresAt();
    const supabase = await createSupabaseServerClient();
    const result = await submitProposal(supabase, hashProposalToken(token), document, expiresAt, {
      name: optionalString(body, "submitterName"),
      /* ⚠ Stored, never returned by any read path — `proposal_preview`
         deliberately omits it. It is there so a company that adopts a design
         can reply to whoever sent it, which is a later feature and not this
         one. */
      email: optionalString(body, "submitterEmail"),
    });

    return Response.json(
      { token, expiresAt: result.expiresAt, expiryDays: PROPOSAL_EXPIRY_DAYS },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ProjectRouteError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return errorResponse(error);
  }
}
