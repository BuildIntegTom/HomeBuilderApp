-- Stage 3 RLS verification — collaboration (migration 0008).
--
-- Ends with "stage3_rls: ALL ASSERTIONS PASSED" or aborts on the first failure.
--
-- LOCAL OR STAGING ONLY. NEVER THE LIVE PROJECT. There is a guard below that
-- refuses to run on any database with memberships, projects or grants in it;
-- live has memberships.
--
-- HOW TO RUN (see supabase/README.md, "Stage 3 → Verifying locally"):
--   local_shim.sql, then 0001–0008, then stage1_rls.test.sql,
--   stage2_rls.test.sql, stage2_concurrency.test.sh, then this file, then
--   stage3_concurrency.test.sh.
--
-- EVERY ASSERTION RUNS AS AN ORDINARY MEMBER, WITHOUT THE OPERATOR OPT-IN,
-- unless it is about the platform admin. The people span five companies:
-- Building Integrity (bob, alice, erin, gwen), Rare Forms (frank, fiona, gwen),
-- New Frameworks (nick), a company outside the consortium (carol), and The Seed
-- Collaborative (dave) — plus henry, who has no membership until he joins Rare
-- Forms partway through.
--
-- NO ASSERTION IS SWALLOWED. pg_temp.assert raises P0001. Every exception
-- handler below catches a SPECIFIC SQLSTATE (ZZ001 for a deliberate undo), or
-- is pg_temp.sqlstate_of / msg_of, which only ever wrap the statement under
-- test and never an assertion.
--
-- Section numbers are the plan's ("Tests — stage3_rls.test.sql"). They run in
-- the order their fixtures need, which is not numeric order.
--
-- TIME. Every now() in one transaction is the same instant. So fixture
-- memberships are dated 30 days back, and henry's joining is dated one minute
-- ahead, so that "a grant made before you joined" means something.

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
    when 'carol' then 'cccccccc-0000-0000-0000-000000000001'
    when 'dave'  then 'dddddddd-0000-0000-0000-000000000001'
    when 'erin'  then 'eeeeeeee-0000-0000-0000-000000000001'
    when 'pat'   then 'ffffffff-0000-0000-0000-000000000001'
    when 'frank' then 'f1f1f1f1-0000-0000-0000-000000000001'
    when 'gwen'  then 'f2f2f2f2-0000-0000-0000-000000000001'
    when 'fiona' then 'f3f3f3f3-0000-0000-0000-000000000001'
    when 'nick'  then 'f4f4f4f4-0000-0000-0000-000000000001'
    when 'henry' then 'f5f5f5f5-0000-0000-0000-000000000001'
  end)::uuid;
$$;

create or replace function pg_temp.co(p_name text)
returns uuid language sql immutable as $$
  select (case p_name
    when 'BI'   then '11111111-0000-0000-0000-000000000001'
    when 'RF'   then '22222222-0000-0000-0000-000000000001'
    when 'NM'   then '33333333-0000-0000-0000-000000000001'
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
  select set_config('stage3test.' || k, v::text, true);
$$;

create or replace function pg_temp.get(k text)
returns uuid language plpgsql as $$
declare v text := nullif(current_setting('stage3test.' || k, true), '');
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
    'savedAt', '2026-09-14T12:00:00.000Z',
    'state', jsonb_build_object('projectName', p_name, 'priceModifier', 1.3, 'role', 'public'));
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

-- SQLSTATE and message together, for the uniform-error assertions.
create or replace function pg_temp.msg_of(p_sql text)
returns text language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlstate || ': ' || sqlerrm;
end;
$$;

-- Row counts through the CALLER's RLS (pg_temp functions are security invoker).
create or replace function pg_temp.reads(p uuid)
returns bigint language sql as $$ select count(*) from public.projects where id = p $$;

create or replace function pg_temp.versions(p uuid)
returns bigint language sql as $$ select count(*) from public.project_versions where project_id = p $$;

create or replace function pg_temp.same_set(a uuid[], b uuid[])
returns boolean language sql as $$
  select coalesce((select array_agg(distinct x order by x) from unnest(a) x), '{}')
       = coalesce((select array_agg(distinct x order by x) from unnest(b) x), '{}');
$$;

create or replace function pg_temp.shared_list(p_acting_as uuid)
returns uuid[] language sql as $$
  select coalesce(array_agg(project_id), '{}') from public.list_shared_projects(p_acting_as);
$$;

create or replace function pg_temp.pending()
returns uuid[] language sql as $$
  select coalesce(array_agg(grant_id), '{}') from public.pending_share_notices();
$$;

-- REFUSE TO RUN ON A DATABASE THAT HAS PEOPLE, PROJECTS OR GRANTS IN IT.
do $$
begin
  if exists (select 1 from public.memberships) then
    raise exception 'stage3_rls.test.sql refuses to run here: this database already has memberships, so it is not a fresh or staging one. Never run supabase/tests/ against the live project.';
  end if;
  if exists (select 1 from public.projects) then
    raise exception 'stage3_rls.test.sql refuses to run here: this database already has projects. Never run supabase/tests/ against the live project.';
  end if;
  if exists (select 1 from public.collaborators) then
    raise exception 'stage3_rls.test.sql refuses to run here: this database already has collaborator grants. Never run supabase/tests/ against the live project.';
  end if;
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
  (pg_temp.u('carol'), 'carol@nonmember.test'),
  (pg_temp.u('dave'),  'dave@seed.test'),
  (pg_temp.u('erin'),  'erin@bi.test'),
  (pg_temp.u('pat'),   'pat@platform.test'),
  (pg_temp.u('frank'), 'frank@rareforms.test'),
  (pg_temp.u('gwen'),  'gwen@both.test'),
  (pg_temp.u('fiona'), 'fiona@rareforms.test'),
  (pg_temp.u('nick'),  'nick@newframeworks.test'),
  (pg_temp.u('henry'), 'henry@nowhere.test');

update public.user_profiles set is_platform_admin = true where id = pg_temp.u('pat');
update public.user_profiles set display_name = 'Bob Builder'  where id = pg_temp.u('bob');
update public.user_profiles set display_name = 'Alice Admin'  where id = pg_temp.u('alice');
update public.user_profiles set display_name = 'Frank Framer' where id = pg_temp.u('frank');
update public.user_profiles set display_name = 'Nick New'     where id = pg_temp.u('nick');
-- dave and henry have no display name: their snapshots fall back to email.

insert into public.companies (id, name, is_seed_member, is_consortium) values
  (pg_temp.co('BI'),   'Building Integrity',     true,  false),
  (pg_temp.co('RF'),   'Rare Forms',             true,  false),
  (pg_temp.co('NM'),   'Nonmember Co',           false, false),
  (pg_temp.co('SEED'), 'The Seed Collaborative', true,  true),
  (pg_temp.co('NF'),   'New Frameworks',         true,  false);

insert into public.memberships (user_id, company_id, level, created_at) values
  (pg_temp.u('alice'), pg_temp.co('BI'),   'admin',  now() - interval '30 days'),
  (pg_temp.u('erin'),  pg_temp.co('BI'),   'admin',  now() - interval '30 days'),
  (pg_temp.u('bob'),   pg_temp.co('BI'),   'member', now() - interval '30 days'),
  (pg_temp.u('carol'), pg_temp.co('NM'),   'member', now() - interval '30 days'),
  (pg_temp.u('dave'),  pg_temp.co('SEED'), 'member', now() - interval '30 days'),
  (pg_temp.u('frank'), pg_temp.co('RF'),   'member', now() - interval '30 days'),
  (pg_temp.u('gwen'),  pg_temp.co('BI'),   'member', now() - interval '30 days'),
  (pg_temp.u('gwen'),  pg_temp.co('RF'),   'member', now() - interval '30 days'),
  (pg_temp.u('fiona'), pg_temp.co('RF'),   'member', now() - interval '30 days'),
  (pg_temp.u('nick'),  pg_temp.co('NF'),   'member', now() - interval '30 days');

set local app.operator = '';
do $$ begin
  perform pg_temp.assert(not public.is_privileged_caller(),
    'the operator opt-in must be off before the assertions start');
end $$;

set local role authenticated;

-- Projects, each created by an ordinary member of its own company.
select pg_temp.act_as('bob');
do $$
declare r record;
begin
  select * into r from public.create_project(pg_temp.co('BI'), 'current', pg_temp.doc('Smith House'), null);
  perform pg_temp.put('p1', r.project_id); perform pg_temp.put('p1_v1', r.version_id);
  select * into r from public.create_project(pg_temp.co('BI'), 'current', pg_temp.doc('Jones House'), null);
  perform pg_temp.put('p2', r.project_id);
  select * into r from public.create_project(pg_temp.co('BI'), 'proposals', pg_temp.doc('Seed Share House'), null);
  perform pg_temp.put('p3', r.project_id);
  select * into r from public.create_project(pg_temp.co('BI'), 'current', pg_temp.doc('Private House'), null);
  perform pg_temp.put('p4', r.project_id);
end $$;

select pg_temp.act_as('frank');
do $$
declare r record;
begin
  select * into r from public.create_project(pg_temp.co('RF'), 'current', pg_temp.doc('Rare House'), null);
  perform pg_temp.put('rf1', r.project_id);
end $$;

select pg_temp.act_as('dave');
do $$
declare r record;
begin
  select * into r from public.create_project(pg_temp.co('SEED'), 'current', pg_temp.doc('Seed House'), null);
  perform pg_temp.put('s1', r.project_id);
end $$;

reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform pg_temp.assert((select count(*) from public.collaborators) = 0,
    'members creating in their own company write no grant (decision 6)');
end $$;
set local role authenticated;

-- ===========================================================================
-- 1. Personal grant
-- ===========================================================================
select pg_temp.act_as('bob');
do $$
declare r record; g record;
begin
  select * into r from public.share_project_with_person(pg_temp.get('p1'), 'frank@rareforms.test');
  perform pg_temp.assert(r.status = 'shared' and r.grant_id is not null,
    'bob shares P1 with frank: shared (got ' || coalesce(r.status, '-') || ')');
  perform pg_temp.put('g_frank', r.grant_id);

  select * into g from public.collaborators where id = r.grant_id;
  perform pg_temp.assert(g.project_id = pg_temp.get('p1') and g.grantee_user_id = pg_temp.u('frank')
    and g.grantee_company_id is null and g.kind = 'shared',
    'the grant is a personal shared grant on P1 to frank');
  perform pg_temp.assert(g.granted_by = pg_temp.u('bob'), 'granted_by is stamped with the caller');
  perform pg_temp.assert(g.granted_by_name = 'Bob Builder', 'granted_by_name is snapshotted');
  perform pg_temp.assert(g.grantee_name = 'Frank Framer', 'grantee_name is snapshotted');
  perform pg_temp.assert(g.created_at = now(), 'created_at is the server''s now()');

  -- 7 (already-shared), and the lookup is case-insensitive and trimmed.
  select * into r from public.share_project_with_person(pg_temp.get('p1'), '  FRANK@RareForms.TEST ');
  perform pg_temp.assert(r.status = 'already-shared' and r.grant_id = pg_temp.get('g_frank'),
    'sharing with the same person again, spelled differently, is already-shared naming the same grant (got ' || coalesce(r.status, '-') || ')');
end $$;

select pg_temp.act_as('alice');
do $$
declare r record;
begin
  select * into r from public.share_project_with_person(pg_temp.get('p1'), 'frank@rareforms.test');
  perform pg_temp.assert(r.status = 'already-shared' and r.grant_id = pg_temp.get('g_frank'),
    'alice sharing P1 with frank again is already-shared');
  perform pg_temp.assert(
    (select granted_by = pg_temp.u('bob') and granted_by_name = 'Bob Builder'
       from public.collaborators where id = pg_temp.get('g_frank')),
    'and the original granted_by stands: still bob');
  perform pg_temp.assert(
    (select count(*) from public.collaborators
      where project_id = pg_temp.get('p1') and grantee_user_id = pg_temp.u('frank')) = 1,
    'and there is still exactly one grant to frank on P1');
end $$;

select pg_temp.act_as('frank');
do $$
declare r record; n integer; v_state text;
begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p1')) = 1,
    'frank (Rare Forms) reads Building Integrity''s P1 through his personal grant');
  perform pg_temp.assert(pg_temp.versions(pg_temp.get('p1')) = 1, 'and its version');
  perform pg_temp.assert(
    (select document -> 'state' ? 'priceModifier' from public.project_versions where id = pg_temp.get('p1_v1')),
    'costs included (decision 24)');
  perform pg_temp.assert(public.can_read_project(pg_temp.get('p1')) and public.can_write_project(pg_temp.get('p1')),
    'can_read_project and can_write_project are true for a grant holder');
  perform pg_temp.assert(
    (select count(*) from public.companies where id = pg_temp.co('BI')) = 0,
    'premise: companies_select hides Building Integrity from frank');
  perform pg_temp.assert(public.project_owner_company_name(pg_temp.get('p1')) = 'Building Integrity',
    'so project_owner_company_name gives him the owner''s name');
  perform pg_temp.assert(public.project_owner_company_id(pg_temp.get('p1')) = pg_temp.co('BI'),
    'and project_owner_company_id the owner''s id');

  -- Saving: no acting-as input exists in the database; the grant governs it.
  select * into r from public.save_project_version(pg_temp.get('p1'), pg_temp.get('p1_v1'), pg_temp.doc('Smith House'), 'frank''s save');
  perform pg_temp.assert(r.version_number = 2 and not r.diverged, 'frank saves P1 -> v2');
  perform pg_temp.assert(
    (select author_id = pg_temp.u('frank') and author_name = 'Frank Framer'
       from public.project_versions where id = r.version_id),
    'the author is frank, and his name is snapshotted');

  -- Rename: rename_project's `select … for update` needs the replaced projects_update.
  -- A refusal here must fail THIS assertion by name. Only 42501 is caught,
  -- and the handler itself raises through pg_temp.assert, so nothing is swallowed.
  begin
    select * into r from public.rename_project(pg_temp.get('p1'), 'Smith House Shared');
  exception when sqlstate '42501' then
    perform pg_temp.assert(false,
      'COLLABORATOR RENAME: frank renames P1 through select … for update (got 42501: ' || sqlerrm || ')');
  end;
  perform pg_temp.assert(r.version_number = 3, 'frank renames P1 (v3, through select … for update)');
  perform pg_temp.assert(
    (select name from public.projects where id = pg_temp.get('p1')) = 'Smith House Shared',
    'and the row name follows');

  -- Folder move (answer 11).
  update public.projects set folder = 'proposals' where id = pg_temp.get('p1');
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 1, 'frank moves P1 to Proposals in the owner''s tree: 1 row');
  perform pg_temp.assert(
    (select folder from public.projects where id = pg_temp.get('p1')) = 'proposals', 'and it is moved');

  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ update public.projects set company_id = %L where id = %L $q$,
      pg_temp.co('RF'), pg_temp.get('p1'))) = '42501',
    'frank changing P1''s company_id raises 42501');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ update public.projects set created_by = %L where id = %L $q$,
      pg_temp.u('frank'), pg_temp.get('p1'))) = '42501',
    'frank changing P1''s created_by raises 42501');

  -- Through sqlstate_of, not a bare DELETE. projects_delete admits only a
  -- platform admin, so this is silently 0 rows. Were the policy ever widened,
  -- Stage 2's version guard would turn P1's cascade into a 42501 — which must
  -- fail THIS assertion by name, not abort the suite on an anonymous error.
  -- (fs2 in section 9, which has no versions, covers the case with no guard.)
  v_state := pg_temp.sqlstate_of(format($q$ delete from public.projects where id = %L $q$, pg_temp.get('p1')));
  perform pg_temp.assert(v_state is null and pg_temp.reads(pg_temp.get('p1')) = 1,
    'NO COLLABORATOR DELETES: frank deleting P1 is 0 rows and P1 is still there (got ' || coalesce(v_state, 'no error') || ')');
  delete from public.project_versions where project_id = pg_temp.get('p1');
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 0, 'nor any of its versions');
end $$;

select pg_temp.act_as('fiona');
do $$
declare n integer;
begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p1')) = 0,
    'fiona, frank''s colleague at Rare Forms, reads 0 of P1: the grant is his, not his company''s');
  perform pg_temp.assert(pg_temp.versions(pg_temp.get('p1')) = 0, 'and 0 of its versions');
  perform pg_temp.assert(not public.can_read_project(pg_temp.get('p1')), 'can_read_project is false for her');
  perform pg_temp.assert(
    (select count(*) from public.collaborators where project_id = pg_temp.get('p1')) = 0,
    'she sees none of P1''s grants');
  perform pg_temp.assert(public.project_owner_company_name(pg_temp.get('p1')) is null
    and public.project_owner_company_id(pg_temp.get('p1')) is null,
    'and the owner helpers tell her nothing');
  update public.projects set folder = 'past' where id = pg_temp.get('p1');
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 0, 'she cannot move it');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.rename_project(%L, 'Fiona''s') $q$, pg_temp.get('p1'))) = '42501',
    'nor rename it');
end $$;

-- ===========================================================================
-- 2. Nothing else crosses — the margin assertion, again
-- ===========================================================================
select pg_temp.act_as('frank');
do $$ begin
  perform pg_temp.assert(
    (select count(*) from public.project_versions
      where document -> 'state' ? 'priceModifier' and project_id <> pg_temp.get('rf1'))
    = (select count(*) from public.project_versions where project_id = pg_temp.get('p1')),
    'THE MARGIN ASSERTION, STAGE 3: the only other-company documents frank reads are P1''s, the project shared with him');
  perform pg_temp.assert(pg_temp.versions(pg_temp.get('p1')) = 3, 'fixture sanity: P1 has 3 versions');
  perform pg_temp.assert(
    pg_temp.reads(pg_temp.get('p2')) = 0 and pg_temp.reads(pg_temp.get('p4')) = 0
    and pg_temp.versions(pg_temp.get('p2')) = 0 and pg_temp.versions(pg_temp.get('p4')) = 0,
    'frank reads 0 rows of Building Integrity''s other projects, even naming their ids');
  perform pg_temp.assert(pg_temp.same_set(
    (select array_agg(id) from public.projects), array[pg_temp.get('rf1'), pg_temp.get('p1')]),
    'frank lists exactly his own company''s project and P1');
end $$;

-- ===========================================================================
-- 3. Company grant — current and future members (answer 9)
-- ===========================================================================
select pg_temp.act_as('bob');
do $$
declare r record; g record;
begin
  -- A personal grant to henry, who has no membership anywhere yet.
  select * into r from public.share_project_with_person(pg_temp.get('p1'), 'henry@nowhere.test');
  perform pg_temp.assert(r.status = 'shared', 'bob shares P1 with henry (no membership): shared');
  perform pg_temp.put('g_henry', r.grant_id);
  perform pg_temp.assert(
    (select grantee_name from public.collaborators where id = r.grant_id) = 'henry@nowhere.test',
    'with no display name, grantee_name falls back to the email');

  select * into r from public.share_project_with_company(pg_temp.get('p2'), pg_temp.co('RF'));
  perform pg_temp.assert(r.status = 'shared' and r.grant_id is not null,
    'bob shares P2 with the company Rare Forms: shared (got ' || coalesce(r.status, '-') || ')');
  perform pg_temp.put('g_rf', r.grant_id);
  select * into g from public.collaborators where id = r.grant_id;
  perform pg_temp.assert(g.grantee_company_id = pg_temp.co('RF') and g.grantee_user_id is null
    and g.kind = 'shared' and g.granted_by = pg_temp.u('bob') and g.granted_by_name = 'Bob Builder'
    and g.grantee_name = 'Rare Forms' and g.created_at = now(),
    'the company grant names Rare Forms, stamped with bob and now()');
end $$;

select pg_temp.act_as('frank');
do $$
declare r record;
begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p2')) = 1, 'frank reads P2 through the Rare Forms grant');
  select * into r from public.share_project_with_company(pg_temp.get('p2'), pg_temp.co('RF'));
  perform pg_temp.assert(r.status = 'already-shared' and r.grant_id = pg_temp.get('g_rf'),
    'frank (a collaborator) sharing P2 with Rare Forms again is already-shared');
  perform pg_temp.assert(
    (select granted_by from public.collaborators where id = pg_temp.get('g_rf')) = pg_temp.u('bob'),
    'and granted_by is still bob');
end $$;

select pg_temp.act_as('fiona');
do $$ begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p2')) = 1 and pg_temp.versions(pg_temp.get('p2')) = 1,
    'fiona reads P2 and its version through the Rare Forms grant');
end $$;

select pg_temp.act_as('gwen');
do $$ begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p2')) = 1, 'gwen reads P2');
end $$;

select pg_temp.act_as('henry');
do $$
declare r record; v_head uuid;
begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p2')) = 0,
    'henry, not yet a member of Rare Forms, reads 0 of P2');
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p1')) = 1,
    'but reads P1: an account with no membership can hold a personal grant');
  select v.id into v_head from public.project_versions v
    join public.projects p on p.id = v.project_id and v.version_number = p.head_version_number
   where p.id = pg_temp.get('p1');
  select * into r from public.save_project_version(pg_temp.get('p1'), v_head, pg_temp.doc('Smith House Shared'), null);
  perform pg_temp.assert(r.version_number = 4 and not r.diverged,
    'and saves to it with no membership at all: the project''s grants govern a save, not a company');
  perform pg_temp.assert(
    (select author_name from public.project_versions where id = r.version_id) = 'henry@nowhere.test',
    'attributed to him');
end $$;

reset role;
select set_config('request.jwt.claims', '', true);
set local app.operator = 'on';
select set_config('stage3test.p2_grants',
  (select count(*) from public.collaborators where project_id = pg_temp.get('p2'))::text, true);
-- henry joins Rare Forms AFTER P2 was shared with it.
insert into public.memberships (user_id, company_id, level, created_at)
values (pg_temp.u('henry'), pg_temp.co('RF'), 'member', now() + interval '1 minute');
set local app.operator = '';
set local role authenticated;

select pg_temp.act_as('henry');
do $$ begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p2')) = 1 and pg_temp.versions(pg_temp.get('p2')) = 1,
    'FUTURE MEMBERS: henry joins Rare Forms and reads P2 on his next request');
end $$;

reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform pg_temp.assert(
    (select count(*) from public.collaborators where project_id = pg_temp.get('p2'))
      = current_setting('stage3test.p2_grants')::int,
    'with no new grant row written: membership is evaluated at request time');
end $$;
set local app.operator = 'on';
delete from public.memberships where user_id = pg_temp.u('fiona') and company_id = pg_temp.co('RF');
set local app.operator = '';
set local role authenticated;

select pg_temp.act_as('fiona');
do $$ begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p2')) = 0 and pg_temp.versions(pg_temp.get('p2')) = 0,
    'LEAVERS: fiona leaves Rare Forms and reads 0 of P2 on her next request');
  perform pg_temp.assert(not public.can_write_project(pg_temp.get('p2')), 'and cannot write it');
end $$;

-- ===========================================================================
-- 4. A Seed company grant is not a consortium grant
-- ===========================================================================
select pg_temp.act_as('bob');
do $$
declare r record;
begin
  select * into r from public.share_project_with_company(pg_temp.get('p3'), pg_temp.co('SEED'));
  perform pg_temp.assert(r.status = 'shared', 'bob shares P3 with the company The Seed Collaborative');
  perform pg_temp.put('g_seed', r.grant_id);
  perform pg_temp.assert(
    (select grantee_name from public.collaborators where id = r.grant_id) = 'The Seed Collaborative',
    'grantee_name is the company''s name');
end $$;

select pg_temp.act_as('dave');
do $$ begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p3')) = 1 and pg_temp.versions(pg_temp.get('p3')) = 1,
    'dave, a member of The Seed Collaborative, reads P3');
end $$;

select pg_temp.act_as('frank');
do $$ begin
  perform pg_temp.assert(public.can_act_as(pg_temp.co('SEED')) and public.is_seed_entitled(),
    'premise: frank may act as The Seed Collaborative through the consortium');
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p3')) = 0 and pg_temp.versions(pg_temp.get('p3')) = 0
    and not public.can_read_project(pg_temp.get('p3')),
    'A SEED COMPANY GRANT IS NOT A CONSORTIUM GRANT: frank, seed-entitled but not a Seed member, reads 0 of P3');
end $$;

select pg_temp.act_as('nick');
do $$ begin
  perform pg_temp.assert(public.can_act_as(pg_temp.co('SEED')), 'premise: nick may act as Seed');
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p3')) = 0,
    'nick (New Frameworks), seed-entitled, reads 0 of P3 too');
end $$;

-- ===========================================================================
-- 5. Onward sharing (answer 10)
-- ===========================================================================
select pg_temp.act_as('frank');
do $$
declare r record; g record;
begin
  select * into r from public.share_project_with_person(pg_temp.get('p1'), 'nick@newframeworks.test');
  perform pg_temp.assert(r.status = 'shared', 'frank, a grantee, shares P1 onward with nick');
  perform pg_temp.put('g_nick', r.grant_id);
  select * into g from public.collaborators where id = r.grant_id;
  perform pg_temp.assert(g.granted_by = pg_temp.u('frank') and g.granted_by_name = 'Frank Framer'
    and g.grantee_name = 'Nick New',
    'granted_by is frank and granted_by_name is set');

  select * into r from public.share_project_with_person(pg_temp.get('p1'), 'dave@seed.test');
  perform pg_temp.assert(r.status = 'shared', 'frank also shares P1 with dave');
  perform pg_temp.put('g_dave_by_frank', r.grant_id);
  perform pg_temp.assert(
    (select grantee_name from public.collaborators where id = r.grant_id) = 'dave@seed.test',
    'grantee_name falls back to dave''s email');
end $$;

select pg_temp.act_as('nick');
do $$
declare r record;
begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p1')) = 1, 'nick reads P1');
  select * into r from public.share_project_with_person(pg_temp.get('p1'), 'carol@nonmember.test');
  perform pg_temp.assert(r.status = 'shared', 'nick, now a grantee himself, shares P1 with carol');
  perform pg_temp.put('g_carol', r.grant_id);
  perform pg_temp.assert(
    (select granted_by from public.collaborators where id = r.grant_id) = pg_temp.u('nick'),
    'granted_by is nick');
end $$;

select pg_temp.act_as('carol');
do $$ begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p1')) = 1 and pg_temp.versions(pg_temp.get('p1')) = 4,
    'carol, in a company outside the consortium, reads P1 and all its versions through nick''s grant');
  perform pg_temp.assert(
    (select count(*) from public.collaborators where project_id = pg_temp.get('p1')) = 5,
    'everyone who can open P1 sees its whole access list (Open Item 3): 5 grants');
end $$;

select pg_temp.act_as('dave');
do $$ begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p1')) = 1, 'dave reads P1 through frank''s grant');
end $$;

-- The cascade offer (Open Item 1): an owner member must be able to find the
-- shares a grantee made, keyed by that grantee's user id.
select pg_temp.act_as('bob');
do $$ begin
  perform pg_temp.assert(pg_temp.same_set(
    (select array_agg(c.id) from public.collaborators c
      where c.project_id = pg_temp.get('p1')
        and c.granted_by = (select g.grantee_user_id from public.collaborators g where g.id = pg_temp.get('g_frank'))),
    array[pg_temp.get('g_nick'), pg_temp.get('g_dave_by_frank')]),
    'CASCADE-OFFER DATA: bob can list the 2 shares frank made on P1, from frank''s grant row');
  perform pg_temp.assert(pg_temp.same_set(
    (select array_agg(c.id) from public.collaborators c
      where c.project_id = pg_temp.get('p1')
        and c.granted_by = (select g.grantee_user_id from public.collaborators g where g.id = pg_temp.get('g_nick'))),
    array[pg_temp.get('g_carol')]),
    'and the 1 share nick made');
  perform pg_temp.assert(
    (select bool_and(granted_by_name is not null) from public.collaborators
      where project_id = pg_temp.get('p1') and kind = 'shared'),
    'and every shared grant carries its granter''s name, readable across companies');
end $$;

-- ===========================================================================
-- 7. Owner safety (answer 14)
-- ===========================================================================
reset role;
select set_config('request.jwt.claims', '', true);
select set_config('stage3test.grants_before_7', (select count(*) from public.collaborators)::text, true);
set local role authenticated;

select pg_temp.act_as('bob');
do $$
declare r record;
begin
  select * into r from public.share_project_with_company(pg_temp.get('p1'), pg_temp.co('BI'));
  perform pg_temp.assert(r.status = 'owner-company' and r.grant_id is null,
    'sharing P1 with its owner, Building Integrity, is owner-company (got ' || coalesce(r.status, '-') || ')');
  select * into r from public.share_project_with_person(pg_temp.get('p1'), 'erin@bi.test');
  perform pg_temp.assert(r.status = 'already-member' and r.grant_id is null,
    'sharing with erin, a BI admin, is already-member');
  select * into r from public.share_project_with_person(pg_temp.get('p1'), 'gwen@both.test');
  perform pg_temp.assert(r.status = 'already-member',
    'sharing with gwen, a member of BI and Rare Forms, is already-member');
  select * into r from public.share_project_with_person(pg_temp.get('p1'), 'Bob@BI.test');
  perform pg_temp.assert(r.status = 'self' and r.grant_id is null, 'sharing with yourself is self');
  select * into r from public.share_project_with_person(pg_temp.get('p1'), 'nobody@nowhere.test');
  perform pg_temp.assert(r.status = 'no-account' and r.grant_id is null,
    'an unknown email is no-account (Open Item 8), not a silent no-op');
  select * into r from public.share_project_with_company(pg_temp.get('p1'), pg_temp.co('NM'));
  perform pg_temp.assert(r.status = 'not-shareable', 'a company outside the consortium is not-shareable (Open Item 4)');
  select * into r from public.share_project_with_company(pg_temp.get('p1'), '00000000-0000-0000-0000-00000000dead');
  perform pg_temp.assert(r.status = 'not-shareable', 'a company that does not exist is reported the same way');
  select * into r from public.share_project_with_company(pg_temp.get('p1'), null);
  perform pg_temp.assert(r.status = 'not-shareable', 'and so is no company at all');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.share_project_with_person(%L, '   ') $q$, pg_temp.get('p1'))) = '22023',
    'a blank email is refused as invalid input');
end $$;

select pg_temp.act_as('frank');
do $$
declare r record;
begin
  select * into r from public.share_project_with_company(pg_temp.get('p2'), pg_temp.co('BI'));
  perform pg_temp.assert(r.status = 'owner-company',
    'a collaborator (frank, on P2) sharing with the owner company is owner-company too');
  select * into r from public.share_project_with_person(pg_temp.get('p1'), 'frank@rareforms.test');
  perform pg_temp.assert(r.status = 'self', 'frank sharing P1 with himself is self');
  select * into r from public.share_project_with_person(pg_temp.get('p1'), 'alice@bi.test');
  perform pg_temp.assert(r.status = 'already-member', 'frank sharing P1 with alice (BI) is already-member');
end $$;

reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform pg_temp.assert(
    (select count(*) from public.collaborators) = current_setting('stage3test.grants_before_7')::int,
    'none of those answers wrote a row');
  perform pg_temp.assert(
    (select count(*) from public.collaborators where grantee_company_id = pg_temp.co('BI')) = 0,
    'there is no grant to Building Integrity on its own project');
end $$;
set local role authenticated;

-- A direct write on either new table raises for everyone below operator.
do $$
declare who text;
begin
  foreach who in array array['bob', 'frank', 'alice', 'pat'] loop
    perform pg_temp.act_as(who);
    perform pg_temp.assert(
      pg_temp.sqlstate_of(format($q$ insert into public.collaborators (project_id, grantee_user_id, kind, granted_by, granted_by_name, grantee_name) values (%L, %L, 'shared', %L, 'x', 'Fiona') $q$,
        pg_temp.get('p1'), pg_temp.u('fiona'), pg_temp.u(who))) = '42501',
      who || ': a direct insert into collaborators raises 42501');
    perform pg_temp.assert(
      pg_temp.sqlstate_of(format($q$ update public.collaborators set granted_by = %L where id = %L $q$,
        pg_temp.u(who), pg_temp.get('g_frank'))) = '42501',
      who || ': a direct update of collaborators raises 42501');
    perform pg_temp.assert(
      pg_temp.sqlstate_of(format($q$ insert into public.share_notice_state (user_id, seen_through) values (%L, now()) $q$,
        pg_temp.u(who))) = '42501',
      who || ': a direct insert into share_notice_state raises 42501');
    perform pg_temp.assert(
      pg_temp.sqlstate_of($q$ update public.share_notice_state set seen_through = now() $q$) = '42501',
      who || ': a direct update of share_notice_state raises 42501');
  end loop;
end $$;

-- ===========================================================================
-- 8. No access, no sharing — and one uniform error
-- ===========================================================================
select pg_temp.act_as('frank');
do $$
declare m_p4 text; m_dead text;
begin
  m_p4 := pg_temp.msg_of(format($q$ select public.share_project_with_person(%L, 'nick@newframeworks.test') $q$, pg_temp.get('p4')));
  m_dead := pg_temp.msg_of($q$ select public.share_project_with_person('00000000-0000-0000-0000-00000000dead', 'nick@newframeworks.test') $q$);
  perform pg_temp.assert(m_p4 like '42501:%', 'frank, holding no grant on P4, cannot share it with a person (got ' || coalesce(m_p4, 'success') || ')');
  perform pg_temp.assert(m_p4 = m_dead,
    'UNIFORM ERROR: "not yours" and "does not exist" are indistinguishable (' || coalesce(m_p4, '?') || ' / ' || coalesce(m_dead, '?') || ')');
  perform pg_temp.assert(
    pg_temp.msg_of(format($q$ select public.share_project_with_person(%L, 'nobody@nowhere.test') $q$, pg_temp.get('p4'))) = m_p4,
    'the access check comes first: an email cannot be probed through a project you cannot share');

  m_p4 := pg_temp.msg_of(format($q$ select public.share_project_with_company(%L, %L) $q$, pg_temp.get('p4'), pg_temp.co('NF')));
  m_dead := pg_temp.msg_of(format($q$ select public.share_project_with_company('00000000-0000-0000-0000-00000000dead', %L) $q$, pg_temp.co('NF')));
  perform pg_temp.assert(m_p4 like '42501:%' and m_p4 = m_dead,
    'nor with a company, with the same uniform error');

  perform pg_temp.assert(
    public.project_owner_company_id(pg_temp.get('p4')) is null
    and public.project_owner_company_id('00000000-0000-0000-0000-00000000dead') is null
    and public.project_owner_company_name(pg_temp.get('p4')) is null
    and public.project_owner_company_name('00000000-0000-0000-0000-00000000dead') is null,
    'the owner helpers answer null for an unreadable project and for a missing one alike');

  perform pg_temp.assert(
    pg_temp.msg_of(format($q$ select public.rename_project(%L, 'x') $q$, pg_temp.get('p4')))
    = pg_temp.msg_of($q$ select public.rename_project('00000000-0000-0000-0000-00000000dead', 'x') $q$),
    'and renaming an unshared project fails exactly like renaming a missing one');
end $$;

select pg_temp.act_as('carol');
do $$ begin
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.share_project_with_person(%L, 'nick@newframeworks.test') $q$, pg_temp.get('p2'))) = '42501',
    'carol, whose company is not a consortium member, gets 42501 sharing a project she cannot see');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.share_project_with_company(%L, %L) $q$, pg_temp.get('p4'), pg_temp.co('NM'))) = '42501',
    'with either function');
end $$;

-- ===========================================================================
-- 12. The Shared list and notices filter explicitly
-- ===========================================================================

-- Notices -------------------------------------------------------------------
select pg_temp.act_as('henry');
do $$
declare n record;
begin
  perform pg_temp.assert(pg_temp.same_set(pg_temp.pending(), array[pg_temp.get('g_henry')]),
    'henry''s notices are exactly his personal P1 grant: P2''s Rare Forms grant was made BEFORE he joined, so it is not news');
  select * into n from public.pending_share_notices();
  perform pg_temp.assert(n.project_id = pg_temp.get('p1') and n.project_name = 'Smith House Shared'
    and n.owner_company_name = 'Building Integrity' and n.granted_by_name = 'Bob Builder'
    and n.grantee_kind = 'person' and n.grantee_name = 'henry@nowhere.test' and n.created_at = now(),
    'the notice names the project, its owner, the sharer, "you", and the time');
end $$;

-- A company admin reads every membership row of their company
-- (memberships_select). The join-date rule must still be about YOUR row, or an
-- admin who joined after a company grant is told of it on the strength of a
-- colleague who was already there. henry is made a Rare Forms admin for this
-- block only.
reset role;
select set_config('request.jwt.claims', '', true);
set local app.operator = 'on';
update public.memberships set level = 'admin'
 where user_id = pg_temp.u('henry') and company_id = pg_temp.co('RF');
set local app.operator = '';
set local role authenticated;

select pg_temp.act_as('henry');
do $$ begin
  perform pg_temp.assert(public.is_company_admin(pg_temp.co('RF'))
    and exists (select 1 from public.memberships m
                 where m.company_id = pg_temp.co('RF') and m.user_id <> pg_temp.u('henry')
                   and m.created_at < (select c.created_at from public.collaborators c where c.id = pg_temp.get('g_rf'))),
    'premise: henry, now a Rare Forms admin, reads the membership of a colleague who joined before P2 was shared with Rare Forms');
  perform pg_temp.assert(pg_temp.same_set(pg_temp.pending(), array[pg_temp.get('g_henry')]),
    'NOTICES FOLLOW YOUR OWN MEMBERSHIP: henry, a Rare Forms admin who joined after P2 was shared with it, is still notified only of his own P1 grant, not of the Rare Forms grant his colleagues were there for');
end $$;

reset role;
select set_config('request.jwt.claims', '', true);
set local app.operator = 'on';
update public.memberships set level = 'member'
 where user_id = pg_temp.u('henry') and company_id = pg_temp.co('RF');
set local app.operator = '';
set local role authenticated;

select pg_temp.act_as('frank');
do $$ begin
  perform pg_temp.assert(pg_temp.same_set(pg_temp.pending(), array[pg_temp.get('g_frank'), pg_temp.get('g_rf')]),
    'frank''s notices: his personal grant and the Rare Forms grant, and NOT the two grants he made');
  perform pg_temp.assert(
    (select grantee_kind = 'company' and grantee_name = 'Rare Forms'
       from public.pending_share_notices() where grant_id = pg_temp.get('g_rf')),
    'a company grant''s notice names the company');
end $$;

select pg_temp.act_as('dave');
do $$ begin
  perform pg_temp.assert(pg_temp.same_set(pg_temp.pending(), array[pg_temp.get('g_seed'), pg_temp.get('g_dave_by_frank')]),
    'dave''s notices: the Seed company grant and frank''s grant to him');
end $$;

select pg_temp.act_as('nick');
do $$
declare r record;
begin
  perform pg_temp.assert(pg_temp.same_set(pg_temp.pending(), array[pg_temp.get('g_nick')]),
    'nick''s notices: frank''s grant to him, not the one he made to carol');

  -- The one way a grant you made can REACH you: a company grant to your own
  -- company. It is still not news to you. Undone, so nothing later sees it.
  begin
    select * into r from public.share_project_with_company(pg_temp.get('p1'), pg_temp.co('NF'));
    perform pg_temp.assert(r.status = 'shared', 'nick shares P1 with his own company, New Frameworks');
    perform pg_temp.assert(public.is_member_of(pg_temp.co('NF'))
      and exists (select 1 from public.collaborators where id = r.grant_id and grantee_company_id = pg_temp.co('NF')),
      'premise: that company grant reaches nick himself');
    perform pg_temp.assert(not (r.grant_id = any (pg_temp.pending())),
      'nick is not notified of a grant he made, even one that reaches him');
    raise exception 'undo' using errcode = 'ZZ001';  -- NOT P0001: that is what pg_temp.assert raises, and catching it would swallow a failed assertion
  exception when sqlstate 'ZZ001' then null;
  end;
end $$;

select pg_temp.act_as('bob');
do $$ begin
  perform pg_temp.assert(cardinality(pg_temp.pending()) = 0,
    'bob, who made every grant on his company''s projects, has no notices');
end $$;

select pg_temp.act_as('henry');
do $$ begin
  perform public.dismiss_share_notices();
  perform pg_temp.assert(
    (select seen_through from public.share_notice_state where user_id = pg_temp.u('henry')) = now(),
    'dismiss_share_notices stores the server''s now()');
  perform pg_temp.assert(cardinality(pg_temp.pending()) = 0, 'and henry then has 0 notices');
  perform pg_temp.assert((select count(*) from public.share_notice_state) = 1,
    'henry reads his own notice state');
end $$;

select pg_temp.act_as('frank');
do $$ begin
  perform pg_temp.assert((select count(*) from public.share_notice_state) = 0,
    'frank cannot read henry''s notice state');
  perform pg_temp.assert(cardinality(pg_temp.pending()) = 2,
    'and henry''s dismissal did not clear frank''s notices');
end $$;

-- seen_through really is compared: an older mark shows the grant again.
reset role;
select set_config('request.jwt.claims', '', true);
set local app.operator = 'on';
update public.share_notice_state set seen_through = now() - interval '1 hour' where user_id = pg_temp.u('henry');
set local app.operator = '';
set local role authenticated;

select pg_temp.act_as('henry');
do $$ begin
  perform pg_temp.assert(pg_temp.same_set(pg_temp.pending(), array[pg_temp.get('g_henry')]),
    'with seen_through an hour back, henry''s P1 grant is news again');
  perform public.dismiss_share_notices();
  perform pg_temp.assert(cardinality(pg_temp.pending()) = 0, 'and dismissing again clears it');
end $$;

-- The Shared list -----------------------------------------------------------
select pg_temp.act_as('bob');
do $$ begin
  perform pg_temp.assert((select count(*) from public.collaborators) = 7,
    'premise: bob, an owner member, sees all 7 grants on his company''s projects');
  perform pg_temp.assert(cardinality(pg_temp.shared_list(pg_temp.co('BI'))) = 0,
    'yet list_shared_projects(Building Integrity) gives bob 0 rows');
  perform pg_temp.assert(cardinality(pg_temp.shared_list(pg_temp.co('SEED'))) = 0,
    'and list_shared_projects(Seed) gives bob 0 rows: grants he can READ are not grants that REACH him');
  perform pg_temp.assert(cardinality(pg_temp.shared_list(pg_temp.co('RF'))) = 0,
    'nor under Rare Forms, which he is not a member of');
end $$;

select pg_temp.act_as('frank');
do $$
declare r record; v_head uuid;
begin
  perform pg_temp.assert(pg_temp.same_set(pg_temp.shared_list(pg_temp.co('RF')), array[pg_temp.get('p1'), pg_temp.get('p2')]),
    'frank acting as Rare Forms: P1 (personal) and P2 (Rare Forms), and not his own company''s project');
  perform pg_temp.assert(pg_temp.same_set(pg_temp.shared_list(pg_temp.co('SEED')), array[pg_temp.get('p1')]),
    'frank acting as Seed: P1 only — P2''s grant belongs to Rare Forms, not listed while acting as another company');
  perform pg_temp.assert(pg_temp.same_set(pg_temp.shared_list(null), array[pg_temp.get('p1')]),
    'with no acting-as company: personal grants only');

  select v.id into v_head from public.project_versions v where v.project_id = pg_temp.get('p1') and v.version_number = 4;
  select * into r from public.list_shared_projects(pg_temp.co('RF')) where project_id = pg_temp.get('p1');
  perform pg_temp.assert(r.name = 'Smith House Shared' and r.folder = 'proposals'
    and r.head_version_number = 4 and r.head_version_id = v_head and r.head_author_name = 'henry@nowhere.test'
    and r.owner_company_id = pg_temp.co('BI') and r.owner_company_name = 'Building Integrity',
    'a Shared row carries the name, the owner''s folder, the head, its author and the owner''s name');
  perform pg_temp.assert(jsonb_array_length(r.reached_via) = 1
    and r.reached_via -> 0 ->> 'via' = 'person'
    and r.reached_via -> 0 ->> 'granted_by_name' = 'Bob Builder',
    'and how it reached him: shared with him by Bob');
  select * into r from public.list_shared_projects(pg_temp.co('RF')) where project_id = pg_temp.get('p2');
  perform pg_temp.assert(r.reached_via -> 0 ->> 'via' = 'company' and r.reached_via -> 0 ->> 'grantee_name' = 'Rare Forms',
    'P2 reached him as "shared with Rare Forms"');
end $$;

select pg_temp.act_as('henry');
do $$ begin
  perform pg_temp.assert(pg_temp.same_set(pg_temp.shared_list(null), array[pg_temp.get('p1')])
    and pg_temp.same_set(pg_temp.shared_list(pg_temp.co('RF')), array[pg_temp.get('p1'), pg_temp.get('p2')]),
    'henry: P1 with no acting-as; P1 and P2 acting as Rare Forms');
end $$;

select pg_temp.act_as('dave');
do $$ begin
  perform pg_temp.assert(pg_temp.same_set(pg_temp.shared_list(pg_temp.co('SEED')), array[pg_temp.get('p1'), pg_temp.get('p3')]),
    'dave acting as Seed: P1 (frank shared it with him) and P3 (shared with Seed)');
end $$;

select pg_temp.act_as('pat');
do $$ begin
  perform pg_temp.assert((select count(*) from public.collaborators) >= 7,
    'premise: pat, a platform admin, reads every grant');
  perform pg_temp.assert(cardinality(pg_temp.shared_list(pg_temp.co('RF'))) = 0,
    'yet gets none listed as shared with Rare Forms: he is not a member of it');
end $$;

do $$ begin
  perform pg_temp.assert(
    pg_get_function_result('public.list_shared_projects(uuid)'::regprocedure) not like '%document%'
    and pg_get_function_result('public.pending_share_notices()'::regprocedure) not like '%document%',
    'neither read function returns the document');
end $$;

-- One project reached two ways is listed once, with both reasons.
select pg_temp.act_as('bob');
do $$
declare r record;
begin
  select * into r from public.share_project_with_person(pg_temp.get('p2'), 'frank@rareforms.test');
  perform pg_temp.assert(r.status = 'shared', 'bob also shares P2 with frank personally');
  perform pg_temp.put('g_frank_p2', r.grant_id);
end $$;

select pg_temp.act_as('frank');
do $$ begin
  perform pg_temp.assert(
    (select count(*) from public.list_shared_projects(pg_temp.co('RF')) where project_id = pg_temp.get('p2')) = 1,
    'P2, reached personally and through Rare Forms, is one row');
  perform pg_temp.assert(
    (select jsonb_array_length(reached_via) = 2
        and reached_via @> '[{"via":"person"}]' and reached_via @> '[{"via":"company"}]'
       from public.list_shared_projects(pg_temp.co('RF')) where project_id = pg_temp.get('p2')),
    'with both reasons');
  perform pg_temp.assert(pg_temp.same_set(pg_temp.shared_list(pg_temp.co('SEED')), array[pg_temp.get('p1'), pg_temp.get('p2')]),
    'and the personal grant lists P2 under any acting-as company');
end $$;

-- ===========================================================================
-- 6. Revocation (answer 13), in the database
-- ===========================================================================
select pg_temp.act_as('frank');
do $$
declare n integer;
begin
  delete from public.collaborators where id = pg_temp.get('g_frank');
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 0, 'REVOKE ONLY YOUR OWN: frank deleting bob''s grant to frank affects 0 rows');
  delete from public.collaborators where id = pg_temp.get('g_rf');
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 0, 'frank deleting bob''s grant to Rare Forms affects 0 rows');
  delete from public.collaborators where id = pg_temp.get('g_carol');
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 0, 'frank deleting nick''s grant to carol affects 0 rows');
  delete from public.collaborators where id = pg_temp.get('g_seed');
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 0, 'frank deleting a grant on a project he cannot read affects 0 rows');
  delete from public.collaborators where id = '00000000-0000-0000-0000-00000000dead';
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 0, 'and a grant that does not exist: the same 0 rows');
end $$;

select pg_temp.act_as('nick');
do $$
declare n integer;
begin
  delete from public.collaborators where id = pg_temp.get('g_nick');
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 0, 'a recipient (nick) cannot remove the grant made to him');
end $$;

select pg_temp.act_as('carol');
do $$
declare n integer;
begin
  delete from public.collaborators where id = pg_temp.get('g_carol');
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 0, 'nor can carol');
end $$;

reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform pg_temp.assert((select count(*) from public.collaborators) = 8,
    'every refused delete left its grant in place (8 grants)');
end $$;
set local role authenticated;

select pg_temp.act_as('frank');
do $$
declare n integer;
begin
  delete from public.collaborators where id = pg_temp.get('g_nick');
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 1, 'frank deleting the grant he made to nick affects 1 row');
end $$;

select pg_temp.act_as('nick');
do $$ begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p1')) = 0, 'nick then reads 0 of P1');
end $$;

select pg_temp.act_as('carol');
do $$ begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p1')) = 1,
    'carol still reads P1: nick''s grant to her is its own row (Open Item 1)');
end $$;

-- An owner member removes a grant a collaborator made; a company admin removes one too.
select pg_temp.act_as('dave');
do $$
declare r record;
begin
  select * into r from public.share_project_with_person(pg_temp.get('p3'), 'frank@rareforms.test');
  perform pg_temp.assert(r.status = 'shared', 'dave (Seed, through the Seed grant) shares P3 with frank');
  perform pg_temp.put('g_frank_p3', r.grant_id);
end $$;

select pg_temp.act_as('frank');
do $$ begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p3')) = 1, 'frank reads P3');
end $$;

select pg_temp.act_as('bob');
do $$
declare n integer; r record;
begin
  delete from public.collaborators where id = pg_temp.get('g_frank_p3');
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 1, 'bob (an ordinary owner member) deletes the grant dave made: 1 row');
  select * into r from public.share_project_with_person(pg_temp.get('p3'), 'fiona@rareforms.test');
  perform pg_temp.assert(r.status = 'shared', 'bob shares P3 with fiona');
  perform pg_temp.put('g_fiona_p3', r.grant_id);
end $$;

select pg_temp.act_as('alice');
do $$
declare n integer;
begin
  delete from public.collaborators where id = pg_temp.get('g_fiona_p3');
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 1, 'alice (the owner company''s admin) deletes bob''s grant: 1 row');
end $$;

select pg_temp.act_as('frank');
do $$ begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p3')) = 0, 'frank reads 0 of P3 once his grant is gone');
end $$;

select pg_temp.act_as('bob');
do $$
declare n integer;
begin
  delete from public.collaborators where id = pg_temp.get('g_frank');
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 1, 'bob deletes his grant to frank on P1');
end $$;

select pg_temp.act_as('frank');
do $$
declare n integer;
begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p1')) = 0 and pg_temp.versions(pg_temp.get('p1')) = 0,
    'frank then reads 0 of P1');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.save_project_version(%L, %L, pg_temp.doc('x'), null) $q$,
      pg_temp.get('p1'), pg_temp.get('p1_v1'))) = '42501',
    'and cannot save to it');
  update public.projects set folder = 'current' where id = pg_temp.get('p1');
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 0, 'nor move it');
  delete from public.collaborators where id = pg_temp.get('g_dave_by_frank');
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 0, 'and, having lost access, cannot remove even a grant he made');

  -- The delete above names a column, so collaborators_select (can_read_project)
  -- already hides the row from it. A delete that names no column is checked by
  -- collaborators_delete alone, so this is what proves the policy's own
  -- can_read_project on the sharer's branch. Undone in case it ever deletes.
  begin
    delete from public.collaborators;
    get diagnostics n = row_count;
    perform pg_temp.assert(n = 0,
      'A SHARER WHO LOST ACCESS REMOVES NOTHING: frank''s unfiltered delete, which only collaborators_delete checks, affects 0 rows (got ' || n || ')');
    raise exception 'undo' using errcode = 'ZZ001';  -- NOT P0001: that is what pg_temp.assert raises
  exception when sqlstate 'ZZ001' then null;
  end;
end $$;

select pg_temp.act_as('carol');
do $$ begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p1')) = 1, 'carol still reads P1 after frank''s removal');
end $$;

select pg_temp.act_as('dave');
do $$ begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p1')) = 1,
    'and dave still reads P1: the grant frank made stays (Open Item 1''s default)');
end $$;

select pg_temp.act_as('bob');
do $$ begin
  perform pg_temp.assert(
    (select granted_by = pg_temp.u('frank') and granted_by_name = 'Frank Framer'
       from public.collaborators where id = pg_temp.get('g_dave_by_frank')),
    'bob''s access list still attributes that grant to frank');
end $$;

select pg_temp.act_as('pat');
do $$
declare n integer;
begin
  delete from public.collaborators where id = pg_temp.get('g_henry');
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 1, 'a platform admin deletes a grant: 1 row');
end $$;

-- ===========================================================================
-- 9. The creator grant (answer 1)
-- ===========================================================================
select pg_temp.act_as('frank');
do $$
declare r record; g record; v_before bigint; v_state text;
begin
  perform pg_temp.assert(not public.is_member_of(pg_temp.co('SEED')) and public.is_seed_entitled(),
    'premise: frank is seed-entitled and not a Seed member');

  -- A refusal here must fail THIS assertion by name, whichever layer refuses:
  -- projects_insert, the missing creator grant, or RETURNING's trap. Only 42501
  -- is caught, and the handler raises through pg_temp.assert.
  begin
    select * into r from public.create_project(pg_temp.co('SEED'), 'current', pg_temp.doc('Frank Seed House'), 'made acting as Seed');
  exception when sqlstate '42501' then
    perform pg_temp.assert(false,
      'SEED-TREE CREATE: frank creates a project in The Seed Collaborative through create_project (got 42501: ' || sqlerrm || ')');
  end;
  perform pg_temp.assert(r.version_number = 1,
    'SEED-TREE CREATE: frank creates a project in The Seed Collaborative through create_project');
  perform pg_temp.put('fs1', r.project_id);

  perform pg_temp.assert(
    (select count(*) from public.collaborators where project_id = r.project_id) = 1,
    'exactly one grant exists on it');
  select * into g from public.collaborators where project_id = r.project_id;
  perform pg_temp.assert(g.kind = 'creator' and g.grantee_user_id = pg_temp.u('frank')
    and g.grantee_company_id is null and g.granted_by is null and g.granted_by_name is null
    and g.grantee_name = 'Frank Framer' and g.created_at = now(),
    'a creator grant naming frank, with no granter');
  perform pg_temp.assert(
    (select company_id = pg_temp.co('SEED') and created_by = pg_temp.u('frank')
       from public.projects where id = r.project_id),
    'owned by The Seed Collaborative; frank is only its creator');

  select * into r from public.save_project_version(pg_temp.get('fs1'), r.version_id, pg_temp.doc('Frank Seed House'), null);
  perform pg_temp.assert(r.version_number = 2, 'and frank saves it again');
  perform pg_temp.assert(public.project_owner_company_name(pg_temp.get('fs1')) = 'The Seed Collaborative',
    'the owner helper names Seed');

  perform pg_temp.assert(
    (select reached_via -> 0 ->> 'via' from public.list_shared_projects(pg_temp.co('SEED')) where project_id = pg_temp.get('fs1')) = 'creator',
    'acting as Seed through the consortium, the Shared list shows it as "you created it"');
  perform pg_temp.assert(pg_temp.get('fs1') = any (pg_temp.shared_list(pg_temp.co('RF')))
    and pg_temp.get('fs1') = any (pg_temp.shared_list(null)),
    'and under Rare Forms, and with no acting-as company');
  perform pg_temp.assert(
    not exists (select 1 from public.pending_share_notices() where project_id = pg_temp.get('fs1')),
    'creator grants are not notified');

  -- A direct insert writes the grant too (no RETURNING).
  insert into public.projects (id, company_id, created_by)
  values ('99999999-0000-0000-0000-0000000000f2', pg_temp.co('SEED'), pg_temp.u('frank'));
  perform pg_temp.put('fs2', '99999999-0000-0000-0000-0000000000f2');
  perform pg_temp.assert(
    (select count(*) from public.collaborators
      where project_id = pg_temp.get('fs2') and kind = 'creator' and grantee_user_id = pg_temp.u('frank')) = 1,
    'a direct projects insert into Seed writes the creator grant too');
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('fs2')) = 1, 'and frank reads that project');

  -- A direct insert … RETURNING still hits the trap. Recorded for 3D: create through create_project.
  v_state := pg_temp.sqlstate_of(format($q$ insert into public.projects (company_id, created_by) values (%L, %L) returning id $q$,
    pg_temp.co('SEED'), pg_temp.u('frank')));
  perform pg_temp.assert(v_state = '42501',
    'a direct insert … returning into Seed fails closed: RETURNING cannot see the AFTER trigger''s grant (got ' || coalesce(v_state, 'success') || ')');

  -- The single-statement CTE still fails closed.
  select count(*) into v_before from public.projects;
  v_state := pg_temp.sqlstate_of(format($q$
    with p as (
      insert into public.projects (company_id, created_by) values (%L, %L) returning id
    )
    insert into public.project_versions (project_id, document)
    select p.id, pg_temp.doc('CTE Seed House') from p
    returning id $q$, pg_temp.co('SEED'), pg_temp.u('frank')));
  perform pg_temp.assert(v_state = '42501',
    'a single-statement project+version create into Seed fails closed with 42501 (got ' || coalesce(v_state, 'success') || ')');
  perform pg_temp.assert((select count(*) from public.projects) = v_before, 'and leaves nothing behind');

  select * into r from public.create_project(pg_temp.co('RF'), 'current', pg_temp.doc('Rare House 2'), null);
  perform pg_temp.put('rf2', r.project_id);
  perform pg_temp.assert(
    (select count(*) from public.collaborators where project_id = r.project_id) = 0,
    'frank creating in his own company, Rare Forms, writes no grant');

  -- fs2 has no versions, so no version guard stands behind projects_delete.
  v_state := pg_temp.sqlstate_of(format($q$ delete from public.projects where id = %L $q$, pg_temp.get('fs2')));
  perform pg_temp.assert(v_state is null and pg_temp.reads(pg_temp.get('fs2')) = 1,
    'NO COLLABORATOR DELETES: frank, holding a creator grant, cannot delete fs2 even though it has no versions (got ' || coalesce(v_state, 'no error') || ')');
end $$;

select pg_temp.act_as('bob');
do $$ begin
  perform pg_temp.assert(public.can_act_as(pg_temp.co('SEED')), 'premise: bob may act as Seed');
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('fs1')) = 0 and pg_temp.versions(pg_temp.get('fs1')) = 0,
    'bob (seed-entitled) reads 0 of frank''s Seed project');
end $$;

select pg_temp.act_as('nick');
do $$ begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('fs1')) = 0, 'nick reads 0 of it');
end $$;

select pg_temp.act_as('dave');
do $$
declare r record;
begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('fs1')) = 1 and pg_temp.versions(pg_temp.get('fs1')) = 2,
    'dave, a Seed member, reads frank''s Seed project and both versions (ownership rule)');
  perform pg_temp.assert(
    (select bool_and(document -> 'state' ? 'priceModifier') from public.project_versions where project_id = pg_temp.get('fs1')),
    'costs included (Open Item 5)');
  select * into r from public.create_project(pg_temp.co('SEED'), 'current', pg_temp.doc('Seed House 2'), null);
  perform pg_temp.put('s2', r.project_id);
  perform pg_temp.assert(
    (select count(*) from public.collaborators where project_id = r.project_id) = 0,
    'dave creating in Seed, his own company, writes no grant');
end $$;

select pg_temp.act_as('carol');
do $$ begin
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.create_project(%L, 'current', pg_temp.doc('X'), null) $q$, pg_temp.co('SEED'))) = '42501',
    'carol, not seed-entitled, cannot create in Seed');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ insert into public.projects (company_id, created_by) values (%L, %L) $q$,
      pg_temp.co('SEED'), pg_temp.u('carol'))) = '42501',
    'nor by a direct insert');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.create_project(%L, 'current', pg_temp.doc('X'), null) $q$, pg_temp.co('RF'))) = '42501',
    'and the consortium branch names only Seed: carol cannot create in Rare Forms');
end $$;

select pg_temp.act_as('nick');
do $$ begin
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.create_project(%L, 'current', pg_temp.doc('X'), null) $q$, pg_temp.co('RF'))) = '42501',
    'nick, seed-entitled, cannot create in Rare Forms: no company but Seed can be named');
end $$;

select pg_temp.act_as('pat');
do $$
declare r record;
begin
  select * into r from public.create_project(pg_temp.co('RF'), 'current', pg_temp.doc('Pat Rare'), null);
  perform pg_temp.put('pat_rf', r.project_id);
  perform pg_temp.assert(
    (select count(*) from public.collaborators where project_id = r.project_id) = 0,
    'pat (platform admin) creating in Rare Forms writes no grant');
  select * into r from public.create_project(pg_temp.co('SEED'), 'current', pg_temp.doc('Pat Seed'), null);
  perform pg_temp.put('pat_seed', r.project_id);
  perform pg_temp.assert(
    (select count(*) from public.collaborators where project_id = r.project_id) = 0,
    'nor in Seed');
end $$;

reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform pg_temp.assert(
    (select count(*) from public.collaborators where kind = 'creator') = 2
    and (select bool_and(grantee_user_id = pg_temp.u('frank')) from public.collaborators where kind = 'creator'),
    'there are exactly two creator grants, both frank''s');
  perform pg_temp.assert(
    (select count(*) from public.projects where company_id = pg_temp.co('SEED')) = 5,
    'and exactly five Seed projects: no refused create left one behind');
end $$;
set local role authenticated;

-- ===========================================================================
-- Across companies — a consortium entitlement alone reads nothing
-- ===========================================================================
do $$
declare who text;
begin
  foreach who in array array['bob', 'gwen', 'nick'] loop
    perform pg_temp.act_as(who);
    perform pg_temp.assert(public.can_act_as(pg_temp.co('SEED')) and not public.is_member_of(pg_temp.co('SEED')),
      'premise: ' || who || ' may act as Seed and is not a Seed member');
    perform pg_temp.assert(
      (select count(*) from public.projects where company_id = pg_temp.co('SEED')) = 0,
      'CONSORTIUM ENTITLEMENT ALONE READS NOTHING: ' || who || ' reads 0 Seed projects');
    perform pg_temp.assert(
      (select count(*) from public.project_versions v
        where v.project_id in (pg_temp.get('s1'), pg_temp.get('s2'), pg_temp.get('fs1'), pg_temp.get('pat_seed'))) = 0,
      'and 0 of their versions');
  end loop;
end $$;

select pg_temp.act_as('frank');
do $$ begin
  perform pg_temp.assert(pg_temp.same_set(
    (select array_agg(id) from public.projects where company_id = pg_temp.co('SEED')),
    array[pg_temp.get('fs1'), pg_temp.get('fs2')]),
    'frank reads exactly the two Seed projects he created, and not dave''s');
end $$;

select pg_temp.act_as('dave');
do $$ begin
  perform pg_temp.assert(
    (select count(*) from public.projects where company_id = pg_temp.co('SEED')) = 5,
    'a Seed member reads all five of Seed''s own projects');
end $$;

-- ===========================================================================
-- Backups (decision 29) — the reads a company backup is built from
-- ===========================================================================
select pg_temp.act_as('frank');
do $$ begin
  perform pg_temp.assert(pg_temp.same_set(
    (select array_agg(id) from public.projects where company_id = pg_temp.co('RF')),
    array[pg_temp.get('rf1'), pg_temp.get('rf2'), pg_temp.get('pat_rf')]),
    'Rare Forms owned phase: its three projects');
  perform pg_temp.assert(pg_temp.same_set(
    (select array_agg(distinct project_id) from public.collaborators where grantee_company_id = pg_temp.co('RF')),
    array[pg_temp.get('p2')]),
    'Rare Forms granted phase: exactly P2, the project shared with Rare Forms — not frank''s personal or creator grants');
  perform pg_temp.assert(
    pg_temp.versions(pg_temp.get('p2')) = (select head_version_number from public.projects where id = pg_temp.get('p2')),
    'and every version of P2 is readable');
end $$;

select pg_temp.act_as('dave');
do $$ begin
  perform pg_temp.assert(
    (select count(*) from public.projects where company_id = pg_temp.co('SEED')
        and id in (pg_temp.get('fs1'), pg_temp.get('fs2'))) = 2,
    'Seed''s owned phase holds frank''s Seed-tree projects (Open Item 2: the owner''s backup)');
  perform pg_temp.assert(pg_temp.same_set(
    (select array_agg(distinct project_id) from public.collaborators where grantee_company_id = pg_temp.co('SEED')),
    array[pg_temp.get('p3')]),
    'Seed''s granted phase: exactly P3 — P1, shared with dave personally, is not in it');
end $$;

select pg_temp.act_as('alice');
do $$ begin
  perform pg_temp.assert(
    (select count(*) from public.projects where company_id = pg_temp.co('BI')
        and id in (pg_temp.get('p1'), pg_temp.get('p2'), pg_temp.get('p3'), pg_temp.get('p4'))) = 4,
    'Building Integrity''s owned phase holds P1–P4, the shared ones included');
  perform pg_temp.assert(
    pg_temp.versions(pg_temp.get('p1')) = 4,
    'with every version of P1, including the ones frank and henry saved');
  perform pg_temp.assert(
    (select count(*) from public.collaborators where grantee_company_id = pg_temp.co('BI')) = 0,
    'and no granted phase: nothing is shared with Building Integrity');
end $$;

select pg_temp.act_as('pat');
do $$ begin
  perform pg_temp.assert(
    (select count(distinct project_id) from public.collaborators where grantee_company_id is not null) = 2,
    'premise: a platform admin reads every company grant (P2 and P3)');
  perform pg_temp.assert(pg_temp.same_set(
    (select array_agg(distinct project_id) from public.collaborators where grantee_company_id = pg_temp.co('RF')),
    array[pg_temp.get('p2')]),
    'THE FILTER IS LOAD-BEARING: filtered to Rare Forms, pat''s granted phase is P2 alone');
end $$;

reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform pg_temp.assert(
    (select count(*) from public.collaborators c join public.projects p on p.id = c.project_id
      where c.grantee_company_id = p.company_id) = 0,
    'no project is both owned by and shared with the same company');
  perform pg_temp.assert(
    (select count(*) from public.collaborators
      where project_id in (pg_temp.get('p1'), pg_temp.get('fs1'), pg_temp.get('fs2'))
        and grantee_company_id is not null) = 0,
    'P1''s personal shares and frank''s creator grants reach no company''s backup: only their owners''');
end $$;
set local role authenticated;

-- ===========================================================================
-- 11. Two-factor
-- ===========================================================================
reset role;
select set_config('request.jwt.claims', '', true);
set local app.operator = 'on';
insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
values (gen_random_uuid(), pg_temp.u('frank'), 'totp', 'verified', now(), now());
set local app.operator = '';
set local role authenticated;

select pg_temp.act_as('frank', 'aal1');
do $$ begin
  perform pg_temp.assert(cardinality(pg_temp.shared_list(pg_temp.co('RF'))) = 0
    and cardinality(pg_temp.shared_list(null)) = 0,
    'frank, with a verified factor at aal1, reads 0 shared projects');
  perform pg_temp.assert((select count(*) from public.collaborators) = 0, 'and 0 grants');
  perform pg_temp.assert(cardinality(pg_temp.pending()) = 0, 'and 0 notices');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.share_project_with_person(%L, 'carol@nonmember.test') $q$, pg_temp.get('p2'))) = '42501',
    'TWO-FACTOR: share_project_with_person raises at aal1');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.share_project_with_company(%L, %L) $q$, pg_temp.get('p2'), pg_temp.co('NF'))) = '42501',
    'share_project_with_company raises at aal1');
  perform pg_temp.assert(pg_temp.sqlstate_of($q$ select public.dismiss_share_notices() $q$) = '42501',
    'dismiss_share_notices raises at aal1');
  perform pg_temp.assert(pg_temp.sqlstate_of($q$ select * from public.shareable_companies() $q$) = '42501',
    'shareable_companies raises at aal1');
  perform pg_temp.assert(public.project_owner_company_name(pg_temp.get('p2')) is null
    and public.project_owner_company_id(pg_temp.get('p2')) is null,
    'and the owner helpers answer null');
end $$;

select pg_temp.act_as('frank', 'aal2');
do $$
declare r record;
begin
  perform pg_temp.assert(pg_temp.get('p2') = any (pg_temp.shared_list(pg_temp.co('RF'))),
    'at aal2 the Shared list returns');
  perform pg_temp.assert((select count(*) from public.collaborators) > 0, 'and the grants');
  select * into r from public.share_project_with_company(pg_temp.get('p2'), pg_temp.co('NF'));
  perform pg_temp.assert(r.status = 'shared', 'and frank shares P2 onward with the company New Frameworks');
  perform pg_temp.put('g_nf', r.grant_id);
  perform pg_temp.assert(
    (select array_agg(name order by name) from public.shareable_companies())
      = array['Building Integrity', 'New Frameworks', 'Rare Forms', 'The Seed Collaborative'],
    'shareable_companies lists the four consortium member companies, and not Nonmember Co');
  perform pg_temp.assert(pg_temp.sqlstate_of($q$ select public.dismiss_share_notices() $q$) is null,
    'dismiss_share_notices works at aal2');
  perform pg_temp.assert(public.project_owner_company_name(pg_temp.get('p2')) = 'Building Integrity',
    'and the owner''s name comes back');
end $$;

reset role;
set local app.operator = 'on';
delete from auth.mfa_factors where user_id = pg_temp.u('frank');
set local app.operator = '';
set local role authenticated;

select pg_temp.act_as('nick');
do $$ begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p2')) = 1,
    'the company grant frank made reaches nick at New Frameworks');
end $$;

-- ===========================================================================
-- 13. Privileges
-- ===========================================================================
reset role;
select set_config('request.jwt.claims', '', true);
do $$
declare t text; p text; fn text;
begin
  foreach t in array array['public.collaborators', 'public.share_notice_state'] loop
    foreach p in array array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger'] loop
      perform pg_temp.assert(not has_table_privilege('anon', t, p), 'anon must hold no ' || p || ' on ' || t);
      perform pg_temp.assert(not has_table_privilege('service_role', t, p), 'service_role must hold no ' || p || ' on ' || t);
    end loop;
    perform pg_temp.assert((select relrowsecurity from pg_class where oid = t::regclass),
      'row level security is enabled on ' || t);
    perform pg_temp.assert(
      exists (select 1 from pg_policy where polrelid = t::regclass and not polpermissive),
      'the restrictive two-factor policy exists on ' || t);
  end loop;

  perform pg_temp.assert(has_table_privilege('authenticated', 'public.collaborators', 'select')
    and has_table_privilege('authenticated', 'public.collaborators', 'delete'),
    'authenticated holds select and delete on collaborators');
  foreach p in array array['insert', 'update', 'truncate', 'references', 'trigger'] loop
    perform pg_temp.assert(not has_table_privilege('authenticated', 'public.collaborators', p),
      'authenticated must hold no ' || p || ' on collaborators');
  end loop;
  perform pg_temp.assert(has_table_privilege('authenticated', 'public.share_notice_state', 'select'),
    'authenticated holds select on share_notice_state');
  foreach p in array array['insert', 'update', 'delete', 'truncate', 'references', 'trigger'] loop
    perform pg_temp.assert(not has_table_privilege('authenticated', 'public.share_notice_state', p),
      'authenticated must hold no ' || p || ' on share_notice_state');
  end loop;

  foreach fn in array array[
    'public.holds_project_grant(uuid)',
    'public.project_owner_company_id(uuid)',
    'public.project_owner_company_name(uuid)',
    'public.share_project_with_person(uuid,text)',
    'public.share_project_with_company(uuid,uuid)',
    'public.shareable_companies()',
    'public.dismiss_share_notices()',
    'public.list_shared_projects(uuid)',
    'public.pending_share_notices()',
    'public.can_read_project(uuid)',
    'public.can_write_project(uuid)',
    'public.create_project(uuid,text,jsonb,text)'
  ] loop
    perform pg_temp.assert(not has_function_privilege('anon', fn, 'execute'), 'anon must not be able to call ' || fn);
    perform pg_temp.assert(has_function_privilege('authenticated', fn, 'execute'), 'authenticated must be able to call ' || fn);
  end loop;
  foreach p in array array['authenticated', 'anon', 'service_role'] loop
    perform pg_temp.assert(not has_function_privilege(p, 'public.grant_creator_access()', 'execute'),
      p || ' must not be able to call grant_creator_access directly');
  end loop;

  perform pg_temp.assert(
    (select bool_and(prosecdef) from pg_proc where oid in (
      'public.holds_project_grant(uuid)'::regprocedure, 'public.project_owner_company_id(uuid)'::regprocedure,
      'public.project_owner_company_name(uuid)'::regprocedure, 'public.share_project_with_person(uuid,text)'::regprocedure,
      'public.share_project_with_company(uuid,uuid)'::regprocedure, 'public.shareable_companies()'::regprocedure,
      'public.dismiss_share_notices()'::regprocedure, 'public.grant_creator_access()'::regprocedure,
      'public.can_read_project(uuid)'::regprocedure, 'public.can_write_project(uuid)'::regprocedure)),
    'the helpers and writers are SECURITY DEFINER');
  perform pg_temp.assert(
    (select bool_and(not prosecdef) from pg_proc where oid in (
      'public.create_project(uuid,text,jsonb,text)'::regprocedure,
      'public.list_shared_projects(uuid)'::regprocedure, 'public.pending_share_notices()'::regprocedure)),
    'create_project and the two read functions are SECURITY INVOKER');

  perform pg_temp.assert(
    (select array_agg(policyname::text order by policyname) from pg_policies where schemaname = 'public' and tablename = 'projects')
      = array['projects_delete', 'projects_insert', 'projects_require_aal', 'projects_select', 'projects_update'],
    'projects still has exactly Stage 2''s five policies, by name');
  perform pg_temp.assert(
    (select count(*) from pg_trigger where not tgisinternal and tgrelid = 'public.projects'::regclass
        and tgname = 'projects_grant_creator') = 1,
    'the creator trigger exists');
end $$;
set local role authenticated;

-- ===========================================================================
-- 10. Deleting accounts — grantees cascade, granters are FK-less
-- ===========================================================================
select pg_temp.act_as('bob');
do $$
declare r record;
begin
  select * into r from public.share_project_with_person(pg_temp.get('p3'), 'nick@newframeworks.test');
  perform pg_temp.assert(r.status = 'shared', 'bob shares P3 with nick');
end $$;

-- From a direct connection with NO operator opt-in and no JWT — the shape of a
-- Supabase dashboard / GoTrue admin delete.
reset role;
select set_config('request.jwt.claims', '', true);
do $$
declare v_state text;
begin
  perform pg_temp.assert(not public.is_privileged_caller(), 'premise: no operator opt-in');
  perform pg_temp.assert(
    (select count(*) from public.collaborators where grantee_user_id = pg_temp.u('nick')) = 1
    and (select count(*) from public.collaborators where granted_by = pg_temp.u('nick')) = 1,
    'premise: nick holds one grant and made one');

  v_state := pg_temp.sqlstate_of(format($q$ delete from auth.users where id = %L $q$, pg_temp.u('nick')));
  perform pg_temp.assert(v_state is null,
    'deleting nick''s account with no operator opt-in SUCCEEDS (got ' || coalesce(v_state, 'success') || ')');
  perform pg_temp.assert(
    (select count(*) from public.collaborators where grantee_user_id = pg_temp.u('nick')) = 0,
    'and removes the grant made TO him (the FK cascade, on an RLS-enabled table)');
  perform pg_temp.assert(
    (select granted_by = pg_temp.u('nick') and granted_by_name = 'Nick New' and grantee_user_id = pg_temp.u('carol')
       from public.collaborators where id = pg_temp.get('g_carol')),
    'the grant nick MADE to carol survives untouched, its granted_by_name intact');
  perform pg_temp.assert(
    (select count(*) from public.collaborators where id = pg_temp.get('g_nf')) = 1,
    'and the grant to his company, New Frameworks, is unaffected by a member''s account going');
end $$;

set local role authenticated;
select pg_temp.act_as('carol');
do $$ begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p1')) = 1, 'carol still reads P1 after nick''s account is deleted');
end $$;

reset role;
select set_config('request.jwt.claims', '', true);
select set_config('stage3test.frank_versions_fp',
  (select md5(string_agg(id::text || author_id::text || author_name || document::text, '|' order by id))
     from public.project_versions where author_id = pg_temp.u('frank')), true);
do $$
declare v_state text;
begin
  perform pg_temp.assert(
    (select count(*) from public.collaborators where grantee_user_id = pg_temp.u('frank')) = 3
    and (select count(*) from public.collaborators where granted_by = pg_temp.u('frank')) = 2,
    'premise: frank holds three grants (P2 personally, two creator grants) and made two (to dave, to New Frameworks)');

  v_state := pg_temp.sqlstate_of(format($q$ delete from auth.users where id = %L $q$, pg_temp.u('frank')));
  perform pg_temp.assert(v_state is null,
    'deleting frank''s account with no operator opt-in SUCCEEDS (got ' || coalesce(v_state, 'success') || ')');
  perform pg_temp.assert(
    (select count(*) from public.collaborators where grantee_user_id = pg_temp.u('frank')) = 0,
    'every grant to frank is gone, both creator grants included');
  perform pg_temp.assert(
    (select count(*) from public.collaborators
      where id in (pg_temp.get('g_dave_by_frank'), pg_temp.get('g_nf'))
        and granted_by = pg_temp.u('frank') and granted_by_name = 'Frank Framer') = 2,
    'NO FK ON granted_by: the grants frank made survive, still naming him');
  perform pg_temp.assert(
    (select count(*) from public.projects
      where id in (pg_temp.get('fs1'), pg_temp.get('fs2'))
        and company_id = pg_temp.co('SEED') and created_by = pg_temp.u('frank')) = 2,
    'his Seed-tree projects stay Seed''s, created_by unchanged');
  perform pg_temp.assert(
    (select md5(string_agg(id::text || author_id::text || author_name || document::text, '|' order by id))
       from public.project_versions where author_id = pg_temp.u('frank'))
      = current_setting('stage3test.frank_versions_fp'),
    'and his versions are byte-identical');
end $$;

set local role authenticated;
select pg_temp.act_as('dave');
do $$ begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p1')) = 1,
    'dave still reads P1 through the grant frank made');
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('fs1')) = 1 and pg_temp.versions(pg_temp.get('fs1')) = 2,
    'and Seed still owns frank''s project');
end $$;

select pg_temp.act_as('bob');
do $$ begin
  perform pg_temp.assert(
    (select granted_by_name from public.collaborators where id = pg_temp.get('g_dave_by_frank')) = 'Frank Framer',
    'bob''s access list still reads "shared by Frank Framer"');
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

do $$ begin
  raise notice 'stage3_rls: ALL ASSERTIONS PASSED';
end $$;

rollback;
