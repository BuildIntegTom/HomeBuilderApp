import {
  HttpError,
  errorResponse,
  optionalString,
  readJsonBody,
  requireSatisfiedAal,
  requireString,
} from "@/app/auth/serverSession";
import { createSupabaseServerClient, isBackendConfigured } from "@/app/auth/supabaseServer";

/** The shortest password this app will set. Supabase's own default floor. */
const MIN_PASSWORD_LENGTH = 8;

/**
 * Set a new password. Three ways in:
 *
 *  - from a reset email, carrying either a PKCE `code` or a `token_hash`,
 *    depending on how the Supabase email template is configured. Both are
 *    supported so that customising the template later does not break this;
 *  - the same, plus a `totpCode`, for an account that turned two-factor on;
 *  - already signed in, changing your own password, carrying none of them.
 *
 * THE TWO-FACTOR STEP IS WHY THIS ROUTE IS SHAPED THE WAY IT IS. A recovery link
 * proves control of a mailbox, which is one factor, not two — so an account that
 * chose two-factor should not have it undone by a mailbox alone. But requiring
 * the second factor with nowhere to type it is a lockout, and the first person
 * to enrol a factor and forget their password would have been stuck until
 * someone fixed it from the Supabase dashboard. Tommy's call was to make
 * recovery self-service, so this answers `mfaRequired` and the form asks for the
 * code.
 *
 * The link is consumed on the first call, which is why the second call skips the
 * exchange: the session it established is already in the cookie by then, even
 * though that first response was a 401.
 */
export async function POST(request: Request) {
  try {
    if (!isBackendConfigured()) {
      throw new HttpError(503, "Password reset is not configured on this deployment");
    }

    const body = await readJsonBody(request);
    const password = requireString(body, "password");
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new HttpError(400, `Passwords must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    const code = optionalString(body, "code");
    const tokenHash = optionalString(body, "tokenHash");
    const totpCode = optionalString(body, "totpCode");
    const supabase = await createSupabaseServerClient();

    // Only redeem the link if we do not already have a session from it. A reset
    // link is single-use, so re-exchanging it on the second round trip would
    // fail and look like an expired link.
    const already = await supabase.auth.getUser();
    if (!already.data.user) {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw new HttpError(400, "That reset link is no longer valid");
      } else if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
        if (error) throw new HttpError(400, "That reset link is no longer valid");
      }
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      throw new HttpError(401, "Open the link from your reset email, or sign in first");
    }

    // If a code was supplied, present it before the assurance check below reads
    // the result. `listFactors()` asks the server, not the cookie.
    if (totpCode) {
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw new HttpError(401, "Couldn't check your two-factor settings");
      const factor = (factors.data?.totp ?? []).find((f) => f.status === "verified");
      if (!factor) throw new HttpError(400, "This account has no two-factor code to enter");

      const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (challenge.error || !challenge.data) {
        throw new HttpError(500, "Couldn't start the two-factor check");
      }
      const verified = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.data.id,
        code: totpCode,
      });
      if (verified.error) {
        throw new HttpError(401, "That code didn't match — codes expire quickly, try the next one");
      }
    }

    try {
      await requireSatisfiedAal(supabase);
    } catch (error) {
      if (error instanceof HttpError && error.status === 401 && !totpCode) {
        // Tell the form to ask, rather than telling the person off for not
        // having typed something they were never offered.
        return Response.json(
          { error: "This account uses two-factor — enter your code", mfaRequired: true },
          { status: 401 },
        );
      }
      throw error;
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new HttpError(400, error.message);

    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
