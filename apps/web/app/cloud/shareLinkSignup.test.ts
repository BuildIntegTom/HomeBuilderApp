import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  MIN_PASSWORD_LENGTH,
  SIGNUP_CONFIRM_MESSAGE,
  SIGNUP_WRONG_EMAIL_MESSAGE,
  emailSatisfiesLock,
  isEmailNotConfirmed,
  mayMarkEmailConfirmed,
} from "./shareLinkSignup";

describe("mayMarkEmailConfirmed — the consequential line", () => {
  it("⚠ a LOCKED link proves the address; an UNLOCKED one does not", () => {
    /* The whole sign-up security argument in two assertions. A locked link
       names the mailbox, which is exactly the proof an invite has — the invite
       route passes `email_confirm: true` with the comment "it was sent to this
       mailbox". An unlocked link names nobody, so marking the typed address
       confirmed would let anyone holding a forwarded link create an account on
       a stranger's address. */
    expect(mayMarkEmailConfirmed("client@example.com")).toBe(true);
    expect(mayMarkEmailConfirmed(null)).toBe(false);
  });

  it("treats a blank lock as no lock, not as a proof", () => {
    /* Defence against a lock that is technically present but empty — the
       database normalises blanks to null, but a route reading `?? ""` or a
       future column default could produce one, and failing OPEN here would be
       the worst direction to fail. */
    expect(mayMarkEmailConfirmed("")).toBe(false);
    expect(mayMarkEmailConfirmed("   ")).toBe(false);
  });
});

describe("emailSatisfiesLock", () => {
  it("accepts the locked address, in any casing the person types", () => {
    /* 0011's `normalize_share_link_email` stores the lock lowercased, so a
       raw comparison would refuse `Client@Example.com` for a link locked to
       `client@example.com` — the same address typed by someone who
       capitalises their own name. */
    expect(emailSatisfiesLock("client@example.com", "client@example.com")).toBe(true);
    expect(emailSatisfiesLock("Client@Example.COM", "client@example.com")).toBe(true);
    expect(emailSatisfiesLock("  client@example.com  ", "client@example.com")).toBe(true);
  });

  it("⚠ refuses a different address", () => {
    expect(emailSatisfiesLock("someone@else.com", "client@example.com")).toBe(false);
    // Not a prefix, not a suffix, not a substring — exact match only.
    expect(emailSatisfiesLock("client@example.com.evil.test", "client@example.com")).toBe(false);
    expect(emailSatisfiesLock("aclient@example.com", "client@example.com")).toBe(false);
  });

  it("an UNLOCKED link accepts anything, which is what makes it unlocked", () => {
    expect(emailSatisfiesLock("anyone@anywhere.test", null)).toBe(true);
    expect(emailSatisfiesLock("anyone@anywhere.test", "")).toBe(true);
    expect(emailSatisfiesLock("anyone@anywhere.test", "   ")).toBe(true);
  });

  it("⚠ the two functions agree about what 'locked' means", () => {
    /* They are read one after the other in the route: the lock decides both
       WHO may sign up and whether their address is proved. If one treated
       blank as locked and the other as unlocked, an empty lock would refuse
       every address while also marking it confirmed — nonsense in both
       directions at once. Swept over the same inputs so they cannot drift. */
    for (const lock of [null, "", "   ", "client@example.com"]) {
      const locked = mayMarkEmailConfirmed(lock);
      const refusesAStranger = !emailSatisfiesLock("stranger@example.com", lock);
      expect(locked, `lock ${JSON.stringify(lock)}`).toBe(refusesAStranger);
    }
  });
});

describe("isEmailNotConfirmed", () => {
  it("recognises Supabase's refusal", () => {
    expect(isEmailNotConfirmed("Email not confirmed")).toBe(true);
    expect(isEmailNotConfirmed("email not confirmed")).toBe(true);
  });

  it("does not swallow unrelated failures", () => {
    /* ⚠ The dangerous direction. A false positive here reports "check your
       email" for a failure that has nothing to do with confirmation, and the
       person waits forever for a mail that is not coming. */
    expect(isEmailNotConfirmed("Invalid login credentials")).toBe(false);
    expect(isEmailNotConfirmed("Database error granting user")).toBe(false);
    expect(isEmailNotConfirmed("")).toBe(false);
    expect(isEmailNotConfirmed(null)).toBe(false);
    expect(isEmailNotConfirmed(undefined)).toBe(false);
  });

  it("⚠ is documented as brittle, because it matches on prose", () => {
    /* Supabase gives this case no distinct code. If the wording ever changes
       this returns false and a visitor is told sign-up failed when their
       account exists and is waiting on an email. That is recoverable — the
       claim is idempotent — but it has to be findable, so the source says so
       in as many words. */
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, "shareLinkSignup.ts"), "utf8");
    expect(source).toMatch(/brittle/i);
    expect(source).toMatch(/idempotent/i);
  });
});

describe("the messages", () => {
  it("every refusal says no account was created", () => {
    /* The one thing somebody needs to know after a failed sign-up: whether
       they now half-have an account. Saying so on every refusal means they
       never have to guess. */
    expect(SIGNUP_WRONG_EMAIL_MESSAGE).toMatch(/No account was created/);
  });

  it("the confirm-email message is not phrased as a failure", () => {
    /* It is the expected next step when Supabase's "Confirm sign up" is on,
       not an error — and it tells them to come back to the link, because the
       claim has not happened yet. */
    expect(SIGNUP_CONFIRM_MESSAGE).not.toMatch(/error|failed|sorry|couldn't/i);
    expect(SIGNUP_CONFIRM_MESSAGE).toMatch(/check your email/i);
    expect(SIGNUP_CONFIRM_MESSAGE).toMatch(/open this link again/i);
  });

  it("the minimum password length matches the invite route's", () => {
    /* Two sign-up paths that disagree about what a valid password is would be
       discovered by a person who set one on the wrong screen. */
    const here = dirname(fileURLToPath(import.meta.url));
    const invite = readFileSync(join(here, "..", "api", "auth", "invite", "accept", "route.ts"), "utf8");
    const match = /MIN_PASSWORD_LENGTH = (\d+)/.exec(invite);
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBe(MIN_PASSWORD_LENGTH);
  });
});

describe("the signup route", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const route = readFileSync(join(here, "..", "api", "auth", "share-link", "signup", "route.ts"), "utf8");

  it("⚠ asks the DATABASE whether the link authorises a sign-up", () => {
    /* The route must not decide "is this link live" for itself — that would
       be a second implementation of `share_link_is_live`, and the two would
       drift until an expired link minted accounts. */
    expect(route).toContain("share_link_permits_signup");
    expect(route).not.toMatch(/expires_at|revoked_at/);
  });

  it("⚠ never puts the locked address in a response", () => {
    /* 0013 returns it so this handler can judge proof-of-address; the PAGE's
       own function returns a boolean precisely so a forwarded link cannot
       disclose whose it is. This route is the one place that could undo
       that. */
    const responses = [...route.matchAll(/Response\.json\(\{[\s\S]*?\}/g)].map((m) => m[0]);
    expect(responses.length).toBeGreaterThan(0);
    for (const body of responses) {
      expect(body, body.slice(0, 60)).not.toMatch(/locked_?[Ee]mail/);
    }
  });

  it("⚠ does NOT delete the account when sign-in is pending confirmation", () => {
    /* The invite route deletes a freshly created user when its redeem fails,
       and copying that here would throw away an account whose confirmation
       mail is already in flight. The two cases look alike and are opposite. */
    const confirmBranch = route.slice(route.indexOf("isEmailNotConfirmed(signIn.error.message)"));
    const returnIdx = confirmBranch.indexOf("return Response.json");
    expect(returnIdx).toBeGreaterThan(-1);
    expect(confirmBranch.slice(0, returnIdx)).not.toContain("deleteUser");
  });

  it("claims the link after signing in, and sends no user id", () => {
    expect(route).toContain("claim_share_link");
    expect(route).toMatch(/claim_share_link",\s*\{\s*p_token_hash: tokenHash\s*\}/);
  });
});
