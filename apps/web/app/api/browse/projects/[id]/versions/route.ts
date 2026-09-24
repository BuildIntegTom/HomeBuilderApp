import { NO_STORE, cloudErrorResponse, requireCloudSession } from "@/app/cloud/cloudRouteSession";
import { browseVersions } from "@/app/cloud/browseRouteLogic";

/**
 * GET /api/browse/projects/[id]/versions — one browsable project's version
 * list (Stage 4B): number, Saved / Renamed to …, author and date.
 *
 * TWO THINGS STAGE 2C'S LIST SHOWS ARE NOT HERE, and neither is a missing value
 * to paper over or refetch (narrowed 2026-09-23, in SQL, after 4A's review):
 * the save note is never served on this path, because free text is exactly
 * where a price gets written; and an author name that is an email address comes
 * back as "a member of <company>". Both come out of `browse_versions` that way.
 *
 * `redactionKnown` false means `browse_version` will refuse that version
 * (`0A000`): the row says it cannot be shown and offers NO download of any
 * kind. Stage 2C's "Download this version's file" hands over the untouched
 * stored document, which on this path would be a hole straight through
 * decision 21 rather than a courtesy.
 *
 * Next.js 16: `context.params` is a Promise.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireCloudSession();
    const result = await browseVersions(session.supabase, id);
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
