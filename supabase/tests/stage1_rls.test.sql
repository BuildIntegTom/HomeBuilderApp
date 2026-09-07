-- Stage 1 RLS verification.
--
-- Every assertion here is about a rule that lives in the database, not in the
-- app: who may act as which company, who may read which rows, and which writes
-- the policies and guard triggers refuse. It either ends with
-- "stage1_rls: ALL ASSERTIONS PASSED" or aborts on the first failure.
--
-- HOW TO RUN
--   Supabase: paste into the SQL editor and run. Everything happens inside one
--             transaction that rolls back at the end, so no rows survive — but
--             prefer a staging project if you would rather not exercise guard
--             triggers against live data.
--   Locally:  psql -f supabase/tests/local_shim.sql, then the three migrations,
--             then this file. See supabase/README.md.
--
-- Deliberately NOT tested here, because they are not database rules: the
-- sign-in flow, cookie handling, and the acting-as cookie itself. The pure half
-- of that logic is unit-tested in apps/web/app/auth/actingAs.test.ts; the wiring
-- is only exercised by running the app against a real Supabase project.
--
-- Note on negative assertions: an RLS denial on INSERT raises an error (caught
-- below with begin/exception), but a denial on UPDATE or DELETE is silent — the
-- statement simply affects zero rows. Those cases are asserted on row_count,
-- not on an exception, because asserting on an exception there would pass for
-- the wrong reason.

begin;

-- Building the fixtures needs what seed.sql needs: setting is_seed_member on a
-- company and is_platform_admin on a profile, before any platform admin exists
-- to authorize it. Opt in explicitly, exactly as an operator script does — and
-- turn it off again before a single assertion runs, because everything this
-- file is actually testing has to be tested WITHOUT it.
set local app.operator = 'on';

create or replace function pg_temp.assert(cond boolean, msg text)
returns void language plpgsql as $$
begin
  if cond is not true then
    raise exception 'FAIL: %', msg;
  end if;
end;
$$;

-- Acts as a given user for the statements that follow.
-- p_aal is the session's authenticator assurance level: 'aal1' = password only,
-- 'aal2' = a second factor was presented too. Everyone defaults to aal1, which
-- is what an account with no two-factor enrolled always has.
create or replace function pg_temp.act_as(p_user uuid, p_aal text default 'aal1')
returns void language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text,
    true);
end;
$$;

-- ===========================================================================
-- Fixtures (created as the owner, which bypasses RLS)
-- ===========================================================================
-- Companies
--   11.. Building Integrity   is_seed_member = true
--   22.. Rare Forms           is_seed_member = true
--   33.. Nonmember Co         is_seed_member = FALSE  <- the false branch
--   44.. Seed Collaborative   is_seed_member = true, is_consortium = true
-- People
--   aa.. alice   admin at BI
--   bb.. bob     member at BI
--   cc.. carol   member at Nonmember Co
--   dd.. dave    member at Seed (Seed is his default company)
--   ee.. erin    admin at BI too, so alice is not always the last admin
--   ff.. pat     platform admin, no memberships at all
--   99.. newhire no account activity yet; redeems an invite below

-- REFUSE TO RUN ON A DATABASE THAT HAS PEOPLE IN IT.
--
-- The fixtures below clear three tables so that the row counts mean something.
-- That is safe under the ROLLBACK at the end — but "safe as long as nothing
-- commits" is not a property to leave resting on a client's autocommit setting,
-- and the four real companies are on the other side of it.
--
-- A freshly migrated and seeded database has zero memberships. One that anyone
-- has ever signed in to has at least one. So the moment this project has real
-- users, this file stops running against it and has to be pointed at staging,
-- which is where it belonged anyway.
do $$
begin
  if exists (select 1 from public.memberships) then
    raise exception 'stage1_rls.test.sql refuses to run here: this database already has memberships, so it is not a fresh or staging one. This file clears companies, memberships and invites inside its transaction. Run it against a staging project instead.';
  end if;
end $$;

-- Start from a known board. The assertions below count rows, so a seeded or
-- live database would make them meaningless — and reusing the real consortium
-- row is not an option either, since only one company may carry is_consortium.
--
-- This is safe because the whole file is ONE TRANSACTION that ends in ROLLBACK:
-- nothing here is committed, and the real rows come back the moment it ends. It
-- does take write locks for the duration, which is why the header says to
-- prefer a staging project.
delete from public.invites;
delete from public.memberships;
delete from public.companies;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@bi.test'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'bob@bi.test'),
  ('cccccccc-0000-0000-0000-000000000001', 'carol@nonmember.test'),
  ('dddddddd-0000-0000-0000-000000000001', 'dave@seed.test'),
  ('eeeeeeee-0000-0000-0000-000000000001', 'erin@bi.test'),
  ('ffffffff-0000-0000-0000-000000000001', 'pat@platform.test'),
  ('99999999-0000-0000-0000-000000000001', 'newhire@bi.test');

do $$ begin
  perform pg_temp.assert(
    (select count(*) from public.user_profiles) >= 7,
    'on_auth_user_created should create one profile row per auth user');
end $$;

update public.user_profiles set is_platform_admin = true
 where id = 'ffffffff-0000-0000-0000-000000000001';

insert into public.companies (id, name, is_seed_member, is_consortium) values
  ('11111111-0000-0000-0000-000000000001', 'Building Integrity',   true,  false),
  ('22222222-0000-0000-0000-000000000001', 'Rare Forms',           true,  false),
  ('33333333-0000-0000-0000-000000000001', 'Nonmember Co',         false, false),
  ('44444444-0000-0000-0000-000000000001', 'The Seed Collaborative', true, true);

insert into public.memberships (user_id, company_id, level) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'admin'),
  ('eeeeeeee-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'admin'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'member'),
  ('cccccccc-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'member'),
  ('dddddddd-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001', 'member');

insert into public.invites (email, company_id, level, token_hash, expires_at, created_by) values
  ('newhire@bi.test',  '11111111-0000-0000-0000-000000000001', 'member', 'hash-good',    now() + interval '7 days', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('newhire@bi.test',  '11111111-0000-0000-0000-000000000001', 'member', 'hash-expired', now() - interval '1 day',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('someoneelse@bi.test', '11111111-0000-0000-0000-000000000001', 'member', 'hash-other', now() + interval '7 days', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('newhire@bi.test',  '22222222-0000-0000-0000-000000000001', 'member', 'hash-second-company', now() + interval '7 days', 'aaaaaaaa-0000-0000-0000-000000000001'),
  -- An admin trying to promote an existing member by re-inviting them. The
  -- redemption must not fall over, and must not silently claim it worked.
  ('newhire@bi.test',  '11111111-0000-0000-0000-000000000001', 'admin',  'hash-promote', now() + interval '7 days', 'aaaaaaaa-0000-0000-0000-000000000001');
-- (the expired one is inserted as owner: the invites_insert policy's
--  `expires_at > now()` check applies to authenticated callers, not the owner.)

-- ---------------------------------------------------------------------------
-- 1. The first membership becomes the default company, without being asked to
--    ("default is your own company").
-- ---------------------------------------------------------------------------
do $$ begin
  perform pg_temp.assert(
    (select is_default from public.memberships
      where user_id = 'bbbbbbbb-0000-0000-0000-000000000001') = true,
    'a first membership should become the default company');
  perform pg_temp.assert(
    (select is_default from public.memberships
      where user_id = 'dddddddd-0000-0000-0000-000000000001') = true,
    'dave''s only membership (Seed) should be his default');
end $$;

-- Fixtures are built. From here on nothing is privileged, and every guard
-- trigger below is being asked the same question it will be asked in
-- production.
set local app.operator = '';

do $$ begin
  perform pg_temp.assert(not public.is_privileged_caller(),
    'the operator opt-in must actually be off before the assertions start');
end $$;

-- ===========================================================================
-- can_act_as — the switcher rule
-- ===========================================================================
set local role authenticated;

-- --- bob: plain member at a member company ---------------------------------
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');

do $$ begin
  perform pg_temp.assert(public.can_act_as('11111111-0000-0000-0000-000000000001'),
    'bob may act as his own company');
  perform pg_temp.assert(public.can_act_as('44444444-0000-0000-0000-000000000001'),
    'bob may act as the Seed Collaborative: membership of a member company is the entitlement');
  perform pg_temp.assert(not public.can_act_as('22222222-0000-0000-0000-000000000001'),
    'bob may NOT act as Rare Forms — the switcher never creates an entitlement');
  perform pg_temp.assert(not public.can_act_as('33333333-0000-0000-0000-000000000001'),
    'bob may NOT act as a company he has no membership in');
  perform pg_temp.assert(not public.can_act_as(null),
    'a null acting-as company is not an entitlement');
  perform pg_temp.assert(public.is_seed_entitled(),
    'bob is seed-entitled through Building Integrity');
end $$;

-- --- carol: member of a company OUTSIDE the consortium ----------------------
-- The false branch of is_seed_member, which has never run in production.
select pg_temp.act_as('cccccccc-0000-0000-0000-000000000001');

do $$ begin
  perform pg_temp.assert(public.can_act_as('33333333-0000-0000-0000-000000000001'),
    'carol may act as her own company');
  perform pg_temp.assert(not public.is_seed_entitled(),
    'carol is not seed-entitled: her only company is not a member');
  perform pg_temp.assert(not public.can_act_as('44444444-0000-0000-0000-000000000001'),
    'carol has NO path to the Seed Collaborative and cannot reach it by asking');
end $$;

-- --- dave: his own company IS the Seed Collaborative ------------------------
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000001');

do $$ begin
  perform pg_temp.assert(public.can_act_as('44444444-0000-0000-0000-000000000001'),
    'a Seed member may act as Seed — as his own company, not as a browse mode');
  perform pg_temp.assert(not public.can_act_as('11111111-0000-0000-0000-000000000001'),
    'a Seed member may not act as Building Integrity');
end $$;

-- --- pat: platform admin ----------------------------------------------------
select pg_temp.act_as('ffffffff-0000-0000-0000-000000000001');

do $$ begin
  perform pg_temp.assert(public.is_platform_admin(), 'pat is platform admin');
  perform pg_temp.assert(public.can_act_as('33333333-0000-0000-0000-000000000001'),
    'platform admin may act as any company (permission matrix, last row)');
end $$;

-- ===========================================================================
-- The privileged-caller escape, and who can call the helpers at all
-- ===========================================================================
-- is_privileged_caller() is the only function in the schema that GRANTS rather
-- than restricts — every guard trigger returns early when it says yes. An
-- earlier version asked only "is auth.uid() null?", which is true of ANY caller
-- arriving without a subject, including an anonymous API request. Nothing could
-- reach a guard trigger that way, because anon holds no table grants — but that
-- is a property of the grants, not of the function. These assert the function.

-- The anon shape: PostgREST served a request, set claims naming the anon role,
-- and there is no subject. This is exactly what the old formulation called
-- privileged.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  perform pg_temp.assert(not public.is_privileged_caller(),
    'a caller with a live request context but no subject is NOT privileged');
end $$;

-- No claims at all, either. Absence of a JWT is not authority for anything.
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform pg_temp.assert(not public.is_privileged_caller(),
    'a caller with no JWT at all is NOT privileged: absence of identity is not authority');
end $$;

-- The opt-in must NOT work from a role PostgREST hands out. Nothing can set
-- the GUC through the API, so this is unreachable rather than load-bearing —
-- but "the escape works while acting as authenticated" is the one combination
-- worth making impossible instead of merely unreachable, and an earlier version
-- of this suite proved the escape in exactly that posture.
set local app.operator = 'on';
do $$ begin
  perform pg_temp.assert(not public.is_privileged_caller(),
    'the operator opt-in is refused outright while acting as an API role');
end $$;
set local app.operator = '';

-- The positive control belongs where an operator actually is: a direct
-- connection, not a PostgREST role. Without it this section would pass just as
-- well if the function always said no, and seed.sql could never run.
reset role;
set local app.operator = 'on';
do $$ begin
  perform pg_temp.assert(public.is_privileged_caller(),
    'an explicit operator opt-in from a direct connection IS privileged, or seed.sql could never run');
end $$;
set local app.operator = '';
do $$ begin
  perform pg_temp.assert(not public.is_privileged_caller(),
    'and turning it off takes it away again');
end $$;

-- A near miss must not count.
set local app.operator = 'ON';
do $$ begin
  perform pg_temp.assert(not public.is_privileged_caller(),
    'the opt-in is an exact value, not a truthiness test');
end $$;
set local app.operator = '';
set local role authenticated;

-- The helpers must not be callable by anon. consortium_company_id() would
-- otherwise hand out the consortium uuid to anyone at all, and
-- is_privileged_caller() is one stray table grant away from mattering.
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.is_privileged_caller()',
    'public.is_platform_admin()',
    'public.can_act_as(uuid)',
    'public.consortium_company_id()',
    'public.is_seed_entitled()',
    'public.shares_company_with(uuid)',
    'public.is_company_admin(uuid)',
    'public.is_member_of(uuid)',
    'public.is_company_admin_anywhere()',
    -- 0004's, which was the one helper left on PostgreSQL's default grant.
    'public.meets_required_aal()',
    -- 0005's, which writes rows its caller could not write directly.
    'public.create_company_with_first_admin(text,text,text,timestamptz)'
  ] loop
    perform pg_temp.assert(
      not has_function_privilege('anon', fn, 'execute'),
      'anon must not be able to call ' || fn);
    perform pg_temp.assert(
      has_function_privilege('authenticated', fn, 'execute'),
      'authenticated must still be able to call ' || fn || ', or every policy using it fails');
  end loop;
end $$;

-- ===========================================================================
-- Reads
-- ===========================================================================
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');

do $$ begin
  perform pg_temp.assert(
    (select count(*) from public.companies) = 2,
    'bob sees exactly his own company and the consortium company, by name');
  perform pg_temp.assert(
    (select count(*) from public.companies where id = '22222222-0000-0000-0000-000000000001') = 0,
    'bob does not see Rare Forms: cross-company reads are Stage 4, not Stage 1');
  perform pg_temp.assert(
    (select count(*) from public.memberships) = 1,
    'bob sees only his own membership row');
  perform pg_temp.assert(
    (select count(*) from public.invites) = 0,
    'a plain member cannot read his company''s invites');
  perform pg_temp.assert(
    (select count(*) from public.user_profiles
      where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 1,
    'bob can see the profile of someone he shares a company with (version attribution)');
  perform pg_temp.assert(
    (select count(*) from public.user_profiles
      where id = 'cccccccc-0000-0000-0000-000000000001') = 0,
    'bob cannot see the profile of someone from an unrelated company');
end $$;

select pg_temp.act_as('cccccccc-0000-0000-0000-000000000001');
do $$ begin
  perform pg_temp.assert(
    (select count(*) from public.companies) = 1,
    'carol sees only her own company — no consortium entry, because she has no path to it');
end $$;

select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
do $$ begin
  perform pg_temp.assert(
    (select count(*) from public.memberships
      where company_id = '11111111-0000-0000-0000-000000000001') = 3,
    'a company admin sees every membership of their own company');
  perform pg_temp.assert(
    (select count(*) from public.invites) = 4,
    'a company admin sees their own company''s invites — four of the five, '
    || 'because the other is for a company she does not administer, even '
    || 'though she is recorded as its creator');
end $$;

-- ===========================================================================
-- Writes that must be refused
-- ===========================================================================
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');

-- A forged "join this company" straight at the table.
do $$
declare ok boolean := false;
begin
  begin
    insert into public.memberships (user_id, company_id, level)
    values ('bbbbbbbb-0000-0000-0000-000000000001',
            '22222222-0000-0000-0000-000000000001', 'admin');
  exception when sqlstate '42501' then ok := true;
  end;
  perform pg_temp.assert(ok, 'a member must not be able to insert his own membership anywhere');
end $$;

-- Self-promotion to company admin.
do $$
declare ok boolean := false;
begin
  begin
    update public.memberships set level = 'admin'
     where user_id = 'bbbbbbbb-0000-0000-0000-000000000001';
  exception when sqlstate '42501' then ok := true;
  end;
  perform pg_temp.assert(ok, 'a member must not be able to promote himself to company admin');
end $$;

-- Self-elevation to platform admin.
do $$
declare ok boolean := false;
begin
  begin
    update public.user_profiles set is_platform_admin = true
     where id = 'bbbbbbbb-0000-0000-0000-000000000001';
  exception when sqlstate '42501' then ok := true;
  end;
  perform pg_temp.assert(ok, 'nobody may make themselves a platform admin');
end $$;

-- Changing the display name IS allowed — the guard is column-specific.
do $$
declare n integer;
begin
  update public.user_profiles set display_name = 'Bob B.'
   where id = 'bbbbbbbb-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 1, 'a user may set their own display name');
end $$;

-- Choosing your own default company IS allowed.
do $$
declare n integer;
begin
  update public.memberships set is_default = true
   where user_id = 'bbbbbbbb-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 1, 'a member may set their own default company');
end $$;

-- Renaming a company you are only a member of: silently zero rows (UPDATE
-- denials are not errors), which is why this asserts on row_count.
do $$
declare n integer;
begin
  update public.companies set name = 'Bob Industries'
   where id = '11111111-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 0, 'a plain member cannot rename their company');
end $$;

-- Deleting a company: platform admin only (decision 13, archive never delete).
do $$
declare n integer;
begin
  delete from public.companies where id = '11111111-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 0, 'nobody below platform admin may delete a company');
end $$;

-- A company admin may rename their company but may NOT put it in or out of the
-- consortium — that flag is a platform-admin judgement call.
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
do $$
declare n integer; ok boolean := false;
begin
  update public.companies set name = 'Building Integrity LLC'
   where id = '11111111-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 1, 'a company admin may rename their own company');

  begin
    update public.companies set is_seed_member = false
     where id = '11111111-0000-0000-0000-000000000001';
  exception when sqlstate '42501' then ok := true;
  end;
  perform pg_temp.assert(ok, 'a company admin may not change is_seed_member');
end $$;

-- The theme column is writable by a company admin and is otherwise inert.
do $$
declare n integer;
begin
  update public.companies set theme = '{"accent":"#B7D732"}'::jsonb
   where id = '11111111-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 1, 'a company admin may set their company theme');
end $$;

-- ===========================================================================
-- Moving a membership between companies — the privilege escalation
-- ===========================================================================
-- alice is an admin at Building Integrity and nothing else. Every attempt below
-- is her trying to become something at a company she has no membership in, by
-- rewriting her own row rather than by being invited. All of them must fail.
--
-- These exist because they did NOT fail. The guard used to return early for
-- company admins and skip every column check, so one PATCH against PostgREST
-- moved her into any company she could name, at level 'admin'. It was not even
-- a guessing game: the consortium's uuid is readable by every seed-entitled
-- user by design. This section is the regression test for that.
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');

do $$
declare ok boolean := false;
begin
  begin
    update public.memberships
       set company_id = '22222222-0000-0000-0000-000000000001'
     where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  exception when sqlstate '42501' then ok := true;
  end;
  perform pg_temp.assert(ok,
    'ATTACK: a company admin must not be able to move their own membership to another company');
end $$;

do $$
declare ok boolean := false;
begin
  begin
    update public.memberships
       set company_id = '44444444-0000-0000-0000-000000000001'
     where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  exception when sqlstate '42501' then ok := true;
  end;
  perform pg_temp.assert(ok,
    'ATTACK: and least of all into The Seed Collaborative, whose id she can already read');
end $$;

do $$
declare ok boolean := false;
begin
  begin
    update public.memberships
       set company_id = '22222222-0000-0000-0000-000000000001', level = 'admin'
     where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  exception when sqlstate '42501' then ok := true;
  end;
  perform pg_temp.assert(ok, 'ATTACK: not while setting the level in the same statement either');
end $$;

do $$
declare ok boolean := false;
begin
  begin
    update public.memberships
       set user_id = 'cccccccc-0000-0000-0000-000000000001'
     where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  exception when sqlstate '42501' then ok := true;
  end;
  perform pg_temp.assert(ok, 'ATTACK: a membership cannot be handed to another person');
end $$;

do $$ begin
  perform pg_temp.assert(
    (select count(*) from public.memberships
      where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
        and company_id = '11111111-0000-0000-0000-000000000001') = 1,
    'after all of that, alice is still exactly where she started');
  perform pg_temp.assert(not public.can_act_as('22222222-0000-0000-0000-000000000001'),
    'and has gained no entitlement anywhere');
  perform pg_temp.assert(not public.is_company_admin('44444444-0000-0000-0000-000000000001'),
    'and is not an admin of the consortium');
end $$;

-- A plain member cannot do it either: the immutability is not admin-specific.
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');
do $$
declare ok boolean := false;
begin
  begin
    update public.memberships
       set company_id = '22222222-0000-0000-0000-000000000001'
     where user_id = 'bbbbbbbb-0000-0000-0000-000000000001';
  exception when sqlstate '42501' then ok := true;
  end;
  perform pg_temp.assert(ok, 'ATTACK: nor can a plain member move their own membership');
end $$;

-- What a company admin CAN still do: set levels inside their own company. The
-- fix must not have cost this.
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
do $$
declare n integer;
begin
  update public.memberships set level = 'admin'
   where user_id = 'bbbbbbbb-0000-0000-0000-000000000001'
     and company_id = '11111111-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 1, 'a company admin may still promote someone in their own company');

  update public.memberships set level = 'member'
   where user_id = 'bbbbbbbb-0000-0000-0000-000000000001'
     and company_id = '11111111-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 1, 'and demote them again');
end $$;

-- ===========================================================================
-- Creating a company (decision 27)
-- ===========================================================================
-- The creator gets NO standing access at any point — not even briefly. So the
-- company and its first-admin invite are written by one definer function, which
-- checks decision 27's own condition itself, because no policy phrased in terms
-- of "an admin of this company" could authorize the first invite to a company
-- nobody administers yet.

-- Direct insert is refused for everyone below platform admin, admin or not:
-- companies_insert admits them, but they can never read the row back, and more
-- to the point they could never invite anyone to it.
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');
do $$
declare ok boolean := false;
begin
  begin
    perform public.create_company_with_first_admin(
      'Bob Co', 'someone@bob.test', 'hash-bobco', now() + interval '7 days');
  exception when sqlstate '42501' then ok := true;
  end;
  perform pg_temp.assert(ok, 'a plain member cannot create a company');
end $$;

-- THE FRONT DOOR. Nothing about the shape of this function stops a founder
-- putting their own address in and redeeming the link they are handed back,
-- which would make "creating is not joining" false one click after it was true.
-- The suite used to test only the harder path — minting a second invite
-- afterwards — and this is the one that was actually open.
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
do $$
declare ok boolean := false;
begin
  begin
    perform public.create_company_with_first_admin(
      'Alice Co', 'alice@bi.test', 'hash-selfinvite', now() + interval '7 days');
  exception when sqlstate '42501' then ok := true;
  end;
  perform pg_temp.assert(ok,
    'a founder cannot address the first-admin invite to themselves');
end $$;

-- Case must not get you past it either.
do $$
declare ok boolean := false;
begin
  begin
    perform public.create_company_with_first_admin(
      'Alice Co', '  ALICE@BI.TEST  ', 'hash-selfinvite2', now() + interval '7 days');
  exception when sqlstate '42501' then ok := true;
  end;
  perform pg_temp.assert(ok, 'nor by changing the case or padding it with spaces');
end $$;

reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform pg_temp.assert(
    (select count(*) from public.companies where name = 'Alice Co') = 0,
    'and the refused attempt left no company behind');
end $$;
set local role authenticated;

select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
do $$
declare v_invite uuid;
begin
  v_invite := public.create_company_with_first_admin(
    'Founded Co', 'FirstAdmin@Founded.test', 'hash-founding', now() + interval '7 days');
  perform pg_temp.assert(v_invite is not null, 'a company admin can create a company');
end $$;

-- Everything about the new company is now checked from OUTSIDE alice's session,
-- because the whole claim is that she cannot see any of it.
reset role;
select set_config('request.jwt.claims', '', true);
do $$
declare v_id uuid;
begin
  select id into v_id from public.companies where name = 'Founded Co';
  perform pg_temp.assert(v_id is not null, 'the company exists');
  perform pg_temp.assert(
    (select created_by from public.companies where id = v_id)
      = 'aaaaaaaa-0000-0000-0000-000000000001',
    'and records who founded it');
  perform pg_temp.assert(
    (select count(*) from public.memberships where company_id = v_id) = 0,
    'creating is not joining: nobody is a member of it yet, the creator included');
  perform pg_temp.assert(
    (select is_seed_member from public.companies where id = v_id) = false,
    'a new company is not in the co-operative until someone decides it is');
  perform pg_temp.assert(
    (select count(*) from public.invites
      where company_id = v_id and level = 'admin'
        and email = 'firstadmin@founded.test') = 1,
    'and its first admin has been invited, at admin level, with the address normalised');
end $$;

set local role authenticated;
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
do $$ begin
  perform pg_temp.assert(
    (select count(*) from public.companies c where c.name = 'Founded Co') = 0,
    'the creator cannot see the company they just created — no standing access means none, not none-after-a-while');
  perform pg_temp.assert(
    (select count(*) from public.invites i where i.token_hash = 'hash-founding') = 0,
    'nor the invite they just caused to be written');
  perform pg_temp.assert(
    not public.can_act_as((select c.id from public.companies c where c.created_by = 'aaaaaaaa-0000-0000-0000-000000000001' limit 1)),
    'and gains no entitlement to act as it');
end $$;

-- Nor can she reach it the long way round: minting a second invite to a company
-- she does not administer. This is the hole a temporary founding window had to
-- be careful about and this design cannot have.
-- Two ways this can be refused and both are acceptable: companies_select hides
-- the company, so the SELECT feeding the insert finds nothing and no row is
-- written; or the row is built some other way and invites_insert rejects it.
-- What must not happen is an invite existing, which is asserted below from a
-- session that can actually see the invites table.
do $$
begin
  begin
    insert into public.invites (email, company_id, level, token_hash, expires_at, created_by)
    select 'alice@bi.test', c.id, 'admin', 'hash-backdoor',
           now() + interval '7 days', 'aaaaaaaa-0000-0000-0000-000000000001'
      from public.companies c where c.name = 'Founded Co';
  exception when sqlstate '42501' then null;
  end;
end $$;

reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform pg_temp.assert(
    (select count(*) from public.invites where token_hash = 'hash-backdoor') = 0,
    'the founder cannot invite themselves into the company afterwards');
end $$;

-- Put the board back. Founded Co has served its purpose and every row count
-- from here on assumes the original four companies.
set local app.operator = 'on';
delete from public.companies where name = 'Founded Co';
set local app.operator = '';
set local role authenticated;
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');

-- ===========================================================================
-- Last-admin guard
-- ===========================================================================
-- With erin also an admin, alice can step down.
do $$
declare n integer;
begin
  delete from public.memberships
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
     and company_id = '11111111-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 1, 'an admin may leave while another admin remains');
end $$;

-- Erin is now the only admin and must not be able to leave.
select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000001');
do $$
declare ok boolean := false;
begin
  begin
    delete from public.memberships
     where user_id = 'eeeeeeee-0000-0000-0000-000000000001'
       and company_id = '11111111-0000-0000-0000-000000000001';
  exception when sqlstate '23514' then ok := true;
  end;
  perform pg_temp.assert(ok, 'the last admin of a company may not remove themselves');
end $$;

do $$
declare ok boolean := false;
begin
  begin
    update public.memberships set level = 'member'
     where user_id = 'eeeeeeee-0000-0000-0000-000000000001'
       and company_id = '11111111-0000-0000-0000-000000000001';
  exception when sqlstate '23514' then ok := true;
  end;
  perform pg_temp.assert(ok, 'the last admin of a company may not demote themselves either');
end $$;

-- ===========================================================================
-- Invites
-- ===========================================================================
select pg_temp.act_as('99999999-0000-0000-0000-000000000001');

do $$
declare r record;
begin
  select * into r from public.invite_preview('hash-good');
  perform pg_temp.assert(r.valid, 'a fresh invite previews as valid');
  perform pg_temp.assert(r.email = 'newhire@bi.test', 'preview reports the invited email');

  select * into r from public.invite_preview('hash-expired');
  perform pg_temp.assert(not r.valid and r.reason = 'expired', 'an expired invite previews as expired');

  select * into r from public.invite_preview('no-such-hash');
  perform pg_temp.assert(not r.valid and r.reason = 'not_found', 'an unknown token previews as not found');
end $$;

-- An invite addressed to someone else is not transferable.
do $$
declare ok boolean := false;
begin
  begin
    perform public.redeem_invite('hash-other');
  exception when sqlstate '42501' then ok := true;
  end;
  perform pg_temp.assert(ok, 'an invite issued to another email may not be redeemed');
end $$;

do $$
declare ok boolean := false;
begin
  begin
    perform public.redeem_invite('hash-expired');
  exception when sqlstate '22023' then ok := true;
  end;
  perform pg_temp.assert(ok, 'an expired invite may not be redeemed');
end $$;

-- Happy path.
do $$
declare r record;
begin
  select * into r from public.redeem_invite('hash-good');
  perform pg_temp.assert(r.company_id = '11111111-0000-0000-0000-000000000001',
    'redeeming puts the new member in the inviting company');
end $$;

do $$ begin
  perform pg_temp.assert(
    (select count(*) from public.memberships
      where user_id = '99999999-0000-0000-0000-000000000001') = 1,
    'redeeming creates exactly one membership');
  perform pg_temp.assert(
    (select is_default from public.memberships
      where user_id = '99999999-0000-0000-0000-000000000001') = true,
    'a first membership arrives as the default company');
end $$;

-- Reuse.
do $$
declare ok boolean := false;
begin
  begin
    perform public.redeem_invite('hash-good');
  exception when sqlstate '22023' then ok := true;
  end;
  perform pg_temp.assert(ok, 'an invite may not be redeemed twice');
end $$;

-- Second company for an existing account: the multi-membership case, and the
-- new membership must NOT steal the default.
do $$
declare r record;
begin
  select * into r from public.redeem_invite('hash-second-company');
  perform pg_temp.assert(r.company_id = '22222222-0000-0000-0000-000000000001',
    'an existing account can join a second company by invite');
end $$;

do $$ begin
  perform pg_temp.assert(
    (select count(*) from public.memberships
      where user_id = '99999999-0000-0000-0000-000000000001') = 2,
    'one login, two memberships');
  perform pg_temp.assert(
    (select company_id from public.memberships
      where user_id = '99999999-0000-0000-0000-000000000001' and is_default)
      = '11111111-0000-0000-0000-000000000001',
    'joining a second company does not move the default company');
end $$;

-- Re-inviting someone who is already a member, at a higher level.
--
-- This used to raise: the redemption did `on conflict do update set level`,
-- which fired guard_membership_self_update, which correctly refused a level
-- change from someone who was not yet an admin there. It failed closed, but it
-- failed — and it consumed nothing, so the admin saw an error on a flow the
-- code plainly meant to support. It now succeeds and reports the level that is
-- actually in force, which is the unchanged one. A visible gap, not a
-- confident wrong answer.
do $$
declare r record;
begin
  select * into r from public.redeem_invite('hash-promote');
  perform pg_temp.assert(r.company_id = '11111111-0000-0000-0000-000000000001',
    're-inviting an existing member does not fail');
  perform pg_temp.assert(r.level = 'member',
    'and reports the level actually in force, not the one the invite asked for');
end $$;

do $$ begin
  perform pg_temp.assert(
    (select m.level from public.memberships m
      where m.user_id = '99999999-0000-0000-0000-000000000001'
        and m.company_id = '11111111-0000-0000-0000-000000000001') = 'member',
    'redeeming an invite is not a promotion mechanism: the level is unchanged');
end $$;

-- Whether the invite was consumed has to be read by someone who can read
-- invites at all. newhire is a plain member and correctly cannot; erin is the
-- remaining Building Integrity admin.
select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000001');
do $$ begin
  perform pg_temp.assert(
    (select i.accepted_at is not null from public.invites i where i.token_hash = 'hash-promote'),
    'and the invite is consumed rather than left dangling');
end $$;

-- A member cannot issue invites.
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');
do $$
declare ok boolean := false;
begin
  begin
    insert into public.invites (email, company_id, level, token_hash, expires_at, created_by)
    values ('friend@bi.test', '11111111-0000-0000-0000-000000000001', 'admin',
            'hash-from-a-member', now() + interval '7 days',
            'bbbbbbbb-0000-0000-0000-000000000001');
  exception when sqlstate '42501' then ok := true;
  end;
  perform pg_temp.assert(ok, 'only a company admin may issue invites');
end $$;

-- ===========================================================================
-- Two-factor: optional for everyone, and real once you opt in (0004)
-- ===========================================================================
-- carol has no factor enrolled. She is at aal1, like every account by default,
-- and nothing asks her for anything. This is the branch that must keep working.
select pg_temp.act_as('cccccccc-0000-0000-0000-000000000001', 'aal1');
do $$ begin
  perform pg_temp.assert((select count(*) from public.companies) = 1,
    'an account with no second factor is never asked for one');
end $$;

-- Columns spelled out because the hosted auth.mfa_factors has factor_type and
-- both timestamps NOT NULL. Writing the insert to the shim's defaults instead
-- would make this file quietly unrunnable anywhere but locally.
reset role;
set local app.operator = 'on';
insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
values (gen_random_uuid(), 'bbbbbbbb-0000-0000-0000-000000000001', 'totp', 'verified', now(), now());
set local app.operator = '';
set local role authenticated;

-- bob has now turned 2FA on. A session holding only his password is not enough.
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001', 'aal1');
do $$ begin
  perform pg_temp.assert((select count(*) from public.companies) = 0,
    'once a factor is enrolled, a password-only session reads nothing');
  perform pg_temp.assert((select count(*) from public.memberships) = 0,
    'and cannot see its own memberships either');
end $$;

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001', 'aal2');
do $$ begin
  perform pg_temp.assert((select count(*) from public.companies) = 2,
    'presenting the second factor restores exactly what he had before');
end $$;

-- An unverified (half-enrolled) factor must not lock anyone out of their own
-- account — that would turn an abandoned enrolment into a lockout.
reset role;
set local app.operator = 'on';
delete from auth.mfa_factors where user_id = 'bbbbbbbb-0000-0000-0000-000000000001';
insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
values (gen_random_uuid(), 'bbbbbbbb-0000-0000-0000-000000000001', 'totp', 'unverified', now(), now());
set local app.operator = '';
set local role authenticated;
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001', 'aal1');
do $$ begin
  perform pg_temp.assert((select count(*) from public.companies) = 2,
    'an unverified factor is not two-factor and must not lock the account');
end $$;

reset role;
set local app.operator = 'on';
delete from auth.mfa_factors where user_id = 'bbbbbbbb-0000-0000-0000-000000000001';
set local app.operator = '';
set local role authenticated;

do $$ begin
  perform pg_temp.assert(not public.is_privileged_caller(),
    'the operator opt-in is off again after the fixture writes — nothing below it is privileged');
end $$;

-- ===========================================================================
-- Revocation takes effect on the next request
-- ===========================================================================
reset role;
set local app.operator = 'on';
delete from public.memberships
 where user_id = 'bbbbbbbb-0000-0000-0000-000000000001'
   and company_id = '11111111-0000-0000-0000-000000000001';
set local app.operator = '';
set local role authenticated;
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');

do $$ begin
  perform pg_temp.assert(not public.can_act_as('11111111-0000-0000-0000-000000000001'),
    'a revoked member can no longer act as that company');
  perform pg_temp.assert(not public.can_act_as('44444444-0000-0000-0000-000000000001'),
    'and loses the Seed entitlement that membership gave him');
  perform pg_temp.assert((select count(*) from public.companies) = 0,
    'a revoked member sees nothing');
end $$;

reset role;

do $$ begin
  raise notice 'stage1_rls: ALL ASSERTIONS PASSED';
end $$;

rollback;
