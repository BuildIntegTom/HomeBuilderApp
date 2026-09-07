import { cookies } from "next/headers";
import { ACTING_AS_COOKIE, errorResponse } from "@/app/auth/serverSession";
import { createSupabaseServerClient, isBackendConfigured } from "@/app/auth/supabaseServer";

/**
 * Sign out. Like sign-in, this is a fetch and not a navigation: the editor and
 * whatever is unsaved in it are untouched. Signing out drops you to guest,
 * which is a fully usable state — the editor was never sign-in-gated.
 */
export async function POST() {
  try {
    if (isBackendConfigured()) {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    }
    const cookieStore = await cookies();
    cookieStore.delete(ACTING_AS_COOKIE);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
