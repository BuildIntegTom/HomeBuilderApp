-- Stage 1 — row-level security.
--
-- Supabase was chosen (decision 30) specifically because the permission rules
-- cross company boundaries, so they are written once here rather than
-- re-derived in every route handler. Every rule that decides "may this person
-- see or change this row" lives in this file. Route handlers call the database
-- with the signed-in user's own JWT and get whatever these policies allow —
-- they do not re-implement the rules and must not be trusted to.
--
-- 0001 creates trigger functions that call the helpers defined here. plpgsql
-- resolves function names at run time, so the ordering is fine, but this file
-- must be applied before any row is written.
--
-- The honest caveat from the spec, repeated because it is easy to over-trust
-- RLS: these policies govern whether you can see a ROW, not whether you can see
-- a FIELD inside it. Cost redaction (Stage 4) is application logic and is not
-- here.

-- ---------------------------------------------------------------------------
-- Helpers. All SECURITY DEFINER so that a policy on one table can consult
-- another without re-entering that table's own policies (which recurses).
-- auth.uid() still reports the calling user inside a definer function.
-- ---------------------------------------------------------------------------

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select up.is_platform_admin from public.user_profiles up where up.id = auth.uid()),
    false
  );
$$;

-- THE ONE FUNCTION IN THIS SCHEMA THAT GRANTS RATHER THAN RESTRICTS. Every
-- guard trigger in 0001 returns early when it says yes, so it is worth reading
-- twice. Two ways to be privileged, and no others:
--
--   1. You are a platform admin.
--   2. The session opted in, out loud, with `set local app.operator = 'on'`.
--
-- The second is for seed.sql and the bootstrap in supabase/README.md, which
-- legitimately need to set is_seed_member and is_platform_admin before any
-- platform admin exists to authorize it. Both do it visibly, inside their own
-- transaction, and turn it back off.
--
-- WHAT THIS REPLACES AND WHY. The first version asked "is auth.uid() null?",
-- which is true of ANY caller arriving without a subject — including an
-- anonymous API request. It was inert only because `anon` holds no table grants
-- and so could not reach a guard trigger at all: a property of the GRANTS, not
-- of this function, and one careless grant away from mattering. Stage 2 adds
-- four more tables to sit behind it.
--
-- An opt-in cannot happen by accident, and it cannot happen through the API at
-- all: a PostgREST client sets no GUC except the request.* ones PostgREST sets
-- for it, and no function in this schema sets this one. It is also, unlike a
-- session_user or current_user test, something a test can actually exercise —
-- see the assertions in supabase/tests/stage1_rls.test.sql, which is how the
-- old formulation should have been caught and wasn't.
create or replace function public.is_privileged_caller()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (
      coalesce(current_setting('app.operator', true), '') = 'on'
      -- Belt: an operator opt-in is meaningless from a role PostgREST hands
      -- out. Nothing can set the GUC through the API, so this is unreachable
      -- rather than load-bearing — but "the escape works while acting as
      -- authenticated" is the single combination worth making impossible
      -- instead of merely unreachable. It also stops the test suite proving
      -- the escape in a posture production never has.
      --
      -- The `role` GUC, NOT current_user: this function is SECURITY DEFINER, so
      -- current_user is its owner and would say 'postgres' no matter who called
      -- it. `role` follows the caller's own SET ROLE, which is exactly what
      -- PostgREST does per request, and is unaffected by definer rights. It
      -- reads 'none' on a direct connection that has not switched role.
      and coalesce(current_setting('role', true), 'none')
            not in ('anon', 'authenticated', 'authenticator')
    )
    or public.is_platform_admin();
$$;

create or replace function public.is_member_of(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.company_id = p_company
  );
$$;

create or replace function public.is_company_admin(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.company_id = p_company
      and m.level = 'admin'
  );
$$;

-- Is this person a company admin anywhere? Decision 27: creating a company is
-- open to company admins at any member company, plus platform admin.
create or replace function public.is_company_admin_anywhere()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.companies c on c.id = m.company_id
    where m.user_id = auth.uid()
      and m.level = 'admin'
      and c.is_seed_member
  );
$$;

-- Which company row IS the consortium. At most one may carry the flag (partial
-- unique index in 0001), so the ordering below is belt and braces rather than
-- load-bearing — but an unordered `limit 1` that silently picks a different row
-- after a restore is the kind of thing worth not writing.
--
-- If NO row carries the flag this returns null, and can_act_as's comparison
-- against it is then null — so nobody gets a consortium entitlement and the
-- switcher degrades to memberships only. That is the fail-closed direction and
-- is deliberate: a missing flag must not hand anybody access. It is also
-- exactly what seed.sql exists to prevent, and why the spec says in so many
-- words to set The Seed Collaborative's own flag true.
create or replace function public.consortium_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.companies c
  where c.is_consortium
  order by c.created_at, c.id
  limit 1;
$$;

-- "Membership in any member company entitles you to act as the Seed
-- Collaborative" — being at Building Integrity is what puts the entry in front
-- of you; no separate Seed membership row is needed. The false branch is real:
-- a person whose companies all have is_seed_member = false has no path to Seed.
create or replace function public.is_seed_entitled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.companies c on c.id = m.company_id
    where m.user_id = auth.uid()
      and c.is_seed_member
  );
$$;

-- THE switcher rule, in the database. "The switcher selects among entitlements
-- you already hold; it never creates one." A client-supplied acting-as company
-- is checked against this and rejected if it is not in the set.
create or replace function public.can_act_as(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_company is not null
    and (
      public.is_platform_admin()
      or public.is_member_of(p_company)
      or (p_company = public.consortium_company_id() and public.is_seed_entitled())
    );
$$;

create or replace function public.shares_company_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.company_id = mine.company_id
    where mine.user_id = auth.uid()
      and theirs.user_id = p_user
  );
$$;

-- ---------------------------------------------------------------------------
-- Privileges. Guests never reach these tables at all — the editor is fully
-- usable signed out (decision 4/5) and asks the backend for nothing.
-- ---------------------------------------------------------------------------

-- PostgreSQL grants EXECUTE on a new function to PUBLIC by default, which means
-- `anon`. Left alone that hands an unauthenticated caller the consortium's uuid
-- from consortium_company_id(), and — the one that actually matters — lets them
-- call is_privileged_caller(), the single fail-open primitive in the schema.
-- Neither is exploitable today, because anon holds no table grants and cannot
-- reach a guard trigger. Both are one careless grant away from mattering, so
-- they are closed here rather than left resting on that.
--
-- Definer functions called from inside another definer function (the guard
-- triggers) are unaffected: EXECUTE is checked against the effective user,
-- which is the owner. RLS policy expressions ARE evaluated as the querying
-- user, which is why `authenticated` still needs these.
do $grants$
declare
  fn text;
begin
  foreach fn in array array[
    'public.is_platform_admin()',
    'public.is_privileged_caller()',
    'public.is_member_of(uuid)',
    'public.is_company_admin(uuid)',
    'public.is_company_admin_anywhere()',
    'public.consortium_company_id()',
    'public.is_seed_entitled()',
    'public.can_act_as(uuid)',
    'public.shares_company_with(uuid)'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke all on function %s from anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end
$grants$;

revoke all on public.companies, public.user_profiles, public.memberships, public.invites from anon;
grant select, insert, update, delete
  on public.companies, public.user_profiles, public.memberships, public.invites
  to authenticated;

alter table public.companies enable row level security;
alter table public.user_profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.invites enable row level security;

-- Deliberately NOT `force row level security`. The table owner has to be able
-- to bypass policies for exactly one reason: redeem_invite() (0003) inserts a
-- membership on behalf of someone who, by definition, is not yet a member and
-- so cannot pass memberships_insert. FORCE would break that path. Nothing else
-- runs as the owner: every route handler uses the caller's own JWT, and the
-- service-role key (which bypasses RLS on any Supabase project, FORCE or not)
-- is used only for the two pre-account operations documented in
-- apps/web/app/auth/supabaseServer.ts.

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies
  for select to authenticated
  using (
    public.is_member_of(id)
    -- The consortium company is visible by name to anyone entitled to act as
    -- it, because the switcher has to be able to label the entry. This does NOT
    -- make other companies' rows visible — the cross-company read layer is
    -- Stage 4 and is deliberately not opened here.
    or (is_consortium and public.is_seed_entitled())
    or public.is_platform_admin()
  );

drop policy if exists companies_insert on public.companies;
create policy companies_insert on public.companies
  for insert to authenticated
  with check (
    (public.is_company_admin_anywhere() or public.is_platform_admin())
    and created_by = auth.uid()
  );

-- Decision 27: "the creator gets no standing access to the company they
-- created" — note there is no trigger here inserting a membership for the
-- creator. Creating is not joining.

drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies
  for update to authenticated
  using (public.is_company_admin(id) or public.is_platform_admin())
  with check (public.is_company_admin(id) or public.is_platform_admin());
-- (is_seed_member / is_consortium are additionally locked to platform admin by
-- the guard_company_flags trigger in 0001.)

drop policy if exists companies_delete on public.companies;
create policy companies_delete on public.companies
  for delete to authenticated
  using (public.is_platform_admin());  -- decision 13: archive, never delete

-- ---------------------------------------------------------------------------
-- user_profiles
-- ---------------------------------------------------------------------------
drop policy if exists user_profiles_select on public.user_profiles;
create policy user_profiles_select on public.user_profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.shares_company_with(id)
    or public.is_platform_admin()
  );

drop policy if exists user_profiles_insert on public.user_profiles;
create policy user_profiles_insert on public.user_profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists user_profiles_update on public.user_profiles;
create policy user_profiles_update on public.user_profiles
  for update to authenticated
  using (id = auth.uid() or public.is_platform_admin())
  with check (id = auth.uid() or public.is_platform_admin());

drop policy if exists user_profiles_delete on public.user_profiles;
create policy user_profiles_delete on public.user_profiles
  for delete to authenticated
  using (public.is_platform_admin());

drop trigger if exists user_profiles_guard_columns on public.user_profiles;
create trigger user_profiles_guard_columns
  before update on public.user_profiles
  for each row execute function public.guard_user_profile_columns();

-- ---------------------------------------------------------------------------
-- memberships
-- ---------------------------------------------------------------------------
drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_company_admin(company_id)
    or public.is_platform_admin()
  );

drop policy if exists memberships_insert on public.memberships;
create policy memberships_insert on public.memberships
  for insert to authenticated
  with check (public.is_company_admin(company_id) or public.is_platform_admin());
-- Nobody adds themselves: a plain member cannot insert, so the only routes into
-- a company are a company admin's hand and redeem_invite() (0003).

drop policy if exists memberships_update on public.memberships;
create policy memberships_update on public.memberships
  for update to authenticated
  using (
    user_id = auth.uid()                 -- your own default-company choice
    or public.is_company_admin(company_id)
    or public.is_platform_admin()
  )
  with check (
    user_id = auth.uid()
    or public.is_company_admin(company_id)
    or public.is_platform_admin()
  );
-- (guard_membership_self_update in 0001 narrows the self case to is_default.)

drop policy if exists memberships_delete on public.memberships;
create policy memberships_delete on public.memberships
  for delete to authenticated
  using (
    user_id = auth.uid()                 -- leaving a company yourself
    or public.is_company_admin(company_id)
    or public.is_platform_admin()
  );
-- Decision 6: revocation removes access, not attribution. Nothing here deletes
-- or rewrites anything the person authored.

-- ---------------------------------------------------------------------------
-- invites
-- ---------------------------------------------------------------------------
drop policy if exists invites_select on public.invites;
create policy invites_select on public.invites
  for select to authenticated
  using (public.is_company_admin(company_id) or public.is_platform_admin());
-- The invitee is not signed in yet and never reads this table directly; they go
-- through invite_preview() / redeem_invite() in 0003, which take the token.

drop policy if exists invites_insert on public.invites;
create policy invites_insert on public.invites
  for insert to authenticated
  with check (
    (public.is_company_admin(company_id) or public.is_platform_admin())
    and created_by = auth.uid()
    and expires_at > now()
  );
-- A company's FIRST invite cannot come through here, because at that moment
-- nobody administers it. That one is minted by
-- public.create_company_with_first_admin (0005), in the same call that creates
-- the company — which is how the creator ends up with no standing access at any
-- point, rather than with a window that has to be closed again.

drop policy if exists invites_update on public.invites;
create policy invites_update on public.invites
  for update to authenticated
  using (public.is_company_admin(company_id) or public.is_platform_admin())
  with check (public.is_company_admin(company_id) or public.is_platform_admin());

drop policy if exists invites_delete on public.invites;
create policy invites_delete on public.invites
  for delete to authenticated
  using (public.is_company_admin(company_id) or public.is_platform_admin());
