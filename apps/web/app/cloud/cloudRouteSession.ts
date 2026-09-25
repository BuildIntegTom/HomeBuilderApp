import type { SupabaseClient } from "@supabase/supabase-js";
// Relative, not "@/…": vitest has no "@" alias, and cloudRouteSession.test.ts
// imports this file.
import { HttpError, errorResponse, requireSession, type ServerSession } from "../auth/serverSession";
import type { DeleteViewer } from "./deleteRouteLogic";
import { ProjectRouteError } from "./projectRouteLogic";
import type { SharingViewer } from "./sharingRouteLogic";

/**
 * The first line of every /api/projects route, following Stage 1's pattern:
 * `requireSession()`, then the session's own JWT-bound client, so the RLS
 * policies in 0006 are the access control. There is no admin client anywhere
 * on this path.
 *
 * The two-factor refusal here is a MESSAGE, not the gate: 0006 puts 0004's
 * restrictive aal policy on both tables, so a password-only session on an
 * enrolled account already reads nothing and writes nothing. Saying so
 * beats an empty folder that looks like data loss.
 */
export async function requireCloudSession(): Promise<ServerSession & { supabase: SupabaseClient }> {
  const session = await requireSession();
  if (!session.supabase) throw new HttpError(401, "Not signed in");
  if (session.snapshot.mfaPending) {
    throw new HttpError(401, "Enter your two-factor code (Account ▾) before using cloud projects");
  }
  return session as ServerSession & { supabase: SupabaseClient };
}

/**
 * Stage 3B: who is asking, for the access list's Remove buttons. Everything
 * here comes from loadSession's verified reading (memberships re-read on every
 * request), never from the request. It only decides which buttons to show;
 * collaborators_delete decides what is removed.
 */
export function sharingViewerOf(session: ServerSession): SharingViewer {
  return {
    userId: session.snapshot.user?.id ?? "",
    isPlatformAdmin: Boolean(session.snapshot.user?.isPlatformAdmin),
    entitlements: session.entitlements,
    actingAs: session.actingAs,
  };
}

/**
 * Stage 5: who is asking, for the permanent-delete routes. `isPlatformAdmin`
 * comes from `loadSession`'s own read of `user_profiles.is_platform_admin`,
 * re-read on every request, never from the request body or a cookie.
 *
 * It decides whether the route REFUSES. It never decides that a delete may go
 * ahead: `projects_delete` (0006) does that, in the database.
 */
export function deleteViewerOf(session: ServerSession): DeleteViewer {
  return { isPlatformAdmin: Boolean(session.snapshot.user?.isPlatformAdmin) };
}

export function cloudErrorResponse(error: unknown): Response {
  if (error instanceof ProjectRouteError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return errorResponse(error);
}

export const NO_STORE = { "cache-control": "no-store, max-age=0" } as const;
