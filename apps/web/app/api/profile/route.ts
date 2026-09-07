import {
  HttpError,
  errorResponse,
  optionalString,
  readJsonBody,
  requireSession,
} from "@/app/auth/serverSession";

/**
 * Set your own display name — the name that will appear on saved versions from
 * Stage 2 onward, and the reason the profile row exists separately from the
 * credential Supabase Auth owns.
 *
 * `user_profiles_update` allows only your own row, and
 * `guard_user_profile_columns` refuses any attempt to move `is_platform_admin`
 * or `email` through this door.
 */
export async function PATCH(request: Request) {
  try {
    const { supabase, snapshot } = await requireSession();
    if (!supabase || !snapshot.user) throw new HttpError(401, "Not signed in");

    const body = await readJsonBody(request);
    const displayName = optionalString(body, "displayName");
    if (displayName === null) throw new HttpError(400, 'Missing "displayName"');

    const { error } = await supabase
      .from("user_profiles")
      .update({ display_name: displayName })
      .eq("id", snapshot.user.id);

    if (error) throw new HttpError(403, error.message);

    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
