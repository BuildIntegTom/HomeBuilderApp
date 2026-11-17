import Link from "next/link";
import { loadSession } from "@/app/auth/serverSession";
import { hashProposalToken } from "@/app/auth/proposalToken";
import { createSupabaseServerClient, isBackendConfigured } from "@/app/auth/supabaseServer";
import pageStyles from "@/app/auth/authPage.module.css";
import { previewProposal } from "@/app/cloud/proposalRouteLogic";
import {
  PROPOSAL_DEAD_MESSAGE,
  PROPOSAL_DEAD_REASSURANCE,
  proposalAdoptedLine,
  proposalExpiryLine,
  proposalFromLine,
  proposalSentLine,
} from "@/app/cloud/proposalDisplay";
import AdoptProposal from "./AdoptProposal";

export const metadata = {
  title: "A proposal — Building Integrity",
};

/**
 * Where a proposal link lands.
 *
 * > *"building integrity can recieve a link from a not signed in account - and
 * > then adopt the project as their own"* — Tommy, 2026-11-08
 *
 * A Server Component, for the same real reason the share and invite pages are:
 * the link has to be looked up before anything renders, so the reader sees
 * what they have been sent rather than a spinner. It calls `previewProposal`
 * DIRECTLY rather than fetching its own API route — a server component
 * fetching its own origin is a round trip to re-enter the same process, and it
 * needs an absolute URL the server has to guess. The route exists for the
 * client half; both read the same function, so they cannot disagree.
 *
 * ⚠ **THE DESIGN IS NOT ON THIS PAGE, and that is the same rule the share
 * page carries.** `proposal_preview` returns a name, two dates and whether
 * somebody has adopted it — no document, no panels, no price. A stray link
 * leaks that a proposal exists and who sent it, and that is the whole
 * exposure. Widening it is a migration decision, not a page decision.
 *
 * ⚠ **BOTH ENDS OF THE CONVERSATION LAND HERE**, which is unusual and worth
 * knowing before editing: the company deciding whether to take the design on,
 * and the SENDER — who has no account at all — following their own link to see
 * whether anybody did. That is why an adopted proposal still renders as an
 * answer rather than a refusal.
 *
 * Next.js 16: `params` is a Promise.
 */
export default async function ProposalPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;

  if (!isBackendConfigured()) {
    return (
      <main className={pageStyles.page}>
        <h1 className={pageStyles.title}>Proposals aren&apos;t set up</h1>
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
  const preview = await previewProposal(supabase, hashProposalToken(token));

  if (!preview.found) {
    return (
      <main className={pageStyles.page}>
        <h1 className={pageStyles.title}>This link can&apos;t be used</h1>
        <p className={pageStyles.subtitle}>{PROPOSAL_DEAD_MESSAGE}</p>
        <div className={pageStyles.card}>
          <p>{PROPOSAL_DEAD_REASSURANCE}</p>
        </div>
        <Link className={pageStyles.back} href="/">
          Open the editor
        </Link>
      </main>
    );
  }

  /* The session, only to decide which half of the card to show. Whether an
     adoption succeeds is `adopt_proposal`'s decision and not this page's — a
     signed-in visitor is still refused if they are not a member of the company
     they chose, and the client component reports that. */
  const session = await loadSession();
  const backend = session.snapshot.backendConfigured;
  const signedInAs = backend ? (session.snapshot.user?.email ?? null) : null;
  /**
   * ⚠ **MEMBERSHIPS ONLY, not every company this person may act as.**
   *
   * `adopt_proposal` asks `is_member_of(company_id)`, which a consortium or
   * platform-admin entitlement does NOT satisfy — those let somebody act as a
   * company without belonging to it. Offering them here would put companies in
   * the picker that the database refuses the moment Adopt is pressed, and the
   * refusal would read as a bug rather than as the rule it is. The database
   * stays the authority; this list just stops offering what it will say no to.
   */
  const companies = backend
    ? session.snapshot.entitlements
        .filter((e) => e.source === "membership")
        .map((e) => ({ id: e.companyId, name: e.companyName }))
    : [];

  const sent = proposalSentLine(preview.createdAt);
  const expiry = proposalExpiryLine(preview.expiresAt);
  const adopted = proposalAdoptedLine(preview);

  return (
    <main className={pageStyles.page}>
      <h1 className={pageStyles.title}>A proposal</h1>
      <p className={pageStyles.subtitle}>{proposalFromLine(preview.submitterName)}</p>

      <div className={pageStyles.card}>
        {sent ? <p>{sent}</p> : null}
        {/* ⚠ The expiry is hidden once somebody has adopted it: the link
            lapsing no longer costs anybody anything, and leaving a deadline on
            screen beside "this has been taken up" reads as a second thing to
            worry about. */}
        {!preview.adopted && expiry ? <p>{expiry}</p> : null}
        {adopted ? <p>{adopted}</p> : null}

        <AdoptProposal
          token={token}
          signedInAs={signedInAs}
          alreadyAdopted={preview.adopted}
          adoptedByCompanyName={preview.adoptedByCompanyName}
          companies={companies}
          actingAsCompanyId={session.snapshot.actingAsCompanyId ?? null}
        />
      </div>

      <Link className={pageStyles.back} href="/">
        Back to the editor
      </Link>
    </main>
  );
}
