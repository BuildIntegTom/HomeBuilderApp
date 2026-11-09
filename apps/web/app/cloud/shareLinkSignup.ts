/**
 * The sign-up half of a share link, as pure decisions with no Supabase client
 * and no `node:crypto` in sight — so the rules below are testable on their own
 * rather than only through a route handler that needs a database and a service
 * key to run at all.
 *
 * The route (`app/api/auth/share-link/signup/route.ts`) does the IO; every
 * judgement it makes comes from here.
 */

export const SIGNUP_LINK_DEAD_MESSAGE =
  "This link isn't valid any more, so no account was created. Ask the company that sent it for a new one.";
export const SIGNUP_WRONG_EMAIL_MESSAGE =
  "This link was sent to a different email address. Use that address, or ask for a link for this one. No account was created.";
export const SIGNUP_PASSWORD_MESSAGE = "Passwords must be at least 8 characters. No account was created.";
export const SIGNUP_EMAIL_MESSAGE = "Enter the email address you want the account to use. No account was created.";
export const SIGNUP_EXISTS_MESSAGE =
  "There's already an account for that email. Sign in with your existing password, then open this link again.";
export const SIGNUP_CONFIRM_MESSAGE =
  "Account created — check your email and confirm the address, then open this link again to finish.";
export const SIGNUP_NOT_CONFIGURED_MESSAGE = "Accounts are not configured on this deployment.";

export const MIN_PASSWORD_LENGTH = 8;

/**
 * ⚠ **Whether a brand-new account's address may be marked confirmed without
 * the person proving they own it.**
 *
 * This is the single most consequential line in the sign-up path, so it is a
 * named function with its own test rather than a ternary inside a route.
 *
 * - A **locked** link names the address. That is exactly the proof an invite
 *   has — `app/api/auth/invite/accept/route.ts` passes `email_confirm: true`
 *   with the comment *"The invite is the proof of address: it was sent to this
 *   mailbox"* — so the same reasoning carries, and the client signs up in one
 *   step.
 * - An **unlocked** link names nobody. The visitor types whatever address they
 *   like and nothing connects them to it. Marking that confirmed would let
 *   anyone holding a forwarded link create an account on a stranger's address,
 *   so Supabase sends its confirmation mail and the address is proved the
 *   ordinary way.
 *
 * ⚠ The consequence, which the UI has to be honest about rather than hide: an
 * unlocked link is TWO steps for the client (sign up, confirm, come back) and a
 * locked one is ONE. That is a reason to lock a link when you know who you are
 * sending it to, not a reason to pretend an unlocked address is proved.
 */
export function mayMarkEmailConfirmed(lockedEmail: string | null): boolean {
  return lockedEmail !== null && lockedEmail.trim().length > 0;
}

/**
 * Does the address the visitor typed satisfy a locked link?
 *
 * Compared lowercased and trimmed on both sides because `0011`'s
 * `normalize_share_link_email` trigger already stores the locked address that
 * way; comparing a raw input against a normalised column would refuse
 * `Client@Example.com` for a link locked to `client@example.com`, which is the
 * same address typed by somebody who capitalises their own name.
 */
export function emailSatisfiesLock(typed: string, lockedEmail: string | null): boolean {
  if (lockedEmail === null || lockedEmail.trim().length === 0) return true;
  return typed.trim().toLowerCase() === lockedEmail.trim().toLowerCase();
}

export type SignupOutcome =
  /** Account exists (or was created) and the link is claimed. */
  | { kind: "signed-in" }
  /** Created, but Supabase will not sign them in until they confirm. */
  | { kind: "confirm-email" };

/**
 * ⚠ Reads a Supabase sign-in failure and decides whether it means "confirm
 * your email" or a genuine failure.
 *
 * Tommy's project has the *"Confirm sign up"* setting, and **this code must
 * work whichever way that toggle sits** — I have not seen its value and did
 * not want the flow to depend on it. With confirmation OFF, a freshly created
 * unconfirmed user signs straight in and this never fires. With it ON,
 * `signInWithPassword` refuses until the mail is clicked, and that refusal is
 * a normal step in the flow rather than an error.
 *
 * Matched on the message text because Supabase does not give this case a
 * distinct code. ⚠ That is brittle by nature: if the wording changes, this
 * returns `false` and the visitor is told sign-up failed when their account
 * exists and is waiting on an email. The failure is visible and recoverable
 * (the claim is idempotent, so opening the link again after confirming still
 * works), which is why it is acceptable — but it is the first thing to check
 * if sign-ups start reporting a failure that left an account behind.
 */
export function isEmailNotConfirmed(message: string | null | undefined): boolean {
  if (!message) return false;
  return /email not confirmed|confirm.*email/i.test(message);
}
