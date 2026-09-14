# Supabase — Stage 1 (accounts and companies) and Stage 2 (cloud projects and versions)

Everything in this folder is SQL. The app's access rules live here, not in the
route handlers: Supabase was chosen (spec decision 30) *because* the permission
rules cross company boundaries, so they are written once in the database rather
than re-derived in every route that touches a project.

## What is here

| File | What it does |
|---|---|
| `migrations/0001_stage1_accounts_and_companies.sql` | Tables: `companies`, `user_profiles`, `memberships`, `invites`. Guard triggers. |
| `migrations/0002_stage1_rls_policies.sql` | Helper functions and every RLS policy. |
| `migrations/0003_stage1_invites.sql` | `invite_preview()` and `redeem_invite()`. |
| `migrations/0004_stage1_optional_two_factor.sql` | Makes an *opted-in* second factor actually gate reads. |
| `migrations/0005_stage1_company_creation.sql` | `create_company_with_first_admin()`. |
| `migrations/0006_stage2_projects_and_versions.sql` | Stage 2: `projects`, `project_versions`, their triggers, helpers, RPCs and policies. |
| `seed.sql` | The four real companies. |
| `tests/stage1_rls.test.sql` | The Stage 1 verification script. |
| `tests/stage2_rls.test.sql` | The Stage 2 verification script. Local or staging only. |
| `tests/stage2_concurrency.test.sh` | Two connections saving the same project at once. Local throwaway database only. |
| `tests/local_shim.sql` | Local-only stand-in for Supabase's `auth` schema and default privileges. Never run on the project. |

Stage 3's `collaborators` and `collab_requests` are **not** here and must not
be added until that stage.

## Running it, first time

1. In the Supabase SQL editor, run **all five** migrations, `0001` through
   `0005`, **in order**. Stopping at `0004` leaves company creation failing with
   "function does not exist" and no other symptom.
2. Run `seed.sql`. It is idempotent.
3. **On a staging project only**, run `tests/stage1_rls.test.sql`. It prints
   `stage1_rls: ALL ASSERTIONS PASSED`, or aborts on the first failure.

   **Not on the live project.** It is one transaction ending in `ROLLBACK`, and
   inside it the file inserts into `auth.users` and clears `companies`,
   `memberships` and `invites` so that its row counts mean something. Nothing is
   committed and the real rows come back — but "safe as long as nothing commits"
   is not a property worth resting the four companies on, and an autocommitting
   client would not give them back. There is a guard at the top that aborts once
   any membership exists; a freshly seeded project has none, which is exactly
   the state step 2 leaves you in, so the guard does not cover you here. Point
   it at staging.

4. **Pre-flight, on the project you are actually going to use.** Three checks,
   all of which fail quietly and expensively if you skip them. Run these BEFORE
   step 1 if you can — (c) in particular decides whether `0001` will apply at
   all.

   ```sql
   -- (a) Can the database owner read the MFA factor table? meets_required_aal()
   --     in 0004 reads auth.mfa_factors, and it is a RESTRICTIVE policy on ALL
   --     FOUR TABLES. If this returns false the function RAISES instead of
   --     returning, and every read and every write for every user fails —
   --     which looks like a broken app rather than a permissions problem.
   select has_table_privilege('postgres', 'auth.mfa_factors', 'select');

   -- (b) Does your account have a profile row? The trigger that creates one is
   --     AFTER INSERT on auth.users, and 0001 backfills existing accounts — but
   --     confirm rather than assume, because BOTH bootstrap statements below
   --     are silent no-ops if the email does not match a row. They will report
   --     success and change nothing.
   select u.id, u.email, p.id as profile_id, p.is_platform_admin
     from auth.users u
     left join public.user_profiles p on p.id = u.id
    where lower(u.email) in (
      'tommy@buildinteg.com',      -- Building Integrity
      'virgil@buildinteg.com',     -- Building Integrity
      'ace@REPLACE-ME',            -- New Frameworks
      'greg@REPLACE-ME'            -- Rare Forms
    );

   -- (c) Does any account have a NULL email? public.user_profiles.email is NOT
   --     NULL, but auth.users.email is nullable on Supabase — phone signups,
   --     anonymous sessions, some SSO providers. 0001 backfills profiles by
   --     selecting that column straight across, so ONE such account aborts the
   --     whole migration with 23502 (not-null violation) and 0001 does not
   --     apply. Expect 0.
   select count(*) from auth.users where email is null;
   ```

   Expect **four rows** from (b) — one per platform admin — each with a
   non-null `profile_id`. A row with a null `profile_id` means the trigger did
   not fire for that account and the bootstrap below will silently skip them.
   `true` from (a) and `0` from (c) before you go on.

   **If (c) is not zero**, decide what those accounts are before running `0001`.
   If they are junk (a test phone signup, an abandoned anonymous session),
   delete them. If they are real, the profile row needs an email that
   `auth.users` does not have, which is a decision about what identity means
   here rather than a line of SQL — ask before inventing a placeholder address.
5. Make the four platform admins. There is no self-service path to this and
   deliberately isn't one: a trigger refuses any change to the flag from anyone
   who is not already a platform admin, and at this point nobody is. So the
   first one is set from the SQL editor, with the operator opt-in that
   `is_privileged_caller()` looks for.

   There are four: Tommy and Virgil at Building Integrity, Ace at New
   Frameworks, Greg at Rare Forms (spec, "Platform admins"). Each also holds an
   ordinary admin membership at their own company, so each has two entitlements
   — their company by membership, everything by platform admin. Building
   Integrity has two; that is deliberate, not a duplicate.

   **Know what you are granting.** Consortium browsing is deliberately *design
   yes, money no*. Platform admin bypasses that, so all three see every
   company's price modifier and margin. Tommy confirmed that is intended; it
   does mean "your margin stays yours" reads as "yours and the four platform
   admins'". Say so when you hand out the tag — Ace and Greg agreed to a set
   that has since grown by one.

   You need an account first, which means an invite, which means a company
   admin — so bootstrap in this order:

   ```sql
   -- a) Create your auth user through the Supabase dashboard
   --    (Authentication → Users → Add user). That fires the trigger that
   --    creates your profile row.
   --
   -- a) Create ALL FOUR auth users through the Supabase dashboard
   --    (Authentication → Users → Add user). That fires the trigger that
   --    creates each profile row. Do all four before running (b).
   --
   -- b) Then, in the SQL editor, as ONE transaction. Written as a values list
   --    rather than four copies so they cannot drift apart, and so a typo in
   --    one email fails the whole block instead of half-applying it:
   begin;
   set local app.operator = 'on';

   with admins(email, company) as (values
     ('tommy@buildinteg.com',  'Building Integrity'),
     ('virgil@buildinteg.com', 'Building Integrity'),
     ('ace@REPLACE-ME',        'New Frameworks'),
     ('greg@REPLACE-ME',       'Rare Forms')
   )
   insert into public.memberships (user_id, company_id, level)
   select u.id, c.id, 'admin'
     from admins a
     join auth.users u        on lower(u.email) = lower(a.email)
     join public.companies c  on c.name = a.company
   on conflict (user_id, company_id) do nothing;

   update public.user_profiles set is_platform_admin = true
    where lower(email) in (
      'tommy@buildinteg.com',
      'virgil@buildinteg.com',
      'ace@REPLACE-ME',
      'greg@REPLACE-ME'
    );

   -- Confirm BEFORE committing. Expect exactly four rows, each
   -- is_platform_admin = true with the right company. Both statements above
   -- are silent no-ops on an email that does not match, so an empty or short
   -- result here is the only warning you get.
   select p.email, p.is_platform_admin, c.name as company, m.level
     from public.user_profiles p
     join public.memberships m on m.user_id = p.id
     join public.companies c   on c.id = m.company_id
    where p.is_platform_admin
    order by c.name;

   commit;   -- or: rollback;  if the select above is not four correct rows
   ```

   `set local app.operator = 'on'` is the whole escape hatch. It is deliberately
   something you have to type: only a direct database connection can set it, no
   route or policy sets it, and a PostgREST client cannot set any GUC except the
   `request.*` ones PostgREST sets for it. Everything else in this schema is
   decided by who you are.

   From there everyone else arrives by invitation from the app.

## How the policies are shaped

Four tables, RLS on all of them, and a small set of `SECURITY DEFINER` helper
functions that the policies call. The helpers are definer-rights so that a
policy on one table can consult another without re-entering that table's own
policies, which would recurse.

- `is_platform_admin()` — reads the flag on your profile row.
- `is_member_of(company)` / `is_company_admin(company)` — your level *at that
  company*. Level is per-membership: admin at one company and a plain member at
  another is a normal state, not an anomaly.
- `is_seed_entitled()` — do you hold a membership at any company with
  `is_seed_member = true`? Being at Building Integrity is what entitles you to
  act as The Seed Collaborative; no Seed membership row is needed.
- `consortium_company_id()` — which company row *is* the consortium.
- **`can_act_as(company)`** — the switcher rule, in the database: platform
  admin, or a company you are a member of, or the consortium if you are
  seed-entitled. Nothing else. The switcher selects among entitlements you
  already hold and never creates one.
- `is_privileged_caller()` — the operator escape. Platform admin, or a session
  that typed `set local app.operator = 'on'`. It is the only function here that
  grants rather than restricts, which is why it is the smallest one.
- `meets_required_aal()` — see two-factor below.

Two columns are immutable rather than policy-controlled, because the question is
*which column changed* rather than *which row*: `memberships.company_id` and
`memberships.user_id` cannot be altered by anyone below platform admin. A
company admin changes levels inside their own company; moving a membership
between companies is not an operation this system has. That rule is what stops a
company admin rewriting their own row into another company's and arriving there
as its admin.

The policies themselves are unremarkable applications of those: you read the
companies you belong to (plus the consortium, by name, if you can act as it);
you read your own memberships, or all of a company's if you administer it;
invites are admin-only; nobody below platform admin can delete a company.

Two rules are triggers rather than policies, because they are about *which
column changed* rather than *which row*:

- `guard_membership_self_update` — you may set your own default company; you may
  not promote yourself.
- `guard_company_flags` — only a platform admin may move `is_seed_member` or
  `is_consortium`. Putting a company into the consortium is a decision, not a
  side effect of creating a row.

## Hand-testing it — do this as an ORDINARY ACCOUNT, not as yourself

**Steps 5 to 10 below must be performed by an account that is not a platform
admin.** This is the single most important line in this file.

A platform admin passes every check in the system: they hold an entitlement to
every company, RLS shows them every row, and every guard trigger lets them
through. Testing as Tommy therefore proves almost nothing — and that is not
theoretical. **Both bugs that survived a review were invisible to a platform
admin and broken for everybody else**: a route gated on entitlements refused the
first invite to a new company for every ordinary user, and a company admin could
move their own membership into another company. Each would have hand-tested
clean.

So: make a second account, give it a plain membership, and drive the app as that
person. Sign in as yourself only for the steps that say so.

1. Pre-flights (a), (b) and (c) above — before the migrations.
2. All five migrations, in order.
3. `seed.sql`. Confirm four companies and that The Seed Collaborative's
   `is_consortium` and `is_seed_member` are both true.
4. Bootstrap yourself: membership at Building Integrity, then platform admin.
   Confirm the switcher shows "Building Integrity" by name the moment you sign
   in, without being touched.
5. **As you**, invite an ordinary member to Building Integrity. Copy the link.
6. **As them**, accept it. Then check, in their session:
   - the switcher names Building Integrity, and offers The Seed Collaborative as
     a second entry (membership of a member company is the entitlement);
   - the account panel shows no people list and no invite form;
   - they cannot invite anyone.
7. **As you**, promote them to company admin. **As them**, confirm the people
   list and invite form have appeared, and that they can see the invite you used
   to create them.
8. **As that ordinary admin — not as you** — create a company, giving a first
   admin address that is NOT their own. Then confirm:
   - the app hands back exactly one link and says they are not a member;
   - **the new company does not appear in their switcher**, at all, ever;
   - trying again with their own address is refused.
9. **As them**, enrol two-factor. Sign out, sign back in, and confirm the code
   is asked for and that refusing it leaves them able to read nothing. Then
   unenrol, and confirm the code is asked for again to do it.
10. **As them**, run the password reset from the sign-in panel while two-factor
    is still on. The reset link should ask for the code before it will set a new
    password — the mailbox alone must not be enough.
11. **As you**, deliberately trip the sole-admin trap: try to delete the last
    admin of a company from the Supabase dashboard. It should fail. Use the
    operator block above, or promote someone else first.

Anything that behaves differently for you than for them is worth stopping on,
even if your version looks correct.

## Deleting a person from the Supabase dashboard

**You can no longer delete an auth user who is the sole admin of a company, and
the dashboard will not tell you why.**

`memberships.user_id` references `auth.users` with `on delete cascade`, and
`guard_last_company_admin` is a `BEFORE DELETE` trigger on `memberships`.
GoTrue's admin delete runs as `supabase_auth_admin` with no JWT and no operator
opt-in, so the trigger refuses the cascade and aborts the whole deletion.

That is the guard doing its job — it is refusing to leave a company nobody can
administer — and it is a real consequence of the operator escape being
explicit rather than "anyone without a JWT". The fix is to say what you mean:

```sql
begin;
set local app.operator = 'on';
delete from auth.users where email = 'someone@example.test';
commit;
```

Better, usually: promote someone else at that company first, and then the
dashboard works normally.

## Creating a company, and its first admin

The first invite to a company has to be written at a moment when nobody
administers that company, so no policy phrased as "an admin of this company"
can authorize it. Two ways to solve that were on the table; **Tommy chose the
definer function.**

`public.create_company_with_first_admin()` (0005) creates the company and mints
the first-admin invite in one call, checking decision 27's own condition itself.
The creator gets **no standing access at any point** — not a membership, not a
window, not a way to read the company back. The test asserts exactly that: after
creating, they cannot see the company, cannot see the invite, and cannot mint a
second one.

The rejected alternative was a temporary window — the creator could see and
invite to their new company until its first admin accepted. It worked, but it
had three things to be careful about that this design cannot get wrong: a first
invite issued at `level = 'member'` would have held the window open forever;
invites minted inside a window outlive it; and nothing stopped a founder
addressing the first-admin invite to themselves.

The price, stated because it is real: a mistyped first-admin address cannot be
corrected by the founder. They cannot withdraw or reissue that invite, because
they do not administer that company. A platform admin fixes it. That is what "no
standing access" costs, and the UI says so before you submit.

## `is_consortium` — a column the spec does not name

The spec says The Seed Collaborative is both a company and the consortium, and
that other companies carry `is_seed_member` pointing at it. It never says how
the code is meant to know *which row* is the consortium. Matching on the name
string `'The Seed Collaborative'` would break the first time anyone renames it,
silently and in the direction of granting nothing, so this schema adds a
`companies.is_consortium` flag with a partial unique index allowing at most one.

Flagged rather than assumed: if Tommy would rather identify it another way, this
is the one place to change.

## Two-factor

Optional for every account including platform admin — asked directly, confirmed
twice, with the "one password away from everything" exposure spelled out. There
is no mandatory path anywhere and an account without a factor is not a defect.

`0004` exists so that turning it on is not theatre. A restrictive policy on each
table requires `aal2` **only for users who have a verified factor**; everyone
else is unaffected (`else true`). Without it, "enable 2FA" would set a flag that
nothing ever checked.

## Verification status

`tests/stage1_rls.test.sql` was run against a real PostgreSQL 17.4 instance with
`tests/local_shim.sql` standing in for Supabase's `auth` schema — all assertions
pass, and the suite was mutation-tested (disabling RLS on `companies`, stubbing
`can_act_as` to `true`, and dropping the aal policy each make it fail) so it is
not passing vacuously.

The suite was extended after a review found a privilege escalation that it had
not been looking for: a company admin could `PATCH` `company_id` on their own
membership row and arrive as an admin of any company they could name, the
consortium included. It now carries that attack and four variants of it, plus
company creation and the operator escape. Five mutations — restoring the
vulnerable guard, restoring the fail-open `auth.uid() is null` privilege test,
dropping the founding-creator clause, restoring the dead promote-on-redeem path,
and granting the helpers back to `anon` — each make it fail, on the assertion
that names the bug.

**It has not been run against Tommy's Supabase project**, which had no
migrations applied at the time of writing. Run step 3 above; the policy logic is
verified, the hosted configuration is not.

One rule has NO test and cannot easily have one: `guard_last_company_admin`
requires `new.company_id = old.company_id` before treating a row as still being
an admin of the company it came from. With the row move refused outright, no
reachable path exercises that predicate — it is defence in depth behind a closed
door, and is written down here rather than counted as covered.

Two more things this suite does NOT cover, for the same reason — no reachable
path — but which are worth knowing are assumptions rather than assertions: that
Supabase's PostgREST always connects through a role named in the `role` GUC
(the belt on the operator escape reads it), and everything above the database.
The sign-in, two-factor, password-reset and invite-acceptance HTTP flows have
never been run against a real GoTrue. `requireSatisfiedAal` was rewritten to stop
depending on GoTrue's behaviour rather than to confirm it.

---

# Stage 2 — cloud projects and versions

Spec: `building_integrity_app_spec.md`, "Stage 2 plan — Cloud projects and
versions" (approved 2026-09-13). This is sub-stage **2A: schema, RLS and tests
only.** No app code reads these tables yet, which is why it is safe to apply
ahead of the app — and before the Stage 1 ordinary-account hand test, which
still gates 2B.

## What 0006 creates

- **`projects`** — the listing record: owning company, folder
  (`current` / `past` / `proposals`), name, head version number, created/updated.
  `company_id` is `on delete restrict`: deleting a company never takes its
  projects with it.
- **`project_versions`** — append-only. Every save is a new row carrying the
  whole project document (JSONB), its author, the server's save time, the file
  format version, and the version it was based on (`parent_version_id`).
- **Seven triggers.**
  - `project_versions_prepare` — numbers the version, stamps the author and
    time (ignoring whatever the client sent), snapshots the author's name,
    checks the document's shape and the 4 MB ceiling, and **locks the project
    row so two simultaneous saves cannot collide.**
  - `project_versions_apply_head` — moves the project's head, `updated_at`
    and name to match the new version.
  - `project_versions_refuse_change` — **no version is ever updated, by anyone,
    operator included.** A version is deleted only as part of a platform admin
    deleting its whole project.
  - `project_versions_refuse_truncate` and `projects_refuse_truncate` —
    **TRUNCATE is refused on both tables, for everyone.** TRUNCATE skips row
    triggers and RLS, so without these append-only would be one statement away.
  - `projects_guard_columns` — a member can change `folder` and nothing else.
  - `projects_stamp_insert` — a new project's `created_at`, `updated_at`,
    `name` and head are set by the server, whatever the client sent. Without
    it a direct insert could backdate a project permanently.
- **Helpers** `can_read_project` / `can_write_project`, and **RPCs**
  `create_project`, `save_project_version`, `rename_project` (security
  invoker: they exist so a save is one call, not to grant anything).
- **Grants:** `authenticated` gets select/insert/update/delete on projects and
  select/insert/delete on versions — **no update on versions at all.** `anon`
  and `service_role` get nothing (no Stage 2 route may use the service role).
- **Policies:** you see a project if you are a member of the company that owns
  it, or a platform admin. **Nobody sees another company's projects or
  versions before Stage 4** — that is what keeps every price modifier inside its
  own company until the cost redactor exists. The two-factor restrictive policy
  from 0004 covers both tables.
- **No foreign key to `auth.users`** on `project_versions.author_id` or
  `projects.created_by` — see "Deleting a person who has saved a version".

**It alters no Stage 1 table, function, trigger, policy or row.** It is one
transaction, and running it twice changes nothing.

### Two things the app stages must know

- **The 4 MB ceiling is measured on `document::text`, not on the JSON the app
  sent.** PostgreSQL's text output of a `jsonb` value adds a space after every
  `:` and `,`, so a minified document is refused a little *before* it reaches
  4 MB of actual bytes (a small sample, `{"a":[1,2,3],"b":{"c":"d"}}`, is
  27 bytes minified and 33 as jsonb text — measured on PostgreSQL 17.4). A document that fits Vercel's ~4.5 MB body limit can therefore
  still be refused here. 2B should treat "refused as too large" as a real
  outcome with its own message, not as an impossible one.
- **For 2C (version history): `kind` is not proof of what changed.** A client
  inserting directly can write `kind = 'rename'` on any version — including a
  version 1 carrying a completely different document. Only versions written by
  `rename_project` are guaranteed to differ from their parent in
  `state.projectName` alone. The history UI may *label* a row "Renamed to …",
  but must not skip, collapse or trust-diff it on the strength of `kind`.

## Applying it — the exact steps

Everything below is **read-only except step 2.**

### Step 1 — pre-flight (read-only). Paste, run, write down the numbers.

```sql
-- (a) Stage 1 is fully applied. Expect: true, true.
select to_regprocedure('public.meets_required_aal()') is not null as has_0004,
       to_regprocedure('public.create_company_with_first_admin(text,text,text,timestamptz)') is not null as has_0005;

-- (b) Stage 2 is not applied yet. Expect: null, null, 0 the first time.
--     (If you see the table names and 5, 0006 has already been run. Running it
--      again is harmless, but you do not need to.)
select to_regclass('public.projects')         as projects,
       to_regclass('public.project_versions') as project_versions,
       (select count(*) from pg_proc
         where pronamespace = 'public'::regnamespace
           and proname in ('can_read_project', 'can_write_project', 'create_project',
                           'save_project_version', 'rename_project')) as stage2_functions;

-- (c) Stage 1 row counts BEFORE. Write these four numbers down.
select (select count(*) from public.companies)     as companies,
       (select count(*) from public.user_profiles) as user_profiles,
       (select count(*) from public.memberships)   as memberships,
       (select count(*) from public.invites)       as invites;

-- (d) The database owner can read the MFA factor table. The new tables get the
--     same restrictive two-factor policy as Stage 1's. Expect: true.
select has_table_privilege('postgres', 'auth.mfa_factors', 'select');
```

Stop if (a) or (d) is not `true`.

### Step 2 — run `0006` after `0005`

Open `migrations/0006_stage2_projects_and_versions.sql`, paste the **whole
file** into the SQL editor, and run it. It begins with `begin;` and ends with
`commit;`. Expect "Success. No rows returned." If it reports an error, nothing
was applied: copy the error and stop.

**The editor may stop and ask you to confirm before running it** — a warning
about potentially destructive operations. That is expected: the file contains
`drop trigger if exists`, `drop policy if exists` and `revoke`, which is what
makes it safe to run twice. None of them touch a Stage 1 object or any row.
Confirm and run.

### Step 3 — post-flight (read-only). What you should see.

```sql
-- (A) Both tables exist with row level security on.
--     Expect 2 rows: project_versions | t   and   projects | t
select c.relname as table_name, c.relrowsecurity as rls_on
  from pg_class c
 where c.relnamespace = 'public'::regnamespace
   and c.relname in ('projects', 'project_versions')
 order by c.relname;

-- (B) Privileges. Expect exactly:
--     project_versions | anon_has_any f | service_role_has_any f | select t | insert t | update F | delete t | truncate f
--     projects         | anon_has_any f | service_role_has_any f | select t | insert t | update t | delete t | truncate f
--     anon and service_role hold NOTHING on either table, and there is NO
--     update on versions.
select t.table_name,
       has_table_privilege('anon', 'public.' || t.table_name, 'select,insert,update,delete,truncate,references,trigger') as anon_has_any,
       has_table_privilege('service_role', 'public.' || t.table_name, 'select,insert,update,delete,truncate,references,trigger') as service_role_has_any,
       has_table_privilege('authenticated', 'public.' || t.table_name, 'select')   as auth_select,
       has_table_privilege('authenticated', 'public.' || t.table_name, 'insert')   as auth_insert,
       has_table_privilege('authenticated', 'public.' || t.table_name, 'update')   as auth_update,
       has_table_privilege('authenticated', 'public.' || t.table_name, 'delete')   as auth_delete,
       has_table_privilege('authenticated', 'public.' || t.table_name, 'truncate') as auth_truncate
  from (values ('projects'), ('project_versions')) as t(table_name)
 order by t.table_name;

-- (C) Policies: expect 9 rows. project_versions: _delete, _insert,
--     _require_aal (RESTRICTIVE), _select. projects: _delete, _insert,
--     _require_aal (RESTRICTIVE), _select, _update. No update policy on versions.
select tablename, policyname, permissive, cmd
  from pg_policies
 where schemaname = 'public' and tablename in ('projects', 'project_versions')
 order by tablename, policyname;

--     Triggers: expect 7 rows —
--       projects         | projects_guard_columns
--       projects         | projects_refuse_truncate
--       projects         | projects_stamp_insert
--       project_versions | project_versions_apply_head
--       project_versions | project_versions_prepare
--       project_versions | project_versions_refuse_change
--       project_versions | project_versions_refuse_truncate
select tgrelid::regclass as table_name, tgname as trigger_name
  from pg_trigger
 where not tgisinternal
   and tgrelid in ('public.projects'::regclass, 'public.project_versions'::regclass)
 order by 1, 2;

-- (D) Functions: expect 5 rows, anon_can_call f and auth_can_call t on every
--     one. security_definer is t for can_read_project and can_write_project,
--     f for create_project, rename_project and save_project_version.
select p.proname as function_name,
       p.prosecdef as security_definer,
       has_function_privilege('anon', p.oid, 'execute') as anon_can_call,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_can_call
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.proname in ('can_read_project', 'can_write_project', 'create_project', 'save_project_version', 'rename_project')
 order by p.proname;

-- (E) Stage 1 untouched, nothing saved yet. Expect companies, user_profiles,
--     memberships and invites to EQUAL the four numbers from pre-flight (c),
--     and projects = 0, project_versions = 0.
select (select count(*) from public.companies)     as companies,
       (select count(*) from public.user_profiles) as user_profiles,
       (select count(*) from public.memberships)   as memberships,
       (select count(*) from public.invites)       as invites,
       (select count(*) from public.projects)      as projects,
       (select count(*) from public.project_versions) as project_versions;

-- (F) The Stage 1 TRUNCATE check (spec, "Noticed while planning"). Read-only.
select t.table_name,
       has_table_privilege('authenticated', 'public.' || t.table_name, 'truncate') as authenticated_can_truncate
  from (values ('companies'), ('user_profiles'), ('memberships'), ('invites')) as t(table_name)
 order by t.table_name;
```

**About (F).** This is about **Stage 1's** tables, not 0006, and 0006 does not
change it. With Supabase's default privileges it is expected to show `t` on all
four (a local database with those defaults simulated does). It is **not** a
failure of 0006 and not an open hole — PostgREST never issues TRUNCATE — but
TRUNCATE bypasses RLS, so a `t` is what Step 4 fixes.

### Step 4 — run `0007` after `0006`, only if (F) showed `t`

- **If (F) showed `t` on any row:** open
  `migrations/0007_stage1_revoke_truncate.sql`, paste the whole file, and run
  it. Expect "Success. No rows returned." It takes TRUNCATE, REFERENCES and
  TRIGGER back from `authenticated` on the four Stage 1 tables and touches
  nothing else. The editor may ask you to confirm because it contains `revoke`;
  that is expected.
- **If (F) showed `f` on all four:** skip 0007. (Running it anyway is harmless.)

Then confirm (read-only):

```sql
-- (G) Expect 4 rows — companies, invites, memberships, user_profiles — each:
--     auth_select t | auth_insert t | auth_update t | auth_delete t |
--     auth_truncate f | auth_references f | auth_trigger f
--     The first four MUST still be t: if any is f, stop and report it, because
--     the app's sign-in and switcher need them.
select t.table_name,
       has_table_privilege('authenticated', 'public.' || t.table_name, 'select')     as auth_select,
       has_table_privilege('authenticated', 'public.' || t.table_name, 'insert')     as auth_insert,
       has_table_privilege('authenticated', 'public.' || t.table_name, 'update')     as auth_update,
       has_table_privilege('authenticated', 'public.' || t.table_name, 'delete')     as auth_delete,
       has_table_privilege('authenticated', 'public.' || t.table_name, 'truncate')   as auth_truncate,
       has_table_privilege('authenticated', 'public.' || t.table_name, 'references') as auth_references,
       has_table_privilege('authenticated', 'public.' || t.table_name, 'trigger')    as auth_trigger
  from (values ('companies'), ('user_profiles'), ('memberships'), ('invites')) as t(table_name)
 order by t.table_name;
```

Do **not** run anything in `tests/` against this project.

## Deleting a person who has saved a version

**You can delete them from the dashboard as usual, and their saved work is
untouched.**

`project_versions.author_id` and `projects.created_by` are plain uuids with
**no foreign key** to `auth.users`. Deleting the account therefore changes
nothing in either table: each version keeps the author's uuid and, more
importantly, the **`author_name` snapshot** taken when it was saved, so the
version history still says who saved what. The project keeps its `created_by`.

Why no foreign key: the natural `on delete set null` turns an account deletion
into UPDATEs of those rows, and both are refused on purpose — versions are
append-only, and a project's creator is immutable. With the foreign keys, the
deletion aborted for anyone who had ever created a project. A dangling uuid is
harmless: nothing grants access by `author_id` or `created_by`; access comes
from memberships.

Two things still apply:

- **The Stage 1 rule above is unchanged.** You still cannot delete someone who
  is the sole admin of a company (see "Deleting a person from the Supabase
  dashboard").
- **You also cannot delete someone who founded a company.** This is Stage 1
  behaviour, not Stage 2: `companies.created_by` references `auth.users` with
  `on delete set null`, and Stage 1's guard refuses changing a company's
  creator, so the deletion aborts with `42501: a company's creator cannot be
  changed`. Found in the 2A review; recorded as a spec Open Item. Ordinary
  savers and people who only issued invites delete fine.
- **Deleting an account is not how leavers are normally handled.** Decision 6:
  remove their memberships. They lose access on the next request and their name
  stays on their versions either way.

Asserted in `tests/stage2_rls.test.sql`: an account that created a project and
authored versions is deleted with no operator opt-in, and the versions (author
uuid, name snapshot, time, document) and the project are byte-identical
afterwards.

## Verifying locally

Against a throwaway local PostgreSQL (17.4 was used), never the project:

```sh
createdb stage2_local
psql -d stage2_local -v ON_ERROR_STOP=1 -f supabase/tests/local_shim.sql
for f in supabase/migrations/000*.sql; do psql -d stage2_local -v ON_ERROR_STOP=1 -f "$f"; done
psql -d stage2_local -v ON_ERROR_STOP=1 -f supabase/tests/stage1_rls.test.sql   # must still pass
psql -d stage2_local -v ON_ERROR_STOP=1 -f supabase/tests/stage2_rls.test.sql
PGDATABASE=stage2_local bash supabase/tests/stage2_concurrency.test.sh
```

Each prints `… ALL ASSERTIONS PASSED` or stops at the first `FAIL:`.
`local_shim.sql` now also reproduces Supabase's default privileges (broad grants
to `anon`, `authenticated` and `service_role` on everything created in
`public`), so the grant assertions only pass if the migration's revokes are
real. The migrations glob picks up 0007 too, so Stage 1's suite is checked with
0007 applied. It is local-only, like everything in `tests/`.

## Stage 2 verification status

**Applied to the live project 2026-09-14.** Tommy ran pre-flight (a)–(d)
(`true,true` / `null,null,0` / 4 companies, 1 profile, 1 membership,
0 invites / `true`), then `0006` ("Success. No rows returned."), then
post-flight (A)–(F), every result matching the expected output above: 9
policies, 7 triggers, 5 functions, Stage 1 counts unchanged, 0 projects and 0
versions, (F) `t` on all four tables. Then `0007` ("Success"), and (G) showed
all four Stage 1 tables `t t t t f f f`. **Still not verified on live: any
actual save.** That arrives with 2B, and is tested as an ordinary member.

Local verification, before the paste:

Run on PostgreSQL 17.4 from a fresh data directory, in this order: shim,
0001–0007, `stage1_rls.test.sql` (still passes, with 0006 and 0007 applied),
`stage2_rls.test.sql`, and the concurrency script — all pass. Every rule is
exercised as an ordinary member (bob, Building Integrity) and as an ordinary
member of a second company (frank, Rare Forms), plus a member of both
companies, a non-consortium member, a Seed member, a company admin and a
platform admin.

Each of these eleven mutations makes the suite fail, on the assertion that
names what it broke:

| # | Mutation | Fails on |
|---|---|---|
| 1 | RLS disabled on `project_versions` | "frank sees 0 Building Integrity versions, even naming their ids" |
| 2 | `can_read_project` returns true | "frank sees 0 Building Integrity versions, even naming their ids" |
| 3 | append-only trigger dropped | "even an operator on a direct connection cannot update a version" |
| 4 | `author_name` snapshot dropped | "author_name is snapshotted from the caller's display name" |
| 5 | project-row lock removed | the concurrency script: the second save is lost to a duplicate-key error instead of landing as the next version (the RLS suite alone still passes — it has one connection) |
| 6 | two-factor restrictive policy dropped from `project_versions` | "and 0 versions" (bob with a verified factor at aal1) |
| 7 | `grant all` on both tables back to `anon` and `authenticated` | "authenticated holds no UPDATE privilege on project_versions" |
| 8 | version `created_at := now()` stamp removed | "a spoofed created_at is overwritten with now()" |
| 9 | the `company_id` move check in `projects_guard_columns` disabled | "a member of two companies cannot move a project between them" |
| 10 | TRUNCATE guard dropped from `project_versions` | "even an operator cannot TRUNCATE project_versions" |
| 11 | `projects_stamp_insert` dropped | "a spoofed created_at on a direct projects insert is overwritten with now()" |

Also checked against a database shaped like live (Stage 1 migrations, seed, a
platform admin, a membership, an invite):

- **0006:** a copy broken just before `commit;` leaves nothing behind; the real
  run leaves every Stage 1 function, policy, trigger, grant, column and row
  byte-identical; a second run leaves the whole schema identical; post-flight
  (A)–(F) return exactly what Step 3 says, (F) showing `t` on all four tables.
- **0007:** a broken copy leaves the whole schema identical (TRUNCATE still
  held); the real run removes exactly TRUNCATE, REFERENCES and TRIGGER from
  `authenticated` on the four Stage 1 tables — select/insert/update/delete,
  `anon` and every function, policy, trigger, column and row unchanged; a
  second run leaves the whole schema identical; (G) returns exactly what Step 4
  says.

**Not run against Tommy's Supabase project.** Only the post-flight queries
confirm the hosted result.
