import { NO_STORE, cloudErrorResponse, requireCloudSession } from "@/app/cloud/cloudRouteSession";
import { readBackupPage } from "@/app/cloud/backupRouteLogic";

/**
 * GET /api/companies/[id]/backup?after=&limit= — Stage 2D, company backup.
 *
 * One page of versions WITH their documents, for the browser to write into a
 * zip. Paged by count and by bytes so no response nears the platform's ~4.5 MB
 * limit; the browser asks for the next page with `after`.
 *
 * `requireCloudSession()` first, then the session's JWT-bound client, so RLS is
 * the access control. No admin client. The company-admin-or-platform-admin
 * check in `readBackupPage` is a convenience gate (Open Item 4).
 *
 * Next.js 16: `context.params` is a Promise.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireCloudSession();
    const user = session.snapshot.user;
    const url = new URL(request.url);
    const result = await readBackupPage(
      session.supabase,
      {
        actingAs: session.actingAs,
        user: {
          id: user?.id ?? "",
          email: user?.email ?? "",
          displayName: user?.displayName ?? "",
          isPlatformAdmin: Boolean(user?.isPlatformAdmin),
        },
      },
      id,
      { after: url.searchParams.get("after"), limit: url.searchParams.get("limit") },
    );
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
