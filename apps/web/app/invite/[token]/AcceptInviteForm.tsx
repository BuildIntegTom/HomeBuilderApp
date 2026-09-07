"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/auth/AccountControl.module.css";

/**
 * Set a password and take up the invitation.
 *
 * The password field says two different things depending on who is arriving,
 * and both are normal:
 *
 *  - a new person choosing a password for the account this creates;
 *  - someone who already has an account being invited to a SECOND company, in
 *    which case this is their existing password. Decision 1 expects that case
 *    explicitly — Tommy has people spanning Building Integrity and The Seed
 *    Collaborative — so it is not an error path.
 *
 * The route works out which it is; the form does not guess, it just says so.
 */
export default function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/auth/invite/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password, displayName }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error ?? "Couldn't accept that invitation");
      setDone(true);
      // Only now is a navigation appropriate: this page is not the editor, and
      // there is nothing unsaved to lose on it.
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't accept that invitation");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return <p className={styles.ok}>You&apos;re in — opening the editor…</p>;
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <label className={styles.field}>
        Email
        <input className={styles.input} value={email} readOnly />
      </label>
      <label className={styles.field}>
        Your name
        <input
          className={styles.input}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          autoComplete="name"
          placeholder="Appears on anything you save"
        />
      </label>
      <label className={styles.field}>
        Password
        <input
          className={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </label>
      <p className={styles.notice}>
        If you already have an account at this address, use your existing password — this adds the
        new company to it rather than making a second login.
      </p>
      {error && <p className={styles.error}>{error}</p>}
      <button className={styles.primaryButton} type="submit" disabled={busy}>
        {busy ? "Accepting…" : "Accept invitation"}
      </button>
    </form>
  );
}
