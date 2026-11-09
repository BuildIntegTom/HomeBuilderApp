import { readJsonBody } from "@/app/auth/serverSession";
import { hashShareLinkToken } from "@/app/auth/shareLinkToken";
import { NO_STORE, cloudErrorResponse, requireCloudSession } from "@/app/cloud/cloudRouteSession";
import { claimShareLink, requireToken } from "@/app/cloud/shareLinkRouteLogic";

/**
 * POST /api/share-links/claim — turn a URL into access, for somebody who is
 * signed in.
 *
 * ⚠ There is deliberately NO user id in the body, and there must not be one.
 * `claim_share_link` runs as the signed-in user and reads `auth.uid()` itself,
 * exactly as `redeem_invite` does, so this route cannot talk it into granting
 * access to anybody else. It hashes the token and relays the answer.
 *
 * ⚠ It goes through `requireCloudSession()`, which is load-bearing for more
 * than authentication: that helper refuses an `mfaPending` session with its
 * own 401, which is what makes a 42501 from the RPC unambiguously the
 * locked-email mismatch rather than the two-factor refusal that shares the
 * code. See `CLAIM_WRONG_EMAIL_MESSAGE`.
 *
 * Three outcomes, all 200, because all three mean the person can open the
 * project and the right thing to do with each is open it:
 *   claimed             a new grant was written
 *   already-claimed     they had a personal grant already (its level, not
 *                       this link's — a view-only client sent a writing link
 *                       does not silently gain write)
 *   already-has-access  a membership, a company grant or platform admin
 *                       already reaches it, and nothing was written
 */
export async function POST(request: Request) {
  try {
    const session = await requireCloudSession();
    const token = requireToken(await readJsonBody(request));
    const result = await claimShareLink(session.supabase, hashShareLinkToken(token));
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
