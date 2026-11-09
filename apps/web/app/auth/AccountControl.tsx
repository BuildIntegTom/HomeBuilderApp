"use client";

import { useEffect, useState } from "react";
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

  /* Home's *Sign in* and *Account & company…* both open this control rather
     than a second sign-in form, through this event. It gates nothing: local
     Save and Load work either way.

     ⚠ **IT USED TO ANCHOR UNDER A BUTTON, AND THAT BUTTON NO LONGER EXISTS.**
     The handler read `buttonRef.current` and returned early when it was null
     — which, once Home replaced the bar controls, was EVERY time. The note
     would never have opened, and the symptom would have been Home's *Sign in*
     doing nothing at all, silently.

     Nothing failed: not typecheck, not 4139 tests, not the page. The only
     thing that noticed was lint, reporting `openPanel` as unused — which is
     the whole argument for the unused-variable rule being a gate and not
     noise. It opens unanchored now, at StickyNote's own spawn position. */
  useEffect(() => {
    const onOpenRequest = () => {
      setOpen(true);
    };
    window.addEventListener(OPEN_ACCOUNT_CONTROL_EVENT, onOpenRequest);
    return () => window.removeEventListener(OPEN_ACCOUNT_CONTROL_EVENT, onOpenRequest);
  }, []);

  // The editor renders fine with no provider (and its tests mount it that way).
  // No provider means no accounts, which reads the same as signed out.
  if (!auth) return null;

  /* ⚠ `loading` and `setActingAs` are no longer read here. Both belonged to
     the acting-as select, which moved onto Home when the bar controls went
     (2026-11-08) — Home reads them from the same `useOptionalAuth`. */
  const { session } = auth;
  const signedIn = Boolean(session.user);

  /* ⚠ **NO ANCHOR ARGUMENT ANY MORE.** `openPanel` used to take the bar
     button it hung under and position the note beneath it. The button is gone
     (Home replaced it, 2026-11-08), so the note opens unanchored at
     StickyNote's own default spawn position — which is right: there is
     nothing left on the bar for it to point at, and an anchor computed from a
     button that does not exist would have put it at 0,0. */
  const openPanel = () => {
    setOpen((was) => {
      if (was) setFullscreen(false);
      return !was;
    });
  };

  return (
    <div className={styles.group}>
      {/* ⚠ **THE BAR CONTROLS ARE GONE FROM HERE** (2026-11-08), and this
          component is deliberately still mounted anyway.

          Home replaced the acting-as chip and the Account button on the bar
          — Tommy: *"replace them, home should be the one door"*. What it did
          NOT replace is everything this component still owns: the account
          NOTE itself (two-factor, members, invites, company backup, Start a
          new company), the `OPEN_ACCOUNT_CONTROL_EVENT` listener that three
          callers use to open it, and `useCompanyBackup`, which is hoisted to
          this level precisely so closing the note cannot kill a running
          backup.

          Unmounting it to remove two buttons would have taken all of that
          with them, and the first symptom would have been Home's *Sign in*
          doing nothing. So the buttons go and the component stays, rendering
          only its note.

          The acting-as name is NOT lost: the bar keeps a display-only chip
          (see TopBar.tsx), which is the safety property
          `harness/ui-reorg-u1` exists to defend — a wrong-company save is
          silent. Switching company moved onto Home, where the full name and
          the whole list fit. */}
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
        {signedIn ? <AccountPanel backup={backup} /> :<SignInForm onDone={() => setOpen(false)} />}
      </StickyNote>
    </div>
  );
}
