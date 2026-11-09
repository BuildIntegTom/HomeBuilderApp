import { randomBytes } from "node:crypto";
import { hashInviteToken } from "./inviteToken";

/**
 * Share-link tokens. Server-only (`node:crypto`); never import this from a
 * client component.
 *
 * ⚠ **The raw token exists in the link and nowhere else.** `share_links` stores
 * only its SHA-256, so reading that table — as a company member, through the
 * claims list, or from a database dump — yields no usable link. That is the
 * same property `inviteToken.ts` gives an invite, and it is the reason this
 * module exists at all rather than the token being minted in the browser: a
 * token generated client-side would have to be sent to the server to be
 * hashed, and the only way to be sure the stored hash matches the issued token
 * is to do both in one place.
 */

/**
 * The hash is **the same function invites use**, deliberately not a second
 * implementation. Two SHA-256-hex helpers in one codebase is an invitation for
 * one of them to grow a salt, a different encoding or a different digest, and
 * the failure mode is a link that previews as `not_found` forever with nothing
 * visibly wrong at either end.
 *
 * It is re-exported under a share-link name so call sites read honestly, and
 * so that if the two ever genuinely need to diverge, this is the one line that
 * changes.
 */
export const hashShareLinkToken = hashInviteToken;

/** 32 random bytes, base64url — 256 bits, not guessable. */
export function generateShareLinkToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * TODO — PROVISIONAL, needs Tommy. He has not named a window for a share
 * link, so this number is picked rather than decided, exactly as
 * `INVITE_EXPIRY_DAYS` is.
 *
 * 30 days is longer than an invite's 14, because the thing on the other end is
 * different: an invite is a one-time action somebody takes in an afternoon,
 * whereas a share link is how a client *watches a building* — his *"really
 * cool in depth live updates to the structure they are buying"*. A fortnight
 * would expire in the middle of a job.
 *
 * It is not a year either, because an unrevoked link is live access and a
 * forwarded URL stays claimable by anyone who signs in until it lapses. 30
 * days means a stale link dies on its own; a link that should outlive a month
 * is re-minted, which is one click and leaves a record of the decision in the
 * links list.
 *
 * Not a `CatalogValue`: the status/review-log convention is for real-world
 * building numbers, and an administrative timeout in the engineer's review
 * list is noise. Flagged here and in the handoff notes instead.
 */
export const SHARE_LINK_EXPIRY_DAYS = 30;

export function shareLinkExpiryFrom(now: Date, days: number = SHARE_LINK_EXPIRY_DAYS): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * ⚠ The URL helpers live in `../cloud/shareLinkPath.ts` and are re-exported
 * here, so server code can keep importing everything share-link from one
 * place while there is still only ONE definition of the path.
 *
 * They had to move: the browser composes the link (the server does not
 * reliably know which host the person is looking at), so the builder must be
 * importable from a client component — and anything importing THIS file pulls
 * in `node:crypto` and cannot ship to the browser. The alternative was a
 * second copy of the path template in the component, with nothing keeping the
 * two in step.
 */
export { shareLinkUrl, shareTokenFromPastedLink } from "../cloud/shareLinkPath";
