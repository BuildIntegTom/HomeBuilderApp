/**
 * The share-link URL shape, with NO `node:crypto` in it — which is the entire
 * reason this file is separate from `auth/shareLinkToken.ts`.
 *
 * ⚠ The browser composes the link, so the function that builds it has to be
 * importable from a client component. `shareLinkToken.ts` imports
 * `node:crypto` for the token and its hash, and anything importing that file
 * cannot ship to the browser. Putting `shareLinkUrl` there and then needing it
 * in `ShareLinkSection.tsx` would have meant either a duplicate string
 * template in the component — two places that must agree about a path, with
 * nothing making them — or dragging a server module into the bundle.
 *
 * `shareLinkToken.ts` re-exports both of these, so server code can carry on
 * importing everything from one place and there is still only one definition.
 */

/** The link that gets copied and sent. */
export function shareLinkUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/share/${encodeURIComponent(token)}`;
}

/**
 * The token back out of a pasted link, for the person who pastes the whole URL
 * instead of just the token. Returns `null` when the text is not one of ours.
 *
 * ⚠ Deliberately tolerant about the ORIGIN and strict about the PATH. A link
 * minted on `strawpanels.com` and opened on a preview deployment is the same
 * link — the token is what identifies it, and the database never sees a host.
 * But `/share/<token>` is matched exactly so that pasting some other page's
 * URL fails here rather than being hashed into a `not_found` preview, which
 * would tell somebody their link was dead when really they pasted the wrong
 * thing.
 */
export function shareTokenFromPastedLink(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  /* ⚠ An INVITE link is refused here, not quietly accepted as a share token.
     The two tokens are both 43 characters of base64url and are
     indistinguishable from one another; only the path tells them apart. If
     this returned the token out of `/invite/…`, Home's paste box would hash it
     against `share_links`, find nothing, and tell somebody holding a perfectly
     good invitation that their link was invalid. */
  if (/\/invite\//.test(trimmed)) return null;
  const match = /\/share\/([A-Za-z0-9_-]+)\/?$/.exec(trimmed);
  if (match) return match[1];
  // A bare token, which is what the box asks for.
  return /^[A-Za-z0-9_-]{16,}$/.test(trimmed) ? trimmed : null;
}

/**
 * The same, for an invitation link (`/invite/<token>`).
 *
 * ⚠ **A bare token is NOT accepted here**, unlike above, and the asymmetry is
 * deliberate rather than an oversight. Home has one paste box for both kinds
 * of link, so something has to break the tie when the text carries no path.
 * A share link is the far commoner thing to be sent and the one Tommy's flow
 * is built around, so it wins the ambiguous case; an invite must bring its
 * path to be recognised. Being wrong in the other direction would be worse —
 * an invite token hashed against `share_links` reports "this link isn't
 * valid", which is the one message guaranteed to make somebody give up.
 */
export function invitePathFromPastedLink(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  const match = /\/invite\/([A-Za-z0-9_-]+)\/?$/.exec(trimmed);
  return match ? match[1] : null;
}
