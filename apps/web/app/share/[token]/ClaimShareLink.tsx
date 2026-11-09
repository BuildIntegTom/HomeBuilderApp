"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/auth/AccountControl.module.css";
import { claimOutcomeMessage, type ClaimStatus } from "@/app/cloud/shareLinkDisplay";

/**
 * The claim half of the share-link page: what turns a URL into access.
 *
 * ⚠ **IT NOW CREATES ACCOUNTS**, which the first version of this file said in
 * as many words that it could not. Tommy settled that on 2026-11-08 — *"the
 * link is the invite to sign up too"* — so holding a live, unrevoked link is
 * itself the invitation, and `0013`'s `share_link_permits_signup` is what
 * vouches for it. The old paragraph is replaced rather than amended, because a
 * comment describing a gap that has been closed sends the next reader looking
 * for work that is already done.
 *
 * Three states, and only one of them is a failure:
 *
 *   signed out      → the sign-up form. The route tries SIGNING IN first, so
 *                     somebody who already has an account is an ordinary
 *                     outcome rather than an error.
 *   confirm-email   → Supabase's "Confirm sign up" is on and the link did not
 *                     name the address, so the account exists and is waiting
 *                     on a click in a mailbox. NOT an error, and styled as an
 *                     outcome.
 *   signed in       → one button, which claims.
 */
export default function ClaimShareLink({
  token,
  signedInAs,
  projectName,
  lockedToEmail,
}: {
  token: string;
  signedInAs: string | null;
  projectName: string | null;
  /** Whether the link names one address. ⚠ The address itself is deliberately
   * not available here — see the email field below. */
  lockedToEmail: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<ClaimStatus | null>(null);
  const [confirmNotice, setConfirmNotice] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const signUp = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/auth/share-link/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, email, password, displayName }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        outcome?: string;
        message?: string;
        status?: ClaimStatus;
      };
      if (!response.ok && response.status !== 202) {
        throw new Error(payload?.error ?? "Couldn't create that account");
      }
      if (payload.outcome === "confirm-email") {
        setConfirmNotice(payload.message ?? "Check your email to finish signing up.");
        return;
      }
      setOutcome(payload.status ?? "claimed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create that account");
    } finally {
      setBusy(false);
    }
  };

  const claim = async () => {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/share-links/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; status?: ClaimStatus };
      if (!response.ok) throw new Error(payload?.error ?? "Couldn't open that link");
      setOutcome(payload.status ?? "claimed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open that link");
    } finally {
      setBusy(false);
    }
  };

  if (outcome) {
    return (
      <div>
        <p className={styles.ok}>{claimOutcomeMessage(outcome, projectName)}</p>
        {/* ⚠ A LINK, not an automatic redirect. The editor is where the design
            opens, and pushing somebody there the instant a claim lands would
            take the confirmation off the screen before they had read it — and
            on a slow connection would look like the click did nothing, then
            jumped. They arrived from a mailbox; there is no hurry. */}
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => router.push("/")}
        >
          Open it in the editor
        </button>
      </div>
    );
  }

  if (confirmNotice) {
    /* ⚠ Not an error, and styled as an outcome rather than a failure. With
       Supabase's "Confirm sign up" on, an unconfirmed account cannot sign in
       yet — the expected next step of this flow. The link is not claimed, and
       does not need to be: the claim is idempotent, so confirming and opening
       the link again finishes it. */
    return (
      <div>
        <p className={styles.ok}>{confirmNotice}</p>
        <p className={styles.notice}>
          Nothing is lost — this link keeps working. Once you&apos;ve clicked the link in that
          email, open this page again and you&apos;ll go straight in.
        </p>
      </div>
    );
  }

  if (!signedInAs) {
    return (
      <form className={styles.form} onSubmit={signUp}>
        <p>
          To open this design you need an account — that is what keeps it from being public, while
          still letting you watch the building change.
        </p>
        {/* ⚠ This used to say accounts were invite-only and send people away to
            ask for one. Tommy changed that on 2026-11-08 — *"the link is the
            invite to sign up too"* — so holding a live link IS the invitation,
            and the form is right here. */}
        <label className={styles.field}>
          Email
          {lockedToEmail ? (
            /* ⚠ The address is NOT shown, and not because it would be
               awkward to fetch. `share_link_preview` returns a boolean
               precisely so a forwarded link cannot disclose whose it is; the
               only function that knows the address is called server-side by
               the sign-up route. So the field says the rule and the server
               enforces it. */
            <input
              className={styles.input}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="The address this link was sent to"
              required
            />
          ) : (
            <input
              className={styles.input}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          )}
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
            required
          />
          {/* Both cases in one line, because the route tries sign-in first and
              the person cannot be expected to remember which they are. */}
          <span className={styles.notice}>
            At least 8 characters. Already have an account? Use its password and you&apos;ll just be
            signed in.
          </span>
        </label>
        {error ? <p className={styles.error}>{error}</p> : null}
        <button type="submit" className={styles.primaryButton} disabled={busy}>
          {busy ? "Working…" : "Create my account and open it"}
        </button>
        <button type="button" className={styles.linkButton} onClick={() => router.push("/")}>
          I&apos;d rather sign in from the editor
        </button>
      </form>
    );
  }

  return (
    <div>
      <p>
        Signed in as {signedInAs}.{" "}
        {/* The claim is the moment access is granted, so the button says what
            it does rather than "Continue". */}
      </p>
      {error ? <p className={styles.error}>{error}</p> : null}
      <button type="button" className={styles.primaryButton} onClick={claim} disabled={busy}>
        {busy ? "Opening…" : "Add this design to my account"}
      </button>
    </div>
  );
}
