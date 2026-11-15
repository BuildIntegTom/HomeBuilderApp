/**
 * The proposal-link URL shape, with NO `node:crypto` in it — the same split,
 * for the same reason, as `shareLinkPath.ts`: the browser composes the link, so
 * the function that builds it has to be importable from a client component,
 * and `proposalToken.ts` imports `node:crypto`.
 *
 * ⚠ **A proposal link is NOT a share link, and the path is the only thing that
 * says so.** Both tokens are 43 characters of base64url and are
 * indistinguishable from one another. Hashing a proposal token against
 * `share_links` finds nothing and reports a dead link — telling somebody their
 * perfectly good link is invalid. That failure already bit the invite/share
 * pair once (see `shareTokenFromPastedLink`), which is why this file refuses
 * the other two paths explicitly rather than relying on its own regex missing
 * them.
 */

/** The link a designer with no account sends to a company. */
export function proposalUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/proposal/${encodeURIComponent(token)}`;
}

/**
 * The token back out of a pasted link, for the person who pastes the whole URL
 * rather than just the token. `null` when the text is not one of ours.
 *
 * Tolerant about the ORIGIN, strict about the PATH — a link made on
 * strawpanels.com and opened on a preview deployment is the same link, because
 * the token identifies it and the database never sees a host.
 */
export function proposalTokenFromPastedLink(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  /* ⚠ Refused rather than quietly accepted: see this file's own header. */
  if (/\/invite\//.test(trimmed) || /\/share\//.test(trimmed)) return null;
  const match = /\/proposal\/([A-Za-z0-9_-]+)\/?$/.exec(trimmed);
  if (match) return match[1];
  /* A bare token, which is what somebody who was read it over the phone has. */
  return /^[A-Za-z0-9_-]{20,}$/.test(trimmed) ? trimmed : null;
}
