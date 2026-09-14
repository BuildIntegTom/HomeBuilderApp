"use client";

import { useEffect, useRef, useState } from "react";
import StickyNote from "../StickyNote";
import { clampMenuLeft } from "../topBarMenus";
import { useCompanyBackup } from "../cloud/useCompanyBackup";
import AccountPanel from "./AccountPanel";
import SignInForm from "./SignInForm";
import { useOptionalAuth } from "./AuthProvider";
import styles from "./AccountControl.module.css";

/** Dispatched on `window` to open this control's note from elsewhere — the
 * Project ▾ menu's guest line. A window event, not a context, so the control
 * stays the one owner of its own open state. */
export const OPEN_ACCOUNT_CONTROL_EVENT = "bi:open-account-control";

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
  // Stage 2D. Held here, not in AccountPanel: the note unmounts the panel when
  // it closes, and closing it must not kill a backup in progress. Called before
  // the no-provider early return below, so the hook order never changes.
  const backup = useCompanyBackup(auth?.session.actingAsCompanyId ?? null);

  // Same rule as TopBar's own menus, from the same function: a note opened wide
  // and then the window narrowed must not be left anchored off the right edge.
  // Only ever moves it left. Declared before the no-provider early return below
  // so the hook order never changes between renders.
  useEffect(() => {
    if (!open) return;
    const onResize = () =>
      setPosition((was) => (was ? { ...was, left: clampMenuLeft(was.left, window.innerWidth) } : was));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  // The Project ▾ menu's "Sign in to save projects to the cloud" line opens this
  // control rather than a second sign-in form. It gates nothing: local Save and
  // Load work either way.
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const onOpenRequest = () => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      setPosition({ top: rect.bottom + 8, left: clampMenuLeft(rect.left, window.innerWidth) });
      setOpen(true);
    };
    window.addEventListener(OPEN_ACCOUNT_CONTROL_EVENT, onOpenRequest);
    return () => window.removeEventListener(OPEN_ACCOUNT_CONTROL_EVENT, onOpenRequest);
  }, []);

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
        setPosition({ top: rect.bottom + 8, left: clampMenuLeft(rect.left, window.innerWidth) });
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
          <span
            className={styles.actingAsStatic}
            title={loading ? undefined : signedIn ? "No company" : "Not signed in"}
          >
            {loading ? "…" : signedIn ? "No company" : "Not signed in"}
          </span>
        ) : (
          <select
            className={styles.actingAsSelect}
            aria-labelledby="acting-as-label"
            // The name may be truncated on a narrow bar; the full name is
            // always one hover away. Truncated-with-a-title beats absent.
            title={session.actingAsCompanyId ? label(session.actingAsCompanyId) : undefined}
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
        ref={buttonRef}
        type="button"
        className={open ? styles.buttonActive : styles.button}
        aria-expanded={open}
        onClick={(event) => openPanel(event.currentTarget)}
      >
        {signedIn ? "Account" : "Sign in"}
        {/* Decorative (aria-expanded carries open/closed); dropped on a narrow
            top bar so the width goes to the company name instead. */}
        <span className={styles.caret} aria-hidden="true">
          {" "}
          {open ? "▲" : "▼"}
        </span>
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
        {signedIn ? <AccountPanel backup={backup} /> :<SignInForm onDone={() => setOpen(false)} />}
      </StickyNote>
    </div>
  );
}
