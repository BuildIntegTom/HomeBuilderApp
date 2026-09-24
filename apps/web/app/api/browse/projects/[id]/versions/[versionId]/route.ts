import { NO_STORE, cloudErrorResponse, requireCloudSession } from "@/app/cloud/cloudRouteSession";
import { browseVersion } from "@/app/cloud/browseRouteLogic";

/**
 * GET /api/browse/projects/[id]/versions/[versionId] — one browsed version,
 * with its REDACTED document (Stage 4B).
 *
 * THIS IS THE ONLY ROUTE THAT SERVES A BROWSED DOCUMENT, and it serves it
 * through `browse_version`, which always redacts — for every caller, including
 * one who could read the project in full and including a platform admin. The
 * Stage 2 route (`/api/projects/[id]/versions/[versionId]`) and the backup
 * route are never borrowed for browsing: they keep serving grant-holders and
 * members exactly as they do now, through RLS, and a browser gets a 404 from
 * them. Hand-test step 19 checks precisely that pair.
 *
 * A refusal to serve — an unclassified file format — comes back as SQLSTATE
 * `0A000` and is answered here as 422 "this version can't be shown". It is
 * FINAL. Nothing falls back to the Stage 2 read on it, because that read would
 * hand over the untouched stored document.
 *
 * Next.js 16: `context.params` is a Promise.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string; versionId: string }> }) {
  try {
    const { id, versionId } = await context.params;
    const session = await requireCloudSession();
    const result = await browseVersion(session.supabase, id, versionId);
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
