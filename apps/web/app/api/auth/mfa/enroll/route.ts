import {
  HttpError,
  errorResponse,
  requireSatisfiedAal,
  requireSession,
} from "@/app/auth/serverSession";

/**
 * Start enrolling an authenticator app.
 *
 * OPTIONAL FOR EVERY ACCOUNT, platform admin included — decision 7, put to
 * Tommy directly with the "one password away from everything" reasoning and
 * confirmed twice. Nothing in this codebase requires a factor, and an account
 * without one is not a defect to be fixed.
 *
 * Enrolment is two steps: this one returns a QR code / secret, and
 * /api/auth/mfa/verify turns the factor on once a code from it checks out. A
 * factor left half-enrolled stays `unverified` and is ignored everywhere,
 * including by the database's own check, so abandoning this form cannot lock
 * anyone out.
 */
export async function POST() {
  try {
    const { supabase } = await requireSession();
    if (!supabase) throw new HttpError(401, "Not signed in");
    // Adding a factor to an account that already has one is a change to how the
    // account is protected, so it needs the existing factor. For the common
    // case — a first factor — nextLevel is 'aal1' and this is a no-op.
    await requireSatisfiedAal(supabase);

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
    });

    if (error || !data) throw new HttpError(400, error?.message ?? "Couldn't start enrolment");

    return Response.json({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
