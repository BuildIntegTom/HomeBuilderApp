/**
 * Supabase configuration, read from the environment.
 *
 * Split out from `supabaseServer.ts` for one specific reason: `proxy.ts` needs
 * to know whether a backend is configured, and `supabaseServer.ts` imports
 * `next/headers`, which has no business being pulled into the proxy bundle.
 * This module imports nothing.
 *
 * Supabase is renaming its keys: the old `anon` / `service_role` pair is being
 * replaced by `publishable` / `secret`. Tommy's project currently carries BOTH,
 * so each slot reads a list of names and takes the first that is set, new names
 * first. That is not padding — it is what keeps the app running on the day the
 * old pair is retired, without anyone having to remember why.
 */

function firstEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.length > 0) return value;
  }
  return "";
}

export const SUPABASE_URL = firstEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");

/** Browser-safe. RLS is what makes it safe; it grants nothing on its own. */
export const SUPABASE_PUBLISHABLE_KEY = firstEnv(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
);

/** Bypasses RLS entirely. Server only. See createSupabaseAdminClient. */
export const SUPABASE_SECRET_KEY = firstEnv("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");

/**
 * The app has to keep working with no Supabase project behind it.
 *
 * Not defensive coding for its own sake: the editor is fully usable signed out
 * (spec decisions 4 and 5), it shipped for months with no backend at all, and a
 * missing key must degrade to "you cannot sign in", never to a crashed page.
 * Every caller checks this first.
 */
export function isBackendConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_PUBLISHABLE_KEY.length > 0;
}

export function isServiceRoleConfigured(): boolean {
  return isBackendConfigured() && SUPABASE_SECRET_KEY.length > 0;
}
