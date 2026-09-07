import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Invite tokens. Server-only (`node:crypto`); never import this from a client
 * component.
 *
 * The raw token exists in the invite link and nowhere else. The database stores
 * only its SHA-256, so reading `invites` — as a company admin, or with a
 * database dump — does not yield a usable invite link.
 */

/**
 * TODO — PROVISIONAL, needs Tommy. The spec requires an invite to be "a valid,
 * unexpired invite token" but names no window anywhere, so this number is not
 * decided, it is picked. Two weeks is long enough for someone to get round to
 * it and short enough that a forwarded email does not stay live for a year.
 *
 * It is deliberately a named constant rather than an inline `14` so that
 * changing it is one edit, and deliberately not wrapped in a `CatalogValue` —
 * the `status` / review-log convention is for real-world building numbers, and
 * putting an administrative timeout in the engineer's review list would be
 * noise. Flagged in the Stage 1 handoff report instead.
 */
export const INVITE_EXPIRY_DAYS = 14;

/** 32 random bytes, base64url — 256 bits, not guessable. */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Constant-time compare, for anywhere a hash is checked outside the database. */
export function inviteHashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function inviteExpiryFrom(now: Date, days: number = INVITE_EXPIRY_DAYS): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export function inviteIsExpired(expiresAt: string | Date, now: Date = new Date()): boolean {
  const expiry = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  if (Number.isNaN(expiry.getTime())) {
    // An unparseable expiry is treated as expired rather than as unlimited. A
    // visible refusal beats a silently immortal invite.
    return true;
  }
  return expiry.getTime() <= now.getTime();
}

/** The link that goes in the invitation email. */
export function inviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/invite/${encodeURIComponent(token)}`;
}
