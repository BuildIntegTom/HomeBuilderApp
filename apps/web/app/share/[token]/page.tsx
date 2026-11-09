import Link from "next/link";
import { loadSession } from "@/app/auth/serverSession";
import { hashShareLinkToken } from "@/app/auth/shareLinkToken";
import { createSupabaseServerClient, isBackendConfigured } from "@/app/auth/supabaseServer";
import pageStyles from "@/app/auth/authPage.module.css";
import { previewShareLink } from "@/app/cloud/shareLinkRouteLogic";
import {
  PREVIEW_LOCKED_LINE,
  previewExpiryLine,
  previewOfferLine,
  previewRefusalMessage,
  projectLabel,
} from "@/app/cloud/shareLinkDisplay";
import ClaimShareLink from "./ClaimShareLink";

export const metadata = {
  title: "A shared design — Building Integrity",
};

/**
 * Where a share link lands.
 *
 * A Server Component, for the same real reason the invite page is one: the
 * link has to be looked up before anything renders, so a visitor sees
 * "Building Integrity shared the Rogers-Sehorn ADU with you" instead of a
 * spinner or a blank page asking a stranger to sign in for reasons unstated.
 * The validity rules are the database's (`share_link_preview`); this asks.
 *
 * ⚠ It calls `previewShareLink` DIRECTLY rather than fetching its own API
 * route. Same reasoning as the invite page: a server component fetching its
 * own origin is a round trip to re-enter the same process, and it needs an
 * absolute URL the server has to guess. The route exists for the client half
 * and for anything outside this page; both read the same function, so they
 * cannot disagree about what a link is.
 *
 * ⚠ NOTHING ABOUT THE DESIGN IS ON THIS PAGE. No panels, no price, no
 * dimensions, not even the project id — `share_link_preview` returns none of
 * it, by design, because this page is reachable by anybody holding the URL.
 * A stray link leaks a project NAME and a company name, and that is the whole
 * exposure. Keep it that way: if this page ever wants to show a thumbnail,
 * that is a migration decision, not a page decision.
 *
 * Next.js 16: `params` is a Promise.
 */
export default async function SharePage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;

  if (!isBackendConfigured()) {
    return (
      <main className={pageStyles.page}>
        <h1 className={pageStyles.title}>Shared designs aren&apos;t set up</h1>
        <p className={pageStyles.subtitle}>
          This deployment has no accounts backend configured. The editor still works — open it and
          use Save Project / Load Project as usual.
        </p>
        <Link className={pageStyles.back} href="/">
          Back to the editor
        </Link>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const preview = await previewShareLink(supabase, hashShareLinkToken(token));

  if (!preview.valid) {
    return (
      <main className={pageStyles.page}>
        <h1 className={pageStyles.title}>This link can&apos;t be used</h1>
        <p className={pageStyles.subtitle}>{previewRefusalMessage(preview.reason)}</p>
        <div className={pageStyles.card}>
          {/* ⚠ Says what is NOT wrong. A visitor who followed a dead link
              reasonably wonders whether they have broken something or
              misunderstood what they were sent; the editor being open to
              everyone is the reassuring and true thing to tell them. */}
          <p>
            Nothing is lost — the editor is open to everyone, signed in or not. You can draw a
            building of your own right now.
          </p>
        </div>
        <Link className={pageStyles.back} href="/">
          Open the editor
        </Link>
      </main>
    );
  }

  /* The session, only to decide which half of the card to show. Whether the
     claim succeeds is `claim_share_link`'s decision, not this page's — a
     signed-in visitor still gets refused if the link is locked to somebody
     else, and the client component reports that. */
  const session = await loadSession();
  const signedInAs = session.snapshot.backendConfigured ? (session.snapshot.user?.email ?? null) : null;

  const expiry = previewExpiryLine(preview.expiresAt);

  return (
    <main className={pageStyles.page}>
      {/* ⚠ `projectLabel`, not the raw name. A project that has never been
          saved carries `name = ''` — the column is system-maintained from the
          document — and the first version of this page rendered an empty
          heading and "Building Integrity shared  with you." for it. */}
      <h1 className={pageStyles.title}>{projectLabel(preview.projectName)}</h1>
      <p className={pageStyles.subtitle}>
        {previewOfferLine(preview.projectName, preview.ownerCompanyName, preview.grantsWrite)}
      </p>

      <div className={pageStyles.card}>
        {preview.sharedByName ? <p>Shared by {preview.sharedByName}.</p> : null}
        {expiry ? <p>{expiry}</p> : null}
        {preview.lockedToEmail ? <p>{PREVIEW_LOCKED_LINE}</p> : null}

        <ClaimShareLink
          token={token}
          signedInAs={signedInAs}
          projectName={preview.projectName}
          lockedToEmail={preview.lockedToEmail}
        />
      </div>

      <Link className={pageStyles.back} href="/">
        Back to the editor
      </Link>
    </main>
  );
}
