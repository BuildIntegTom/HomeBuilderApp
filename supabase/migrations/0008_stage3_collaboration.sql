-- Stage 3 — collaboration: grants on one project, to a person or a company.
--
-- Spec: building_integrity_app_spec.md, "Stage 3 plan — Collaboration" →
-- "Schema — migration 0008", "Across companies — the one opening", the Open
-- Items, and the 3A coder handoff. Approved by Tommy 2026-09-14 (all eight Open
-- Item defaults accepted).
--
-- SAFE ON THE LIVE DATABASE, BY CONSTRUCTION:
--   * One transaction: a failure part-way applies nothing.
--   * Re-runnable: `create table if not exists`, `create index if not exists`,
--     `create or replace function`, and `drop … if exists` before every trigger
--     and policy. A second run changes nothing.
--   * NO Stage 1 object is altered. It only calls Stage 1 helpers
--     (is_member_of, is_platform_admin, is_seed_entitled,
--     consortium_company_id, meets_required_aal).
--   * EXACTLY SIX Stage 2 objects are replaced, each because it has to be:
--       functions  can_read_project, can_write_project, create_project
--       policies   projects_select, projects_insert, projects_update
--     Every other 0006 object — tables, triggers, policies, grants, rows — is
--     untouched. The replaced functions keep their signatures and privileges.
--   * It adds one trigger ON projects (projects_grant_creator). That is a new
--     object, not a change to an existing one.
--
-- Run it AFTER 0007, in the Supabase SQL editor, exactly as 0006 and 0007 were.
--
-- WHAT A GRANT IS, AND WHAT IT IS NOT:
--   * A grant is a row in `collaborators`. Holding one makes can_read_project
--     and can_write_project true (one access level, costs included: 24).
--   * The OWNER COMPANY'S access is not a row. It is projects.company_id, which
--     no grant operation can touch. That is what makes "a collaborator can never
--     remove the owner's access" structural (answer 14).
--   * Every grant is WRITTEN by a SECURITY DEFINER function below (authenticated
--     has no insert or update on the table). Removal is an RLS policy.
--   * STILL NO BROWSING. After this migration a project owned by a company you
--     are not a member of is readable ONLY through a collaborators row that
--     reaches you. A consortium entitlement alone reads nothing. The cost
--     redactor still does not exist, and nothing here needs it.
--   * STAGE 4 MUST NOT ADD BROWSING through can_read_project,
--     can_write_project, holds_project_grant or any project_versions policy.
--
-- 0004's LIST OF DEFINER FUNCTIONS THAT BYPASS THE RESTRICTIVE aal POLICIES,
-- brought up to date here (0004's own comment is in an applied file and is left
-- as it was). Every definer function that writes rows its caller could not
-- write, or reads rows its caller could not read, is outside those policies by
-- construction. The list is now:
--   0003  redeem_invite                     writes a membership
--   0005  create_company_with_first_admin   writes a company and an invite
--   0008  share_project_with_person         writes a grant       — checks aal itself
--   0008  share_project_with_company        writes a grant       — checks aal itself
--   0008  dismiss_share_notices             writes notice state  — checks aal itself
--   0008  shareable_companies               reads company names  — checks aal itself
--   0008  grant_creator_access (trigger)    writes a creator grant, only inside a
--         projects insert that already passed projects_require_aal
--   0008  project_owner_company_id / project_owner_company_name
--                                           read past RLS        — check aal themselves
-- (Stage 2's definer triggers run only inside statements the caller's own RLS
--  already admitted, so they are not on this list.)

begin;

-- ---------------------------------------------------------------------------
-- collaborators — one grant on one project.
-- ---------------------------------------------------------------------------
create table if not exists public.collaborators (
  id uuid primary key default gen_random_uuid(),
  -- Reachable only through a platform admin deleting the whole project.
  project_id uuid not null references public.projects (id) on delete cascade,
  -- A grant to a person (answer 2). DELETING THE ACCOUNT DELETES THE GRANT.
  -- That is a DELETE, which nothing refuses, so the 2A problem (an FK action
  -- becoming an UPDATE a guard refuses) cannot arise here.
  grantee_user_id uuid references auth.users (id) on delete cascade,
  -- A grant to a company (answer 2). Membership is resolved at request time by
  -- holds_project_grant, never copied into per-member rows (answer 9).
  grantee_company_id uuid references public.companies (id) on delete cascade,
  -- `creator` is answer 1's grant, written by grant_creator_access.
  kind text not null check (kind in ('shared', 'creator')),
  -- Who shared it. A PLAIN uuid with NO foreign key — authorship-like, decided
  -- as 2A decided author_id (Stage 2 Open Item 8). An `on delete set null` FK
  -- would rewrite the record of who granted whom when a sharer's account is
  -- deleted, and removal rights (answer 13) key off this column. A dangling
  -- uuid grants nothing: nobody holds a deleted account's auth.uid().
  granted_by uuid,
  -- Snapshot of the sharer's name (display name, then email — the
  -- prepare_project_version rule). Required for the access list across
  -- companies: user_profiles_select hides a sharer from another company.
  granted_by_name text,
  -- Snapshot of the person's or company's name when the grant was made,
  -- labelled "as shared". Neither user_profiles_select nor companies_select
  -- shows another company's person or company.
  grantee_name text not null,
  -- Forced to now() by the writing function. Drives the notice and list order.
  created_at timestamptz not null default now(),
  -- Exactly one grantee — enforced by the table, not by the function.
  constraint collaborators_exactly_one_grantee
    check (num_nonnulls(grantee_user_id, grantee_company_id) = 1),
  -- A creator grant has no granter; a shared grant always has one.
  constraint collaborators_granted_by_iff_shared
    check ((kind = 'creator') = (granted_by is null)),
  -- The name snapshot follows the same rule ("Null only for creator").
  constraint collaborators_granted_by_name_iff_shared
    check ((kind = 'creator') = (granted_by_name is null))
);

create unique index if not exists collaborators_project_user_key
  on public.collaborators (project_id, grantee_user_id)
  where grantee_user_id is not null;
create unique index if not exists collaborators_project_company_key
  on public.collaborators (project_id, grantee_company_id)
  where grantee_company_id is not null;
create index if not exists collaborators_grantee_user_idx
  on public.collaborators (grantee_user_id);
create index if not exists collaborators_grantee_company_idx
  on public.collaborators (grantee_company_id);
create index if not exists collaborators_granted_by_idx
  on public.collaborators (granted_by);

-- Grants are IMMUTABLE: no update grant, no update policy. Changing a grant
-- means removing it and sharing again.
--
-- No TRUNCATE guard, deliberately: grants are not history (any owner member may
-- remove any of them, answer 13), and no client role holds TRUNCATE on this
-- table (see the privileges below).

-- ---------------------------------------------------------------------------
-- share_notice_state — one row per person: the in-app notice's high-water mark.
-- A flag on the grant cannot work, because one company grant reaches many
-- people and some of them will have seen it while others have not.
-- ---------------------------------------------------------------------------
create table if not exists public.share_notice_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- A grant created after this time is new to this person. Set only by
  -- dismiss_share_notices(), to the server's now().
  seen_through timestamptz not null
);

-- ---------------------------------------------------------------------------
-- Helpers. SECURITY DEFINER + stable, the same shape as 0002 and 0006.
-- ---------------------------------------------------------------------------

-- Does a grant on this project reach the caller?
--
-- THE COMPANY TEST IS is_member_of, EVALUATED ON EVERY REQUEST (answer 9). A
-- person who joins Rare Forms tomorrow has access on their first request; a
-- person who leaves has none on their next. No per-member rows are written.
--
-- IT IS NEVER can_act_as OR is_seed_entitled. A grant to the company "The Seed
-- Collaborative" therefore reaches Seed's OWN membership rows only, not the
-- whole co-operative — otherwise one share would become Stage 4 browsing,
-- costs included.
create or replace function public.holds_project_grant(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.collaborators c
    where c.project_id = p_project
      and (
        c.grantee_user_id = auth.uid()
        or (c.grantee_company_id is not null and public.is_member_of(c.grantee_company_id))
      )
  );
$$;

-- Stage 3: a member of the owning company, a platform admin, or a grant holder.
-- STILL IDENTICAL to can_write_project (one access level, answer 4) and still
-- defined separately. Stage 4 adds browsing to NEITHER: browsing never reaches
-- the raw document through RLS.
create or replace function public.can_read_project(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project
      and (public.is_member_of(p.company_id) or public.is_platform_admin())
  )
  or public.holds_project_grant(p_project);
$$;

-- IDENTICAL to can_read_project, and deliberately defined separately. Stage 3
-- added collaborator grants to BOTH. Stage 4 adds browsing to NEITHER.
create or replace function public.can_write_project(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project
      and (public.is_member_of(p.company_id) or public.is_platform_admin())
  )
  or public.holds_project_grant(p_project);
$$;

-- The owning company, read past RLS, so the collaborators policies can ask "is
-- the caller a member of the owner?". Returns null unless the caller can read
-- the project (at a satisfied assurance level): for an id you cannot read it
-- says the same thing as for an id that does not exist, so it cannot be used
-- to probe which project ids exist or who owns them. An owner member can
-- always read, so the delete policy's answer is unchanged by that gate.
create or replace function public.project_owner_company_id(p_project uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.company_id
    from public.projects p
   where p.id = p_project
     and public.can_read_project(p_project)
     and public.meets_required_aal();
$$;

-- The owner's NAME, for a collaborator from another company: companies_select
-- hides that row from them, so a plain companies read shows a blank owner.
-- Null unless the caller can read the project, as above.
create or replace function public.project_owner_company_name(p_project uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select co.name
    from public.projects p
    join public.companies co on co.id = p.company_id
   where p.id = p_project
     and public.can_read_project(p_project)
     and public.meets_required_aal();
$$;

-- ---------------------------------------------------------------------------
-- Functions that WRITE grants. SECURITY DEFINER: authenticated holds no insert
-- on collaborators. Each checks its own precondition, as redeem_invite does,
-- and each calls meets_required_aal() itself — see the list at the top.
-- ---------------------------------------------------------------------------

-- Share with a person, by email (answers 3, 10, 12).
--
-- STATUSES ARE ANSWERS, NOT EXCEPTIONS. Checked in this order:
--   no-account      no account uses that email (Open Item 8: say so plainly)
--   self            it is you
--   already-member  they are a member of the OWNER company; a personal grant
--                   would keep them in after they leave (decision 6)
--   already-shared  a grant to them exists; it is left untouched and its
--                   original granted_by stands
--   shared          a new grant was written
--
-- The only exception is "not yours", and it is the same 42501 with the same
-- message whether the project does not exist or you cannot write it.
--
-- CONCURRENCY: two people sharing the same project with the same person at
-- once both succeed — one `shared`, one `already-shared` naming the same grant.
-- `on conflict do nothing` makes the second insert wait for the first to
-- commit and then write nothing; the read that follows is a new statement, so
-- under READ COMMITTED it sees the committed row. Asserted by
-- supabase/tests/stage3_concurrency.test.sh.
create or replace function public.share_project_with_person(p_project uuid, p_email text)
returns table (status text, grant_id uuid)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_matches integer;
  v_grantee uuid;
  v_grant uuid;
  v_owner uuid;
  v_granted_by_name text;
  v_grantee_name text;
begin
  if auth.uid() is null or not public.meets_required_aal() then
    raise exception 'project not found, or you cannot share it'
      using errcode = '42501';
  end if;
  if not public.can_write_project(p_project) then
    raise exception 'project not found, or you cannot share it'
      using errcode = '42501';
  end if;
  if v_email = '' then
    raise exception 'an email address is required' using errcode = '22023';
  end if;

  select count(*) into v_matches from auth.users u where lower(btrim(u.email)) = v_email;
  if v_matches = 0 then
    return query select 'no-account'::text, null::uuid;
    return;
  end if;
  if v_matches > 1 then
    -- Not guessed at: two accounts claiming one address is a data problem for
    -- a platform admin, not something to resolve by picking one.
    raise exception 'more than one account uses that email; nothing was shared'
      using errcode = '21000';
  end if;
  select u.id into v_grantee from auth.users u where lower(btrim(u.email)) = v_email;

  if v_grantee = auth.uid() then
    return query select 'self'::text, null::uuid;
    return;
  end if;

  select p.company_id into v_owner from public.projects p where p.id = p_project;
  if exists (
    select 1 from public.memberships m
     where m.user_id = v_grantee and m.company_id = v_owner
  ) then
    return query select 'already-member'::text, null::uuid;
    return;
  end if;

  select c.id into v_grant from public.collaborators c
   where c.project_id = p_project and c.grantee_user_id = v_grantee;
  if found then
    return query select 'already-shared'::text, v_grant;
    return;
  end if;

  -- Name snapshots, by prepare_project_version's rule: display name, then the
  -- profile email, then the auth email.
  select coalesce(nullif(btrim(up.display_name), ''), up.email, u.email)
    into v_granted_by_name
    from auth.users u left join public.user_profiles up on up.id = u.id
   where u.id = auth.uid();
  select coalesce(nullif(btrim(up.display_name), ''), up.email, u.email)
    into v_grantee_name
    from auth.users u left join public.user_profiles up on up.id = u.id
   where u.id = v_grantee;
  if v_granted_by_name is null or v_grantee_name is null then
    raise exception 'cannot attribute this share: an account has no name or email'
      using errcode = '23514';
  end if;

  insert into public.collaborators
    (project_id, grantee_user_id, kind, granted_by, granted_by_name, grantee_name, created_at)
  values
    (p_project, v_grantee, 'shared', auth.uid(), v_granted_by_name, v_grantee_name, now())
  on conflict (project_id, grantee_user_id) where grantee_user_id is not null do nothing
  returning id into v_grant;

  if v_grant is not null then
    return query select 'shared'::text, v_grant;
    return;
  end if;

  -- Lost a race to an identical share that committed first.
  select c.id into v_grant from public.collaborators c
   where c.project_id = p_project and c.grantee_user_id = v_grantee;
  return query select 'already-shared'::text, v_grant;
end;
$$;

-- Share with a company (answers 2, 9). Statuses, in this order:
--   owner-company   refused: it already owns the project (answer 14)
--   not-shareable   not in shareable_companies() — reported identically for a
--                   company that does not exist
--   already-shared  a grant to that company exists; untouched
--   shared          a new grant was written
create or replace function public.share_project_with_company(p_project uuid, p_company uuid)
returns table (status text, grant_id uuid)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_owner uuid;
  v_company_name text;
  v_grant uuid;
  v_granted_by_name text;
begin
  if auth.uid() is null or not public.meets_required_aal() then
    raise exception 'project not found, or you cannot share it'
      using errcode = '42501';
  end if;
  if not public.can_write_project(p_project) then
    raise exception 'project not found, or you cannot share it'
      using errcode = '42501';
  end if;

  select p.company_id into v_owner from public.projects p where p.id = p_project;
  if p_company is not distinct from v_owner then
    return query select 'owner-company'::text, null::uuid;
    return;
  end if;

  -- Open Item 4, accepted: consortium member companies only.
  select co.name into v_company_name
    from public.companies co
   where co.id = p_company and co.is_seed_member;
  if not found then
    return query select 'not-shareable'::text, null::uuid;
    return;
  end if;

  select c.id into v_grant from public.collaborators c
   where c.project_id = p_project and c.grantee_company_id = p_company;
  if found then
    return query select 'already-shared'::text, v_grant;
    return;
  end if;

  select coalesce(nullif(btrim(up.display_name), ''), up.email, u.email)
    into v_granted_by_name
    from auth.users u left join public.user_profiles up on up.id = u.id
   where u.id = auth.uid();
  if v_granted_by_name is null then
    raise exception 'cannot attribute this share: the signed-in account has no name or email'
      using errcode = '23514';
  end if;

  insert into public.collaborators
    (project_id, grantee_company_id, kind, granted_by, granted_by_name, grantee_name, created_at)
  values
    (p_project, p_company, 'shared', auth.uid(), v_granted_by_name, v_company_name, now())
  on conflict (project_id, grantee_company_id) where grantee_company_id is not null do nothing
  returning id into v_grant;

  if v_grant is not null then
    return query select 'shared'::text, v_grant;
    return;
  end if;

  select c.id into v_grant from public.collaborators c
   where c.project_id = p_project and c.grantee_company_id = p_company;
  return query select 'already-shared'::text, v_grant;
end;
$$;

-- The company picker. Definer because companies_select shows only your own
-- companies. Names and ids only — never flags or theme.
create or replace function public.shareable_companies()
returns table (id uuid, name text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.meets_required_aal() then
    raise exception 'sign in (and finish two-factor) to list companies'
      using errcode = '42501';
  end if;
  return query
    select co.id, co.name
      from public.companies co
     where co.is_seed_member
     order by lower(co.name), co.id;
end;
$$;

-- The notice's "Got it". The server's time is stored, so a second computer is
-- cleared too.
create or replace function public.dismiss_share_notices()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.meets_required_aal() then
    raise exception 'sign in (and finish two-factor) to dismiss notices'
      using errcode = '42501';
  end if;
  insert into public.share_notice_state (user_id, seen_through)
  values (auth.uid(), now())
  on conflict (user_id) do update set seen_through = excluded.seen_through;
end;
$$;

-- ---------------------------------------------------------------------------
-- The creator grant (answer 1) — a trigger, so EVERY path that creates a
-- project writes it, a direct PostgREST insert included.
-- ---------------------------------------------------------------------------
-- * auth.uid(), NEVER new.created_by: no access is ever keyed to the FK-less
--   created_by (Stage 2 Open Item 8). grantee_user_id has an FK, so the grant
--   cannot outlive the account.
-- * A member creating in their own company gets NO grant: it would survive
--   them leaving, against decision 6.
-- * A platform admin gets NO grant: they already have access, and a grant
--   would outlast losing the flag.
create or replace function public.grant_creator_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if auth.uid() is null
     or public.is_member_of(new.company_id)
     or public.is_platform_admin() then
    return null;
  end if;

  select coalesce(nullif(btrim(up.display_name), ''), up.email, u.email)
    into v_name
    from auth.users u left join public.user_profiles up on up.id = u.id
   where u.id = auth.uid();
  if v_name is null then
    raise exception 'cannot attribute this project: the signed-in account has no name or email'
      using errcode = '23514';
  end if;

  insert into public.collaborators
    (project_id, grantee_user_id, kind, granted_by, granted_by_name, grantee_name, created_at)
  values
    (new.id, auth.uid(), 'creator', null, null, v_name, now());
  return null;
end;
$$;

drop trigger if exists projects_grant_creator on public.projects;
create trigger projects_grant_creator
  after insert on public.projects
  for each row execute function public.grant_creator_access();

-- ---------------------------------------------------------------------------
-- create_project (REPLACED, same signature and privileges).
-- ---------------------------------------------------------------------------
-- CORRECTION TO 0006's COMMENT, which said `insert … returning` inside these
-- RPCs was safe from the trap 0005 documents. For a Seed-tree creator it is
-- not. RETURNING applies projects_select to the new row; for a consortium
-- creator the only true branch is holds_project_grant(id), and that grant is
-- written by an AFTER trigger of the same command — invisible to it. The create
-- would fail with "new row violates row-level security policy".
--
-- THE FIX: choose the id first and insert WITHOUT RETURNING, which applies only
-- projects_insert's WITH CHECK. The version insert is a later statement, so it
-- sees both the project row and the creator grant.
--
-- Still SECURITY INVOKER: every policy applies to the caller exactly as if they
-- had issued the statements by hand. A single statement that inserts both a
-- project and its version (a data-modifying CTE) still fails closed.
create or replace function public.create_project(
  p_company_id uuid,
  p_folder text,
  p_document jsonb,
  p_label text default null
)
returns table (
  project_id uuid,
  version_id uuid,
  version_number integer,
  created_at timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  v_project_id uuid := gen_random_uuid();
  v_version public.project_versions;
begin
  insert into public.projects (id, company_id, folder, created_by)
  values (v_project_id, p_company_id, coalesce(p_folder, 'current'), auth.uid());

  -- A new project's v1 has no parent: a copy is not a handoff and records no
  -- lineage (spec, "Save as new cloud project").
  insert into public.project_versions (project_id, parent_version_id, label, document)
  values (v_project_id, null, nullif(btrim(p_label), ''), p_document)
  returning * into v_version;

  return query select v_project_id, v_version.id, v_version.version_number, v_version.created_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Functions that READ. SECURITY INVOKER: RLS applies. They exist for one round
-- trip, not for privilege.
-- ---------------------------------------------------------------------------

-- The "Shared with us" tab.
--
-- THE GRANT FILTER IS WRITTEN HERE, NOT LEFT TO RLS. collaborators_select also
-- shows an owner member every grant on their projects, and a platform admin
-- every grant; an unfiltered read would list other people's grants as "shared
-- with us" (the same class of bug as the 2026-09-14 session-membership fix).
--   * personal grants (shared or creator) to the caller, under any acting-as;
--   * company grants to p_acting_as, only if the caller is a member of it;
--   * minus projects p_acting_as owns WHEN THE FOLDER TABS LIST THEM, i.e. the
--     caller is a member of p_acting_as (or a platform admin). Acting as Seed
--     through the consortium, Seed's folder tabs list nothing before Stage 4,
--     so a Seed-tree project you created stays in this tab as "you created it"
--     (spec, "Who sees what", and hand-test step 12). Excluding every project
--     p_acting_as owns would hide exactly that project.
-- p_acting_as may be null (an account with no membership): personal grants only.
-- One row per project; `reached_via` lists every grant that brought it here.
-- NEVER selects `document`.
create or replace function public.list_shared_projects(p_acting_as uuid)
returns table (
  project_id uuid,
  name text,
  folder text,
  head_version_number integer,
  head_version_id uuid,
  head_author_name text,
  updated_at timestamptz,
  owner_company_id uuid,
  owner_company_name text,
  reached_via jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  with reaching as (
    select c.project_id, c.kind, c.grantee_user_id, c.grantee_company_id,
           c.grantee_name, c.granted_by_name, c.created_at
      from public.collaborators c
     where c.grantee_user_id = auth.uid()
        or (p_acting_as is not null
            and c.grantee_company_id = p_acting_as
            and public.is_member_of(p_acting_as))
  )
  select p.id,
         p.name,
         p.folder,
         p.head_version_number,
         v.id,
         v.author_name,
         p.updated_at,
         p.company_id,
         public.project_owner_company_name(p.id),
         (select jsonb_agg(
                   jsonb_build_object(
                     'via', case when r.kind = 'creator' then 'creator'
                                 when r.grantee_user_id is not null then 'person'
                                 else 'company' end,
                     'grantee_name', r.grantee_name,
                     'granted_by_name', r.granted_by_name,
                     'created_at', r.created_at)
                   order by r.created_at, r.kind)
            from reaching r where r.project_id = p.id)
    from public.projects p
    left join public.project_versions v
      on v.project_id = p.id and v.version_number = p.head_version_number
   where p.id in (select r.project_id from reaching r)
     and not (
       p_acting_as is not null
       and p.company_id = p_acting_as
       and (public.is_member_of(p_acting_as) or public.is_platform_admin())
     )
   order by p.updated_at desc, p.id;
$$;

-- The in-app notice (answer 7): grants that reach you and are newer than your
-- seen_through.
--   * kind = 'shared' only, and never grants you made yourself.
--   * A company grant only if it was made AFTER your own membership at that
--     company began: someone who joins next year is not told every old share
--     as news. The membership read is filtered to YOUR row explicitly, because
--     memberships_select also shows a company admin everyone's rows.
create or replace function public.pending_share_notices()
returns table (
  grant_id uuid,
  project_id uuid,
  project_name text,
  owner_company_name text,
  granted_by_name text,
  grantee_kind text,
  grantee_name text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select c.id,
         c.project_id,
         p.name,
         public.project_owner_company_name(c.project_id),
         c.granted_by_name,
         case when c.grantee_user_id is not null then 'person' else 'company' end,
         c.grantee_name,
         c.created_at
    from public.collaborators c
    join public.projects p on p.id = c.project_id
   where c.kind = 'shared'
     and c.granted_by is distinct from auth.uid()
     and c.created_at > coalesce(
           (select s.seen_through from public.share_notice_state s where s.user_id = auth.uid()),
           '-infinity'::timestamptz)
     and (
       c.grantee_user_id = auth.uid()
       or exists (
         select 1 from public.memberships m
          where m.user_id = auth.uid()
            and m.company_id = c.grantee_company_id
            and m.created_at < c.created_at
       )
     )
   order by c.created_at, c.id;
$$;

-- ---------------------------------------------------------------------------
-- Privileges. Supabase's default privileges grant broad rights on new public
-- tables and functions to anon, authenticated AND service_role, so start from
-- nothing and grant exactly. service_role gets nothing, as in 0006.
-- ---------------------------------------------------------------------------
revoke all on public.collaborators, public.share_notice_state
  from public, anon, authenticated, service_role;

-- select and delete ONLY. Every grant is written by a function above.
grant select, delete on public.collaborators to authenticated;
-- select ONLY. seen_through is written by dismiss_share_notices().
grant select on public.share_notice_state to authenticated;

-- New functions: revoked from public, anon and service_role; callable by
-- authenticated. The replaced can_read_project, can_write_project and
-- create_project keep 0006's privileges (create or replace preserves them).
do $grants$
declare
  fn text;
begin
  foreach fn in array array[
    'public.holds_project_grant(uuid)',
    'public.project_owner_company_id(uuid)',
    'public.project_owner_company_name(uuid)',
    'public.share_project_with_person(uuid,text)',
    'public.share_project_with_company(uuid,uuid)',
    'public.shareable_companies()',
    'public.dismiss_share_notices()',
    'public.list_shared_projects(uuid)',
    'public.pending_share_notices()'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke all on function %s from anon', fn);
    execute format('revoke all on function %s from service_role', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;

  -- The trigger function: no client role calls it. (A trigger's function is
  -- permission-checked when the trigger is created, not when it fires.)
  execute 'revoke all on function public.grant_creator_access() from public';
  execute 'revoke all on function public.grant_creator_access() from anon';
  execute 'revoke all on function public.grant_creator_access() from authenticated';
  execute 'revoke all on function public.grant_creator_access() from service_role';
end
$grants$;

-- Enabled, NOT forced — same reasoning as 0002 and 0006: the definer functions
-- above write as the owner, which FORCE would break.
alter table public.collaborators enable row level security;
alter table public.share_notice_state enable row level security;

-- ---------------------------------------------------------------------------
-- Policies on projects — the three Stage 2 policies that must change.
-- ---------------------------------------------------------------------------

-- REPLACED. Stage 2's policy called is_member_of directly, not
-- can_read_project, so changing only the helpers would show a collaborator the
-- versions of a project they could not list.
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated
  using (
    public.is_member_of(company_id)
    or public.is_platform_admin()
    or public.holds_project_grant(id)
  );

-- REPLACED. Answer 1 plus 18: create freely in Seed's tree through the
-- consortium entitlement. This widens nothing else — no other company can be
-- named — and creating a project reads nothing: the creator grant covers that
-- one project only.
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
  for insert to authenticated
  with check (
    (
      public.is_member_of(company_id)
      or public.is_platform_admin()
      or (company_id = public.consortium_company_id() and public.is_seed_entitled())
    )
    and created_by = auth.uid()
    and head_version_number = 0
  );

-- REPLACED. Answer 11 (a collaborator moves folders). Also required for a
-- collaborator's rename: rename_project runs `select … for update`, and
-- PostgreSQL applies the UPDATE policy to FOR UPDATE, so without this the
-- rename would fail as "not found". guard_project_columns still narrows every
-- update to `folder`, and still refuses a company_id change below a privileged
-- caller.
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update to authenticated
  using (
    public.is_member_of(company_id)
    or public.is_platform_admin()
    or public.holds_project_grant(id)
  )
  with check (
    public.is_member_of(company_id)
    or public.is_platform_admin()
    or public.holds_project_grant(id)
  );

-- projects_delete is UNCHANGED (platform admin only: answer 14, decision 13).
-- project_versions_* are UNCHANGED: they pick up grants through the helpers.

-- ---------------------------------------------------------------------------
-- Policies on collaborators.
-- ---------------------------------------------------------------------------

-- Everyone who can open the project sees its whole access list, including who
-- granted whom (Open Item 3, accepted).
drop policy if exists collaborators_select on public.collaborators;
create policy collaborators_select on public.collaborators
  for select to authenticated
  using (public.can_read_project(project_id));

-- Answer 13, IN THE DATABASE. Any owner member, or a platform admin, removes
-- any grant. Anyone else removes only a grant they made, and only while they
-- can still read the project. A collaborator deleting someone else's grant
-- affects zero rows. The owner company's access is not a row, so there is
-- nothing here that could remove it (answer 14).
drop policy if exists collaborators_delete on public.collaborators;
create policy collaborators_delete on public.collaborators
  for delete to authenticated
  using (
    public.is_member_of(public.project_owner_company_id(project_id))
    or public.is_platform_admin()
    or (granted_by = auth.uid() and public.can_read_project(project_id))
  );

-- No insert policy and no update policy: there are no such grants either.

drop policy if exists collaborators_require_aal on public.collaborators;
create policy collaborators_require_aal on public.collaborators
  as restrictive for all to authenticated
  using (public.meets_required_aal())
  with check (public.meets_required_aal());

-- ---------------------------------------------------------------------------
-- Policies on share_notice_state.
-- ---------------------------------------------------------------------------
drop policy if exists share_notice_state_select on public.share_notice_state;
create policy share_notice_state_select on public.share_notice_state
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists share_notice_state_require_aal on public.share_notice_state;
create policy share_notice_state_require_aal on public.share_notice_state
  as restrictive for all to authenticated
  using (public.meets_required_aal())
  with check (public.meets_required_aal());

commit;
