import {
  HttpError,
  errorResponse,
  optionalString,
  readJsonBody,
  requireString,
} from "@/app/auth/serverSession";
import { createSupabaseServerClient, isBackendConfigured } from "@/app/auth/supabaseServer";

/**
 * Present a six-digit code. Serves both moments a code is asked for:
 *
 *  - finishing enrolment (no challenge id yet — one is created here);
 *  - signing in on an account that has a factor (sign-in already made the
 *    challenge and passed its id back).
 *
 * Not behind `requireSession`, deliberately: at sign-in the caller is at aal1,
 * which is exactly the state that cannot read anything yet. Supabase verifies
 * the code against the session's own factor, so there is nothing here to
 * impersonate with.
 */
export async function POST(request: Request) {
  try {
    if (!isBackendConfigured()) {
      throw new HttpError(503, "Two-factor is not configured on this deployment");
    }

    const body = await readJsonBody(request);
    const factorId = requireString(body, "factorId");
    const code = requireString(body, "code");
    let challengeId = optionalString(body, "challengeId");

    const supabase = await createSupabaseServerClient();

    if (!challengeId) {
      const { data, error } = await supabase.auth.mfa.challenge({ factorId });
      if (error || !data) throw new HttpError(400, "Couldn't start the two-factor check");
      challengeId = data.id;
    }

    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code });
    if (error) throw new HttpError(401, "That code didn't match — codes expire quickly, try the next one");

    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
