-- Stage 5 RLS verification — WHAT A BACKUP READS WHEN A PLATFORM ADMIN TAKES IT
-- FOR A COMPANY HE IS NOT A MEMBER OF.
--
-- Ends with "stage5_platform_backup_rls: ALL ASSERTIONS PASSED" or aborts on
-- the first failure.
--
-- LOCAL OR STAGING ONLY. NEVER THE LIVE PROJECT. There is a guard below that
-- refuses to run on any database with memberships, projects, grants or access
-- requests in it; live has all four. This suite WRITES AND DELETES ROWS ON
-- PURPOSE — running it anywhere real would be exactly the accident it is about.
-- It ends in ROLLBACK, like every other suite here, but do not rely on that.
--
-- HOW TO RUN (see supabase/README.md, "Stage 5 → Verifying locally"):
--   local_shim.sql, then 0001-0010, then stage1_rls.test.sql,
--   stage2_rls.test.sql, stage2_concurrency.test.sh, stage3_rls.test.sql,
--   stage3_concurrency.test.sh, stage5_rls.test.sql (all must still pass),
--   then this file.
--   ⚠ stage4_rls.test.sql CANNOT pass on a database with 0010 applied — its
--   fail-closed assertion for format 25 is exactly what 0010 satisfies. Stage 4
--   is verified on 0001-0009; this suite on 0001-0010.
--
-- ⚠ IT ADDS NO MIGRATION AND DEPENDS ON NONE. THERE IS NO 0011. Everything it
-- drives was enforced by 0002 (companies), 0006 (projects, versions), 0008
-- (grants) and 0009 (access requests). This suite exists because NOTHING
-- CURRENTLY PINS IT.
--
-- ── WHY THIS FILE EXISTS, STATED PRECISELY ─────────────────────────────────
--
-- A platform admin can already download a per-company backup for EVERY
-- company: `computeEntitlements` (apps/web/app/auth/actingAs.ts) gives him an
-- entitlement with `source: "platform-admin"` for every company, and
-- `checkBackupAccess` (apps/web/app/cloud/backupRouteLogic.ts) admits "a
-- company admin of the verified acting-as company, OR A PLATFORM ADMIN ACTING
-- AS IT". So when he switches to Rare Forms and presses Download backup, the
-- Stage 2D/3E walk runs over a company he holds NO MEMBERSHIP IN, and every
-- row it gets comes to it through `is_platform_admin()` inside a policy — not
-- through `is_member_of`, which is false for him everywhere.
--
-- THAT DEPENDENCE IS INVISIBLE IN THE APP AND UNTESTED ANYWHERE. Narrow any one
-- of the five policies below and the backup does not error: it produces a
-- SHORTER ZIP, or a zip with a company's name and no files under it, and the
-- manifest agrees with itself because `collectCompanyBackup` counts what it
-- received. A backup that quietly holds less than it says is the one failure
-- mode the whole design exists to prevent, so the policies are asserted here BY
-- DEFINITION as well as by behaviour, and section 0 runs FIRST so a narrowing
-- fails by name rather than showing up later as a missing file.
--
-- ⚠ IT IS NOT A TEST OF A PLATFORM-WIDE WALK. No such walk exists; Tommy
-- answered "one per company" on 2026-09-27. Every read asserted here is a read
-- the SHIPPED per-company backup already makes.
--
-- EVERY ASSERTION RUNS AS AN ORDINARY MEMBER, WITHOUT THE OPERATOR OPT-IN,
-- unless it is about the platform admin. The people are Stage 4's and Stage 5's:
-- Building Integrity (bob, an ordinary member; alice, its admin), Rare Forms
-- (frank), The Seed Collaborative (dave), New Frameworks (nick), pat the
-- platform admin, and henry with no membership at all.
--
-- NO ASSERTION IS SWALLOWED. pg_temp.assert raises P0001. One helper catches
-- exceptions — pg_temp.sqlstate_of — and it wraps only the statement under
-- test.
--
-- ── THE MUTATIONS THIS SUITE IS MEASURED BY ────────────────────────────────
--
-- "We mutation-tested it" is not a claim without the mutations named, so:
--   1. widen `projects_select` to `true`
--        -> "bob reads 0 of Rare Forms' projects" must FAIL.
--   2. drop the `is_platform_admin()` clause from `companies_select`
--        -> "pat enumerates all four companies" must FAIL.
--   3. drop the restrictive `project_versions_require_aal` policy
--        -> "an enrolled platform admin on an aal1 session reads 0 documents"
--           must FAIL.
--   4. `grant select on public.project_versions to service_role`
--        -> "service_role holds nothing on project_versions" must FAIL.
--   5. widen `collab_requests_select` to `using (true)` — or to
--      `using (true or is_platform_admin())`, which the substring check this
--      assertion replaced let through
--        -> "collab_requests_select is exactly its three clauses" must FAIL.
--           This is the one policy here with NO behavioural backstop (the
--           fixture inserts no requests), so the definition is all there is.
--   6. `alter policy companies_select ... to anon, authenticated`
--        -> "companies_select is granted to `authenticated` alone" must FAIL.
--   7. the same on `project_versions_select`
--        -> its own roles assertion must FAIL.
--   8. `grant select on public.projects to anon`
--        -> "nor on projects, so the project LIST is not readable without a
--           session" must FAIL.
--   9. `grant select on public.companies to anon`
--        -> "nor on companies, so not even the list of company names a backup
--           is chosen from" must FAIL.
--  10. give pat a real membership AND narrow `memberships_select` so he cannot
--      see his own row
--        -> "pat holds NO membership anywhere, counted PAST RLS" must FAIL.
--           Before that premise was counted past RLS it read through pat's own
--           view — the one view a policy bug could make true BY HIDING THE ROW.
--           A premise a bug can satisfy is not a premise; this is the mutation
--           that proves it now cannot.
-- Each is a one-line change applied after 0010 and before this file.
-- 6-9 were run and each failed by name; 5's second form and all of 6-9 passed
-- the SUBSTRING-era suite green, which is why they are listed rather than
-- assumed. A widening is the dangerous direction and it was the unguarded one.

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
  select set_config('stage5pb.' || k, v::text, true);
$$;

create or replace function pg_temp.get(k text)
returns uuid language plpgsql as $$
declare v text := nullif(current_setting('stage5pb.' || k, true), '');
begin
  if v is null then
    raise exception 'test bug: nothing stored under %', k;
  end if;
  return v::uuid;
end;
$$;

-- A project document with a MARGIN IN IT. 1.3777 is the existing Stage 4
-- fixture sentinel — an arbitrary value that appears nowhere else, so "the
-- margin survived the read" is checkable as text. It is not a claim about a
-- real price, and nothing here computes with it.
create or replace function pg_temp.doc(p_name text)
returns jsonb language sql as $$
  select jsonb_build_object(
    'schemaVersion', 25,
    'savedAt', '2026-09-27T12:00:00.000Z',
    'state', jsonb_build_object('projectName', p_name, 'role', 'public', 'zipCode', '65201',
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

-- Counts past RLS, as the test's owner: what is REALLY there, whatever the
-- caller under test can see. Every "X reads N rows" assertion below is paired
-- with one of these, because "the caller saw 0" and "there were 0" are
-- different facts and only the pair distinguishes them.
--
-- ⚠ THAT SENTENCE IS NOW LITERALLY TRUE, AND WAS NOT (fixed 2026-09-27). The
-- suite shipped with inline pairs on bob's and dave's counts only; alice's,
-- frank's, nick's, henry's, the no-subject caller's and section 4's rested on the
-- one fixture-sanity block instead. Substantively the distinction held — that
-- block asserts four companies, four projects and seven versions before any
-- assertion runs, so no zero in this file could have been a zero fixture — but
-- the claim was stronger than the file, and alice's zeros are the ones most
-- worth pinning where they are read ("Admin of a company is not admin of the
-- platform").
create or replace function pg_temp.really_all_companies()
returns bigint language sql security definer as $$ select count(*) from public.companies; $$;

create or replace function pg_temp.really_all_projects()
returns bigint language sql security definer as $$ select count(*) from public.projects; $$;

create or replace function pg_temp.really_projects_of(p_company uuid)
returns bigint language sql security definer as $$
  select count(*) from public.projects where company_id = p_company;
$$;

create or replace function pg_temp.really_versions(p uuid)
returns bigint language sql security definer as $$
  select count(*) from public.project_versions where project_id = p;
$$;

-- One row, counted past RLS: for the assertions that ask about a SINGLE company
-- or project row rather than a set, so "she cannot see it" and "it is not there"
-- stay different facts at that granularity too.
create or replace function pg_temp.really_company(p_company uuid)
returns bigint language sql security definer as $$
  select count(*) from public.companies where id = p_company;
$$;

create or replace function pg_temp.really_project(p_project uuid)
returns bigint language sql security definer as $$
  select count(*) from public.projects where id = p_project;
$$;

-- Section 1's premise is "pat holds NO membership anywhere", and read through
-- his own view that is exactly the sentence RLS could have made true by hiding
-- one. Counted past RLS it is a fact about the fixture.
create or replace function pg_temp.really_memberships_of(p_user uuid)
returns bigint language sql security definer as $$
  select count(*) from public.memberships where user_id = p_user;
$$;

create or replace function pg_temp.really_grants_to(p_company uuid)
returns bigint language sql security definer as $$
  select count(*) from public.collaborators where grantee_company_id = p_company;
$$;

create or replace function pg_temp.really_all_versions()
returns bigint language sql security definer as $$ select count(*) from public.project_versions; $$;

create or replace function pg_temp.really_margin(p_version uuid)
returns text language sql security definer as $$
  select document -> 'state' ->> 'priceModifier' from public.project_versions where id = p_version;
$$;

-- REFUSE TO RUN ON A DATABASE THAT HAS PEOPLE, PROJECTS, GRANTS OR REQUESTS.
do $$
begin
  if exists (select 1 from public.memberships) then
    raise exception 'stage5_platform_backup_rls.test.sql refuses to run here: this database already has memberships, so it is not a fresh or staging one. THIS SUITE WRITES AND DELETES ROWS. Never run supabase/tests/ against the live project.';
  end if;
  if exists (select 1 from public.projects) then
    raise exception 'stage5_platform_backup_rls.test.sql refuses to run here: this database already has projects. THIS SUITE WRITES AND DELETES ROWS. Never run supabase/tests/ against the live project.';
  end if;
  if exists (select 1 from public.collaborators) then
    raise exception 'stage5_platform_backup_rls.test.sql refuses to run here: this database already has collaborator grants. Never run supabase/tests/ against the live project.';
  end if;
  if exists (select 1 from public.collab_requests) then
    raise exception 'stage5_platform_backup_rls.test.sql refuses to run here: this database already has access requests. Never run supabase/tests/ against the live project.';
  end if;
end $$;

-- ===========================================================================
-- 0. THE FIVE POLICY DEFINITIONS A CROSS-COMPANY BACKUP RESTS ON.
--
-- These run FIRST and read `pg_policies` directly, so NARROWING ANY OF THEM
-- FAILS HERE BY NAME rather than three sections later as "a company's files
-- are missing from the zip". The spec's own claim is that "every read the walk
-- needs is already permitted"; this is that sentence, checked rather than
-- believed.
--
-- ⚠ A NOTE ON WHAT THE SPEC'S TABLE SAYS vs WHAT THE DATABASE SAYS.
-- The plan's section 5 quotes `projects_select` as
-- "is_member_of(company_id) or is_platform_admin()", which is 0006's text.
-- 0008 (Stage 3) ADDED a third clause, `holds_project_grant(id)`, so the live
-- policy has three. The platform-admin clause — the only one this suite is
-- about — is unchanged, but the assertion below names all three, because a
-- test that quoted the spec instead of the database would have failed for the
-- wrong reason.
-- ===========================================================================
do $$
declare q text; c text; r text; permissive_kind text;
begin
  -- (i) every company's id and name: the acting-as switcher's list, and the
  --     company row the backup's own manifest and zip file name come from.
  select regexp_replace(replace(coalesce(qual, ''), 'public.', ''), '\s+', '', 'g'), cmd, array_to_string(roles, ',')
    into q, c, r from pg_policies
   where schemaname = 'public' and tablename = 'companies' and policyname = 'companies_select';
  perform pg_temp.assert(q like '%ORis_platform_admin()%',
    'companies_select still admits a platform admin — without this he cannot even SEE the company he is backing up (got '
      || coalesce(q, '<no such policy>') || ')');
  perform pg_temp.assert(q = '(is_member_of(id)OR(is_consortiumANDis_seed_entitled())ORis_platform_admin())',
    'companies_select is exactly its three clauses, and nothing wider (got ' || coalesce(q, '<no such policy>') || ')');
  perform pg_temp.assert(c = 'SELECT' and r = 'authenticated',
    'companies_select is a SELECT policy granted to `authenticated` alone (got ' || coalesce(c, 'null') || ' / '
      || coalesce(r, 'null') || ')');

  -- (ii) every project row of the company being backed up.
  select regexp_replace(replace(coalesce(qual, ''), 'public.', ''), '\s+', '', 'g'), cmd, array_to_string(roles, ',')
    into q, c, r from pg_policies
   where schemaname = 'public' and tablename = 'projects' and policyname = 'projects_select';
  perform pg_temp.assert(q = '(is_member_of(company_id)ORis_platform_admin()ORholds_project_grant(id))',
    'projects_select is exactly membership, platform admin or a grant — not wider, and NOT narrower (got '
      || coalesce(q, '<no such policy>') || ')');
  perform pg_temp.assert(c = 'SELECT' and r = 'authenticated',
    'projects_select is a SELECT policy granted to `authenticated` alone (got ' || coalesce(c, 'null') || ' / '
      || coalesce(r, 'null') || ')');

  -- (iii) every version's metadata AND its `document` — the files in the zip.
  select regexp_replace(replace(coalesce(qual, ''), 'public.', ''), '\s+', '', 'g'), cmd, array_to_string(roles, ',')
    into q, c, r from pg_policies
   where schemaname = 'public' and tablename = 'project_versions' and policyname = 'project_versions_select';
  perform pg_temp.assert(q = 'can_read_project(project_id)',
    'project_versions_select is exactly can_read_project(project_id) — the document is served through that helper and nothing else (got '
      || coalesce(q, '<no such policy>') || ')');
  perform pg_temp.assert(c = 'SELECT' and r = 'authenticated',
    'project_versions_select is a SELECT policy granted to `authenticated` alone — which is ALSO what makes an anon grant inert (got '
      || coalesce(c, 'null') || ' / ' || coalesce(r, 'null') || ')');

  -- and the helper it delegates to. A policy that reads right is no use if the
  -- function under it stopped admitting a platform admin.
  perform pg_temp.assert(
    regexp_replace(pg_get_functiondef('public.can_read_project(uuid)'::regprocedure), '\s+', ' ', 'g')
      like '%is_platform_admin()%',
    'can_read_project still admits a platform admin — this is what serves every DOCUMENT in a cross-company backup');
  perform pg_temp.assert(
    regexp_replace(pg_get_functiondef('public.can_read_project(uuid)'::regprocedure), '\s+', ' ', 'g')
      like '%holds_project_grant(%',
    'and still admits a grant holder, which is what puts a GRANTED project in a company backup (Stage 3E)');

  -- (iv) grants, which `collaborators_select` serves through the same helper.
  --      The manifest does not record them today, but the 3E walk reads the
  --      `collaborators` table to find granted projects at all.
  select regexp_replace(replace(coalesce(qual, ''), 'public.', ''), '\s+', '', 'g')
    into q from pg_policies
   where schemaname = 'public' and tablename = 'collaborators' and policyname = 'collaborators_select';
  perform pg_temp.assert(q = 'can_read_project(project_id)',
    'collaborators_select is can_read_project(project_id) — so the granted phase of a backup reads grants through the same helper (got '
      || coalesce(q, '<no such policy>') || ')');

  -- (v) access requests. Not in any backup, and deliberately so; asserted
  --     because `collab_requests_select` NAMES is_platform_admin() outright and
  --     the plan cites it, so a later narrowing should be visible here too.
  --
  -- ⚠ EXACT EQUALITY, NOT A SUBSTRING, and this one needs it MOST of the five.
  -- The fixture inserts NO `collab_requests` rows at all — the refuse-to-run
  -- guard above aborts if any exist — so unlike the other four there is no
  -- behavioural assertion underneath this. A substring check for
  -- "OR is_platform_admin()" passed a policy widened to `true or
  -- is_platform_admin()`, which is the WIDENING direction and the dangerous
  -- one. With no row to contradict it, the definition is the only backstop
  -- there is, so it is pinned whole.
  select regexp_replace(replace(coalesce(qual, ''), 'public.', ''), '\s+', '', 'g'), cmd, array_to_string(roles, ',')
    into q, c, r from pg_policies
   where schemaname = 'public' and tablename = 'collab_requests' and policyname = 'collab_requests_select';
  perform pg_temp.assert(
    q = '((requested_by=auth.uid())ORis_member_of(project_owner_company_id(project_id))ORis_platform_admin())',
    'collab_requests_select is exactly its three clauses — the requester, the owning company''s members, and a platform admin — and NOTHING WIDER (got '
      || coalesce(q, '<no such policy>') || ')');
  perform pg_temp.assert(c = 'SELECT' and r = 'authenticated',
    'collab_requests_select is a SELECT policy granted to `authenticated` alone (got ' || coalesce(c, 'null') || ' / '
      || coalesce(r, 'null') || ')');

  -- THE RESTRICTIVE AAL POLICIES STAY ON TOP, and that is correct rather than
  -- inconvenient: an ENROLLED platform admin on a password-only session must
  -- read nothing. Section 4 exercises it; this pins that the policy exists AND
  -- that it is RESTRICTIVE, because a permissive copy of it would be a policy
  -- that WIDENS access instead of narrowing it.
  for q, permissive_kind in
    select policyname, permissive from pg_policies
     where schemaname = 'public'
       and policyname in ('companies_require_aal', 'projects_require_aal', 'project_versions_require_aal',
                          'collaborators_require_aal', 'collab_requests_require_aal')
  loop
    perform pg_temp.assert(permissive_kind = 'RESTRICTIVE', q || ' is RESTRICTIVE, not permissive');
  end loop;
  perform pg_temp.assert(
    (select count(*) from pg_policies
      where schemaname = 'public' and permissive = 'RESTRICTIVE'
        and policyname in ('companies_require_aal', 'projects_require_aal', 'project_versions_require_aal',
                           'collaborators_require_aal', 'collab_requests_require_aal')) = 5,
    'all five *_require_aal policies are present and restrictive — project_versions_require_aal above all, since it is what guards the DOCUMENTS');

  -- Nothing was ADDED either. A sixth select policy on project_versions would
  -- be a second, unreviewed way to reach a document.
  perform pg_temp.assert(
    (select array_agg(policyname::text order by policyname) from pg_policies
      where schemaname = 'public' and tablename = 'project_versions')
      = array['project_versions_delete', 'project_versions_insert', 'project_versions_require_aal',
              'project_versions_select'],
    'project_versions still has exactly four policies, by name: this slice added none');
end $$;

-- THE GRANTS UNDER THE POLICIES. The backup route uses the caller's own
-- JWT-bound client and there is no admin client anywhere on that path; these
-- assert that reaching for one would not have helped, which is what makes
-- "authorization lives in the database" true rather than a convention.
do $$
begin
  perform pg_temp.assert(has_table_privilege('authenticated', 'public.project_versions', 'select'),
    'authenticated holds SELECT on project_versions, so project_versions_select is the thing deciding');
  perform pg_temp.assert(has_table_privilege('authenticated', 'public.companies', 'select'),
    'and on companies');
  perform pg_temp.assert(not has_table_privilege('service_role', 'public.project_versions', 'select'),
    'service_role holds NOTHING on project_versions: a route that reached for the admin client could not read one document');
  perform pg_temp.assert(not has_table_privilege('service_role', 'public.projects', 'select'),
    'nor on projects');
  perform pg_temp.assert(not has_table_privilege('anon', 'public.project_versions', 'select'),
    'and neither can anon — the publishable key that ships in the browser is not a way in');
  -- ⚠ ALL THREE TABLES, not just the documents. An anon grant would in practice
  -- be inert, because every select policy above is `to authenticated` and is
  -- asserted to be — but that mitigation is one assertion away from changing,
  -- and pinning it for only one of the three tables was the gap here.
  perform pg_temp.assert(not has_table_privilege('anon', 'public.projects', 'select'),
    'nor on projects, so the project LIST is not readable without a session either');
  perform pg_temp.assert(not has_table_privilege('anon', 'public.companies', 'select'),
    'nor on companies, so not even the list of company names a backup is chosen from');
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

-- Four companies, and DELIBERATELY ONE WITH NOTHING IN IT.
--   BI:   p1 (three versions, 'current'), p2 (one version, 'past')
--   RF:   rf1 (two versions, 'current') — the cross-company case
--   NF:   nf1 (one version, 'proposals') — head is version 1
--   SEED: nothing at all. A company a backup would name and put no directory
--         under; here, the company pat must still be able to ENUMERATE, so
--         "Seed is missing" and "Seed has nothing" stay distinguishable.
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

  -- One grant from BI to Rare Forms, so the GRANTED phase of a company backup
  -- has something to walk, and `holds_project_grant` has a real role here.
  perform public.share_project_with_company(pg_temp.get('p1'), pg_temp.co('RF'));
end $$;

select pg_temp.act_as('frank');
do $$
declare r record; s record;
begin
  select * into r from public.create_project(pg_temp.co('RF'), 'current', pg_temp.doc('Rare House'), 'first cut');
  perform pg_temp.put('rf1', r.project_id); perform pg_temp.put('rf1_v1', r.version_id);
  select * into s from public.save_project_version(r.project_id, r.version_id, pg_temp.doc('Rare House'), 'after the site visit');
  perform pg_temp.put('rf1_v2', s.version_id);
end $$;

select pg_temp.act_as('nick');
do $$
declare r record;
begin
  select * into r from public.create_project(pg_temp.co('NF'), 'proposals', pg_temp.doc('Frameworks Barn'), null);
  perform pg_temp.put('nf1', r.project_id); perform pg_temp.put('nf1_v1', r.version_id);
end $$;

reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform pg_temp.assert(pg_temp.really_all_companies() = 4, 'fixture sanity: four companies');
  perform pg_temp.assert(pg_temp.really_all_projects() = 4, 'fixture sanity: four projects');
  perform pg_temp.assert(pg_temp.really_all_versions() = 7, 'fixture sanity: seven versions in total');
  perform pg_temp.assert(pg_temp.really_projects_of(pg_temp.co('SEED')) = 0,
    'fixture sanity: The Seed Collaborative owns NOTHING — the "named but empty" company');
  perform pg_temp.assert(pg_temp.really_margin(pg_temp.get('rf1_v1')) = '1.3777',
    'fixture sanity: Rare Forms'' stored document really does carry the margin, so section 2 is testing a read and not an empty document');
end $$;
set local role authenticated;

-- ===========================================================================
-- 1. THE PLATFORM ADMIN ENUMERATES EVERY COMPANY — INCLUDING THE EMPTY ONE.
--
-- This is the first read a backup needs and the one nothing else would notice
-- losing: without the company row he cannot name the zip, fill the manifest's
-- `company`, or find the company in the acting-as switcher to start at all.
-- ⚠ MUTATION 2 TARGET.
-- ===========================================================================
select pg_temp.act_as('pat');
do $$ begin
  perform pg_temp.assert(pg_temp.really_memberships_of(pg_temp.u('pat')) = 0,
    'premise: pat holds NO membership anywhere, counted PAST RLS — every row he reads below comes through is_platform_admin(), never is_member_of (got '
      || pg_temp.really_memberships_of(pg_temp.u('pat')) || ')');
  perform pg_temp.assert((select count(*) from public.memberships where user_id = pg_temp.u('pat')) = 0,
    'and he reads none of his own either, so the premise is not an artifact of what memberships_select shows him');
  perform pg_temp.assert((select count(*) from public.companies) = 4,
    'pat enumerates all four companies (got ' || (select count(*) from public.companies) || ' of '
      || pg_temp.really_all_companies() || ')');
  perform pg_temp.assert((select name from public.companies where id = pg_temp.co('RF')) = 'Rare Forms',
    'and reads Rare Forms'' NAME, which is what the zip file name and the manifest are built from');
  perform pg_temp.assert((select count(*) from public.companies where id = pg_temp.co('SEED')) = 1,
    'including The Seed Collaborative, which owns nothing: a company with nothing must be distinguishable from a company that is missing (got '
      || (select count(*) from public.companies where id = pg_temp.co('SEED')) || ' of '
      || pg_temp.really_company(pg_temp.co('SEED')) || ')');
end $$;

-- ===========================================================================
-- 2. AND READS EVERY PROJECT AND EVERY DOCUMENT OF A COMPANY HE IS NOT IN.
--
-- The rows the shipped per-company walk asks for, in the shape it asks for
-- them: the project list filtered by `company_id` and ordered by `id`, then
-- each version's named metadata columns, then each `document`.
-- ===========================================================================
do $$
declare v_doc jsonb; v_label text; v_author text; v_ids uuid[];
begin
  -- the project list, per company, as `.eq('company_id', …).order('id')` asks
  perform pg_temp.assert((select count(*) from public.projects where company_id = pg_temp.co('RF')) = 1,
    'pat reads Rare Forms'' one project (got ' || (select count(*) from public.projects where company_id = pg_temp.co('RF'))
      || ' of ' || pg_temp.really_projects_of(pg_temp.co('RF')) || ')');
  perform pg_temp.assert((select count(*) from public.projects where company_id = pg_temp.co('BI')) = 2,
    'and Building Integrity''s two (got ' || (select count(*) from public.projects where company_id = pg_temp.co('BI'))
      || ' of ' || pg_temp.really_projects_of(pg_temp.co('BI')) || ')');
  perform pg_temp.assert((select count(*) from public.projects where company_id = pg_temp.co('NF')) = 1,
    'and New Frameworks'' one (got ' || (select count(*) from public.projects where company_id = pg_temp.co('NF'))
      || ' of ' || pg_temp.really_projects_of(pg_temp.co('NF')) || ')');
  perform pg_temp.assert((select count(*) from public.projects) = 4,
    'four projects across every company, with no membership anywhere (got ' || (select count(*) from public.projects)
      || ' of ' || pg_temp.really_all_projects() || ')');

  -- `head_version_number` and `folder`: the manifest's own fields, and what
  -- `findMissingVersions` compares a project's run against.
  perform pg_temp.assert((select head_version_number from public.projects where id = pg_temp.get('rf1')) = 2,
    'and Rare Forms'' head version number, which is what proves no version was skipped');
  perform pg_temp.assert((select folder from public.projects where id = pg_temp.get('nf1')) = 'proposals',
    'and the OWNER''s own folder label, which is the directory segment in the zip');
  perform pg_temp.assert((select head_version_number from public.projects where id = pg_temp.get('nf1')) = 1,
    'a project whose head IS version 1 reads as 1, not as 0 or null');

  -- the version list, ordered by number, as `.gt('version_number', …)` walks it
  select array_agg(id order by version_number) into v_ids
    from public.project_versions where project_id = pg_temp.get('rf1');
  perform pg_temp.assert(array_length(v_ids, 1) = 2,
    'pat lists BOTH of Rare Forms'' versions in number order (got ' || coalesce(array_length(v_ids, 1), 0)
      || ' of ' || pg_temp.really_versions(pg_temp.get('rf1')) || ')');
  perform pg_temp.assert(v_ids[1] = pg_temp.get('rf1_v1') and v_ids[2] = pg_temp.get('rf1_v2'),
    'in that order, and they are the two that were actually saved');
  perform pg_temp.assert((select count(*) from public.project_versions) = 7,
    'every version on the platform, across four companies (got ' || (select count(*) from public.project_versions)
      || ' of ' || pg_temp.really_all_versions() || ')');

  -- THE DOCUMENT ITSELF, COMPLETE. This is the assertion that connects to
  -- platformBackupRoundTrip.test.ts: the file written into the zip must carry
  -- `state.priceModifier`, because `parseProjectFile` REFUSES a document
  -- without it. A backup of a company he is not a member of that arrived
  -- redacted would produce files Load Project cannot open at all.
  select document into v_doc from public.project_versions where id = pg_temp.get('rf1_v1');
  perform pg_temp.assert(v_doc is not null,
    'pat reads the DOCUMENT of another company''s version — not just its metadata');
  perform pg_temp.assert(v_doc -> 'state' ->> 'priceModifier' = '1.3777',
    'and it still carries state.priceModifier, UNREDACTED: without it parseProjectFile refuses the file outright (got '
      || coalesce(v_doc -> 'state' ->> 'priceModifier', '<absent>') || ')');
  perform pg_temp.assert(v_doc ? 'redaction' = false,
    'and there is no redaction marker on it: this is the ordinary read path, NOT the browse path');

  -- The label and the author's name, unmasked. The browse path drops the
  -- label; this path serves it, and the manifest records both.
  select label, author_name into v_label, v_author
    from public.project_versions where id = pg_temp.get('rf1_v2');
  perform pg_temp.assert(v_label = 'after the site visit',
    'the version''s LABEL is served on this path (the browse path drops it) (got ' || coalesce(v_label, '<null>') || ')');
  perform pg_temp.assert(v_author = 'Frank Framer',
    'and the author''s real name, unmasked (got ' || coalesce(v_author, '<null>') || ')');

  -- The owner's name through 0008's helper, which is how a GRANTED project's
  -- owner reaches the manifest when `companies_select` would not serve the row.
  perform pg_temp.assert(public.project_owner_company_name(pg_temp.get('p1')) = 'Building Integrity',
    'project_owner_company_name still answers for a platform admin — the manifest''s owner field on a granted entry');
end $$;

-- The grant rows the 3E granted phase walks, read cross-company.
do $$ begin
  perform pg_temp.assert((select count(*) from public.collaborators where grantee_company_id = pg_temp.co('RF')) = 1,
    'pat reads the one grant made TO Rare Forms, which is how a Rare Forms backup finds its granted project (got '
      || (select count(*) from public.collaborators where grantee_company_id = pg_temp.co('RF')) || ' of '
      || pg_temp.really_grants_to(pg_temp.co('RF')) || ')');
  perform pg_temp.assert(
    (select project_id from public.collaborators where grantee_company_id = pg_temp.co('RF')) = pg_temp.get('p1'),
    'and it points at Building Integrity''s p1, a project Rare Forms does not own');
end $$;

-- ===========================================================================
-- 3. AND NOBODY ELSE DOES. The same reads, from six other callers.
--
-- Each is paired with a count past RLS, because "the caller saw 0" and "there
-- were 0" are different facts. ⚠ MUTATION 1 TARGET is the first of these.
-- ===========================================================================

-- bob: an ordinary member of Building Integrity. His own company's backup is
-- his to take; Rare Forms' is not, and the route's acting-as check is not what
-- stops him — this is.
select pg_temp.act_as('bob');
do $$ begin
  perform pg_temp.assert((select count(*) from public.projects where company_id = pg_temp.co('RF')) = 0,
    'bob, an ordinary Building Integrity member, reads 0 of Rare Forms'' projects (got '
      || (select count(*) from public.projects where company_id = pg_temp.co('RF')) || ', and there really are '
      || pg_temp.really_projects_of(pg_temp.co('RF')) || ')');
  perform pg_temp.assert((select count(*) from public.project_versions where project_id = pg_temp.get('rf1')) = 0,
    'and 0 of its versions, so 0 documents (got '
      || (select count(*) from public.project_versions where project_id = pg_temp.get('rf1')) || ' of '
      || pg_temp.really_versions(pg_temp.get('rf1')) || ')');
  perform pg_temp.assert((select count(*) from public.companies) = 2,
    'and enumerates only his own company and the consortium, not all four (got '
      || (select count(*) from public.companies) || ' of ' || pg_temp.really_all_companies() || ')');
  perform pg_temp.assert((select count(*) from public.projects where company_id = pg_temp.co('BI')) = 2,
    'premise: he really does read HIS OWN company''s two projects — so the refusals above are about the company line, not about him (got '
      || (select count(*) from public.projects where company_id = pg_temp.co('BI')) || ' of '
      || pg_temp.really_projects_of(pg_temp.co('BI')) || ')');
end $$;

-- alice: a COMPANY ADMIN of Building Integrity. `checkBackupAccess` admits a
-- company admin, so she is the caller most likely to be assumed equivalent to
-- a platform admin. Admin of a company is not admin of the platform.
select pg_temp.act_as('alice');
do $$ begin
  perform pg_temp.assert((select count(*) from public.projects where company_id = pg_temp.co('RF')) = 0,
    'alice, a COMPANY ADMIN, reads 0 of Rare Forms'' projects (got '
      || (select count(*) from public.projects where company_id = pg_temp.co('RF')) || ', and there really are '
      || pg_temp.really_projects_of(pg_temp.co('RF')) || ')');
  perform pg_temp.assert((select count(*) from public.project_versions where project_id = pg_temp.get('rf1')) = 0,
    'and 0 of its versions: being able to download YOUR company''s backup is not being able to download anyone else''s (got '
      || (select count(*) from public.project_versions where project_id = pg_temp.get('rf1')) || ' of '
      || pg_temp.really_versions(pg_temp.get('rf1')) || ')');
  perform pg_temp.assert((select count(*) from public.companies where id = pg_temp.co('RF')) = 0,
    'and cannot even see the Rare Forms company row (got '
      || (select count(*) from public.companies where id = pg_temp.co('RF')) || ' of '
      || pg_temp.really_company(pg_temp.co('RF')) || ')');
end $$;

-- frank: Rare Forms' own member, who ALSO holds a company grant on BI's p1.
-- He gets p1 — that is Stage 3E, "a share is a share" — and nothing else of
-- Building Integrity's.
select pg_temp.act_as('frank');
do $$ begin
  perform pg_temp.assert((select count(*) from public.projects where id = pg_temp.get('p1')) = 1,
    'frank reads BI''s p1 through his company''s grant — the granted phase of a Rare Forms backup (got '
      || (select count(*) from public.projects where id = pg_temp.get('p1')) || ' of '
      || pg_temp.really_project(pg_temp.get('p1')) || ')');
  perform pg_temp.assert((select document -> 'state' ->> 'priceModifier' from public.project_versions
                           where id = pg_temp.get('p1_v1')) = '1.3777',
    'and its document COMPLETE, margin included: a grant is a share, and a granted project is in the zip in full');
  perform pg_temp.assert((select count(*) from public.projects where id = pg_temp.get('p2')) = 0,
    'but 0 of BI''s OTHER project, which no grant reaches (got '
      || (select count(*) from public.projects where id = pg_temp.get('p2')) || ' of '
      || pg_temp.really_project(pg_temp.get('p2')) || ')');
  perform pg_temp.assert((select count(*) from public.projects where company_id = pg_temp.co('NF')) = 0,
    'and 0 of New Frameworks'' (got ' || (select count(*) from public.projects where company_id = pg_temp.co('NF'))
      || ' of ' || pg_temp.really_projects_of(pg_temp.co('NF')) || ')');
  perform pg_temp.assert((select count(*) from public.projects) = 2,
    'two projects in total: his own, and the one shared with his company (got ' || (select count(*) from public.projects)
      || ' of ' || pg_temp.really_all_projects() || ')');
end $$;

-- dave: a Seed Collaborative member, seed-entitled, who can BROWSE Building
-- Integrity's tree. Browsing is not a backup, and this is the row that says so.
select pg_temp.act_as('dave');
do $$ begin
  perform pg_temp.assert(public.is_seed_entitled(),
    'premise: dave really is seed-entitled, so the refusals below are about the raw read and not about entitlement');
  perform pg_temp.assert((select count(*) from public.project_versions) = 0,
    'dave, who can BROWSE every seed company''s tree, reads 0 raw versions and therefore 0 documents (got '
      || (select count(*) from public.project_versions) || ' of ' || pg_temp.really_all_versions() || ')');
  perform pg_temp.assert((select count(*) from public.projects) = 0,
    'and 0 project rows: browsing goes through browse_projects, never through projects_select (got '
      || (select count(*) from public.projects) || ' of ' || pg_temp.really_all_projects() || ')');
end $$;

-- nick: New Frameworks' member. His own company only.
select pg_temp.act_as('nick');
do $$ begin
  perform pg_temp.assert((select count(*) from public.projects) = 1,
    'nick reads only New Frameworks'' own project (got ' || (select count(*) from public.projects) || ' of '
      || pg_temp.really_all_projects() || ')');
  perform pg_temp.assert((select count(*) from public.project_versions where project_id = pg_temp.get('rf1')) = 0,
    'and 0 of Rare Forms'' versions (got '
      || (select count(*) from public.project_versions where project_id = pg_temp.get('rf1')) || ' of '
      || pg_temp.really_versions(pg_temp.get('rf1')) || ')');
end $$;

-- henry: signed in, no membership anywhere. The shape of an account that has
-- been removed from its company but still holds a session.
select pg_temp.act_as('henry');
do $$ begin
  perform pg_temp.assert((select count(*) from public.companies) = 0,
    'henry, with no membership at all, enumerates 0 companies (got ' || (select count(*) from public.companies) || ' of '
      || pg_temp.really_all_companies() || ')');
  perform pg_temp.assert((select count(*) from public.projects) = 0,
    'and 0 projects (got ' || (select count(*) from public.projects) || ' of ' || pg_temp.really_all_projects() || ')');
  perform pg_temp.assert((select count(*) from public.project_versions) = 0,
    'and 0 versions (got ' || (select count(*) from public.project_versions) || ' of '
      || pg_temp.really_all_versions() || ')');
end $$;

-- A caller with no subject on the request at all: an expired or broken token
-- reaching PostgREST. FAIL CLOSED, not open.
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform pg_temp.assert(not public.is_platform_admin(),
    'is_platform_admin() is FALSE, not null and not an error, when there is no subject — the route''s fail-closed check has the same answer underneath it');
  perform pg_temp.assert((select count(*) from public.companies) = 0,
    'a caller with no subject enumerates 0 companies (got ' || (select count(*) from public.companies) || ' of '
      || pg_temp.really_all_companies() || ')');
  perform pg_temp.assert((select count(*) from public.project_versions) = 0,
    'and reads 0 documents (got ' || (select count(*) from public.project_versions) || ' of '
      || pg_temp.really_all_versions() || ')');
end $$;

-- ===========================================================================
-- 4. TWO-FACTOR IS NOT WAIVED FOR THE ACCOUNT THAT CAN BACK UP EVERYTHING.
--
-- Two-factor is optional for everyone, the platform admin included, and that
-- accepted risk is recorded in the spec. What must NOT happen is an ENROLLED
-- platform admin pulling every company's documents out of a password-only
-- session — which is the one operation where the whole platform's cost
-- information leaves the database in one artifact.
-- ⚠ MUTATION 3 TARGET.
-- ===========================================================================
reset role;
select set_config('request.jwt.claims', '', true);
set local app.operator = 'on';
insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
values (gen_random_uuid(), pg_temp.u('pat'), 'totp', 'verified', now(), now());
set local app.operator = '';
set local role authenticated;

select pg_temp.act_as('pat', 'aal1');
do $$ begin
  perform pg_temp.assert(not public.meets_required_aal(),
    'premise: pat is enrolled, so a password-only session does not meet his required aal');
  perform pg_temp.assert((select count(*) from public.project_versions) = 0,
    'an ENROLLED platform admin on an aal1 session reads 0 documents (got '
      || (select count(*) from public.project_versions) || ' of ' || pg_temp.really_all_versions() || ')');
  perform pg_temp.assert((select count(*) from public.projects) = 0,
    'and 0 project rows (got ' || (select count(*) from public.projects) || ' of ' || pg_temp.really_all_projects() || ')');
  perform pg_temp.assert((select count(*) from public.companies) = 0,
    'and 0 companies, so the backup cannot even begin (got ' || (select count(*) from public.companies) || ' of '
      || pg_temp.really_all_companies() || ')');
end $$;

select pg_temp.act_as('pat', 'aal2');
do $$ begin
  perform pg_temp.assert(public.meets_required_aal(), 'premise: aal2 meets it');
  perform pg_temp.assert((select count(*) from public.project_versions) = 7,
    'and reads all seven documents once the second factor has actually been presented (got '
      || (select count(*) from public.project_versions) || ' of ' || pg_temp.really_all_versions() || ')');
  perform pg_temp.assert((select count(*) from public.companies) = 4,
    'and all four companies (got ' || (select count(*) from public.companies) || ' of '
      || pg_temp.really_all_companies() || ')');
end $$;

reset role;
set local app.operator = 'on';
delete from auth.mfa_factors where user_id = pg_temp.u('pat');
set local app.operator = '';
set local role authenticated;

-- ===========================================================================
-- 5. A BACKUP IS A READ, AND ONLY A READ.
--
-- Being able to download every company's documents must not have made a
-- platform admin able to CHANGE one. 0006's append-only guarantee and the
-- deferred single-version delete both sit right beside this capability, and a
-- backup is the operation most likely to be given a "while we're here" write.
-- ===========================================================================
select pg_temp.act_as('pat');
do $$
declare v_state text;
begin
  v_state := pg_temp.sqlstate_of(format($q$ update public.project_versions set label = 'edited by the backup' where id = %L $q$,
                                        pg_temp.get('rf1_v1')));
  perform pg_temp.assert(v_state is not null,
    'a platform admin cannot UPDATE a version he can read (got ' || coalesce(v_state, 'success') || ')');
  perform pg_temp.assert((select label from public.project_versions where id = pg_temp.get('rf1_v1')) = 'first cut',
    'and the label is unchanged');
  v_state := pg_temp.sqlstate_of(format($q$ delete from public.project_versions where id = %L $q$, pg_temp.get('rf1_v2')));
  perform pg_temp.assert(v_state = '42501',
    'and a direct single-version delete is STILL refused for him — deferred 2026-09-27, and this door stays shut (got '
      || coalesce(v_state, 'success') || ')');
  perform pg_temp.assert(pg_temp.really_versions(pg_temp.get('rf1')) = 2, 'both of Rare Forms'' versions are still there');
end $$;

do $$ begin
  raise notice 'stage5_platform_backup_rls: ALL ASSERTIONS PASSED';
end $$;

rollback;
