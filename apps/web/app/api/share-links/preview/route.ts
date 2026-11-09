import { HttpError, errorResponse, readJsonBody } from "@/app/auth/serverSession";
import { hashShareLinkToken } from "@/app/auth/shareLinkToken";
import { createSupabaseServerClient, isBackendConfigured } from "@/app/auth/supabaseServer";
import { previewShareLink, requireToken } from "@/app/cloud/shareLinkRouteLogic";
import { ProjectRouteError } from "@/app/cloud/projectRouteLogic";

/**
 * POST /api/share-links/preview — what a link is for, before anybody signs in.
 *
 * ⚠ THE ONLY SHARE-LINK ROUTE REACHABLE WITHOUT AN ACCOUNT, and so the only
 * one that does not go through `requireCloudSession()`. Nobody is signed in at
 * this point, so there is no principal for a policy to be about: possession of
 * the token is the whole credential, which is why it is 256 bits and only its
 * hash is stored. That is the same reasoning `invite/preview` records.
 *
 * What a stranger can learn is bounded by the FUNCTION, not by this handler.
 * `share_link_preview` is `anon`-executable on purpose and returns the project
 * name, the owning company, who shared it, whether it is locked, whether it
 * grants write, and when it expires — and **no project id, no version, no
 * document, no panel and no price**. Widening this response means changing the
 * migration, where that decision is written down and tested.
 *
 * ⚠ POST, not GET, and the token goes in the BODY. `invite/preview` takes its
 * token as `?token=`, which is the older pattern here; a credential in a query
 * string lands in access logs, in `Referer` headers on anything the page
 * loads, and in browser history. The token is already in the path of the page
 * the visitor is on and that cannot be helped — a link has to be a link — but
 * there is no reason to put it in a second place. POST also keeps it out of
 * any CDN or proxy cache by default.
 */
export async function POST(request: Request) {
  try {
    if (!isBackendConfigured()) {
      throw new HttpError(503, "Accounts are not configured on this deployment");
    }

    const token = requireToken(await readJsonBody(request));
    const supabase = await createSupabaseServerClient();
    const preview = await previewShareLink(supabase, hashShareLinkToken(token));

    /* ⚠ 200 even when the link is dead. The body carries `valid: false` and a
       reason, and the landing page renders each reason with its own words. A
       404 here would make a revoked link indistinguishable from a broken
       deployment in the one place a confused visitor looks. */
    return Response.json(preview, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof ProjectRouteError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return errorResponse(error);
  }
}
