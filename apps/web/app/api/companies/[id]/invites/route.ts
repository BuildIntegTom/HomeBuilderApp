import {
  HttpError,
  errorResponse,
  readJsonBody,
  requireLevel,
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
import type { CompanyInviteSummary } from "@/app/auth/types";

/**
 * List a company's invites. RLS returns nothing at all to a plain member.
 *
 * NO ENTITLEMENT CHECK HERE, ON PURPOSE — and this is the second time that
 * sentence has had to be written in this codebase, so it gets the space.
 *
 * `session.entitlements` is built from MEMBERSHIPS (plus the consortium, plus
 * platform-admin-sees-all). It answers "which company may I act as", which is a
 * different question from "may I administer this company", and gating on it
 * refuses things the policies allow. Last time the two were conflated, the first
 * invite to a newly created company 403'd for every user EXCEPT a platform
 * admin — who holds an entitlement to everything, and so is exactly the account
 * that would hand-test it and watch it work.
 *
 * The rule this file follows, same as api/invites/[id]: `requireEntitlement` is
 * for the acting-as claim itself. Everything else is the policy's decision.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: companyId } = await context.params;
    const session = await requireSession();
    if (!session.supabase) throw new HttpError(401, "Not signed in");

    const { data, error } = await session.supabase
      .from("invites")
      .select("id, email, level, expires_at, accepted_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) throw new HttpError(403, "You can't read that company's invites");

    const invites: CompanyInviteSummary[] = (data ?? []).map((row) => ({
      id: row.id as string,
      email: row.email as string,
      level: row.level as "member" | "admin",
      expiresAt: row.expires_at as string,
      acceptedAt: (row.accepted_at as string | null) ?? null,
    }));

    return Response.json({ invites }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Issue an invite. This is the only door into the app (decision 3), so it is
 * the only place a token is minted.
 *
 * The response carries the invite LINK, once, and the database never sees it —
 * only its SHA-256 is stored. That has a consequence worth stating plainly:
 * this link cannot be looked up again later, so a lost one is reissued rather
 * than recovered.
 *
 * Delivery is copy-and-send by the admin. Wiring an email provider is a real
 * decision (which provider, which from-address, what the mail says) that has
 * not been made, and inventing one would be worse than handing over the link.
 *
 * Whether the caller may do this at all is the `invites_insert` policy's
 * decision, not this handler's — see the note on GET above for why this route
 * does not consult entitlements.
 *
 * A company's FIRST invite does not come through here. At that moment nobody
 * administers the company, so no policy could authorize it; it is minted by
 * `create_company_with_first_admin` in the same call that creates the company
 * (POST /api/companies).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: companyId } = await context.params;
    const session = await requireSession();
    if (!session.supabase || !session.snapshot.user) throw new HttpError(401, "Not signed in");

    const body = await readJsonBody(request);
    const email = requireString(body, "email").toLowerCase();
    const level = requireLevel(body, "level");

    const token = generateInviteToken();
    const expiresAt = inviteExpiryFrom(new Date());

    const { data, error } = await session.supabase
      .from("invites")
      .insert({
        email,
        company_id: companyId,
        level,
        token_hash: hashInviteToken(token),
        expires_at: expiresAt.toISOString(),
        created_by: session.snapshot.user.id,
      })
      .select("id, email, level, expires_at, accepted_at")
      .single();

    if (error) throw new HttpError(403, "You can't invite people to that company");

    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

    return Response.json({
      invite: {
        id: data.id,
        email: data.email,
        level: data.level,
        expiresAt: data.expires_at,
        acceptedAt: data.accepted_at ?? null,
      } satisfies CompanyInviteSummary,
      url: inviteUrl(origin, token),
      expiresInDays: INVITE_EXPIRY_DAYS,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
