"use client";

import { useState } from "react";
import styles from "./auth/AccountControl.module.css";
import { proposalUrl } from "./cloud/proposalPath";
import {
  PROPOSAL_SENT_HEADLINE,
  PROPOSAL_SENT_INSTRUCTION,
  PROPOSAL_SENT_KEEP_IT,
} from "./cloud/proposalDisplay";

/**
 * **Send as a proposal** — the one thing on Home that works with no account
 * and nothing saved.
 *
 * > *"building integrity can recieve a link from a not signed in account"* —
 * > Tommy, 2026-11-08
 *
 * ⚠ **It sits beside Share deliberately, and it is the answer to what Share
 * cannot do.** `shareStep` spends three of its four states explaining that
 * sharing needs an account and a saved design; this needs neither, which is
 * the whole point of the feature and is invisible unless the two are next to
 * each other.
 *
 * ⚠ **The link it returns is the ONLY copy.** The database stores the token's
 * SHA-256 and nothing else, and the sender has no account the proposal could
 * be looked up from — so this component keeps the URL on screen rather than
 * flashing a toast, and says so in as many words.
 *
 * ⚠ **The name is optional and the address is OPTIONAL AND UNUSED so far.**
 * `proposal_preview` returns the name to whoever opens the link and never
 * returns the address; the address is stored so a company that adopts a design
 * can reply to whoever sent it, which is a later feature. Asking for something
 * nothing yet reads is worth saying out loud rather than leaving as a field
 * that appears to do more than it does.
 */
export default function SendAsProposal({
  buildDocument,
  hasDrawing,
}: {
  buildDocument: () => unknown;
  hasDrawing: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  if (!hasDrawing) {
    return (
      <p className={styles.notice} data-home-proposal-note="">
        Start a building first — a proposal is a design you send to somebody.
      </p>
    );
  }

  if (link) {
    return (
      <div data-home-proposal-link="">
        <p className={styles.ok}>{PROPOSAL_SENT_HEADLINE}</p>
        {/* ⚠ Read-only rather than disabled: a disabled input cannot be
            selected, and somebody whose clipboard permission was refused has
            no other way to get the link out of the page. */}
        <input className={styles.input} value={link} readOnly data-home-proposal-url="" />
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => {
            void navigator.clipboard
              ?.writeText(link)
              .then(() => setCopied(true))
              .catch(() => setCopied(false));
          }}
        >
          {copied ? "Copied" : "Copy the link"}
        </button>
        <p className={styles.notice}>{PROPOSAL_SENT_INSTRUCTION}</p>
        <p className={styles.notice}>{PROPOSAL_SENT_KEEP_IT}</p>
      </div>
    );
  }

  const send = async () => {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/proposals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          document: buildDocument(),
          submitterName: name.trim() || null,
          submitterEmail: email.trim() || null,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; token?: string };
      if (!response.ok || !payload.token) {
        throw new Error(payload?.error ?? "Couldn't make a proposal link");
      }
      setLink(proposalUrl(window.location.origin, payload.token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't make a proposal link");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        className={styles.primaryButton}
        onClick={() => setOpen(true)}
        data-home-proposal=""
      >
        Send as a proposal…
      </button>
    );
  }

  return (
    <div data-home-proposal-form="">
      <p>
        This makes a link to a copy of what you have drawn, which you can send to a company. You
        do not need an account, and nothing is sent anywhere until you send the link yourself.
      </p>
      <label className={styles.field}>
        Your name <span className={styles.notice}>(optional)</span>
        <input
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="So they know who it is from"
        />
      </label>
      <label className={styles.field}>
        Your email <span className={styles.notice}>(optional)</span>
        <input
          className={styles.input}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="So they can reply"
        />
      </label>
      {/* ⚠ Said plainly, because the field asks for an address and nothing
          currently uses it. */}
      <p className={styles.notice}>
        Whoever opens the link sees your name, if you give one. Your email is never shown to
        them — it is only there so the company can reply to you.
      </p>
      {error ? <p className={styles.error}>{error}</p> : null}
      <button
        type="button"
        className={styles.primaryButton}
        onClick={() => void send()}
        disabled={busy}
      >
        {busy ? "Making the link…" : "Make the link"}
      </button>
    </div>
  );
}
