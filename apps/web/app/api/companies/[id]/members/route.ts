import { HttpError, errorResponse, requireSession } from "@/app/auth/serverSession";
import type { CompanyMemberSummary } from "@/app/auth/types";

/**
 * Who is at this company. The list a company admin manages people from.
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

    const { data: memberships, error } = await session.supabase
      .from("memberships")
      .select("id, user_id, level")
      .eq("company_id", companyId);

    if (error) throw new HttpError(403, "You can't read that company's members");

    const userIds = (memberships ?? []).map((m) => m.user_id as string);
    const profiles = userIds.length
      ? await session.supabase
          .from("user_profiles")
          .select("id, email, display_name")
          .in("id", userIds)
      : { data: [] as { id: string; email: string; display_name: string }[] };

    const byId = new Map(
      ((profiles.data ?? []) as { id: string; email: string; display_name: string }[]).map((p) => [
        p.id,
        p,
      ]),
    );

    const members: CompanyMemberSummary[] = (memberships ?? []).map((m) => ({
      membershipId: m.id as string,
      userId: m.user_id as string,
      email: byId.get(m.user_id as string)?.email ?? "",
      displayName: byId.get(m.user_id as string)?.display_name ?? "",
      level: m.level as "member" | "admin",
    }));

    return Response.json({ members }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
