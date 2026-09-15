import { DOCUMENT_TOO_LARGE_MESSAGE } from "./cloudTypes";

/**
 * The editor's one way of calling the /api/projects/** and sharing routes.
 * Moved out of useCloudProjects in Stage 3B so the access-list note can use it
 * too, unchanged: an error is always the route's own `error` text, never a
 * database message (the routes never forward one).
 */
export type FetchResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

export async function cloudFetch<T>(url: string, init?: RequestInit): Promise<FetchResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      ...init,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return { ok: false, status: 0, message: "Couldn't reach the server. Nothing was saved or changed." };
  }
  const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
  if (!response.ok) {
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : response.status === 413
          ? // A platform body-limit refusal arrives before our route and is not JSON.
            DOCUMENT_TOO_LARGE_MESSAGE
          : `The server refused that (${response.status}). Nothing was saved or changed.`;
    return { ok: false, status: response.status, message };
  }
  return { ok: true, data: payload as T };
}
