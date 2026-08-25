/**
 * Per-wall attributed engineer notes (Tommy's Engineer Lens mockup showed a
 * free-text note signed "- Eng. Smith") — deliberately a separate concept
 * from `ReviewLogEntry`/`reviewLog` in page.tsx, which is entirely DERIVED
 * from catalog `status`/`note` pairs (confirmed vs. pending-BI-confirmation
 * spec values), not user-authored. There's no real login in this app (see
 * viewerRole.ts's own doc comment), so `author` is a free-text name typed
 * per note, not tied to any account.
 */
export interface WallReviewNote {
  id: string;
  wallId: string;
  author: string;
  note: string;
}
