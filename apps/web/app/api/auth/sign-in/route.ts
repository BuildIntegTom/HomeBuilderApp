import { cookies } from "next/headers";
import {
  ACTING_AS_COOKIE,
  HttpError,
  errorResponse,
  readJsonBody,
  requireString,
} from "@/app/auth/serverSession";
import { createSupabaseServerClient, isBackendConfigured } from "@/app/auth/supabaseServer";

/**
 * Sign in.
 *
 * Returns a bare result rather than the new session, and the client then asks
 * /api/session for it. That is deliberate: signing in must not disturb the
 * editor, so the whole flow is a couple of `fetch` calls with no navigation and
 * no remount anywhere. An unsaved design survives it because nothing about the
 * page changes except the top bar.
 */
export async function POST(request: Request) {
  try {
    if (!isBackendConfigured()) {
      throw new HttpError(503, "Sign-in is not configured on this deployment");
    }

    const body = await readJsonBody(request);
    const email = requireString(body, "email").toLowerCase();
    const password = requireString(body, "password");

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // One message for both "no such account" and "wrong password": telling
      // them apart tells an attacker which addresses have accounts.
      throw new HttpError(401, "That email and password don't match an account");
    }

    // A stale acting-as cookie from whoever used this browser last is a claim
    // about a different person. Drop it and let the new user's own default
    // company decide (memberships.is_default).
    const cookieStore = await cookies();
    cookieStore.delete(ACTING_AS_COOKIE);

    // Two-factor is optional, so most accounts stop here. For the ones that
    // opted in, the password alone leaves the session at aal1 — and
    // supabase/migrations/0004 makes that session read nothing until the code
    // is presented, so this is a real gate rather than a UI prompt.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factor = (factors?.totp ?? []).find((f) => f.status === "verified");
      if (factor) {
        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId: factor.id,
        });
        if (challengeError || !challenge) {
          throw new HttpError(500, "Couldn't start the two-factor check");
        }
        return Response.json({
          ok: true,
          mfaRequired: true,
          factorId: factor.id,
          challengeId: challenge.id,
        });
      }
    }

    return Response.json({ ok: true, mfaRequired: false });
  } catch (error) {
    return errorResponse(error);
  }
}
