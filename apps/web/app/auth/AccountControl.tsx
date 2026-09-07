"use client";

import { useState } from "react";
import StickyNote from "../StickyNote";
import AccountPanel from "./AccountPanel";
import SignInForm from "./SignInForm";
import { useOptionalAuth } from "./AuthProvider";
import styles from "./AccountControl.module.css";

const NOTE_WIDTH_PX = 420;
const VIEWPORT_MARGIN_PX = 12;

/**
 * The acting-as switcher, and the sign-in state next to it.
 *
 * THIS IS ONE CONTROL, and that is the point of it. There is no separate "View
 * as Seed Collaborator" toggle anywhere in this app and there must not be one:
 * acting as The Seed Collaborative IS consortium browsing (from Stage 4), so it
 * is an entry in this list like any other company. Adding a second affordance
 * would be building the model the spec explicitly replaced.
 *
 * It is always visible and always shows the acting-as company BY NAME — not
 * only while being changed, and not behind a menu. The failure it exists to
 * prevent is saving a project into the wrong company's folder tree, which is
 * silent, plausible, and noticed later by someone else. The tree it protects
 * arrives in Stage 2; the control has to be right before then.
 *
 * The list is exactly the entitlements the server sent, which are exactly the
 * ones the person holds. Nothing here can add to it — a member of no member
 * company has no Seed entry to click, and clicking one they somehow forged gets
 * a 403 from /api/acting-as rather than a switch.
 */
export default function AccountControl() {
  const auth = useOptionalAuth();
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);

  // The editor renders fine with no provider (and its tests mount it that way).
  // No provider means no accounts, which reads the same as signed out.
  if (!auth) return null;

  const { session, loading, setActingAs } = auth;
  const signedIn = Boolean(session.user);
  const entitlements = session.entitlements;

  const openPanel = (button: HTMLButtonElement) => {
    setOpen((was) => {
      const next = !was;
      if (next) {
        const rect = button.getBoundingClientRect();
        const maxLeft = window.innerWidth - NOTE_WIDTH_PX - VIEWPORT_MARGIN_PX;
        setPosition({
          top: rect.bottom + 8,
          left: Math.min(rect.left, Math.max(VIEWPORT_MARGIN_PX, maxLeft)),
        });
      } else {
        setFullscreen(false);
      }
      return next;
    });
  };

  const label = (companyId: string) => {
    const entitlement = entitlements.find((e) => e.companyId === companyId);
    if (!entitlement) return companyId;
    // Said plainly rather than implied by styling: acting as the consortium
    // without being a member of it is a different thing from acting as your own
    // company, and from Stage 4 it is what shows you other companies' work.
    return entitlement.source === "consortium"
      ? `${entitlement.companyName} (consortium)`
      : entitlement.source === "platform-admin"
        ? `${entitlement.companyName} (platform admin)`
        : entitlement.companyName;
  };

  return (
    <div className={styles.group}>
      <div className={styles.actingAs}>
        <span className={styles.actingAsLabel} id="acting-as-label">
          Acting as
        </span>
        {!signedIn || entitlements.length === 0 ? (
          <span className={styles.actingAsStatic}>
            {loading ? "…" : signedIn ? "No company" : "Not signed in"}
          </span>
        ) : (
          <select
            className={styles.actingAsSelect}
            aria-labelledby="acting-as-label"
            value={session.actingAsCompanyId ?? ""}
            // A single entitlement still renders its company name at full
            // contrast — legible, not hidden, not greyed into furniture.
            disabled={entitlements.length === 1}
            onChange={async (event) => {
              setSwitchError(null);
              try {
                await setActingAs(event.target.value);
              } catch (err) {
                setSwitchError(err instanceof Error ? err.message : "Couldn't switch company");
              }
            }}
          >
            {entitlements.map((entitlement) => (
              <option key={entitlement.companyId} value={entitlement.companyId}>
                {label(entitlement.companyId)}
              </option>
            ))}
          </select>
        )}
      </div>

      <button
        type="button"
        className={open ? styles.buttonActive : styles.button}
        aria-expanded={open}
        onClick={(event) => openPanel(event.currentTarget)}
      >
        {signedIn ? "Account" : "Sign in"} {open ? "▲" : "▼"}
      </button>

      <StickyNote
        id="account-note"
        label={signedIn ? "Account" : "Sign in"}
        isOpen={open}
        isFullscreen={fullscreen}
        cascadeIndex={0}
        top={position?.top ?? 68}
        left={position?.left ?? 24}
        onClose={() => setOpen(false)}
        onToggleFullscreen={() => setFullscreen((was) => !was)}
      >
        {/* A membership revoked mid-session, or a cookie naming a company this
            person cannot act as, lands here. The session carries on at a
            company they really do hold, and it says so — falling back silently
            is how someone ends up working in the wrong tree. */}
        {session.actingAsRejectedCompanyId && (
          <p className={styles.error}>
            You are no longer able to act as the company this browser had selected
            {session.actingAsCompanyName ? `, so you are acting as ${session.actingAsCompanyName}` : ""}.
          </p>
        )}
        {switchError && <p className={styles.error}>{switchError}</p>}
        {signedIn ? <AccountPanel /> : <SignInForm onDone={() => setOpen(false)} />}
      </StickyNote>
    </div>
  );
}
