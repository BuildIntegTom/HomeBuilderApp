import { randomBytes } from "node:crypto";
import { hashInviteToken } from "./inviteToken";

export { proposalUrl, proposalTokenFromPastedLink } from "../cloud/proposalPath";

/**
 * Proposal tokens. Server-only (`node:crypto`); never import this from a client
 * component — import `cloud/proposalPath.ts` there instead.
 *
 * ⚠ **The raw token exists in the link and nowhere else.** `proposals` stores
 * only its SHA-256, so reading that table yields no usable link. Same property
 * invites and share links already have, and the same reason this module exists
 * rather than the token being minted in the browser: a client-side token would
 * have to be sent to the server to be hashed, and doing both in one place is
 * the only way to be sure the stored hash matches the issued token.
 */

/**
 * ⚠ **The same hash function invites and share links use**, deliberately not a
 * third implementation. The migration's own comment says there is ONE answer in
 * that schema to "how is a link token hashed"; this is that answer on this
 * side. Three SHA-256-hex helpers in one codebase is an invitation for one of
 * them to grow a salt, and the failure mode is a link that previews as
 * not-found forever with nothing visibly wrong at either end.
 */
export const hashProposalToken = hashInviteToken;

/** 32 random bytes, base64url — 256 bits, not guessable. */
export function generateProposalToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * TODO — PROVISIONAL, needs Tommy, exactly as `SHARE_LINK_EXPIRY_DAYS` and
 * `INVITE_EXPIRY_DAYS` are. He has not named a window for a proposal.
 *
 * ⚠ **90 days, which is LONGER than a share link's 30, and the reason is the
 * direction the link points.** A share link is a company handing a client a
 * window onto a job already underway; the job ends. A proposal is somebody
 * outside the company sending in a design and then *waiting to hear back* —
 * and there is no mechanism anywhere in this app that tells them it is about
 * to lapse. A fortnight of silence is ordinary in that conversation; an expiry
 * that fires during it loses the design with nobody at fault.
 *
 * The database insists only that a proposal HAS an expiry and that it is in the
 * future when written. This number is the app's, and it is a guess.
 */
export const PROPOSAL_EXPIRY_DAYS = 90;

export function proposalExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + PROPOSAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}
