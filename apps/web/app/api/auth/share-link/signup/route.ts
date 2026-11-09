import { HttpError, errorResponse, optionalString, readJsonBody, requireString } from "@/app/auth/serverSession";
import { hashShareLinkToken } from "@/app/auth/shareLinkToken";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  isBackendConfigured,
  isServiceRoleConfigured,
} from "@/app/auth/supabaseServer";
import {
  MIN_PASSWORD_LENGTH,
  SIGNUP_CONFIRM_MESSAGE,
  SIGNUP_EMAIL_MESSAGE,
  SIGNUP_EXISTS_MESSAGE,
  SIGNUP_LINK_DEAD_MESSAGE,
  SIGNUP_NOT_CONFIGURED_MESSAGE,
  SIGNUP_PASSWORD_MESSAGE,
  SIGNUP_WRONG_EMAIL_MESSAGE,
  emailSatisfiesLock,
  isEmailNotConfirmed,
  mayMarkEmailConfirmed,
} from "@/app/cloud/shareLinkSignup";

/**
 * Create an account from a live share link, then claim the link with it.
 *
 * > *"the link is the invite to sign up too. lets do that."* — Tommy,
 * > 2026-11-08
 *
 * ⚠ **This is the SECOND way an account can come into existence**, and until
 * 2026-11-08 `invite/accept` said in its own comment that it was the only one
 * and "there must not be" another. That comment was right when it was written
 * and is now superseded by a decision, not by an oversight — so this route is
 * built to the same shape rather than a looser one, and the invite route's
 * comment is updated to point here rather than left claiming exclusivity.
 *
 * The credential is the token, exactly as it is for an invite: 256 bits, stored
 * only as a SHA-256, and **the database decides whether it authorises a
 * sign-up at all** (`share_link_permits_signup`, 0013). This route cannot talk
 * it into one — it has no way to ask "is this link live" other than asking.
 *
 * ⚠ **`locked_email` never reaches the response.** 0013 returns it so that this
 * handler can decide whether the address is proved; `share_link_preview`, which
 * the PAGE calls, returns only a boolean so a forwarded link cannot disclose
 * whose it is. Putting it in a body here would undo that, from the one place
 * that can.
 */
export async function POST(request: Request) {
  try {
    if (!isBackendConfigured()) throw new HttpError(503, SIGNUP_NOT_CONFIGURED_MESSAGE);

    const body = await readJsonBody(request);
    const token = requireString(body, "token");
    const email = requireString(body, "email").trim().toLowerCase();
    const password = requireString(body, "password");
    const displayName = optionalString(body, "displayName") ?? "";

    if (email.length === 0 || !/^[^\s@]+@[^\s@]+$/.test(email)) throw new HttpError(400, SIGNUP_EMAIL_MESSAGE);

    const tokenHash = hashShareLinkToken(token);
    const supabase = await createSupabaseServerClient();

    const { data: permit, error: permitError } = await supabase
      .rpc("share_link_permits_signup", { p_token_hash: tokenHash })
      .maybeSingle<{ permitted: boolean; locked_email: string | null }>();

    // A failure to ASK and a "no" are the same answer here: without a yes from
    // the database, no account is created.
    if (permitError || !permit || permit.permitted !== true) throw new HttpError(400, SIGNUP_LINK_DEAD_MESSAGE);

    const lockedEmail = permit.locked_email;
    if (!emailSatisfiesLock(email, lockedEmail)) throw new HttpError(403, SIGNUP_WRONG_EMAIL_MESSAGE);

    /* ⚠ Try signing in FIRST, before creating anything — the same order and
       the same reason as the invite route: somebody who already has an account
       being sent a link is an ordinary case, not an error, and creating a
       second account for them is impossible anyway.

       The invite route records a known password-oracle trade-off here. It is
       NARROWER on this path: an invite names one address, so a holder can
       grind guesses at that specific person; an unlocked share link lets the
       caller choose the address, which sounds worse but is not new — anyone
       can already do that against the ordinary sign-in route, with no token
       needed. Supabase's own auth rate limits are the control for both. */
    const existing = await supabase.auth.signInWithPassword({ email, password });
    let signedIn = !existing.error;
    let createdUserId: string | null = null;

    if (!signedIn) {
      if (password.length < MIN_PASSWORD_LENGTH) throw new HttpError(400, SIGNUP_PASSWORD_MESSAGE);
      if (!isServiceRoleConfigured()) throw new HttpError(503, SIGNUP_NOT_CONFIGURED_MESSAGE);

      const admin = createSupabaseAdminClient();
      const created = await admin.auth.admin.createUser({
        email,
        password,
        /* ⚠ THE CONSEQUENTIAL LINE. A locked link names the address, which is
           the proof an invite has; an unlocked one proves nothing, so the
           address is confirmed the ordinary way, by email. See
           `mayMarkEmailConfirmed`. */
        email_confirm: mayMarkEmailConfirmed(lockedEmail),
        user_metadata: { display_name: displayName },
      });

      if (created.error || !created.data.user) {
        // Overwhelmingly the likely cause: an account exists and the password
        // just given was wrong. Say that, rather than "couldn't create user".
        throw new HttpError(400, SIGNUP_EXISTS_MESSAGE);
      }
      createdUserId = created.data.user.id;

      const signIn = await supabase.auth.signInWithPassword({ email, password });
      if (signIn.error) {
        /* ⚠ NOT a failure, and the account is NOT deleted. With Supabase's
           "Confirm sign up" on, an unconfirmed user cannot sign in yet — which
           is the expected next step of this flow, not a fault. Deleting the
           user here (as the invite route does on a failed redeem) would throw
           away the account they just made and the confirmation mail already in
           flight.

           The link is not claimed yet. It does not need to be: `claim_share_link`
           is idempotent and the landing page claims on arrival, so confirming
           the mail and opening the link again finishes the job. */
        if (isEmailNotConfirmed(signIn.error.message)) {
          return Response.json({ outcome: "confirm-email", message: SIGNUP_CONFIRM_MESSAGE }, { status: 202 });
        }
        /* A real sign-in failure with a brand-new account IS worth undoing —
           otherwise a login exists that belongs to nobody and reaches nothing. */
        if (createdUserId && isServiceRoleConfigured()) {
          await createSupabaseAdminClient().auth.admin.deleteUser(createdUserId);
        }
        throw new HttpError(500, "Created the account but couldn't sign in — try signing in.");
      }
      signedIn = true;
    }

    const { data: claim, error: claimError } = await supabase
      .rpc("claim_share_link", { p_token_hash: tokenHash })
      .maybeSingle<{ status: string; project_id: string; can_write: boolean }>();

    if (claimError || !claim) {
      /* The account is real and usable at this point, so it stays. The link
         is what failed, and the landing page can retry the claim on its own —
         the person is signed in now, which is the branch that already works. */
      throw new HttpError(409, SIGNUP_LINK_DEAD_MESSAGE);
    }

    return Response.json({
      outcome: "signed-in",
      status: claim.status,
      projectId: claim.project_id,
      canWrite: claim.can_write === true,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
