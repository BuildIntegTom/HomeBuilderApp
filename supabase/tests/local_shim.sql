-- LOCAL VERIFICATION ONLY — do not run this on the Supabase project.
--
-- Supabase provides `auth.users`, `auth.uid()` and the `anon` / `authenticated`
-- / `service_role` roles. A plain Postgres instance does not, so the RLS test in
-- this folder cannot run against vanilla Postgres without them.
--
-- This file creates the smallest shim that makes the migrations and
-- supabase/tests/stage1_rls.test.sql runnable against a throwaway local
-- Postgres, so the policies can be exercised rather than assumed. It reproduces
-- Supabase's own definition of auth.uid() (read the `sub` claim out of
-- `request.jwt.claims`) and only the auth.users columns this schema touches.
--
-- What it DOES reproduce, since Stage 2: Supabase's default privileges on the
-- public schema (see below), so grant assertions cannot pass vacuously.
--
-- What it does NOT reproduce: Supabase's GoTrue auth service, the full MFA
-- factor table, email delivery, Supabase's own internal roles
-- (supabase_auth_admin and friends), or any hosted setting beyond those
-- default privileges. A green run here proves the POLICY LOGIC, not the hosted
-- configuration.

-- Roles are cluster-wide, not per-database, so this has to tolerate a second
-- run against a second database on the same instance.
do $shim$
begin
  create role anon nologin;
exception when duplicate_object then null;
end $shim$;

do $shim$
begin
  create role authenticated nologin;
exception when duplicate_object then null;
end $shim$;

do $shim$
begin
  create role service_role nologin;
exception when duplicate_object then null;
end $shim$;

grant usage on schema public to anon, authenticated, service_role;

-- Supabase's DEFAULT PRIVILEGES on the public schema, reproduced (added for
-- Stage 2). On a hosted project, every table and function the `postgres` role
-- creates in `public` is granted to anon, authenticated and service_role —
-- ALL on tables, which includes TRUNCATE, REFERENCES and TRIGGER. Without this
-- line a local run starts from Postgres's stricter defaults, so an assertion
-- like "anon holds nothing on project_versions" passes whether or not the
-- migration revoked anything. With it, the migration's revokes have to be real.
--
-- Must run BEFORE the migrations: default privileges apply to objects created
-- afterwards, by the role that ran this (the local superuser, standing in for
-- `postgres`).
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb,
  created_at timestamptz not null default now()
);

-- Enrolled two-factor authenticators. Supabase's GoTrue owns this table; only
-- the two columns 0004's meets_required_aal() reads are reproduced.
create table if not exists auth.mfa_factors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  friendly_name text,
  -- factor_type and the timestamps are NOT NULL on the hosted table. They are
  -- reproduced here so that the test's own inserts are shaped like the real
  -- thing rather than like this shim, which is the difference between a test
  -- that could run against a staging project and one that could not.
  factor_type text not null default 'totp',
  status text not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

-- Supabase's own definition, verbatim in behaviour: the signed-in user id comes
-- from the request's JWT claims, which PostgREST sets per request.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ),
    ''
  )::uuid;
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.jwt() to anon, authenticated, service_role;
grant select on auth.mfa_factors to authenticated, service_role;
