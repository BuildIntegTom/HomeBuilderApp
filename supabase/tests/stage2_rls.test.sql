-- Stage 2 RLS verification — cloud projects and versions (migration 0006).
--
-- Ends with "stage2_rls: ALL ASSERTIONS PASSED" or aborts on the first failure.
--
-- LOCAL OR STAGING ONLY. NEVER THE LIVE PROJECT. Nothing in supabase/tests/ is
-- ever pointed at it. There is a guard below that refuses to run on any
-- database with memberships or projects in it; live has memberships.
--
-- HOW TO RUN (see supabase/README.md, "Stage 2 → Verifying locally"):
--   local_shim.sql, then 0001–0006, then stage1_rls.test.sql AGAIN (it must
--   still pass), then this file. Concurrent saves need two connections and live
--   in the companion script stage2_concurrency.test.sh.
--
-- EVERY ASSERTION RUNS WITHOUT THE OPERATOR OPT-IN, as an ordinary user, unless
-- the assertion is about platform admin or the operator. Both serious Stage 1
-- bugs were invisible to a platform admin, so each rule here is exercised as an
-- ordinary member (bob) AND as an ordinary member of a second company (frank).
--
-- Negative assertions, as in Stage 1: an RLS denial on INSERT raises; a denial
-- on UPDATE or DELETE is silent (zero rows), so those assert on row_count.

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

create or replace function pg_temp.act_as(p_user uuid, p_aal text default 'aal1')
returns void language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text,
    true);
end;
$$;

-- Ids created in one DO block and needed in a later one. Transaction-local
-- settings, so no table (and no grant on one) is needed.
create or replace function pg_temp.put(k text, v uuid)
returns void language sql as $$
  select set_config('stage2test.' || k, v::text, true);
$$;

create or replace function pg_temp.get(k text)
returns uuid language sql as $$
  select nullif(current_setting('stage2test.' || k, true), '')::uuid;
$$;

-- A minimal ProjectFile. priceModifier is present on EVERY fixture document,
-- in every company, because the cross-company assertion is about exactly that
-- field. The value is the app's existing default, not a new number.
create or replace function pg_temp.doc(p_name text, p_schema integer default 24)
returns jsonb language sql as $$
  select jsonb_build_object(
    'schemaVersion', p_schema,
    'savedAt', '2026-09-13T12:00:00.000Z',
    'state', jsonb_build_object(
      'projectName', p_name,
      'priceModifier', 1.3,
      'role', 'public'
    )
  );
$$;

-- Runs a statement and returns the SQLSTATE it raised, or null if it did not.
create or replace function pg_temp.sqlstate_of(p_sql text)
returns text language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlstate;
end;
$$;

-- REFUSE TO RUN ON A DATABASE THAT HAS PEOPLE OR PROJECTS IN IT.
do $$
begin
  if exists (select 1 from public.memberships) then
    raise exception 'stage2_rls.test.sql refuses to run here: this database already has memberships, so it is not a fresh or staging one. Never run supabase/tests/ against the live project.';
  end if;
  if exists (select 1 from public.projects) then
    raise exception 'stage2_rls.test.sql refuses to run here: this database already has projects. Never run supabase/tests/ against the live project.';
  end if;
end $$;

-- ===========================================================================
-- Fixtures (as the owner, which bypasses RLS)
-- ===========================================================================
-- Companies
--   11.. Building Integrity   is_seed_member = true
--   22.. Rare Forms           is_seed_member = true   <- the second company
--   33.. Nonmember Co         is_seed_member = FALSE
--   44.. Seed Collaborative   is_seed_member = true, is_consortium = true
-- People
--   aa.. alice   admin at BI
--   bb.. bob     ordinary member at BI            <- "M"
--   cc.. carol   member at Nonmember Co
--   dd.. dave    member at Seed
--   ee.. erin    admin at BI (so alice is never the last admin)
--   ff.. pat     platform admin, no memberships
--   f1.. frank   ordinary member at Rare Forms    <- "R"
--   f2.. gwen    ordinary member at BOTH BI and Rare Forms
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
  ('f1f1f1f1-0000-0000-0000-000000000001', 'frank@rareforms.test'),
  ('f2f2f2f2-0000-0000-0000-000000000001', 'gwen@both.test');

update public.user_profiles set is_platform_admin = true
 where id = 'ffffffff-0000-0000-0000-000000000001';
update public.user_profiles set display_name = 'Bob Builder'
 where id = 'bbbbbbbb-0000-0000-0000-000000000001';
update public.user_profiles set display_name = 'Alice Admin'
 where id = 'aaaaaaaa-0000-0000-0000-000000000001';

insert into public.companies (id, name, is_seed_member, is_consortium) values
  ('11111111-0000-0000-0000-000000000001', 'Building Integrity',     true,  false),
  ('22222222-0000-0000-0000-000000000001', 'Rare Forms',             true,  false),
  ('33333333-0000-0000-0000-000000000001', 'Nonmember Co',           false, false),
  ('44444444-0000-0000-0000-000000000001', 'The Seed Collaborative', true,  true);

insert into public.memberships (user_id, company_id, level) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'admin'),
  ('eeeeeeee-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'admin'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'member'),
  ('cccccccc-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'member'),
  ('dddddddd-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001', 'member'),
  ('f1f1f1f1-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'member'),
  ('f2f2f2f2-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'member'),
  ('f2f2f2f2-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'member');

set local app.operator = '';
do $$ begin
  perform pg_temp.assert(not public.is_privileged_caller(),
    'the operator opt-in must be off before the assertions start');
end $$;

set local role authenticated;

-- ===========================================================================
-- 1. Create
-- ===========================================================================
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');

do $$
declare r record; v record; p record;
begin
  select * into r from public.create_project(
    '11111111-0000-0000-0000-000000000001', 'current', pg_temp.doc('Smith House'), 'first save');
  perform pg_temp.put('bi_p1', r.project_id);
  perform pg_temp.put('bi_v1', r.version_id);

  perform pg_temp.assert(r.version_number = 1, 'create_project returns version 1');
  perform pg_temp.assert(r.created_at = now(), 'and the server''s created_at');

  select * into v from public.project_versions where id = r.version_id;
  perform pg_temp.assert(v.version_number = 1 and v.parent_version_id is null,
    'version 1 has number 1 and no parent');
  perform pg_temp.assert(v.author_id = 'bbbbbbbb-0000-0000-0000-000000000001',
    'author_id is the caller');
  perform pg_temp.assert(v.author_name = 'Bob Builder',
    'author_name is snapshotted from the caller''s display name');
  perform pg_temp.assert(v.schema_version = 24, 'schema_version is copied from the document');
  perform pg_temp.assert(v.label = 'first save', 'the label is kept');
  perform pg_temp.assert(v.kind = 'save', 'an ordinary save is kind save');

  select * into p from public.projects where id = r.project_id;
  perform pg_temp.assert(p.name = 'Smith House', 'the project name mirrors the document''s projectName');
  perform pg_temp.assert(p.head_version_number = 1, 'head is version 1');
  perform pg_temp.assert(p.updated_at = v.created_at, 'updated_at is the save time');
  perform pg_temp.assert(p.created_by = 'bbbbbbbb-0000-0000-0000-000000000001', 'created_by is the caller');
  perform pg_temp.assert(p.folder = 'current', 'the folder is Current Projects');
end $$;

-- erin has no display name, so her versions fall back to her email.
select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000001');
do $$
declare r record;
begin
  select * into r from public.create_project(
    '11111111-0000-0000-0000-000000000001', 'proposals', pg_temp.doc(''), null);
  perform pg_temp.assert(
    (select author_name from public.project_versions where id = r.version_id) = 'erin@bi.test',
    'with no display name, author_name falls back to the email');
  perform pg_temp.assert(
    (select name from public.projects where id = r.project_id) = '',
    'an empty projectName leaves the row name empty — a visible gap, not a substitute');
  perform pg_temp.assert(
    (select label from public.project_versions where id = r.version_id) is null,
    'no label is stored as null');
end $$;

-- ---------------------------------------------------------------------------
-- insert … returning under RLS — the trap 0005 documents.
-- ---------------------------------------------------------------------------
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');

-- Two statements, as PostgREST would issue them: both RETURNINGs succeed,
-- because projects_select never looks the row up and can_read_project reads a
-- project written by an EARLIER statement.
do $$
declare v_pid uuid; r record;
begin
  insert into public.projects (company_id, created_by)
  values ('11111111-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001')
  returning id into v_pid;
  perform pg_temp.assert(v_pid is not null, 'a member''s direct projects insert … returning succeeds');

  insert into public.project_versions (project_id, document)
  values (v_pid, pg_temp.doc('Direct House'))
  returning id, version_number, author_name into r;
  perform pg_temp.assert(r.version_number = 1 and r.author_name = 'Bob Builder',
    'and a direct versions insert … returning succeeds and sees the trigger-assigned values');
  perform pg_temp.put('bi_p2', v_pid);
  perform pg_temp.put('bi_p2_v1', r.id);
end $$;

-- (The single-statement project+version insert — the one form of insert …
--  returning that hits the trap — is asserted after section 4. See there for
--  why it lives after the cross-company assertions.)

-- ===========================================================================
-- 2. Spoofing is overwritten, not trusted
-- ===========================================================================
do $$
declare r record;
begin
  insert into public.project_versions
    (project_id, parent_version_id, author_id, author_name, created_at, version_number, schema_version, document)
  values (
    pg_temp.get('bi_p2'), pg_temp.get('bi_p2_v1'),
    'aaaaaaaa-0000-0000-0000-000000000001', 'Alice Admin', '2001-01-01', 99, 7,
    pg_temp.doc('Direct House'))
  returning * into r;
  perform pg_temp.assert(r.author_id = 'bbbbbbbb-0000-0000-0000-000000000001',
    'a spoofed author_id is overwritten with the caller');
  perform pg_temp.assert(r.author_name = 'Bob Builder', 'a spoofed author_name is overwritten');
  perform pg_temp.assert(r.created_at = now(), 'a spoofed created_at is overwritten with now()');
  perform pg_temp.assert(r.version_number = 2, 'a spoofed version_number is overwritten with head + 1');
  perform pg_temp.assert(r.schema_version = 24, 'a spoofed schema_version is overwritten from the document');
end $$;

-- ===========================================================================
-- 3. Wrong company
-- ===========================================================================
do $$ begin
  perform pg_temp.assert(
    pg_temp.sqlstate_of($q$ select public.create_project('22222222-0000-0000-0000-000000000001', 'current', pg_temp.doc('X'), null) $q$) = '42501',
    'bob (ordinary BI member) cannot create a project in Rare Forms');
  perform pg_temp.assert(
    pg_temp.sqlstate_of($q$ select public.create_project('44444444-0000-0000-0000-000000000001', 'current', pg_temp.doc('X'), null) $q$) = '42501',
    'bob cannot create in the Seed Collaborative through the consortium entitlement (Stage 3)');
  perform pg_temp.assert(
    pg_temp.sqlstate_of($q$ insert into public.projects (company_id, created_by) values ('22222222-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001') $q$) = '42501',
    'nor by a direct insert');
  perform pg_temp.assert(
    pg_temp.sqlstate_of($q$ insert into public.projects (company_id, created_by) values ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001') $q$) = '42501',
    'a project cannot be created in someone else''s name');
end $$;

-- A direct insert that tries to set every system-maintained column is not
-- refused — it is NORMALISED, by projects_stamp_insert. created_at is immutable
-- afterwards, so a backdated insert that got through would be backdated for
-- good. Inside one subtransaction, so the empty project does not linger.
do $$
declare r record;
begin
  begin
    insert into public.projects (company_id, created_by, name, created_at, updated_at)
    values ('11111111-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
            'Backdated Spoof', '2001-01-01', '2099-01-01')
    returning * into r;
    perform pg_temp.assert(r.created_at = now(), 'a spoofed created_at on a direct projects insert is overwritten with now()');
    perform pg_temp.assert(r.updated_at = now(), 'a spoofed updated_at is overwritten with now()');
    perform pg_temp.assert(r.name = '', 'a spoofed name is overwritten with empty: the name only ever comes from a document');
    perform pg_temp.assert(r.head_version_number = 0, 'a new project starts at head 0');
    raise exception 'undo' using errcode = 'ZZ001';  -- NOT P0001: that is what pg_temp.assert raises, and catching it would swallow a failed assertion
  exception when sqlstate 'ZZ001' then null;
  end;
end $$;

-- A spoofed head. Normalised to 0 by the stamp; if the stamp were ever lost,
-- projects_insert's `head_version_number = 0` check would still refuse it.
-- Either way no project can start life claiming versions it does not have.
do $$
declare v_head integer; v_state text;
begin
  begin
    insert into public.projects (company_id, created_by, head_version_number)
    values ('11111111-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 5)
    returning head_version_number into v_head;
    raise exception 'undo' using errcode = 'ZZ001';  -- NOT P0001: that is what pg_temp.assert raises, and catching it would swallow a failed assertion
  exception
    when sqlstate 'ZZ001' then null;
    when others then v_state := sqlstate;
  end;
  perform pg_temp.assert(v_head = 0 or v_state = '42501',
    'a project cannot start with a head already set (normalised to ' || coalesce(v_head::text, '-') || ', refused ' || coalesce(v_state, '-') || ')');
end $$;

-- And create_project, whose insert passes through the same stamp, still ends at
-- v1 with the name and times the first version gives it.
do $$
declare r record; p record;
begin
  select * into r from public.create_project(
    '11111111-0000-0000-0000-000000000001', 'past', pg_temp.doc('Stamped House'), null);
  select * into p from public.projects where id = r.project_id;
  perform pg_temp.assert(p.head_version_number = 1 and p.name = 'Stamped House',
    'create_project still ends at head 1 named from the document, through the insert stamp');
  perform pg_temp.assert(p.created_at = now() and p.updated_at = r.created_at and p.folder = 'past',
    'and keeps its folder, with created_at and updated_at from the server');
end $$;

select pg_temp.act_as('dddddddd-0000-0000-0000-000000000001');
do $$
declare r record;
begin
  select * into r from public.create_project(
    '44444444-0000-0000-0000-000000000001', 'current', pg_temp.doc('Seed House'), null);
  perform pg_temp.assert(r.version_number = 1, 'dave (a Seed member) can create in Seed');
  perform pg_temp.put('seed_p1', r.project_id);
  perform pg_temp.put('seed_v1', r.version_id);
end $$;

select pg_temp.act_as('f1f1f1f1-0000-0000-0000-000000000001');
do $$
declare r record;
begin
  select * into r from public.create_project(
    '22222222-0000-0000-0000-000000000001', 'current', pg_temp.doc('Rare House'), null);
  perform pg_temp.assert(r.version_number = 1, 'frank (ordinary Rare Forms member) can create in Rare Forms');
  perform pg_temp.put('rf_p1', r.project_id);
  perform pg_temp.put('rf_v1', r.version_id);
  perform pg_temp.assert(
    pg_temp.sqlstate_of($q$ select public.create_project('11111111-0000-0000-0000-000000000001', 'current', pg_temp.doc('X'), null) $q$) = '42501',
    'frank cannot create in Building Integrity');
end $$;

select pg_temp.act_as('cccccccc-0000-0000-0000-000000000001');
do $$
declare r record;
begin
  select * into r from public.create_project(
    '33333333-0000-0000-0000-000000000001', 'current', pg_temp.doc('Outside House'), null);
  perform pg_temp.put('nm_p1', r.project_id);
end $$;

-- ===========================================================================
-- 4. Nothing crosses companies — the margin assertion
-- ===========================================================================
-- Ground truth, counted as the owner.
reset role;
select set_config('request.jwt.claims', '', true);
select set_config('stage2test.bi_versions',
  (select count(*) from public.project_versions v join public.projects p on p.id = v.project_id
    where p.company_id = '11111111-0000-0000-0000-000000000001')::text, true);
select set_config('stage2test.all_versions', (select count(*) from public.project_versions)::text, true);
select set_config('stage2test.all_projects', (select count(*) from public.projects)::text, true);
do $$ begin
  perform pg_temp.assert(current_setting('stage2test.bi_versions')::int >= 4,
    'fixture sanity: there are several BI versions to leak');
  perform pg_temp.assert(
    (select count(*) from public.project_versions
      where document -> 'state' ? 'priceModifier') = current_setting('stage2test.all_versions')::int,
    'fixture sanity: every version, in every company, carries a priceModifier');
end $$;
set local role authenticated;

-- frank: an ordinary member of the SECOND company.
select pg_temp.act_as('f1f1f1f1-0000-0000-0000-000000000001');
do $$ begin
  perform pg_temp.assert(
    (select count(*) from public.projects where company_id = '11111111-0000-0000-0000-000000000001') = 0,
    'frank sees 0 Building Integrity projects');
  perform pg_temp.assert(
    (select count(*) from public.project_versions v where v.project_id in (pg_temp.get('bi_p1'), pg_temp.get('bi_p2'))) = 0,
    'frank sees 0 Building Integrity versions, even naming their ids');
  perform pg_temp.assert(
    (select count(*) from public.projects) = 1,
    'frank sees exactly his own company''s one project, nothing else');
  perform pg_temp.assert(
    (select count(*) from public.project_versions) = 1,
    'and exactly its one version');
  perform pg_temp.assert(
    (select count(*) from public.project_versions where document -> 'state' ? 'priceModifier'
      and project_id <> pg_temp.get('rf_p1')) = 0,
    'frank reads no priceModifier but his own company''s');
  perform pg_temp.assert(not public.can_read_project(pg_temp.get('bi_p1')),
    'can_read_project is false for another company''s project');
  perform pg_temp.assert(not public.can_write_project(pg_temp.get('bi_p1')),
    'can_write_project is false for another company''s project');
end $$;

-- carol: a member of a company outside the consortium.
select pg_temp.act_as('cccccccc-0000-0000-0000-000000000001');
do $$ begin
  perform pg_temp.assert((select count(*) from public.projects) = 1,
    'carol sees only her own company''s project');
  perform pg_temp.assert(
    (select count(*) from public.project_versions v
      join public.projects p on p.id = v.project_id
     where p.company_id <> '33333333-0000-0000-0000-000000000001') = 0,
    'carol sees 0 versions of any other company');
end $$;

-- bob: his own company's versions and nothing else.
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');
do $$ begin
  perform pg_temp.assert(
    (select count(*) from public.project_versions where document -> 'state' ? 'priceModifier')
      = current_setting('stage2test.bi_versions')::int,
    'THE MARGIN ASSERTION: the priceModifier-bearing versions bob can read are exactly the BI versions');
  perform pg_temp.assert(
    (select count(*) from public.projects where id = pg_temp.get('seed_p1')) = 0,
    'bob cannot read dave''s Seed project, though he may act as Seed');
  perform pg_temp.assert(
    (select count(*) from public.project_versions where id = pg_temp.get('seed_v1')) = 0,
    'nor its version');
  perform pg_temp.assert(
    (select count(*) from public.projects where id = pg_temp.get('nm_p1')) = 0,
    'nor carol''s');
end $$;

-- Writing across companies: refused, with ONE message for "not yours" and "does
-- not exist", so a refusal cannot be used to probe for a project id.
do $$
declare m_other text; m_missing text;
begin
  begin
    perform public.save_project_version(pg_temp.get('rf_p1'), pg_temp.get('rf_v1'), pg_temp.doc('Hijack'), null);
  exception when sqlstate '42501' then m_other := sqlerrm;
  end;
  begin
    perform public.save_project_version('00000000-0000-0000-0000-00000000dead', pg_temp.get('rf_v1'), pg_temp.doc('Hijack'), null);
  exception when sqlstate '42501' then m_missing := sqlerrm;
  end;
  perform pg_temp.assert(m_other is not null, 'bob cannot save a version into frank''s Rare Forms project');
  perform pg_temp.assert(m_missing is not null, 'nor into a project that does not exist');
  perform pg_temp.assert(m_other = m_missing,
    'and the two refusals are indistinguishable (' || coalesce(m_other, '?') || ' / ' || coalesce(m_missing, '?') || ')');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ insert into public.project_versions (project_id, parent_version_id, document) values (%L, %L, pg_temp.doc('Hijack')) $q$,
      pg_temp.get('rf_p1'), pg_temp.get('rf_v1'))) = '42501',
    'nor by a direct versions insert');
end $$;

-- gwen: a member of two companies. "Own" means every company you belong to.
select pg_temp.act_as('f2f2f2f2-0000-0000-0000-000000000001');
do $$ begin
  perform pg_temp.assert(
    (select count(distinct company_id) from public.projects) = 2
    and (select count(*) from public.projects where company_id not in
          ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001')) = 0,
    'a member of BI and Rare Forms sees both companies'' projects and no others');
end $$;

-- pat: the one exception.
select pg_temp.act_as('ffffffff-0000-0000-0000-000000000001');
do $$ begin
  perform pg_temp.assert(
    (select count(*) from public.projects) = current_setting('stage2test.all_projects')::int,
    'a platform admin sees every project (already accepted in the spec)');
  perform pg_temp.assert(
    (select count(*) from public.project_versions) = current_setting('stage2test.all_versions')::int,
    'and every version');
end $$;

-- ---------------------------------------------------------------------------
-- insert … returning under RLS, the one form that hits the trap.
-- ---------------------------------------------------------------------------
-- ONE statement that inserts both a project and its version must FAIL CLOSED.
-- The layer that refuses it is project_versions_insert's WITH CHECK: its
-- can_write_project cannot see a project row written by the same command. The
-- BEFORE INSERT trigger's own call runs in a later snapshot and DOES see it, so
-- this is an RLS refusal alone.
--
-- Deliberately placed AFTER the cross-company assertions above. With RLS off
-- on project_versions this assertion fails too, but the failure that should
-- name that mutation is "frank sees Building Integrity's versions" — the
-- actual leak — so the leak is checked first. The document carries a
-- priceModifier like every other fixture.
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');
do $$
declare v_before bigint; v_state text;
begin
  select count(*) into v_before from public.projects;
  v_state := pg_temp.sqlstate_of($q$
    with p as (
      insert into public.projects (company_id, created_by)
      values ('11111111-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001')
      returning id
    )
    insert into public.project_versions (project_id, document)
    select p.id, pg_temp.doc('CTE House') from p
    returning id
  $q$);
  perform pg_temp.assert(v_state = '42501',
    'a single-statement project+version insert fails closed with 42501 (got ' || coalesce(v_state, 'success') || ')');
  perform pg_temp.assert((select count(*) from public.projects) = v_before,
    'and leaves no half-created project behind');
end $$;

-- ===========================================================================
-- 5. Append-only
-- ===========================================================================
do $$ begin
  perform pg_temp.assert(
    not has_table_privilege('authenticated', 'public.project_versions', 'update'),
    'authenticated holds no UPDATE privilege on project_versions');
end $$;

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');
do $$ begin
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ update public.project_versions set document = '{}'::jsonb where id = %L $q$, pg_temp.get('bi_v1'))) is not null,
    'bob (ordinary member, the author) cannot update a version''s document');
end $$;

select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
do $$ begin
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ update public.project_versions set label = 'edited' where id = %L $q$, pg_temp.get('bi_v1'))) is not null,
    'alice (company admin) cannot update a version''s label');
end $$;

select pg_temp.act_as('ffffffff-0000-0000-0000-000000000001');
do $$ begin
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ update public.project_versions set created_at = '2001-01-01' where id = %L $q$, pg_temp.get('bi_v1'))) is not null,
    'pat (platform admin) cannot update a version''s created_at');
end $$;

-- A direct connection with the operator opt-in — the most powerful caller this
-- schema knows. It holds every table privilege, so ONLY the trigger stands in
-- its way here. This is the assertion that fails if trigger 3 is dropped.
reset role;
select set_config('request.jwt.claims', '', true);
set local app.operator = 'on';
do $$
declare v_state text;
begin
  v_state := pg_temp.sqlstate_of(format($q$ update public.project_versions set document = '{}'::jsonb where id = %L $q$, pg_temp.get('bi_v1')));
  perform pg_temp.assert(v_state = '42501',
    'APPEND-ONLY: even an operator on a direct connection cannot update a version (got ' || coalesce(v_state, 'success') || ')');
  v_state := pg_temp.sqlstate_of(format($q$ update public.project_versions set label = 'edited' where id = %L $q$, pg_temp.get('bi_v1')));
  perform pg_temp.assert(v_state = '42501', 'nor its label');
  perform pg_temp.assert(
    (select document = pg_temp.doc('Smith House') and label = 'first save'
       from public.project_versions where id = pg_temp.get('bi_v1')),
    'and version 1 is exactly as saved');
end $$;

-- TRUNCATE fires no row trigger and ignores RLS, so append-only needs its own
-- statement-level guard. The owner holds TRUNCATE by definition; only the
-- trigger stands in the way. (A plain `truncate projects` is stopped by the
-- foreign key before any trigger fires, so the CASCADE form — which reaches
-- both tables — is the one that proves the triggers.)
do $$
declare v_state text; v_versions bigint; v_projects bigint;
begin
  select count(*) into v_versions from public.project_versions;
  select count(*) into v_projects from public.projects;

  v_state := pg_temp.sqlstate_of($q$ truncate public.project_versions $q$);
  perform pg_temp.assert(v_state = '42501',
    'APPEND-ONLY: even an operator cannot TRUNCATE project_versions (got ' || coalesce(v_state, 'success') || ')');

  v_state := pg_temp.sqlstate_of($q$ truncate public.projects cascade $q$);
  perform pg_temp.assert(v_state = '42501',
    'nor TRUNCATE projects with CASCADE (got ' || coalesce(v_state, 'success') || ')');

  perform pg_temp.assert(pg_temp.sqlstate_of($q$ truncate public.projects $q$) is not null,
    'nor plain TRUNCATE projects');

  perform pg_temp.assert(
    (select count(*) from public.project_versions) = v_versions
    and (select count(*) from public.projects) = v_projects,
    'and every project and version is still there');
end $$;
set local app.operator = '';

do $$ begin
  perform pg_temp.assert(
    pg_temp.sqlstate_of($q$ truncate public.project_versions $q$) = '42501',
    'and the owner with no operator opt-in cannot TRUNCATE project_versions either');
end $$;
set local role authenticated;

-- ===========================================================================
-- 6. Delete — the cascade-versus-direct depth check
-- ===========================================================================
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');
do $$
declare n integer;
begin
  delete from public.project_versions where id = pg_temp.get('bi_v1');
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 0, 'a direct version DELETE by bob affects 0 rows');
  delete from public.projects where id = pg_temp.get('bi_p1');
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 0, 'a project DELETE by bob affects 0 rows (archive, never delete)');
end $$;

select pg_temp.act_as('f1f1f1f1-0000-0000-0000-000000000001');
do $$
declare n integer;
begin
  delete from public.projects where id = pg_temp.get('bi_p1');
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 0, 'a project DELETE by frank, of another company''s project, affects 0 rows');
  delete from public.projects where id = pg_temp.get('rf_p1');
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 0, 'nor of his own company''s project');
end $$;

select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
do $$
declare n integer;
begin
  delete from public.projects where id = pg_temp.get('bi_p1');
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 0, 'a project DELETE by alice (company admin) affects 0 rows');
end $$;

select pg_temp.act_as('ffffffff-0000-0000-0000-000000000001');
do $$
declare v_state text; n integer;
begin
  v_state := pg_temp.sqlstate_of(format($q$ delete from public.project_versions where id = %L $q$, pg_temp.get('bi_p2_v1')));
  perform pg_temp.assert(v_state = '42501',
    'a DIRECT single-version delete raises even for a platform admin — not a Stage 2 operation (got ' || coalesce(v_state, 'success') || ')');

  delete from public.projects where id = pg_temp.get('bi_p2');
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 1, 'a platform admin deletes a whole project');
  perform pg_temp.assert(
    (select count(*) from public.project_versions where project_id = pg_temp.get('bi_p2')) = 0,
    'and its versions go with it: the cascade, a v1 and a v2 whose parent is that v1, in one statement');
end $$;

-- The depth check alone is not the permission. A cascade from a caller who is
-- NOT privileged — the owner on a direct connection with no opt-in, the shape
-- of a dashboard or GoTrue delete — is still refused.
reset role;
select set_config('request.jwt.claims', '', true);
do $$
declare v_state text;
begin
  v_state := pg_temp.sqlstate_of(format($q$ delete from public.projects where id = %L $q$, pg_temp.get('nm_p1')));
  perform pg_temp.assert(v_state = '42501',
    'a cascade from an unprivileged direct connection is refused by the version guard (got ' || coalesce(v_state, 'success') || ')');
  perform pg_temp.assert((select count(*) from public.projects where id = pg_temp.get('nm_p1')) = 1,
    'and the project survives');
end $$;
set local role authenticated;

-- ===========================================================================
-- 7. Columns
-- ===========================================================================
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');
do $$
declare n integer; v_versions bigint;
begin
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ update public.projects set name = 'Renamed' where id = %L $q$, pg_temp.get('bi_p1'))) = '42501',
    'bob cannot set a project''s name directly');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ update public.projects set head_version_number = 9 where id = %L $q$, pg_temp.get('bi_p1'))) = '42501',
    'bob cannot set head_version_number');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ update public.projects set updated_at = '2001-01-01' where id = %L $q$, pg_temp.get('bi_p1'))) = '42501',
    'bob cannot set updated_at');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ update public.projects set company_id = '22222222-0000-0000-0000-000000000001' where id = %L $q$, pg_temp.get('bi_p1'))) = '42501',
    'bob cannot move a project to another company');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ update public.projects set created_by = 'aaaaaaaa-0000-0000-0000-000000000001' where id = %L $q$, pg_temp.get('bi_p1'))) = '42501',
    'bob cannot rewrite created_by');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ update public.projects set created_at = '2001-01-01' where id = %L $q$, pg_temp.get('bi_p1'))) = '42501',
    'bob cannot rewrite created_at');

  select count(*) into v_versions from public.project_versions where project_id = pg_temp.get('bi_p1');
  update public.projects set folder = 'past' where id = pg_temp.get('bi_p1');
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 1, 'bob moves his company''s project to Past Projects: 1 row');
  perform pg_temp.assert(
    (select name = 'Smith House' and head_version_number = 1 from public.projects where id = pg_temp.get('bi_p1')),
    'a folder move changes nothing else');
  perform pg_temp.assert(
    (select count(*) from public.project_versions where project_id = pg_temp.get('bi_p1')) = v_versions,
    'and creates no version');
  update public.projects set folder = 'current' where id = pg_temp.get('bi_p1');

  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ update public.projects set folder = 'archive' where id = %L $q$, pg_temp.get('bi_p1'))) = '23514',
    'folder = archive is not a folder');
end $$;

select pg_temp.act_as('f1f1f1f1-0000-0000-0000-000000000001');
do $$
declare n integer;
begin
  update public.projects set folder = 'past' where id = pg_temp.get('bi_p1');
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 0, 'frank changing a BI project''s folder affects 0 rows');
end $$;

-- gwen belongs to both companies, so RLS alone would let this through. Only the
-- column guard stops her moving a project from one of her companies to the other.
select pg_temp.act_as('f2f2f2f2-0000-0000-0000-000000000001');
do $$ begin
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ update public.projects set company_id = '11111111-0000-0000-0000-000000000001' where id = %L $q$, pg_temp.get('rf_p1'))) = '42501',
    'a member of two companies cannot move a project between them');
  perform pg_temp.assert(
    (select company_id from public.projects where id = pg_temp.get('rf_p1')) = '22222222-0000-0000-0000-000000000001',
    'and it is still Rare Forms''');
end $$;

-- ===========================================================================
-- 8. Lineage
-- ===========================================================================
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');
do $$
declare r record; v_state text;
begin
  select * into r from public.create_project(
    '11111111-0000-0000-0000-000000000001', 'current', pg_temp.doc('Other House'), null);
  perform pg_temp.put('bi_p3_v1', r.version_id);

  v_state := pg_temp.sqlstate_of(format($q$ select public.save_project_version(%L, %L, pg_temp.doc('Smith House'), null) $q$,
    pg_temp.get('bi_p1'), pg_temp.get('bi_p3_v1')));
  perform pg_temp.assert(v_state = '23514', 'a parent from another project of the same company is refused (got ' || coalesce(v_state, 'success') || ')');

  v_state := pg_temp.sqlstate_of(format($q$ select public.save_project_version(%L, %L, pg_temp.doc('Smith House'), null) $q$,
    pg_temp.get('bi_p1'), pg_temp.get('rf_v1')));
  perform pg_temp.assert(v_state = '23514', 'a parent version from a project the caller cannot read is refused (got ' || coalesce(v_state, 'success') || ')');

  v_state := pg_temp.sqlstate_of(format($q$ select public.save_project_version(%L, '00000000-0000-0000-0000-00000000beef', pg_temp.doc('Smith House'), null) $q$,
    pg_temp.get('bi_p1')));
  perform pg_temp.assert(v_state = '23514', 'a parent that does not exist is refused');

  v_state := pg_temp.sqlstate_of(format($q$ select public.save_project_version(%L, null, pg_temp.doc('Smith House'), null) $q$,
    pg_temp.get('bi_p1')));
  perform pg_temp.assert(v_state = '23514', 'a null parent on a project that has versions is refused (got ' || coalesce(v_state, 'success') || ')');

  -- A non-null parent on version 1: a fresh project row, then a first version
  -- naming a parent. Both statements inside one subtransaction, so the refused
  -- attempt leaves no empty project behind.
  v_state := null;
  begin
    insert into public.projects (id, company_id, created_by)
    values ('00000000-0000-0000-0000-0000000000f1', '11111111-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001');
    insert into public.project_versions (project_id, parent_version_id, document)
    values ('00000000-0000-0000-0000-0000000000f1', pg_temp.get('bi_v1'), pg_temp.doc('Orphan'));
  exception when others then v_state := sqlstate;
  end;
  perform pg_temp.assert(v_state = '23514', 'a non-null parent on version 1 is refused (got ' || coalesce(v_state, 'success') || ')');

  perform pg_temp.assert(
    (select head_version_number from public.projects where id = pg_temp.get('bi_p1')) = 1,
    'no refused save consumed a version number');
end $$;

-- ===========================================================================
-- 9. Divergence
-- ===========================================================================
do $$
declare r record;
begin
  select * into r from public.save_project_version(pg_temp.get('bi_p1'), pg_temp.get('bi_v1'), pg_temp.doc('Smith House'), null);
  perform pg_temp.assert(r.version_number = 2 and r.head_before = 1 and not r.diverged,
    'bob saves from v1 -> v2, not diverged');
  perform pg_temp.put('bi_v2', r.version_id);
end $$;

select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
do $$
declare r record;
begin
  select * into r from public.save_project_version(pg_temp.get('bi_p1'), pg_temp.get('bi_v1'), pg_temp.doc('Smith House'), 'alice''s take');
  perform pg_temp.assert(r.version_number = 3 and r.head_before = 2 and r.diverged,
    'alice saves from v1 -> v3, diverged, head_before 2');
  perform pg_temp.assert(
    (select author_name from public.project_versions where id = r.version_id) = 'Alice Admin',
    'and v3 is attributed to alice');
end $$;

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');
do $$
declare r record;
begin
  select * into r from public.save_project_version(pg_temp.get('bi_p1'), pg_temp.get('bi_v2'), pg_temp.doc('Smith House'), null);
  perform pg_temp.assert(r.version_number = 4 and r.head_before = 3 and r.diverged,
    'bob saves from v2 -> v4, diverged');
  perform pg_temp.put('bi_v4', r.version_id);

  select * into r from public.save_project_version(pg_temp.get('bi_p1'), pg_temp.get('bi_v4'), pg_temp.doc('Smith House'), null);
  perform pg_temp.assert(r.version_number = 5 and r.head_before = 4 and not r.diverged,
    'bob saves from v4 -> v5, not diverged: your own consecutive saves never trigger the notice');
  perform pg_temp.put('bi_v5', r.version_id);

  perform pg_temp.assert(
    (select count(*) from public.project_versions where project_id = pg_temp.get('bi_p1')) = 5,
    'every save was kept: nothing overwritten, no merge');
end $$;

-- A stale tab saving an older-format document is accepted and keeps its own
-- schema_version (spec, "Opening a version, and older app versions").
do $$
declare r record;
begin
  select * into r from public.create_project(
    '11111111-0000-0000-0000-000000000001', 'current', pg_temp.doc('Old Tab House', 23), null);
  perform pg_temp.assert(
    (select schema_version from public.project_versions where id = r.version_id) = 23,
    'an older-format document is stored with its own schema_version');
end $$;

-- ===========================================================================
-- 10. Rename
-- ===========================================================================
do $$
declare r record; v_before text; v_rename record; v_parent record;
begin
  select string_agg(document::text, '|' order by version_number) into v_before
    from public.project_versions where project_id = pg_temp.get('bi_p1');

  select * into r from public.rename_project(pg_temp.get('bi_p1'), '  Smith Residence ');
  perform pg_temp.assert(r.version_number = 6, 'rename appends a version (v6)');

  select * into v_rename from public.project_versions where id = r.version_id;
  select * into v_parent from public.project_versions where id = pg_temp.get('bi_v5');
  perform pg_temp.assert(v_rename.kind = 'rename', 'the rename version is kind rename');
  perform pg_temp.assert(v_rename.parent_version_id = v_parent.id, 'its parent is the head it renamed');
  perform pg_temp.assert(
    v_rename.document = jsonb_set(v_parent.document, '{state,projectName}', '"Smith Residence"'),
    'only state.projectName differs from the parent''s document');
  perform pg_temp.assert(v_rename.document <> v_parent.document, 'and it does differ');
  perform pg_temp.assert(
    (select string_agg(document::text, '|' order by version_number)
       from public.project_versions
      where project_id = pg_temp.get('bi_p1') and version_number <= 5) = v_before,
    'every earlier document is byte-identical');
  perform pg_temp.assert(
    (select name from public.projects where id = pg_temp.get('bi_p1')) = 'Smith Residence',
    'the row name follows the rename');

  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.rename_project(%L, '   ') $q$, pg_temp.get('bi_p1'))) = '22023',
    'a blank name is refused');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.rename_project(%L, repeat('n', 201)) $q$, pg_temp.get('bi_p1'))) = '22023',
    'a 201-character name is refused');

  -- A following save of an old-name document sets the row name back.
  select * into r from public.save_project_version(pg_temp.get('bi_p1'), v_rename.id, pg_temp.doc('Smith House'), null);
  perform pg_temp.assert(r.version_number = 7 and not r.diverged, 'a save after the rename is v7');
  perform pg_temp.assert(
    (select name from public.projects where id = pg_temp.get('bi_p1')) = 'Smith House',
    'and a save of an old-name document sets the row name back — the row follows the document');
end $$;

select pg_temp.act_as('f1f1f1f1-0000-0000-0000-000000000001');
do $$
declare v_state text;
begin
  v_state := pg_temp.sqlstate_of(format($q$ select public.rename_project(%L, 'Frank''s Now') $q$, pg_temp.get('bi_p1')));
  perform pg_temp.assert(v_state = '42501', 'frank cannot rename a BI project (got ' || coalesce(v_state, 'success') || ')');
end $$;

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');
do $$ begin
  perform pg_temp.assert(
    (select name from public.projects where id = pg_temp.get('bi_p1')) = 'Smith House'
    and (select head_version_number from public.projects where id = pg_temp.get('bi_p1')) = 7,
    'frank''s refused rename changed nothing');
end $$;

-- ===========================================================================
-- 14. Validation
-- ===========================================================================
do $$
declare v_before bigint; v_state text;
begin
  select count(*) into v_before from public.projects;

  v_state := pg_temp.sqlstate_of($q$ select public.create_project('11111111-0000-0000-0000-000000000001', 'current', '[1,2]'::jsonb, null) $q$);
  perform pg_temp.assert(v_state = '23514', 'a non-object document is refused (got ' || coalesce(v_state, 'success') || ')');

  v_state := pg_temp.sqlstate_of($q$ select public.create_project('11111111-0000-0000-0000-000000000001', 'current', '{"state":{"projectName":"No Version"}}'::jsonb, null) $q$);
  perform pg_temp.assert(v_state = '23514', 'a document with no schemaVersion is refused');

  v_state := pg_temp.sqlstate_of($q$ select public.create_project('11111111-0000-0000-0000-000000000001', 'current', '{"schemaVersion":"24","state":{}}'::jsonb, null) $q$);
  perform pg_temp.assert(v_state = '23514', 'a string schemaVersion is refused');

  v_state := pg_temp.sqlstate_of($q$ select public.create_project('11111111-0000-0000-0000-000000000001', 'current', '{"schemaVersion":24.5,"state":{}}'::jsonb, null) $q$);
  perform pg_temp.assert(v_state = '23514', 'a fractional schemaVersion is refused');

  v_state := pg_temp.sqlstate_of($q$ select public.create_project('11111111-0000-0000-0000-000000000001', 'current', '{"schemaVersion":24}'::jsonb, null) $q$);
  perform pg_temp.assert(v_state = '23514', 'a document with no state object is refused');

  v_state := pg_temp.sqlstate_of($q$ select public.create_project('11111111-0000-0000-0000-000000000001', 'current',
    jsonb_build_object('schemaVersion', 24, 'state', jsonb_build_object('projectName', 'Big', 'padding', repeat('x', 4 * 1024 * 1024))), null) $q$);
  perform pg_temp.assert(v_state = '23514', 'a document over 4 MB is refused (got ' || coalesce(v_state, 'success') || ')');

  perform pg_temp.assert(
    (select count(*) from public.projects) = v_before,
    'and create_project is atomic: no refused document left an empty project behind');
end $$;

-- ===========================================================================
-- 12. Two-factor
-- ===========================================================================
reset role;
select set_config('request.jwt.claims', '', true);
set local app.operator = 'on';
insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
values (gen_random_uuid(), 'bbbbbbbb-0000-0000-0000-000000000001', 'totp', 'verified', now(), now());
set local app.operator = '';
set local role authenticated;

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001', 'aal1');
do $$ begin
  perform pg_temp.assert((select count(*) from public.projects) = 0,
    'bob with a verified factor at aal1 reads 0 projects');
  perform pg_temp.assert((select count(*) from public.project_versions) = 0,
    'and 0 versions');
  perform pg_temp.assert(
    pg_temp.sqlstate_of($q$ select public.create_project('11111111-0000-0000-0000-000000000001', 'current', pg_temp.doc('Password Only'), null) $q$) = '42501',
    'and cannot create a project');
end $$;

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001', 'aal2');
do $$ begin
  perform pg_temp.assert((select count(*) from public.projects where id = pg_temp.get('bi_p1')) = 1,
    'at aal2 he reads his company''s projects again');
  perform pg_temp.assert((select count(*) from public.project_versions where project_id = pg_temp.get('bi_p1')) = 7,
    'and their versions');
end $$;

reset role;
set local app.operator = 'on';
delete from auth.mfa_factors where user_id = 'bbbbbbbb-0000-0000-0000-000000000001';
set local app.operator = '';
set local role authenticated;

-- ===========================================================================
-- 11. Leaver attribution (decision 6)
-- ===========================================================================
reset role;
select set_config('request.jwt.claims', '', true);
set local app.operator = 'on';
delete from public.memberships
 where user_id = 'bbbbbbbb-0000-0000-0000-000000000001'
   and company_id = '11111111-0000-0000-0000-000000000001';
set local app.operator = '';
set local role authenticated;

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');
do $$ begin
  perform pg_temp.assert(
    (select count(*) from public.projects where company_id = '11111111-0000-0000-0000-000000000001') = 0,
    'a revoked member sees 0 of the company''s projects on the next request');
  perform pg_temp.assert((select count(*) from public.project_versions) = 0,
    'and 0 versions');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.save_project_version(%L, %L, pg_temp.doc('Smith House'), null) $q$,
      pg_temp.get('bi_p1'), pg_temp.get('bi_v5'))) = '42501',
    'and can no longer save to it');
end $$;

select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
do $$ begin
  perform pg_temp.assert(
    (select count(*) from public.user_profiles where id = 'bbbbbbbb-0000-0000-0000-000000000001') = 0,
    'fixture premise: user_profiles_select no longer shows alice bob''s profile');
  perform pg_temp.assert(
    (select count(*) from public.project_versions
      where author_id = 'bbbbbbbb-0000-0000-0000-000000000001') >= 4,
    'alice still reads bob''s versions of her company''s project');
  perform pg_temp.assert(
    (select bool_and(author_name = 'Bob Builder') from public.project_versions
      where author_id = 'bbbbbbbb-0000-0000-0000-000000000001'),
    'LEAVER ATTRIBUTION: alice still reads bob''s name on every one of his versions');
  -- Why the snapshot exists: the join-on-read a version list would otherwise
  -- use now comes back blank.
  perform pg_temp.assert(
    (select bool_and(up.display_name is null)
       from public.project_versions v
       left join public.user_profiles up on up.id = v.author_id
      where v.author_id = 'bbbbbbbb-0000-0000-0000-000000000001'),
    'and a join on user_profiles would have shown her nothing');
end $$;

-- Deleting a person entirely. bob CREATED bi_p1 and AUTHORED several of its
-- versions. author_id and created_by are plain uuids with no foreign key, so
-- deleting his auth user touches neither table: nothing is updated, nothing is
-- refused, and his versions keep his uuid and his name exactly as saved.
--
-- Done from a direct connection with NO operator opt-in and no JWT — the shape
-- of a Supabase dashboard / GoTrue admin delete. (This used to be refused: the
-- old ON DELETE SET NULL foreign keys turned the deletion into UPDATEs that the
-- append-only trigger and the project column guard both refuse.)
reset role;
select set_config('request.jwt.claims', '', true);
select set_config('stage2test.bob_versions_fp',
  (select md5(string_agg(id::text || author_id::text || author_name || created_at::text || document::text, '|' order by id))
     from public.project_versions where author_id = 'bbbbbbbb-0000-0000-0000-000000000001'), true);
select set_config('stage2test.bob_projects_fp',
  (select md5(string_agg(p::text, '|' order by id))
     from public.projects p where created_by = 'bbbbbbbb-0000-0000-0000-000000000001'), true);
do $$
declare v_state text;
begin
  perform pg_temp.assert(not public.is_privileged_caller(),
    'fixture premise: this delete is attempted with no operator opt-in');
  perform pg_temp.assert(
    (select count(*) from public.projects where created_by = 'bbbbbbbb-0000-0000-0000-000000000001') >= 1
    and (select count(*) from public.project_versions where author_id = 'bbbbbbbb-0000-0000-0000-000000000001') >= 4,
    'fixture premise: bob created a project and authored versions');

  v_state := pg_temp.sqlstate_of($q$ delete from auth.users where id = 'bbbbbbbb-0000-0000-0000-000000000001' $q$);
  perform pg_temp.assert(v_state is null,
    'deleting the auth user of someone who created a project and authored versions SUCCEEDS (got ' || coalesce(v_state, 'success') || ')');
  perform pg_temp.assert(
    (select count(*) from auth.users where id = 'bbbbbbbb-0000-0000-0000-000000000001') = 0
    and (select count(*) from public.user_profiles where id = 'bbbbbbbb-0000-0000-0000-000000000001') = 0,
    'and the account and its profile are really gone');
  perform pg_temp.assert(
    (select md5(string_agg(id::text || author_id::text || author_name || created_at::text || document::text, '|' order by id))
       from public.project_versions where author_id = 'bbbbbbbb-0000-0000-0000-000000000001')
      = current_setting('stage2test.bob_versions_fp'),
    'his versions survive untouched: same rows, same author_id, same author_name snapshot, same time, same document');
  perform pg_temp.assert(
    (select md5(string_agg(p::text, '|' order by id))
       from public.projects p where created_by = 'bbbbbbbb-0000-0000-0000-000000000001')
      = current_setting('stage2test.bob_projects_fp'),
    'and the project he created is untouched, created_by included');
end $$;

set local role authenticated;
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
do $$ begin
  perform pg_temp.assert(
    (select bool_and(author_name = 'Bob Builder') and count(*) >= 4
       from public.project_versions where author_id = 'bbbbbbbb-0000-0000-0000-000000000001'),
    'alice still reads bob''s name on every one of his versions after his account is deleted');
end $$;
reset role;
select set_config('request.jwt.claims', '', true);

-- ===========================================================================
-- 13. Grants
-- ===========================================================================
do $$
declare t text; p text; fn text;
begin
  foreach t in array array['public.projects', 'public.project_versions'] loop
    foreach p in array array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger'] loop
      perform pg_temp.assert(not has_table_privilege('anon', t, p),
        'anon must hold no ' || p || ' on ' || t);
      -- service_role bypasses RLS. No Stage 2 route may use it, so it holds
      -- nothing — the grants really are exactly what is intended.
      perform pg_temp.assert(not has_table_privilege('service_role', t, p),
        'service_role must hold no ' || p || ' on ' || t);
    end loop;
    perform pg_temp.assert(
      (select count(*) from pg_trigger
        where tgrelid = t::regclass and not tgisinternal
          and (tgtype & 32) <> 0          -- TRUNCATE
          and (tgtype & 2) <> 0) = 1,     -- BEFORE
      'exactly one BEFORE TRUNCATE guard exists on ' || t);
    foreach p in array array['truncate', 'references', 'trigger'] loop
      perform pg_temp.assert(not has_table_privilege('authenticated', t, p),
        'authenticated must hold no ' || p || ' on ' || t);
    end loop;
    perform pg_temp.assert(
      (select relrowsecurity from pg_class where oid = t::regclass),
      'row level security is enabled on ' || t);
    perform pg_temp.assert(
      exists (select 1 from pg_policy where polrelid = t::regclass and not polpermissive),
      'the restrictive two-factor policy exists on ' || t);
  end loop;

  foreach p in array array['select', 'insert', 'update', 'delete'] loop
    perform pg_temp.assert(has_table_privilege('authenticated', 'public.projects', p),
      'authenticated holds ' || p || ' on projects');
  end loop;
  foreach p in array array['select', 'insert', 'delete'] loop
    perform pg_temp.assert(has_table_privilege('authenticated', 'public.project_versions', p),
      'authenticated holds ' || p || ' on project_versions');
  end loop;

  foreach fn in array array[
    'public.can_read_project(uuid)',
    'public.can_write_project(uuid)',
    'public.create_project(uuid,text,jsonb,text)',
    'public.save_project_version(uuid,uuid,jsonb,text)',
    'public.rename_project(uuid,text)'
  ] loop
    perform pg_temp.assert(not has_function_privilege('anon', fn, 'execute'),
      'anon must not be able to call ' || fn);
    perform pg_temp.assert(has_function_privilege('authenticated', fn, 'execute'),
      'authenticated must be able to call ' || fn);
  end loop;

  perform pg_temp.assert(
    (select prosecdef from pg_proc where oid = 'public.create_project(uuid,text,jsonb,text)'::regprocedure) = false
    and (select prosecdef from pg_proc where oid = 'public.save_project_version(uuid,uuid,jsonb,text)'::regprocedure) = false
    and (select prosecdef from pg_proc where oid = 'public.rename_project(uuid,text)'::regprocedure) = false,
    'the three RPCs are SECURITY INVOKER: they exist for atomicity, not privilege');
end $$;

do $$ begin
  raise notice 'stage2_rls: ALL ASSERTIONS PASSED';
end $$;

rollback;
