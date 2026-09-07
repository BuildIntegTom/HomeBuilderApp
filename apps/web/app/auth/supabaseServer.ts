import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY,
  SUPABASE_URL,
  isServiceRoleConfigured,
} from "./supabaseEnv";

export {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  isBackendConfigured,
  isServiceRoleConfigured,
} from "./supabaseEnv";

/**
 * Supabase clients for server code. Nothing in here runs in the browser.
 *
 * Next.js 16 note: `cookies()` is async and the synchronous fallback was
 * REMOVED in 16 rather than deprecated, so this factory is async and must be
 * awaited.
 */

/**
 * The normal client: authenticated as whoever holds the session cookie, so
 * every query it runs is subject to the RLS policies in
 * supabase/migrations/0002. Route handlers use this, and that is what makes the
 * policies — rather than the route handler — the access control.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where the cookie store is
          // read-only. The refresh still happened inside the Supabase client;
          // the rotated cookie gets written by the next Route Handler or by
          // proxy.ts. Swallowing here is the documented @supabase/ssr pattern,
          // not a hidden failure.
        }
      },
    },
  });
}

/**
 * The secret-key client bypasses RLS entirely. It exists for exactly two
 * operations, both of which happen BEFORE the person has an account and so
 * cannot be expressed as a policy about them:
 *
 *   1. creating the auth user named by a valid invite;
 *   2. deleting that user again if redeeming the invite then fails, so a failed
 *      sign-up does not leave an orphaned login behind.
 *
 * Every rule about who may do what still lives in SQL: the invite itself is
 * validated by `public.redeem_invite`, which runs as the newly signed-in user
 * and takes no user-id parameter, so this client cannot be used to fabricate a
 * membership. If you find yourself reaching for it anywhere else, the rule you
 * are about to write belongs in a policy instead.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  if (!isServiceRoleConfigured()) {
    throw new Error("No Supabase secret key is configured");
  }
  return createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
