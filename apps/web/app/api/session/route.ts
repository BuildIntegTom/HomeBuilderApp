import { errorResponse, loadSession } from "@/app/auth/serverSession";

/**
 * The verified session. This is the only thing the client is ever told about
 * who it is and what it may act as — in particular the acting-as company here
 * is the one the server checked, not the one the browser's cookie asked for.
 *
 * Never cached: it is per-user and changes the moment a membership does.
 */
export async function GET() {
  try {
    const session = await loadSession();
    return Response.json(session.snapshot, {
      headers: { "cache-control": "no-store, max-age=0" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
