import {
  HttpError,
  errorResponse,
  readJsonBody,
  requireSatisfiedAal,
  requireSession,
  requireString,
} from "@/app/auth/serverSession";

/**
 * Turn two-factor back off. It has to exist, because 2FA is optional in both
 * directions — an account that turned it on and lost the authenticator would
 * otherwise be stuck, and there is no mandatory path anywhere for it to be
 * stuck in service of.
 *
 * Requires a session that has already presented the second factor — checked
 * here, by this route, rather than assumed of GoTrue. Turning the factor off is
 * the one operation that would undo supabase/migrations/0004 for this account,
 * so it is the last thing that should be reachable from a password-only
 * session. An earlier version of this comment claimed Supabase guaranteed it;
 * that was never verified, and asserting an unchecked guarantee is worse than
 * having none.
 */
export async function POST(request: Request) {
  try {
    const { supabase } = await requireSession();
    if (!supabase) throw new HttpError(401, "Not signed in");
    await requireSatisfiedAal(supabase);

    const body = await readJsonBody(request);
    const factorId = requireString(body, "factorId");

    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) throw new HttpError(400, error.message);

    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
