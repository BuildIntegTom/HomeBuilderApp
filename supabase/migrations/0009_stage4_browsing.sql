-- Stage 4 — consortium browsing: the redacted read, and access requests.
--
-- Spec: building_integrity_app_spec.md, "Stage 4 plan — Consortium browsing" →
-- "The redactor: where it runs", "What browsing shows", "is_seed_member",
-- "Access requests", the answered Open Items, and the 4A coder handoff.
-- Approved by Tommy 2026-09-20 (all seven Open Items answered).
--
-- THE REDACTOR IS THE HIGHEST-RISK SINGLE PIECE OF THE WHOLE DESIGN. It lives
-- here, in the database, inside SECURITY DEFINER functions, because the
-- publishable key ships in the browser: anything the database will serve,
-- PostgREST will serve directly, so a route cannot be the boundary.
--
-- SAFE ON THE LIVE DATABASE, BY CONSTRUCTION:
--   * One transaction: a failure part-way applies nothing.
--   * Re-runnable: `create table if not exists`, `create index if not exists`,
--     `create or replace function`, `drop … if exists` before every policy, and
--     the one seed row is an upsert. A second run changes nothing.
--   * NO Stage 1 or Stage 2 object is altered.
--   * EXACTLY ONE Stage 3 object is replaced: the function shareable_companies
--     (Open Item 5, answered by Tommy: tighten it to seed-entitled callers). Same
--     signature and privileges; only the body changes.
--   * THE FIVE OBJECTS 0006 AND 0008 WARNED STAGE 4 NOT TO WIDEN ARE NOT TOUCHED:
--       can_read_project, can_write_project, holds_project_grant,
--       projects_select, project_versions_select.
--     Browsing reaches NONE of them. After this migration the raw document of a
--     project is still served only to its owner company's members, its grant
--     holders and platform admins, exactly as after 0008. Everything a browser
--     gets arrives through browse_version, redacted. The README post-flight and
--     the RLS suite both prove the five are unchanged.
--
-- Run it AFTER 0008, in the Supabase SQL editor, exactly as 0006–0008 were.
--
-- WHAT IS MONEY. For schema version 24 the redaction list is exactly one path,
-- state.priceModifier — verified against ProjectState and REQUIRED_STATE_KEYS
-- in apps/web/app/projectFile.ts (PROJECT_FILE_VERSION = 24). The seven
-- plaster/shipping prices are useState only and are not in the document; the
-- day they are added to ProjectState they become redaction targets, and they
-- need a NEW schema version with its OWN row below.
--
-- TWO THINGS THE BROWSE PATH WITHHOLDS BESIDES THE MONEY FIELD, decided by
-- Tommy on 2026-09-23 after 4A's review found both. Neither is a redactor bug;
-- both are places where ordinary metadata crosses a company line:
--   * SAVE LABELS ARE NOT SERVED WHILE BROWSING (null from browse_versions and
--     browse_version). A label is free text, and free text is where people
--     write prices — the review read back "Quoted at 1.35 markup" from another
--     company's version while the structured modifier was correctly stripped.
--   * AN EMAIL-SHAPED AUTHOR NAME IS MASKED WHILE BROWSING, to "a member of
--     <company>". The snapshot falls back to the account's email when nobody
--     has set a display name, so every member company would otherwise be shown
--     that address.
-- Both apply to the BROWSE PATH ONLY. The owning company and invited
-- collaborators keep labels and real names, through Stage 2's and Stage 3's
-- own paths, which this file does not touch.
--
-- FAILING CLOSED. A schema version with no row in browse_schema_redaction is
-- NOT SERVED cross-company at all — not redacted, not raw, nothing. Absence of
-- the row is the failure; a version genuinely without money fields gets a row
-- with an empty array, written deliberately in a later migration.
--
-- 0004's LIST OF DEFINER FUNCTIONS THAT BYPASS THE RESTRICTIVE aal POLICIES,
-- brought up to date again (0004's and 0008's comments are in applied files and
-- are left as they were). The list is now:
--   0003  redeem_invite                     writes a membership
--   0005  create_company_with_first_admin   writes a company and an invite
--   0008  share_project_with_person         writes a grant        — checks aal itself
--   0008  share_project_with_company        writes a grant        — checks aal itself
--   0008  dismiss_share_notices             writes notice state   — checks aal itself
--   0008  shareable_companies               reads company names   — checks aal itself
--         (replaced here; still checks aal itself)
--   0008  grant_creator_access (trigger)    writes a creator grant, only inside a
--         projects insert that already passed projects_require_aal
--   0008  project_owner_company_id / project_owner_company_name
--                                           read past RLS         — check aal themselves
--   0009  browse_companies, browse_projects, browse_versions
--                                           read past RLS         — check aal themselves
--   0009  browse_version                    reads a document past RLS, serves it
--                                           redacted              — checks aal itself
--   0009  browse_redact                     internal; no client role may call it
--   0009  browse_author_name                internal; not definer, reads nothing;
--                                           no client role may call it
--   0009  request_project_access            writes a request      — checks aal itself
--   0009  decide_collab_request             writes a decision, and a grant through
--                                           share_project_with_person
--                                                                 — checks aal itself

begin;

-- ---------------------------------------------------------------------------
-- browse_schema_redaction — which paths are money, per schema version.
-- ---------------------------------------------------------------------------
-- Each path is a JSON array of keys from the document root, e.g.
-- ["state","priceModifier"]. The checks below make a malformed classification
-- impossible to store, so the redactor never has to guess what a row meant.
create table if not exists public.browse_schema_redaction (
  schema_version integer primary key,
  redacted_paths jsonb not null,
  note text,
  constraint browse_schema_redaction_paths_array
    check (jsonb_typeof(redacted_paths) = 'array'),
  -- Every path is a non-empty array whose every element is a non-empty string.
  constraint browse_schema_redaction_paths_shape
    check (not jsonb_path_exists(redacted_paths,
             'strict $[*] ? (@.type() != "array" || @.size() == 0)')
           and not jsonb_path_exists(redacted_paths,
             'strict $[*][*] ? (@.type() != "string" || @ == "")'))
);

-- Schema version 24: exactly state.priceModifier. An UPSERT, so re-running this
-- file restores the classification rather than trusting whatever is there.
insert into public.browse_schema_redaction (schema_version, redacted_paths, note)
values (
  24,
  '[["state","priceModifier"]]'::jsonb,
  'PROJECT_FILE_VERSION 24 (apps/web/app/projectFile.ts). The only money field in ProjectState is priceModifier (spec, Stage 4 plan, "What is money"). The seven plaster/shipping prices are not in the document at v24.'
)
on conflict (schema_version) do update
  set redacted_paths = excluded.redacted_paths,
      note = excluded.note;

-- ---------------------------------------------------------------------------
-- collab_requests — a browser asking to be let in (the other direction of 26).
-- The one thing in this stage that writes.
-- ---------------------------------------------------------------------------
create table if not exists public.collab_requests (
  id uuid primary key default gen_random_uuid(),
  -- Reachable only through a platform admin deleting the whole project.
  project_id uuid not null references public.projects (id) on delete cascade,
  -- A request is personal (Open Item 3, answered). DELETING THE ACCOUNT DELETES
  -- THE REQUEST — a DELETE, which nothing refuses.
  requested_by uuid not null references auth.users (id) on delete cascade,
  -- Snapshot, by prepare_project_version's rule (display name, then email).
  requested_by_name text not null,
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'granted', 'declined')),
  created_at timestamptz not null default now(),
  -- Who decided. A PLAIN uuid with NO foreign key — authorship-like, as
  -- granted_by and author_id are. A decline carries NO reason (Open Item 4,
  -- answered): "Declined" is all the requester sees.
  decided_by uuid,
  decided_by_name text,
  decided_at timestamptz,
  constraint collab_requests_message_length
    check (message is null or char_length(message) between 1 and 500),
  constraint collab_requests_decided_iff_not_pending
    check ((status = 'pending') = (decided_by is null)
       and (status = 'pending') = (decided_by_name is null)
       and (status = 'pending') = (decided_at is null))
);

-- One open request per person per project. Re-asking after a decision is a new
-- row, deliberately: with no notification channel there is nothing to spam.
create unique index if not exists collab_requests_one_pending
  on public.collab_requests (project_id, requested_by)
  where status = 'pending';
create index if not exists collab_requests_requested_by_idx
  on public.collab_requests (requested_by);
create index if not exists collab_requests_decided_by_idx
  on public.collab_requests (decided_by);

-- ---------------------------------------------------------------------------
-- The redactor. Internal: only the definer functions below call it, and no
-- client role holds EXECUTE on it.
-- ---------------------------------------------------------------------------
-- Returns the document with every classified path REMOVED (not nulled, not
-- zeroed: a key that is not there cannot be multiplied by anything), and a
-- top-level `redaction` marker naming what was removed (Open Item 1, answered).
-- The marker OVERWRITES any `redaction` key the stored document carried, so a
-- saved document cannot pre-declare fields as "redacted".
--
-- It RAISES, and serves nothing, when:
--   * the schema version has no row (fails closed: the future-schema guard);
--   * the document's own schemaVersion disagrees with the version asked about;
--   * a classified path is still present after removal;
--   * a key named priceModifier survives ANYWHERE in the document. A belt to
--     the classification's braces, independent of the schema version: if a
--     future format ever moves the modifier and the classification is not
--     updated, the document is refused rather than served with the margin.
create or replace function public.browse_redact(p_document jsonb, p_schema_version integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paths jsonb;
  v_path jsonb;
  v_keys text[];
  v_doc jsonb := p_document;
  v_removed jsonb := '[]'::jsonb;
begin
  select r.redacted_paths into v_paths
    from public.browse_schema_redaction r
   where r.schema_version = p_schema_version;
  if not found then
    raise exception 'file format % has no redaction classification, so it cannot be shown to another company', p_schema_version
      using errcode = '0A000';
  end if;

  if p_document is null
     or jsonb_typeof(p_document) <> 'object'
     or (p_document ->> 'schemaVersion') is distinct from p_schema_version::text then
    raise exception 'this document''s format does not match its recorded format, so it cannot be shown to another company'
      using errcode = '0A000';
  end if;

  for v_path in select e from jsonb_array_elements(v_paths) as t(e) loop
    select array_agg(k order by n) into v_keys
      from jsonb_array_elements_text(v_path) with ordinality as t(k, n);
    v_doc := v_doc #- v_keys;
    if v_doc #> v_keys is not null then
      raise exception 'a cost field survived redaction, so this version cannot be shown to another company'
        using errcode = '0A000';
    end if;
    v_removed := v_removed || to_jsonb(array_to_string(v_keys, '.'));
  end loop;

  if jsonb_path_exists(v_doc, 'lax $.**.priceModifier') then
    raise exception 'a cost field survived redaction, so this version cannot be shown to another company'
      using errcode = '0A000';
  end if;

  return v_doc || jsonb_build_object(
    'redaction', jsonb_build_object(
      'schemaVersion', p_schema_version,
      'removedPaths', v_removed,
      'reason', 'another company''s cost information'));
end;
$$;

-- ---------------------------------------------------------------------------
-- browse_author_name — a name snapshot, masked on the browse path when it is
-- an email address. Internal: no client role holds EXECUTE on it.
-- ---------------------------------------------------------------------------
-- NARROWED 2026-09-23, from 4A's review. author_name is a snapshot taken by
-- prepare_project_version's rule: the display name, and FAILING THAT THE
-- ACCOUNT'S EMAIL. Stage 3 accepted that fallback crossing to an invited
-- collaborator; it must not cross to every member company in the consortium,
-- which is what browsing would otherwise do with the address of anyone who
-- never set a display name.
--
-- So a snapshot that LOOKS LIKE AN EMAIL becomes "a member of <company>" —
-- Tommy's wording, chosen 2026-09-24 because it reads properly for every
-- company name, including one that begins with "The". A name we have no
-- company for (unreachable here: the join is inner and companies.name is not
-- null) falls back to "a member of the consortium", the same shape. A real
-- display name passes through untouched. The test is deliberately generous in
-- the safe direction: anything with no whitespace and exactly one @ is treated
-- as an address and masked, so an unusual address is hidden rather than served.
-- A display name that happens to contain an @ ("Bob @ BI") has whitespace and
-- is not an address, so it survives.
--
-- IT IS DONE HERE, IN SQL, NOT IN A ROUTE — for the redactor's own reason:
-- PostgREST serves these functions directly, so a TypeScript layer could be
-- gone around. Only the BROWSE path masks: Stage 2's and Stage 3's own paths
-- are untouched, and the owning company and invited collaborators still see
-- exactly the snapshot that was stored.
create or replace function public.browse_author_name(p_name text, p_company_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
           when p_name is null then null
           when btrim(p_name) ~ '^[^[:space:]@]+@[^[:space:]@]+$'
             then 'a member of ' || coalesce(nullif(btrim(p_company_name), ''), 'the consortium')
           else p_name
         end;
$$;

-- ---------------------------------------------------------------------------
-- Browsing. SECURITY DEFINER (browsers hold no RLS read of these rows), and
-- each function checks for itself, never through a shared helper:
--   * a signed-in caller at a satisfied assurance level (meets_required_aal);
--   * seed entitlement: is_seed_entitled() — a membership in a company whose
--     is_seed_member is true — or a platform admin (the permission matrix's
--     last row: "Browse: yes");
--   * the browse set: projects owned by a company whose is_seed_member is true.
-- The false branch is symmetric: a non-member company's members see nothing,
-- and its projects are in nobody's browse set. Follow the flag, whatever it
-- says (28): a company that has left, flag off, drops out of both halves.
--
-- The listing functions return NO ROWS when those checks fail. browse_version
-- raises one uniform 42501 for "not entitled", "not in the browse set" and "no
-- such version", so it cannot be used to probe which ids exist.
-- None of the listing functions selects `document`, except browse_versions
-- reading state.projectName (the name each version was saved under).
-- ---------------------------------------------------------------------------

-- The member companies, by name. Ids and names only — never flags or theme.
create or replace function public.browse_companies()
returns table (id uuid, name text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or not public.meets_required_aal()
     or not (public.is_seed_entitled() or public.is_platform_admin()) then
    return;
  end if;
  return query
    select co.id, co.name
      from public.companies co
     where co.is_seed_member
     order by lower(co.name), co.id;
end;
$$;

-- The browse set, optionally narrowed to one company and one folder.
-- `access` is 'full' when the caller can already read the project (membership,
-- a grant, or platform admin — can_read_project, called, not widened): the UI
-- opens those through the Stage 2 route, with costs. Otherwise 'redacted'.
-- browse_version itself ALWAYS redacts (Open Item 2, answered).
create or replace function public.browse_projects(p_company uuid default null, p_folder text default null)
returns table (
  project_id uuid,
  name text,
  folder text,
  head_version_number integer,
  head_version_id uuid,
  head_author_name text,
  head_schema_version integer,
  head_redaction_known boolean,
  updated_at timestamptz,
  owner_company_id uuid,
  owner_company_name text,
  access text
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if p_folder is not null and p_folder not in ('current', 'past', 'proposals') then
    raise exception 'unknown folder' using errcode = '22023';
  end if;
  if auth.uid() is null
     or not public.meets_required_aal()
     or not (public.is_seed_entitled() or public.is_platform_admin()) then
    return;
  end if;
  return query
    select p.id,
           p.name,
           p.folder,
           p.head_version_number,
           v.id,
           -- Masked when the snapshot is an email address (see browse_author_name).
           public.browse_author_name(v.author_name, co.name),
           v.schema_version,
           exists (select 1 from public.browse_schema_redaction r
                    where r.schema_version = v.schema_version),
           p.updated_at,
           co.id,
           co.name,
           case when public.can_read_project(p.id) then 'full' else 'redacted' end
      from public.projects p
      join public.companies co on co.id = p.company_id
      left join public.project_versions v
        on v.project_id = p.id and v.version_number = p.head_version_number
     where co.is_seed_member
       and (p_company is null or p.company_id = p_company)
       and (p_folder is null or p.folder = p_folder)
     order by p.updated_at desc, p.id;
end;
$$;

-- One browsable project's version list: the metadata Stage 2C shows, which
-- carries no cost field. `redaction_known` false means browse_version will
-- refuse that version (its format is unclassified): show that it cannot be
-- shown, and offer NO download of any kind.
--
-- TWO THINGS STAGE 2C SHOWS ARE WITHHELD HERE, NARROWED 2026-09-23 FROM 4A'S
-- REVIEW. The column stays (4B's shape does not change); the value does not.
--   * `label` IS ALWAYS NULL. A save label is free text, and free text is
--     exactly where a price is written: the review's probe read back "Quoted
--     at 1.35 markup" from another company's version. The structured
--     priceModifier is stripped by the redactor and the label would have
--     carried the same number across in words. The owning company and invited
--     collaborators still see labels, through Stage 2's and Stage 3's own
--     paths; only the browse path drops them.
--   * `author_name` is masked when it is an email address.
create or replace function public.browse_versions(p_project uuid)
returns table (
  version_id uuid,
  version_number integer,
  parent_version_id uuid,
  kind text,
  label text,
  author_name text,
  created_at timestamptz,
  schema_version integer,
  redaction_known boolean,
  project_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if auth.uid() is null
     or not public.meets_required_aal()
     or not (public.is_seed_entitled() or public.is_platform_admin()) then
    return;
  end if;
  return query
    select v.id,
           v.version_number,
           v.parent_version_id,
           v.kind,
           null::text,  -- label: never served on the browse path (see above)
           public.browse_author_name(v.author_name, co.name),
           v.created_at,
           v.schema_version,
           exists (select 1 from public.browse_schema_redaction r
                    where r.schema_version = v.schema_version),
           v.document #>> '{state,projectName}'
      from public.project_versions v
      join public.projects p on p.id = v.project_id
      join public.companies co on co.id = p.company_id
     where v.project_id = p_project
       and co.is_seed_member
     order by v.version_number desc;
end;
$$;

-- THE ONLY WAY A BROWSED DOCUMENT IS SERVED. Always redacted, for every caller,
-- including one who could read the project in full (Open Item 2) and a platform
-- admin (who is served in full through the normal path instead).
--
-- `label` is always null here too, and for the same reason as in
-- browse_versions: it is never even read out of the row, so there is nothing
-- to leak by a later edit. `author_name` is masked when it is an address.
create or replace function public.browse_version(p_project uuid, p_version uuid)
returns table (
  project_id uuid,
  folder text,
  owner_company_id uuid,
  owner_company_name text,
  version_id uuid,
  version_number integer,
  kind text,
  label text,
  author_name text,
  created_at timestamptz,
  schema_version integer,
  document jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_row record;
begin
  if auth.uid() is null
     or not public.meets_required_aal()
     or not (public.is_seed_entitled() or public.is_platform_admin()) then
    raise exception 'version not found, or you cannot browse it'
      using errcode = '42501';
  end if;

  -- v.label is deliberately NOT selected: the browse path never carries it.
  select v.id, v.project_id, v.version_number, v.kind,
         public.browse_author_name(v.author_name, co.name) as author_name,
         v.created_at, v.schema_version, v.document,
         p.folder, co.id as company_id, co.name as company_name
    into v_row
    from public.project_versions v
    join public.projects p on p.id = v.project_id
    join public.companies co on co.id = p.company_id
   where v.id = p_version
     and v.project_id = p_project
     and co.is_seed_member;
  if not found then
    raise exception 'version not found, or you cannot browse it'
      using errcode = '42501';
  end if;

  return query select
    v_row.project_id,
    v_row.folder,
    v_row.company_id,
    v_row.company_name,
    v_row.id,
    v_row.version_number,
    v_row.kind,
    null::text,  -- label: never served on the browse path (see above)
    v_row.author_name,
    v_row.created_at,
    v_row.schema_version,
    public.browse_redact(v_row.document, v_row.schema_version);
end;
$$;

-- ---------------------------------------------------------------------------
-- Access requests. SECURITY DEFINER: authenticated holds select only on
-- collab_requests. Each function checks its own precondition and calls
-- meets_required_aal() itself.
-- ---------------------------------------------------------------------------

-- Ask to be let into a project you can browse. Statuses are answers:
--   requested            a new pending request was written
--   already-pending      you already have one open on this project; untouched
--   already-has-access   you can already read it; nothing written
-- A project outside your browse set — or one that does not exist — raises one
-- uniform 42501, so a request cannot probe for project ids.
create or replace function public.request_project_access(p_project uuid, p_message text default null)
returns table (status text, request_id uuid)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
  v_name text;
  v_request uuid;
begin
  if auth.uid() is null
     or not public.meets_required_aal()
     or not (public.is_seed_entitled() or public.is_platform_admin()) then
    raise exception 'project not found, or you cannot ask about it'
      using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.projects p
      join public.companies co on co.id = p.company_id
     where p.id = p_project and co.is_seed_member
  ) then
    raise exception 'project not found, or you cannot ask about it'
      using errcode = '42501';
  end if;

  if public.can_read_project(p_project) then
    return query select 'already-has-access'::text, null::uuid;
    return;
  end if;

  if v_message is not null and char_length(v_message) > 500 then
    raise exception 'a request note can be at most 500 characters' using errcode = '22023';
  end if;

  select coalesce(nullif(btrim(up.display_name), ''), up.email, u.email)
    into v_name
    from auth.users u left join public.user_profiles up on up.id = u.id
   where u.id = auth.uid();
  if v_name is null then
    raise exception 'cannot attribute this request: the signed-in account has no name or email'
      using errcode = '23514';
  end if;

  insert into public.collab_requests (project_id, requested_by, requested_by_name, message, status, created_at)
  values (p_project, auth.uid(), v_name, v_message, 'pending', now())
  on conflict (project_id, requested_by) where status = 'pending' do nothing
  returning id into v_request;

  if v_request is not null then
    return query select 'requested'::text, v_request;
    return;
  end if;

  select r.id into v_request from public.collab_requests r
   where r.project_id = p_project and r.requested_by = auth.uid() and r.status = 'pending';
  return query select 'already-pending'::text, v_request;
end;
$$;

-- Grant or decline a request. Only a member of the OWNER company, or a platform
-- admin — the same set that may share and remove. Not the requester's company,
-- and not a collaborator. Anyone else, and a request that does not exist, gets
-- one uniform 42501.
--
-- GRANTING WRITES THE GRANT THROUGH share_project_with_person, with the
-- requester's address — deliberately not a second way to write a collaborators
-- row. The result is an ordinary personal grant with granted_by = the decider
-- (auth.uid() is still the decider inside that definer call), so the Shared
-- tab, the notice, the access list and the backup rule all already understand
-- it. The returned status is share_project_with_person's own:
--   shared           a new grant was written
--   already-shared   a grant to them already existed (made by someone else)
--   already-member   they have since joined the owner company
--   self             they have since joined the owner company, and it is you
-- In every one of those the requester can now read the project, so the request
-- is marked granted.
--   declined         p_grant = false; nothing is written to collaborators
--   already-granted / already-declined   the request was decided before; untouched
create or replace function public.decide_collab_request(p_request uuid, p_grant boolean)
returns table (status text, grant_id uuid)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_request public.collab_requests;
  v_owner uuid;
  v_name text;
  v_email text;
  v_status text;
  v_grant uuid;
begin
  if auth.uid() is null or not public.meets_required_aal() then
    raise exception 'request not found, or you cannot decide it'
      using errcode = '42501';
  end if;

  select r.* into v_request
    from public.collab_requests r
   where r.id = p_request
   for update;
  if found then
    select p.company_id into v_owner from public.projects p where p.id = v_request.project_id;
  end if;
  if not found
     or v_owner is null
     or not (public.is_member_of(v_owner) or public.is_platform_admin()) then
    raise exception 'request not found, or you cannot decide it'
      using errcode = '42501';
  end if;

  if p_grant is null then
    raise exception 'say whether to grant or decline' using errcode = '22023';
  end if;

  if v_request.status <> 'pending' then
    return query select ('already-' || v_request.status)::text, null::uuid;
    return;
  end if;

  select coalesce(nullif(btrim(up.display_name), ''), up.email, u.email)
    into v_name
    from auth.users u left join public.user_profiles up on up.id = u.id
   where u.id = auth.uid();
  if v_name is null then
    raise exception 'cannot attribute this decision: the signed-in account has no name or email'
      using errcode = '23514';
  end if;

  if not p_grant then
    update public.collab_requests r
       set status = 'declined', decided_by = auth.uid(), decided_by_name = v_name, decided_at = now()
     where r.id = v_request.id;
    return query select 'declined'::text, null::uuid;
    return;
  end if;

  select u.email into v_email from auth.users u where u.id = v_request.requested_by;
  select s.status, s.grant_id into v_status, v_grant
    from public.share_project_with_person(v_request.project_id, v_email) s;

  if v_status not in ('shared', 'already-shared', 'already-member', 'self') then
    raise exception 'the requester''s account could not be found; nothing was granted'
      using errcode = '23514';
  end if;
  -- Belt: an address lookup must land on the person who asked.
  if v_grant is not null and not exists (
    select 1 from public.collaborators c
     where c.id = v_grant and c.grantee_user_id = v_request.requested_by
  ) then
    raise exception 'the grant did not reach the requester; nothing was granted'
      using errcode = '23514';
  end if;

  update public.collab_requests r
     set status = 'granted', decided_by = auth.uid(), decided_by_name = v_name, decided_at = now()
   where r.id = v_request.id;
  return query select v_status, v_grant;
end;
$$;

-- ---------------------------------------------------------------------------
-- shareable_companies (REPLACED — the one Stage 3 object this file changes).
-- Open Item 5, answered by Tommy 2026-09-20: it answered ANY signed-in account,
-- so a non-member company's members could read the consortium's company names,
-- which undercut "a non-member company neither sees nor is seen". Now it
-- answers seed-entitled callers (and platform admins, who may act as any
-- company); anyone else gets no rows. Same signature, same privileges.
-- ---------------------------------------------------------------------------
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
  if not (public.is_seed_entitled() or public.is_platform_admin()) then
    return;
  end if;
  return query
    select co.id, co.name
      from public.companies co
     where co.is_seed_member
     order by lower(co.name), co.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges. Supabase's default privileges grant broad rights on new public
-- tables and functions to anon, authenticated AND service_role, so start from
-- nothing and grant exactly.
-- ---------------------------------------------------------------------------
revoke all on public.browse_schema_redaction, public.collab_requests
  from public, anon, authenticated, service_role;

-- select ONLY. Every write goes through request_project_access and
-- decide_collab_request. browse_schema_redaction: nothing to any client role;
-- only the definer functions (the owner) read it, and only a migration writes it.
grant select on public.collab_requests to authenticated;

do $grants$
declare
  fn text;
begin
  foreach fn in array array[
    'public.browse_companies()',
    'public.browse_projects(uuid,text)',
    'public.browse_versions(uuid)',
    'public.browse_version(uuid,uuid)',
    'public.request_project_access(uuid,text)',
    'public.decide_collab_request(uuid,boolean)'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke all on function %s from anon', fn);
    execute format('revoke all on function %s from service_role', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;

  -- The redactor itself: no client role calls it. browse_version runs as the
  -- owner, so it can.
  execute 'revoke all on function public.browse_redact(jsonb,integer) from public';
  execute 'revoke all on function public.browse_redact(jsonb,integer) from anon';
  execute 'revoke all on function public.browse_redact(jsonb,integer) from authenticated';
  execute 'revoke all on function public.browse_redact(jsonb,integer) from service_role';

  -- The author-name mask: internal too. Nothing a client calls needs it, and a
  -- client holding it could ask which snapshots are addresses.
  execute 'revoke all on function public.browse_author_name(text,text) from public';
  execute 'revoke all on function public.browse_author_name(text,text) from anon';
  execute 'revoke all on function public.browse_author_name(text,text) from authenticated';
  execute 'revoke all on function public.browse_author_name(text,text) from service_role';
end
$grants$;

-- Enabled, NOT forced — same reasoning as 0002, 0006 and 0008: the definer
-- functions above read and write as the owner, which FORCE would break.
-- browse_schema_redaction has no policy at all: no client role holds a grant on
-- it, and with RLS on, a grant given by mistake would still read nothing.
alter table public.browse_schema_redaction enable row level security;
alter table public.collab_requests enable row level security;

-- ---------------------------------------------------------------------------
-- Policies on collab_requests.
-- ---------------------------------------------------------------------------
-- The requester sees their own requests (a decline shows as "Declined", with
-- no reason). Owner members and platform admins see every request on the
-- owner's projects (the Access… note). Nobody else — not a collaborator, not
-- the requester's colleagues.
drop policy if exists collab_requests_select on public.collab_requests;
create policy collab_requests_select on public.collab_requests
  for select to authenticated
  using (
    requested_by = auth.uid()
    or public.is_member_of(public.project_owner_company_id(project_id))
    or public.is_platform_admin()
  );

-- No insert, update or delete policy: there are no such grants either.

drop policy if exists collab_requests_require_aal on public.collab_requests;
create policy collab_requests_require_aal on public.collab_requests
  as restrictive for all to authenticated
  using (public.meets_required_aal())
  with check (public.meets_required_aal());

commit;
