import { HttpError, errorResponse, readJsonBody, requireString } from "@/app/auth/serverSession";
import { createSupabaseServerClient, isBackendConfigured } from "@/app/auth/supabaseServer";

/**
 * Ask for a password-reset email. Supabase Auth sends it; this route only
 * decides where the link lands.
 *
 * Always answers "ok", whether or not that address has an account. Reporting
 * "no such user" here would turn the reset form into a way to enumerate who
 * works at these companies.
 */
export async function POST(request: Request) {
  try {
    if (!isBackendConfigured()) {
      throw new HttpError(503, "Password reset is not configured on this deployment");
    }

    const body = await readJsonBody(request);
    const email = requireString(body, "email").toLowerCase();

    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    const supabase = await createSupabaseServerClient();

    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin.replace(/\/$/, "")}/reset-password`,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
