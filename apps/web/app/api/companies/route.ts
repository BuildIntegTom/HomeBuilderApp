import {
  HttpError,
  errorResponse,
  readJsonBody,
  requireSatisfiedAal,
  requireSession,
  requireString,
} from "@/app/auth/serverSession";
import {
  INVITE_EXPIRY_DAYS,
  generateInviteToken,
  hashInviteToken,
  inviteExpiryFrom,
  inviteUrl,
} from "@/app/auth/inviteToken";

/**
 * Create a company, and invite its first admin, in one call.
 *
 * Decision 27, in full: company admins at any member company may do this, plus
 * platform admin; "the creator names the company and invites its first admin by
 * email"; and "the creator gets no standing access to the company they created
 * — creating is not joining."
 *
 * BOTH HALVES AT ONCE IS THE POINT. The first invite to a company has to be
 * written at a moment when nobody administers it, so no policy phrased as "an
 * admin of this company" can authorize it. An earlier attempt gave the creator a
 * temporary window in which they could see and invite to their new company;
 * Tommy chose this instead. The creator now has no access at any point, which is
 * the spec satisfied as written rather than reinterpreted — and there is no
 * window to hold open, close, or reason about.
 *
 * So the work happens in `public.create_company_with_first_admin`, which checks
 * decision 27's own condition itself. This handler does not re-derive it, and in
 * particular does not consult `session.entitlements` — those are membership-
 * derived and would refuse a company admin creating a company they will never be
 * a member of.
 *
 * The new company arrives with `is_seed_member = false` and cannot be created
 * any other way (a trigger refuses the flag from anyone but a platform admin).
 * Onboarding a company into the co-operative is a decision Tommy makes, not a
 * side effect of someone filling in a form.
 */
export async function POST(request: Request) {
  try {
    const { supabase, snapshot } = await requireSession();
    if (!supabase || !snapshot.user) throw new HttpError(401, "Not signed in");

    // create_company_with_first_admin runs as the table owner, so it writes
    // rows the restrictive AAL policies in 0004 would otherwise refuse — same
    // bypass redeem_invite has, and for the same reason. Without this check a
    // password-only session on a two-factor account could read nothing at all
    // and still found a company. The database cannot close that from inside the
    // function; this route can, and it is the path anyone actually uses.
    await requireSatisfiedAal(supabase);

    const body = await readJsonBody(request);
    const name = requireString(body, "name");
    const firstAdminEmail = requireString(body, "firstAdminEmail").toLowerCase();

    const token = generateInviteToken();
    const expiresAt = inviteExpiryFrom(new Date());

    const { data, error } = await supabase.rpc("create_company_with_first_admin", {
      p_name: name,
      p_email: firstAdminEmail,
      p_token_hash: hashInviteToken(token),
      p_expires_at: expiresAt.toISOString(),
    });

    if (error) {
      if (error.code === "23505") {
        throw new HttpError(409, "A company with that name already exists");
      }
      if (error.code === "42501") {
        // The function raises 42501 for two distinct refusals; both are ours to
        // phrase, and both are things the person can act on.
        throw new HttpError(
          403,
          error.message.includes("invite yourself")
            ? "You can't make yourself the first admin of a company you create — creating is not joining"
            : "Only a company admin can create a company",
        );
      }
      if (error.code === "22023") {
        // Our own validation strings from inside the function: a blank name, a
        // missing first admin, an already-expired invite.
        throw new HttpError(400, error.message);
      }
      // Anything unmapped is a raw Postgres message, which can name policies,
      // columns and functions. errorResponse logs it and says nothing.
      throw error;
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

    return Response.json({
      inviteId: data as string,
      companyName: name,
      // The link is shown once and only its hash is stored, so it cannot be
      // looked up again — and the creator cannot withdraw or reissue it either,
      // because they do not administer that company. A mistyped address is
      // fixed by a platform admin. That is the price of "no standing access",
      // and it is said out loud rather than discovered.
      url: inviteUrl(origin, token),
      expiresInDays: INVITE_EXPIRY_DAYS,
      note: "You are not a member of this company and never will be by having created it. Send that link to its first admin.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
