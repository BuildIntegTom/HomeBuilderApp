-- Stage 1 — optional two-factor, enforced in the database once turned on.
--
-- Decision 7, twice-confirmed: "Two-factor: optional for everyone, encouraged —
-- including platform admin." Nothing here makes 2FA mandatory for any account,
-- and nothing should. What it does is make the option MEAN something: once you
-- have enrolled a factor, a session that has only proved a password is not
-- enough to read or write your rows.
--
-- Without this, "enable 2FA" would set a flag that nothing ever checks —
-- someone holding only the password would still get everything, because RLS
-- does not look at assurance level on its own. Enrolling would be theatre. It
-- is written as a RESTRICTIVE policy so it ANDs with every permissive policy in
-- 0002 rather than adding a new way in.
--
-- The `else true` branch is the whole "optional" half: a user with no verified
-- factor is not asked for one, ever, at any level including platform admin.
--
-- THREE HONEST LIMITS, so nobody reads "two-factor is enforced in the database"
-- as absolute:
--
--  1. `public.redeem_invite` (0003) runs as the table owner, and the tables are
--     not FORCE ROW LEVEL SECURITY, so it inserts a membership without passing
--     these policies. That is narrow — it grants exactly what the invite already
--     authorized, to the person the invite names — but it is a bypass and it is
--     written down rather than discovered.
--  2. `public.create_company_with_first_admin` (0005) is the same shape and the
--     same bypass: a password-only session on an account that HAS enrolled a
--     factor can read nothing at all here, and could still create a company and
--     mint its admin invite. Every definer function that writes rows its caller
--     could not write is outside these policies by construction; there are two,
--     and this is the list of them. The route calls requireSatisfiedAal() before
--     invoking it, which closes the path anyone actually uses — but a caller
--     going straight to the RPC is not covered by that, only by this note.
--  3. These policies govern the four tables. They say nothing about Supabase's
--     own Auth endpoints, which is why the routes that change a password or
--     remove a factor check the assurance level themselves rather than assuming
--     GoTrue does. See requireSatisfiedAal() in apps/web/app/auth/serverSession.ts.

create or replace function public.meets_required_aal()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from auth.mfa_factors f
      where f.user_id = auth.uid() and f.status = 'verified'
    )
    -- Enrolled: the session must have actually presented the second factor.
    then coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    -- Not enrolled: unaffected. This is the default state and stays supported.
    else true
  end;
$$;

-- Revoked from PUBLIC first, like every other helper in 0002. Granting to
-- `authenticated` without revoking leaves it callable by `anon` as well, which
-- was the state this function was in and the others were not.
revoke all on function public.meets_required_aal() from public;
revoke all on function public.meets_required_aal() from anon;
grant execute on function public.meets_required_aal() to authenticated;

drop policy if exists companies_require_aal on public.companies;
create policy companies_require_aal on public.companies
  as restrictive for all to authenticated
  using (public.meets_required_aal())
  with check (public.meets_required_aal());

drop policy if exists user_profiles_require_aal on public.user_profiles;
create policy user_profiles_require_aal on public.user_profiles
  as restrictive for all to authenticated
  using (public.meets_required_aal())
  with check (public.meets_required_aal());

drop policy if exists memberships_require_aal on public.memberships;
create policy memberships_require_aal on public.memberships
  as restrictive for all to authenticated
  using (public.meets_required_aal())
  with check (public.meets_required_aal());

drop policy if exists invites_require_aal on public.invites;
create policy invites_require_aal on public.invites
  as restrictive for all to authenticated
  using (public.meets_required_aal())
  with check (public.meets_required_aal());
