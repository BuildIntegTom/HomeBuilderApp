-- Stage 1 seed — the four real companies (spec decision 16).
--
-- Run once, after the migrations, as the database owner (Supabase SQL editor).
-- Idempotent: re-running it changes nothing.
--
-- All four carry is_seed_member = true, which is the true state today — the
-- spec records that the false branch is untested in production because every
-- company is a member. A new company created through the app arrives with the
-- flag FALSE, and turning it on is Tommy's decision, not a side effect.
--
-- THE SEED COLLABORATIVE'S OWN FLAG IS TRUE. The spec calls this out because
-- leaving it false is the natural mistake: it is the consortium, so if its own
-- flag is false its own tree drops out of the browse set in Stage 4.

-- is_seed_member and is_consortium can only be set by a platform admin
-- (guard_company_flags in 0001), and at this point there isn't one — the first
-- account does not exist yet. So this opts in as an operator, out loud and for
-- the length of one transaction. Only someone holding a direct database
-- connection can do this; it is unreachable through the API.
begin;
set local app.operator = 'on';

insert into public.companies (name, is_seed_member, is_consortium)
values
  ('Building Integrity',    true, false),
  ('Rare Forms',            true, false),
  ('New Frameworks',        true, false),
  -- is_consortium marks WHICH row is the consortium. Exactly one row may carry
  -- it (partial unique index in 0001); it is what can_act_as() resolves when it
  -- decides whether a member of any member company may act as Seed.
  ('The Seed Collaborative', true, true)
on conflict do nothing;

commit;
