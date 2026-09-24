-- Stage 4 RLS verification — consortium browsing, the redactor, and access
-- requests (migration 0009).
--
-- Ends with "stage4_rls: ALL ASSERTIONS PASSED" or aborts on the first failure.
--
-- LOCAL OR STAGING ONLY. NEVER THE LIVE PROJECT. There is a guard below that
-- refuses to run on any database with memberships, projects, grants or access
-- requests in it; live has memberships.
--
-- HOW TO RUN (see supabase/README.md, "Stage 4 → Verifying locally"):
--   local_shim.sql, then 0001–0009, then stage1_rls.test.sql,
--   stage2_rls.test.sql, stage2_concurrency.test.sh, stage3_rls.test.sql,
--   stage3_concurrency.test.sh (all must still pass), then this file.
--
-- EVERY ASSERTION RUNS AS AN ORDINARY MEMBER, WITHOUT THE OPERATOR OPT-IN,
-- unless it is about the platform admin. The people are Stage 3's, across five
-- companies: Building Integrity (bob; alice and erin, its admins; gwen, also at
-- Rare Forms), Rare Forms (frank, fiona, gwen), New Frameworks (nick), a
-- company OUTSIDE the consortium (carol, at Nonmember Co) and The Seed
-- Collaborative (dave) — plus henry, with no membership, and pat, the platform
-- admin.
--
-- NO ASSERTION IS SWALLOWED. pg_temp.assert raises P0001. Every exception
-- handler below catches a SPECIFIC SQLSTATE (ZZ001 for a deliberate undo;
-- 0A000 and 42501 in pg_temp.bv, whose NULL every caller asserts on), or is
-- pg_temp.sqlstate_of / msg_of, which only ever wrap the statement under test
-- and never an assertion.
--
-- Section numbers are the plan's ("Tests — stage4_rls.test.sql"). They run in
-- the order their fixtures need. Section 5's DEFINITION half runs first, so
-- that widening any of the five objects 0006 and 0008 warned about fails on it
-- by name before anything downstream can trip over the widening.
--
-- THE MARGIN VALUE. Every fixture document carries priceModifier 1.3777, a
-- number that appears nowhere else, so "the modifier's value does not survive"
-- is checkable as text.

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
  select set_config('stage4test.' || k, v::text, true);
$$;

create or replace function pg_temp.get(k text)
returns uuid language plpgsql as $$
declare v text := nullif(current_setting('stage4test.' || k, true), '');
begin
  if v is null then
    raise exception 'test bug: nothing stored under %', k;
  end if;
  return v::uuid;
end;
$$;

-- A project document. p_price false leaves priceModifier out and puts a
-- differently named money-ish key in its place — the shape of a future format
-- nobody has classified yet.
create or replace function pg_temp.doc(p_name text, p_version integer default 24, p_price boolean default true)
returns jsonb language sql as $$
  select jsonb_build_object(
    'schemaVersion', p_version,
    'savedAt', '2026-09-21T12:00:00.000Z',
    'state', jsonb_build_object('projectName', p_name, 'role', 'public', 'zipCode', '97201',
                                'wallHeightFt', 9)
             || case when p_price then jsonb_build_object('priceModifier', 1.3777)
                     else jsonb_build_object('markup', 1.3777) end);
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

create or replace function pg_temp.browse_ids(p_company uuid default null, p_folder text default null)
returns uuid[] language sql as $$
  select coalesce(array_agg(project_id), '{}') from public.browse_projects(p_company, p_folder);
$$;

create or replace function pg_temp.access_of(p uuid)
returns text language sql as $$
  select access from public.browse_projects(null, null) where project_id = p;
$$;

-- The document browse_version serves, through the caller's own call — or NULL
-- if it REFUSED (0A000: unclassified format or a surviving cost field; 42501:
-- not browsable). Only those two SQLSTATEs are caught, and every caller asserts
-- on the result (properly_redacted is false for NULL), so a refusal where a
-- document was expected fails the named assertion instead of aborting the run
-- anonymously. Where a refusal IS expected, the suite uses sqlstate_of instead.
create or replace function pg_temp.bv(p uuid, v uuid)
returns jsonb language plpgsql as $$
declare d jsonb;
begin
  select b.document into d from public.browse_version(p, v) b;
  return d;
exception when sqlstate '0A000' or sqlstate '42501' then
  return null;
end;
$$;

-- What is actually STORED on a version, read past RLS as the test's owner — so
-- the browse-path assertions can show that a real label and a real address
-- exist and are being withheld, rather than that there was nothing to withhold.
create or replace function pg_temp.stored_label(v uuid)
returns text language sql security definer as $$
  select label from public.project_versions where id = v;
$$;

create or replace function pg_temp.stored_author(v uuid)
returns text language sql security definer as $$
  select author_name from public.project_versions where id = v;
$$;

-- A whole browse_version ROW as jsonb, or NULL if it REFUSED — the same two
-- caught SQLSTATEs, and the same reason, as bv above. Assertions about the
-- row's other columns go through this rather than calling browse_version
-- directly, so a refusal where a row was expected fails a named assertion
-- instead of aborting the run. A served row with a null label is
-- `j -> 'label' = 'null'::jsonb`, which a refusal (j is null) cannot fake.
create or replace function pg_temp.bvrow(p uuid, v uuid)
returns jsonb language plpgsql as $$
declare j jsonb;
begin
  select to_jsonb(b) into j from public.browse_version(p, v) b;
  return j;
exception when sqlstate '0A000' or sqlstate '42501' then
  return null;
end;
$$;

-- Does a key named priceModifier survive anywhere in this document?
create or replace function pg_temp.has_money_key(d jsonb)
returns boolean language sql as $$
  select jsonb_path_exists(d, 'lax $.**.priceModifier');
$$;

-- THE CONSOLIDATED REDACTION CHECK on a served document: no key named
-- priceModifier anywhere, the name nowhere outside the marker, the modifier's
-- VALUE nowhere at all, and the marker present and naming state.priceModifier.
create or replace function pg_temp.properly_redacted(d jsonb)
returns boolean language sql as $$
  select d is not null
     and not pg_temp.has_money_key(d)
     and (d - 'redaction')::text not like '%priceModifier%'
     and d::text not like '%1.3777%'
     and d -> 'redaction' -> 'removedPaths' = '["state.priceModifier"]'::jsonb;
$$;

-- REFUSE TO RUN ON A DATABASE THAT HAS PEOPLE, PROJECTS, GRANTS OR REQUESTS.
do $$
begin
  if exists (select 1 from public.memberships) then
    raise exception 'stage4_rls.test.sql refuses to run here: this database already has memberships, so it is not a fresh or staging one. Never run supabase/tests/ against the live project.';
  end if;
  if exists (select 1 from public.projects) then
    raise exception 'stage4_rls.test.sql refuses to run here: this database already has projects. Never run supabase/tests/ against the live project.';
  end if;
  if exists (select 1 from public.collaborators) then
    raise exception 'stage4_rls.test.sql refuses to run here: this database already has collaborator grants. Never run supabase/tests/ against the live project.';
  end if;
  if exists (select 1 from public.collab_requests) then
    raise exception 'stage4_rls.test.sql refuses to run here: this database already has access requests. Never run supabase/tests/ against the live project.';
  end if;
end $$;

-- ===========================================================================
-- 5 (definitions). The five objects 0006 and 0008 warned Stage 4 not to widen
-- are byte-identical to 0008's. The fingerprint is whitespace-normalised, so it
-- is the same whether the migrations arrived with CRLF (a local psql run) or LF
-- (a paste into the Supabase editor) — checked both ways. It is the same query
-- as the README's pre-flight (e) and post-flight (F).
-- ===========================================================================
do $$
declare r record;
begin
  for r in
    select f.object_name,
           md5(regexp_replace(pg_get_functiondef(f.oid), '\s+', ' ', 'g')) as fp
      from (values ('can_read_project',    'public.can_read_project(uuid)'::regprocedure),
                   ('can_write_project',   'public.can_write_project(uuid)'::regprocedure),
                   ('holds_project_grant', 'public.holds_project_grant(uuid)'::regprocedure)) as f(object_name, oid)
    union all
    select p.policyname::text,
           md5(p.cmd || '|' || p.permissive || '|' || array_to_string(p.roles, ',') || '|'
               || replace(coalesce(p.qual, ''), 'public.', '') || '|'
               || replace(coalesce(p.with_check, ''), 'public.', ''))
      from pg_policies p
     where p.schemaname = 'public'
       and (p.tablename, p.policyname) in (('projects', 'projects_select'), ('project_versions', 'project_versions_select'))
  loop
    perform pg_temp.assert(r.fp = case r.object_name
        when 'can_read_project'        then 'adcfa86d68b1e72174858f175a30b77a'
        when 'can_write_project'       then '6f35afeba487daf355c5c0ac18b76ae4'
        when 'holds_project_grant'     then '4132d034bdd5aed44cc6ff773dfd8644'
        when 'project_versions_select' then '55bc5ffbbf1e9e0c9554d7f30b7f5193'
        when 'projects_select'         then '35871592d8c9ffd6909ad624b169f41e'
      end,
      'RLS IS UNTOUCHED: ' || r.object_name || ' is byte-identical to 0008''s (fingerprint ' || r.fp || ')');
  end loop;
  perform pg_temp.assert(
    (select count(*) from pg_policies where schemaname = 'public'
        and (tablename, policyname) in (('projects', 'projects_select'), ('project_versions', 'project_versions_select'))) = 2,
    'RLS IS UNTOUCHED: projects_select and project_versions_select both still exist');
  perform pg_temp.assert(
    (select array_agg(policyname::text order by policyname) from pg_policies where schemaname = 'public' and tablename = 'projects')
      = array['projects_delete', 'projects_insert', 'projects_require_aal', 'projects_select', 'projects_update'],
    'RLS IS UNTOUCHED: projects still has exactly five policies, by name');
  perform pg_temp.assert(
    (select array_agg(policyname::text order by policyname) from pg_policies where schemaname = 'public' and tablename = 'project_versions')
      = array['project_versions_delete', 'project_versions_insert', 'project_versions_require_aal', 'project_versions_select'],
    'RLS IS UNTOUCHED: project_versions still has exactly four policies, by name');
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
update public.user_profiles set display_name = 'Pat Platform' where id = pg_temp.u('pat');
-- dave and fiona have no display name: their snapshots fall back to email.

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
declare r record; s record;
begin
  select * into r from public.create_project(pg_temp.co('BI'), 'current', pg_temp.doc('Smith House'), null);
  perform pg_temp.put('p1', r.project_id); perform pg_temp.put('p1_v1', r.version_id);
  select * into s from public.save_project_version(r.project_id, r.version_id, pg_temp.doc('Smith House'), 'second save');
  perform pg_temp.put('p1_v2', s.version_id);

  select * into r from public.create_project(pg_temp.co('BI'), 'proposals', pg_temp.doc('Jones Bid'), null);
  perform pg_temp.put('p2', r.project_id); perform pg_temp.put('p2_v1', r.version_id);

  -- Formats: v1 at 24, then 99, 25 and 23 (none classified), and a 99 with no
  -- priceModifier at all — a future format that moved the money somewhere else.
  select * into r from public.create_project(pg_temp.co('BI'), 'past', pg_temp.doc('Format House'), null);
  perform pg_temp.put('pf', r.project_id); perform pg_temp.put('pf_v24', r.version_id);
  select * into s from public.save_project_version(r.project_id, r.version_id, pg_temp.doc('Format House', 99), null);
  perform pg_temp.put('pf_v99', s.version_id);
  select * into s from public.save_project_version(r.project_id, s.version_id, pg_temp.doc('Format House', 25), null);
  perform pg_temp.put('pf_v25', s.version_id);
  select * into s from public.save_project_version(r.project_id, s.version_id, pg_temp.doc('Format House', 23), null);
  perform pg_temp.put('pf_v23', s.version_id);
  select * into s from public.save_project_version(r.project_id, s.version_id, pg_temp.doc('Format House', 99, false), null);
  perform pg_temp.put('pf_v99_nomoney', s.version_id);

  -- A document whose priceModifier is nested INSIDE ARRAYS, several levels
  -- down — the shape 4A's review probed with (its versions 2 and 8). The
  -- classified path state.priceModifier is present too and is removed
  -- normally; the belt must then catch the one the classification never named,
  -- and the version must be REFUSED rather than served.
  select * into r from public.create_project(pg_temp.co('BI'), 'current',
    pg_temp.doc('Array House') || jsonb_build_object('walls', jsonb_build_array(
      jsonb_build_array(jsonb_build_object('panels', jsonb_build_array(
        jsonb_build_object('meta', jsonb_build_object('priceModifier', 1.3777))))))), null);
  perform pg_temp.put('parr', r.project_id); perform pg_temp.put('parr_v1', r.version_id);

  -- A document that arrives pre-declaring a field as "redacted".
  select * into r from public.create_project(pg_temp.co('BI'), 'current',
    pg_temp.doc('Forged House') || jsonb_build_object('redaction',
      jsonb_build_object('schemaVersion', 24, 'removedPaths', jsonb_build_array('state.zipCode'), 'reason', 'forged')), null);
  perform pg_temp.put('pforged', r.project_id); perform pg_temp.put('pforged_v1', r.version_id);
end $$;

select pg_temp.act_as('frank');
do $$
declare r record;
begin
  select * into r from public.create_project(pg_temp.co('RF'), 'current', pg_temp.doc('Rare House'), null);
  perform pg_temp.put('rf1', r.project_id); perform pg_temp.put('rf1_v1', r.version_id);
end $$;

select pg_temp.act_as('nick');
do $$
declare r record;
begin
  select * into r from public.create_project(pg_temp.co('NF'), 'current', pg_temp.doc('Frameworks House'), null);
  perform pg_temp.put('nf1', r.project_id); perform pg_temp.put('nf1_v1', r.version_id);
end $$;

select pg_temp.act_as('dave');
do $$
declare r record;
begin
  select * into r from public.create_project(pg_temp.co('SEED'), 'current', pg_temp.doc('Seed House'), null);
  perform pg_temp.put('s1', r.project_id); perform pg_temp.put('s1_v1', r.version_id);
end $$;

select pg_temp.act_as('carol');
do $$
declare r record;
begin
  select * into r from public.create_project(pg_temp.co('NM'), 'current', pg_temp.doc('Outside House'), null);
  perform pg_temp.put('nm1', r.project_id); perform pg_temp.put('nm1_v1', r.version_id);
end $$;

reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform pg_temp.assert((select count(*) from public.collaborators) = 0,
    'fixture sanity: no grant exists yet');
  perform pg_temp.assert((select count(*) from public.projects) = 9, 'fixture sanity: nine projects');
end $$;
set local role authenticated;

-- ===========================================================================
-- 1. The browse set
-- ===========================================================================
select pg_temp.act_as('frank');
do $$
declare v_all uuid[] := array[pg_temp.get('p1'), pg_temp.get('p2'), pg_temp.get('pf'), pg_temp.get('pforged'),
                              pg_temp.get('parr'), pg_temp.get('rf1'), pg_temp.get('nf1'), pg_temp.get('s1')];
        r record;
begin
  perform pg_temp.assert(
    (select array_agg(name order by name) from public.browse_companies())
      = array['Building Integrity', 'New Frameworks', 'Rare Forms', 'The Seed Collaborative'],
    'BROWSE SET: frank (Rare Forms) lists the four consortium member companies, and not Nonmember Co');
  perform pg_temp.assert(pg_temp.same_set(pg_temp.browse_ids(), v_all),
    'BROWSE SET: frank lists Building Integrity''s, New Frameworks'', Rare Forms'' and Seed''s projects, and not Nonmember Co''s');
  perform pg_temp.assert(cardinality(pg_temp.browse_ids(pg_temp.co('NM'))) = 0,
    'BROWSE SET: naming Nonmember Co lists nothing');
  perform pg_temp.assert(not (pg_temp.get('nm1') = any (pg_temp.browse_ids())),
    'BROWSE SET: carol''s project is absent from frank''s browse set');
  perform pg_temp.assert((select count(*) from public.browse_versions(pg_temp.get('nm1'))) = 0,
    'BROWSE SET: naming carol''s project''s id lists none of its versions');
  perform pg_temp.assert(pg_temp.sqlstate_of(format($q$ select public.browse_version(%L, %L) $q$,
      pg_temp.get('nm1'), pg_temp.get('nm1_v1'))) = '42501',
    'BROWSE SET: naming carol''s project''s version serves nothing (42501)');

  perform pg_temp.assert(pg_temp.same_set(pg_temp.browse_ids(pg_temp.co('BI'), 'proposals'), array[pg_temp.get('p2')]),
    'all three folders are browsable, and the folder filter narrows: Building Integrity''s Proposals is exactly the bid');
  perform pg_temp.assert(pg_temp.same_set(pg_temp.browse_ids(pg_temp.co('BI')),
      array[pg_temp.get('p1'), pg_temp.get('p2'), pg_temp.get('pf'), pg_temp.get('pforged'), pg_temp.get('parr')]),
    'Building Integrity''s tree, all folders');
  perform pg_temp.assert(pg_temp.sqlstate_of($q$ select * from public.browse_projects(null, 'drafts') $q$) = '22023',
    'an unknown folder raises 22023');

  perform pg_temp.assert(pg_temp.access_of(pg_temp.get('p1')) = 'redacted',
    'ACCESS MARK: a Building Integrity project is marked redacted for frank');
  perform pg_temp.assert(pg_temp.access_of(pg_temp.get('rf1')) = 'full',
    'ACCESS MARK: his own company''s project is marked full (Open Item 2)');
  perform pg_temp.assert(pg_temp.access_of(pg_temp.get('s1')) = 'redacted',
    'ACCESS MARK: a Seed project is redacted for frank: a consortium entitlement is not a Seed membership');

  select * into r from public.browse_projects(null, null) where project_id = pg_temp.get('p1');
  perform pg_temp.assert(r.owner_company_id = pg_temp.co('BI') and r.owner_company_name = 'Building Integrity'
      and r.folder = 'current' and r.name = 'Smith House' and r.head_version_number = 2
      and r.head_version_id = pg_temp.get('p1_v2') and r.head_author_name = 'Bob Builder'
      and r.head_schema_version = 24 and r.head_redaction_known,
    'a browse row names the owner, folder, name, head version and its author');

  perform pg_temp.assert(
    (select array_agg(version_number order by version_number) from public.browse_versions(pg_temp.get('p1'))) = array[1, 2],
    'browse_versions lists P1''s two versions');
  perform pg_temp.assert(
    (select bool_and(author_name = 'Bob Builder' and schema_version = 24 and redaction_known and project_name = 'Smith House')
       from public.browse_versions(pg_temp.get('p1'))),
    'with author, format, and the name each was saved under');

  -- EMAIL-SHAPED AUTHOR NAMES ARE MASKED (narrowed 2026-09-23, from 4A's
  -- review). dave set no display name, so his snapshot is his address; Stage 3
  -- accepted that crossing to an invited collaborator, but not to every member
  -- company. A real display name (Bob Builder, above) is untouched.
  perform pg_temp.assert(pg_temp.stored_author(pg_temp.get('s1_v1')) = 'dave@seed.test',
    'premise: dave''s stored snapshot really is his email address');
  perform pg_temp.assert(
    (select head_author_name from public.browse_projects(null, null) where project_id = pg_temp.get('s1'))
      = 'a member of The Seed Collaborative',
    'NAMES MASKED: browse_projects gives the owner company instead of the address');
  perform pg_temp.assert(
    (select bool_and(author_name = 'a member of The Seed Collaborative') from public.browse_versions(pg_temp.get('s1'))),
    'NAMES MASKED: so does browse_versions');
  perform pg_temp.assert(
    not exists (select 1 from public.browse_projects(null, null) where head_author_name like '%@%')
    and not exists (select 1 from public.browse_projects(null, null) b
                     join public.browse_versions(b.project_id) v on true
                    where v.author_name like '%@%'),
    'NAMES MASKED: no author name anywhere in the browse set contains an @ at all');
  -- NO LABELS WHILE BROWSING (narrowed 2026-09-23, from 4A's review). A save
  -- label is free text, and free text is where people write prices: the
  -- review's probe read back "Quoted at 1.35 markup" from another company's
  -- version while the structured modifier was correctly stripped.
  perform pg_temp.assert(pg_temp.stored_label(pg_temp.get('p1_v2')) = 'second save',
    'premise: version 2 really carries a free-text label, which would have crossed verbatim');
  perform pg_temp.assert(
    (select bool_and(label is null) from public.browse_versions(pg_temp.get('p1'))),
    'NO LABELS WHILE BROWSING: browse_versions returns a null label for every version');
  -- browse_version's own label and author_name are asserted in section 3,
  -- after the margin assertions, so that a REDACTION mutation still fails on
  -- the margin rather than on one of these.
  perform pg_temp.assert(
    (select count(*) from public.browse_versions(pg_temp.get('p1')) where label is not null) = 0
    and not exists (select 1 from public.browse_projects(null, null) b
                     join public.browse_versions(b.project_id) v on true
                    where v.label is not null),
    'NO LABELS WHILE BROWSING: not one version of any project in the browse set carries a label');
end $$;

select pg_temp.act_as('dave');
do $$ begin
  perform pg_temp.assert(pg_temp.access_of(pg_temp.get('s1')) = 'full',
    'a Seed member sees Seed''s own tree marked full');
  perform pg_temp.assert(pg_temp.access_of(pg_temp.get('p1')) = 'redacted',
    'and everyone else''s redacted');
  perform pg_temp.assert(cardinality(pg_temp.browse_ids()) = 8, 'dave lists the same eight');
end $$;

select pg_temp.act_as('pat');
do $$ begin
  perform pg_temp.assert(cardinality(pg_temp.browse_ids()) = 8
      and not (pg_temp.get('nm1') = any (pg_temp.browse_ids())),
    'the platform admin browses the same set — a non-member company is not in anyone''s browse set');
  perform pg_temp.assert(
    (select bool_and(access = 'full') from public.browse_projects(null, null)),
    'and every row is marked full: platform admins are served through the normal path, never the redactor');
  perform pg_temp.assert((select count(*) from public.browse_companies()) = 4, 'pat lists the four companies');
end $$;

-- ===========================================================================
-- 2. The symmetric false branch — a non-member company neither sees nor is seen
-- ===========================================================================
select pg_temp.act_as('carol');
do $$
declare v_real text; v_none text;
begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('nm1')) = 1, 'premise: carol reads her own company''s project');
  perform pg_temp.assert((select count(*) from public.browse_companies()) = 0,
    'NON-MEMBER: carol gets zero companies from browse_companies()');
  perform pg_temp.assert(cardinality(pg_temp.browse_ids()) = 0
      and cardinality(pg_temp.browse_ids(pg_temp.co('BI'))) = 0
      and cardinality(pg_temp.browse_ids(pg_temp.co('NM'))) = 0,
    'NON-MEMBER: carol gets zero projects from browse_projects(), whatever she names');
  perform pg_temp.assert((select count(*) from public.browse_versions(pg_temp.get('p1'))) = 0,
    'NON-MEMBER: and zero versions');

  v_real := pg_temp.msg_of(format($q$ select public.browse_version(%L, %L) $q$, pg_temp.get('p1'), pg_temp.get('p1_v1')));
  v_none := pg_temp.msg_of(format($q$ select public.browse_version(%L, %L) $q$, gen_random_uuid(), gen_random_uuid()));
  perform pg_temp.assert(v_real like '42501:%',
    'NON-MEMBER: browse_version on a project she named raises 42501 (got ' || coalesce(v_real, 'a document') || ')');
  perform pg_temp.assert(v_real = v_none,
    'NON-MEMBER: the same error as for a project that does not exist');
  perform pg_temp.assert(
    pg_temp.msg_of(format($q$ select public.browse_version(%L, %L) $q$, pg_temp.get('nm1'), pg_temp.get('nm1_v1'))) = v_none,
    'NON-MEMBER: her own company''s project is not in the browse set either (she reads it the normal way)');

  perform pg_temp.assert(
    pg_temp.msg_of(format($q$ select public.request_project_access(%L, null) $q$, pg_temp.get('p1')))
      = pg_temp.msg_of(format($q$ select public.request_project_access(%L, null) $q$, gen_random_uuid())),
    'NON-MEMBER: request_project_access gives carol the same error for a real project and a made-up one');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.request_project_access(%L, null) $q$, pg_temp.get('p1'))) = '42501',
    'NON-MEMBER: and it is 42501');

  -- Open Item 5, answered: shareable_companies no longer answers a non-member.
  perform pg_temp.assert((select count(*) from public.shareable_companies()) = 0,
    'SHAREABLE COMPANIES TIGHTENED: carol, not seed-entitled, gets no company names');
end $$;

select pg_temp.act_as('henry');
do $$ begin
  perform pg_temp.assert((select count(*) from public.shareable_companies()) = 0,
    'SHAREABLE COMPANIES TIGHTENED: henry, with no membership, gets no company names');
  perform pg_temp.assert((select count(*) from public.browse_companies()) = 0
      and cardinality(pg_temp.browse_ids()) = 0,
    'henry browses nothing');
end $$;

select pg_temp.act_as('pat');
do $$ begin
  perform pg_temp.assert(
    (select array_agg(name order by name) from public.shareable_companies())
      = array['Building Integrity', 'New Frameworks', 'Rare Forms', 'The Seed Collaborative'],
    'the platform admin still gets the share picker');
end $$;

-- ===========================================================================
-- 3. THE MARGIN ASSERTION — Stage 4's version, and the one that matters most
-- ===========================================================================
-- Structural first: the redactor exists, and the one function that serves a
-- browsed document passes it through the redactor. (Read as the owner.)
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform pg_temp.assert(to_regprocedure('public.browse_redact(jsonb,integer)') is not null,
    'MARGIN: the redactor, browse_redact, exists');
  perform pg_temp.assert(
    (select prosrc from pg_proc where oid = 'public.browse_version(uuid,uuid)'::regprocedure)
      like '%public.browse_redact(v_row.document, v_row.schema_version)%',
    'MARGIN: browse_version serves the document only through browse_redact');
end $$;
set local role authenticated;

do $$
declare
  who text;
  d jsonb;
begin
  foreach who in array array['frank', 'nick', 'dave'] loop
    perform pg_temp.act_as(who);
    perform pg_temp.assert(pg_temp.versions(pg_temp.get('p1')) = 0 and pg_temp.reads(pg_temp.get('p1')) = 0,
      'MARGIN: ' || who || ' reads 0 rows of P1 through project_versions and projects');

    d := pg_temp.bv(pg_temp.get('p1'), pg_temp.get('p1_v2'));
    perform pg_temp.assert(d is not null,
      'MARGIN: browse_version serves ' || who || ' P1''s head, redacted');
    perform pg_temp.assert(not pg_temp.has_money_key(d),
      'MARGIN: the document served to ' || who || ' has no key named priceModifier, at any depth');
    perform pg_temp.assert((d - 'redaction')::text not like '%priceModifier%',
      'MARGIN: the document served to ' || who || ' does not contain the string priceModifier outside the redaction marker');
    perform pg_temp.assert(d::text not like '%1.3777%',
      'MARGIN: the modifier''s value appears nowhere in the document served to ' || who);
    perform pg_temp.assert(d -> 'redaction' = jsonb_build_object(
        'schemaVersion', 24, 'removedPaths', jsonb_build_array('state.priceModifier'),
        'reason', 'another company''s cost information'),
      'MARGIN: the marker is present and names state.priceModifier');
    perform pg_temp.assert(d -> 'state' ->> 'zipCode' = '97201' and d -> 'state' ->> 'projectName' = 'Smith House'
        and (d -> 'state' ->> 'wallHeightFt')::integer = 9 and (d ->> 'schemaVersion')::integer = 24
        and d ->> 'savedAt' = '2026-09-21T12:00:00.000Z',
      'DESIGN YES: everything that is not money still arrives');
    perform pg_temp.assert(pg_temp.properly_redacted(pg_temp.bv(pg_temp.get('p1'), pg_temp.get('p1_v1'))),
      'MARGIN: P1''s older version is redacted too');
  end loop;
end $$;

-- The rest of what browse_version serves alongside the document: the two
-- columns narrowed on 2026-09-23. Asserted HERE, after the margin, so that a
-- redaction mutation fails on the margin first. bvrow returns null if the call
-- REFUSED, which is why "the row came back" is asserted beside "its label is
-- null" — a refusal cannot masquerade as a withheld label.
select pg_temp.act_as('frank');
do $$
declare j jsonb;
begin
  j := pg_temp.bvrow(pg_temp.get('p1'), pg_temp.get('p1_v2'));
  perform pg_temp.assert(j is not null and j ? 'label',
    'premise: browse_version served the row, and it still has a label column (4B''s shape is unchanged)');
  perform pg_temp.assert(j -> 'label' = 'null'::jsonb,
    'NO LABELS WHILE BROWSING: browse_version''s label is null, though the stored one reads "'
      || coalesce(pg_temp.stored_label(pg_temp.get('p1_v2')), '') || '"');
  perform pg_temp.assert(j ->> 'author_name' = 'Bob Builder',
    'NAMES: a real display name is served unchanged by browse_version');

  j := pg_temp.bvrow(pg_temp.get('s1'), pg_temp.get('s1_v1'));
  perform pg_temp.assert(j is not null and j ->> 'author_name' = 'a member of The Seed Collaborative',
    'NAMES MASKED: browse_version gives the owner company instead of dave''s address');
  perform pg_temp.assert((j ->> 'author_name') not like '%@%',
    'NAMES MASKED: and no address reaches a browsing company at all');
end $$;

-- A stored document that pre-declares a "redaction" cannot shape the marker.
select pg_temp.act_as('frank');
do $$
declare d jsonb;
begin
  d := pg_temp.bv(pg_temp.get('pforged'), pg_temp.get('pforged_v1'));
  perform pg_temp.assert(pg_temp.properly_redacted(d),
    'FORGED MARKER: a document saved with its own "redaction" key is still redacted, and the marker is the server''s');
  perform pg_temp.assert(d -> 'redaction' ->> 'reason' = 'another company''s cost information'
      and d -> 'state' ->> 'zipCode' = '97201',
    'FORGED MARKER: the forged marker is overwritten, and the field it claimed was removed is still there');
end $$;

-- Every function frank can call, and every document he can reach through them.
-- (a) The inventory: the set of functions authenticated can execute is pinned.
--     A new one fails HERE until someone decides whether it can reach a document.
reset role;
select set_config('request.jwt.claims', '', true);
do $$
declare v_callable text[]; v_json text[];
begin
  select array_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text) into v_callable
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('authenticated', p.oid, 'execute');
  perform pg_temp.assert(v_callable = array[
      'browse_companies()', 'browse_projects(uuid,text)', 'browse_version(uuid,uuid)', 'browse_versions(uuid)',
      'can_act_as(uuid)', 'can_read_project(uuid)', 'can_write_project(uuid)', 'consortium_company_id()',
      'create_company_with_first_admin(text,text,text,timestamp with time zone)',
      'create_project(uuid,text,jsonb,text)', 'decide_collab_request(uuid,boolean)', 'dismiss_share_notices()',
      'holds_project_grant(uuid)', 'invite_preview(text)', 'is_company_admin(uuid)', 'is_company_admin_anywhere()',
      'is_member_of(uuid)', 'is_platform_admin()', 'is_privileged_caller()', 'is_seed_entitled()',
      'list_shared_projects(uuid)', 'meets_required_aal()', 'pending_share_notices()',
      'project_owner_company_id(uuid)', 'project_owner_company_name(uuid)', 'redeem_invite(text)',
      'rename_project(uuid,text)', 'request_project_access(uuid,text)', 'save_project_version(uuid,uuid,jsonb,text)',
      'share_project_with_company(uuid,uuid)', 'share_project_with_person(uuid,text)', 'shareable_companies()',
      'shares_company_with(uuid)'],
    'EVERY FUNCTION FRANK CAN CALL is classified: the callable set is exactly the known list (got '
      || array_to_string(v_callable, ', ') || ')');

  -- (b) Of those, the only ones that return JSON at all: browse_version (the
  --     redacted document) and list_shared_projects (grant metadata only).
  select array_agg(p.proname::text order by p.proname) into v_json
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('authenticated', p.oid, 'execute')
     and (p.prorettype in ('json'::regtype, 'jsonb'::regtype)
          or exists (select 1 from unnest(coalesce(p.proallargtypes, '{}'::oid[]), coalesce(p.proargmodes, '{}'::"char"[])) as a(t, m)
                      where a.m in ('o', 't', 'b') and a.t in ('json'::regtype, 'jsonb'::regtype)));
  perform pg_temp.assert(v_json = array['browse_version', 'list_shared_projects'],
    'the only callable functions that return JSON are browse_version and list_shared_projects (got '
      || coalesce(array_to_string(v_json, ', '), 'none') || ')');
end $$;
set local role authenticated;

-- (c) The count: every document frank can reach that carries priceModifier —
--     through RLS, through every browsable version, and through the Shared
--     list — belongs to a project he holds a grant on or his own company owns.
create or replace function pg_temp.money_projects_reached()
returns uuid[] language plpgsql as $$
declare
  v_ids uuid[];
  b record;
  vv record;
  d jsonb;
begin
  select coalesce(array_agg(distinct v.project_id), '{}') into v_ids
    from public.project_versions v
   where pg_temp.has_money_key(v.document);
  for b in select * from public.browse_projects(null, null) loop
    for vv in select * from public.browse_versions(b.project_id) where redaction_known loop
      d := pg_temp.bv(b.project_id, vv.version_id);
      if pg_temp.has_money_key(d) or d::text like '%1.3777%' then
        v_ids := v_ids || b.project_id;
      end if;
    end loop;
  end loop;
  return v_ids;
end;
$$;

create or replace function pg_temp.expected_money_projects(p_person text)
returns uuid[] language sql security definer as $$
  -- Read as the test's owner: projects this person's companies own, plus
  -- projects a grant reaches them on.
  select coalesce(array_agg(p.id), '{}')
    from public.projects p
   where p.company_id in (select m.company_id from public.memberships m where m.user_id = pg_temp.u(p_person))
      or exists (select 1 from public.collaborators c
                  where c.project_id = p.id
                    and (c.grantee_user_id = pg_temp.u(p_person)
                         or c.grantee_company_id in (select m.company_id from public.memberships m
                                                      where m.user_id = pg_temp.u(p_person))));
$$;

select pg_temp.act_as('frank');
do $$ begin
  perform pg_temp.assert(pg_temp.same_set(pg_temp.money_projects_reached(), pg_temp.expected_money_projects('frank')),
    'MARGIN, EVERY PATH: the documents frank reaches that carry priceModifier are exactly his own company''s and his grants'' — and no more');
  perform pg_temp.assert(pg_temp.same_set(pg_temp.expected_money_projects('frank'), array[pg_temp.get('rf1')]),
    'fixture sanity: before any grant that is Rare House alone');
end $$;

-- Open Item 2 and decision 20's ownership rule: the browse path ALWAYS redacts,
-- even for someone who can read the project in full.
select pg_temp.act_as('bob');
do $$ begin
  perform pg_temp.assert(pg_temp.versions(pg_temp.get('p1')) = 2, 'premise: bob, an owner member, reads P1 in full');
  perform pg_temp.assert(pg_temp.properly_redacted(pg_temp.bv(pg_temp.get('p1'), pg_temp.get('p1_v2'))),
    'ALWAYS REDACTED: bob opening his own company''s project through the browse path gets it redacted (Open Items 2 and 7)');
  perform pg_temp.assert(
    (select label from public.project_versions where id = pg_temp.get('p1_v2')) = 'second save',
    'LABELS ARE KEPT FOR THE OWNER: bob still reads the label through Stage 2''s own path — only the browse path drops it');
end $$;

select pg_temp.act_as('dave');
do $$ begin
  perform pg_temp.assert(
    (select author_name from public.project_versions where id = pg_temp.get('s1_v1')) = 'dave@seed.test',
    'NAMES ARE KEPT ON THE OWNING PATH: dave''s own company still reads the stored snapshot, address and all');
  perform pg_temp.assert(
    (select bool_and(label is null) from public.browse_versions(pg_temp.get('p1'))),
    'NO LABELS WHILE BROWSING: dave gets none either — this is the path, not the person');
end $$;

select pg_temp.act_as('pat');
do $$ begin
  perform pg_temp.assert(pg_temp.properly_redacted(pg_temp.bv(pg_temp.get('p1'), pg_temp.get('p1_v2'))),
    'ALWAYS REDACTED: so does the platform admin, who reads it in full the normal way instead');
  perform pg_temp.assert(pg_temp.versions(pg_temp.get('p1')) = 2, 'premise: pat reads P1 in full through RLS');
end $$;

-- ===========================================================================
-- 4. Fail closed on an unknown schema version — the future-schema guard
-- ===========================================================================
select pg_temp.act_as('frank');
do $$
declare k text; s text;
begin
  foreach k in array array['pf_v99', 'pf_v25', 'pf_v23', 'pf_v99_nomoney'] loop
    s := pg_temp.sqlstate_of(format($q$ select public.browse_version(%L, %L) $q$, pg_temp.get('pf'), pg_temp.get(k)));
    perform pg_temp.assert(s = '0A000',
      'FAIL CLOSED: ' || k || ' has no redaction row, so browse_version raises and serves nothing (got '
        || coalesce(s, 'a document') || ')');
  end loop;
  perform pg_temp.assert(pg_temp.properly_redacted(pg_temp.bv(pg_temp.get('pf'), pg_temp.get('pf_v24'))),
    'FAIL CLOSED: the same project''s version stamped 24 serves normally');

  -- The belt, end to end on a REAL SAVED DOCUMENT rather than a hand-made one.
  s := pg_temp.sqlstate_of(format($q$ select public.browse_version(%L, %L) $q$,
        pg_temp.get('parr'), pg_temp.get('parr_v1')));
  perform pg_temp.assert(s = '0A000',
    'BELT, END TO END: a saved document with priceModifier nested inside arrays is REFUSED by browse_version, not served (got '
      || coalesce(s, 'a document') || ')');
  perform pg_temp.assert(pg_temp.bv(pg_temp.get('parr'), pg_temp.get('parr_v1')) is null,
    'BELT, END TO END: and no document comes back from it at all');

  perform pg_temp.assert(
    (select array_agg(schema_version::text || ':' || redaction_known::text order by version_number)
       from public.browse_versions(pg_temp.get('pf')))
      = array['24:true', '99:false', '25:false', '23:false', '99:false'],
    'the version list says which formats cannot be shown, without serving any of them');
  perform pg_temp.assert(
    (select head_schema_version = 99 and not head_redaction_known
       from public.browse_projects(null, null) where project_id = pg_temp.get('pf')),
    'and the browse row says its head cannot be shown');
end $$;

-- Every classified format, including any a later migration adds: a document in
-- that format carrying priceModifier must be SERVED, and served without it.
-- A row added for a new format with the wrong paths fails here, loudly.
reset role;
select set_config('request.jwt.claims', '', true);
set local app.operator = 'on';
create or replace function pg_temp.classified_versions()
returns integer[] language sql security definer as $$
  select array_agg(schema_version order by schema_version) from public.browse_schema_redaction;
$$;
do $$ begin
  perform pg_temp.assert(pg_temp.classified_versions() = array[24],
    'CLASSIFICATION: exactly one format is classified today, 24');
  perform pg_temp.assert(
    (select redacted_paths from public.browse_schema_redaction where schema_version = 24) = '[["state","priceModifier"]]'::jsonb,
    'CLASSIFICATION: for 24 the redaction list is exactly state.priceModifier');
end $$;
set local app.operator = '';
set local role authenticated;

do $$
declare
  v integer;
  r record;
  d jsonb;
begin
  foreach v in array pg_temp.classified_versions() loop
    begin
      perform pg_temp.act_as('bob');
      select * into r from public.create_project(pg_temp.co('BI'), 'current', pg_temp.doc('Format ' || v, v), null);
      perform pg_temp.act_as('frank');
      d := pg_temp.bv(r.project_id, r.version_id);
      perform pg_temp.assert(pg_temp.properly_redacted(d)
          and d -> 'redaction' ->> 'schemaVersion' = v::text,
        'EVERY CLASSIFIED FORMAT: a format-' || v || ' document is served with no cost field');
      raise exception 'undo' using errcode = 'ZZ001';
    exception when sqlstate 'ZZ001' then null;
    end;
  end loop;
end $$;

-- The redactor's own belts, called directly as the owner (no client can call it).
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform pg_temp.assert(
    pg_temp.sqlstate_of($q$ select public.browse_redact('{"schemaVersion":24,"state":{"pricing":{"priceModifier":1.3777}}}'::jsonb, 24) $q$) = '0A000',
    'BELT: a priceModifier key anywhere the classification did not name makes the redactor refuse');
  -- INSIDE AN ARRAY, added 2026-09-23 from 4A's review. "Anywhere" has to mean
  -- through arrays too, or a future format that moves the modifier into a list
  -- of panels walks straight past the belt. Both shapes below are what the
  -- review's own probe used.
  perform pg_temp.assert(
    pg_temp.sqlstate_of($q$ select public.browse_redact('{"schemaVersion":24,"state":{"priceModifier":1.1,"panels":[{"priceModifier":1.3777}]}}'::jsonb, 24) $q$) = '0A000',
    'BELT: a priceModifier INSIDE AN ARRAY is caught, even once the classified one has been removed');
  perform pg_temp.assert(
    pg_temp.sqlstate_of($q$ select public.browse_redact('{"schemaVersion":24,"state":{"walls":[[{"panels":[{"meta":{"priceModifier":1.3777}}]}]]}}'::jsonb, 24) $q$) = '0A000',
    'BELT: and several levels down, through arrays of arrays');
  perform pg_temp.assert(
    pg_temp.sqlstate_of($q$ select public.browse_redact('{"schemaVersion":25,"state":{"priceModifier":1.3777}}'::jsonb, 24) $q$) = '0A000',
    'BELT: a document whose own schemaVersion disagrees with the one asked about is refused');
  perform pg_temp.assert(
    pg_temp.sqlstate_of($q$ select public.browse_redact('{"schemaVersion":99,"state":{}}'::jsonb, 99) $q$) = '0A000',
    'BELT: an unclassified format is refused even with nothing money-shaped in it');
  perform pg_temp.assert(
    pg_temp.sqlstate_of($q$ insert into public.browse_schema_redaction values (1000, '[["state"],[]]', null) $q$) = '23514',
    'CLASSIFICATION: a malformed path cannot be stored');

  -- The author-name mask itself, called directly as the owner (no client role
  -- can call it either). Tommy's wording, decided 2026-09-24.
  perform pg_temp.assert(
    public.browse_author_name('dave@seed.test', 'The Seed Collaborative') = 'a member of The Seed Collaborative',
    'MASK: an address becomes "a member of <company>" — which reads properly even for a name beginning with "The"');
  perform pg_temp.assert(
    public.browse_author_name('  dave@seed.test  ', 'Rare Forms') = 'a member of Rare Forms',
    'MASK: a padded address is still an address');
  perform pg_temp.assert(
    public.browse_author_name('dave@seed.test', null) = 'a member of the consortium'
    and public.browse_author_name('dave@seed.test', '   ') = 'a member of the consortium',
    'MASK: with no company name the fallback is the same shape');
  perform pg_temp.assert(public.browse_author_name(null, 'Rare Forms') is null,
    'MASK: a null name stays null — the mask invents nobody');
  perform pg_temp.assert(
    public.browse_author_name('Bob Builder', 'Building Integrity') = 'Bob Builder'
    and public.browse_author_name('Bob @ BI', 'Building Integrity') = 'Bob @ BI'
    and public.browse_author_name('O''Brien-Smith', 'Building Integrity') = 'O''Brien-Smith',
    'MASK: a real display name passes through untouched, even one containing an @');
end $$;
set local role authenticated;

-- ===========================================================================
-- 5 (behaviour). RLS answers exactly as before 0009
-- ===========================================================================
select pg_temp.act_as('frank');
do $$
declare n integer;
begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p2')) = 0 and pg_temp.versions(pg_temp.get('p2')) = 0,
    'RLS IS UNTOUCHED: frank still reads 0 rows of a Building Integrity project he can browse');
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('s1')) = 0 and pg_temp.versions(pg_temp.get('s1')) = 0,
    'RLS IS UNTOUCHED: and 0 rows of a Seed project');
  perform pg_temp.assert(
    not public.can_read_project(pg_temp.get('p2')) and not public.can_write_project(pg_temp.get('p2'))
    and not public.holds_project_grant(pg_temp.get('p2')),
    'RLS IS UNTOUCHED: can_read_project, can_write_project and holds_project_grant are all false for a browsable project');
  perform pg_temp.assert(pg_temp.same_set((select array_agg(id) from public.projects), array[pg_temp.get('rf1')]),
    'RLS IS UNTOUCHED: frank lists exactly his own company''s project');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.save_project_version(%L, %L, %L::jsonb, null) $q$,
      pg_temp.get('p2'), pg_temp.get('p2_v1'), pg_temp.doc('Jones Bid'))) = '42501',
    'BROWSING WRITES NOTHING: frank cannot save to a project he can browse');
  update public.projects set folder = 'past' where id = pg_temp.get('p2');
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 0, 'BROWSING WRITES NOTHING: nor move it');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.share_project_with_person(%L, 'nick@newframeworks.test') $q$, pg_temp.get('p2'))) = '42501',
    'BROWSING WRITES NOTHING: nor share it');
end $$;

-- ===========================================================================
-- 6. Access requests
-- ===========================================================================
select pg_temp.act_as('frank');
do $$
declare r record; q record;
begin
  select * into r from public.request_project_access(pg_temp.get('p1'), '  Could we see the costs?  ');
  perform pg_temp.assert(r.status = 'requested' and r.request_id is not null,
    'REQUEST: frank asks on a Building Integrity project he can browse: requested (got ' || coalesce(r.status, '-') || ')');
  perform pg_temp.put('req_frank', r.request_id);
  select * into q from public.collab_requests where id = r.request_id;
  perform pg_temp.assert(q.status = 'pending' and q.project_id = pg_temp.get('p1')
      and q.requested_by = pg_temp.u('frank') and q.requested_by_name = 'Frank Framer'
      and q.message = 'Could we see the costs?' and q.created_at = now()
      and q.decided_by is null and q.decided_by_name is null and q.decided_at is null,
    'REQUEST: pending, his name snapshotted, the note trimmed, and he can read his own request');

  select * into r from public.request_project_access(pg_temp.get('p1'), 'again');
  perform pg_temp.assert(r.status = 'already-pending' and r.request_id = pg_temp.get('req_frank'),
    'REQUEST: a second pending request from frank is refused: already-pending, naming the first (got ' || coalesce(r.status, '-') || ')');
  perform pg_temp.assert(
    (select count(*) from public.collab_requests where project_id = pg_temp.get('p1') and requested_by = pg_temp.u('frank')) = 1,
    'REQUEST: and nothing new is written');

  select * into r from public.request_project_access(pg_temp.get('rf1'), null);
  perform pg_temp.assert(r.status = 'already-has-access' and r.request_id is null,
    'REQUEST: asking about his own company''s project is already-has-access');

  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.request_project_access(%L, %L) $q$, pg_temp.get('p2'), repeat('x', 501))) = '22023',
    'REQUEST: a note over 500 characters raises 22023');
  perform pg_temp.assert(
    pg_temp.msg_of(format($q$ select public.request_project_access(%L, null) $q$, pg_temp.get('nm1')))
      = pg_temp.msg_of(format($q$ select public.request_project_access(%L, null) $q$, gen_random_uuid())),
    'REQUEST: asking about carol''s project raises the same error as asking about one that does not exist');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.request_project_access(%L, null) $q$, pg_temp.get('nm1'))) = '42501',
    'REQUEST: frank asking about carol''s non-member project raises 42501');

  -- A request is not a way to write rows by hand.
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ insert into public.collab_requests (project_id, requested_by, requested_by_name) values (%L, %L, 'x') $q$,
      pg_temp.get('p2'), pg_temp.u('frank'))) = '42501',
    'REQUEST: a direct insert into collab_requests raises 42501');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ update public.collab_requests set status = 'granted' where id = %L $q$, pg_temp.get('req_frank'))) = '42501',
    'REQUEST: frank cannot mark his own request granted');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ delete from public.collab_requests where id = %L $q$, pg_temp.get('req_frank'))) = '42501',
    'REQUEST: nor delete it');

  -- The requester cannot decide his own request.
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.decide_collab_request(%L, true) $q$, pg_temp.get('req_frank'))) = '42501',
    'DECIDE: frank granting his own request raises 42501');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.decide_collab_request(%L, false) $q$, pg_temp.get('req_frank'))) = '42501',
    'DECIDE: frank declining his own request raises 42501');
end $$;

select pg_temp.act_as('carol');
do $$ begin
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.request_project_access(%L, null) $q$, pg_temp.get('p2'))) = '42501'
    and pg_temp.sqlstate_of(format($q$ select public.request_project_access(%L, null) $q$, pg_temp.get('nm1'))) = '42501',
    'REQUEST: carol asking about anything raises');
  perform pg_temp.assert(
    pg_temp.msg_of(format($q$ select public.decide_collab_request(%L, true) $q$, pg_temp.get('req_frank')))
      = pg_temp.msg_of(format($q$ select public.decide_collab_request(%L, true) $q$, gen_random_uuid())),
    'DECIDE: carol deciding a real request gets the same error as for one that does not exist');
  perform pg_temp.assert((select count(*) from public.collab_requests) = 0, 'carol sees no requests');
end $$;

-- Who else sees frank's request: owner members yes; his colleague, another
-- browsing company and a collaborator no.
select pg_temp.act_as('bob');
do $$
declare r record;
begin
  perform pg_temp.assert((select count(*) from public.collab_requests where id = pg_temp.get('req_frank')) = 1,
    'VISIBILITY: bob, an owner member, sees frank''s request with its note');
  -- nick becomes a COLLABORATOR on P1: he can write it, but he is not the owner.
  select * into r from public.share_project_with_person(pg_temp.get('p1'), 'nick@newframeworks.test');
  perform pg_temp.assert(r.status = 'shared', 'premise: bob shares P1 with nick');
  perform pg_temp.put('g_nick_p1', r.grant_id);
end $$;

select pg_temp.act_as('fiona');
do $$ begin
  perform pg_temp.assert((select count(*) from public.collab_requests) = 0,
    'VISIBILITY: fiona, frank''s colleague, sees none of his requests');
end $$;

select pg_temp.act_as('nick');
do $$ begin
  perform pg_temp.assert(pg_temp.versions(pg_temp.get('p1')) = 2, 'premise: nick, a collaborator, reads P1 in full');
  perform pg_temp.assert(
    (select label from public.project_versions where id = pg_temp.get('p1_v2')) = 'second save',
    'LABELS ARE KEPT FOR AN INVITED COLLABORATOR: nick reads the label through Stage 3''s own path');
  perform pg_temp.assert(
    (select bool_and(label is null) from public.browse_versions(pg_temp.get('p1'))),
    'and the SAME PERSON browsing the SAME project gets no label: it is the path that drops it, not the person');
  perform pg_temp.assert((select count(*) from public.collab_requests) = 0,
    'VISIBILITY: nick, a collaborator on P1, does not see its requests (owner-side only)');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.decide_collab_request(%L, true) $q$, pg_temp.get('req_frank'))) = '42501',
    'DECIDE: nick, a collaborator who could share P1 himself, cannot GRANT a request on it: only the owner company decides');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.decide_collab_request(%L, false) $q$, pg_temp.get('req_frank'))) = '42501',
    'DECIDE: nor DECLINE one');
end $$;

select pg_temp.act_as('bob');
do $$
declare r record; g record; q record;
begin
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.decide_collab_request(%L, null) $q$, pg_temp.get('req_frank'))) = '22023',
    'DECIDE: neither grant nor decline raises 22023');

  select * into r from public.decide_collab_request(pg_temp.get('req_frank'), true);
  perform pg_temp.assert(r.status = 'shared' and r.grant_id is not null,
    'GRANT: bob (an ordinary BI member) grants frank''s request: shared (got ' || coalesce(r.status, '-') || ')');
  perform pg_temp.put('g_frank_p1', r.grant_id);
  select * into g from public.collaborators where id = r.grant_id;
  perform pg_temp.assert(g.project_id = pg_temp.get('p1') and g.grantee_user_id = pg_temp.u('frank')
      and g.kind = 'shared' and g.granted_by = pg_temp.u('bob') and g.granted_by_name = 'Bob Builder'
      and g.grantee_name = 'Frank Framer',
    'GRANT: an ordinary personal grant exists, with granted_by = bob — written by share_project_with_person as the decider');
  select * into q from public.collab_requests where id = pg_temp.get('req_frank');
  perform pg_temp.assert(q.status = 'granted' and q.decided_by = pg_temp.u('bob')
      and q.decided_by_name = 'Bob Builder' and q.decided_at = now(),
    'GRANT: the request is marked granted, by bob');

  select * into r from public.decide_collab_request(pg_temp.get('req_frank'), false);
  perform pg_temp.assert(r.status = 'already-granted' and r.grant_id is null,
    'DECIDE: deciding it again is already-granted, and changes nothing');
  perform pg_temp.assert((select status from public.collab_requests where id = pg_temp.get('req_frank')) = 'granted',
    'and it stays granted');
end $$;

select pg_temp.act_as('frank');
do $$
declare r record;
begin
  perform pg_temp.assert(pg_temp.versions(pg_temp.get('p1')) = 2 and pg_temp.reads(pg_temp.get('p1')) = 1,
    'GRANT: frank now reads P1 in full through RLS');
  perform pg_temp.assert(
    (select bool_and((document -> 'state' ->> 'priceModifier')::numeric = 1.3777)
       from public.project_versions where project_id = pg_temp.get('p1')),
    'GRANT: with priceModifier present — a grant is a handoff, costs included (24)');
  perform pg_temp.assert(pg_temp.access_of(pg_temp.get('p1')) = 'full',
    'GRANT: the browse row is now marked full');
  perform pg_temp.assert(pg_temp.properly_redacted(pg_temp.bv(pg_temp.get('p1'), pg_temp.get('p1_v2'))),
    'A GRANTEE WHO IS ALSO SEED-ENTITLED reaches the full document through the grant, and the browse path still redacts');
  perform pg_temp.assert(pg_temp.same_set(pg_temp.money_projects_reached(), pg_temp.expected_money_projects('frank')),
    'MARGIN, EVERY PATH, after the grant: exactly his own company''s and his grants''');
  perform pg_temp.assert(pg_temp.same_set(pg_temp.expected_money_projects('frank'), array[pg_temp.get('rf1'), pg_temp.get('p1')]),
    'fixture sanity: Rare House and P1');
  select * into r from public.request_project_access(pg_temp.get('p1'), null);
  perform pg_temp.assert(r.status = 'already-has-access', 'asking again is already-has-access');
  perform pg_temp.assert((select status from public.collab_requests where id = pg_temp.get('req_frank')) = 'granted',
    'frank sees his request as granted');
end $$;

-- A decline writes no grant, carries no reason, and leaves the project browsable.
select pg_temp.act_as('nick');
do $$
declare r record;
begin
  select * into r from public.request_project_access(pg_temp.get('p2'), null);
  perform pg_temp.assert(r.status = 'requested' and (select message from public.collab_requests where id = r.request_id) is null,
    'nick asks on P2 with no note');
  perform pg_temp.put('req_nick', r.request_id);
end $$;

select pg_temp.act_as('alice');
do $$
declare r record;
begin
  select * into r from public.decide_collab_request(pg_temp.get('req_nick'), false);
  perform pg_temp.assert(r.status = 'declined' and r.grant_id is null,
    'DECLINE: alice (a BI admin) declines: declined (got ' || coalesce(r.status, '-') || ')');
end $$;

select pg_temp.act_as('nick');
do $$
declare r record; q record;
begin
  perform pg_temp.assert(
    (select count(*) from public.collaborators where project_id = pg_temp.get('p2') and grantee_user_id = pg_temp.u('nick')) = 0,
    'DECLINE: no grant is written');
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p2')) = 0 and pg_temp.versions(pg_temp.get('p2')) = 0,
    'DECLINE: the declined requester still reads 0');
  select * into q from public.collab_requests where id = pg_temp.get('req_nick');
  perform pg_temp.assert(q.status = 'declined' and q.decided_by_name = 'Alice Admin' and q.decided_at = now(),
    'DECLINE: nick sees Declined on his own request, with who and when');
  perform pg_temp.assert(pg_temp.properly_redacted(pg_temp.bv(pg_temp.get('p2'), pg_temp.get('p2_v1'))),
    'DECLINE: the project is still browsable, still redacted');
  -- Re-asking is a new row (no notification channel, so nothing to spam).
  select * into r from public.request_project_access(pg_temp.get('p2'), 'please reconsider');
  perform pg_temp.assert(r.status = 'requested' and r.request_id <> pg_temp.get('req_nick'),
    'DECLINE: re-asking after a decline is a new request');
  perform pg_temp.put('req_nick2', r.request_id);
end $$;

reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform pg_temp.assert(
    (select array_agg(column_name::text order by ordinal_position) from information_schema.columns
      where table_schema = 'public' and table_name = 'collab_requests')
      = array['id', 'project_id', 'requested_by', 'requested_by_name', 'message', 'status', 'created_at',
              'decided_by', 'decided_by_name', 'decided_at'],
    'NO REASON ON A DECLINE (Open Item 4): collab_requests has exactly the plan''s columns and no reason field');
end $$;
set local role authenticated;

-- The platform admin decides; the grant names pat.
select pg_temp.act_as('pat');
do $$
declare r record;
begin
  select * into r from public.decide_collab_request(pg_temp.get('req_nick2'), true);
  perform pg_temp.assert(r.status = 'shared'
      and (select granted_by from public.collaborators where id = r.grant_id) = pg_temp.u('pat'),
    'GRANT: a platform admin may decide, and the grant names them');
end $$;

-- A grant that arrives from elsewhere first.
select pg_temp.act_as('dave');
do $$
declare r record;
begin
  select * into r from public.request_project_access(pg_temp.get('p2'), null);
  perform pg_temp.assert(r.status = 'requested', 'dave asks on P2');
  perform pg_temp.put('req_dave', r.request_id);
end $$;

select pg_temp.act_as('erin');
do $$
declare r record;
begin
  select * into r from public.share_project_with_person(pg_temp.get('p2'), 'dave@seed.test');
  perform pg_temp.assert(r.status = 'shared', 'erin shares P2 with dave directly, before anyone decides');
  perform pg_temp.put('g_dave_p2', r.grant_id);
end $$;

select pg_temp.act_as('bob');
do $$
declare r record;
begin
  select * into r from public.decide_collab_request(pg_temp.get('req_dave'), true);
  perform pg_temp.assert(r.status = 'already-shared' and r.grant_id = pg_temp.get('g_dave_p2'),
    'GRANT FROM ELSEWHERE FIRST: granting is already-shared, naming erin''s grant (got ' || coalesce(r.status, '-') || ')');
  perform pg_temp.assert(
    (select granted_by from public.collaborators where id = pg_temp.get('g_dave_p2')) = pg_temp.u('erin')
    and (select count(*) from public.collaborators where project_id = pg_temp.get('p2') and grantee_user_id = pg_temp.u('dave')) = 1,
    'and erin''s grant stands, unduplicated');
  perform pg_temp.assert((select status from public.collab_requests where id = pg_temp.get('req_dave')) = 'granted',
    'and the request is closed as granted');
end $$;

-- The requester joins the owner company before anyone decides.
select pg_temp.act_as('fiona');
do $$
declare r record;
begin
  select * into r from public.request_project_access(pg_temp.get('p2'), null);
  perform pg_temp.assert(r.status = 'requested', 'fiona asks on P2');
  perform pg_temp.put('req_fiona', r.request_id);
end $$;

reset role;
select set_config('request.jwt.claims', '', true);
set local app.operator = 'on';
insert into public.memberships (user_id, company_id, level) values (pg_temp.u('fiona'), pg_temp.co('BI'), 'member');
set local app.operator = '';
set local role authenticated;

select pg_temp.act_as('bob');
do $$
declare r record;
begin
  select * into r from public.decide_collab_request(pg_temp.get('req_fiona'), true);
  perform pg_temp.assert(r.status = 'already-member' and r.grant_id is null,
    'REQUESTER JOINED THE OWNER: granting is already-member, and writes no grant (decision 6)');
  perform pg_temp.assert((select status from public.collab_requests where id = pg_temp.get('req_fiona')) = 'granted',
    'and the request is closed as granted');
end $$;

reset role;
select set_config('request.jwt.claims', '', true);
set local app.operator = 'on';
delete from public.memberships where user_id = pg_temp.u('fiona') and company_id = pg_temp.co('BI');
set local app.operator = '';
set local role authenticated;

-- A company that has left the consortium: follow the flag (28), both halves.
do $$
begin
  begin
    reset role;
    perform set_config('request.jwt.claims', '', true);
    perform set_config('app.operator', 'on', true);
    update public.companies set is_seed_member = false where id = pg_temp.co('NF');
    perform set_config('app.operator', '', true);
    set local role authenticated;

    perform pg_temp.act_as('frank');
    perform pg_temp.assert(
      (select array_agg(name order by name) from public.browse_companies())
        = array['Building Integrity', 'Rare Forms', 'The Seed Collaborative'],
      'FLAG OFF: New Frameworks drops out of frank''s company list');
    perform pg_temp.assert(not (pg_temp.get('nf1') = any (pg_temp.browse_ids())),
      'FLAG OFF: and its project drops out of his browse set');
    perform pg_temp.assert(
      pg_temp.sqlstate_of(format($q$ select public.browse_version(%L, %L) $q$, pg_temp.get('nf1'), pg_temp.get('nf1_v1'))) = '42501',
      'FLAG OFF: and browse_version serves it to nobody');
    perform pg_temp.assert(
      pg_temp.sqlstate_of(format($q$ select public.request_project_access(%L, null) $q$, pg_temp.get('nf1'))) = '42501',
      'FLAG OFF: and nobody may ask about it');

    perform pg_temp.act_as('nick');
    perform pg_temp.assert((select count(*) from public.browse_companies()) = 0 and cardinality(pg_temp.browse_ids()) = 0,
      'FLAG OFF: nick, whose only company left, browses nothing');
    perform pg_temp.assert(
      pg_temp.sqlstate_of(format($q$ select public.request_project_access(%L, null) $q$, pg_temp.get('p2'))) = '42501',
      'FLAG OFF: and may ask about nothing');
    perform pg_temp.assert(pg_temp.reads(pg_temp.get('nf1')) = 1,
      'FLAG OFF: and still reads his own company''s work the normal way');

    raise exception 'undo' using errcode = 'ZZ001';
  exception when sqlstate 'ZZ001' then null;
  end;
end $$;

do $$ begin
  perform pg_temp.assert(
    (select is_seed_member from public.companies where id = pg_temp.co('NF')) is not false,
    'undo sanity: New Frameworks is back in the consortium');
end $$;

-- ===========================================================================
-- 7. Two-factor
-- ===========================================================================
select pg_temp.act_as('frank');
do $$
declare r record;
begin
  select * into r from public.request_project_access(pg_temp.get('p2'), null);
  perform pg_temp.assert(r.status = 'requested', 'premise: frank asks on P2 (for the aal checks)');
  perform pg_temp.put('req_frank_p2', r.request_id);
end $$;

reset role;
select set_config('request.jwt.claims', '', true);
set local app.operator = 'on';
insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at) values
  (gen_random_uuid(), pg_temp.u('frank'), 'totp', 'verified', now(), now()),
  (gen_random_uuid(), pg_temp.u('bob'),   'totp', 'verified', now(), now());
set local app.operator = '';
set local role authenticated;

select pg_temp.act_as('frank', 'aal1');
do $$ begin
  perform pg_temp.assert((select count(*) from public.browse_companies()) = 0,
    'TWO-FACTOR: frank, with a verified factor at aal1, gets no companies');
  perform pg_temp.assert(cardinality(pg_temp.browse_ids()) = 0, 'TWO-FACTOR: and no projects');
  perform pg_temp.assert((select count(*) from public.browse_versions(pg_temp.get('p2'))) = 0,
    'TWO-FACTOR: and no versions');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.browse_version(%L, %L) $q$, pg_temp.get('p2'), pg_temp.get('p2_v1'))) = '42501',
    'TWO-FACTOR: browse_version raises at aal1 and serves nothing');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.request_project_access(%L, null) $q$, pg_temp.get('s1'))) = '42501',
    'TWO-FACTOR: request_project_access raises at aal1');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.decide_collab_request(%L, false) $q$, pg_temp.get('req_frank_p2'))) = '42501',
    'TWO-FACTOR: decide_collab_request raises at aal1');
  perform pg_temp.assert((select count(*) from public.collab_requests) = 0,
    'TWO-FACTOR: and he reads none of his own requests');
end $$;

select pg_temp.act_as('bob', 'aal1');
do $$ begin
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.decide_collab_request(%L, true) $q$, pg_temp.get('req_frank_p2'))) = '42501',
    'TWO-FACTOR: bob, an owner member with a verified factor, cannot grant at aal1');
  -- A decline writes no grant, so share_project_with_person's own aal check
  -- never runs for it: decide_collab_request's own check is the only gate.
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.decide_collab_request(%L, false) $q$, pg_temp.get('req_frank_p2'))) = '42501',
    'TWO-FACTOR: nor decline at aal1');
  perform pg_temp.assert((select count(*) from public.collab_requests) = 0,
    'TWO-FACTOR: nor read requests at aal1');
end $$;

select pg_temp.act_as('frank', 'aal2');
do $$ begin
  perform pg_temp.assert((select count(*) from public.browse_companies()) = 4
      and cardinality(pg_temp.browse_ids()) = 8
      and (select count(*) from public.browse_versions(pg_temp.get('p2'))) = 1,
    'TWO-FACTOR: at aal2 every browse listing returns');
  perform pg_temp.assert(pg_temp.properly_redacted(pg_temp.bv(pg_temp.get('p2'), pg_temp.get('p2_v1'))),
    'TWO-FACTOR: at aal2 browse_version serves, redacted');
  perform pg_temp.assert(
    (select status from public.request_project_access(pg_temp.get('s1'), null)) = 'requested',
    'TWO-FACTOR: at aal2 request_project_access works');
end $$;

select pg_temp.act_as('bob', 'aal2');
do $$ begin
  perform pg_temp.assert(
    (select status from public.decide_collab_request(pg_temp.get('req_frank_p2'), false)) = 'declined',
    'TWO-FACTOR: at aal2 bob decides');
end $$;

reset role;
select set_config('request.jwt.claims', '', true);
set local app.operator = 'on';
delete from auth.mfa_factors where user_id in (pg_temp.u('frank'), pg_temp.u('bob'));
set local app.operator = '';
set local role authenticated;

-- ===========================================================================
-- 8. Privileges
-- ===========================================================================
reset role;
select set_config('request.jwt.claims', '', true);
do $$
declare t text; p text; fn text;
begin
  foreach t in array array['public.collab_requests', 'public.browse_schema_redaction'] loop
    foreach p in array array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger'] loop
      perform pg_temp.assert(not has_table_privilege('anon', t, p), 'PRIVILEGES: anon must hold no ' || p || ' on ' || t);
      perform pg_temp.assert(not has_table_privilege('service_role', t, p), 'PRIVILEGES: service_role must hold no ' || p || ' on ' || t);
    end loop;
    perform pg_temp.assert((select relrowsecurity from pg_class where oid = t::regclass),
      'PRIVILEGES: row level security is enabled on ' || t);
  end loop;

  perform pg_temp.assert(has_table_privilege('authenticated', 'public.collab_requests', 'select'),
    'PRIVILEGES: authenticated holds select on collab_requests');
  foreach p in array array['insert', 'update', 'delete', 'truncate', 'references', 'trigger'] loop
    perform pg_temp.assert(not has_table_privilege('authenticated', 'public.collab_requests', p),
      'PRIVILEGES: authenticated must hold no ' || p || ' on collab_requests');
  end loop;
  foreach p in array array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger'] loop
    perform pg_temp.assert(not has_table_privilege('authenticated', 'public.browse_schema_redaction', p),
      'PRIVILEGES: authenticated must hold no ' || p || ' on browse_schema_redaction');
  end loop;
  perform pg_temp.assert(
    exists (select 1 from pg_policy where polrelid = 'public.collab_requests'::regclass and not polpermissive),
    'PRIVILEGES: the restrictive two-factor policy exists on collab_requests');
  perform pg_temp.assert(
    (select array_agg(policyname::text order by policyname) from pg_policies
      where schemaname = 'public' and tablename in ('collab_requests', 'browse_schema_redaction'))
      = array['collab_requests_require_aal', 'collab_requests_select'],
    'PRIVILEGES: collab_requests has exactly its select and two-factor policies; browse_schema_redaction has none');

  foreach fn in array array[
    'public.browse_companies()',
    'public.browse_projects(uuid,text)',
    'public.browse_versions(uuid)',
    'public.browse_version(uuid,uuid)',
    'public.request_project_access(uuid,text)',
    'public.decide_collab_request(uuid,boolean)',
    'public.shareable_companies()'
  ] loop
    perform pg_temp.assert(not has_function_privilege('anon', fn, 'execute'), 'PRIVILEGES: anon must not be able to call ' || fn);
    perform pg_temp.assert(has_function_privilege('authenticated', fn, 'execute'), 'PRIVILEGES: authenticated must be able to call ' || fn);
    perform pg_temp.assert((select prosecdef from pg_proc where oid = fn::regprocedure), 'PRIVILEGES: ' || fn || ' is SECURITY DEFINER');
  end loop;
  foreach p in array array['authenticated', 'anon', 'service_role'] loop
    perform pg_temp.assert(not has_function_privilege(p, 'public.browse_redact(jsonb,integer)', 'execute'),
      'PRIVILEGES: ' || p || ' must not be able to call the redactor directly');
    perform pg_temp.assert(not has_function_privilege(p, 'public.browse_author_name(text,text)', 'execute'),
      'PRIVILEGES: ' || p || ' must not be able to call the author-name mask directly');
  end loop;
  perform pg_temp.assert(
    not exists (select 1 from aclexplode((select proacl from pg_proc where oid = 'public.browse_author_name(text,text)'::regprocedure)) a
                 where a.privilege_type = 'EXECUTE' and a.grantee = 0),
    'PRIVILEGES: PUBLIC must not be able to call the author-name mask');
  perform pg_temp.assert(
    not exists (select 1 from aclexplode((select proacl from pg_proc where oid = 'public.browse_redact(jsonb,integer)'::regprocedure)) a
                 where a.privilege_type = 'EXECUTE' and a.grantee = 0),
    'PRIVILEGES: PUBLIC must not be able to call the redactor');
end $$;
set local role authenticated;

-- ===========================================================================
-- 9. Backups — a browse-only project is in no company's backup
-- ===========================================================================
-- The 3E cursor walks exactly two sources, through the caller's RLS:
--   owned:   projects      where company_id         = <company>
--   granted: collaborators where grantee_company_id = <company>
-- P2 and Seed House are browse-only for frank. Neither enumeration reaches
-- them, whatever company he asks about.
select pg_temp.act_as('frank');
do $$
declare c uuid;
begin
  perform pg_temp.assert(pg_temp.properly_redacted(pg_temp.bv(pg_temp.get('p2'), pg_temp.get('p2_v1'))),
    'premise: P2 IS browsable by frank');
  foreach c in array array[pg_temp.co('RF'), pg_temp.co('BI'), pg_temp.co('SEED'), pg_temp.co('NF')] loop
    perform pg_temp.assert(
      (select count(*) from public.projects where company_id = c and id in (pg_temp.get('p2'), pg_temp.get('s1'))) = 0,
      'BACKUPS: the owned enumeration returns 0 rows for a browse-only project');
    perform pg_temp.assert(
      (select count(*) from public.collaborators where grantee_company_id = c and project_id in (pg_temp.get('p2'), pg_temp.get('s1'))) = 0,
      'BACKUPS: the granted enumeration returns 0 rows for a browse-only project');
  end loop;
end $$;

-- ===========================================================================
-- Deleting accounts — a pending request goes with the requester's account
-- ===========================================================================
select pg_temp.act_as('fiona');
do $$
declare r record;
begin
  select * into r from public.request_project_access(pg_temp.get('p1'), null);
  perform pg_temp.assert(r.status = 'requested', 'fiona asks on P1');
end $$;

-- From a direct connection with NO operator opt-in and no JWT — the shape of a
-- Supabase dashboard / GoTrue admin delete.
reset role;
select set_config('request.jwt.claims', '', true);
do $$
declare v_state text;
begin
  perform pg_temp.assert(not public.is_privileged_caller(), 'premise: no operator opt-in');
  perform pg_temp.assert((select count(*) from public.collab_requests where requested_by = pg_temp.u('fiona')) = 2,
    'premise: fiona has two requests, one pending');
  v_state := pg_temp.sqlstate_of(format($q$ delete from auth.users where id = %L $q$, pg_temp.u('fiona')));
  perform pg_temp.assert(v_state is null,
    'deleting fiona''s account with no operator opt-in SUCCEEDS (got ' || coalesce(v_state, 'success') || ')');
  perform pg_temp.assert((select count(*) from public.collab_requests where requested_by = pg_temp.u('fiona')) = 0,
    'and removes every request she made, the pending one included (the FK cascade)');

  -- The decider's side is FK-less: deleting bob keeps the record of what he decided.
  v_state := pg_temp.sqlstate_of(format($q$ delete from auth.users where id = %L $q$, pg_temp.u('bob')));
  perform pg_temp.assert(v_state is null,
    'deleting bob''s account SUCCEEDS (got ' || coalesce(v_state, 'success') || ')');
  perform pg_temp.assert(
    (select decided_by = pg_temp.u('bob') and decided_by_name = 'Bob Builder' and status = 'granted'
       from public.collab_requests where id = pg_temp.get('req_frank')),
    'NO FK ON decided_by: the request bob granted still names him');
end $$;

do $$ begin
  raise notice 'stage4_rls: ALL ASSERTIONS PASSED';
end $$;

rollback;
