"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/auth/AccountControl.module.css";
import SignInForm from "@/app/auth/SignInForm";
import { proposalAlreadyTakenLine } from "@/app/cloud/proposalDisplay";

/**
 * The acting half of the proposal page: what turns a stranger's link into a
 * project in your company.
 *
 * Four states, and only one of them is a failure:
 *
 *   already adopted → says who took it, and offers nothing to press. ⚠ Shown
 *                     to the SENDER too, who has no account; it must read as
 *                     an answer rather than as a door closed in their face.
 *   signed out      → sign in. ⚠ NOT a sign-up form, unlike the share-link
 *                     page: holding a share link IS an invitation to make an
 *                     account (Tommy, 2026-11-08), but a proposal link points
 *                     the other way — it is somebody asking a company to look
 *                     at their design, and it vouches for nobody.
 *   no membership   → says why there is nothing to press, which is a real
 *                     state for a consortium or platform-admin account.
 *   adopted just now→ a link into the editor, not an automatic redirect.
 */
export default function AdoptProposal({
  token,
  signedInAs,
  alreadyAdopted,
  adoptedByCompanyName,
  companies,
  actingAsCompanyId,
}: {
  token: string;
  signedInAs: string | null;
  alreadyAdopted: boolean;
  adoptedByCompanyName: string | null;
  /** ⚠ Companies this person is a MEMBER of — see the page's own note. */
  companies: { id: string; name: string }[];
  actingAsCompanyId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  /* Defaults to the company the bar already says you are working as, when
     that is one you may adopt into. Anything else would quietly land the
     design somewhere other than where the rest of the app says you are. */
  const [companyId, setCompanyId] = useState(
    () => companies.find((c) => c.id === actingAsCompanyId)?.id ?? companies[0]?.id ?? "",
  );

  if (alreadyAdopted) {
    return <p className={styles.notice}>{proposalAlreadyTakenLine(adoptedByCompanyName)}</p>;
  }

  if (done) {
    return (
      <div>
        <p className={styles.ok}>
          Adopted. It is now a project of your own, in the <strong>proposals</strong> folder, and
          you can open it, change it and share it like any other.
        </p>
        {/* ⚠ A LINK, not an automatic redirect — the same reasoning the
            share-link claim records. Pushing somebody into the editor the
            instant this lands takes the confirmation off the screen before
            they have read it, and on a slow connection reads as the click
            having done nothing and then jumped. */}
        <button type="button" className={styles.primaryButton} onClick={() => router.push("/")}>
          Open the editor
        </button>
      </div>
    );
  }

  if (!signedInAs) {
    return (
      <div>
        <p>
          Sign in to take this design on. Adopting it makes a copy that belongs to your company —
          the sender keeps nothing but the link they sent you.
        </p>
        {/* ⚠ **Signed in HERE, on this page, rather than being sent away to
            come back.** `SignInForm` navigates nowhere — the whole exchange is
            fetches — so `router.refresh()` is enough to re-run the server
            component above with a session and swap this card for the Adopt
            one. Sending somebody to a sign-in page and back would need a
            return path through a URL, and a proposal token in a `?next=`
            parameter is a credential in a query string, which is the thing the
            preview route goes out of its way to avoid. */}
        <SignInForm onDone={() => router.refresh()} />
      </div>
    );
  }

  if (companies.length === 0) {
    /* ⚠ A real state, not a guard against the impossible: an account can act
       as a company through the consortium or as a platform admin without
       being a member of one, and `adopt_proposal` asks for membership. */
    return (
      <p className={styles.notice}>
        A proposal is adopted INTO a company, and this account isn&apos;t a member of one. Ask
        somebody at the company to open this link, or create a company first.
      </p>
    );
  }

  const adopt = async () => {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/proposals/adopt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, companyId }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload?.error ?? "Couldn't adopt that proposal");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't adopt that proposal");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p>
        Adopting this makes a copy that belongs to your company, in the{" "}
        <strong>proposals</strong> folder. A proposal can only be taken up once.
      </p>
      {companies.length > 1 ? (
        <label className={styles.field}>
          Adopt into
          <select
            className={styles.input}
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className={styles.notice}>It will belong to {companies[0]!.name}.</p>
      )}
      {error ? <p className={styles.error}>{error}</p> : null}
      <button type="button" className={styles.primaryButton} onClick={() => void adopt()} disabled={busy}>
        {busy ? "Adopting…" : "Adopt this proposal"}
      </button>
    </div>
  );
}
