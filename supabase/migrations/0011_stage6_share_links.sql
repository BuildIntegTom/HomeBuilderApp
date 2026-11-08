-- Stage 6 — share a design by link (UI queue item U8, stride 1).
--
-- Spec: docs/pbm-ui-queue-2026-11-05.md, "U8 — Share a design by link", and
-- the three answers Tommy gave on 2026-11-07 when asked what a shared link
-- should be:
--
--   1. WHAT IT SHOWS      "Everything, as you see it" — full fidelity. There
--                         is therefore NO new redaction here and no second,
--                         thinner view of a project. A claimed link produces
--                         an ORDINARY GRANT, the same row
--                         share_project_with_person writes, so a link-holder
--                         sees exactly what a person you shared with sees.
--                         Stage 4's browse redactor is untouched and is not
--                         in this path.
--   2. ACCOUNT            "Sign-in required." claim_share_link is callable by
--                         `authenticated` only. The landing page a visitor
--                         sees before signing in comes from
--                         share_link_preview, which is callable by `anon` and
--                         discloses a name and a sharer, never a document.
--   3. OWNERSHIP          ⚠ SUPERSEDED BY TOMMY ON 2026-11-08, AND THE NEW
--                         ANSWER NEEDS NO MIGRATION AT ALL. His answer on
--                         2026-11-07 was "ownership transfers", which
--                         `guard_project_columns` (0006) forbids by raising
--                         'a project cannot be moved to another company'.
--                         A day later he described the flow that makes the
--                         transfer unnecessary: a proposal is SUBMITTED to a
--                         company, so the project is created OWNED BY THAT
--                         COMPANY from its first row and no company_id ever
--                         changes. The guard stands untouched, and section 8
--                         of stage6_rls.test.sql asserts that it does.
--                         What his new flow asks for instead is the thing
--                         below: "no need for the client to be able to make
--                         changes after the hand off."
--
-- And the trade Tommy accepted on 2026-11-08, after being shown the
-- consequence of combining answers 1 and 2:
--
--   ⚠ A LINK IS CLAIMABLE BY ANYONE WHO SIGNS IN. For a link to be a SHARE it
--     has to MINT a grant when claimed; a link that only works for people who
--     already hold a grant is not sharing anything. So the sign-in records
--     WHO came in — it does not gate WHETHER they can. A forwarded link hands
--     a stranger the full design and its prices, with their name attached.
--     That was stated plainly and accepted, in exchange for:
--       * every claim is visible on the project's access list and revocable
--         there, so forwarding is VISIBLE rather than silent;
--       * `locked_email`, which makes a link claimable by one address only,
--         for when a real gate is wanted. Free, because `invites` already
--         works exactly that way.
--
-- ⚠ READ-ONLY GRANTS, added 2026-11-08 and the reason this file grew.
--
--   > *"no need for the client to be able to make changes after the hand off.
--   > once a company accepts a proposal ... then the client needs to make an
--   > account to continue to see it ... but still allow really cool in depth
--   > live updates to the structure they are buying."* — Tommy
--
-- Until now a grant was read AND write, with no way to express anything else
-- (0008 answer 4: "one access level, costs included"). A link that handed the
-- buyer of a building the ability to edit it would be exactly wrong, so
-- `collaborators` gains `can_write` and `share_links` gains `grants_write`.
--
--   * `collaborators.can_write` DEFAULTS TO TRUE, so every grant that exists
--     today, and every grant share_project_with_person /
--     share_project_with_company / decide_collab_request writes tomorrow,
--     means exactly what it meant before. This migration changes the meaning
--     of NO existing row. 0008 answer 4 still describes those three paths.
--   * `share_links.grants_write` DEFAULTS TO FALSE. A claimed link is VIEW
--     ONLY unless the person minting it says otherwise, because the common
--     case for a link is the one he described: a client watching a building
--     they are buying.
--   * The enforcement is `holds_project_write_grant`, and it is applied in
--     the TWO places that actually gate a write — can_write_project and the
--     projects_update policy. It is deliberately NOT applied to
--     can_read_project, holds_project_grant or projects_select: a view-only
--     collaborator sees everything, which is the whole point of "really cool
--     in depth live updates".
--
-- SAFE ON THE LIVE DATABASE, BY CONSTRUCTION:
--   * One transaction: a failure part-way applies nothing.
--   * Re-runnable: `create table if not exists`, `add column if not exists`,
--     `create index if not exists`, `create or replace function`, and
--     `drop … if exists` before every trigger, policy and check constraint. A
--     second run changes nothing.
--   * NO Stage 1, 2, 4 or 5 object is altered. It calls Stage 1 helpers
--     (is_member_of, is_platform_admin, meets_required_aal) and Stage 3
--     helpers (can_read_project, can_write_project) without redefining any of
--     them.
--   * EXACTLY FOUR earlier objects are changed, each because it has to be:
--       constraint  collaborators_kind_check   — widened to admit 'link'
--       function    list_shared_projects(uuid) — so a claimed project reads as
--                   "via a link" in Shared with us rather than as a person
--                   share, which is what it would say if left alone.
--       function    can_write_project(uuid)    — so a view-only grant cannot
--                   write. Its signature and privileges are unchanged, and
--                   `create or replace` preserves both.
--       policy      projects_update            — the same reason, and it has
--                   to be separate: that policy keys off holds_project_grant
--                   DIRECTLY, not off can_write_project, so replacing only
--                   the function would leave a view-only collaborator able to
--                   rename a project and move it between folders.
--     `collaborators` gains TWO columns (one nullable, one defaulted true) and
--     `share_links` is new. Every other 0006/0008 object — the other
--     constraints, the indexes, the triggers, the other policies, the other
--     functions, the rows — is untouched.
--   * can_read_project, holds_project_grant and projects_select are NOT
--     redefined, deliberately. A claim grants READ the way every other grant
--     does: by existing as a collaborators row that holds_project_grant
--     already finds. A view-only grant is view-only, not half-blind.
--
-- Run it AFTER 0010, in the Supabase SQL editor, exactly as 0006–0010 were.
--
-- WHAT A SHARE LINK IS, AND WHAT IT IS NOT:
--   * A row in `share_links`. Holding its raw token lets you (a) see a name
--     and a sharer before signing in, and (b) once signed in, mint ONE
--     ordinary grant on ONE project.
--   * The raw token is in the link and NOWHERE ELSE. Only its SHA-256 is
--     stored, exactly as `invites` does it, so a database read — or a dump, or
--     a company admin browsing the table — cannot mint a usable link.
--   * A CLAIM IS NOT A SECOND KIND OF ACCESS. It is a `collaborators` row with
--     kind = 'link'. It is removed by the policy that already removes grants
--     (collaborators_delete), it reaches can_read_project through
--     holds_project_grant, and it appears on the access list the project
--     already has. Nothing downstream of a grant had to learn a new concept.
--   * THE LIST OF CLAIMS IS LIVE ACCESS, NOT AN AUDIT LOG. Revoke a claim and
--     it leaves the list, because the list answers "who can open this now".
--     There is deliberately no claim history table: an append-only record of
--     who once had access is a different feature and nobody asked for it.
--   * ⚠ A GRANT IS READ AND WRITE (0008 answer 4: can_read_project and
--     can_write_project are identical). So a person you shared with can MAKE
--     A LINK of their own, because creating one needs can_write_project. That
--     is not new reach — they could already share the project onward to a
--     person or a company — but it is now reach they can hand out in a URL,
--     and the access list is where it shows up. A read-only grant is the fix
--     and it is its own stride.
--   * STILL NO BROWSING, and no new unauthenticated read of any document.
--     share_link_preview returns four strings, a boolean and a timestamp.
--     There is no function here that returns a project document to `anon`.
--
-- 0008's LIST OF DEFINER FUNCTIONS THAT BYPASS THE RESTRICTIVE aal POLICIES,
-- brought up to date. Every definer function that writes rows its caller could
-- not write, or reads rows its caller could not read, is outside those
-- policies by construction, and each checks aal itself where a signed-in
-- caller is required:
--   0003  redeem_invite                     writes a membership
--   0005  create_company_with_first_admin   writes a company and an invite
--   0008  share_project_with_person         writes a grant       — checks aal
--   0008  share_project_with_company        writes a grant       — checks aal
--   0008  dismiss_share_notices             writes notice state  — checks aal
--   0008  project_owner_company_id / _name  read past RLS        — check aal
--   0008  grant_creator_access (trigger)    writes a creator grant
--   0009  shareable_companies               reads company names  — checks aal
--   0009  request_project_access            writes a request     — checks aal
--   0009  decide_collab_request             writes a grant       — checks aal
--   0011  create_share_link                 writes a link        — checks aal
--   0011  revoke_share_link                 revokes a link       — checks aal
--   0011  claim_share_link                  writes a grant       — checks aal
--   0011  share_link_preview                reads past RLS for ANON — holds no
--         aal check and must not: it is the one function here a visitor with
--         no session calls, and it is gated on possession of the token.

begin;

-- ---------------------------------------------------------------------------
-- share_links — one link, one project.
-- ---------------------------------------------------------------------------
create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  -- Reachable only through a platform admin deleting the whole project, same
  -- as collaborators.
  project_id uuid not null references public.projects (id) on delete cascade,
  -- Only the SHA-256 of the token is stored. The raw token exists in the
  -- shared URL and nowhere else, so a database read cannot mint a usable
  -- link. Identical treatment to invites.token_hash, and deliberately the
  -- same algorithm so there is one answer to "how is a link token hashed".
  token_hash text not null unique,
  -- Who made it. A PLAIN uuid with NO foreign key, decided exactly as
  -- collaborators.granted_by was: an `on delete set null` would rewrite the
  -- record of who shared what when an account is deleted, and the grants this
  -- link mints carry this value into collaborators.granted_by, which
  -- collaborators_delete keys removal rights off. A dangling uuid grants
  -- nothing: nobody holds a deleted account's auth.uid().
  created_by uuid not null,
  -- Snapshot of the sharer's name at the time, by prepare_project_version's
  -- rule (display name, then profile email, then auth email). Required
  -- because user_profiles_select hides a sharer from another company, and the
  -- person claiming the link is, by definition, usually from another company.
  created_by_name text not null,
  created_at timestamptz not null default now(),
  -- ⚠ PROVISIONAL WINDOW, decided in the app, not here. The database only
  -- insists that a link has an expiry and that it is in the future when
  -- written; SHARE_LINK_EXPIRY_DAYS in the app picks the number, and that
  -- number is flagged for Tommy. "Null means never" was considered and
  -- rejected: it puts a branch in every read for a case nobody asked for, and
  -- a fresh link is one click away.
  expires_at timestamptz not null,
  -- Revoked, not deleted. The owner keeps a row saying the link existed and is
  -- off, which reads better in a list than a link that silently vanished —
  -- and it means via_link_id on a claimed grant never dangles.
  revoked_at timestamptz,
  revoked_by uuid,
  -- ⚠ The optional real gate. Null: anyone who signs in may claim it, which
  -- is the default and what Tommy's "send it to anyone" asks for. Set: only
  -- an account whose email matches may claim, which is exactly how
  -- redeem_invite treats invites.email ("an invite is addressed to a person,
  -- not transferable to whoever opens it").
  locked_email text,
  -- ⚠ FALSE BY DEFAULT: a claimed link is VIEW ONLY. His 2026-11-08 rule —
  -- "no need for the client to be able to make changes after the hand off" —
  -- and the common case for a link is the client watching a building they are
  -- buying. A link that grants write is a deliberate act by whoever mints it,
  -- so the default here is the safe answer rather than the convenient one.
  grants_write boolean not null default false,
  constraint share_links_expires_after_creation check (expires_at > created_at),
  -- Revoked is revoked by somebody: the pair moves together or not at all.
  constraint share_links_revoked_together
    check ((revoked_at is null) = (revoked_by is null))
);

create index if not exists share_links_project_idx on public.share_links (project_id);
create index if not exists share_links_created_by_idx on public.share_links (created_by);

-- Same normalisation as invites.email, and for the same reason: the comparison
-- at claim time is on a lowercased, trimmed address, so the stored value is
-- too. Null stays null — an unlocked link is not an empty address.
create or replace function public.normalize_share_link_email()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.locked_email := nullif(lower(btrim(coalesce(new.locked_email, ''))), '');
  return new;
end;
$$;

drop trigger if exists share_links_normalize_email on public.share_links;
create trigger share_links_normalize_email
  before insert or update of locked_email on public.share_links
  for each row execute function public.normalize_share_link_email();

-- ---------------------------------------------------------------------------
-- collaborators — one widened constraint and two new columns.
--
-- A claim is an ordinary grant that SAYS HOW IT WAS MADE. Without 'link' the
-- access list would show a claim as a person share, which is a lie about how
-- somebody got in — and `pending_share_notices` would then tell the claimant
-- their own claim as news, because that function filters kind = 'shared'. The
-- new kind makes both correct without either being edited.
-- ---------------------------------------------------------------------------

-- The other three constraints on this table are UNTOUCHED and still hold for
-- a 'link' grant: exactly one grantee (a person), granted_by not null (the
-- link's creator), granted_by_name not null (the link's snapshot).
alter table public.collaborators drop constraint if exists collaborators_kind_check;
alter table public.collaborators
  add constraint collaborators_kind_check check (kind in ('shared', 'creator', 'link'));

-- ⚠ `on delete set null`, NOT cascade. Deleting a link row must never silently
-- revoke access somebody already claimed — revoking a LINK and revoking a
-- CLAIM are two separate acts, and the app only ever does the former by
-- setting revoked_at. (Nothing in the app deletes a share_links row at all; a
-- project delete cascades both rows away together.) A null-out by an FK action
-- is an UPDATE on a table with no update policy, which is fine: FK actions run
-- as the system and bypass RLS, and there is no update TRIGGER on
-- collaborators to refuse it.
alter table public.collaborators
  add column if not exists via_link_id uuid references public.share_links (id) on delete set null;

create index if not exists collaborators_via_link_idx
  on public.collaborators (via_link_id) where via_link_id is not null;

-- One direction only. A 'link' grant whose link was deleted has a null here,
-- so "kind = 'link' implies via_link_id is not null" would be false after such
-- a delete; the useful invariant is the other way round.
alter table public.collaborators drop constraint if exists collaborators_via_link_only_for_link;
alter table public.collaborators
  add constraint collaborators_via_link_only_for_link
  check (via_link_id is null or kind = 'link');

-- ⚠ `default true`, and that default is the whole safety of this change.
-- Every grant that exists on the live database right now becomes
-- `can_write = true` — which is what it already meant — and the three
-- functions that write grants (share_project_with_person,
-- share_project_with_company, decide_collab_request) are not edited, so they
-- keep writing read-and-write grants by taking the default. Nothing that
-- works today changes behaviour. The ONLY writer that sets this false is
-- claim_share_link, from the link's own grants_write.
--
-- NOT NULL, so there is no third state. "Unknown whether this person may
-- write" is not a thing an access check should ever have to interpret.
alter table public.collaborators
  add column if not exists can_write boolean not null default true;

-- ---------------------------------------------------------------------------
-- Helpers.
-- ---------------------------------------------------------------------------

-- Does a grant on this project reach the caller AND let them write?
--
-- The read-side twin, holds_project_grant, is NOT redefined: a view-only
-- collaborator reads everything. This is the write half, and it is a separate
-- function rather than a parameter so that every call site reads as either a
-- read check or a write check at a glance.
create or replace function public.holds_project_write_grant(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.collaborators c
    where c.project_id = p_project
      and c.can_write
      and (
        c.grantee_user_id = auth.uid()
        or (c.grantee_company_id is not null and public.is_member_of(c.grantee_company_id))
      )
  );
$$;

-- REPLACED (0006, then 0008). Same signature, same privileges — `create or
-- replace` preserves them — and the same two owner-side branches. The only
-- change is the third: holds_project_grant becomes
-- holds_project_write_grant, so a view-only grant no longer answers true
-- here.
--
-- ⚠ This is the function BOTH halves of the version-save path go through:
-- 0006's project_versions_insert policy (`with check
-- can_write_project(project_id)`) and 0006's own trigger (`if not
-- can_write_project(new.project_id)`). Neither is edited, and both tighten
-- correctly because of this one replacement. It is also what gates
-- share_project_with_person, share_project_with_company, create_share_link
-- and revoke_share_link — so a view-only collaborator cannot share the
-- project onward, by link or otherwise, which is the point.
--
-- It is NO LONGER identical to can_read_project. 0008's note that the two are
-- "IDENTICAL ... and deliberately defined separately" was true for Stage 3
-- and stops being true here; the separation it kept is what made this a
-- one-function change.
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
  or public.holds_project_write_grant(p_project);
$$;

-- Is this link good right now? One expression, so the preview, the claim and
-- the owner's list cannot disagree about what "live" means. STABLE rather than
-- immutable: it reads now().
create or replace function public.share_link_is_live(p_link public.share_links)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_link.revoked_at is null and p_link.expires_at > now();
$$;

-- ---------------------------------------------------------------------------
-- create_share_link — mints a link. SECURITY DEFINER: authenticated holds no
-- insert on share_links.
--
-- The TOKEN NEVER REACHES THE DATABASE. The app generates 32 random bytes,
-- hashes them, and passes the hash — the same split as invites, for the same
-- reason. This function cannot tell you what the link says.
--
-- can_write_project, which equals can_read_project (0008 answer 4), so a
-- collaborator may make one. See the header note about that.
-- ---------------------------------------------------------------------------
-- ⚠ `p_grants_write` defaults to FALSE, so a caller that does not mention it
-- mints a VIEW-ONLY link. The app passes it explicitly either way; the default
-- is here so that a future caller which forgets cannot accidentally hand out
-- edit rights to a building somebody is buying.
create or replace function public.create_share_link(
  p_project uuid,
  p_token_hash text,
  p_expires_at timestamptz,
  p_locked_email text default null,
  p_grants_write boolean default false
)
returns table (link_id uuid, expires_at timestamptz, locked_email text, grants_write boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_name text;
  v_link uuid;
begin
  if auth.uid() is null or not public.meets_required_aal() then
    raise exception 'project not found, or you cannot share it' using errcode = '42501';
  end if;
  if not public.can_write_project(p_project) then
    raise exception 'project not found, or you cannot share it' using errcode = '42501';
  end if;
  if p_token_hash is null or btrim(p_token_hash) = '' then
    raise exception 'a token hash is required' using errcode = '22023';
  end if;
  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'a share link must expire in the future' using errcode = '22023';
  end if;

  -- The name snapshot, by prepare_project_version's rule. Refused rather than
  -- guessed, exactly as share_project_with_person refuses: a link nobody can
  -- be attributed to is worse than no link.
  select coalesce(nullif(btrim(up.display_name), ''), up.email, u.email)
    into v_name
    from auth.users u left join public.user_profiles up on up.id = u.id
   where u.id = auth.uid();
  if v_name is null then
    raise exception 'cannot attribute this link: your account has no name or email'
      using errcode = '23514';
  end if;

  insert into public.share_links
    (project_id, token_hash, created_by, created_by_name, expires_at, locked_email, grants_write)
  values
    (p_project, btrim(p_token_hash), auth.uid(), v_name, p_expires_at, p_locked_email,
     coalesce(p_grants_write, false))
  returning id into v_link;

  return query
    select s.id, s.expires_at, s.locked_email, s.grants_write
      from public.share_links s where s.id = v_link;
end;
$$;

-- ---------------------------------------------------------------------------
-- share_link_preview — what the landing page needs in order to render, for a
-- visitor who is not signed in.
--
-- ⚠ CALLABLE BY `anon`, like invite_preview, and for the same reason: that is
-- exactly who follows a shared link. It discloses nothing to anyone who does
-- not already hold the token, and what it discloses to somebody who does is
-- the minimum that makes "sign in to see this" a reasonable thing to ask:
-- WHAT the design is called, WHO shared it, and WHICH company owns it.
--
-- It returns NO document, NO version, NO panel, NO price, and NO project id —
-- an id would let the holder of a dead link go on to ask other endpoints about
-- the project, and the claim below takes the token, not an id.
--
-- `locked_to_email` is a BOOLEAN, never the address. Telling an
-- unauthenticated caller which address may claim a link would turn a leaked
-- link into a leaked email address as well.
-- ---------------------------------------------------------------------------
create or replace function public.share_link_preview(p_token_hash text)
returns table (
  valid boolean,
  reason text,
  project_name text,
  owner_company_name text,
  shared_by_name text,
  locked_to_email boolean,
  -- Whether claiming this will let you change the design. Told to the visitor
  -- BEFORE they sign in, because it is a fact about their own access and
  -- "view only" is the honest label for what they are being offered.
  grants_write boolean,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_link public.share_links;
  v_project public.projects;
  v_owner text;
begin
  select * into v_link from public.share_links s where s.token_hash = p_token_hash;

  if not found then
    return query select false, 'not_found', null::text, null::text, null::text,
                        null::boolean, null::boolean, null::timestamptz;
    return;
  end if;

  select * into v_project from public.projects p where p.id = v_link.project_id;
  select co.name into v_owner from public.companies co where co.id = v_project.company_id;

  if v_link.revoked_at is not null then
    return query select false, 'revoked', v_project.name, v_owner, v_link.created_by_name,
                        v_link.locked_email is not null, v_link.grants_write, v_link.expires_at;
    return;
  end if;

  if v_link.expires_at <= now() then
    return query select false, 'expired', v_project.name, v_owner, v_link.created_by_name,
                        v_link.locked_email is not null, v_link.grants_write, v_link.expires_at;
    return;
  end if;

  return query select true, null::text, v_project.name, v_owner, v_link.created_by_name,
                      v_link.locked_email is not null, v_link.grants_write, v_link.expires_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- claim_share_link — the one operation that turns a URL into access.
--
-- Runs as the signed-in user, so auth.uid() is the real identity and the
-- caller cannot claim to be someone else: there is deliberately NO user-id
-- parameter, exactly as redeem_invite has none.
--
-- REFUSALS RAISE; OUTCOMES RETURN A STATUS. That split is deliberate and
-- follows both precedents in this schema. The preview above has already told
-- the visitor whether the link is good, so a refusal at claim time is a RACE
-- (revoked or expired in the seconds between) and belongs in an exception, as
-- redeem_invite's do. Whereas "you already had access" is an ANSWER, not a
-- failure — the right thing to do with it is open the project — so it comes
-- back as a status with the project id, in the shape share_project_with_person
-- established.
--
--   claimed             a new grant was written
--   already-claimed     a personal grant to you already existed
--   already-has-access  you are a member of the owning company, a platform
--                       admin, or a company grant already reaches you.
--                       Nothing was written, and deliberately not: a redundant
--                       personal grant would outlive the membership that made
--                       it unnecessary, which is the same trap
--                       `already-member` avoids in share_project_with_person
--                       (decision 6).
--
-- `for update` makes the second of two simultaneous claims of one link wait,
-- and the on-conflict below makes it write nothing and read back the grant the
-- first one wrote — the same handling share_project_with_person documents.
-- ---------------------------------------------------------------------------
create or replace function public.claim_share_link(p_token_hash text)
returns table (status text, project_id uuid, grant_id uuid, can_write boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_link public.share_links;
  v_email text;
  v_name text;
  v_owner uuid;
  v_grant uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.meets_required_aal() then
    raise exception 'two-factor authentication is required' using errcode = '42501';
  end if;

  select * into v_link from public.share_links s
   where s.token_hash = p_token_hash
   for update;

  if not found then
    raise exception 'that share link is not valid' using errcode = '22023';
  end if;
  if v_link.revoked_at is not null then
    raise exception 'that share link has been turned off' using errcode = '22023';
  end if;
  if v_link.expires_at <= now() then
    raise exception 'that share link has expired' using errcode = '22023';
  end if;

  if v_link.locked_email is not null then
    select u.email into v_email from auth.users u where u.id = auth.uid();
    if lower(btrim(coalesce(v_email, ''))) <> v_link.locked_email then
      -- A locked link is addressed to a person, not transferable to whoever
      -- opens it. Same shape and errcode as redeem_invite's refusal.
      raise exception 'that share link was issued to a different email address'
        using errcode = '42501';
    end if;
  end if;

  -- Already in, by a route that is not a personal grant.
  select p.company_id into v_owner from public.projects p where p.id = v_link.project_id;
  if public.is_member_of(v_owner) or public.is_platform_admin() then
    return query select 'already-has-access'::text, v_link.project_id, null::uuid,
                        public.can_write_project(v_link.project_id);
    return;
  end if;

  select c.id into v_grant from public.collaborators c
   where c.project_id = v_link.project_id and c.grantee_user_id = auth.uid();
  if found then
    -- ⚠ The grant he ALREADY holds, not what this link would have given him.
    -- A view-only client who is later sent a writing link does not quietly
    -- gain write, and a writing collaborator sent a view-only link does not
    -- quietly lose it. Changing somebody's access level is a removal and a
    -- re-grant, which is 0008's own rule for grants ("Changing a grant means
    -- removing it and sharing again").
    return query select 'already-claimed'::text, v_link.project_id, v_grant,
                        (select c.can_write from public.collaborators c where c.id = v_grant);
    return;
  end if;

  if exists (
    select 1 from public.collaborators c
     where c.project_id = v_link.project_id
       and c.grantee_company_id is not null
       and public.is_member_of(c.grantee_company_id)
  ) then
    return query select 'already-has-access'::text, v_link.project_id, null::uuid,
                        public.can_write_project(v_link.project_id);
    return;
  end if;

  select coalesce(nullif(btrim(up.display_name), ''), up.email, u.email)
    into v_name
    from auth.users u left join public.user_profiles up on up.id = u.id
   where u.id = auth.uid();
  if v_name is null then
    raise exception 'cannot attribute this claim: your account has no name or email'
      using errcode = '23514';
  end if;

  -- ⚠ granted_by is the LINK'S CREATOR, not the claimer. Three consequences,
  -- all wanted: the access list reads "shared by <them>, via a link" rather
  -- than "this person granted themselves access"; collaborators_delete lets
  -- the sharer remove the claim, because its third branch is
  -- `granted_by = auth.uid()`; and the owner company can remove it anyway
  -- through the first branch.
  insert into public.collaborators
    (project_id, grantee_user_id, kind, granted_by, granted_by_name, grantee_name,
     via_link_id, can_write, created_at)
  values
    (v_link.project_id, auth.uid(), 'link', v_link.created_by, v_link.created_by_name,
     v_name, v_link.id, v_link.grants_write, now())
  on conflict (project_id, grantee_user_id) where grantee_user_id is not null do nothing
  returning id into v_grant;

  if v_grant is not null then
    return query select 'claimed'::text, v_link.project_id, v_grant, v_link.grants_write;
    return;
  end if;

  -- Lost a race to an identical claim that committed first.
  select c.id into v_grant from public.collaborators c
   where c.project_id = v_link.project_id and c.grantee_user_id = auth.uid();
  return query select 'already-claimed'::text, v_link.project_id, v_grant,
                      (select c.can_write from public.collaborators c where c.id = v_grant);
end;
$$;

-- ---------------------------------------------------------------------------
-- revoke_share_link — switches a link off. Idempotent: revoking an already
-- revoked link reports the original revocation rather than failing, because
-- the caller's intent ("this link should not work") is already satisfied.
--
-- Deliberately a function rather than an RLS update policy. share_links is
-- otherwise insert-by-function only, and an update policy would have to allow
-- an update to `revoked_at` while forbidding one to `expires_at`,
-- `token_hash` and `locked_email` — which is a column guard, i.e. the thing
-- guard_project_columns had to be written for. One function is smaller and
-- cannot be partially right.
-- ---------------------------------------------------------------------------
create or replace function public.revoke_share_link(p_link uuid)
returns table (link_id uuid, revoked_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_link public.share_links;
  v_revoked timestamptz;
begin
  if auth.uid() is null or not public.meets_required_aal() then
    raise exception 'that link does not exist, or you cannot change it' using errcode = '42501';
  end if;

  select * into v_link from public.share_links s where s.id = p_link for update;
  if not found or not public.can_write_project(v_link.project_id) then
    -- One answer for "no such link" and "not yours", so a link id cannot be
    -- probed. Same shape as 0008's single 42501 for sharing.
    raise exception 'that link does not exist, or you cannot change it' using errcode = '42501';
  end if;

  v_revoked := v_link.revoked_at;
  if v_revoked is null then
    update public.share_links s
       set revoked_at = now(), revoked_by = auth.uid()
     where s.id = v_link.id
     returning s.revoked_at into v_revoked;
  end if;

  return query select v_link.id, v_revoked;
end;
$$;

-- ---------------------------------------------------------------------------
-- project_share_links — the owner's list: every link on one project, and who
-- has come in through each.
--
-- SECURITY INVOKER, so share_links_select below is the gate and this function
-- exists for one round trip rather than for privilege.
--
-- ⚠ `token_hash` IS NOT SELECTED and no column here can reconstruct a URL.
-- Once a link is minted, the app can show its URL again only from what the
-- browser kept; a link whose URL is lost is revoked and replaced, not
-- recovered. That is the whole point of storing a hash.
--
-- `claims` is LIVE ACCESS, not history: a revoked claim leaves this list,
-- because the question the list answers is "who can open this now".
-- ---------------------------------------------------------------------------
create or replace function public.project_share_links(p_project uuid)
returns table (
  link_id uuid,
  created_by_name text,
  created_by_you boolean,
  created_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  locked_email text,
  grants_write boolean,
  is_live boolean,
  claims jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  select s.id,
         s.created_by_name,
         s.created_by = auth.uid(),
         s.created_at,
         s.expires_at,
         s.revoked_at,
         s.locked_email,
         s.grants_write,
         public.share_link_is_live(s),
         coalesce(
           (select jsonb_agg(
                     jsonb_build_object(
                       'grant_id', c.id,
                       'grantee_name', c.grantee_name,
                       'can_write', c.can_write,
                       'claimed_at', c.created_at)
                     order by c.created_at, c.id)
              from public.collaborators c
             where c.via_link_id = s.id),
           '[]'::jsonb)
    from public.share_links s
   where s.project_id = p_project
   order by s.created_at desc, s.id;
$$;

-- ---------------------------------------------------------------------------
-- list_shared_projects — REPLACED, for one reason: the `via` case.
--
-- Everything else about this function is 0008's, unchanged and deliberately
-- re-stated here in full rather than patched, because `create or replace`
-- cannot do less. The only edit is the `case` that builds `via`: a kind =
-- 'link' grant previously fell through to 'person', which would have told a
-- claimant their claimed project was shared with them directly.
--
-- 0008's own notes still apply and still matter:
--   * THE GRANT FILTER IS WRITTEN HERE, NOT LEFT TO RLS.
--   * personal grants (shared, creator, or now link) to the caller;
--   * company grants to p_acting_as, only if the caller is a member of it;
--   * minus projects p_acting_as owns when the folder tabs list them.
--   * NEVER selects `document`.
-- ---------------------------------------------------------------------------
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
                                 when r.kind = 'link' then 'link'
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

-- ---------------------------------------------------------------------------
-- Privileges. Supabase's default privileges grant broad rights on new public
-- tables and functions to anon, authenticated AND service_role, so start from
-- nothing and grant exactly. service_role gets nothing, as in 0006 and 0008.
-- ---------------------------------------------------------------------------
revoke all on public.share_links from public, anon, authenticated, service_role;

-- select ONLY, and through share_links_select below. Links are written by
-- create_share_link, switched off by revoke_share_link, and never deleted by
-- a client. ⚠ anon gets NOTHING on this table: a visitor's only reach into it
-- is share_link_preview, which runs as the owner and answers on a token.
grant select on public.share_links to authenticated;

do $grants$
declare
  fn text;
begin
  foreach fn in array array[
    'public.share_link_is_live(public.share_links)',
    'public.holds_project_write_grant(uuid)',
    'public.create_share_link(uuid,text,timestamptz,text,boolean)',
    'public.claim_share_link(text)',
    'public.revoke_share_link(uuid)',
    'public.project_share_links(uuid)'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke all on function %s from anon', fn);
    execute format('revoke all on function %s from service_role', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;

  -- ⚠ The ONE function here an unauthenticated visitor may call. Granted to
  -- anon deliberately and narrowly; see its own comment for what it withholds.
  execute 'revoke all on function public.share_link_preview(text) from public';
  execute 'revoke all on function public.share_link_preview(text) from service_role';
  execute 'grant execute on function public.share_link_preview(text) to anon';
  execute 'grant execute on function public.share_link_preview(text) to authenticated';

  -- The trigger function: no client role calls it. (A trigger's function is
  -- permission-checked when the trigger is created, not when it fires.)
  execute 'revoke all on function public.normalize_share_link_email() from public';
  execute 'revoke all on function public.normalize_share_link_email() from anon';
  execute 'revoke all on function public.normalize_share_link_email() from authenticated';
  execute 'revoke all on function public.normalize_share_link_email() from service_role';
end
$grants$;

-- list_shared_projects and can_write_project keep their earlier privileges:
-- `create or replace` preserves them, and neither signature changed. That is
-- also why can_write_project is replaced rather than dropped and recreated —
-- a drop would take 0006's grants with it and silently break every caller.

-- ---------------------------------------------------------------------------
-- Policies on share_links.
-- ---------------------------------------------------------------------------

-- Everyone who can open the project sees its links, which is the rule 0008
-- already settled for the access list (Open Item 3, accepted: "everyone who
-- can open the project sees its whole access list, including who granted
-- whom"). A link is part of that list, and hiding a link from a collaborator
-- who is allowed to make one would be a surface with no honest story.
drop policy if exists share_links_select on public.share_links;
create policy share_links_select on public.share_links
  for select to authenticated
  using (public.can_read_project(project_id));

-- No insert, update or delete policy, and no such client operations either:
-- create_share_link and revoke_share_link are the only writers, and both are
-- SECURITY DEFINER with their own precondition checks.

-- ---------------------------------------------------------------------------
-- projects_update — REPLACED, and it has to be replaced separately.
--
-- ⚠ THIS POLICY DOES NOT GO THROUGH can_write_project. 0008 wrote it against
-- holds_project_grant DIRECTLY, so tightening the function alone would have
-- left a view-only collaborator able to RENAME a project and MOVE IT BETWEEN
-- FOLDERS — including dragging somebody else's proposal out of their
-- proposals queue. Exactly the kind of gap that reads as covered because the
-- function next to it is.
--
-- The two owner-side branches and the using/with-check pair are 0008's,
-- unchanged. 0008's reason for the policy existing at all still stands and is
-- worth repeating: rename_project runs `select … for update`, and PostgreSQL
-- applies the UPDATE policy to FOR UPDATE, so a writing collaborator needs
-- this policy for a rename to work at all. A view-only one now fails that
-- lock, which is the correct answer to "may I rename this".
--
-- guard_project_columns is UNTOUCHED and still narrows every update to
-- `folder`, and still refuses a company_id change.
-- ---------------------------------------------------------------------------
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update to authenticated
  using (
    public.is_member_of(company_id)
    or public.is_platform_admin()
    or public.holds_project_write_grant(id)
  )
  with check (
    public.is_member_of(company_id)
    or public.is_platform_admin()
    or public.holds_project_write_grant(id)
  );

drop policy if exists share_links_require_aal on public.share_links;
create policy share_links_require_aal on public.share_links
  as restrictive for all to authenticated
  using (public.meets_required_aal())
  with check (public.meets_required_aal());

-- Enabled, NOT forced — same reasoning as 0002, 0006 and 0008: the definer
-- functions above write as the owner, which FORCE would break.
alter table public.share_links enable row level security;

commit;
