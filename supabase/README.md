# Supabase — Stage 1 (accounts and companies)

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
| `seed.sql` | The four real companies. |
| `tests/stage1_rls.test.sql` | The verification script. Run it. |
| `tests/local_shim.sql` | Local-only stand-in for Supabase's `auth` schema. Never run on the project. |

Stage 2's `projects` and `project_versions`, Stage 3's `collaborators` and
`collab_requests` are **not** here and must not be added until those stages.

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
   select id, email from auth.users where email = 'tommy.fieser@gmail.com';
   select id, email from public.user_profiles where email = 'tommy.fieser@gmail.com';

   -- (c) Does any account have a NULL email? public.user_profiles.email is NOT
   --     NULL, but auth.users.email is nullable on Supabase — phone signups,
   --     anonymous sessions, some SSO providers. 0001 backfills profiles by
   --     selecting that column straight across, so ONE such account aborts the
   --     whole migration with 23502 (not-null violation) and 0001 does not
   --     apply. Expect 0.
   select count(*) from auth.users where email is null;
   ```

   One row from each of (a) and (b), with matching ids, and zero from (c),
   before you go on.

   **If (c) is not zero**, decide what those accounts are before running `0001`.
   If they are junk (a test phone signup, an abandoned anonymous session),
   delete them. If they are real, the profile row needs an email that
   `auth.users` does not have, which is a decision about what identity means
   here rather than a line of SQL — ask before inventing a placeholder address.
5. Make yourself the platform admin. There is no self-service path to this and
   deliberately isn't one: a trigger refuses any change to the flag from anyone
   who is not already a platform admin, and at this point nobody is. So the
   first one is set from the SQL editor, with the operator opt-in that
   `is_privileged_caller()` looks for.

   You need an account first, which means an invite, which means a company
   admin — so bootstrap in this order:

   ```sql
   -- a) Create your auth user through the Supabase dashboard
   --    (Authentication → Users → Add user). That fires the trigger that
   --    creates your profile row.
   --
   -- b) Then, in the SQL editor, as one transaction:
   begin;
   set local app.operator = 'on';

   insert into public.memberships (user_id, company_id, level)
   select u.id, c.id, 'admin'
     from auth.users u, public.companies c
    where u.email = 'tommy.fieser@gmail.com'
      and c.name = 'Building Integrity';

   update public.user_profiles set is_platform_admin = true
    where email = 'tommy.fieser@gmail.com';

   commit;
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
