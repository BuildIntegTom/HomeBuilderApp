"use client";

import { useCallback, useState } from "react";
import styles from "./CloudProjects.module.css";
import { cloudFetch } from "./cloudFetch";
import { shareLinkUrl } from "./shareLinkPath";
import {
  MINT_COPY_NOW_MESSAGE,
  claimCountLabel,
  linkStateLabel,
} from "./shareLinkDisplay";
import type { ShareLinkRow } from "./shareLinkRouteLogic";

/**
 * The owner side of share links, inside the Access note: mint one, see who has
 * opened it, turn it off.
 *
 * ⚠ A SEPARATE COMPONENT, not more lines in `useProjectAccess`. That hook is
 * already 450 lines carrying the grant list, the share form, the pending
 * requests and three confirmation flows; this is its own feature with its own
 * fetch, its own list and its own one-shot secret to look after. Folding it in
 * would have made the longest file in the cloud layer longer for no shared
 * state — it needs the project id and nothing else.
 *
 * ⚠ OWNER-SIDE ONLY, and that is enforced in the database, not here. The
 * caller passes `viewerIsOwnerSide` so a collaborator is not shown a panel
 * whose every button would be refused; but `create_share_link`,
 * `project_share_links` and `revoke_share_link` each check for themselves.
 * This flag decides what is drawn, never what is allowed.
 */
export default function ShareLinkSection({
  projectId,
  viewerIsOwnerSide,
}: {
  projectId: string;
  viewerIsOwnerSide: boolean;
}) {
  const [links, setLinks] = useState<ShareLinkRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  /* ⚠ The minted link lives HERE, in component state, and nowhere else.
     The database stores only its SHA-256, so this is the one copy. It is
     deliberately not written to localStorage, not put in the URL and not
     re-fetchable: a token that could be read back later would undo the whole
     reason for hashing it. The flip side is that closing the note loses it,
     which is what MINT_COPY_NOW_MESSAGE warns about. */
  const [minted, setMinted] = useState<{ url: string; grantsWrite: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const [lockedEmail, setLockedEmail] = useState("");
  const [grantsWrite, setGrantsWrite] = useState(false);

  /**
   * ⚠ **Nothing is set synchronously here, and that is the point.** The first
   * statement is the `await`, so every `setState` below happens in a later
   * microtask.
   *
   * The obvious shape — `setError(null)` at the top to clear a stale message
   * while the request is in flight — made the effect that calls this trip
   * `react-hooks/set-state-in-effect`, which `apps/web/AGENTS.md` lists among
   * the rules that may **never** rise, because they track correctness rather
   * than style. Clearing the error on SUCCESS instead loses nothing: a stale
   * message that disappears a few hundred milliseconds later is not worth a
   * cascading render, and if the reload fails the old message was telling the
   * truth anyway.
   */
  const load = useCallback(async () => {
    const result = await cloudFetch<{ links: ShareLinkRow[] }>(`/api/projects/${projectId}/share-links`);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setLinks(result.data.links);
  }, [projectId]);

  /**
   * ⚠ **There is no effect here, and there was one until lint refused it.**
   *
   * The list used to load from `useEffect(() => { if (open) void load(); })`,
   * which trips `react-hooks/set-state-in-effect` — a rule
   * `apps/web/AGENTS.md` lists among those that may **never** rise, because
   * they track correctness. Moving the `setState` calls inside `load` past an
   * `await` did not help: the compiler flags `void load()` itself, since it
   * cannot see which side of the async boundary the state lands on.
   *
   * The structural fix is better than the effect was. Opening the panel IS an
   * event — the only thing that makes this list want to load — so it belongs
   * in the handler, where React has no scheduling opinion about it. The effect
   * only existed because I made `open` a piece of state and then reacted to
   * my own write, which is a loop through the renderer for no reason.
   */
  const openPanel = () => {
    setOpen(true);
    void load();
  };

  const mint = async () => {
    setBusy(true);
    setError(null);
    setCopied(false);
    const result = await cloudFetch<{ token: string; grantsWrite: boolean }>(`/api/projects/${projectId}/share-links`, {
      method: "POST",
      body: JSON.stringify({ lockedEmail: lockedEmail.trim() || null, grantsWrite }),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    /* ⚠ The URL is composed HERE, from the browser's own origin, because the
       server does not reliably know which host the person is looking at — a
       preview deployment, a custom domain and localhost are all legitimate,
       and a link built from the wrong one is a dead end that looks like a
       database fault. */
    setMinted({ url: shareLinkUrl(window.location.origin, result.data.token), grantsWrite: result.data.grantsWrite });
    setLockedEmail("");
    setGrantsWrite(false);
    await load();
  };

  const revoke = async (linkId: string) => {
    setBusy(true);
    setError(null);
    const result = await cloudFetch<unknown>(`/api/share-links/${linkId}`, { method: "DELETE" });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    await load();
  };

  const copy = async () => {
    if (!minted) return;
    try {
      await navigator.clipboard.writeText(minted.url);
      setCopied(true);
    } catch {
      /* Clipboard access can be refused outright (an insecure origin, a
         permissions policy, a browser that wants a user gesture it did not
         see). The input below is readable and selectable either way, so the
         link is never trapped — the copy button is a convenience, not the
         only route out. */
      setCopied(false);
      setError("Couldn't reach the clipboard — select the link below and copy it yourself.");
    }
  };

  if (!viewerIsOwnerSide) return null;

  if (!open) {
    return (
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={openPanel} data-share-links-open="">
          Share by link…
        </button>
      </div>
    );
  }

  return (
    <div className={styles.stack} data-share-links="">
      <p className={styles.lead}>
        <strong>Share by link</strong>
      </p>
      <p className={styles.muted}>
        Anyone who opens the link and signs in gets access, and you can see and turn off every one
        below. Lock it to an email address if only one person should be able to use it.
      </p>

      {minted && (
        <div className={styles.stack} data-minted-link="">
          <label className={styles.field}>
            Your new link
            {/* readOnly, not disabled: a disabled input cannot be selected,
                which would strand the one copy of the token if the clipboard
                is unavailable. */}
            <input
              className={styles.input}
              value={minted.url}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
          <p className={styles.message}>{MINT_COPY_NOW_MESSAGE}</p>
          {minted.grantsWrite && (
            <p className={styles.message} data-minted-write="">
              ⚠ This link lets whoever opens it <strong>change the design</strong>, not just look at
              it.
            </p>
          )}
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={() => void copy()}>
              {copied ? "Copied" : "Copy link"}
            </button>
            <button type="button" className={styles.button} onClick={() => setMinted(null)}>
              Done
            </button>
          </div>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {!minted && (
        <>
          <label className={styles.field}>
            Lock to one email address (optional)
            <input
              className={styles.input}
              type="email"
              autoComplete="off"
              placeholder="Leave blank for anyone with the link"
              value={lockedEmail}
              onChange={(e) => setLockedEmail(e.target.value)}
            />
          </label>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={grantsWrite} onChange={(e) => setGrantsWrite(e.target.checked)} />
            Let them change the design (otherwise view only)
          </label>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} disabled={busy} onClick={() => void mint()}>
              {busy ? "Working…" : "Make a link"}
            </button>
          </div>
        </>
      )}

      {links === null ? (
        <p className={styles.muted}>Loading…</p>
      ) : links.length === 0 ? (
        <p className={styles.muted}>No links have been made for this design.</p>
      ) : (
        <ul className={styles.rows}>
          {links.map((row) => (
            <li key={row.linkId} className={styles.row} data-link-id={row.linkId}>
              <span className={styles.rowHeading}>
                <span className={styles.rowTitle}>{linkStateLabel(row)}</span>
                {row.grantsWrite && <span className={styles.badge}>can edit</span>}
                {row.lockedEmail && <span className={styles.badge}>one address</span>}
              </span>
              <span className={styles.rowMeta}>
                Made by {row.createdByYou ? "you" : (row.createdByName ?? "someone")}
                {" · "}
                {claimCountLabel(row.claims)}
              </span>
              {row.claims.length > 0 && (
                <ul className={styles.rows}>
                  {row.claims.map((claim) => (
                    <li key={claim.grantId} className={styles.rowLabel}>
                      {claim.granteeName}
                      {claim.canWrite ? " — can edit" : " — view only"}
                    </li>
                  ))}
                </ul>
              )}
              {row.isLive && (
                <span className={styles.rowActions}>
                  <button type="button" className={styles.button} disabled={busy} onClick={() => void revoke(row.linkId)}>
                    Turn off
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* ⚠ The thing somebody turning a link off will otherwise get wrong.
          Revoking stops NEW claims; it does not take access away from anyone
          who already opened it, because their grant is an ordinary
          collaborator row by then. A person who revokes expecting to have cut
          those people off would be wrong and would never find out. */}
      <p className={styles.muted}>
        Turning a link off stops anyone new from using it. People who already opened it keep their
        access until you remove them from the list above.
      </p>

      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={() => setOpen(false)}>
          Done with links
        </button>
      </div>
    </div>
  );
}
