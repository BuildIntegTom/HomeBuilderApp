# Applying `0014_proposals.sql` — one chunk at a time

Stage 7: a designer with **no account** sends Building Integrity a link, and BI
adopts the design as a real project.

**Nothing here was run against your project.** It was built and verified
against a throwaway Postgres (PGlite) with all thirteen existing migrations
applied first — 37 assertions, all passing, including every refusal. You paste
it; I don't touch the live database.

⚠ **One query per chunk.** The Supabase SQL editor shows only the LAST
result, so a block that ends in a `commit` hides whatever the queries above it
said. Run each numbered block on its own and read its answer before the next.

---

## 1. Pre-flight — does this project already have the things 0014 leans on?

Run this one query. Every row must say `yes`.

```sql
select 'projects table'        as thing, case when to_regclass('public.projects')          is not null then 'yes' else 'NO' end as present
union all select 'project_versions table',  case when to_regclass('public.project_versions') is not null then 'yes' else 'NO' end
union all select 'companies table',         case when to_regclass('public.companies')        is not null then 'yes' else 'NO' end
union all select 'is_member_of()',          case when to_regprocedure('public.is_member_of(uuid)') is not null then 'yes' else 'NO' end
union all select 'proposals folder allowed',
       case when exists (select 1 from pg_constraint
                          where conrelid = 'public.projects'::regclass
                            and contype = 'c'
                            and pg_get_constraintdef(oid) like '%proposals%')
                 then 'yes' else 'NO' end
union all select 'proposals table NOT already here',
       case when to_regclass('public.proposals') is null then 'yes' else 'already exists' end;
```

- Any `NO` on the first four means an earlier migration has not been applied.
  Stop and say which.
- `proposals folder allowed` must be `yes` — `adopt_proposal` files the new
  project there, and `projects.folder` has a check constraint listing the
  legal values.
- The last row saying `already exists` is fine if you are re-running; `0014`
  is written to be re-runnable.

---

## 2. The migration

Paste the whole of **`supabase/migrations/0014_proposals.sql`** as one block
and run it. It is a single `begin` … `commit`, so it either all applies or none
of it does.

Expect: `Success. No rows returned.`

---

## 3. Post-flight — did it land, and is it locked down?

### 3a. The table, and that RLS really is on with no policies

```sql
select c.relname,
       c.relrowsecurity  as rls_enabled,
       c.relforcerowsecurity as rls_forced,
       (select count(*) from pg_policies p where p.tablename = 'proposals') as policy_count
  from pg_class c where c.relname = 'proposals';
```

Expect `rls_enabled = true`, `rls_forced = true`, **`policy_count = 0`**.

⚠ Zero policies is deliberate and is the point: with RLS on and no policy,
nothing reaches this table except the four `security definer` functions. If you
ever see a policy appear here, somebody has opened a second door.

### 3b. The four functions and exactly who may call them

```sql
select p.proname,
       has_function_privilege('anon',          p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
       has_function_privilege('service_role',  p.oid, 'execute') as service_role
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('submit_proposal','proposal_preview','proposal_document','adopt_proposal')
 order by p.proname;
```

Expect **exactly** this:

| proname | anon | authenticated | service_role |
|---|---|---|---|
| `adopt_proposal` | **false** | true | **false** |
| `proposal_document` | **false** | true | **false** |
| `proposal_preview` | true | true | **false** |
| `submit_proposal` | true | true | **false** |

⚠ The two `false`s in the `anon` column are the real ones. `proposal_document`
returns the building; `adopt_proposal` creates a project. If either shows
`true`, stop — the grants did not apply as written.

`service_role` is false everywhere on purpose: these are called on the
request's own client, so a leaked service key buys no reach here.

### 3c. A live round trip, inside a transaction you roll back

⚠ **This writes.** It is wrapped in `begin`/`rollback`, so nothing survives —
but run it on staging if you have one.

```sql
begin;
select * from public.submit_proposal(
  repeat('9', 64),
  '{"schemaVersion": 26, "state": {"projectName": "Post-flight check"}}'::jsonb,
  now() + interval '1 day',
  'Post-flight'
);
select found, submitter_name, adopted from public.proposal_preview(repeat('9', 64));
rollback;
```

Expect a proposal id and expiry from the first, then `found = true`,
`submitter_name = Post-flight`, `adopted = false`. Then it is gone.

---

## What this does NOT do

- **No app surface yet.** Nothing in the editor submits or adopts a proposal;
  the database side is what this migration is. The functions are reachable only
  from code we write next.
- ⚠ **No rate limiting.** `submit_proposal` is an unauthenticated write — the
  first in this schema. The migration mitigates size, expiry and discoverability
  and says plainly that per-IP limiting is not solvable in Postgres alone. **If
  this ever reaches real users, that is the thing to build first.**
- **No sweep job.** `expires_at` makes an old proposal unreadable, not deleted.
  A `delete from public.proposals where expires_at < now() - interval '30 days'`
  on a schedule is the obvious follow-up; nothing here needs it yet.

## After it is applied

Tell me, and I will mark `0014` **Applied** in `supabase/README.md` the way
0011, 0012 and 0013 are marked.
