/**
 * Stage 3C: WHEN the notice check runs, as one pure decision.
 *
 * Spec: "Stage 3 plan — Collaboration" → "The in-app notice (7)": "whenever the
 * app loads for a signed-in person with pending notices, not only at the moment
 * of signing in."
 *
 * THE CHECK RUNS AT EXACTLY THREE MOMENTS, and nowhere else:
 *   1. PAGE LOAD — the first /api/session answer that names a signed-in person
 *      (`previous` is null, because nothing was known before).
 *   2. SIGN-IN, or any change of signed-in account — the user id differs from
 *      the last one seen. AuthProvider.signIn() ends in refresh(), so this is
 *      the same transition for both.
 *   3. THE SECOND FACTOR BEING COMPLETED — `mfaPending` goes true → false for
 *      the same person. Until then the database returns nothing (0004's
 *      restrictive policy; confirmed locally: at aal1 with a verified factor
 *      `pending_share_notices()` returns 0 rows), so a check before this moment
 *      would read an empty list and prove nothing.
 *
 * THERE IS NO POLLING, deliberately. A share is not urgent, the notice stays up
 * until it is dismissed (either button, since 2026-09-23 — see
 * `useShareNotice.tsx`), and the Shared with us tab is the durable signal, so
 * a timer would buy nothing and cost a request per tab per interval forever.
 * The spec's own accepted race already says the Shared tab — not this notice —
 * is what a recipient can rely on.
 *
 * THE ACTING-AS COMPANY IS DELIBERATELY NOT AN INPUT. `pending_share_notices()`
 * takes no acting-as parameter: it answers from your personal grants and your
 * memberships, so switching company changes nothing about it. Leaving acting-as
 * out of this type is what makes "switching company does not re-check" true by
 * construction rather than by remembering. This matters because the editor
 * re-reads the session after every 401/403 and after every company switch, and
 * each of those would otherwise be another request.
 */

/** Everything that can change who, if anyone, may be notified. */
export interface NoticeAudience {
  /** Null for a guest, or before the first session answer arrives. */
  userId: string | null;
  /** The password was accepted but the second factor has not been presented. */
  mfaPending: boolean;
}

/**
 * - `check` — ask the server for pending notices now.
 * - `clear` — nobody is notifiable: drop anything on screen without asking.
 * - `none`  — nothing changed that could change the answer; make no request.
 */
export type NoticeCheckDecision = "check" | "clear" | "none";

/**
 * Who is NEVER notified, enforced here as well as by the routes and by RLS:
 * guests, and accounts whose two-factor is still pending. Both are "clear", not
 * "none", so signing out visibly removes a notice that was already on screen
 * instead of leaving another account's news up.
 */
export function isNotifiable(audience: NoticeAudience): boolean {
  return audience.userId !== null && !audience.mfaPending;
}

/**
 * `previous` is null before the first session answer of this page load.
 * Anything not listed above is `none`: an ordinary session refresh that names
 * the same person at the same assurance level re-reads nothing.
 */
export function shareNoticeCheckDecision(previous: NoticeAudience | null, next: NoticeAudience): NoticeCheckDecision {
  if (!isNotifiable(next)) return "clear";
  if (previous === null) return "check";
  if (previous.userId !== next.userId) return "check";
  if (previous.mfaPending && !next.mfaPending) return "check";
  return "none";
}
