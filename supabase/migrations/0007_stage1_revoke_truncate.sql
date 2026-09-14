-- Stage 1 follow-up — take TRUNCATE, REFERENCES and TRIGGER back from
-- `authenticated` on the four Stage 1 tables.
--
-- Spec: "Stage 2 plan" → "Noticed while planning": 0002 granted four privileges
-- to authenticated but never revoked Supabase's default broad grant first, so
-- authenticated also holds TRUNCATE (which bypasses RLS), REFERENCES and
-- TRIGGER. PostgREST never issues TRUNCATE, so this was defence in depth rather
-- than a hole — but it is one direct connection away from wiping memberships.
--
-- RUN THIS ONLY IF 0006's post-flight query (F) showed `t`. If it showed `f`,
-- there is nothing to take back; running it anyway is harmless.
--
-- What this touches: those three privileges, for authenticated, on those four
-- tables. Nothing else — not anon (0002 already revoked everything from it),
-- not select/insert/update/delete, not any policy, trigger or function.
--
-- One transaction. Re-runnable: revoking a privilege nobody holds is a no-op.

begin;

revoke truncate, references, trigger
  on public.companies, public.user_profiles, public.memberships, public.invites
  from authenticated;

commit;
