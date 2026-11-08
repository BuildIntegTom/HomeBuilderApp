-- Stage 6 RLS verification — share links (migration 0011).
--
-- Ends with "stage6_rls: ALL ASSERTIONS PASSED" or aborts on the first failure.
--
-- LOCAL OR STAGING ONLY. NEVER THE LIVE PROJECT. There is a guard below that
-- refuses to run on any database with memberships, projects or grants in it;
-- live has memberships.
--
-- HOW TO RUN (see supabase/README.md, "Stage 6 → Verifying locally"):
--   local_shim.sql, then 0001-0011, then stage1_rls.test.sql,
--   stage2_rls.test.sql, stage3_rls.test.sql, then this file.
--
-- WHAT THIS SUITE IS ABOUT. A share link is the only object in this schema
-- that a person outside every company can hold, so the assertions are weighted
-- towards the three things that would actually hurt:
--
--   1. SIGN-IN REQUIRED (Tommy's answer 2). `anon` can call exactly ONE
--      function here, and it returns no document, no project id and no email
--      address. Section 2.
--   2. A CLAIM IS AN ORDINARY GRANT. It reaches can_read_project the way every
--      other grant does, it shows how it was made, and it is removable by the
--      policy that already removes grants. Sections 4 and 6.
--   3. REVOKING A LINK AND REVOKING A CLAIM ARE TWO SEPARATE ACTS. Switching
--      the link off must not silently drop somebody who already came in, and
--      removing their grant must not need the link at all. Section 6.
--   4. A CLAIMED LINK IS VIEW ONLY, and "view only" has to mean every write,
--      not just the obvious one. Section 4b checks the FIVE separate paths a
--      write can take — saving a version, renaming, moving folders, sharing
--      onward, and minting a link — because tightening can_write_project
--      alone would have left two of them open. It also checks that the
--      grants every other path writes still mean read AND write.
--
-- And one assertion that is here to pin a DECISION rather than a mechanism:
-- section 7 proves `guard_project_columns` still refuses to move a project to
-- another company. Tommy's answer 3 ("ownership transfers") is NOT built, and
-- this file fails if a later migration quietly builds it without replacing
-- this assertion.
--
-- NO ASSERTION IS SWALLOWED. pg_temp.assert raises P0001. Every exception
-- handler is pg_temp.sqlstate_of / msg_of, which only ever wrap the statement
-- under test.
--
-- TIME. Every now() in one transaction is the same instant, so an EXPIRED link
-- cannot be made by waiting. Expired and revoked fixtures are written directly
-- as the table owner, which is also the only way to write an expiry in the
-- past: create_share_link refuses one, and section 3 asserts that it does.

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
    when 'alice' then 'aaaaaaaa-0000-0000-0000-000000000001'  -- BI admin, owner side
    when 'bob'   then 'bbbbbbbb-0000-0000-0000-000000000001'  -- BI member, owner side
    when 'carol' then 'cccccccc-0000-0000-0000-000000000001'  -- a stranger with a company
    when 'pat'   then 'ffffffff-0000-0000-0000-000000000001'  -- platform admin
    when 'frank' then 'f1f1f1f1-0000-0000-0000-000000000001'  -- RF, gets a person share
    when 'fiona' then 'f3f3f3f3-0000-0000-0000-000000000001'  -- RF, reached by a company grant
    when 'henry' then 'f5f5f5f5-0000-0000-0000-000000000001'  -- NO membership: the client
    when 'iris'  then 'f6f6f6f6-0000-0000-0000-000000000001'  -- NO membership: the stranger
  end)::uuid;
$$;

create or replace function pg_temp.co(p_name text)
returns uuid language sql immutable as $$
  select (case p_name
    when 'BI' then '11111111-0000-0000-0000-000000000001'
    when 'RF' then '22222222-0000-0000-0000-000000000001'
    when 'NM' then '33333333-0000-0000-0000-000000000001'
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
  select set_config('stage6test.' || k, v::text, true);
$$;

create or replace function pg_temp.get(k text)
returns uuid language plpgsql as $$
declare v text := nullif(current_setting('stage6test.' || k, true), '');
begin
  if v is null then raise exception 'test bug: nothing stored under %', k; end if;
  return v::uuid;
end;
$$;

create or replace function pg_temp.doc(p_name text)
returns jsonb language sql as $$
  select jsonb_build_object(
    'schemaVersion', 24,
    'savedAt', '2026-11-08T12:00:00.000Z',
    'state', jsonb_build_object('projectName', p_name, 'priceModifier', 1.3, 'role', 'public'));
$$;

create or replace function pg_temp.sqlstate_of(p_sql text)
returns text language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlstate;
end;
$$;

create or replace function pg_temp.msg_of(p_sql text)
returns text language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlerrm;
end;
$$;

-- Row counts through the CALLER's RLS (pg_temp functions are security invoker).
create or replace function pg_temp.reads(p uuid)
returns bigint language sql as $$ select count(*) from public.projects where id = p $$;

create or replace function pg_temp.versions(p uuid)
returns bigint language sql as $$ select count(*) from public.project_versions where project_id = p $$;

create or replace function pg_temp.links_visible(p uuid)
returns bigint language sql as $$ select count(*) from public.share_links where project_id = p $$;

create or replace function pg_temp.grants_on(p uuid)
returns bigint language sql as $$ select count(*) from public.collaborators where project_id = p $$;

create or replace function pg_temp.shared_list(p_acting_as uuid)
returns uuid[] language sql as $$
  select coalesce(array_agg(project_id), '{}') from public.list_shared_projects(p_acting_as);
$$;

-- How list_shared_projects says this project reached the caller.
create or replace function pg_temp.vias(p_acting_as uuid, p uuid)
returns text[] language sql as $$
  select coalesce(array_agg(r.value ->> 'via' order by r.value ->> 'via'), '{}')
    from public.list_shared_projects(p_acting_as) l,
         jsonb_array_elements(l.reached_via) r
   where l.project_id = p;
$$;

create or replace function pg_temp.pending()
returns uuid[] language sql as $$
  select coalesce(array_agg(grant_id), '{}') from public.pending_share_notices();
$$;

-- The one-line token stand-in. The app passes a SHA-256 hex digest; the
-- database never sees the token, so for the schema's purposes a token hash is
-- any unique string and the suite says what each one stands for.
create or replace function pg_temp.hash_of(p_token text)
returns text language sql immutable as $$ select md5('stage6:' || p_token) $$;

-- ---------------------------------------------------------------------------
-- REFUSE TO RUN ON A DATABASE THAT HAS PEOPLE, PROJECTS, GRANTS OR LINKS.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.memberships) then
    raise exception 'stage6_rls.test.sql refuses to run here: this database already has memberships, so it is not a fresh or staging one. Never run supabase/tests/ against the live project.';
  end if;
  if exists (select 1 from public.projects) then
    raise exception 'stage6_rls.test.sql refuses to run here: this database already has projects. Never run supabase/tests/ against the live project.';
  end if;
  if exists (select 1 from public.collaborators) then
    raise exception 'stage6_rls.test.sql refuses to run here: this database already has collaborator grants. Never run supabase/tests/ against the live project.';
  end if;
  if exists (select 1 from public.share_links) then
    raise exception 'stage6_rls.test.sql refuses to run here: this database already has share links. Never run supabase/tests/ against the live project.';
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
  (pg_temp.u('pat'),   'pat@platform.test'),
  (pg_temp.u('frank'), 'frank@rareforms.test'),
  (pg_temp.u('fiona'), 'fiona@rareforms.test'),
  (pg_temp.u('henry'), 'henry@nowhere.test'),
  (pg_temp.u('iris'),  'iris@elsewhere.test');

update public.user_profiles set is_platform_admin = true where id = pg_temp.u('pat');
update public.user_profiles set display_name = 'Bob Builder'  where id = pg_temp.u('bob');
update public.user_profiles set display_name = 'Alice Admin'  where id = pg_temp.u('alice');
update public.user_profiles set display_name = 'Frank Framer' where id = pg_temp.u('frank');
update public.user_profiles set display_name = 'Henry Client' where id = pg_temp.u('henry');
-- iris and fiona deliberately have no display name: their snapshots fall back
-- to the email, which is the rule create_share_link and claim_share_link share
-- with prepare_project_version.

insert into public.companies (id, name, is_seed_member, is_consortium) values
  (pg_temp.co('BI'), 'Building Integrity', true,  false),
  (pg_temp.co('RF'), 'Rare Forms',         true,  false),
  (pg_temp.co('NM'), 'Nonmember Co',       false, false);

insert into public.memberships (user_id, company_id, level, created_at) values
  (pg_temp.u('alice'), pg_temp.co('BI'), 'admin',  now() - interval '30 days'),
  (pg_temp.u('bob'),   pg_temp.co('BI'), 'member', now() - interval '30 days'),
  (pg_temp.u('carol'), pg_temp.co('NM'), 'member', now() - interval '30 days'),
  (pg_temp.u('frank'), pg_temp.co('RF'), 'member', now() - interval '30 days'),
  (pg_temp.u('fiona'), pg_temp.co('RF'), 'member', now() - interval '30 days');

set local app.operator = '';
do $$ begin
  perform pg_temp.assert(not public.is_privileged_caller(),
    'the operator opt-in must be off before the assertions start');
end $$;

set local role authenticated;

-- P1 and P2, owned by Building Integrity, created by bob.
select pg_temp.act_as('bob');
do $$
declare r record;
begin
  select * into r from public.create_project(pg_temp.co('BI'), 'current', pg_temp.doc('Rogers-Sehorn ADU'), null);
  perform pg_temp.put('p1', r.project_id);
  select * into r from public.create_project(pg_temp.co('BI'), 'proposals', pg_temp.doc('Smith House'), null);
  perform pg_temp.put('p2', r.project_id);
end $$;

-- P1 is shared with frank (a person) and with Rare Forms (a company), so the
-- "already has access" branches below have something real to find. fiona is
-- reached ONLY by the company grant.
select pg_temp.act_as('bob');
do $$
declare r record;
begin
  select * into r from public.share_project_with_person(pg_temp.get('p1'), 'frank@rareforms.test');
  perform pg_temp.assert(r.status = 'shared', 'fixture: P1 is shared with frank');
  select * into r from public.share_project_with_company(pg_temp.get('p2'), pg_temp.co('RF'));
  perform pg_temp.assert(r.status = 'shared', 'fixture: P2 is shared with Rare Forms');
end $$;

-- ===========================================================================
-- 1. Making a link
-- ===========================================================================
select pg_temp.act_as('bob');
do $$
declare r record;
begin
  select * into r from public.create_share_link(
    pg_temp.get('p1'), pg_temp.hash_of('open'), now() + interval '90 days', null);
  perform pg_temp.put('l_open', r.link_id);
  perform pg_temp.assert(r.locked_email is null, 'an unlocked link stores no address');
  perform pg_temp.assert(r.expires_at > now(), 'and an expiry in the future');

  -- The locked one: Tommy's optional real gate, addressed to henry.
  select * into r from public.create_share_link(
    pg_temp.get('p1'), pg_temp.hash_of('locked'), now() + interval '90 days', '  HENRY@Nowhere.Test  ');
  perform pg_temp.put('l_locked', r.link_id);
  perform pg_temp.assert(r.locked_email = 'henry@nowhere.test',
    'a locked address is lowercased and trimmed, as invites.email is');

  perform pg_temp.assert(
    (select created_by_name from public.share_links where id = pg_temp.get('l_open')) = 'Bob Builder',
    'the sharer''s NAME is snapshotted, because user_profiles_select hides bob from another company');
  perform pg_temp.assert(
    (select created_by from public.share_links where id = pg_temp.get('l_open')) = pg_temp.u('bob'),
    'and so is who made it');
end $$;

do $$ begin
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.create_share_link(%L, 'x', now() - interval '1 day') $q$, pg_temp.get('p1'))) = '22023',
    'an expiry in the past is refused: a link must expire in the future');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.create_share_link(%L, '  ', now() + interval '1 day') $q$, pg_temp.get('p1'))) = '22023',
    'and a blank token hash is refused');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.create_share_link(%L, %L, now() + interval '1 day') $q$,
      pg_temp.get('p1'), pg_temp.hash_of('open'))) = '23505',
    'and the same token hash cannot be stored twice');
end $$;

-- A stranger cannot make a link, and gets the same answer for a project that
-- does not exist: a project id cannot be probed through sharing.
select pg_temp.act_as('carol');
do $$ begin
  perform pg_temp.assert(
    pg_temp.msg_of(format($q$ select public.create_share_link(%L, 'c', now() + interval '1 day') $q$, pg_temp.get('p1')))
    = pg_temp.msg_of($q$ select public.create_share_link('00000000-0000-0000-0000-000000000009', 'c', now() + interval '1 day') $q$),
    'a stranger gets ONE answer for "not yours" and "no such project"');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.create_share_link(%L, 'c', now() + interval '1 day') $q$, pg_temp.get('p1'))) = '42501',
    'and it is a 42501');
  perform pg_temp.assert(pg_temp.links_visible(pg_temp.get('p1')) = 0,
    'and a stranger sees no link on a project they cannot read');
end $$;

-- ⚠ A COLLABORATOR CAN MAKE A LINK. Pinned deliberately: a grant is read AND
-- write (0008 answer 4), so frank — who was shared P1, not given it — can hand
-- out a URL to it. That is not new reach (he could already share it onward to
-- a person or a company) but it is reach in a form that travels, and it is the
-- reason a read-only grant is its own stride. If a later migration adds one,
-- THIS ASSERTION IS WHERE THE CHANGE SHOWS UP.
select pg_temp.act_as('frank');
do $$
declare r record;
begin
  select * into r from public.create_share_link(
    pg_temp.get('p1'), pg_temp.hash_of('by-frank'), now() + interval '30 days', null);
  perform pg_temp.put('l_frank', r.link_id);
  perform pg_temp.assert(r.link_id is not null,
    'A COLLABORATOR CAN MINT A LINK, because creating one needs can_write_project and a grant is read AND write');
  perform pg_temp.assert(pg_temp.links_visible(pg_temp.get('p1')) = 3,
    'and a collaborator sees every link on the project, as they see the whole access list');
end $$;

-- ===========================================================================
-- 2. ⚠ SIGN-IN REQUIRED — what an unauthenticated visitor can reach
-- ===========================================================================
reset role;
select set_config('request.jwt.claims', '', true);

do $$ begin
  -- The privilege grid, asserted rather than assumed.
  perform pg_temp.assert(not has_table_privilege('anon', 'public.share_links', 'select'),
    'anon holds NO select on share_links');
  perform pg_temp.assert(not has_table_privilege('anon', 'public.share_links', 'insert')
    and not has_table_privilege('anon', 'public.share_links', 'update')
    and not has_table_privilege('anon', 'public.share_links', 'delete'),
    'and no write of any kind');
  perform pg_temp.assert(not has_table_privilege('service_role', 'public.share_links', 'select'),
    'service_role holds nothing either, as in 0006 and 0008');
  perform pg_temp.assert(has_table_privilege('authenticated', 'public.share_links', 'select')
    and not has_table_privilege('authenticated', 'public.share_links', 'insert')
    and not has_table_privilege('authenticated', 'public.share_links', 'update')
    and not has_table_privilege('authenticated', 'public.share_links', 'delete'),
    'authenticated holds select ONLY: every write goes through a function');

  perform pg_temp.assert(
    has_function_privilege('anon', 'public.share_link_preview(text)', 'execute'),
    'anon MAY preview a link, because that is who follows one');
  perform pg_temp.assert(
    not has_function_privilege('anon', 'public.claim_share_link(text)', 'execute'),
    '⚠ SIGN-IN REQUIRED: anon may NOT claim one');
  perform pg_temp.assert(
    not has_function_privilege('anon', 'public.create_share_link(uuid,text,timestamptz,text,boolean)', 'execute')
    and not has_function_privilege('anon', 'public.revoke_share_link(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.project_share_links(uuid)', 'execute'),
    'and may not make, revoke or list links');
  perform pg_temp.assert(
    not has_function_privilege('service_role', 'public.claim_share_link(text)', 'execute')
    and not has_function_privilege('service_role', 'public.create_share_link(uuid,text,timestamptz,text,boolean)', 'execute'),
    'nor may service_role');
end $$;

-- What the preview is ALLOWED to say. Checked against the function's own
-- signature, so adding a column later trips this rather than quietly leaking.
do $$
declare sig text := pg_get_function_result('public.share_link_preview(text)'::regprocedure);
begin
  perform pg_temp.assert(sig not like '%project_id%',
    '⚠ the preview returns NO project id: one would let the holder of a dead link ask other endpoints about the project');
  perform pg_temp.assert(sig not like '%token%',
    'and no token or hash');
  perform pg_temp.assert(sig not like '%document%' and sig not like '%version%'
    and sig not like '%price%' and sig not like '%panel%',
    'and no document, version, price or panel');
  perform pg_temp.assert(sig like '%locked_to_email boolean%',
    '⚠ whether a link is locked is a BOOLEAN: a leaked link must not become a leaked email address');
  perform pg_temp.assert(sig not like '%locked_email%',
    'and the address itself is not in the signature at all');
end $$;

-- And now actually call it with no session at all.
set local role anon;
do $$
declare r record;
begin
  select * into r from public.share_link_preview(pg_temp.hash_of('open'));
  perform pg_temp.assert(r.valid, 'a visitor with no account previews a live link as valid');
  perform pg_temp.assert(r.project_name = 'Rogers-Sehorn ADU',
    'and is told WHAT it is, which is what makes "sign in to see this" reasonable to ask');
  perform pg_temp.assert(r.owner_company_name = 'Building Integrity', 'and who owns it');
  perform pg_temp.assert(r.shared_by_name = 'Bob Builder', 'and who shared it');
  perform pg_temp.assert(r.locked_to_email = false, 'and that it is not locked');

  select * into r from public.share_link_preview(pg_temp.hash_of('locked'));
  perform pg_temp.assert(r.valid and r.locked_to_email = true, 'a locked link previews as locked');

  select * into r from public.share_link_preview(pg_temp.hash_of('never-minted'));
  perform pg_temp.assert(r.valid = false and r.reason = 'not_found', 'an unknown token is not_found');
  perform pg_temp.assert(r.project_name is null and r.owner_company_name is null
    and r.shared_by_name is null and r.locked_to_email is null and r.expires_at is null,
    'and discloses NOTHING: every other column is null');
end $$;

-- The table itself stays shut to a visitor even though the preview answered.
do $$ begin
  perform pg_temp.assert(pg_temp.sqlstate_of($q$ select count(*) from public.share_links $q$) = '42501',
    'and the visitor still cannot read the table the preview read');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.claim_share_link(%L) $q$, pg_temp.hash_of('open'))) = '42501',
    '⚠ and cannot claim: the function is not executable by anon');
end $$;

reset role;
set local role authenticated;

-- ===========================================================================
-- 3. The preview's other two answers, and what a signed-in stranger sees
-- ===========================================================================
-- An expired and a revoked link, written as the owner: create_share_link
-- refuses a past expiry (asserted in section 1) and every now() in this
-- transaction is the same instant, so there is no other way to make one.
reset role;
insert into public.share_links (project_id, token_hash, created_by, created_by_name, created_at, expires_at)
values (
  (select current_setting('stage6test.p1')::uuid), pg_temp.hash_of('stale'),
  pg_temp.u('bob'), 'Bob Builder', now() - interval '100 days', now() - interval '10 days');
set local role authenticated;

select pg_temp.act_as('bob');
do $$
declare r record;
begin
  select * into r from public.revoke_share_link(pg_temp.get('l_frank'));
  perform pg_temp.assert(r.revoked_at is not null, 'bob, an owner member, revokes the link FRANK made');
end $$;

set local role anon;
do $$
declare r record;
begin
  select * into r from public.share_link_preview(pg_temp.hash_of('stale'));
  perform pg_temp.assert(r.valid = false and r.reason = 'expired', 'an expired link previews as expired');
  perform pg_temp.assert(r.project_name = 'Rogers-Sehorn ADU',
    'and still names the design, so the visitor can ask for a fresh link by name');

  select * into r from public.share_link_preview(pg_temp.hash_of('by-frank'));
  perform pg_temp.assert(r.valid = false and r.reason = 'revoked', 'a revoked link previews as revoked');
end $$;
reset role;
set local role authenticated;

-- ===========================================================================
-- 4. ⚠ The claim — a URL becomes an ordinary grant
-- ===========================================================================
-- henry has no membership anywhere. He is the client in Tommy's own story.
select pg_temp.act_as('henry');
do $$ begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p1')) = 0,
    'before claiming, henry cannot read P1 at all');
  perform pg_temp.assert(cardinality(pg_temp.shared_list(null)) = 0, 'and has nothing shared with him');
end $$;

do $$
declare r record;
begin
  select * into r from public.claim_share_link(pg_temp.hash_of('open'));
  perform pg_temp.assert(r.status = 'claimed', 'henry claims the link');
  perform pg_temp.assert(r.project_id = pg_temp.get('p1'), 'and is told which project to open');
  perform pg_temp.put('g_henry', r.grant_id);
end $$;

do $$
declare g record;
begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p1')) = 1,
    '⚠ and NOW READS P1 — a claim reaches can_read_project the way every grant does');
  perform pg_temp.assert(not public.can_write_project(pg_temp.get('p1')),
    '⚠ but CANNOT WRITE it: a claimed link is view-only unless the link says otherwise');
  perform pg_temp.assert(pg_temp.get('p1') = any (pg_temp.shared_list(null)),
    'P1 is in his Shared with us, under no acting-as at all');
  perform pg_temp.assert(pg_temp.vias(null, pg_temp.get('p1')) = array['link'],
    '⚠ and it says VIA A LINK, not "shared with you by a person" — which is what 0008''s case would have said');

  select * into g from public.collaborators where id = pg_temp.get('g_henry');
  perform pg_temp.assert(g.kind = 'link', 'the grant records how it was made');
  perform pg_temp.assert(g.via_link_id = pg_temp.get('l_open'), 'and which link made it');
  perform pg_temp.assert(g.grantee_user_id = pg_temp.u('henry') and g.grantee_name = 'Henry Client',
    'the grantee is the claimer, snapshotted by name');
  perform pg_temp.assert(g.granted_by = pg_temp.u('bob') and g.granted_by_name = 'Bob Builder',
    '⚠ but granted_by is the LINK''S CREATOR, so the access list reads "shared by Bob Builder" rather than "henry granted himself access"');
  perform pg_temp.assert(cardinality(pg_temp.pending()) = 0,
    'and henry gets NO share notice for his own claim: pending_share_notices filters kind = ''shared''');
end $$;

-- Twice is once.
do $$
declare r record;
begin
  select * into r from public.claim_share_link(pg_temp.hash_of('open'));
  perform pg_temp.assert(r.status = 'already-claimed', 'claiming the same link again is already-claimed');
  perform pg_temp.assert(r.grant_id = pg_temp.get('g_henry'), 'naming the grant he already holds');
  perform pg_temp.assert(
    (select count(*) from public.collaborators
      where project_id = pg_temp.get('p1') and grantee_user_id = pg_temp.u('henry')) = 1,
    'and writes no second row');
end $$;

-- A different link to the same project is also already-claimed: the unique
-- index is per (project, person), not per link.
do $$
declare r record;
begin
  select * into r from public.claim_share_link(pg_temp.hash_of('locked'));
  perform pg_temp.assert(r.status = 'already-claimed',
    'a SECOND link to the same project gives henry nothing new, because he already holds a personal grant');
end $$;

-- ⚠ The locked link, claimed by the wrong person. iris is signed in, which is
-- all Tommy's answer 2 requires — and it is not enough here.
select pg_temp.act_as('iris');
do $$ begin
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.claim_share_link(%L) $q$, pg_temp.hash_of('locked'))) = '42501',
    '⚠ a LOCKED link refuses an account at another address, exactly as redeem_invite refuses a forwarded invite');
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p1')) = 0, 'and iris reads nothing');
  perform pg_temp.assert((select count(*) from public.collaborators where grantee_user_id = pg_temp.u('iris')) = 0,
    'and no row was written');
end $$;

-- ⚠ THE TRADE TOMMY ACCEPTED, STATED AS AN ASSERTION. An UNLOCKED link is
-- claimable by anyone who signs in — iris was sent nothing and is known to
-- nobody here. The sign-in records WHO came in; it does not gate WHETHER. This
-- assertion is the shape of that decision, and it is meant to be read by
-- anyone who later wonders whether a forwarded link works.
do $$
declare r record;
begin
  select * into r from public.claim_share_link(pg_temp.hash_of('open'));
  perform pg_temp.assert(r.status = 'claimed',
    '⚠ A FORWARDED UNLOCKED LINK WORKS: iris, who was sent nothing, signs in and claims it');
  perform pg_temp.put('g_iris', r.grant_id);
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p1')) = 1, 'and reads the whole design');
  perform pg_temp.assert(
    (select grantee_name from public.collaborators where id = pg_temp.get('g_iris')) = 'iris@elsewhere.test',
    'with her name — her email, having no display name — attached to it, which is what makes it visible rather than silent');
end $$;

-- The refusals. Nothing is written by any of them.
do $$ begin
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.claim_share_link(%L) $q$, pg_temp.hash_of('by-frank'))) = '22023',
    'a REVOKED link raises rather than answering with a status: the preview already said it was good, so this is a race');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.claim_share_link(%L) $q$, pg_temp.hash_of('stale'))) = '22023',
    'and so does an expired one');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.claim_share_link(%L) $q$, pg_temp.hash_of('never-minted'))) = '22023',
    'and an unknown token');
end $$;

-- Already in by another route: nothing written, and deliberately not.
select pg_temp.act_as('bob');
do $$
declare r record;
begin
  select * into r from public.claim_share_link(pg_temp.hash_of('open'));
  perform pg_temp.assert(r.status = 'already-has-access' and r.grant_id is null,
    'an OWNER MEMBER claiming a link to their own project gets no grant');
  perform pg_temp.assert((select count(*) from public.collaborators
    where project_id = pg_temp.get('p1') and grantee_user_id = pg_temp.u('bob')) = 0,
    '⚠ and no row: a personal grant would outlive the membership that made it unnecessary (decision 6)');
end $$;

select pg_temp.act_as('pat');
do $$
declare r record;
begin
  select * into r from public.claim_share_link(pg_temp.hash_of('open'));
  perform pg_temp.assert(r.status = 'already-has-access', 'and so does a platform admin');
end $$;

-- fiona reaches P2 only through the COMPANY grant to Rare Forms.
select pg_temp.act_as('bob');
do $$
declare r record;
begin
  select * into r from public.create_share_link(
    pg_temp.get('p2'), pg_temp.hash_of('p2'), now() + interval '7 days', null);
  perform pg_temp.put('l_p2', r.link_id);
end $$;

select pg_temp.act_as('fiona');
do $$
declare r record;
begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p2')) = 1, 'fiona already reads P2 through the Rare Forms grant');
  select * into r from public.claim_share_link(pg_temp.hash_of('p2'));
  perform pg_temp.assert(r.status = 'already-has-access' and r.grant_id is null,
    'so claiming adds nothing — a company grant is access, and a personal copy of it would outlive her membership');
  perform pg_temp.assert((select count(*) from public.collaborators
    where project_id = pg_temp.get('p2') and grantee_user_id = pg_temp.u('fiona')) = 0,
    'and no personal row was written');
end $$;

-- ===========================================================================
-- 4b. ⚠ VIEW ONLY has to mean EVERY write
-- ===========================================================================
-- henry holds a claimed, view-only grant. He can see the whole design — that
-- is the point of it — and there are FIVE separate paths a write could take.
-- Tightening can_write_project covers three of them; projects_update had to be
-- replaced for the other two, and this block is why that was not optional.
select pg_temp.act_as('henry');
do $$
declare v_head uuid;
begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p1')) = 1,
    'henry still READS the project in full — view-only is not half-blind');
  perform pg_temp.assert(pg_temp.versions(pg_temp.get('p1')) > 0,
    'and reads its version history');

  select v.id into v_head from public.project_versions v
   where v.project_id = pg_temp.get('p1')
   order by v.version_number desc limit 1;

  -- 1. Saving a version. Gated by 0006's policy AND 0006's trigger, both of
  --    which call can_write_project and neither of which was edited.
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.save_project_version(%L, %L, %L::jsonb, null) $q$,
      pg_temp.get('p1'), v_head, pg_temp.doc('Henry''s Edit'))) is not null,
    '1/5 he cannot SAVE A VERSION');
  -- 2. Renaming. rename_project needs projects_update for its `for update`.
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.rename_project(%L, 'Henry''s Name') $q$,
      pg_temp.get('p1'))) is not null,
    '2/5 he cannot RENAME it');
  -- 3. ⚠ Moving folders — a DIRECT update, which never touches
  --    can_write_project at all. This is the one the function-only change
  --    would have left open, and dragging a proposal out of a company's
  --    proposals queue is exactly the damage it would have done.
  update public.projects set folder = 'past' where id = pg_temp.get('p1');
  perform pg_temp.assert(
    (select folder from public.projects where id = pg_temp.get('p1')) = 'current',
    '3/5 he cannot MOVE IT BETWEEN FOLDERS — projects_update is why, not can_write_project');
  -- 4. Sharing it onward to a person.
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.share_project_with_person(%L, 'carol@nonmember.test') $q$,
      pg_temp.get('p1'))) = '42501',
    '4/5 he cannot SHARE IT ONWARD');
  -- 5. Minting a link of his own, which is how a view-only grant would
  --    otherwise launder itself into a writing one.
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.create_share_link(%L, 'henry', now() + interval '1 day') $q$,
      pg_temp.get('p1'))) = '42501',
    '5/5 he cannot MINT A LINK of his own');

  perform pg_temp.assert(
    (select not can_write from public.collaborators where id = pg_temp.get('g_henry')),
    'and the grant itself says can_write = false');
end $$;

-- ⚠ THE TWO COLUMN DEFAULTS, ASSERTED DIRECTLY. The whole safety argument for
-- this migration rests on them: can_write defaults TRUE so no existing grant
-- changes meaning, and grants_write defaults FALSE so a link is view-only
-- unless somebody says otherwise. Every other assertion in this file passes
-- an explicit value, so without this block a flipped default would ship
-- green — which is exactly what the mutation run caught on 2026-11-08.
reset role;
do $$
declare v_can_write text;
declare v_grants_write text;
begin
  select column_default into v_can_write
    from information_schema.columns
   where table_schema = 'public' and table_name = 'collaborators' and column_name = 'can_write';
  perform pg_temp.assert(v_can_write = 'true',
    '⚠ collaborators.can_write DEFAULTS TO TRUE, so no grant that exists today changes meaning');

  select column_default into v_grants_write
    from information_schema.columns
   where table_schema = 'public' and table_name = 'share_links' and column_name = 'grants_write';
  perform pg_temp.assert(v_grants_write = 'false',
    '⚠ share_links.grants_write DEFAULTS TO FALSE, so a link is view-only unless minted otherwise');

  perform pg_temp.assert(
    (select is_nullable from information_schema.columns
      where table_schema = 'public' and table_name = 'collaborators' and column_name = 'can_write') = 'NO',
    'and can_write is NOT NULL: there is no third, interpretable state');
end $$;

-- The function default matters too, and it is a different default from the
-- column's: a caller that names four arguments must still get a view-only
-- link. Checked by minting one with no fifth argument at all.
set local role authenticated;
select pg_temp.act_as('bob');
do $$
declare r record;
begin
  select * into r from public.create_share_link(
    pg_temp.get('p2'), pg_temp.hash_of('four-args'), now() + interval '1 day', null);
  perform pg_temp.assert(not r.grants_write,
    'create_share_link called WITHOUT p_grants_write mints a view-only link');
end $$;

-- ⚠ EVERY OTHER PATH STILL MEANS READ AND WRITE. 0008 answer 4 is unchanged
-- for a person share, a company share and a granted access request: the column
-- defaults to true and none of those three functions was edited.
select pg_temp.act_as('frank');
do $$ begin
  perform pg_temp.assert(public.can_write_project(pg_temp.get('p1')),
    'frank''s PERSON share is still read AND write — no existing grant changed meaning');
  perform pg_temp.assert(
    (select can_write from public.collaborators
      where project_id = pg_temp.get('p1') and grantee_user_id = pg_temp.u('frank')),
    'and its can_write took the column default rather than being set by anybody');
end $$;
select pg_temp.act_as('fiona');
do $$ begin
  perform pg_temp.assert(public.can_write_project(pg_temp.get('p2')),
    'and a COMPANY share is still read AND write');
end $$;

-- A link that deliberately grants write does, and says so up front.
select pg_temp.act_as('bob');
do $$
declare r record;
begin
  select * into r from public.create_share_link(
    pg_temp.get('p2'), pg_temp.hash_of('writing'), now() + interval '30 days', null, true);
  perform pg_temp.assert(r.grants_write,
    'a link minted with p_grants_write => true reports that it does');
end $$;
set local role anon;
do $$
declare r record;
begin
  select * into r from public.share_link_preview(pg_temp.hash_of('writing'));
  perform pg_temp.assert(r.grants_write, 'and the visitor is told BEFORE signing in');
  select * into r from public.share_link_preview(pg_temp.hash_of('locked'));
  perform pg_temp.assert(not r.grants_write, 'while a default link previews as view-only');
end $$;
reset role;
set local role authenticated;

select pg_temp.act_as('iris');
do $$
declare r record;
begin
  select * into r from public.claim_share_link(pg_temp.hash_of('writing'));
  perform pg_temp.assert(r.status = 'claimed' and r.can_write,
    'iris claims the writing link and gets write');
  perform pg_temp.assert(public.can_write_project(pg_temp.get('p2')), 'and can really write');
  perform pg_temp.put('g_iris_w', r.grant_id);
end $$;

-- ⚠ A SECOND LINK DOES NOT CHANGE AN ACCESS LEVEL SHE ALREADY HAS.
select pg_temp.act_as('bob');
do $$
declare r record;
begin
  select * into r from public.create_share_link(
    pg_temp.get('p2'), pg_temp.hash_of('p2-readonly'), now() + interval '30 days');
  perform pg_temp.assert(not r.grants_write, 'bob mints a VIEW-ONLY link to the same project');
end $$;
select pg_temp.act_as('iris');
do $$
declare r record;
begin
  select * into r from public.claim_share_link(pg_temp.hash_of('p2-readonly'));
  perform pg_temp.assert(r.status = 'already-claimed' and r.can_write,
    '⚠ and iris does NOT quietly lose write by opening it: already-claimed reports the grant she HOLDS, not what the link would have given');
  perform pg_temp.assert(
    (select can_write from public.collaborators where id = pg_temp.get('g_iris_w')),
    'the stored grant is untouched — changing a level is a removal and a re-grant, which is 0008''s own rule');
end $$;

-- ===========================================================================
-- 5. Two-factor
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
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.create_share_link(%L, 'aal', now() + interval '1 day') $q$, pg_temp.get('p1'))) = '42501',
    'TWO-FACTOR: frank, with a verified factor at aal1, cannot make a link');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.revoke_share_link(%L) $q$, pg_temp.get('l_open'))) = '42501',
    'nor revoke one');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$ select public.claim_share_link(%L) $q$, pg_temp.hash_of('open'))) = '42501',
    'nor claim one');
  perform pg_temp.assert(pg_temp.links_visible(pg_temp.get('p1')) = 0,
    'and the restrictive policy hides the links from his reads');
end $$;

select pg_temp.act_as('frank', 'aal2');
do $$
declare r record;
begin
  perform pg_temp.assert(pg_temp.links_visible(pg_temp.get('p1')) > 0, 'at aal2 the links return');
  select * into r from public.create_share_link(pg_temp.get('p1'), pg_temp.hash_of('aal2'), now() + interval '1 day');
  perform pg_temp.assert(r.link_id is not null, 'and he can make one again');
end $$;

-- ===========================================================================
-- 6. ⚠ Revoking a LINK and revoking a CLAIM are two separate acts
-- ===========================================================================
select pg_temp.act_as('bob');
do $$
declare r record;
declare first_revoked timestamptz;
begin
  select * into r from public.revoke_share_link(pg_temp.get('l_open'));
  first_revoked := r.revoked_at;
  perform pg_temp.assert(first_revoked is not null, 'bob revokes the open link');
  perform pg_temp.assert(
    (select revoked_by from public.share_links where id = pg_temp.get('l_open')) = pg_temp.u('bob'),
    'and the revocation records who did it');

  select * into r from public.revoke_share_link(pg_temp.get('l_open'));
  perform pg_temp.assert(r.revoked_at = first_revoked,
    'revoking it AGAIN reports the original revocation rather than failing: the intent is already satisfied');
end $$;

do $$ begin
  perform pg_temp.assert(
    (select not is_live from public.project_share_links(pg_temp.get('p1')) where link_id = pg_temp.get('l_open')),
    'the link is no longer live');
  perform pg_temp.assert(
    (select count(*) from public.share_links where id = pg_temp.get('l_open')) = 1,
    '⚠ but the ROW is still there: revoked, not deleted, so the owner''s list still accounts for it and via_link_id never dangles');
end $$;

-- The claims survive it. This is the half somebody will get wrong one day.
select pg_temp.act_as('henry');
do $$ begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p1')) = 1,
    '⚠ henry STILL READS P1 after the link he came in through was revoked — switching off a link is not withdrawing access');
end $$;

select pg_temp.act_as('iris');
do $$ begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p1')) = 1, 'and so does iris');
end $$;

-- Withdrawing access is a grant removal, through the policy 0008 already has.
select pg_temp.act_as('bob');
do $$ begin
  delete from public.collaborators where id = pg_temp.get('g_iris');
  perform pg_temp.assert((select count(*) from public.collaborators where id = pg_temp.get('g_iris')) = 0,
    'an owner member removes a CLAIM through collaborators_delete — no new mechanism was needed');
end $$;

select pg_temp.act_as('iris');
do $$ begin
  perform pg_temp.assert(pg_temp.reads(pg_temp.get('p1')) = 0, 'and iris is out');
end $$;

-- And the sharer can remove a claim they caused, because granted_by is theirs.
select pg_temp.act_as('bob');
do $$
declare r record;
begin
  select * into r from public.create_share_link(pg_temp.get('p1'), pg_temp.hash_of('again'), now() + interval '1 day');
  perform pg_temp.put('l_again', r.link_id);
end $$;
select pg_temp.act_as('iris');
do $$
declare r record;
begin
  select * into r from public.claim_share_link(pg_temp.hash_of('again'));
  perform pg_temp.assert(r.status = 'claimed', 'iris claims a fresh link');
  perform pg_temp.put('g_iris2', r.grant_id);
end $$;
select pg_temp.act_as('frank', 'aal2');
do $$ begin
  delete from public.collaborators where id = pg_temp.get('g_iris2');
  perform pg_temp.assert((select count(*) from public.collaborators where id = pg_temp.get('g_iris2')) = 1,
    'frank, a collaborator who did NOT make that link, removes nothing');
end $$;
select pg_temp.act_as('bob');
do $$ begin
  delete from public.collaborators where id = pg_temp.get('g_iris2');
  perform pg_temp.assert((select count(*) from public.collaborators where id = pg_temp.get('g_iris2')) = 0,
    'but bob, whose link it was and whose company owns the project, does');
end $$;

-- A stranger cannot revoke, and cannot tell a real link id from a made-up one.
select pg_temp.act_as('carol');
do $$ begin
  perform pg_temp.assert(
    pg_temp.msg_of(format($q$ select public.revoke_share_link(%L) $q$, pg_temp.get('l_locked')))
    = pg_temp.msg_of($q$ select public.revoke_share_link('00000000-0000-0000-0000-000000000009') $q$),
    'a stranger gets ONE answer for "not yours" and "no such link"');
  perform pg_temp.assert(
    (select revoked_at from public.share_links where id = pg_temp.get('l_locked')) is null,
    'and the link is untouched');
end $$;

-- ===========================================================================
-- 7. The owner's list, and what it refuses to say
-- ===========================================================================
select pg_temp.act_as('bob');
do $$
declare sig text := pg_get_function_result('public.project_share_links(uuid)'::regprocedure);
begin
  perform pg_temp.assert(sig not like '%token%',
    '⚠ the owner''s list cannot reconstruct a URL: no token column. A link whose URL is lost is revoked and replaced, not recovered');
  perform pg_temp.assert(
    (select jsonb_array_length(claims) from public.project_share_links(pg_temp.get('p1'))
      where link_id = pg_temp.get('l_open')) = 1,
    'the open link lists the one claim still standing (henry; iris''s was removed)');
  perform pg_temp.assert(
    (select claims -> 0 ->> 'grantee_name' from public.project_share_links(pg_temp.get('p1'))
      where link_id = pg_temp.get('l_open')) = 'Henry Client',
    'by name');
  perform pg_temp.assert(
    (select jsonb_array_length(claims) from public.project_share_links(pg_temp.get('p1'))
      where link_id = pg_temp.get('l_locked')) = 0,
    'and a link nobody claimed lists none');
  perform pg_temp.assert(
    (select created_by_you from public.project_share_links(pg_temp.get('p1')) where link_id = pg_temp.get('l_frank')) = false,
    'and it says which links are somebody else''s');
end $$;

select pg_temp.act_as('carol');
do $$ begin
  perform pg_temp.assert((select count(*) from public.project_share_links(pg_temp.get('p1'))) = 0,
    'a stranger''s list is empty: the function is security invoker and share_links_select is the gate');
end $$;

-- ===========================================================================
-- 8. ⚠ What this migration did NOT do
-- ===========================================================================
-- Tommy's answer 3 was "ownership transfers": a company taking a client's
-- design into its proposals queue should OWN it. That is not built, and this is
-- the assertion that says so out loud. If a later migration relaxes
-- guard_project_columns, this fails — which is the point. It should be replaced
-- deliberately, by whoever makes that decision, and not quietly inherited.
select pg_temp.act_as('bob');
do $$
declare msg text;
begin
  msg := pg_temp.msg_of(format($q$ update public.projects set company_id = %L where id = %L $q$,
    pg_temp.co('RF'), pg_temp.get('p1')));
  perform pg_temp.assert(msg = 'a project cannot be moved to another company',
    '⚠ OWNERSHIP STILL CANNOT TRANSFER. 0011 does not weaken guard_project_columns; answer 3 is its own stride');
  perform pg_temp.assert(
    (select company_id from public.projects where id = pg_temp.get('p1')) = pg_temp.co('BI'),
    'and P1 is still owned by Building Integrity');
end $$;

-- The 0008 constraints that a 'link' grant has to satisfy are still enforced.
reset role;
do $$ begin
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$
      insert into public.collaborators (project_id, grantee_user_id, kind, grantee_name)
      values (%L, %L, 'link', 'nobody') $q$, pg_temp.get('p2'), pg_temp.u('iris'))) = '23514',
    'a ''link'' grant with no granted_by is still refused by collaborators_granted_by_iff_shared');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$
      insert into public.collaborators
        (project_id, grantee_user_id, kind, granted_by, granted_by_name, grantee_name, via_link_id)
      values (%L, %L, 'shared', %L, 'Bob Builder', 'nobody', %L) $q$,
      pg_temp.get('p2'), pg_temp.u('iris'), pg_temp.u('bob'), pg_temp.get('l_open'))) = '23514',
    'and via_link_id cannot be hung on a grant that was not made by a link');
  perform pg_temp.assert(
    pg_temp.sqlstate_of(format($q$
      insert into public.collaborators (project_id, grantee_user_id, kind, granted_by, granted_by_name, grantee_name)
      values (%L, %L, 'postcard', %L, 'Bob Builder', 'nobody') $q$,
      pg_temp.get('p2'), pg_temp.u('iris'), pg_temp.u('bob'))) = '23514',
    'and the widened kind check still admits only the three kinds there are');
end $$;

-- Deleting the project takes its links with it, and nothing else does.
-- ⚠ The operator opt-in is required, not because of anything in 0011, but
-- because 0006's append-only trigger on project_versions refuses the cascade
-- unless is_privileged_caller() — which is exactly the Stage 5 delete path.
set local app.operator = 'on';
do $$ begin
  perform pg_temp.assert((select count(*) from public.share_links where project_id = pg_temp.get('p1')) > 0,
    'P1 has links before it is deleted');
  delete from public.projects where id = pg_temp.get('p1');
  perform pg_temp.assert((select count(*) from public.share_links where project_id = pg_temp.get('p1')) = 0,
    'and a project delete cascades them away, as it does the grants');
end $$;
set local app.operator = '';

select set_config('request.jwt.claims', '', true);

do $$ begin
  raise notice 'stage6_rls: ALL ASSERTIONS PASSED';
end $$;

rollback;
