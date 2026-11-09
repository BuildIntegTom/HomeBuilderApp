"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/auth/AccountControl.module.css";
import { claimOutcomeMessage, type ClaimStatus } from "@/app/cloud/shareLinkDisplay";

/**
 * The claim half of the share-link page: the one button that turns a URL into
 * access, for somebody who is signed in.
 *
 * ⚠ IT DOES NOT CREATE AN ACCOUNT, and that is the single biggest gap between
 * this page and the flow Tommy described on 2026-11-08. Signing up is still
 * invite-only, so a client with no account currently has nowhere to go from
 * here. He chose, when asked, that **a live link should itself authorize
 * signing up** — the link IS the invite — and that is the next stride: it
 * needs a migration (an `anon`-reachable function that vouches for the token)
 * and one decision about email confirmation, because unlike an invite a share
 * link usually does not name an address, so nothing proves the visitor owns
 * the one they type.
 *
 * Until then this component says so plainly rather than showing a sign-up form
 * that cannot work, or a bare "sign in" that leaves a stranger wondering
 * whether they were supposed to already have an account.
 */
export default function ClaimShareLink({
  token,
  signedInAs,
  projectName,
}: {
  token: string;
  signedInAs: string | null;
  projectName: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<ClaimStatus | null>(null);

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

  if (!signedInAs) {
    return (
      <div>
        <p>
          To open this design you need an account — that is what keeps it from being public, while
          still letting you watch the building change.
        </p>
        {/* ⚠ Deliberately does not promise a sign-up that does not exist yet.
            Saying "ask them to invite you" is the true instruction today. */}
        <p className={styles.notice}>
          Accounts are invite-only at the moment. If you already have one, sign in from the editor
          and open this link again. If you don&apos;t, reply to whoever sent you this and ask them
          to invite you — then this link will work.
        </p>
        <button type="button" className={styles.primaryButton} onClick={() => router.push("/")}>
          Go to the editor to sign in
        </button>
      </div>
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
