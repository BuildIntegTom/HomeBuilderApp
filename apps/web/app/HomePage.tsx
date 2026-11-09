"use client";

import { useState, type FormEvent } from "react";
import StarterTemplatePicker, { type StarterTemplatePickerProps } from "./StarterTemplatePicker";
import { useOptionalAuth } from "./auth/AuthProvider";
import { shareTokenFromPastedLink, invitePathFromPastedLink } from "./cloud/shareLinkPath";
import styles from "./HomePage.module.css";

/**
 * Home — the one door.
 *
 * > *"replace them, home should be the one door. home is what happens when the
 * > app is first started, so it should still be one click to sign up/recieve
 * > an invite or something ... just because you travel back to home doesnt
 * > reset the drawing youre currently on (unless you click a precon)."*
 * > — Tommy, 2026-11-08
 *
 * ⚠ **It is a SURFACE, not an overlay**, and that is what makes his constraint
 * hold rather than something this component has to be careful about. Home is a
 * fourth `editorSurface` value, so the drawing column is `display: none` and
 * **still mounted** behind it — exactly what Summary and Print already do. No
 * state is torn down, nothing is re-derived on the way back, and there is no
 * way for a bug here to lose a building.
 *
 * ⚠ **The templates are the SAME component as before**, not a copy. Tommy:
 * *"we already have one big button template like thing on the home page for
 * open from cloud"* — the picker's cloud tile is that thing, and it keeps its
 * own careful `canOpenFromCloud` derivation. Home wraps it rather than
 * reimplementing nine tiles and a sign-in affordance that already read well.
 *
 * ⚠ **What is NOT here, deliberately.** Two-factor, the members list, the
 * invites list, company backup and Start a new company stay in the account
 * panel, reached by one button. He asked for *"most of the settings from some
 * of those buttons"* — most of some. Flattening six more sections onto this
 * page is its own stride, and doing it badly would make the door worse than
 * the two dropdowns it replaces.
 */

export interface HomePageProps {
  /** The template picker's own props, passed straight through. */
  templates: StarterTemplatePickerProps;

  /**
   * ⚠ Identity is NOT a prop. Home reads it from `useOptionalAuth`, the same
   * hook `AccountControl` uses, for two reasons: `page.tsx` has no session of
   * its own to pass (it never needed one — the account control was
   * self-contained in the bar), and threading eight identity props through a
   * 17,000-line file to reach one component is how two sources of truth get
   * started.
   *
   * `useOptionalAuth` rather than `useAuth`: a deployment with no accounts
   * backend mounts no provider, and Home must still show templates and the
   * local file buttons there.
   */
  onSignIn: () => void;
  onAccountAndCompany: () => void;

  /**
   * The open drawing, or `null` when there is none. ⚠ Its presence is what
   * turns Home from an empty state into a place you can leave.
   */
  current: { name: string; detail: string } | null;
  onBackToDrawing: () => void;

  /** Document actions. Local two are never sign-in gated (decision 14). */
  onSaveFile: () => void;
  onLoadFile: () => void;
  /** Cloud actions, each already gated by `buildCloudMenu` upstream. */
  cloud: {
    canSaveToCloud: boolean;
    canSaveAsNew: boolean;
    canOpenFromCloud: boolean;
    hasProjectOpen: boolean;
    onSaveToCloud: () => void;
    onSaveAsNew: () => void;
    onVersionHistory: () => void;
    onSharing: () => void;
    /**
     * Move to… — the folder picker, which came off the deleted Project note.
     *
     * ⚠ The heading is LOAD-BEARING COPY, not a label. Its own comment in the
     * old note said the folders are the OWNER's, and the picker says so: on a
     * project shared with you, moving it files it in their tree, not yours.
     * Dropping the heading when this moved would have turned an explanation
     * into a bare "Move to…" that quietly does something else.
     */
    refile: {
      heading: string;
      folder: string;
      busy: boolean;
      folders: readonly { id: string; label: string }[];
      onMove: (folder: string) => void;
    } | null;
  };

  /** Where a pasted link goes. */
  onOpenShareToken: (token: string) => void;
  onOpenInviteToken: (token: string) => void;

  /** Closes Home. Absent when there is nothing behind it to close to. */
  onClose: (() => void) | null;
}

const PASTE_HELP = "Paste the whole link — a shared design or an invitation both work here.";
const PASTE_UNRECOGNISED =
  "That doesn't look like one of our links. Copy the whole thing from the message you were sent, including the https:// part.";

export default function HomePage(props: HomePageProps) {
  const auth = useOptionalAuth();
  const session = auth?.session ?? null;
  const signedInAs = session?.user?.email ?? null;
  const displayName = session?.user?.displayName ?? null;
  const actingAsCompanyName = session?.actingAsCompanyName ?? null;
  const actingAsCompanyId = session?.actingAsCompanyId ?? null;
  /* Every company this account may act as, in the entitlements' own order —
     the same list `AccountControl`'s switcher offers, so the two cannot
     disagree about where a save would land. */
  const companies = (session?.entitlements ?? []).map((e) => ({ id: e.companyId, name: e.companyName }));

  const {
    templates,
    onSignIn,
    onAccountAndCompany,
    current,
    onBackToDrawing,
    onSaveFile,
    onLoadFile,
    cloud,
    onOpenShareToken,
    onOpenInviteToken,
    onClose,
  } = props;

  const [pasted, setPasted] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [confirmingTemplate, setConfirmingTemplate] = useState<{ plan: Parameters<StarterTemplatePickerProps["onPick"]>[0]; name: string } | null>(null);

  const openPasted = (event: FormEvent) => {
    event.preventDefault();
    /* ⚠ One box, two kinds of link, and the PATH decides which — not a guess
       at the token's shape. A share token and an invite token are both 43
       characters of base64url and are indistinguishable from each other; only
       `/share/` vs `/invite/` tells them apart, which is why a bare token is
       treated as a share link and a pasted URL is routed by its path. */
    const invite = invitePathFromPastedLink(pasted);
    if (invite) {
      setPasteError(null);
      onOpenInviteToken(invite);
      return;
    }
    const share = shareTokenFromPastedLink(pasted);
    if (share) {
      setPasteError(null);
      onOpenShareToken(share);
      return;
    }
    setPasteError(PASTE_UNRECOGNISED);
  };

  /* ⚠ Picking a template REPLACES the drawing, and it is the only thing on
     Home that does — his "(unless you click a precon)". So it is the only
     thing here that asks first, and only when there is something to lose.
     Home being otherwise non-destructive is what makes the question
     meaningful; asking on every click would train people to dismiss it. */
  const pickTemplate: StarterTemplatePickerProps["onPick"] = (plan, name) => {
    if (current) {
      setConfirmingTemplate({ plan, name });
      return;
    }
    templates.onPick(plan, name);
  };

  return (
    <div className={styles.root} data-home-page="">
      <header className={styles.identity} data-home-identity="">
        <div className={styles.who}>
          {signedInAs ? (
            <>
              <span className={styles.whoName}>{displayName?.trim() || signedInAs}</span>
              {/* ⚠ The company, spelled out. On the bar it is a short chip
                  because width is scarce; here there is room for the whole
                  name and for switching, which is why the switcher moved. */}
              {companies.length > 1 ? (
                <label className={styles.companyPick}>
                  <span className={styles.companyPickLabel}>Working as</span>
                  <select
                    className={styles.select}
                    value={actingAsCompanyId ?? ""}
                    onChange={(e) => void auth?.setActingAs(e.target.value)}
                    data-home-acting-as=""
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : actingAsCompanyName ? (
                <span className={styles.companyStatic} data-home-acting-as="">
                  Working as <strong>{actingAsCompanyName}</strong>
                </span>
              ) : (
                <span className={styles.companyStatic} data-home-acting-as="">
                  No company yet
                </span>
              )}
            </>
          ) : (
            <span className={styles.whoName}>Not signed in</span>
          )}
        </div>
        <div className={styles.identityActions}>
          {signedInAs ? (
            <>
              <button type="button" className={styles.button} onClick={onAccountAndCompany}>
                Account &amp; company…
              </button>
              <button type="button" className={styles.button} onClick={() => void auth?.signOut()}>
                Sign out
              </button>
            </>
          ) : (
            <button type="button" className={styles.primary} onClick={onSignIn} data-home-sign-in="">
              Sign in
            </button>
          )}
          {/* ⚠ No close button when there is nothing behind Home. On first
              start the drawing surface is an empty canvas, and an × that
              leads to a blank page is a trap dressed as an exit — "Draw your
              own" in the tiles is the real way to an empty plan. */}
          {onClose && (
            <button type="button" className={styles.close} onClick={onClose} aria-label="Close Home" data-home-close="">
              ✕
            </button>
          )}
        </div>
      </header>

      {current && (
        /* ⚠ FIRST, above everything. Home opens over live work, and without
           this band the first thing somebody sees after clicking Home is a
           page full of ways to start something else — which reads as though
           their building is gone. */
        <section className={styles.continueBand} data-home-continue="">
          <div className={styles.continueText}>
            <span className={styles.continueLabel}>Still open</span>
            <span className={styles.continueName}>{current.name}</span>
            <span className={styles.continueDetail}>{current.detail}</span>
          </div>
          <button type="button" className={styles.primary} onClick={onBackToDrawing} data-home-back="">
            Back to this drawing
          </button>
        </section>
      )}

      <StarterTemplatePicker {...templates} onPick={pickTemplate} embedded />

      {confirmingTemplate && (
        <div className={styles.confirm} role="alertdialog" aria-label="Replace the current drawing?" data-home-template-confirm="">
          <p className={styles.confirmText}>
            Drawing <strong>{confirmingTemplate.name}</strong> replaces {current?.name ?? "the current drawing"}.
            Anything unsaved goes with it.
          </p>
          <div className={styles.confirmActions}>
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                const pick = confirmingTemplate;
                setConfirmingTemplate(null);
                templates.onPick(pick.plan, pick.name);
              }}
            >
              Replace it
            </button>
            <button type="button" className={styles.button} onClick={() => setConfirmingTemplate(null)}>
              Keep what I have
            </button>
          </div>
        </div>
      )}

      <div className={styles.bands}>
        <section className={styles.band} data-home-designs="">
          <h2 className={styles.bandHeading}>Your designs</h2>
          <div className={styles.buttonRow}>
            {/* Never sign-in gated — decision 14. A file on this computer is
                yours whether or not this app knows who you are. */}
            <button type="button" className={styles.button} onClick={onSaveFile}>
              Save a file
            </button>
            <button type="button" className={styles.button} onClick={onLoadFile}>
              Open a file
            </button>
            {cloud.canSaveToCloud && (
              <button type="button" className={styles.button} onClick={cloud.onSaveToCloud}>
                Save to cloud
              </button>
            )}
            {cloud.canSaveAsNew && (
              <button type="button" className={styles.button} onClick={cloud.onSaveAsNew}>
                Save as new…
              </button>
            )}
            {cloud.hasProjectOpen && (
              <>
                <button type="button" className={styles.button} onClick={cloud.onVersionHistory}>
                  Version history
                </button>
                <button type="button" className={styles.button} onClick={cloud.onSharing}>
                  Sharing…
                </button>
              </>
            )}
          </div>
          {cloud.refile && (
            <label className={styles.refileRow} data-home-refile="">
              {/* The owner-named heading, kept as the visible label rather
                  than as an optgroup — on a page there is room to simply say
                  it, and a `select` whose only group heading IS the
                  explanation reads oddly outside a menu. */}
              <span className={styles.bandNote}>{cloud.refile.heading}</span>
              <select
                className={styles.select}
                value={cloud.refile.folder}
                disabled={cloud.refile.busy}
                onChange={(e) => cloud.refile?.onMove(e.target.value)}
              >
                {cloud.refile.folders.map((f) => (
                  <option key={f.id} value={f.id} disabled={f.id === cloud.refile?.folder}>
                    {f.label}
                    {f.id === cloud.refile?.folder ? " (here now)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className={styles.bandNote}>
            Opening a saved design is the ☁ tile above. Files save to this computer and never need an
            account.
          </p>
        </section>

        <section className={styles.band} data-home-paste="">
          <h2 className={styles.bandHeading}>Were you sent a link?</h2>
          <form className={styles.pasteRow} onSubmit={openPasted}>
            <input
              className={styles.input}
              value={pasted}
              onChange={(e) => {
                setPasted(e.target.value);
                if (pasteError) setPasteError(null);
              }}
              placeholder="Paste it here"
              aria-label="Paste a link you were sent"
              data-home-paste-input=""
            />
            <button type="submit" className={styles.primary} disabled={pasted.trim().length === 0}>
              Open
            </button>
          </form>
          {pasteError ? <p className={styles.error}>{pasteError}</p> : <p className={styles.bandNote}>{PASTE_HELP}</p>}
          {/* ⚠ His "one click to sign up". A shared link now creates the
              account itself, so for somebody with no account this box IS the
              way in — which is why it sits on the front door rather than
              inside an account menu they would have no reason to open. */}
          <p className={styles.bandNote}>
            A shared design will make you an account if you don&apos;t have one yet.
          </p>
        </section>
      </div>
    </div>
  );
}
