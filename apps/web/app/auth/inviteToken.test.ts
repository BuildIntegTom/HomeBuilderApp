import { describe, expect, it } from "vitest";
import {
  INVITE_EXPIRY_DAYS,
  generateInviteToken,
  hashInviteToken,
  inviteExpiryFrom,
  inviteHashesMatch,
  inviteIsExpired,
  inviteUrl,
} from "./inviteToken";

describe("invite tokens", () => {
  it("mints a fresh token every time", () => {
    const tokens = new Set(Array.from({ length: 50 }, generateInviteToken));
    expect(tokens.size).toBe(50);
  });

  it("hashes deterministically, and the hash does not contain the token", () => {
    const token = generateInviteToken();
    expect(hashInviteToken(token)).toBe(hashInviteToken(token));
    expect(hashInviteToken(token)).toHaveLength(64);
    expect(hashInviteToken(token)).not.toContain(token);
  });

  it("gives different tokens different hashes", () => {
    expect(hashInviteToken("a")).not.toBe(hashInviteToken("b"));
  });

  it("compares hashes without leaking length-dependent early exits", () => {
    const h = hashInviteToken("token");
    expect(inviteHashesMatch(h, h)).toBe(true);
    expect(inviteHashesMatch(h, hashInviteToken("other"))).toBe(false);
    expect(inviteHashesMatch(h, "short")).toBe(false);
  });
});

describe("invite expiry", () => {
  const now = new Date("2026-09-06T12:00:00.000Z");

  it("defaults to the provisional window", () => {
    // Asserting the constant rather than a literal, so that changing the window
    // (it is not a decided number — see inviteToken.ts) does not fail this test
    // for the wrong reason.
    const expiry = inviteExpiryFrom(now);
    const days = (expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBe(INVITE_EXPIRY_DAYS);
  });

  it("treats an invite as live right up to its expiry and dead on it", () => {
    const expiry = inviteExpiryFrom(now, 1);
    expect(inviteIsExpired(expiry, new Date(expiry.getTime() - 1))).toBe(false);
    expect(inviteIsExpired(expiry, expiry)).toBe(true);
    expect(inviteIsExpired(expiry, new Date(expiry.getTime() + 1))).toBe(true);
  });

  it("accepts the ISO string shape Postgres returns", () => {
    expect(inviteIsExpired("2026-09-01T00:00:00.000Z", now)).toBe(true);
    expect(inviteIsExpired("2026-10-01T00:00:00.000Z", now)).toBe(false);
  });

  it("treats an unreadable expiry as expired rather than as unlimited", () => {
    expect(inviteIsExpired("not a date", now)).toBe(true);
  });
});

describe("inviteUrl", () => {
  it("builds a link to the invite page", () => {
    expect(inviteUrl("https://example.test", "abc")).toBe("https://example.test/invite/abc");
  });

  it("does not double the slash when the origin has one", () => {
    expect(inviteUrl("https://example.test/", "abc")).toBe("https://example.test/invite/abc");
  });

  it("escapes a token so it cannot break out of the path segment", () => {
    expect(inviteUrl("https://example.test", "a/b?c")).toBe("https://example.test/invite/a%2Fb%3Fc");
  });
});
