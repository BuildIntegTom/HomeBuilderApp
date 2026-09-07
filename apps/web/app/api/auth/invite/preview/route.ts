import { HttpError, errorResponse } from "@/app/auth/serverSession";
import { hashInviteToken } from "@/app/auth/inviteToken";
import { createSupabaseServerClient, isBackendConfigured } from "@/app/auth/supabaseServer";

export interface InvitePreview {
  valid: boolean;
  reason: string | null;
  companyName: string | null;
  email: string | null;
  level: "member" | "admin" | null;
}

/**
 * What an invite link is for, so the sign-up form can say "join Building
 * Integrity as ..." instead of asking a stranger to fill in a blank form.
 *
 * The validity rules are not here: `public.invite_preview` in the database
 * decides, and this route hashes the token and relays the answer. Nobody is
 * signed in at this point, so there is no principal for a policy to be about —
 * possession of the token is the whole credential, which is why the token is
 * 256 bits and only its hash is stored.
 */
export async function GET(request: Request) {
  try {
    if (!isBackendConfigured()) {
      throw new HttpError(503, "Accounts are not configured on this deployment");
    }

    const token = new URL(request.url).searchParams.get("token");
    if (!token) throw new HttpError(400, "Missing invite token");

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .rpc("invite_preview", { p_token_hash: hashInviteToken(token) })
      .maybeSingle<{
        valid: boolean;
        reason: string | null;
        company_name: string | null;
        email: string | null;
        level: "member" | "admin" | null;
      }>();

    if (error) throw new HttpError(500, "Couldn't read that invite");

    const preview: InvitePreview = {
      valid: Boolean(data?.valid),
      reason: data?.reason ?? (data ? null : "not_found"),
      companyName: data?.company_name ?? null,
      email: data?.email ?? null,
      level: data?.level ?? null,
    };

    return Response.json(preview, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
