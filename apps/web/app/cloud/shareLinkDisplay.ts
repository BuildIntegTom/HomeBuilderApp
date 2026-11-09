/**
 * Every user-facing word about share links, in one file and with no React in
 * it, in the shape `sharingDisplay.ts` established: the strings are testable
 * on their own, and a route handler, the editor and the landing page all read
 * the same sentence rather than three near-copies.
 */

import { UNTITLED_LABEL } from "./cloudTypes";

export type ShareLinkPreviewReason = "not_found" | "revoked" | "expired";

/**
 * ⚠ A project's name can legitimately be the EMPTY STRING, and `??` does not
 * catch it.
 *
 * `projects.name` is system-maintained: `apply_project_version_head` copies it
 * out of the saved document's `state.projectName`, so a project that has never
 * been saved, or one saved with the name field cleared, really does carry `''`.
 * The schema says so in as many words — *"Empty renders as (untitled) in the
 * tree: a visible gap, not a substituted name."*
 *
 * Found by driving `share_link_preview` against the real SQL: the preview came
 * back with `project_name: ""`, and the landing page rendered an empty `<h1>`
 * and the sentence *"Building Integrity shared  with you."* — because
 * `projectName ?? "a design"` passes an empty string straight through. Nullish
 * coalescing is the wrong operator for a column whose empty value is
 * meaningful.
 *
 * `(untitled)` is the phrase the project tree, the delete confirmations and the
 * backup report all use for this, so it is the phrase here too: one unnamed
 * project should not be called three different things depending on which screen
 * you are looking at.
 */
export function projectLabel(name: string | null | undefined): string {
  return name && name.trim().length > 0 ? name : UNTITLED_LABEL;
}

export type ClaimStatus = "claimed" | "already-claimed" | "already-has-access";

/** 0011's `share_link_preview.reason`, for a visitor who is not signed in. */
export function previewRefusalMessage(reason: ShareLinkPreviewReason | string | null): string {
  switch (reason) {
    case "revoked":
      /* ⚠ Named plainly as somebody's decision rather than dressed up as a
         technical fault. The person who revoked it meant to, and a visitor
         told "something went wrong" would reasonably retry, ask for help, and
         waste both their time and the owner's. */
      return "This link has been turned off by the company that sent it. Ask them for a new one.";
    case "expired":
      return "This link has expired. Ask the company that sent it for a new one.";
    case "not_found":
    default:
      /* ⚠ ONE message for "no such link" and "that is not a link at all".
         The database answers `not_found` for both, deliberately, so a token
         cannot be probed; saying "that link does not exist" versus "that is
         malformed" here would hand back the distinction the database refused
         to give. */
      return "This link isn't valid. Check you copied the whole thing, or ask the company that sent it for a new one.";
  }
}

/**
 * What the visitor is being offered, before they sign in. `grantsWrite` is
 * told up front because it is a fact about their own access, and "view only"
 * is the honest label for what they are getting.
 */
export function previewOfferLine(projectName: string | null, ownerCompanyName: string | null, grantsWrite: boolean): string {
  const access = grantsWrite ? "You'll be able to open it and make changes." : "You'll be able to open it and watch it change. View only — you won't be able to edit it.";
  /* Both names go through a label: an unnamed project is `(untitled)`, and an
     owner company the preview could not read is "A company" rather than a
     sentence with a hole in it. The company name is never empty in practice
     — `companies.name` is NOT NULL and non-blank — but the preview types it
     nullable because a dead link returns nulls for everything. */
  return `${ownerCompanyName || "A company"} shared ${projectLabel(projectName)} with you. ${access}`;
}

/** The expiry, as a date rather than a countdown. */
export function previewExpiryLine(expiresAt: string | null, now: Date = new Date()): string | null {
  if (!expiresAt) return null;
  const when = new Date(expiresAt);
  if (Number.isNaN(when.getTime())) return null;
  const days = Math.ceil((when.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return null;
  const date = when.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  /* ⚠ Both the date and the count. The date is what somebody acts on ("I'll
     do it at the weekend"); the count is what makes urgency legible when it
     is short. One without the other is worse: a bare date two days out does
     not read as urgent, and a bare "2 days" cannot be put in a diary. */
  return days === 1 ? `This link expires tomorrow (${date}).` : `This link expires in ${days} days (${date}).`;
}

export const PREVIEW_LOCKED_LINE = "This link was sent to one email address, and only that address can open it.";

/** What happened after a claim, for the person who just claimed. */
export function claimOutcomeMessage(status: ClaimStatus | string, projectName: string | null): string {
  /* `||` not `??`, for the empty-name reason on `projectLabel` — but "that
     design" rather than `(untitled)`, because this sentence is addressed to
     the person who just claimed it and "You now have access to (untitled)"
     reads like a fault. */
  const name = projectName && projectName.trim().length > 0 ? projectName : "that design";
  switch (status) {
    case "claimed":
      return `You now have access to ${name}.`;
    case "already-claimed":
      /* Not an error and not a no-op worth apologising for: they clicked an
         old link, and the right thing to do with that is open the project. */
      return `You already had access to ${name}.`;
    case "already-has-access":
      /* ⚠ Deliberately does not say "you are a member of the owning company"
         — a platform admin and a company grant reach this branch too, and
         asserting which one would sometimes be wrong. */
      return `You can already open ${name} through your own account, so this link didn't need to add anything.`;
    default:
      return `You have access to ${name}.`;
  }
}

/**
 * The claim-time refusals, which 0011 RAISES rather than returning, because by
 * then the preview has already vouched for the link: a refusal here is a race
 * (revoked or expired in the seconds between) or a locked-email mismatch.
 */
export const CLAIM_NOT_SIGNED_IN_MESSAGE = "Sign in first, then open the link again. Nothing was changed.";

/**
 * ⚠ ONE message for all three of "no such link", "revoked" and "expired",
 * because 0011 raises **the same SQLSTATE 22023** for all three and this
 * codebase never forwards a database message. There is deliberately no
 * CLAIM_REVOKED_MESSAGE or CLAIM_EXPIRED_MESSAGE: writing them would imply a
 * distinction the route cannot actually make, and the first person to need
 * them would have to discover that the hard way.
 *
 * Nothing is lost by it. The PREVIEW does distinguish the three — it returns
 * a `reason`, and `previewRefusalMessage` above gives each its own words — and
 * the preview is what a visitor sees first. A refusal at CLAIM time therefore
 * means the link died in the seconds between previewing and claiming, which is
 * a race, and "isn't valid any more" is the true description of all three
 * races at once.
 */
export const CLAIM_INVALID_MESSAGE = "This link isn't valid any more. Ask the company that sent it for a new one.";

/**
 * ⚠ 42501 from `claim_share_link` means THIS, and not the two-factor
 * refusal that shares the code.
 *
 * `claim_share_link` raises 42501 in two places — `meets_required_aal()`
 * failing, and a locked email not matching — so by SQLSTATE alone they are
 * indistinguishable. They are told apart upstream rather than guessed at:
 * every cloud route enters through `requireCloudSession()`, which refuses an
 * `mfaPending` session with its own 401 and its own wording before any RPC
 * runs. So the two-factor branch is unreachable from here, and a 42501 that
 * does arrive is the locked-email mismatch.
 *
 * ⚠ If a share-link route is ever added that does NOT go through
 * `requireCloudSession()`, this reasoning breaks and a two-factor refusal will
 * read as "wrong email address" — confusing, and it would send somebody
 * hunting for an email problem that does not exist.
 */
export const CLAIM_WRONG_EMAIL_MESSAGE =
  "This link was sent to a different email address. Sign in with the address it was sent to, or ask for a link for this one.";
export const CLAIM_UNATTRIBUTABLE_MESSAGE =
  "Your account has no name or email on it, so the access couldn't be recorded. Add a name to your profile and try again.";

/** Minting, listing and revoking — the owner side. */
export const MINT_REFUSED_MESSAGE = "That project doesn't exist, or you can't make a link for it. No link was made.";
export const MINT_EXPIRY_MESSAGE = "A share link has to expire in the future. No link was made.";
export const MINT_UNATTRIBUTABLE_MESSAGE = "That link couldn't be recorded because your account has no name or email. No link was made.";
export const LINKS_LIST_REFUSED_MESSAGE = "Couldn't list this project's links. Your access may have changed; reload the page and try again.";
export const REVOKE_REFUSED_MESSAGE = "That link doesn't exist, or you can't turn it off. Nothing was changed.";

/**
 * ⚠ Shown next to a freshly minted link, and it is the one warning on the
 * owner side that is not about a failure.
 *
 * The token is stored only as a SHA-256, so this response is the single time
 * the link itself exists anywhere outside the clipboard. Saying so is not
 * decoration: somebody who closes the panel expecting to find it in the list
 * later has lost it, and the only remedy is minting another.
 */
export const MINT_COPY_NOW_MESSAGE = "Copy this link now — it isn't stored anywhere and won't be shown again. Lost it? Make another and turn this one off.";

/** One row of the links list, as a sentence. */
export function linkStateLabel(row: { isLive: boolean; revokedAt: string | null; expiresAt: string }, now: Date = new Date()): string {
  if (row.revokedAt) return "Turned off";
  if (new Date(row.expiresAt).getTime() <= now.getTime()) return "Expired";
  return row.isLive ? "Live" : "Not live";
}

export function claimCountLabel(claims: readonly unknown[]): string {
  if (claims.length === 0) return "Nobody has opened it yet";
  return claims.length === 1 ? "1 person has opened it" : `${claims.length} people have opened it`;
}
