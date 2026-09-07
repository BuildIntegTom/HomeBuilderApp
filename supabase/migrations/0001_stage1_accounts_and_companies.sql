-- Stage 1 — Accounts and companies.
--
-- Spec: building_integrity_app_spec.md, "Backend, Accounts & Project Sharing
-- (2026-09-06)" → "Data model". This migration creates ONLY the Stage 1 half of
-- that table list: companies, the user profile row, memberships and invites.
-- `projects`, `project_versions`, `collaborators` and `collab_requests` are
-- Stages 2-3 and are deliberately absent — do not add them here.
--
-- Naming note: the spec's table is called `users`. Supabase Auth already owns
-- `auth.users` (it holds the credential), so the profile row that carries the
-- display name is `public.user_profiles` here. Same row, unambiguous name.

-- gen_random_uuid() is built into Postgres 13+; no extension needed.

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Decision 19 / the data-model note: this column defines the consortium
  -- membership set. It decides whose trees appear when acting as the Seed
  -- Collaborative (Stage 4) and who gets the switcher entry at all (Stage 1).
  -- The false branch is symmetric: a non-member company neither sees nor is
  -- seen. Defaults to FALSE — onboarding a company into the consortium is a
  -- decision Tommy makes, not a side effect of creating a company row.
  is_seed_member boolean not null default false,
  -- The Seed Collaborative is both a company and the consortium (decision 17).
  -- The spec names it but gives no column identifying WHICH company row is the
  -- consortium, and matching on the name string 'The Seed Collaborative' would
  -- break the moment anyone renames it. This flag is that identity, with a
  -- partial unique index below so there can only ever be one.
  is_consortium boolean not null default false,
  -- Per-company colour schemes (spec Open Items → "Per-company colour schemes").
  -- Nullable and unread by any code in Stage 1: the column exists so the data
  -- model does not preclude theming later. NULL = the app's built-in defaults.
  theme jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists companies_name_key
  on public.companies (lower(name));

create unique index if not exists companies_single_consortium
  on public.companies ((is_consortium)) where is_consortium;

-- ---------------------------------------------------------------------------
-- user_profiles — the spec's `users` row. Supabase Auth owns the credential.
-- ---------------------------------------------------------------------------
create table if not exists public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  -- The name that appears on saved versions from Stage 2 on. Decision 6:
  -- attribution is history, not access — a revoked member's name stays.
  display_name text not null default '',
  -- Platform admin (decision 30 / the permission matrix's last row). There is
  -- no self-service path to this flag: a trigger below refuses any change to it
  -- unless the caller is already a platform admin, so the first one must be set
  -- by hand in the Supabase SQL editor. See supabase/README.md.
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Keep the profile row in step with auth.users. Runs as definer because
-- auth.users inserts happen under the auth service's own role.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- The trigger is AFTER INSERT, so it does nothing for accounts that already
-- exist — and a Supabase project may well have some before this migration runs.
-- Without a profile row a person cannot be made a platform admin, cannot have a
-- display name, and every bootstrap statement written against their email is a
-- silent no-op. Backfill once, here, rather than leaving that to be discovered.
insert into public.user_profiles (id, email, display_name)
select u.id, u.email, coalesce(u.raw_user_meta_data ->> 'display_name', '')
from auth.users u
on conflict (id) do nothing;

-- is_platform_admin is not self-service. Also stops a signed-in user from
-- rewriting the email their profile claims (auth.users is the source of truth).
create or replace function public.guard_user_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_platform_admin is distinct from old.is_platform_admin
     and not public.is_privileged_caller() then
    raise exception 'is_platform_admin can only be changed by a platform admin'
      using errcode = '42501';
  end if;
  if new.email is distinct from old.email and not public.is_privileged_caller() then
    raise exception 'email is owned by auth.users' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- memberships — many-to-many, and a real case rather than a latent one
-- (decision 1: one login, several memberships; level is per-membership).
-- ---------------------------------------------------------------------------
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  level text not null default 'member' check (level in ('member', 'admin')),
  -- Drives the default acting-as company at sign-in, and therefore whether the
  -- Seed entry starts selected (spec: "default seed flag status is off unless
  -- your default company is the seed collaborative").
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, company_id)
);

create index if not exists memberships_company_idx on public.memberships (company_id);

-- At most one default per user. The trigger below keeps this satisfiable.
create unique index if not exists memberships_one_default_per_user
  on public.memberships (user_id) where is_default;

-- A person's first membership is their default company ("default is your own
-- company"); marking a new default clears the previous one rather than failing
-- the unique index.
create or replace function public.apply_membership_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and not new.is_default then
    if not exists (
      select 1 from public.memberships m
      where m.user_id = new.user_id and m.id is distinct from new.id
    ) then
      new.is_default := true;
    end if;
  end if;

  if new.is_default then
    update public.memberships m
       set is_default = false
     where m.user_id = new.user_id
       and m.id is distinct from new.id
       and m.is_default;
  end if;

  return new;
end;
$$;

drop trigger if exists memberships_apply_default on public.memberships;
create trigger memberships_apply_default
  before insert or update of is_default on public.memberships
  for each row execute function public.apply_membership_default();

-- When the row that carried is_default goes away, promote another membership so
-- the user still has a default company to be acting as at next sign-in.
create or replace function public.reassign_membership_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_default then
    update public.memberships m
       set is_default = true
     where m.id = (
       select m2.id from public.memberships m2
       where m2.user_id = old.user_id and m2.id <> old.id
       order by m2.created_at
       limit 1
     );
  end if;
  return old;
end;
$$;

drop trigger if exists memberships_reassign_default on public.memberships;
create trigger memberships_reassign_default
  after delete on public.memberships
  for each row execute function public.reassign_membership_default();

-- Which columns of a membership may change, and by whom.
--
-- WHO CAN CHANGE WHAT
--   company_id, user_id  nobody, except a platform admin. Immutable.
--   level                a company admin, within their own company.
--   is_default           the member themselves, on their own row.
--
-- THE ROW MOVE IS THE ONE THAT MATTERS. An earlier version of this function
-- returned early for company admins and skipped every column check, so an admin
-- could PATCH company_id on their own row and arrive as an admin of the target
-- company. Reproduced: one request against PostgREST moved a Building Integrity
-- admin into The Seed Collaborative at level 'admin'. It was not even gated on
-- guessing a uuid, because companies_select deliberately shows the consortium
-- row to every seed-entitled user.
--
-- Route handlers not exposing company_id is no defence and never was: the
-- publishable key ships in the browser bundle and PostgREST is directly
-- reachable, so these triggers and the RLS policies ARE the boundary. Hence the
-- immutability check runs FIRST, before any early return.
--
-- Nothing legitimate is lost. A company admin changes levels inside their own
-- company; moving a membership between companies is not an operation this
-- system has. You leave a company, and you are invited to another.
create or replace function public.guard_membership_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_privileged_caller() then
    if new.company_id is distinct from old.company_id then
      raise exception 'a membership cannot be moved to another company'
        using errcode = '42501';
    end if;
    if new.user_id is distinct from old.user_id then
      raise exception 'a membership cannot be reassigned to another person'
        using errcode = '42501';
    end if;
  end if;

  -- Level is the company admin's to set — within their own company, which the
  -- check above has now guaranteed is still the company this row belongs to.
  if public.is_privileged_caller() or public.is_company_admin(old.company_id) then
    return new;
  end if;

  if new.level is distinct from old.level then
    raise exception 'only a company admin can change a membership''s level'
      using errcode = '42501';
  end if;

  -- What is left for a plain member is is_default, and that is the whole point
  -- of the self-update path: choosing which company you act as by default.
  return new;
end;
$$;

drop trigger if exists memberships_guard_self_update on public.memberships;
create trigger memberships_guard_self_update
  before update on public.memberships
  for each row execute function public.guard_membership_self_update();

-- Handoff edge case: "last admin of a company removing themselves". Refuse it
-- rather than leaving a company nobody can administer. Platform admin is the
-- escape hatch (they can promote someone, then this stops applying).
create or replace function public.guard_last_company_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_was_admin boolean := old.level = 'admin';
  -- "Still an admin" has to mean still an admin OF THE SAME COMPANY. Asking
  -- only about the level let a row move out of a company while remaining an
  -- admin row, which walked straight past this guard and left the company it
  -- came from with no admins at all — repairable only by a platform admin. The
  -- move itself is refused above now; this predicate was independently wrong.
  v_still_admin boolean := (
    tg_op = 'UPDATE'
    and new.level = 'admin'
    and new.company_id = old.company_id
  );
  v_other_admins integer;
begin
  if not v_was_admin or v_still_admin then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select count(*) into v_other_admins
  from public.memberships m
  where m.company_id = old.company_id
    and m.level = 'admin'
    and m.id <> old.id;

  if v_other_admins = 0 and not public.is_privileged_caller() then
    raise exception 'a company must keep at least one admin' using errcode = '23514';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists memberships_guard_last_admin on public.memberships;
create trigger memberships_guard_last_admin
  before update or delete on public.memberships
  for each row execute function public.guard_last_company_admin();

-- ---------------------------------------------------------------------------
-- invites — decision 3: invite-only, nobody self-registers.
-- ---------------------------------------------------------------------------
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  company_id uuid not null references public.companies (id) on delete cascade,
  level text not null default 'member' check (level in ('member', 'admin')),
  -- Only the SHA-256 of the token is stored. The raw token exists in the invite
  -- link and nowhere else, so a database read cannot mint a usable invite.
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null
);

create index if not exists invites_company_idx on public.invites (company_id);
create index if not exists invites_email_idx on public.invites (lower(email));

create or replace function public.normalize_invite_email()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.email := lower(btrim(new.email));
  return new;
end;
$$;

drop trigger if exists invites_normalize_email on public.invites;
create trigger invites_normalize_email
  before insert or update of email on public.invites
  for each row execute function public.normalize_invite_email();

-- Flag flips are a platform-admin act (spec: "Onboarding a non-member company
-- is a real decision for Tommy, not a flag flip someone makes quietly", and a
-- departing company's flag is a judgement call, not automatic). A company admin
-- creating a company gets is_seed_member = false and must ask.
create or replace function public.guard_company_flags()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if (new.is_seed_member or new.is_consortium) and not public.is_privileged_caller() then
      raise exception 'only a platform admin can set is_seed_member / is_consortium'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if (new.is_seed_member is distinct from old.is_seed_member
      or new.is_consortium is distinct from old.is_consortium)
     and not public.is_privileged_caller() then
    raise exception 'only a platform admin can change is_seed_member / is_consortium'
      using errcode = '42501';
  end if;

  -- created_by is permission-bearing, not decoration: it records who founded a
  -- company, and Stage 5's departing-company judgement calls read it. A company
  -- admin can rename their company; they cannot rewrite its history. Same
  -- reasoning as memberships.company_id being immutable.
  if new.created_by is distinct from old.created_by
     and not public.is_privileged_caller() then
    raise exception 'a company''s creator cannot be changed'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists companies_guard_flags on public.companies;
create trigger companies_guard_flags
  before insert or update on public.companies
  for each row execute function public.guard_company_flags();
