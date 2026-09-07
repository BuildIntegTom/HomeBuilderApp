import {
  HttpError,
  errorResponse,
  readJsonBody,
  requireLevel,
  requireSession,
} from "@/app/auth/serverSession";

/**
 * Change a membership: its level, or whether it is your default company.
 *
 * Both are one table and one set of rules, and the rules are in the database:
 *
 *  - `memberships_update` lets you touch your own row or, as a company admin,
 *    any row of your company;
 *  - `guard_membership_self_update` then narrows the "your own row" case to
 *    `is_default` alone, so nobody promotes themselves;
 *  - `guard_last_company_admin` refuses the demotion that would leave a company
 *    with no admin;
 *  - `apply_membership_default` clears the previous default rather than
 *    colliding with the one-default-per-user index.
 *
 * None of that is re-implemented here. A refusal comes back as an error from
 * the trigger, or as zero rows from the policy.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { supabase } = await requireSession();
    if (!supabase) throw new HttpError(401, "Not signed in");

    const body = await readJsonBody(request);
    const patch: { level?: "member" | "admin"; is_default?: boolean } = {};

    if (body.level !== undefined) patch.level = requireLevel(body, "level");
    if (body.isDefault !== undefined) {
      if (typeof body.isDefault !== "boolean") throw new HttpError(400, '"isDefault" must be a boolean');
      // Only ever set true. Clearing your default without naming a replacement
      // would leave you with no company to be acting as at next sign-in.
      if (!body.isDefault) throw new HttpError(400, "Choose another company as your default instead");
      patch.is_default = true;
    }
    if (Object.keys(patch).length === 0) throw new HttpError(400, "Nothing to change");

    const { data, error } = await supabase
      .from("memberships")
      .update(patch)
      .eq("id", id)
      .select("id, company_id, level, is_default");

    if (error) throw new HttpError(403, error.message);
    if (!data || data.length === 0) throw new HttpError(403, "You can't change that membership");

    return Response.json({ membership: data[0] });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Revoke a membership, or leave a company yourself.
 *
 * Decision 6: "access revoked, their work stays with the company, their name
 * stays on versions they saved." Nothing here touches anything the person
 * authored — attribution is history, not access. From the next request onward
 * they simply stop being able to act as that company, because `can_act_as` is
 * re-derived from the memberships table every time rather than cached anywhere.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { supabase } = await requireSession();
    if (!supabase) throw new HttpError(401, "Not signed in");

    const { data, error } = await supabase.from("memberships").delete().eq("id", id).select("id");

    if (error) {
      // The likely one is the last-admin guard, whose message is worth showing.
      throw new HttpError(409, error.message);
    }
    if (!data || data.length === 0) throw new HttpError(403, "You can't remove that membership");

    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
