import { cookies } from "next/headers";
import {
  ACTING_AS_COOKIE,
  ACTING_AS_COOKIE_OPTIONS,
  errorResponse,
  readJsonBody,
  requireEntitlement,
  requireString,
} from "@/app/auth/serverSession";

/**
 * Change which company you are acting as.
 *
 * This is the whole switcher, server side, and it is three lines long on
 * purpose: `requireEntitlement` refuses anything the caller does not already
 * hold, and only then is the cookie written. There is no code path here that
 * can create an entitlement, and none that takes the client's word for one —
 * posting `{"companyId": "<someone else's>"}` straight at this route gets a
 * 403, not a switch.
 *
 * The same check runs again on every subsequent request (`loadSession` re-reads
 * the cookie and re-verifies it), so a membership revoked after this call stops
 * working immediately rather than at the end of the session.
 */
export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const companyId = requireString(body, "companyId");

    const { session, entitlement } = await requireEntitlement(companyId);

    const cookieStore = await cookies();
    cookieStore.set(ACTING_AS_COOKIE, entitlement.companyId, ACTING_AS_COOKIE_OPTIONS);

    return Response.json({
      ...session.snapshot,
      actingAsCompanyId: entitlement.companyId,
      actingAsCompanyName: entitlement.companyName,
      actingAsLevel: entitlement.source === "membership" ? entitlement.level : null,
      actingAsRejectedCompanyId: null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
