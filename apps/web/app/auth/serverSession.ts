import { cache } from "react";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeEntitlements,
  resolveActingAs,
  type CompanyRow,
  type Entitlement,
  type MembershipRow,
} from "./actingAs";
import { createSupabaseServerClient, isBackendConfigured } from "./supabaseServer";
import { GUEST_SESSION, type SessionSnapshot } from "./types";

/**
 * The data access layer for identity. Every route handler starts here.
 *
 * The one rule this file exists to enforce: the acting-as company is read from
 * a cookie, which is a claim the client made, and is then checked against the
 * memberships the database actually returns — on every request, not at sign-in.
 * A revoked membership therefore stops working on the next request without
 * anything having to notice that it was revoked.
 */

/**
 * Which company the browser last asked to act as. httpOnly on purpose: the
 * client never reads it and never needs to, because the client is told the
 * *verified* acting-as company by /api/session. Nothing downstream should ever
 * read this cookie except `loadSession` below.
 */
export const ACTING_AS_COOKIE = "bi_acting_as";

export const ACTING_AS_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 365,
} as const;

export interface ServerSession {
  snapshot: SessionSnapshot;
  /** Null for a guest, or when no backend is configured. */
  supabase: SupabaseClient | null;
  entitlements: Entitlement[];
  actingAs: Entitlement | null;
}

const GUEST: ServerSession = {
  snapshot: GUEST_SESSION,
  supabase: null,
  entitlements: [],
  actingAs: null,
};

interface CompanyRecord {
  id: string;
  name: string;
  is_seed_member: boolean;
  is_consortium: boolean;
}

interface MembershipRecord {
  company_id: string;
  level: "member" | "admin";
  is_default: boolean;
}

/**
 * Memoised for the duration of one request (React `cache`), so a handler can
 * ask for the session as many times as it likes and still make one round trip.
 */
export const loadSession = cache(async (): Promise<ServerSession> => {
  if (!isBackendConfigured()) {
    return GUEST;
  }

  const supabase = await createSupabaseServerClient();

  // getUser(), not getSession(): getSession() reports whatever the cookie says
  // without asking Supabase whether it is still true. Anything that decides
  // permissions has to be the checked one.
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const authUser = userError ? null : userData.user;

  if (!authUser) {
    return { ...GUEST, snapshot: { ...GUEST_SESSION, backendConfigured: true }, supabase };
  }

  const [profileResult, membershipResult, companyResult, factorResult, aalResult] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("display_name, is_platform_admin, email")
      .eq("id", authUser.id)
      .maybeSingle(),
    supabase.from("memberships").select("company_id, level, is_default"),
    supabase.from("companies").select("id, name, is_seed_member, is_consortium"),
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);

  // "Should have presented a second factor, hasn't yet." Only reachable for an
  // account that opted in — nothing here can make 2FA required.
  //
  // Derived the same way as requireSatisfiedAal, and for the same reason: whether
  // a factor exists comes from listFactors() (a network call to getUser), never
  // from nextLevel, which is read out of an unsigned cookie. This one only drives
  // a UI hint, but two ways of asking one question is how the two drift apart.
  const hasVerifiedFactor = (factorResult.data?.totp ?? []).some(
    (f) => f.status === "verified",
  );
  const mfaPending = hasVerifiedFactor && aalResult.data?.currentLevel !== "aal2";

  const memberships: MembershipRow[] = ((membershipResult.data ?? []) as MembershipRecord[]).map(
    (m) => ({ companyId: m.company_id, level: m.level, isDefault: m.is_default }),
  );

  const companies: CompanyRow[] = ((companyResult.data ?? []) as CompanyRecord[]).map((c) => ({
    id: c.id,
    name: c.name,
    isSeedMember: c.is_seed_member,
    isConsortium: c.is_consortium,
  }));

  const isPlatformAdmin = Boolean(profileResult.data?.is_platform_admin);

  const entitlements = computeEntitlements({ memberships, companies, isPlatformAdmin });

  const cookieStore = await cookies();
  const claimed = cookieStore.get(ACTING_AS_COOKIE)?.value ?? null;
  const resolution = resolveActingAs(entitlements, claimed);

  const actingAs = resolution.kind === "none" ? null : resolution.entitlement;

  return {
    supabase,
    entitlements,
    actingAs,
    snapshot: {
      backendConfigured: true,
      mfaPending,
      user: {
        id: authUser.id,
        email: profileResult.data?.email ?? authUser.email ?? "",
        displayName: profileResult.data?.display_name ?? "",
        isPlatformAdmin,
        // Only a factor the user finished enrolling counts. A half-enrolled
        // factor is not two-factor, and 2FA is optional regardless.
        hasTwoFactor: hasVerifiedFactor,
      },
      entitlements,
      actingAsCompanyId: actingAs?.companyId ?? null,
      actingAsCompanyName: actingAs?.companyName ?? null,
      actingAsLevel: actingAs?.source === "membership" ? actingAs.level : null,
      actingAsRejectedCompanyId:
        resolution.kind === "fallback" || resolution.kind === "none"
          ? resolution.rejectedCompanyId
          : null,
    },
  };
});

/** Every authenticated route handler's first line. */
export async function requireSession(): Promise<ServerSession> {
  const session = await loadSession();
  if (!session.snapshot.user || !session.supabase) {
    throw new HttpError(401, "Not signed in");
  }
  return session;
}

/**
 * Refuse a request from a session that has proved a password but not the second
 * factor the account actually has.
 *
 * WRITTEN BECAUSE THE ASSUMPTION WAS NOT VERIFIED. An earlier version of the
 * unenrol route carried a comment asserting that "Supabase enforces the caller
 * is at aal2 by the time they can reach this". Nothing in this codebase checked
 * it and it was never confirmed against GoTrue. If it had been false, a
 * password-only session on a two-factor account could have deleted the factor
 * and then read everything — which is precisely the gate
 * supabase/migrations/0004 exists to hold.
 *
 * So it is checked here instead of assumed. The four tables are covered by
 * 0004's restrictive policies; this covers the routes that talk to Supabase Auth
 * rather than to those tables — removing a factor, and changing a password from
 * an already-signed-in session.
 *
 * It cannot make two-factor mandatory: only an account that enrolled a factor of
 * its own accord is ever asked. An account without one passes untouched, which
 * is the supported and common case.
 *
 * WHICH HALF IS TRUSTWORTHY, because the first version of this got it wrong.
 * `getAuthenticatorAssuranceLevel()` called with no argument reads `nextLevel`
 * off the user object in the @supabase/ssr cookie — base64 JSON with no
 * signature over it in ssr 0.7, so a caller can delete their own `factors` array
 * and be waved through. That landed us straight back on the GoTrue assumption
 * this function exists to replace. So:
 *
 *   - whether a verified factor EXISTS comes from `listFactors()`, which calls
 *     `getUser()` over the network and is therefore the server's answer, not the
 *     cookie's;
 *   - whether it was PRESENTED comes from `currentLevel`, which is decoded from
 *     the signed access token and cannot be edited.
 *
 * Both calls fail closed. Reading `data?.` and discarding the error would mean a
 * network blip silently downgraded this to "no second factor needed".
 */
export async function requireSatisfiedAal(supabase: SupabaseClient): Promise<void> {
  const factors = await supabase.auth.mfa.listFactors();
  if (factors.error) {
    throw new HttpError(401, "Couldn't confirm your two-factor status — try again");
  }
  const hasVerifiedFactor = (factors.data?.totp ?? []).some((f) => f.status === "verified");
  if (!hasVerifiedFactor) return;

  const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal.error) {
    throw new HttpError(401, "Couldn't confirm your two-factor status — try again");
  }
  if (aal.data?.currentLevel !== "aal2") {
    throw new HttpError(401, "Enter your two-factor code before changing this");
  }
}

/**
 * For a route that acts on a specific company: check the company the caller
 * named against the entitlements they actually hold. A claim that does not
 * survive this is refused outright rather than quietly redirected somewhere the
 * caller did not ask for — the silent version is how you write into the wrong
 * company's tree.
 */
export async function requireEntitlement(companyId: string): Promise<{
  session: ServerSession;
  entitlement: Entitlement;
}> {
  const session = await requireSession();
  const entitlement = session.entitlements.find((e) => e.companyId === companyId);
  if (!entitlement) {
    throw new HttpError(403, "You cannot act as that company");
  }
  return { session, entitlement };
}

/**
 * Read and shallow-validate a JSON body. Route handlers are public-facing API
 * endpoints and get treated as such: nothing here trusts the shape it is sent.
 */
export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Expected a JSON body");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Expected a JSON object");
  }
  return body as Record<string, unknown>;
}

export function requireString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, `Missing "${key}"`);
  }
  return value.trim();
}

export function optionalString(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new HttpError(400, `"${key}" must be a string`);
  return value.trim();
}

export function requireLevel(body: Record<string, unknown>, key: string): "member" | "admin" {
  const value = body[key];
  if (value !== "member" && value !== "admin") {
    throw new HttpError(400, `"${key}" must be "member" or "admin"`);
  }
  return value;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Uniform error envelope, so the client never has to guess at a shape. */
export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  // Anything unexpected is reported without its internals: a Postgres error
  // message can name policies and columns.
  console.error("[auth route]", error);
  return Response.json({ error: "Something went wrong" }, { status: 500 });
}
