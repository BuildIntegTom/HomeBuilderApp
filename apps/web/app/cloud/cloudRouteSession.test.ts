import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServerSession } from "../auth/serverSession";
import { GUEST_SESSION } from "../auth/types";

// requireSession is replaced per test; everything else in serverSession
// (HttpError, errorResponse) is the real module.
vi.mock("../auth/serverSession", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../auth/serverSession")>();
  return { ...actual, requireSession: vi.fn() };
});

const serverSession = await import("../auth/serverSession");
const { HttpError } = serverSession;
const requireSession = vi.mocked(serverSession.requireSession);
const { NO_STORE, cloudErrorResponse, requireCloudSession } = await import("./cloudRouteSession");
const { ProjectRouteError } = await import("./projectRouteLogic");

const fakeClient = {} as NonNullable<ServerSession["supabase"]>;
const user = { id: "u1", email: "m@bi.test", displayName: "M", isPlatformAdmin: false, hasTwoFactor: true };
const session = (overrides: Partial<ServerSession["snapshot"]> = {}, supabase: ServerSession["supabase"] = fakeClient): ServerSession => ({
  snapshot: { ...GUEST_SESSION, backendConfigured: true, user, ...overrides },
  supabase,
  entitlements: [],
  actingAs: null,
});

async function statusOf(promise: Promise<unknown>): Promise<{ status: number; error: string }> {
  try {
    await promise;
  } catch (error) {
    const response = cloudErrorResponse(error);
    return { status: response.status, error: ((await response.json()) as { error: string }).error };
  }
  throw new Error("expected a refusal");
}

afterEach(() => {
  requireSession.mockReset();
  vi.restoreAllMocks();
});

describe("requireCloudSession", () => {
  it("401s with no session (requireSession's own refusal passes straight through)", async () => {
    requireSession.mockRejectedValue(new HttpError(401, "Not signed in"));
    await expect(statusOf(requireCloudSession())).resolves.toEqual({ status: 401, error: "Not signed in" });
  });

  it("401s for a session with no Supabase client", async () => {
    requireSession.mockResolvedValue(session({}, null));
    expect((await statusOf(requireCloudSession())).status).toBe(401);
  });

  it("401s while a second factor is pending, saying so (the aal RLS policy is the gate; this is the message)", async () => {
    requireSession.mockResolvedValue(session({ mfaPending: true }));
    const result = await statusOf(requireCloudSession());
    expect(result.status).toBe(401);
    expect(result.error).toMatch(/two-factor code/);
  });

  it("returns the session's own JWT-bound client when signed in and not pending", async () => {
    const ok = session();
    requireSession.mockResolvedValue(ok);
    await expect(requireCloudSession()).resolves.toBe(ok);
  });
});

describe("the real requireSession, with no backend configured", () => {
  it("401s: a request with no Supabase session gets nothing", async () => {
    const actual = await vi.importActual<typeof import("../auth/serverSession")>("../auth/serverSession");
    let status = 0;
    try {
      await actual.requireSession();
    } catch (error) {
      status = (error as { status: number }).status;
    }
    expect(status).toBe(401);
  });
});

describe("cloudErrorResponse", () => {
  it("passes a ProjectRouteError's status and message through", async () => {
    const response = cloudErrorResponse(new ProjectRouteError(409, "You're now acting as Rare Forms (changed in another tab). Nothing was saved."));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "You're now acting as Rare Forms (changed in another tab). Nothing was saved." });
  });

  it("turns anything else into a 500 that does not echo a Postgres message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = cloudErrorResponse({ code: "XX000", message: 'relation "project_versions" policy blah' });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Something went wrong" });
  });

  it("marks answers no-store", () => {
    expect(NO_STORE["cache-control"]).toMatch(/no-store/);
  });
});
