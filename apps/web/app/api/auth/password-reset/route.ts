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

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin.replace(/\/$/, "")}/reset-password`,
    });

    /**
     * ⚠ **An error here is never about WHO was asked for, so surfacing it leaks
     * nothing.** Supabase answers success for an address with no account — that
     * is its own enumeration defence, and the reason this route can be honest
     * about everything else. What is left when it does error is a fault on our
     * side: the project's **redirect allowlist refusing `redirectTo`**, the
     * **email rate limit**, or SMTP failing.
     *
     * Until 2026-10-18 the result was discarded and the route answered
     * `{ ok: true }` regardless, so all three looked exactly like a sent email.
     * Found while wiring up strawpanels.com, where the first of them is the
     * expected failure if the new domain is not added to the allowlist — and
     * the second is live today on the built-in SMTP's own limit.
     *
     * The MESSAGE is not passed through: Supabase's text can name project
     * configuration. It is logged, and the client is told which kind of
     * problem it is and nothing more.
     */
    if (error) {
      console.error("[auth route] password reset could not be sent", error);
      if (error.status === 429) {
        throw new HttpError(429, "Too many reset emails have been sent recently. Try again in a few minutes.");
      }
      throw new HttpError(502, "The reset email could not be sent. This is a problem with the site, not your address.");
    }

    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
