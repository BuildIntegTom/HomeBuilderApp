#!/usr/bin/env bash
# Stage 2 — concurrent saves on one project (migration 0006).
#
# LOCAL THROWAWAY DATABASE ONLY. NEVER THE LIVE PROJECT.
#
# Why this is a separate script and not part of stage2_rls.test.sql: the RLS
# suite is one transaction that rolls back, and a concurrent save needs TWO
# connections that can each see committed rows. So this script COMMITS
# fixtures, into a database it refuses to touch if anyone is in it, and deletes
# them again at the end.
#
# What it proves: prepare_project_version's `for update` lock on the project
# row serialises two saves that race. Session A saves and holds its
# transaction open; session B saves from the same base meanwhile. With the lock,
# B waits, then lands as the NEXT version with diverged = true. Without it, B
# numbers itself from the stale head and dies on the unique index (23505) —
# a lost save, which is exactly what decision 11 says must not happen.
#
# Usage (the psql connection comes from the usual PG* environment variables):
#   PGHOST=localhost PGPORT=54329 PGUSER=postgres PGDATABASE=stage2_concurrency \
#     PSQL=/path/to/psql bash supabase/tests/stage2_concurrency.test.sh
#
# The database must already have local_shim.sql and 0001–0006 applied.

set -u
PSQL="${PSQL:-psql}"
Q() { "$PSQL" -X -q -At -v ON_ERROR_STOP=1 "$@"; }
fail() { echo "FAIL: $*" >&2; cleanup; exit 1; }

BI='11111111-0000-0000-0000-00000000c001'
ALICE='aaaaaaaa-0000-0000-0000-00000000c001'
BOB='bbbbbbbb-0000-0000-0000-00000000c001'
TMP="$(mktemp -d)"

cleanup() {
  Q <<SQL >/dev/null 2>&1
begin;
set local app.operator = 'on';
-- A platform-admin-equivalent cascade: the operator is privileged and the
-- version rows go at trigger depth 2, which is the one path allowed to remove
-- them. Exercising it here is deliberate.
delete from public.projects where company_id = '$BI';
delete from public.memberships where company_id = '$BI';
delete from public.companies where id = '$BI';
commit;
-- auth.users can only go once no version names them, which after the cascade
-- above is true.
begin;
set local app.operator = 'on';
delete from auth.users where id in ('$ALICE', '$BOB');
commit;
SQL
  rm -rf "$TMP"
}

# --- refuse to run anywhere that has people or projects ---------------------
if [ "$(Q -c "select exists (select 1 from public.memberships) or exists (select 1 from public.projects)")" != "f" ]; then
  echo "stage2_concurrency.test.sh refuses to run here: this database has memberships or projects. Use a throwaway local database. Never the live project." >&2
  exit 1
fi

# --- committed fixtures ------------------------------------------------------
Q <<SQL >/dev/null || fail "fixtures"
begin;
set local app.operator = 'on';
insert into auth.users (id, email) values ('$ALICE', 'alice@race.test'), ('$BOB', 'bob@race.test');
insert into public.companies (id, name, is_seed_member) values ('$BI', 'Race Co', true);
insert into public.memberships (user_id, company_id, level) values
  ('$ALICE', '$BI', 'admin'), ('$BOB', '$BI', 'member');
commit;
SQL

ACT() { # $1 = user id
  # Plain SETs print nothing, so stdout carries only the result being parsed.
  echo "set role authenticated;"
  echo "set request.jwt.claims = '{\"sub\":\"$1\",\"role\":\"authenticated\",\"aal\":\"aal1\"}';"
}
DOC='{"schemaVersion":24,"savedAt":"2026-09-13T12:00:00.000Z","state":{"projectName":"Race House","priceModifier":1.3}}'

CREATED="$( { ACT "$BOB"; echo "select project_id || ' ' || version_id from public.create_project('$BI', 'current', '$DOC'::jsonb, null);"; } | Q )" \
  || fail "bob could not create the project"
PROJECT="${CREATED%% *}"
V1="${CREATED##* }"

# --- the race ----------------------------------------------------------------
# A: save from v1, then hold the transaction (and its lock) open for 4 s.
{
  ACT "$BOB"
  echo "begin;"
  echo "select version_number || ' ' || diverged || ' ' || head_before from public.save_project_version('$PROJECT', '$V1', '$DOC'::jsonb, 'A');"
  echo "do \$\$ begin perform pg_sleep(4); end \$\$;"
  echo "commit;"
} | Q >"$TMP/a.out" 2>"$TMP/a.err" &
A_PID=$!

sleep 1.5

# B: save from the same v1 while A is still open. Time how long it waited.
B_START=$(date +%s)
{
  ACT "$ALICE"
  echo "select version_number || ' ' || diverged || ' ' || head_before from public.save_project_version('$PROJECT', '$V1', '$DOC'::jsonb, 'B');"
} | Q >"$TMP/b.out" 2>"$TMP/b.err"
B_STATUS=$?
B_WAITED=$(( $(date +%s) - B_START ))

wait "$A_PID"
A_STATUS=$?

A_RESULT="$(tr -d '\r' <"$TMP/a.out")"
B_RESULT="$(tr -d '\r' <"$TMP/b.out")"

[ "$A_STATUS" -eq 0 ] || fail "session A's save failed: $(cat "$TMP/a.err")"
[ "$B_STATUS" -eq 0 ] || fail "session B's concurrent save was LOST — it failed instead of landing as the next version: $(cat "$TMP/b.err")"
[ "$A_RESULT" = "2 false 1" ] || fail "session A should be v2, not diverged, head_before 1; got '$A_RESULT'"
[ "$B_RESULT" = "3 true 2" ] || fail "session B should wait, then be v3, diverged, head_before 2; got '$B_RESULT'"
[ "$B_WAITED" -ge 2 ] || fail "session B returned after ${B_WAITED}s; it should have waited for A's lock"

FINAL="$(Q -c "select head_version_number || ' ' || (select count(*) from public.project_versions where project_id = '$PROJECT') || ' ' || (select count(distinct version_number) from public.project_versions where project_id = '$PROJECT') from public.projects where id = '$PROJECT'")"
[ "$FINAL" = "3 3 3" ] || fail "expected head 3 with 3 distinct versions kept; got '$FINAL'"

cleanup
LEFT="$(Q -c "select (select count(*) from public.projects) + (select count(*) from public.memberships) + (select count(*) from auth.users where id in ('$ALICE','$BOB'))")"
[ "$LEFT" = "0" ] || { echo "FAIL: cleanup left $LEFT rows behind" >&2; exit 1; }

echo "stage2_concurrency: ALL ASSERTIONS PASSED (B waited ${B_WAITED}s, landed as v3, diverged)"
