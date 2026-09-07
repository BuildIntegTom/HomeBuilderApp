import { cookies } from "next/headers";
import {
  ACTING_AS_COOKIE,
  HttpError,
  errorResponse,
  optionalString,
  readJsonBody,
  requireString,
} from "@/app/auth/serverSession";
import { hashInviteToken } from "@/app/auth/inviteToken";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  isBackendConfigured,
  isServiceRoleConfigured,
} from "@/app/auth/supabaseServer";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Accept an invite. This is the ONLY way an account comes into existence
 * (decision 3: invite-only, nobody self-registers). There is no sign-up route
 * anywhere else, and there must not be one.
 *
 * Two cases, and both are normal:
 *
 *  1. No account yet — create the auth user, sign in, redeem.
 *  2. The email already has an account — this is someone being invited to a
 *     SECOND company, which decision 1 explicitly expects ("he specifically has
 *     people spanning Building Integrity and The Seed Collaborative"). They give
 *     their existing password, we sign them in, and redeem adds the membership.
 *
 * Every rule about whether the invite is good — unexpired, unused, addressed to
 * this person — is in `public.redeem_invite`, which runs as the signed-in user
 * and takes no user id. This route cannot talk it into a membership.
 */
export async function POST(request: Request) {
  try {
    if (!isBackendConfigured()) {
      throw new HttpError(503, "Accounts are not configured on this deployment");
    }

    const body = await readJsonBody(request);
    const token = requireString(body, "token");
    const password = requireString(body, "password");
    const displayName = optionalString(body, "displayName") ?? "";
    const tokenHash = hashInviteToken(token);

    const supabase = await createSupabaseServerClient();

    const { data: preview, error: previewError } = await supabase
      .rpc("invite_preview", { p_token_hash: tokenHash })
      .maybeSingle<{ valid: boolean; reason: string | null; email: string | null }>();

    if (previewError || !preview) throw new HttpError(400, "That invite link is not valid");
    if (!preview.valid) {
      throw new HttpError(
        400,
        preview.reason === "expired"
          ? "That invite has expired — ask for a new one"
          : preview.reason === "already_used"
            ? "That invite has already been used"
            : "That invite link is not valid",
      );
    }

    const email = (preview.email ?? "").toLowerCase();
    if (!email) throw new HttpError(400, "That invite link is not valid");

    // Case 2 first: if the password signs them in, they already had an account.
    //
    // KNOWN AND ACCEPTED: this makes the endpoint a password oracle for exactly
    // one address — the one the invite names. A holder of a live invite can
    // grind guesses at that address, distinguishing right from wrong by whether
    // they get in. It is bounded by Supabase's own auth rate limits, by the
    // invite's expiry, and by the fact that the attacker must already hold a
    // valid invite naming that person. The alternative — an "does this email
    // have an account?" probe before asking for a password — leaks the same
    // fact to a wider audience. Recorded rather than fixed; if it ever needs
    // fixing, the shape is a per-token attempt counter on the invites row.
    let signedIn = false;
    const existing = await supabase.auth.signInWithPassword({ email, password });
    if (!existing.error) {
      signedIn = true;
    }

    let createdUserId: string | null = null;

    if (!signedIn) {
      if (password.length < MIN_PASSWORD_LENGTH) {
        throw new HttpError(400, `Passwords must be at least ${MIN_PASSWORD_LENGTH} characters`);
      }
      if (!isServiceRoleConfigured()) {
        throw new HttpError(503, "Account creation is not configured on this deployment");
      }

      const admin = createSupabaseAdminClient();
      const created = await admin.auth.admin.createUser({
        email,
        password,
        // The invite is the proof of address: it was sent to this mailbox.
        email_confirm: true,
        user_metadata: { display_name: displayName },
      });

      if (created.error || !created.data.user) {
        // The one likely cause is an existing account whose password we were
        // just given wrong. Say so, rather than "couldn't create user".
        throw new HttpError(
          400,
          "There's already an account for that email — accept the invite with your existing password",
        );
      }
      createdUserId = created.data.user.id;

      const signIn = await supabase.auth.signInWithPassword({ email, password });
      if (signIn.error) {
        await admin.auth.admin.deleteUser(createdUserId);
        throw new HttpError(500, "Created the account but couldn't sign in — try signing in");
      }
    }

    const { error: redeemError } = await supabase.rpc("redeem_invite", { p_token_hash: tokenHash });

    if (redeemError) {
      if (createdUserId && isServiceRoleConfigured()) {
        // Do not leave a login behind that belongs to no company. The invite
        // row is untouched by a failed redeem, so the link still works.
        await createSupabaseAdminClient().auth.admin.deleteUser(createdUserId);
      }
      throw new HttpError(400, redeemError.message);
    }

    // Fresh membership, so let memberships.is_default choose the acting-as
    // company rather than a cookie left over from someone else's session.
    (await cookies()).delete(ACTING_AS_COOKIE);

    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
