-- Stage 5 RLS verification — PERMANENT DELETE of a whole project.
--
-- Ends with "stage5_rls: ALL ASSERTIONS PASSED" or aborts on the first failure.
--
-- LOCAL OR STAGING ONLY. NEVER THE LIVE PROJECT. There is a guard below that
-- refuses to run on any database with memberships, projects, grants or access
-- requests in it; live has all four. This suite DESTROYS ROWS ON PURPOSE —
-- running it anywhere real would be exactly the accident it is about. It ends
-- in ROLLBACK, like every other suite here, but do not rely on that.
--
-- HOW TO RUN (see supabase/README.md, "Stage 5 → Verifying locally"):
--   local_shim.sql, then 0001–0010, then stage1_rls.test.sql,
--   stage2_rls.test.sql, stage2_concurrency.test.sh, stage3_rls.test.sql,
--   stage3_concurrency.test.sh, stage4_rls.test.sql (all must still pass),
--   then this file.
--
-- ⚠ IT ADDS NO MIGRATION AND DEPENDS ON NONE. Everything it drives was
-- enforced by 0006 in Stage 2. This suite exists because the Stage 5 UI now
-- calls it on purpose, and because 0006's own suite could only ever check the
-- one cascade that existed then — `project_versions`. Grants (0008) and access
-- requests (0009) arrived later, and nothing has ever checked that a project
-- delete takes them with it, or that it does not leave them behind pointing at
-- a project that is gone.
--
-- EVERY ASSERTION RUNS AS AN ORDINARY MEMBER, WITHOUT THE OPERATOR OPT-IN,
-- unless it is about the platform admin. The people are Stage 4's: Building
-- Integrity (bob, an ordinary member; alice, its admin), Rare Forms (frank),
-- The Seed Collaborative (dave), New Frameworks (nick), pat the platform
-- admin, and henry with no membership at all.
--
-- NO ASSERTION IS SWALLOWED. pg_temp.assert raises P0001. Two helpers catch
-- exceptions — pg_temp.sqlstate_of and pg_temp.try_delete — and both wrap only
-- the statement under test. try_delete reports a raise as -1, which no
-- assertion accepts, so "it errored instead of being silently refused" fails
-- by name rather than passing as a zero.

begin;

set local app.operator = 'on';

create or replace function pg_temp.assert(cond boolean, msg text)
returns void language plpgsql as $$
begin
  if cond is not true then
    raise exception 'FAIL: %', msg;
  end if;
end;
$$;

create or replace function pg_temp.u(p_name text)
returns uuid language sql immutable as $$
  select (case p_name
    when 'alice' then 'aaaaaaaa-0000-0000-0000-000000000001'
    when 'bob'   then 'bbbbbbbb-0000-0000-0000-000000000001'
    when 'dave'  then 'dddddddd-0000-0000-0000-000000000001'
    when 'pat'   then 'ffffffff-0000-0000-0000-000000000001'
    when 'frank' then 'f1f1f1f1-0000-0000-0000-000000000001'
    when 'nick'  then 'f4f4f4f4-0000-0000-0000-000000000001'
    when 'henry' then 'f5f5f5f5-0000-0000-0000-000000000001'
  end)::uuid;
$$;

create or replace function pg_temp.co(p_name text)
returns uuid language sql immutable as $$
  select (case p_name
    when 'BI'   then '11111111-0000-0000-0000-000000000001'
    when 'RF'   then '22222222-0000-0000-0000-000000000001'
    when 'SEED' then '44444444-0000-0000-0000-000000000001'
    when 'NF'   then '55555555-0000-0000-0000-000000000001'
  end)::uuid;
$$;

create or replace function pg_temp.act_as(p_name text, p_aal text default 'aal1')
returns void language plpgsql as $$
begin
  if pg_temp.u(p_name) is null then
    raise exception 'test bug: unknown person %', p_name;
  end if;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', pg_temp.u(p_name), 'role', 'authenticated', 'aal', p_aal)::text,
    true);
end;
$$;

create or replace function pg_temp.put(k text, v uuid)
returns void language sql as $$
  select set_config('stage5test.' || k, v::text, true);
$$;

create or replace function pg_temp.get(k text)
returns uuid language plpgsql as $$
declare v text := nullif(current_setting('stage5test.' || k, true), '');
begin
  if v is null then
    raise exception 'test bug: nothing stored under %', k;
  end if;
  return v::uuid;
end;
$$;

create or replace function pg_temp.doc(p_name text)
returns jsonb language sql as $$
  select jsonb_build_object(
    'schemaVersion', 24,
    'savedAt', '2026-09-25T12:00:00.000Z',
    'state', jsonb_build_object('projectName', p_name, 'role', 'public', 'zipCode', '97201',
                                'wallHeightFt', 9, 'priceModifier', 1.3777));
$$;

-- The SQLSTATE a statement raised, or null if it did not.
create or replace function pg_temp.sqlstate_of(p_sql text)
returns text language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlstate;
end;
$$;

-- Counts past RLS, as the test's owner: what is REALLY still there, whatever
-- the caller under test can see. A delete that "worked" only because the
-- caller could no longer read the row would satisfy an RLS-visible count and
-- fail these.
create or replace function pg_temp.really_projects(p uuid)
returns bigint language sql security definer as $$
  select count(*) from public.projects where id = p;
$$;

create or replace function pg_temp.really_versions(p uuid)
returns bigint language sql security definer as $$
  select count(*) from public.project_versions where project_id = p;
$$;

create or replace function pg_temp.really_grants(p uuid)
returns bigint language sql security definer as $$
  select count(*) from public.collaborators where project_id = p;
$$;

create or replace function pg_temp.really_requests(p uuid)
returns bigint language sql security definer as $$
  select count(*) from public.collab_requests where project_id = p;
$$;

-- Everything a project delete should take with it, as one number.
create or replace function pg_temp.really_everything(p uuid)
returns bigint language sql security definer as $$
  select pg_temp.really_projects(p) + pg_temp.really_versions(p)
       + pg_temp.really_grants(p) + pg_temp.really_requests(p);
$$;

create or replace function pg_temp.really_users()
returns bigint language sql security definer as $$ select count(*) from auth.users; $$;

create or replace function pg_temp.really_companies()
returns bigint language sql security definer as $$ select count(*) from public.companies; $$;

create or replace function pg_temp.really_memberships()
returns bigint language sql security definer as $$ select count(*) from public.memberships; $$;

create or replace function pg_temp.really_all_projects()
returns bigint language sql security definer as $$ select count(*) from public.projects; $$;

-- Try to delete a project as whoever is acting, and report the affected rows.
--
-- An RLS-denied DELETE IS SILENT — zero rows, no error — and the route's
-- "zero rows is a refusal" mapping rests on exactly that. A raise is reported
-- as -1 so that "it errored" can never be mistaken here for "it was refused".
create or replace function pg_temp.try_delete(p uuid)
returns integer language plpgsql as $$
declare n integer;
begin
  delete from public.projects where id = p;
  get diagnostics n = row_count;
  return n;
exception when others then
  return -1;
end;
$$;

-- REFUSE TO RUN ON A DATABASE THAT HAS PEOPLE, PROJECTS, GRANTS OR REQUESTS.
do $$
begin
  if exists (select 1 from public.memberships) then
    raise exception 'stage5_rls.test.sql refuses to run here: this database already has memberships, so it is not a fresh or staging one. THIS SUITE DELETES PROJECTS. Never run supabase/tests/ against the live project.';
  end if;
  if exists (select 1 from public.projects) then
    raise exception 'stage5_rls.test.sql refuses to run here: this database already has projects. THIS SUITE DELETES PROJECTS. Never run supabase/tests/ against the live project.';
  end if;
  if exists (select 1 from public.collaborators) then
    raise exception 'stage5_rls.test.sql refuses to run here: this database already has collaborator grants. Never run supabase/tests/ against the live project.';
  end if;
  if exists (select 1 from public.collab_requests) then
    raise exception 'stage5_rls.test.sql refuses to run here: this database already has access requests. Never run supabase/tests/ against the live project.';
  end if;
end $$;

-- ===========================================================================
-- 0. THE DEFINITIONS THE STAGE 5 UI RESTS ON.
--
-- These run FIRST, so that loosening any of them fails here by name rather
-- than showing up three sections later as "somebody unexpected could delete a
-- project". The spec's claim is that permanent delete is "enforced now at the
-- database level (platform admin, whole project only)". This is that sentence,
-- checked rather than believed.
-- ===========================================================================
do $$
declare q text; c text; r text; d text;
begin
  select regexp_replace(replace(coalesce(qual, ''), 'public.', ''), '\s+', '', 'g'),
         cmd, array_to_string(roles, ','), coalesce(with_check, '')
    into q, c, r, d
    from pg_policies
   where schemaname = 'public' and tablename = 'projects' and policyname = 'projects_delete';
  perform pg_temp.assert(q = 'is_platform_admin()',
    'projects_delete is exactly is_platform_admin(), and nothing else (got ' || coalesce(q, '<no such policy>') || ')');
  perform pg_temp.assert(c = 'DELETE', 'projects_delete is a DELETE policy (got ' || coalesce(c, 'null') || ')');
  perform pg_temp.assert(r = 'authenticated',
    'projects_delete is granted to `authenticated` alone (got ' || coalesce(r, 'null') || ')');
  perform pg_temp.assert(d = '', 'projects_delete has no with-check, as a delete policy should not');

  select regexp_replace(replace(coalesce(qual, ''), 'public.', ''), '\s+', '', 'g')
    into q
    from pg_policies
   where schemaname = 'public' and tablename = 'project_versions' and policyname = 'project_versions_delete';
  perform pg_temp.assert(q = 'is_platform_admin()',
    'project_versions_delete is exactly is_platform_admin() too — the TRIGGER, not the policy, is what narrows it to the cascade (got '
      || coalesce(q, '<no such policy>') || ')');

  -- The trigger that makes "whole project only" true. Stage 5 must not have
  -- softened the depth test into something a client could reach.
  perform pg_temp.assert(
    regexp_replace(pg_get_functiondef('public.refuse_project_version_change()'::regprocedure), '\s+', ' ', 'g')
      like '%is_privileged_caller() and pg_trigger_depth() > 1%',
    'refuse_project_version_change still admits a version delete ONLY as a privileged caller''s cascade');

  perform pg_temp.assert(
    (select array_agg(policyname::text order by policyname) from pg_policies
      where schemaname = 'public' and tablename = 'projects')
      = array['projects_delete', 'projects_insert', 'projects_require_aal', 'projects_select', 'projects_update'],
    'projects still has exactly five policies, by name: Stage 5 added none');
end $$;

-- The grants under the policies. A missing DELETE grant would make the policy
-- unreachable; a TRUNCATE grant would make it irrelevant; a service_role grant
-- would make it bypassable by any route that reached for the admin client.
do $$
begin
  perform pg_temp.assert(has_table_privilege('authenticated', 'public.projects', 'delete'),
    'authenticated holds DELETE on projects, so projects_delete is the thing deciding');
  perform pg_temp.assert(not has_table_privilege('authenticated', 'public.projects', 'truncate'),
    'authenticated holds NO TRUNCATE on projects: RLS cannot be stepped around');
  perform pg_temp.assert(not has_table_privilege('authenticated', 'public.project_versions', 'truncate'),
    'nor on project_versions');
  perform pg_temp.assert(not has_table_privilege('authenticated', 'public.project_versions', 'update'),
    'and no UPDATE on project_versions at all: append-only is a grant as well as a trigger');
  perform pg_temp.assert(not has_table_privilege('service_role', 'public.projects', 'delete'),
    'service_role holds NOTHING on projects: an admin client could not delete a project even if a route reached for one');
  perform pg_temp.assert(not has_table_privilege('anon', 'public.projects', 'delete'),
    'and neither can anon');
end $$;

-- ===========================================================================
-- Fixtures (as the owner, which bypasses RLS)
-- ===========================================================================
delete from public.invites;
delete from public.memberships;
delete from public.companies;

insert into auth.users (id, email) values
  (pg_temp.u('alice'), 'alice@bi.test'),
  (pg_temp.u('bob'),   'bob@bi.test'),
  (pg_temp.u('dave'),  'dave@seed.test'),
  (pg_temp.u('pat'),   'pat@platform.test'),
  (pg_temp.u('frank'), 'frank@rareforms.test'),
  (pg_temp.u('nick'),  'nick@newframeworks.test'),
  (pg_temp.u('henry'), 'henry@nowhere.test');

update public.user_profiles set is_platform_admin = true where id = pg_temp.u('pat');
update public.user_profiles set display_name = 'Bob Builder'  where id = pg_temp.u('bob');
update public.user_profiles set display_name = 'Alice Admin'  where id = pg_temp.u('alice');
update public.user_profiles set display_name = 'Frank Framer' where id = pg_temp.u('frank');
update public.user_profiles set display_name = 'Nick New'     where id = pg_temp.u('nick');
update public.user_profiles set display_name = 'Pat Platform' where id = pg_temp.u('pat');

insert into public.companies (id, name, is_seed_member, is_consortium) values
  (pg_temp.co('BI'),   'Building Integrity',     true,  false),
  (pg_temp.co('RF'),   'Rare Forms',             true,  false),
  (pg_temp.co('SEED'), 'The Seed Collaborative', true,  true),
  (pg_temp.co('NF'),   'New Frameworks',         true,  false);

insert into public.memberships (user_id, company_id, level, created_at) values
  (pg_temp.u('alice'), pg_temp.co('BI'),   'admin',  now() - interval '30 days'),
  (pg_temp.u('bob'),   pg_temp.co('BI'),   'member', now() - interval '30 days'),
  (pg_temp.u('dave'),  pg_temp.co('SEED'), 'member', now() - interval '30 days'),
  (pg_temp.u('frank'), pg_temp.co('RF'),   'member', now() - interval '30 days'),
  (pg_temp.u('nick'),  pg_temp.co('NF'),   'member', now() - interval '30 days');

set local app.operator = '';
do $$ begin
  perform pg_temp.assert(not public.is_privileged_caller(),
    'the operator opt-in must be off before the assertions start');
end $$;

set local role authenticated;

-- p1: Building Integrity's, three versions deep, shared two ways, with one
-- access request on it. p2: another BI project, for the two-factor section.
-- p3: a third, reserved for the unprivileged-cascade section at the end.
-- rf1: Rare Forms', so the cross-company delete has something to reach.
select pg_temp.act_as('bob');
do $$
declare r record; s record;
begin
  select * into r from public.create_project(pg_temp.co('BI'), 'current', pg_temp.doc('Smith House'), null);
  perform pg_temp.put('p1', r.project_id); perform pg_temp.put('p1_v1', r.version_id);
  select * into s from public.save_project_version(r.project_id, r.version_id, pg_temp.doc('Smith House'), 'second save');
  perform pg_temp.put('p1_v2', s.version_id);
  select * into s from public.save_project_version(r.project_id, s.version_id, pg_temp.doc('Smith House'), 'third save');
  perform pg_temp.put('p1_v3', s.version_id);

  select * into r from public.create_project(pg_temp.co('BI'), 'past', pg_temp.doc('Jones Bid'), null);
  perform pg_temp.put('p2', r.project_id); perform pg_temp.put('p2_v1', r.version_id);

  select * into r from public.create_project(pg_temp.co('BI'), 'current', pg_temp.doc('Bare House'), null);
  perform pg_temp.put('p3', r.project_id); perform pg_temp.put('p3_v1', r.version_id);

  -- Two grants on p1, written by the Stage 3 functions and by nothing else:
  -- one to a person at another company, one to that whole company.
  select * into s from public.share_project_with_person(pg_temp.get('p1'), 'frank@rareforms.test');
  select * into s from public.share_project_with_company(pg_temp.get('p1'), pg_temp.co('RF'));
end $$;

select pg_temp.act_as('frank');
do $$
declare r record;
begin
  select * into r from public.create_project(pg_temp.co('RF'), 'current', pg_temp.doc('Rare House'), null);
  perform pg_temp.put('rf1', r.project_id); perform pg_temp.put('rf1_v1', r.version_id);
end $$;

-- An access request on p1, written as the owner. How a request COMES to exist
-- is Stage 4's business and is tested there; it is here only so that a delete
-- has one of each of the three cascades to take.
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.collab_requests (project_id, requested_by, requested_by_name, message)
values (pg_temp.get('p1'), pg_temp.u('nick'), 'Nick New', 'May I see this one?');

do $$ begin
  perform pg_temp.assert(pg_temp.really_projects(pg_temp.get('p1')) = 1, 'fixture sanity: p1 exists');
  perform pg_temp.assert(pg_temp.really_versions(pg_temp.get('p1')) = 3, 'fixture sanity: p1 has three versions');
  perform pg_temp.assert(pg_temp.really_grants(pg_temp.get('p1')) = 2, 'fixture sanity: p1 has two grants');
  perform pg_temp.assert(pg_temp.really_requests(pg_temp.get('p1')) = 1, 'fixture sanity: p1 has one access request');
  perform pg_temp.assert(pg_temp.really_all_projects() = 4, 'fixture sanity: four projects');
end $$;
set local role authenticated;

-- ===========================================================================
-- 1. NOBODY BUT A PLATFORM ADMIN. Seven callers, none of whom may delete.
--
-- Each is checked twice: the DELETE affects ZERO ROWS (silently — the route
-- reads that as its refusal), and NOTHING ACTUALLY WENT, counted past RLS.
-- The second half is the one that matters: a caller who could no longer read
-- the row would also "affect zero rows".
-- ===========================================================================

-- bob: an ordinary member of the OWNER company. Archive, never delete (13).
select pg_temp.act_as('bob');
do $$
declare n integer;
begin
  n := pg_temp.try_delete(pg_temp.get('p1'));
  perform pg_temp.assert(n = 0,
    'bob, an ordinary member of the owner company, deletes 0 rows — silently, not with an error (got ' || n || ')');
  perform pg_temp.assert(pg_temp.really_everything(pg_temp.get('p1')) = 7,
    'and p1, its three versions, its two grants and its request are all still there');
end $$;

-- alice: a COMPANY ADMIN at the owner company. Admin of a company is not
-- admin of the platform, and this is the row that says so.
select pg_temp.act_as('alice');
do $$
declare n integer;
begin
  n := pg_temp.try_delete(pg_temp.get('p1'));
  perform pg_temp.assert(n = 0,
    'alice, a COMPANY ADMIN of the owner company, deletes 0 rows (got ' || n || ')');
  perform pg_temp.assert(pg_temp.really_everything(pg_temp.get('p1')) = 7, 'and nothing of p1 went');
end $$;

-- frank: a member of ANOTHER company — who also holds two grants on p1, so
-- this is a collaborator with real access, not a stranger. Answer 14: a
-- collaborator can never delete the project.
select pg_temp.act_as('frank');
do $$
declare n integer;
begin
  perform pg_temp.assert((select count(*) from public.projects where id = pg_temp.get('p1')) = 1,
    'premise: frank really can READ p1 through his grants — so the refusal below is about deleting, not about reach');
  n := pg_temp.try_delete(pg_temp.get('p1'));
  perform pg_temp.assert(n = 0,
    'frank, a member of another company holding two grants on it, deletes 0 rows (got ' || n || ')');
  perform pg_temp.assert(pg_temp.really_everything(pg_temp.get('p1')) = 7, 'and nothing of p1 went');
  n := pg_temp.try_delete(pg_temp.get('rf1'));
  perform pg_temp.assert(n = 0, 'nor can frank delete his OWN company''s project (got ' || n || ')');
  perform pg_temp.assert(pg_temp.really_everything(pg_temp.get('rf1')) = 2, 'and rf1 and its version are still there');
end $$;

-- dave: a Seed Collaborative member, seed-entitled and able to BROWSE Building
-- Integrity's tree. Browsing is not a way in here.
select pg_temp.act_as('dave');
do $$
declare n integer;
begin
  n := pg_temp.try_delete(pg_temp.get('p1'));
  perform pg_temp.assert(n = 0,
    'dave, a seed-entitled member who can browse this project, deletes 0 rows (got ' || n || ')');
  perform pg_temp.assert(pg_temp.really_everything(pg_temp.get('p1')) = 7, 'and nothing of p1 went');
end $$;

-- nick: the person who ASKED for access. A pending request is not access.
select pg_temp.act_as('nick');
do $$
declare n integer;
begin
  n := pg_temp.try_delete(pg_temp.get('p1'));
  perform pg_temp.assert(n = 0,
    'nick, whose access request on p1 is pending, deletes 0 rows (got ' || n || ')');
  perform pg_temp.assert(pg_temp.really_everything(pg_temp.get('p1')) = 7, 'and nothing of p1 went');
end $$;

-- henry: signed in, no membership anywhere.
select pg_temp.act_as('henry');
do $$
declare n integer;
begin
  n := pg_temp.try_delete(pg_temp.get('p1'));
  perform pg_temp.assert(n = 0, 'henry, with no membership at all, deletes 0 rows (got ' || n || ')');
  perform pg_temp.assert(pg_temp.really_everything(pg_temp.get('p1')) = 7, 'and nothing of p1 went');
end $$;

-- A caller with no subject on the request at all: the shape of an expired or
-- broken token reaching PostgREST.
select set_config('request.jwt.claims', '', true);
do $$
declare n integer;
begin
  n := pg_temp.try_delete(pg_temp.get('p1'));
  perform pg_temp.assert(n = 0,
    'a caller with no subject deletes 0 rows — fail closed, not fail open (got ' || n || ')');
  perform pg_temp.assert(pg_temp.really_everything(pg_temp.get('p1')) = 7, 'and nothing of p1 went');
end $$;

-- ===========================================================================
-- 2. WHAT THE CONFIRMATION SCREEN READS. The note promises to name what will
-- be destroyed; a platform admin has to be able to count all three cascades,
-- or it would be showing a number it could not have had.
-- ===========================================================================
select pg_temp.act_as('pat');
do $$ begin
  perform pg_temp.assert((select count(*) from public.project_versions where project_id = pg_temp.get('p1')) = 3,
    'pat counts p1''s three versions THROUGH RLS — the number the note shows');
  perform pg_temp.assert((select count(*) from public.collaborators where project_id = pg_temp.get('p1')) = 2,
    'and its two grants');
  perform pg_temp.assert((select count(*) from public.collab_requests where project_id = pg_temp.get('p1')) = 1,
    'and its one access request');
  perform pg_temp.assert((select name from public.projects where id = pg_temp.get('p1')) = 'Smith House',
    'and reads the project''s CURRENT name, which is what the typed confirmation is checked against');
end $$;

-- An outsider counts nothing of it, so the preview route could not serve them
-- those numbers even if it forgot to refuse.
select pg_temp.act_as('nick');
do $$ begin
  perform pg_temp.assert((select count(*) from public.projects where id = pg_temp.get('p1')) = 0,
    'nick, who only asked, reads 0 rows of p1 — the preview has nothing to tell him');
  perform pg_temp.assert((select count(*) from public.project_versions where project_id = pg_temp.get('p1')) = 0,
    'and 0 of its versions');
end $$;

-- ===========================================================================
-- 3. A SINGLE-VERSION DELETE IS STILL REFUSED, PLATFORM ADMIN INCLUDED.
--
-- Stage 5 deliberately did NOT open this door: it would leave
-- head_version_number stale and break a parent_version_id chain, and the spec
-- says it needs its own design. Pinned here so that "the delete UI shipped"
-- can never quietly come to mean this too.
-- ===========================================================================
select pg_temp.act_as('pat');
do $$
declare v_state text;
begin
  v_state := pg_temp.sqlstate_of(format($q$ delete from public.project_versions where id = %L $q$, pg_temp.get('p1_v2')));
  perform pg_temp.assert(v_state = '42501',
    'a DIRECT single-version delete RAISES, even for a platform admin (got ' || coalesce(v_state, 'success') || ')');
  v_state := pg_temp.sqlstate_of(format($q$ delete from public.project_versions where id = %L $q$, pg_temp.get('p1_v3')));
  perform pg_temp.assert(v_state = '42501', 'nor the head version (got ' || coalesce(v_state, 'success') || ')');
  v_state := pg_temp.sqlstate_of(format($q$ delete from public.project_versions where id = %L $q$, pg_temp.get('p1_v1')));
  perform pg_temp.assert(v_state = '42501', 'nor version 1 (got ' || coalesce(v_state, 'success') || ')');
  perform pg_temp.assert(pg_temp.really_versions(pg_temp.get('p1')) = 3, 'and all three versions are still there');

  -- Nor by emptying the table, which fires no row triggers.
  v_state := pg_temp.sqlstate_of($q$ truncate public.project_versions $q$);
  perform pg_temp.assert(v_state is not null,
    'and a platform admin cannot TRUNCATE the versions either (got ' || coalesce(v_state, 'success') || ')');
  perform pg_temp.assert(pg_temp.really_versions(pg_temp.get('p1')) = 3, 'all three are STILL there');
end $$;

-- ===========================================================================
-- 4. TWO-FACTOR IS NOT WAIVED FOR THE ONE ACCOUNT THAT CAN DELETE EVERYTHING.
--
-- Two-factor is optional for everyone, the platform admin included, and that
-- accepted risk is recorded in the spec. What must NOT happen is an enrolled
-- platform admin deleting a project from a password-only session.
-- ===========================================================================
reset role;
select set_config('request.jwt.claims', '', true);
set local app.operator = 'on';
insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
values (gen_random_uuid(), pg_temp.u('pat'), 'totp', 'verified', now(), now());
set local app.operator = '';
set local role authenticated;

select pg_temp.act_as('pat', 'aal1');
do $$
declare n integer;
begin
  n := pg_temp.try_delete(pg_temp.get('p2'));
  perform pg_temp.assert(n = 0,
    'an ENROLLED platform admin on a password-only session deletes 0 rows (got ' || n || ')');
  perform pg_temp.assert(pg_temp.really_everything(pg_temp.get('p2')) = 2, 'and p2 and its version are untouched');
end $$;

select pg_temp.act_as('pat', 'aal2');
do $$
declare n integer;
begin
  n := pg_temp.try_delete(pg_temp.get('p2'));
  perform pg_temp.assert(n = 1,
    'and deletes it once the second factor has actually been presented (got ' || n || ')');
  perform pg_temp.assert(pg_temp.really_everything(pg_temp.get('p2')) = 0, 'p2 and its version are gone');
end $$;

reset role;
set local app.operator = 'on';
delete from auth.mfa_factors where user_id = pg_temp.u('pat');
set local app.operator = '';
set local role authenticated;

-- ===========================================================================
-- 5. THE PLATFORM ADMIN DELETES A WHOLE PROJECT, AND EVERYTHING GOES WITH IT.
--
-- One statement. Three cascades. This is the assertion 0006's own suite could
-- not make, because grants and access requests did not exist yet.
-- ===========================================================================
select pg_temp.act_as('pat');
do $$
declare n integer;
begin
  perform pg_temp.assert(pg_temp.really_everything(pg_temp.get('p1')) = 7,
    'premise: p1 still has its project row, three versions, two grants and a request');
  n := pg_temp.try_delete(pg_temp.get('p1'));
  perform pg_temp.assert(n = 1, 'a platform admin deletes the whole project: exactly one row (got ' || n || ')');
  perform pg_temp.assert(pg_temp.really_projects(pg_temp.get('p1')) = 0, 'the project row is gone');
  perform pg_temp.assert(pg_temp.really_versions(pg_temp.get('p1')) = 0,
    'its three versions went with it — including v3, whose parent is v2 (0006''s cascade)');
  perform pg_temp.assert(pg_temp.really_grants(pg_temp.get('p1')) = 0,
    'BOTH GRANTS went with it: nobody is left holding a share of a project that does not exist (0008''s cascade)');
  perform pg_temp.assert(pg_temp.really_requests(pg_temp.get('p1')) = 0,
    'and the access request went too (0009''s cascade)');
end $$;

-- Nothing else moved. A delete that took a neighbour with it would be the
-- worst possible defect here, and it would be silent.
do $$ begin
  perform pg_temp.assert(pg_temp.really_everything(pg_temp.get('rf1')) = 2,
    'Rare Forms'' project and its version are untouched by Building Integrity''s delete');
  perform pg_temp.assert(pg_temp.really_everything(pg_temp.get('p3')) = 2, 'and so is p3');
  perform pg_temp.assert(pg_temp.really_companies() = 4, 'every company is still there');
  perform pg_temp.assert(pg_temp.really_memberships() = 5, 'and every membership');
  perform pg_temp.assert(pg_temp.really_users() = 7, 'and every account: deleting a project deletes no person');
end $$;

-- ===========================================================================
-- 6. ACROSS COMPANIES. Tommy will be clearing out test projects in more than
-- one company's tree, and the platform admin is a member of none of them.
-- ===========================================================================
select pg_temp.act_as('pat');
do $$
declare n integer;
begin
  perform pg_temp.assert((select count(*) from public.memberships where user_id = pg_temp.u('pat')) = 0,
    'premise: pat holds NO membership anywhere — this reaches Rare Forms as a platform admin, not as a colleague');
  n := pg_temp.try_delete(pg_temp.get('rf1'));
  perform pg_temp.assert(n = 1, 'a platform admin deletes ANOTHER company''s project (got ' || n || ')');
  perform pg_temp.assert(pg_temp.really_everything(pg_temp.get('rf1')) = 0, 'and its version goes with it');
  perform pg_temp.assert(pg_temp.really_all_projects() = 1, 'only p3 is left');
end $$;

-- ===========================================================================
-- 7. THE DEPTH CHECK IS NOT THE PERMISSION. A cascade arriving from a caller
-- who is NOT privileged — the shape of a dashboard or a GoTrue admin delete —
-- is still refused by the version guard. Stage 2 asserted this; it is
-- re-asserted because Stage 5 is the first thing that ever calls the delete on
-- purpose, and because the answer would otherwise be inferred from a UI that
-- never takes this path.
-- ===========================================================================
reset role;
select set_config('request.jwt.claims', '', true);
do $$
declare v_state text;
begin
  perform pg_temp.assert(not public.is_privileged_caller(), 'premise: no operator opt-in on this connection');
  v_state := pg_temp.sqlstate_of(format($q$ delete from public.projects where id = %L $q$, pg_temp.get('p3')));
  perform pg_temp.assert(v_state = '42501',
    'a cascade from an unprivileged direct connection is refused by the version guard (got ' || coalesce(v_state, 'success') || ')');
  perform pg_temp.assert(pg_temp.really_everything(pg_temp.get('p3')) = 2, 'and p3 and its version survive');
end $$;

do $$ begin
  raise notice 'stage5_rls: ALL ASSERTIONS PASSED';
end $$;

rollback;
