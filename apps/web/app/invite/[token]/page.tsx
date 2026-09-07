import Link from "next/link";
import AcceptInviteForm from "./AcceptInviteForm";
import { hashInviteToken } from "@/app/auth/inviteToken";
import { createSupabaseServerClient, isBackendConfigured } from "@/app/auth/supabaseServer";
import pageStyles from "@/app/auth/authPage.module.css";

export const metadata = {
  title: "Accept invitation — Building Integrity",
};

interface PreviewRow {
  valid: boolean;
  reason: string | null;
  company_name: string | null;
  email: string | null;
  level: "member" | "admin" | null;
}

/**
 * The page an invite link lands on — and the only route to an account, because
 * nobody self-registers.
 *
 * A Server Component, for a real reason rather than for the sake of it: the
 * invite has to be looked up before anything is rendered, so the page can say
 * "join Building Integrity as a member" instead of showing a stranger a blank
 * sign-up form. The validity rules are the database's (`public.invite_preview`);
 * this only asks.
 *
 * Next.js 16: `params` is a Promise. The synchronous form was removed in 16,
 * not merely deprecated.
 *
 * It is a separate page from the editor on purpose. Arriving from a mailbox is
 * not the sign-in flow — that one happens inside the top bar and never
 * navigates, so it cannot lose an unsaved design. Nobody is mid-design here.
 */
export default async function InvitePage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;

  if (!isBackendConfigured()) {
    return (
      <main className={pageStyles.page}>
        <h1 className={pageStyles.title}>Invitations aren&apos;t set up</h1>
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
  const { data } = await supabase
    .rpc("invite_preview", { p_token_hash: hashInviteToken(token) })
    .maybeSingle<PreviewRow>();

  const valid = Boolean(data?.valid);
  const reason = data?.reason ?? (data ? null : "not_found");

  return (
    <main className={pageStyles.page}>
      <h1 className={pageStyles.title}>
        {valid ? `Join ${data?.company_name}` : "That invitation can't be used"}
      </h1>
      <p className={pageStyles.subtitle}>
        {valid
          ? `Invited as ${data?.level === "admin" ? "a company admin" : "a member"}, at ${data?.email}.`
          : reason === "expired"
            ? "This invitation has expired. Ask whoever sent it for a new link."
            : reason === "already_used"
              ? "This invitation has already been used. If that was you, just sign in."
              : "We can't find that invitation. Check the link, or ask for a new one."}
      </p>

      <div className={pageStyles.card}>
        {valid ? (
          <AcceptInviteForm token={token} email={data?.email ?? ""} />
        ) : (
          <p>
            Nothing is lost — the editor is open to everyone, signed in or not.
          </p>
        )}
      </div>

      <Link className={pageStyles.back} href="/">
        Back to the editor
      </Link>
    </main>
  );
}
