import {
  VERSION_SCAN_CAP,
  buildMemberSummaries,
  type MembershipRowInput,
  type ProfileRowInput,
  type ProjectRowInput,
  type VersionRowInput,
} from "@/app/auth/peopleActivity";
import { HttpError, errorResponse, requireSession } from "@/app/auth/serverSession";
import type { CompanyMemberSummary } from "@/app/auth/types";

/**
 * Who is at this company, how long they have been here, and what they have
 * saved. The list a company admin manages people from, and the same list an
 * ordinary member sees their own stats on.
 *
 * The RLS policies decide what this returns — a plain member gets back only
 * their own row, an admin gets everyone's. The route does not filter, and does
 * not consult `session.entitlements` either.
 *
 * That second part is the rule, not an omission. Entitlements answer "which
 * company may I act as"; they are built from memberships and say nothing about
 * whether you may administer a company. Gating a route on them refuses things
 * the policies allow, and it does so invisibly to a platform admin, who holds an
 * entitlement to every company. `requireEntitlement` is for one thing: checking
 * the acting-as claim itself, in /api/acting-as. It has exactly one caller.
 *
 * Four reads, never one per member — a company of twenty would otherwise cost
 * twenty round trips:
 *
 *   1. this company's memberships (id, user, level, created_at);
 *   2. the profiles behind them, by the ids the database just returned;
 *   3. this company's projects, which is what scopes every count below;
 *   4. the most recent versions of those projects, capped.
 *
 * `document` is never selected. A count, a date and a project name need none of
 * it, and Stage 4's redaction question never arises here.
 *
 * Ids are passed to `.eq()` / `.in()`, never spliced into a filter string.
 *
 * Next.js 16: `context.params` is a Promise. The synchronous form was removed,
 * not deprecated.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: companyId } = await context.params;
    const session = await requireSession();
    if (!session.supabase) throw new HttpError(401, "Not signed in");
    const db = session.supabase;

    const { data: membershipRows, error } = await db
      .from("memberships")
      .select("id, user_id, level, created_at")
      .eq("company_id", companyId);

    if (error) throw new HttpError(403, "You can't read that company's members");

    const memberships = (membershipRows ?? []) as MembershipRowInput[];
    const userIds = memberships.map((m) => m.user_id);

    // This company's projects, and nothing else. It is this filter (and
    // `project_versions_select`, which says the same thing in the database)
    // that makes every count below a per-company count rather than a total.
    const [profileResult, projectResult] = await Promise.all([
      userIds.length
        ? db.from("user_profiles").select("id, email, display_name").in("id", userIds)
        : Promise.resolve({ data: [] as ProfileRowInput[], error: null }),
      db.from("projects").select("id, name").eq("company_id", companyId),
    ]);

    const projects = (projectResult.data ?? []) as ProjectRowInput[];
    const projectIds = projects.map((p) => p.id);

    // Newest first and capped, so one read serves both the counts and each
    // member's latest actions. A company with more versions than the cap gets
    // counts that are floors, and `scanCapped` makes the page say so.
    const versionResult = projectIds.length
      ? await db
          .from("project_versions")
          .select("id, project_id, author_id, author_name, kind, version_number, created_at")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false })
          .limit(VERSION_SCAN_CAP)
      : { data: [] as VersionRowInput[], error: null };

    const versions = (versionResult.data ?? []) as VersionRowInput[];

    const members: CompanyMemberSummary[] = buildMemberSummaries({
      memberships,
      profiles: (profileResult.data ?? []) as ProfileRowInput[],
      projects,
      versions,
      scanCapped: versions.length >= VERSION_SCAN_CAP,
    });

    return Response.json({ members }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
