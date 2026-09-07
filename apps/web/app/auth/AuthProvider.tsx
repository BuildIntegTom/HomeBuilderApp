"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { GUEST_SESSION, type SessionSnapshot } from "./types";

/**
 * Client-side identity.
 *
 * Two things about the shape of this file matter more than what it does.
 *
 * 1. IT NEVER NAVIGATES. Signing in, signing out and switching company are all
 *    `fetch` calls that end in `setSession(...)`. No `router.push`, no
 *    `location.assign`, no form POST. The spec's own note — "Signing in must
 *    not discard unsaved guest work... a sign-in that navigates or remounts the
 *    editor loses the design" — is only true if it stays that way, so anything
 *    that reloads the page belongs somewhere else.
 *
 *    The provider is mounted in `layout.tsx` ABOVE `page.tsx` for the same
 *    reason: `children` is a stable element from a Server Component, so this
 *    re-rendering on sign-in does not re-render the editor at all. Only the
 *    components that actually call `useAuth()` see the change.
 *
 * 2. IT HOLDS NO PERMISSIONS. Everything here came from the server and is a
 *    display copy. The acting-as company in this object is the one the server
 *    verified; it is here so the top bar can print a name, not so anything can
 *    decide what is allowed. Permission answers live in RLS.
 *
 * Also deliberately absent: any reference to `ViewerRole`. The two axes are
 * separate, and no code path may derive one from the other.
 */

interface AuthContextValue {
  session: SessionSnapshot;
  /** True until the first /api/session answer arrives. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  submitMfaCode: (args: { factorId: string; challengeId?: string; code: string }) => Promise<void>;
  signOut: () => Promise<void>;
  setActingAs: (companyId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export interface SignInResult {
  mfaRequired: boolean;
  factorId?: string;
  challengeId?: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function postJson(url: string, body?: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : "Something went wrong",
    );
  }
  return payload;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionSnapshot>(GUEST_SESSION);
  const [loading, setLoading] = useState(true);
  // Survives unmount races: a slow /api/session answering after sign-out must
  // not resurrect the old session.
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++generation.current;
    try {
      const response = await fetch("/api/session", { cache: "no-store" });
      const snapshot = (await response.json()) as SessionSnapshot;
      if (mine === generation.current) setSession(snapshot);
    } catch {
      // A network failure means we do not know who you are; it does not mean
      // you are someone. Staying on the last known answer is the honest state.
    } finally {
      if (mine === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback<AuthContextValue["signIn"]>(
    async (email, password) => {
      const result = (await postJson("/api/auth/sign-in", { email, password })) as {
        mfaRequired?: boolean;
        factorId?: string;
        challengeId?: string;
      };
      await refresh();
      return {
        mfaRequired: Boolean(result.mfaRequired),
        factorId: result.factorId,
        challengeId: result.challengeId,
      };
    },
    [refresh],
  );

  const submitMfaCode = useCallback<AuthContextValue["submitMfaCode"]>(
    async ({ factorId, challengeId, code }) => {
      await postJson("/api/auth/mfa/verify", { factorId, challengeId, code });
      await refresh();
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    await postJson("/api/auth/sign-out");
    generation.current += 1;
    setSession({ ...GUEST_SESSION, backendConfigured: session.backendConfigured });
  }, [session.backendConfigured]);

  const setActingAs = useCallback(async (companyId: string) => {
    // The server answers with the company it VERIFIED, which is not necessarily
    // the one asked for. Taking its answer rather than the request is the whole
    // point of the control.
    const snapshot = (await postJson("/api/acting-as", { companyId })) as SessionSnapshot;
    setSession(snapshot);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, loading, signIn, submitMfaCode, signOut, setActingAs, refresh }),
    [session, loading, signIn, submitMfaCode, signOut, setActingAs, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}

/**
 * For components that may render outside the provider (the editor is usable in
 * isolation and its tests do not mount one). Returns the guest snapshot rather
 * than throwing, because "no provider" and "not signed in" mean the same thing
 * to a caller that only wants to print a name.
 */
export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}
