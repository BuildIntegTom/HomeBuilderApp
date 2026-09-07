import Link from "next/link";
import ResetPasswordForm from "./ResetPasswordForm";
import pageStyles from "@/app/auth/authPage.module.css";

export const metadata = {
  title: "Set a new password — Building Integrity",
};

/**
 * Where a password-reset email lands.
 *
 * Next.js 16: `searchParams` is a Promise and must be awaited. Supabase's link
 * carries either a PKCE `code` or a `token_hash` + `type`, depending on how the
 * email template is configured — both are read here and both are handled by
 * /api/auth/password-update, so customising the template later does not quietly
 * break the reset flow.
 */
export default async function ResetPasswordPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await props.searchParams;
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : (value ?? null);

  return (
    <main className={pageStyles.page}>
      <h1 className={pageStyles.title}>Set a new password</h1>
      <p className={pageStyles.subtitle}>
        Open this page from the link in your reset email, in the same browser you asked from.
      </p>
      <div className={pageStyles.card}>
        <ResetPasswordForm code={first(params.code)} tokenHash={first(params.token_hash)} />
      </div>
      <Link className={pageStyles.back} href="/">
        Back to the editor
      </Link>
    </main>
  );
}
