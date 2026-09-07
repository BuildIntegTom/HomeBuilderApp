"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/auth/AccountControl.module.css";

/**
 * Reset link → (two-factor code, if the account has one) → new password.
 *
 * The code step exists because the alternative is a lockout: a recovery link
 * proves control of a mailbox, which is one factor, and an account that turned
 * two-factor on should not have it undone by a mailbox alone — but refusing
 * without offering anywhere to type the code strands the first person who
 * enrols a factor and forgets their password. The server decides whether the
 * step is needed and says so; this form never guesses.
 */
export default function ResetPasswordForm({
  code,
  tokenHash,
}: {
  code: string | null;
  tokenHash: string | null;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Those two passwords don't match");
      return;
    }
    if (mfaRequired && totpCode.trim().length === 0) {
      setError("Enter the code from your authenticator app");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/password-update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          password,
          code,
          tokenHash,
          totpCode: totpCode.trim() || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload?.mfaRequired) {
          // The link has already been consumed by this request; the session it
          // established is in the cookie, so resubmitting with the code works.
          setMfaRequired(true);
        }
        throw new Error(payload?.error ?? "Couldn't set that password");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't set that password");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <>
        <p className={styles.ok}>Password changed. You&apos;re signed in.</p>
        <button className={styles.primaryButton} type="button" onClick={() => router.push("/")}>
          Open the editor
        </button>
      </>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <label className={styles.field}>
        New password
        <input
          className={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </label>
      <label className={styles.field}>
        Again
        <input
          className={styles.input}
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </label>
      {mfaRequired && (
        <>
          <p className={styles.notice}>
            This account uses two-factor. Enter the current six-digit code from your authenticator
            app to finish.
          </p>
          <label className={styles.field}>
            Two-factor code
            <input
              className={styles.input}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
            />
          </label>
        </>
      )}
      {error && <p className={styles.error}>{error}</p>}
      <button className={styles.primaryButton} type="submit" disabled={busy}>
        {busy ? "Saving…" : mfaRequired ? "Verify and set password" : "Set password"}
      </button>
    </form>
  );
}
