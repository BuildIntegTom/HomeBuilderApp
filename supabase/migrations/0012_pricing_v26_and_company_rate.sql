-- One price: the v26 file format told to the redactor, and a company's own rate.
--
-- Spec: Tommy, 2026-11-08, across two exchanges. The pricing model first:
--
--   > *"it would just make it easy peasy and i believe well within our price
--   > point abilities to just give floors, walls, and roof panels a flat
--   > $25/sq ft of coverage. public users should see that price."*
--
-- then, asked whether the buckets that sentence does not name should keep
-- their own rates, **"Flat $25 for absolutely everything"**; asked which of
-- the two pricing schemes is the number, **"$25/sq ft is the only price"**;
-- and asked where the rate lives, **"The company, with a per-project
-- override"** — which is the second half of this file.
--
-- And the correction underneath all of it, asked directly:
--
--   > *"those rates were all-in prices, the 1.3x is double counting."*
--
-- So the 1.3x fabricator markup is deleted from the app. It had been applied
-- on top of rates the code described as base material cost, which means every
-- fabricator-, admin- and engineer-side total was 1.3x the real price, and the
-- figure shown to PUBLIC viewers was the correct one. Nothing in this file
-- computes money; that arithmetic lives in the app. What this file does is
-- let the database keep up with two consequences of it.
--
-- ---------------------------------------------------------------------------
-- PART 1 — WHY THE REDACTION ROW EXISTS, AND WHY IT IS URGENT
-- ---------------------------------------------------------------------------
-- The redactor classifies money paths BY SCHEMA VERSION: `browse_redact` looks
-- the document's `schema_version` up in `browse_schema_redaction`, and
-- `browse_version` REFUSES outright (errcode 0A000, "This version can't be
-- shown") when there is no row. 0009 seeded 24; 0010 seeded 25. The app now
-- writes **26**, so without the row below every project saved from here on is
-- a v26 document with no classification and cross-company browsing of it
-- fails.
--
-- IT FAILS CLOSED, which is the whole reason this is a chore and not an
-- incident: a v26 document is refused, never served unredacted. Owner-side
-- open, save and version history do not go through the redactor at all.
--
-- ⚠ WHAT IS MONEY AT v26 IS A DIFFERENT PATH FROM v24 AND v25, AND THAT IS
-- NEW. Both older formats name `state.priceModifier`. v26 names
-- `state.pricePerSqFt`, because the key was renamed when a 1.3x multiplier
-- became a dollars-per-square-foot rate. Until now the money key had the same
-- name in every format, so one list served all of them; it no longer does.
-- `apps/web/app/cloud/redaction.ts` carries the registry
-- (`MONEY_STATE_KEYS_BY_SCHEMA_VERSION`), `parseRedactedProjectFile` reads a
-- marker against the DOCUMENT's own format rather than the current build's,
-- and `redaction.test.ts` parses this very file to assert the row below agrees
-- with that registry. It is still exactly ONE money field, which is what keeps
-- this surface small.
--
-- ⚠ VERSIONS 24 AND 25 KEEP THEIR ROWS. A saved version is never migrated in
-- place, so the database holds all three formats indefinitely and dropping an
-- old row would make already-saved documents unservable.
--
-- ---------------------------------------------------------------------------
-- PART 2 — THE COMPANY'S OWN RATE
-- ---------------------------------------------------------------------------
-- > *"The company, with a per-project override"* — his answer to where the
-- > rate lives. Building Integrity sells at $25; another fabricator might sell
-- > at $30, and each project starts from its own company's number.
--
-- ⚠ NULLABLE, AND NULL MEANS "USE THE CATALOG'S". There is deliberately no
-- `default 25` here. $25 is a value Tommy gave, it lives in
-- `packages/panel-catalog/src/data.ts` as `priceRates.coveragePerSqFt`, and
-- putting a second copy of it in a column default would create two places to
-- change one number — with the database's copy winning silently for every
-- company created before somebody noticed. A company that has never set a
-- rate inherits whatever the app ships, which is the behaviour every company
-- has today.
--
-- ⚠ NO NEW POLICY IS NEEDED, and that was checked rather than assumed. 0002's
-- `companies_update` is already `using (is_company_admin(id) or
-- is_platform_admin())`, so a company admin may set their own rate and nobody
-- else may. `guard_company_flags` (0001) guards `is_seed_member`,
-- `is_consortium` and `created_by` only, so it neither blocks nor needs to
-- know about this column.
--
-- ⚠ THE COLUMN IS INERT UNTIL THE APP READS IT. Nothing selects it yet; the
-- per-project rate in the document is what prices a building today. It rides
-- along here for the same reason 0010 notes `wallRunStopsByWallId` did: so the
-- next stride is an app change and not another paste.
--
-- SAFE ON THE LIVE DATABASE, BY CONSTRUCTION:
--   * One transaction: `begin;` to `commit;`, so a copy that breaks part-way
--     applies NOTHING.
--   * Re-runnable: an UPSERT and an `add column if not exists`, plus
--     `drop constraint if exists` before the check. A second run changes
--     nothing.
--   * EXACTLY ONE EXISTING OBJECT IS REPLACED, and it has to be: 0009's
--     `browse_redact`, whose belt-and-braces guard names the money key
--     LITERALLY. See Part 3. Its signature, privileges and every other line
--     are unchanged -- the replacement was generated by extracting the
--     function from 0009 and editing one `if`, not by retyping it. Nothing
--     else is touched: it creates no table, drops nothing, touches no policy
--     and grants no privilege. It inserts one row into a table 0009 created
--     and adds one nullable column to `companies`. It goes nowhere near the
--     objects 0006/0008/0011 warn about (can_read_project, can_write_project,
--     holds_project_grant, holds_project_write_grant, projects_select,
--     projects_update, project_versions_select).
--   * It adds NO new money path to an existing version and removes none. A
--     version's classification can only ever widen what is stripped; this file
--     only ever adds a NEW version's row.
--
-- Run it AFTER 0011, in the Supabase SQL editor, exactly as 0006-0011 were.

begin;

-- ---------------------------------------------------------------------------
-- Schema version 26: state.pricePerSqFt. ⚠ A DIFFERENT PATH from 24 and 25,
-- which both name state.priceModifier — see the header. An UPSERT, so
-- re-running this file restores the classification rather than trusting
-- whatever is there.
-- ---------------------------------------------------------------------------
insert into public.browse_schema_redaction (schema_version, redacted_paths, note)
values (
  26,
  '[["state","pricePerSqFt"]]'::jsonb,
  'PROJECT_FILE_VERSION 26 (apps/web/app/projectFile.ts). The money key was RENAMED: priceModifier (a 1.3x markup, deleted as double-counting on Tommy''s 2026-11-08 correction) became pricePerSqFt (dollars per square foot of coverage, default 25). This is the first format whose money path differs from v24''s and v25''s, which both name state.priceModifier; apps/web/app/cloud/redaction.ts carries the per-version registry and redaction.test.ts asserts this row against it. Still exactly one money field. Versions 24 and 25 keep their rows — saved documents are not migrated in place and must stay servable.'
)
on conflict (schema_version) do update
  set redacted_paths = excluded.redacted_paths,
      note = excluded.note;

-- ---------------------------------------------------------------------------
-- PART 3 -- THE BELT IN browse_redact, WIDENED
-- ---------------------------------------------------------------------------
-- `browse_redact` strips every path the version's row declares, raises if one
-- survives, and THEN checks once more for a money key at any depth. That last
-- check -- the belt -- was written as a literal key name, `priceModifier`,
-- because at the time that was the money key in every format.
--
-- The rename at v26 means the belt no longer covers the format the app writes.
-- ⚠ That is NOT a hole in protection: the loop above it declares
-- `state.pricePerSqFt` for v26 from `browse_schema_redaction`, removes it, and
-- raises if it is still there. The guarantee is intact. But a safety net that
-- quietly stops covering the current case is worse than no net, because
-- whoever reads it next counts on it -- so it now names both keys.
--
-- Found by `apps/web/app/cloud/redaction.test.ts`, which asserts the belt's
-- own text against the app's money classification.
--
-- The function below is 0009's, extracted from that file verbatim, with only
-- the belt's `if` changed. Signature and privileges are unchanged, which
-- `create or replace` preserves.
-- ---------------------------------------------------------------------------
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

  -- The BELT, widened for v26. The braces are the loop above: it removes every
  -- path the version's row declares and raises if one survives, and that is
  -- what actually guarantees removal. This is the second net, for a money key
  -- sitting somewhere the declared paths did not name.
  --
  -- It was written naming `priceModifier` only, which was every format's money
  -- key at the time. v26 renamed it to `pricePerSqFt`, so from that bump the
  -- belt silently stopped covering the format the app writes -- not a hole
  -- (the loop still covers it) but worse than no belt, because the next reader
  -- believes it is there. Both names are checked now, and a future rename adds
  -- a third rather than replacing the second.
  if jsonb_path_exists(v_doc, 'lax $.**.priceModifier')
     or jsonb_path_exists(v_doc, 'lax $.**.pricePerSqFt') then
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
-- A company's own list rate. Null = use the catalog's figure; see the header
-- for why there is no default here.
-- ---------------------------------------------------------------------------
alter table public.companies
  add column if not exists price_per_sq_ft numeric(10, 2);

-- A rate of zero or less is not a discount, it is a mistake. Refused by the
-- table rather than by the UI, because the UI is not the only writer: a
-- company admin can reach this column through PostgREST directly.
alter table public.companies drop constraint if exists companies_price_per_sq_ft_positive;
alter table public.companies
  add constraint companies_price_per_sq_ft_positive
  check (price_per_sq_ft is null or price_per_sq_ft > 0);

comment on column public.companies.price_per_sq_ft is
  'This company''s list price in dollars per square foot of coverage. NULL means use the app catalog''s figure (priceRates.coveragePerSqFt), which is where Tommy''s $25 lives; there is deliberately no column default, so that number has exactly one home. A project may override it per-document. Settable by a company admin through companies_update (0002); no new policy was added.';

commit;
