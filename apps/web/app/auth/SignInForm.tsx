"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";
import styles from "./AccountControl.module.css";

type Mode = "sign-in" | "mfa" | "forgot";

/**
 * Sign in, present a two-factor code, or ask for a password reset.
 *
 * Nothing here navigates. The whole exchange is fetches, so a guest who has
 * been designing for an hour signs in without the editor noticing — which is
 * the normal flow, not an edge case ("design something, then sign in to save
 * it"). If a future change makes this submit a form to a URL, that property is
 * gone.
 *
 * There is no sign-up link, and there must not be one: accounts exist only
 * through an invite from a company admin.
 */
export default function SignInForm({ onDone }: { onDone: () => void }) {
  const { signIn, submitMfaCode, session } = useAuth();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [factor, setFactor] = useState<{ factorId: string; challengeId?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!session.backendConfigured) {
    return (
      <p className={styles.notice}>
        Sign-in isn&apos;t configured on this deployment. The editor, and Save/Load Project, work
        exactly as they always have.
      </p>
    );
  }

  const handleSignIn = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await signIn(email, password);
      if (result.mfaRequired && result.factorId) {
        setFactor({ factorId: result.factorId, challengeId: result.challengeId });
        setMode("mfa");
      } else {
        onDone();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in");
    } finally {
      setBusy(false);
    }
  };

  const handleCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!factor) return;
    setError(null);
    setBusy(true);
    try {
      await submitMfaCode({ ...factor, code });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code didn't work");
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error("Couldn't send that");
      // Deliberately the same message whether or not the address has an
      // account — the alternative tells a stranger who works here.
      setNotice("If that address has an account, a reset link is on its way.");
      setMode("sign-in");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that");
    } finally {
      setBusy(false);
    }
  };

  if (mode === "mfa") {
    return (
      <form className={styles.form} onSubmit={handleCode}>
        <p className={styles.notice}>
          Enter the six-digit code from your authenticator app.
        </p>
        <label className={styles.field}>
          Code
          <input
            className={styles.input}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
          />
        </label>
        {error && <p className={styles.error}>{error}</p>}
        <button className={styles.primaryButton} type="submit" disabled={busy}>
          {busy ? "Checking…" : "Verify"}
        </button>
      </form>
    );
  }

  if (mode === "forgot") {
    return (
      <form className={styles.form} onSubmit={handleForgot}>
        <label className={styles.field}>
          Email
          <input
            className={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
          />
        </label>
        {error && <p className={styles.error}>{error}</p>}
        <button className={styles.primaryButton} type="submit" disabled={busy}>
          {busy ? "Sending…" : "Send a reset link"}
        </button>
        <button className={styles.linkButton} type="button" onClick={() => setMode("sign-in")}>
          Back to sign in
        </button>
      </form>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSignIn}>
      <label className={styles.field}>
        Email
        <input
          className={styles.input}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </label>
      <label className={styles.field}>
        Password
        <input
          className={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </label>
      {error && <p className={styles.error}>{error}</p>}
      {notice && <p className={styles.ok}>{notice}</p>}
      <button className={styles.primaryButton} type="submit" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <button className={styles.linkButton} type="button" onClick={() => setMode("forgot")}>
        Forgot your password?
      </button>
      <p className={styles.notice}>
        Accounts are created by invitation from a company admin. Signing in adds cloud saving later;
        it does not unlock the editor, which is already fully open.
      </p>
    </form>
  );
}
