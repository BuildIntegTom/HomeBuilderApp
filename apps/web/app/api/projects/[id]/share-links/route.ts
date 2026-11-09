import { readJsonBody } from "@/app/auth/serverSession";
import { generateShareLinkToken, hashShareLinkToken, shareLinkExpiryFrom } from "@/app/auth/shareLinkToken";
import { NO_STORE, cloudErrorResponse, requireCloudSession } from "@/app/cloud/cloudRouteSession";
import { createShareLink, listShareLinks, parseMintRequest } from "@/app/cloud/shareLinkRouteLogic";

/**
 * GET  /api/projects/[id]/share-links — every link on this project, newest
 *      first, each with its live claims. Behind `project_share_links`, which
 *      is `security invoker`, so the table's own policy decides.
 * POST /api/projects/[id]/share-links — mint one. Body may carry
 *      `{ lockedEmail }` and `{ grantsWrite }`; both default to the cautious
 *      answer. 201 with the token, ONCE.
 *
 * ⚠ THE TOKEN IS GENERATED HERE AND RETURNED ONCE. The database stores only
 * its SHA-256, so this response body is the only moment the link exists
 * anywhere outside the caller's clipboard. It is deliberately not written to a
 * log, not put in the URL, and not recoverable afterwards: `MINT_COPY_NOW_MESSAGE`
 * is the UI telling the truth about that, not a nicety.
 *
 * ⚠ A URL is NOT built here. The route returns the bare token and the client
 * composes the link from `window.location.origin`, because the server does not
 * reliably know which host the person is looking at — a preview deployment, a
 * custom domain and localhost are all legitimate, and a link built from the
 * wrong one is a dead end that looks like a bug in the database.
 *
 * Next.js 16: `context.params` is a Promise.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireCloudSession();
    const result = await listShareLinks(session.supabase, id);
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireCloudSession();
    const { lockedEmail, grantsWrite } = parseMintRequest(await readJsonBody(request));

    const token = generateShareLinkToken();
    const minted = await createShareLink(session.supabase, id, hashShareLinkToken(token), shareLinkExpiryFrom(new Date()), {
      lockedEmail,
      grantsWrite,
    });

    return Response.json({ ...minted, token }, { status: 201, headers: NO_STORE });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
