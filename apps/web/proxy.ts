import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  isBackendConfigured,
} from "@/app/auth/supabaseEnv";

/**
 * Next.js 16 renamed `middleware` to `proxy`. Same mechanism, and the file must
 * be named `proxy.ts` and sit beside `app/`; the named export must be `proxy`.
 * The `edge` runtime is not available here — proxy is always Node.
 *
 * THIS FILE AUTHORIZES NOTHING. It does exactly one thing: touches the Supabase
 * session so an expiring access token is refreshed and the rotated cookie is
 * written on the way back. No redirects, no route protection, no reading of
 * memberships.
 *
 * That restraint is deliberate on two counts:
 *
 *  - Next's own guidance is that proxy runs on every request, prefetches
 *    included, so it is for optimistic checks only and must not be the security
 *    boundary. Ours are in RLS.
 *  - The editor is not sign-in-gated and never will be. A guest can use every
 *    tool and both Save/Load buttons. A proxy that redirected anyone anywhere
 *    would be the first thing to break that.
 *
 * If it does nothing at all — no Supabase project configured — the app still
 * works, because it shipped for months with no backend.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  if (!isBackendConfigured()) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser(), not getSession(): this is the call that actually asks Supabase
  // whether the token is still good, and so the one that triggers a refresh.
  // Its answer is deliberately thrown away here — nothing on this request is
  // decided by who you are.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets, image optimisation, favicon and the API
    // routes. The route handlers build their own Supabase client and refresh
    // the cookie themselves, so running here as well would be a second round
    // trip for no gain.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|pdf)$).*)",
  ],
};
