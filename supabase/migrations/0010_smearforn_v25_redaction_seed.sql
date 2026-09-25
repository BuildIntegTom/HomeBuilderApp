-- Smearforn Stage 0's file-format bump, told to the redactor.
--
-- Spec: building_integrity_app_spec.md, "Project Smearforn — drawing a real
-- job" → Stage 0's as-built note, third bullet ("⚠ The bump has a backend
-- consequence the plan said it would not have").
--
-- WHY THIS EXISTS. The redactor classifies money paths BY SCHEMA VERSION:
-- `browse_redact` looks the document's `schema_version` up in
-- `browse_schema_redaction`, and `browse_version` REFUSES outright (errcode
-- 0A000, "This version can't be shown") when there is no row. Migration 0009
-- seeded exactly one version, 24. Smearforn Stage 0 moved
-- PROJECT_FILE_VERSION 24 -> 25 for the Foundation scope flag, so every
-- project saved since then is a v25 document with no classification, and
-- cross-company browsing of it fails.
--
-- IT FAILS CLOSED, WHICH IS WHY THIS IS A FIX AND NOT AN INCIDENT. A v25
-- document is refused, never served unredacted. Owner-side open, save and
-- version history are unaffected — they do not go through the redactor at
-- all. What is broken is only this: another company in the consortium cannot
-- open anything Tommy has saved since the bump.
--
-- WHAT IS MONEY AT v25: EXACTLY THE SAME SINGLE PATH AS AT v24,
-- state.priceModifier. Verified against `MONEY_DOCUMENT_PATHS` /
-- `MONEY_CLASSIFICATION` in apps/web/app/cloud/redaction.ts, which is
-- `satisfies Record<keyof ProjectState, MoneyClassification>` — so the
-- compiler itself refuses a ProjectState key that carries no classification.
-- v25 added `foundationEnabled` (the one required new key — see
-- KEYS_ADDED_IN_V25 in projectFile.ts) and `wallRunStopsByWallId` (Stage 3's,
-- riding along inert so the format only bumps once). Both are classified
-- "not-money": one is a checkbox, the other a pair of inches per wall. The
-- seven plaster/shipping prices are still useState only and are still not in
-- the document. `apps/web/app/cloud/redaction.test.ts` asserts the row below
-- agrees with that classification, by parsing this file.
--
-- SAFE ON THE LIVE DATABASE, BY CONSTRUCTION — the same four properties 0009
-- claims, checked against this file rather than inherited:
--   * One transaction: it opens with `begin;` and closes with `commit;`, so a
--     copy that breaks part-way applies NOTHING.
--   * Re-runnable: the single statement is an UPSERT. A second run rewrites
--     the same row with the same values and changes nothing else.
--   * NO EXISTING OBJECT IS ALTERED. This file creates nothing, drops nothing,
--     replaces no function, touches no policy and grants no privilege. It
--     inserts one row into a table 0009 already created. In particular it does
--     not go near the five objects 0006 and 0008 warned Stage 4 not to widen
--     (can_read_project, can_write_project, holds_project_grant,
--     projects_select, project_versions_select), nor near `browse_redact`
--     itself.
--   * It adds NO new money path and removes none. A version's classification
--     can only ever widen what is stripped, never narrow it, and this one is
--     byte-identical to 24's.
--
-- WHAT IT DOES NOT DO. It does not remove version 24's row. v24 documents
-- already in `project_versions` must keep working — a saved version is not
-- migrated in place, so the database will hold both formats indefinitely.
--
-- Run it AFTER 0009, in the Supabase SQL editor, exactly as 0006–0009 were.

begin;

-- Schema version 25: exactly state.priceModifier, the same single path as 24.
-- An UPSERT, so re-running this file restores the classification rather than
-- trusting whatever is there.
insert into public.browse_schema_redaction (schema_version, redacted_paths, note)
values (
  25,
  '[["state","priceModifier"]]'::jsonb,
  'PROJECT_FILE_VERSION 25 (apps/web/app/projectFile.ts), bumped by Smearforn Stage 0 for the Foundation scope flag. The money set did not change: the only money field in ProjectState is still priceModifier. v25''s new keys (foundationEnabled, wallRunStopsByWallId) are classified not-money in apps/web/app/cloud/redaction.ts. Version 24''s row is deliberately left in place — saved v24 documents are not migrated and must keep being servable.'
)
on conflict (schema_version) do update
  set redacted_paths = excluded.redacted_paths,
      note = excluded.note;

commit;
