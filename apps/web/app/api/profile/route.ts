import {
  HttpError,
  errorResponse,
  optionalString,
  readJsonBody,
  requireSession,
} from "@/app/auth/serverSession";

// Not exported: a route file may only export its handlers and route config.
const DISPLAY_NAME_MAX_LENGTH = 100;

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
    const raw = optionalString(body, "displayName");
    if (raw === null) throw new HttpError(400, 'Missing "displayName"');
    // Empty is allowed and means "no name": saved versions then fall back to
    // the email (0006's author_name snapshot). The cap is administrative, not a
    // building value — long enough for any real name, short enough to fit a
    // version-history row.
    const displayName = raw.trim();
    if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
      throw new HttpError(400, `Keep your name to ${DISPLAY_NAME_MAX_LENGTH} characters or fewer`);
    }

    const { error } = await supabase
      .from("user_profiles")
      .update({ display_name: displayName })
      .eq("id", snapshot.user.id);

    // Never surface database text to the browser.
    if (error) throw new HttpError(403, "Couldn't save your name — reload the page and try again");

    return Response.json({ ok: true, displayName });
  } catch (error) {
    return errorResponse(error);
  }
}
