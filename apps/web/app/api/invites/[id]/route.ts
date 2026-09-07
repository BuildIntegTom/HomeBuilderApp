import { HttpError, errorResponse, requireSession } from "@/app/auth/serverSession";

/**
 * Withdraw an unaccepted invite.
 *
 * No entitlement check here on purpose: the `invites_delete` policy already
 * says "a company admin of that invite's company, or a platform admin", and it
 * knows which company the invite belongs to without being told. A denial shows
 * up as zero rows deleted rather than as an error, which is why the row count
 * is checked instead of the error.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { supabase } = await requireSession();
    if (!supabase) throw new HttpError(401, "Not signed in");

    const { data, error } = await supabase.from("invites").delete().eq("id", id).select("id");
    if (error) throw new HttpError(403, "You can't withdraw that invite");
    if (!data || data.length === 0) {
      throw new HttpError(403, "You can't withdraw that invite");
    }

    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
