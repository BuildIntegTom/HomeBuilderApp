-- Stage 7 — a proposal: a design made by somebody with NO ACCOUNT, sent to a
-- company as a link, and adopted by that company as a real project.
--
-- > "building integrity can recieve a link from a not signed in account - and
-- >  then adopt the project as their own and send a link for that new project
-- >  with link invite."
-- >   — Tommy, 2026-11-08
--
-- With 0013 the far end of that sentence already works: the link BI sends back
-- is also the client's way to an account. This migration builds the near end,
-- which is the half that has no precedent in this schema — every row in it so
-- far belongs to a company, and a proposal, by definition, does not yet.
--
-- ---------------------------------------------------------------------------
-- ⚠ THERE IS NO PUBLIC INBOX, AND THAT IS THE DESIGN
-- ---------------------------------------------------------------------------
--
-- An earlier reading of this had companies opting in to RECEIVE submissions,
-- which needs a directory of who accepts them, a spam queue, and somebody to
-- moderate it. His own words put the transport outside the app entirely: the
-- designer gets a URL and sends it to Building Integrity however they like —
-- email, text, read out over the phone. Nothing arrives anywhere unasked, so
-- there is nothing to moderate.
--
-- What follows from that, and is worth stating because it looks like an
-- omission: a proposal names NO COMPANY when it is created. It is addressed by
-- possession of the token, exactly as a share link is. Whichever company adopts
-- it is recorded at that moment and not before.
--
-- ---------------------------------------------------------------------------
-- THE FOUR FUNCTIONS, AND WHY THE SPLIT IS WHERE IT IS
-- ---------------------------------------------------------------------------
--
--   submit_proposal     anon           writes a document, returns nothing.
--   proposal_preview    anon           who sent it, when, adopted or not.
--                                      ⚠ NEVER the document.
--   proposal_document   authenticated  the design itself, to look at before
--                                      adopting.
--   adopt_proposal      authenticated  creates the real project.
--
-- The line between `proposal_preview` and `proposal_document` is the one that
-- matters, and it is the same line 0011 drew between `share_link_preview` and
-- claiming a link. A token in a URL travels: it gets forwarded, pasted into a
-- chat, logged by a proxy. Anybody holding it may learn that a proposal exists
-- and whether it has been taken up — that is what a sender needs to be able to
-- check. Reading the BUILDING requires an account, so the design is behind a
-- sign-in even though the link is not.
--
-- ⚠ That is deliberately WEAKER than a share link, which gates on a grant.
-- Any signed-in account may read any proposal document it holds a token for.
-- The alternative — a grant — cannot exist: there is nobody to grant to until
-- somebody adopts it, and requiring membership of a named company would mean
-- knowing which company before the link is sent, which is the directory this
-- design exists to avoid. The protection is the token's own secrecy, and the
-- document is the submitter's own design, not a third party's data.
--
-- ---------------------------------------------------------------------------
-- ⚠ THE ABUSE SURFACE, STATED HERE RATHER THAN DISCOVERED LATER
-- ---------------------------------------------------------------------------
--
-- `submit_proposal` is an UNAUTHENTICATED endpoint that stores arbitrary JSON.
-- That is new in this schema; nothing else lets an anonymous caller write.
--
-- What is mitigated here:
--   * the SAME document rules a saved version is held to — object, `state`,
--     integer `schemaVersion`, 4MB — so an unusable design is refused at
--     submission rather than at adoption, after the sender was told it had
--     been received. See `refuse_unusable_proposal`;
--   * `expires_at`, so an unadopted proposal removes itself rather than
--     accumulating forever;
--   * no read path that lists proposals, so a flood is invisible rather than
--     being presented to anybody.
--
-- ⚠ What is NOT mitigated: RATE LIMITING. Postgres alone does it badly — a
-- per-IP counter needs the IP, which the database does not have, and a
-- per-token one is defeated by minting tokens. The honest options are an edge
-- rule in front of the route or a counter in the route handler, and both are
-- out of scope here. Deferred DELIBERATELY, on the grounds that nobody uses
-- this app for real until it is hardened off -- Tommy, 2026-11-16: "no one
-- plans on using this app until hardened off by february 1", meaning
-- 1 FEBRUARY 2027. **That is the deadline this owes, and it is the thing to
-- build first when the hardening window opens in January.**
--
-- ---------------------------------------------------------------------------
-- Re-runnable, like every migration since 0006: `create table if not exists`,
-- `create index if not exists`, `create or replace function`, and policies
-- dropped before being created.
-- ---------------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------------
-- proposals
-- ---------------------------------------------------------------------------
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  -- ⚠ Only the SHA-256 of the token, exactly as `share_links.token_hash` and
  -- `invites.token_hash`. The raw token exists in the URL and nowhere else, so
  -- reading this table cannot produce a usable link. Same algorithm on purpose:
  -- there is ONE answer in this schema to "how is a link token hashed".
  token_hash text not null unique,
  -- The design. Capped by the trigger below.
  document jsonb not null,
  -- ⚠ BOTH OPTIONAL. The whole point is that the sender has no account, so
  -- there may be no name and no address to record; a proposal that says only
  -- "somebody sent this" is still a usable proposal. Trimmed to null rather
  -- than stored as an empty string, so one absent value has one representation.
  submitter_name text check (submitter_name is null or char_length(submitter_name) between 1 and 200),
  submitter_email text check (submitter_email is null or char_length(submitter_email) between 3 and 320),
  created_at timestamptz not null default now(),
  -- ⚠ Required, and in the future when written — the same shape
  -- `share_links.expires_at` carries, and for the same reason: "null means
  -- never" puts a branch in every read for a case nobody asked for. The NUMBER
  -- is chosen in the app, not here.
  expires_at timestamptz not null,
  -- The adoption, all three together or none of them.
  adopted_at timestamptz,
  -- ⚠ ON DELETE RESTRICT, matching `projects.company_id`: a company leaving
  -- must not silently erase the record that it adopted somebody's design.
  adopted_by_company uuid references public.companies (id) on delete restrict,
  -- Cascade only: reachable when a platform admin deletes the whole project,
  -- and a proposal pointing at a project that no longer exists would be worse
  -- than one that has forgotten which project it became.
  adopted_project_id uuid references public.projects (id) on delete cascade,
  constraint proposals_expires_after_creation check (expires_at > created_at),
  -- ⚠ Adopted is adopted BY somebody INTO something: the three move together
  -- or not at all. Without this, a half-written adoption looks like an
  -- unadopted proposal to `proposal_preview` and like an adopted one to
  -- `adopt_proposal`'s own guard, and the two would disagree.
  constraint proposals_adopted_together check (
    (adopted_at is null and adopted_by_company is null and adopted_project_id is null)
    or (adopted_at is not null and adopted_by_company is not null and adopted_project_id is not null)
  )
);

-- Expiry sweeps read this; nothing else lists proposals at all.
create index if not exists proposals_expires_idx on public.proposals (expires_at);

-- -------------------------------------------------------------------------
-- ⚠ **A PROPOSAL IS HELD TO THE SAME DOCUMENT RULES AS A SAVED VERSION, AND
-- THAT IS NOT TIDINESS — IT IS THE DIFFERENCE BETWEEN A REFUSAL AND A TRAP.**
--
-- `prepare_project_version` (0006) refuses a document that is not an object,
-- that carries no `state` object, that carries no integer `schemaVersion`, or
-- that is over 4MB. `adopt_proposal` inserts into `project_versions`, so every
-- one of those refusals is waiting at ADOPTION.
--
-- A proposal failing them would therefore be accepted, the sender told it was
-- received, a link sent, a company would open it and press Adopt — and only
-- then would anybody find out it could never become a project. Found
-- 2026-11-14 the first time this migration ran end to end against PGlite: a
-- fixture document with no `state` key submitted happily and then could not be
-- adopted at all.
--
-- ⚠ The rules are RESTATED here rather than shared, deliberately, and the cost
-- is that the two can drift. The alternative — extracting a shared validator —
-- means editing `prepare_project_version`, the trigger guarding every save
-- every company makes, to add something nothing else needed. The tests pin
-- both ends; this comment is the pointer between them.
-- -------------------------------------------------------------------------
create or replace function public.refuse_unusable_proposal()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  c_max_document_bytes constant integer := 4 * 1024 * 1024;
begin
  if new.document is null or jsonb_typeof(new.document) <> 'object' then
    raise exception 'A proposal''s design must be a JSON object.' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(new.document -> 'state') is distinct from 'object' then
    raise exception 'A proposal''s design must carry a "state" object, like any saved project.'
      using errcode = 'check_violation';
  end if;
  if jsonb_typeof(new.document -> 'schemaVersion') is distinct from 'number'
     or (new.document ->> 'schemaVersion') !~ '^-?[0-9]{1,9}$' then
    raise exception 'A proposal''s design must carry an integer "schemaVersion", like any saved project.'
      using errcode = 'check_violation';
  end if;
  if octet_length(new.document::text) > c_max_document_bytes then
    raise exception 'This design is % bytes; a proposal may be at most % bytes.',
      octet_length(new.document::text), c_max_document_bytes
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists proposals_document_size on public.proposals;
drop trigger if exists proposals_document_usable on public.proposals;
create trigger proposals_document_usable
  before insert or update on public.proposals
  for each row execute function public.refuse_unusable_proposal();

-- ---------------------------------------------------------------------------
-- ⚠ RLS ON, AND NOT ONE POLICY. Functions only.
--
-- This is the strictest table in the schema and it is the right default for
-- the only one an anonymous caller can write to: with RLS enabled and no
-- policy, every direct select, insert, update and delete by `anon` and
-- `authenticated` returns nothing or fails. Every legitimate path below is
-- SECURITY DEFINER and therefore bypasses this on purpose, which means the
-- access rules for proposals are exactly the four function bodies and nowhere
-- else — the property that makes them reviewable in one sitting.
-- ---------------------------------------------------------------------------
alter table public.proposals enable row level security;
alter table public.proposals force row level security;

revoke all on table public.proposals from anon;
revoke all on table public.proposals from authenticated;

-- ---------------------------------------------------------------------------
-- submit_proposal — the anonymous write.
--
-- Returns nothing but the id and the expiry. ⚠ It deliberately does NOT return
-- the token: the caller already has it (it hashed it to get here), and a
-- function that hands back a usable token is one logging misconfiguration away
-- from writing links into a log file.
-- ---------------------------------------------------------------------------
create or replace function public.submit_proposal(
  p_token_hash text,
  p_document jsonb,
  p_expires_at timestamptz,
  p_submitter_name text default null,
  p_submitter_email text default null
)
returns table (proposal_id uuid, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_row public.proposals;
begin
  if p_token_hash is null or char_length(btrim(p_token_hash)) = 0 then
    raise exception 'A proposal needs a token.' using errcode = 'check_violation';
  end if;
  if p_document is null then
    raise exception 'A proposal needs a design.' using errcode = 'check_violation';
  end if;
  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'A proposal needs an expiry in the future.' using errcode = 'check_violation';
  end if;

  insert into public.proposals (token_hash, document, expires_at, submitter_name, submitter_email)
  values (
    btrim(p_token_hash),
    p_document,
    p_expires_at,
    nullif(btrim(coalesce(p_submitter_name, '')), ''),
    nullif(btrim(coalesce(p_submitter_email, '')), '')
  )
  returning * into v_row;

  return query select v_row.id, v_row.expires_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- proposal_preview — what the LINK may say about itself.
--
-- ⚠ NEVER the document, and never the submitter's email. The name is here
-- because the person opening the link is the person it was sent to, and "a
-- proposal from Jane Rogers" is what makes the page make sense; the address is
-- not, for the same reason `share_link_preview` returns a boolean rather than
-- `locked_email` (0013's own warning).
--
-- ⚠ ONE answer for "no such proposal" and "expired": `found = false`, no
-- reason. A caller probing tokens learns only whether a live one exists.
-- An ADOPTED proposal is still previewable — that is the sender checking what
-- happened to their design, which is the whole reason this function exists.
-- ---------------------------------------------------------------------------
create or replace function public.proposal_preview(p_token_hash text)
returns table (
  found boolean,
  submitter_name text,
  created_at timestamptz,
  expires_at timestamptz,
  adopted boolean,
  adopted_at timestamptz,
  adopted_by_company_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.proposals;
begin
  select * into v_row from public.proposals p where p.token_hash = btrim(p_token_hash);

  if not found or v_row.expires_at <= now() then
    return query select false, null::text, null::timestamptz, null::timestamptz, false, null::timestamptz, null::text;
    return;
  end if;

  return query
    select true,
           v_row.submitter_name,
           v_row.created_at,
           v_row.expires_at,
           v_row.adopted_at is not null,
           v_row.adopted_at,
           (select c.name from public.companies c where c.id = v_row.adopted_by_company);
end;
$$;

-- ---------------------------------------------------------------------------
-- proposal_document — the design, for somebody deciding whether to adopt it.
--
-- `authenticated` only. See this file's own header for why this is a sign-in
-- and not a grant: there is nobody to grant to until it is adopted.
-- ---------------------------------------------------------------------------
create or replace function public.proposal_document(p_token_hash text)
returns table (
  found boolean,
  document jsonb,
  submitter_name text,
  created_at timestamptz,
  adopted boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.proposals;
begin
  -- ⚠ The grant below is the gate, but a SECURITY DEFINER function states its
  -- own precondition rather than resting on it: a later `grant execute ... to
  -- anon` added by somebody wiring up a page would otherwise open the document
  -- silently.
  if auth.uid() is null then
    raise exception 'Sign in to read a proposal.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_row from public.proposals p where p.token_hash = btrim(p_token_hash);

  if not found or v_row.expires_at <= now() then
    return query select false, null::jsonb, null::text, null::timestamptz, false;
    return;
  end if;

  return query select true, v_row.document, v_row.submitter_name, v_row.created_at, v_row.adopted_at is not null;
end;
$$;

-- ---------------------------------------------------------------------------
-- adopt_proposal — the proposal becomes a real project.
--
-- ⚠ It creates the project by the SAME PATH `create_project` uses — an insert
-- into `projects` followed by one into `project_versions` — rather than calling
-- `create_project`, and that is forced rather than chosen: `create_project` is
-- SECURITY INVOKER and leans on RLS, which cannot see this table. Inlining it
-- means the two could drift, so the shape is kept identical and this comment is
-- the pin. What it must keep: `created_by = auth.uid()`, a v1 with no parent,
-- and letting the version triggers set the name, the number and the timestamps.
--
-- ⚠ It lands in the **`proposals` folder**, which already exists in the
-- `projects.folder` check constraint and in the app's own folder tabs. Reused,
-- not invented: an adopted design arriving in `current` would be indistinguish-
-- able from one the company drew itself.
--
-- ⚠ ADOPTION IS ONCE. The second caller gets a refusal naming the company that
-- got there first, not a second project. Enforced by re-reading the row FOR
-- UPDATE inside the transaction, so two people pressing Adopt at the same
-- moment cannot both win.
-- ---------------------------------------------------------------------------
create or replace function public.adopt_proposal(p_token_hash text, p_company_id uuid)
returns table (project_id uuid, version_id uuid, version_number integer)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_row public.proposals;
  v_project_id uuid := gen_random_uuid();
  v_version public.project_versions;
  v_adopter_name text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to adopt a proposal.' using errcode = 'insufficient_privilege';
  end if;

  -- ⚠ Membership is checked HERE because this function is SECURITY DEFINER and
  -- RLS is therefore not doing it. `is_member_of` is 0002's own single
  -- expression of the question; a restated `exists (select ... memberships)`
  -- would be a second one.
  if not public.is_member_of(p_company_id) then
    raise exception 'You are not a member of that company.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_row from public.proposals p where p.token_hash = btrim(p_token_hash) for update;

  if not found or v_row.expires_at <= now() then
    raise exception 'That proposal link is not live.' using errcode = 'no_data_found';
  end if;

  if v_row.adopted_at is not null then
    raise exception 'That proposal was already adopted by %.',
      coalesce((select c.name from public.companies c where c.id = v_row.adopted_by_company), 'another company')
      using errcode = 'unique_violation';
  end if;

  insert into public.projects (id, company_id, folder, created_by)
  values (v_project_id, p_company_id, 'proposals', auth.uid());

  insert into public.project_versions (project_id, parent_version_id, label, document)
  values (
    v_project_id,
    null,
    -- ⚠ The v1 label SAYS WHERE IT CAME FROM, and it is the only durable record
    -- on the project side: the proposals row can expire and be swept, and then
    -- nothing on the project would say it was somebody else's design.
    case
      when v_row.submitter_name is null then 'Adopted from a proposal'
      else 'Adopted from a proposal by ' || v_row.submitter_name
    end,
    v_row.document
  )
  returning * into v_version;

  update public.proposals
     set adopted_at = now(),
         adopted_by_company = p_company_id,
         adopted_project_id = v_project_id
   where id = v_row.id;

  return query select v_project_id, v_version.id, v_version.version_number;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges. Start from nothing and grant exactly, as 0006, 0008, 0011 and
-- 0013 do: Supabase's defaults are broad on new functions.
--
-- ⚠ `service_role` gets nothing anywhere here. Every one of these is called on
-- the request's own client; keeping the service key off them means a stolen
-- one buys no reach into proposals.
-- ---------------------------------------------------------------------------
revoke all on function public.submit_proposal(text, jsonb, timestamptz, text, text) from public;
revoke all on function public.submit_proposal(text, jsonb, timestamptz, text, text) from service_role;
grant execute on function public.submit_proposal(text, jsonb, timestamptz, text, text) to anon;
grant execute on function public.submit_proposal(text, jsonb, timestamptz, text, text) to authenticated;

revoke all on function public.proposal_preview(text) from public;
revoke all on function public.proposal_preview(text) from service_role;
grant execute on function public.proposal_preview(text) to anon;
grant execute on function public.proposal_preview(text) to authenticated;

-- ⚠ NOT to `anon`. This one returns the building.
revoke all on function public.proposal_document(text) from public;
revoke all on function public.proposal_document(text) from service_role;
revoke all on function public.proposal_document(text) from anon;
grant execute on function public.proposal_document(text) to authenticated;

revoke all on function public.adopt_proposal(text, uuid) from public;
revoke all on function public.adopt_proposal(text, uuid) from service_role;
revoke all on function public.adopt_proposal(text, uuid) from anon;
grant execute on function public.adopt_proposal(text, uuid) to authenticated;

-- The document trigger runs as the table owner; nobody calls it directly.
revoke all on function public.refuse_unusable_proposal() from public;
revoke all on function public.refuse_unusable_proposal() from anon;
revoke all on function public.refuse_unusable_proposal() from authenticated;

commit;
