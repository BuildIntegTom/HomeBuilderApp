-- Stage 2 — cloud projects and versions.
--
-- Spec: building_integrity_app_spec.md, "Stage 2 plan — Cloud projects and
-- versions" → "Schema — migration 0006", "Across companies before Stage 4",
-- "Folders", and the 2A coder handoff. Approved by Tommy 2026-09-13.
--
-- SAFE ON THE LIVE DATABASE, BY CONSTRUCTION:
--   * It creates two tables, their helpers, triggers and policies.
--   * It alters NO Stage 1 table, function, trigger or policy, and touches no
--     existing row. It only calls Stage 1 helpers (is_member_of,
--     is_platform_admin, is_privileged_caller, meets_required_aal).
--   * The whole file is one transaction: a failure part-way applies nothing.
--   * It is re-runnable: `create table if not exists`, `create index if not
--     exists`, `create or replace function`, and `drop … if exists` before every
--     trigger and policy. A second run changes nothing.
--
-- Run it AFTER 0005, in the Supabase SQL editor, exactly as 0001–0005 were.
--
-- WHAT THIS DOES NOT DO, deliberately:
--   * No cross-company read of any kind. Before Stage 4 an ordinary member of
--     one company sees zero rows of another company's projects and versions.
--     Platform admin is the only exception (already accepted in the spec). The
--     cost redactor does not exist yet, so this is what keeps every
--     priceModifier inside its own company.
--   * STAGE 4 MUST NOT ADD BROWSING BY WIDENING project_versions_select. RLS
--     decides whether a row is served, not what the document inside contains.
--     A widened policy would hand browsers the raw document, margin included,
--     straight from PostgREST with the publishable key that ships in the
--     bundle. Cross-company documents arrive only through the redactor's path.
--   * No collaborators (Stage 3), no single-version delete (Stage 5).

begin;

-- ---------------------------------------------------------------------------
-- projects — the listing record. Mutable, but only in the ways guarded below.
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  -- Ownership (decision 25): whose tree it appears in, whose backup includes
  -- it. ON DELETE RESTRICT, not cascade: a company leaving keeps its designs
  -- (28), and deleting a company must never silently take projects with it.
  company_id uuid not null references public.companies (id) on delete restrict,
  -- A status label only (decision 12). Not an access-control field. The one
  -- column a member may change.
  folder text not null default 'current'
    check (folder in ('current', 'past', 'proposals')),
  -- SYSTEM-MAINTAINED mirror of the head document's state.projectName, set by
  -- apply_project_version_head. Empty renders as "(untitled)" in the tree: a
  -- visible gap, not a substituted name.
  name text not null default '',
  -- The latest version's number. System-maintained. 0 exists only between the
  -- two inserts inside create_project.
  head_version_number integer not null default 0,
  -- Who created it. A PLAIN uuid, deliberately with NO foreign key to
  -- auth.users. An `on delete set null` FK is an UPDATE of this row when the
  -- auth user is deleted, and guard_project_columns (rightly) refuses to let
  -- created_by change — so the FK made that person impossible to delete from
  -- the dashboard. Immutability is the property worth keeping; a dangling uuid
  -- after a deletion is harmless, since nothing grants access by created_by.
  created_by uuid,
  created_at timestamptz not null default now(),
  -- Last save. Set by the version trigger; used for sorting.
  updated_at timestamptz not null default now()
);

-- No uniqueness on name: two "Smith House" projects are legal.
create index if not exists projects_company_folder_updated_idx
  on public.projects (company_id, folder, updated_at desc);

-- ---------------------------------------------------------------------------
-- project_versions — append-only (decision 10). Enforced by the database.
-- ---------------------------------------------------------------------------
create table if not exists public.project_versions (
  id uuid primary key default gen_random_uuid(),
  -- Cascade is reachable only by a platform admin deleting a whole project;
  -- refuse_project_version_change lets the cascade through and nothing else.
  project_id uuid not null references public.projects (id) on delete cascade,
  -- Assigned by prepare_project_version. Any client value is overwritten.
  version_number integer not null,
  -- The version the author had open when they started (decision 11). NO ACTION
  -- (checked at end of statement), not RESTRICT, so a whole-project cascade can
  -- remove a parent and its children in the one statement.
  parent_version_id uuid references public.project_versions (id),
  kind text not null default 'save' check (kind in ('save', 'rename')),
  label text check (label is null or char_length(label) between 1 and 200),
  -- Overwritten with auth.uid(). Never trusted from the client. A PLAIN uuid,
  -- deliberately with NO foreign key to auth.users: an `on delete set null` FK
  -- is an UPDATE of this row, which the append-only trigger refuses, so it made
  -- anyone who had ever saved impossible to delete. Attribution does not need
  -- the FK — it is carried by the author_name snapshot below.
  author_id uuid,
  -- A SNAPSHOT taken at save time. See prepare_project_version for why this is
  -- a correctness requirement (decision 6), not a nicety.
  author_name text not null,
  -- Overwritten with now(). The title-block date for cloud projects, so the
  -- browser clock is not trusted.
  created_at timestamptz not null default now(),
  -- Copied from document->>'schemaVersion'. Lets the version list flag
  -- unopenable versions without downloading documents; Stage 4's redactor is
  -- keyed to it.
  schema_version integer not null,
  -- The ProjectFile exactly as serializeProject writes it.
  document jsonb not null,
  constraint project_versions_project_number_key unique (project_id, version_number),
  constraint project_versions_parent_not_self check (parent_version_id <> id),
  -- Version 1 has no parent; every later version must name one.
  constraint project_versions_parent_iff_not_first
    check ((version_number = 1) = (parent_version_id is null))
);

create index if not exists project_versions_parent_idx
  on public.project_versions (parent_version_id);
create index if not exists project_versions_author_idx
  on public.project_versions (author_id);

-- ---------------------------------------------------------------------------
-- Helpers. SECURITY DEFINER + stable, so a policy on project_versions can read
-- projects without re-entering projects' own policies. Same shape as 0002.
-- ---------------------------------------------------------------------------

-- Stage 2: you are a member of the owning company, or a platform admin.
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
  );
$$;

-- IDENTICAL to can_read_project in Stage 2, and deliberately defined
-- separately. Stage 3 adds collaborator grants to BOTH. Stage 4 adds browsing
-- to NEITHER: browsing never reaches the raw document through RLS.
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
  );
$$;

-- ---------------------------------------------------------------------------
-- Trigger 1 — prepare_project_version, BEFORE INSERT on project_versions.
-- ---------------------------------------------------------------------------
create or replace function public.prepare_project_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Open Item 5, accepted by Tommy 2026-09-13: PICKED, not measured. Just under
  -- Vercel's ~4.5 MB function body limit, since a larger document could not
  -- reach the database through a route anyway. An administrative guard, not a
  -- building value, so deliberately not a CatalogValue.
  c_max_document_bytes constant integer := 4 * 1024 * 1024;
  v_head integer;
  v_parent_project uuid;
  v_author_name text;
begin
  -- One uniform error for "no such project" and "not yours", so the error
  -- cannot be used to probe whether a project id exists.
  if not public.can_write_project(new.project_id) then
    raise exception 'project not found, or you cannot save to it'
      using errcode = '42501';
  end if;

  -- THIS LOCK SERIALISES CONCURRENT SAVES on one project. Without it two saves
  -- read the same head, compute the same version_number, and the second fails
  -- on the unique index; "head before this save" would also be wrong. Under
  -- READ COMMITTED the waiting save re-reads the row once the first commits,
  -- so it sees the new head.
  select p.head_version_number into v_head
    from public.projects p
   where p.id = new.project_id
   for update;

  new.version_number := v_head + 1;
  new.created_at := now();
  new.author_id := auth.uid();

  -- WHY A SNAPSHOT (decision 6: a leaver's name stays on their versions).
  -- user_profiles_select (0002) shows a profile only to someone who SHARES A
  -- COMPANY with that person. Revoke a leaver's membership and every remaining
  -- colleague loses the ability to read their profile, so a join-on-read
  -- version list would show a blank author exactly when attribution matters
  -- most. Copying the name here makes decision 6 true.
  select coalesce(nullif(btrim(up.display_name), ''), up.email, u.email)
    into v_author_name
    from auth.users u
    left join public.user_profiles up on up.id = u.id
   where u.id = auth.uid();
  if v_author_name is null then
    raise exception 'cannot attribute this save: the signed-in account has no name or email'
      using errcode = '23514';
  end if;
  new.author_name := v_author_name;

  -- The document. Shape only: the server does not parse the design (22).
  if new.document is null or jsonb_typeof(new.document) <> 'object' then
    raise exception 'a project document must be a JSON object'
      using errcode = '23514';
  end if;
  if jsonb_typeof(new.document -> 'state') is distinct from 'object' then
    raise exception 'a project document must carry a "state" object'
      using errcode = '23514';
  end if;
  if jsonb_typeof(new.document -> 'schemaVersion') is distinct from 'number'
     or (new.document ->> 'schemaVersion') !~ '^-?[0-9]{1,9}$' then
    raise exception 'a project document must carry an integer "schemaVersion"'
      using errcode = '23514';
  end if;
  if octet_length(new.document::text) > c_max_document_bytes then
    raise exception 'this project document is % bytes, over the % byte limit',
      octet_length(new.document::text), c_max_document_bytes
      using errcode = '23514';
  end if;
  new.schema_version := (new.document ->> 'schemaVersion')::integer;

  -- A parent must be a version of THIS project. Same message whether it is
  -- another project's version or does not exist, for the same reason as above.
  -- (A null parent on a project that already has versions, and a non-null
  -- parent on version 1, are refused by project_versions_parent_iff_not_first.)
  if new.parent_version_id is not null then
    select v.project_id into v_parent_project
      from public.project_versions v
     where v.id = new.parent_version_id;
    if v_parent_project is distinct from new.project_id then
      raise exception 'the parent version must be a version of the same project'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists project_versions_prepare on public.project_versions;
create trigger project_versions_prepare
  before insert on public.project_versions
  for each row execute function public.prepare_project_version();

-- ---------------------------------------------------------------------------
-- Trigger 2 — apply_project_version_head, AFTER INSERT on project_versions.
-- The only writer of projects.name / head_version_number / updated_at: its
-- UPDATE arrives at trigger depth 2, which guard_project_columns requires.
-- ---------------------------------------------------------------------------
create or replace function public.apply_project_version_head()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.projects p
     set head_version_number = new.version_number,
         updated_at = new.created_at,
         -- Row follows document. Renaming is a new version (rename_project),
         -- because a row-only rename would be undone by the next save.
         name = coalesce(new.document #>> '{state,projectName}', '')
   where p.id = new.project_id;
  return null;
end;
$$;

drop trigger if exists project_versions_apply_head on public.project_versions;
create trigger project_versions_apply_head
  after insert on public.project_versions
  for each row execute function public.apply_project_version_head();

-- ---------------------------------------------------------------------------
-- Trigger 3 — refuse_project_version_change, BEFORE UPDATE OR DELETE.
-- ---------------------------------------------------------------------------
-- UPDATE: refused for EVERYONE, platform admin and operator included. Decision
-- 10 says never updated, not "updated by the powerful". (authenticated also
-- holds no UPDATE grant at all; this is the braces to that belt.)
--
-- DELETE: refused unless the caller is privileged AND pg_trigger_depth() > 1,
-- i.e. the delete is arriving as the ON DELETE CASCADE from a platform admin
-- deleting the whole project. A client cannot raise the trigger depth, so this
-- is unspoofable from PostgREST. A direct single-version delete is refused even
-- for a platform admin in Stage 2: it would leave head_version_number stale and
-- break a parent_version_id chain. That operation is Stage 5's to design.
--
-- Why author_id has no foreign key: an ON DELETE SET NULL would be an UPDATE
-- arriving here, refused, which made anyone who had ever saved impossible to
-- delete. With no FK, deleting an auth user touches no version at all, and the
-- author_name snapshot keeps the attribution. See supabase/README.md.
create or replace function public.refuse_project_version_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'project versions are append-only: a saved version is never changed'
      using errcode = '42501';
  end if;

  if public.is_privileged_caller() and pg_trigger_depth() > 1 then
    return old;
  end if;

  raise exception 'a single project version cannot be deleted; only a platform admin deleting the whole project removes versions'
    using errcode = '42501';
end;
$$;

drop trigger if exists project_versions_refuse_change on public.project_versions;
create trigger project_versions_refuse_change
  before update or delete on public.project_versions
  for each row execute function public.refuse_project_version_change();

-- ---------------------------------------------------------------------------
-- Trigger 3b — refuse_project_truncate, BEFORE TRUNCATE on both tables.
-- ---------------------------------------------------------------------------
-- TRUNCATE fires no row triggers and ignores RLS, so without this, append-only
-- would hold against UPDATE and DELETE and fall to one statement from the
-- owner. No client role holds TRUNCATE (see the grants below); this covers the
-- owner and anyone ever granted it by mistake. Refused for everyone, operator
-- included: removing projects is a platform admin DELETE of a whole project,
-- which goes through the row triggers above.
create or replace function public.refuse_project_truncate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'TRUNCATE is refused on %: project versions are append-only, and a project is removed only by a platform admin deleting it',
    tg_table_name
    using errcode = '42501';
end;
$$;

drop trigger if exists project_versions_refuse_truncate on public.project_versions;
create trigger project_versions_refuse_truncate
  before truncate on public.project_versions
  for each statement execute function public.refuse_project_truncate();

drop trigger if exists projects_refuse_truncate on public.projects;
create trigger projects_refuse_truncate
  before truncate on public.projects
  for each statement execute function public.refuse_project_truncate();

-- ---------------------------------------------------------------------------
-- Trigger 4 — guard_project_columns, BEFORE UPDATE on projects.
-- Same shape as guard_membership_self_update (0001): the question is WHICH
-- COLUMN changed, not which row, so it is a trigger rather than a policy.
-- ---------------------------------------------------------------------------
create or replace function public.guard_project_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Checked FIRST, before anything else can return early (the lesson of
  -- 0001's membership row move). Transferring ownership is not an operation
  -- this system has; a member of two companies must not be able to move a
  -- project from one to the other.
  if not public.is_privileged_caller() then
    if new.company_id is distinct from old.company_id then
      raise exception 'a project cannot be moved to another company'
        using errcode = '42501';
    end if;
    if new.created_by is distinct from old.created_by then
      raise exception 'a project''s creator cannot be changed'
        using errcode = '42501';
    end if;
    if new.created_at is distinct from old.created_at then
      raise exception 'a project''s creation time cannot be changed'
        using errcode = '42501';
    end if;
  end if;

  -- System-maintained columns: only apply_project_version_head writes them,
  -- and its UPDATE is the only one that arrives at depth > 1.
  if pg_trigger_depth() <= 1 and (
       new.name is distinct from old.name
       or new.head_version_number is distinct from old.head_version_number
       or new.updated_at is distinct from old.updated_at
     ) then
    raise exception 'name, head_version_number and updated_at follow the saved versions and cannot be set directly (rename with rename_project)'
      using errcode = '42501';
  end if;

  -- folder is left to projects_update.
  return new;
end;
$$;

drop trigger if exists projects_guard_columns on public.projects;
create trigger projects_guard_columns
  before update on public.projects
  for each row execute function public.guard_project_columns();

-- ---------------------------------------------------------------------------
-- Trigger 5 — stamp_new_project, BEFORE INSERT on projects.
-- ---------------------------------------------------------------------------
-- guard_project_columns covers UPDATE, but a direct PostgREST INSERT could set
-- created_at to any date — and since created_at is immutable afterwards, a
-- backdated project would stay backdated for good. The same insert could name
-- the project and set updated_at or a head. The client sends nothing here that
-- is trusted: every system-maintained column is set to what a brand-new
-- project with no versions actually has. create_project's first version then
-- sets name, head and updated_at through apply_project_version_head, as for
-- every save.
create or replace function public.stamp_new_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_at := now();
  new.updated_at := now();
  new.name := '';
  new.head_version_number := 0;
  return new;
end;
$$;

drop trigger if exists projects_stamp_insert on public.projects;
create trigger projects_stamp_insert
  before insert on public.projects
  for each row execute function public.stamp_new_project();

-- ---------------------------------------------------------------------------
-- RPCs. SECURITY INVOKER — the opposite reason from 0003/0005's definer
-- functions. These exist for ATOMICITY, not privilege: every policy below still
-- applies to the caller exactly as if they had issued the statements by hand.
--
-- `insert … returning` inside them is safe from the trap 0005 documents:
-- projects_select reads only the row's own company_id and never looks the row
-- up, and can_read_project on versions reads a project row written by an
-- EARLIER statement.
--
-- A SINGLE statement that inserts both (a data-modifying CTE) does hit the
-- trap and fails closed with 42501 — but note WHICH layer refuses it:
-- project_versions_insert's WITH CHECK, whose can_write_project cannot see a
-- project row written by the same command. prepare_project_version's own call
-- runs in a later snapshot and DOES see it, so the trigger alone would let it
-- through. Harmless (the caller is a member of that company either way), but
-- that refusal rests on RLS being enabled. Asserted in the suite.
-- ---------------------------------------------------------------------------

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
  v_project_id uuid;
  v_version public.project_versions;
begin
  insert into public.projects (company_id, folder, created_by)
  values (p_company_id, coalesce(p_folder, 'current'), auth.uid())
  returning id into v_project_id;

  -- A new project's v1 has no parent: a copy is not a handoff and records no
  -- lineage (spec, "Save as new cloud project").
  insert into public.project_versions (project_id, parent_version_id, label, document)
  values (v_project_id, null, nullif(btrim(p_label), ''), p_document)
  returning * into v_version;

  return query select v_project_id, v_version.id, v_version.version_number, v_version.created_at;
end;
$$;

create or replace function public.save_project_version(
  p_project_id uuid,
  p_parent_version_id uuid,
  p_document jsonb,
  p_label text default null
)
returns table (
  version_id uuid,
  version_number integer,
  created_at timestamptz,
  head_before integer,
  diverged boolean
)
language plpgsql
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  v_version public.project_versions;
  v_parent_number integer;
begin
  insert into public.project_versions (project_id, parent_version_id, label, document)
  values (p_project_id, p_parent_version_id, nullif(btrim(p_label), ''), p_document)
  returning * into v_version;

  -- prepare_project_version held the project row lock while numbering, so
  -- head_before is exact: the head this save was appended after.
  select v.version_number into v_parent_number
    from public.project_versions v
   where v.id = v_version.parent_version_id;

  -- The divergence notice (11): the head moved on since the author opened
  -- their base. It never blocks; both versions are kept.
  return query select
    v_version.id,
    v_version.version_number,
    v_version.created_at,
    v_version.version_number - 1,
    v_parent_number is distinct from v_version.version_number - 1;
end;
$$;

-- Renaming appends a kind = 'rename' version whose document is the head's with
-- only state.projectName replaced (Open Item 3, accepted). This touches one key
-- the way the Stage 4 redactor will touch one key; it is not the server parsing
-- the design (22).
create or replace function public.rename_project(
  p_project_id uuid,
  p_name text
)
returns table (
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
  v_name text := btrim(coalesce(p_name, ''));
  v_head integer;
  v_head_version public.project_versions;
  v_version public.project_versions;
begin
  if char_length(v_name) not between 1 and 200 then
    raise exception 'a project name must be 1 to 200 characters'
      using errcode = '22023';
  end if;

  -- Lock first, so the head document read below is the head the rename is
  -- appended after. Runs under the caller's own RLS: a project they cannot
  -- update is simply not found, with the same message as a missing one.
  select p.head_version_number into v_head
    from public.projects p
   where p.id = p_project_id
   for update;
  if not found then
    raise exception 'project not found, or you cannot save to it'
      using errcode = '42501';
  end if;

  select * into v_head_version
    from public.project_versions v
   where v.project_id = p_project_id and v.version_number = v_head;
  if not found then
    raise exception 'project not found, or you cannot save to it'
      using errcode = '42501';
  end if;

  insert into public.project_versions (project_id, parent_version_id, kind, document)
  values (
    p_project_id,
    v_head_version.id,
    'rename',
    jsonb_set(v_head_version.document, '{state,projectName}', to_jsonb(v_name), true)
  )
  returning * into v_version;

  return query select v_version.id, v_version.version_number, v_version.created_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges. Supabase's default privileges grant broad rights on new public
-- tables and functions to anon, authenticated AND service_role (TRUNCATE,
-- REFERENCES and TRIGGER included), so start from nothing and grant exactly.
--
-- service_role gets NOTHING on these tables. It bypasses RLS, and no Stage 2
-- route may use it (spec, "Routes": no route imports createSupabaseAdminClient).
-- The app's only admin-client use is auth.admin.createUser / deleteUser in the
-- invite-accept route, which touches neither table. A future operation that
-- genuinely needs it (Stage 5's platform backup, say) grants it explicitly.
-- ---------------------------------------------------------------------------
revoke all on public.projects, public.project_versions from public, anon, authenticated, service_role;

grant select, insert, update, delete on public.projects to authenticated;
-- NO update grant on project_versions, at all.
grant select, insert, delete on public.project_versions to authenticated;

do $grants$
declare
  fn text;
begin
  foreach fn in array array[
    'public.can_read_project(uuid)',
    'public.can_write_project(uuid)',
    'public.create_project(uuid,text,jsonb,text)',
    'public.save_project_version(uuid,uuid,jsonb,text)',
    'public.rename_project(uuid,text)'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke all on function %s from anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end
$grants$;

-- Enabled, NOT forced — same reasoning as 0002. The definer triggers above
-- write projects as the owner, which FORCE would break.
alter table public.projects enable row level security;
alter table public.project_versions enable row level security;

-- ---------------------------------------------------------------------------
-- Policies. "Own" = ANY company you hold a membership in (the permission
-- matrix's own definition). Which tree you are LOOKING AT is the acting-as
-- filter, applied in the route; the security boundary never depends on the
-- acting-as cookie.
--
-- Acting as the Seed Collaborative through the consortium entitlement gets
-- NOTHING here in Stage 2: is_member_of(Seed) is false for them, so no rows and
-- no create (Open Item 2, deferred to Stage 3).
-- ---------------------------------------------------------------------------

-- projects ------------------------------------------------------------------
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated
  using (public.is_member_of(company_id) or public.is_platform_admin());

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
  for insert to authenticated
  with check (
    (public.is_member_of(company_id) or public.is_platform_admin())
    and created_by = auth.uid()
    and head_version_number = 0
  );

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update to authenticated
  using (public.is_member_of(company_id) or public.is_platform_admin())
  with check (public.is_member_of(company_id) or public.is_platform_admin());
-- (guard_project_columns narrows this to `folder`. Moving between folders
--  changes nothing about who can see a project, and creates no version.)

drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
  for delete to authenticated
  using (public.is_platform_admin());
-- Decision 13: archive, never delete. Past Projects IS the archive.

drop policy if exists projects_require_aal on public.projects;
create policy projects_require_aal on public.projects
  as restrictive for all to authenticated
  using (public.meets_required_aal())
  with check (public.meets_required_aal());

-- project_versions ----------------------------------------------------------
drop policy if exists project_versions_select on public.project_versions;
create policy project_versions_select on public.project_versions
  for select to authenticated
  using (public.can_read_project(project_id));

drop policy if exists project_versions_insert on public.project_versions;
create policy project_versions_insert on public.project_versions
  for insert to authenticated
  with check (public.can_write_project(project_id));
-- (prepare_project_version enforces the same thing, and runs first.)

-- No update policy. There is no update grant either.

drop policy if exists project_versions_delete on public.project_versions;
create policy project_versions_delete on public.project_versions
  for delete to authenticated
  using (public.is_platform_admin());
-- (refuse_project_version_change admits it only as a whole-project cascade.)

drop policy if exists project_versions_require_aal on public.project_versions;
create policy project_versions_require_aal on public.project_versions
  as restrictive for all to authenticated
  using (public.meets_required_aal())
  with check (public.meets_required_aal());

commit;
