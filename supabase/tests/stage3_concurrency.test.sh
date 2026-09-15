#!/usr/bin/env bash
# Stage 3 — two people sharing one project with the same grantee at once
# (migration 0008).
#
# LOCAL THROWAWAY DATABASE ONLY. NEVER THE LIVE PROJECT.
#
# Why a separate script: the RLS suite is one transaction that rolls back, and
# a race needs TWO connections that can each see committed rows. So this
# script COMMITS fixtures, into a database it refuses to touch if anyone is in
# it, and deletes them again at the end. Same shape as
# stage2_concurrency.test.sh.
#
# What it proves: share_project_with_person and share_project_with_company
# write with `on conflict do nothing` and read the grant back in a later
# statement. Session A shares and holds its transaction open; session B shares
# the same project with the same grantee meanwhile. B must wait, then answer
# `already-shared` naming A's grant — one row, A's granted_by. Without the
# `on conflict`, B's insert dies on the unique index (23505): a sharer told
# "error" for a share that in fact exists.
#
# Usage (the psql connection comes from the usual PG* environment variables):
#   PGHOST=localhost PGPORT=54360 PGUSER=postgres PGDATABASE=stage3_concurrency \
#     PSQL=/path/to/psql bash supabase/tests/stage3_concurrency.test.sh
#
# The database must already have local_shim.sql and 0001–0008 applied.

set -u
PSQL="${PSQL:-psql}"
Q() { "$PSQL" -X -q -At -v ON_ERROR_STOP=1 "$@"; }
fail() { echo "FAIL: $*" >&2; cleanup; exit 1; }

BI='11111111-0000-0000-0000-00000000c301'
RF='22222222-0000-0000-0000-00000000c301'
ALICE='aaaaaaaa-0000-0000-0000-00000000c301'
BOB='bbbbbbbb-0000-0000-0000-00000000c301'
FRANK='f1f1f1f1-0000-0000-0000-00000000c301'
TMP="$(mktemp -d)"

cleanup() {
  Q <<SQL >/dev/null 2>&1
begin;
set local app.operator = 'on';
-- A privileged whole-project delete: versions go at trigger depth 2 and the
-- grants by FK cascade.
delete from public.projects where company_id = '$BI';
delete from public.memberships where company_id in ('$BI', '$RF');
delete from public.companies where id in ('$BI', '$RF');
commit;
begin;
set local app.operator = 'on';
delete from auth.users where id in ('$ALICE', '$BOB', '$FRANK');
commit;
SQL
  rm -rf "$TMP"
}

# --- refuse to run anywhere that has people, projects or grants --------------
if [ "$(Q -c "select exists (select 1 from public.memberships) or exists (select 1 from public.projects) or exists (select 1 from public.collaborators)")" != "f" ]; then
  echo "stage3_concurrency.test.sh refuses to run here: this database has memberships, projects or grants. Use a throwaway local database. Never the live project." >&2
  exit 1
fi

# --- committed fixtures ------------------------------------------------------
Q <<SQL >/dev/null || fail "fixtures"
begin;
set local app.operator = 'on';
insert into auth.users (id, email) values
  ('$ALICE', 'alice@race3.test'), ('$BOB', 'bob@race3.test'), ('$FRANK', 'frank@race3.test');
insert into public.companies (id, name, is_seed_member) values
  ('$BI', 'Race Co 3', true), ('$RF', 'Race Rare 3', true);
insert into public.memberships (user_id, company_id, level) values
  ('$ALICE', '$BI', 'admin'), ('$BOB', '$BI', 'member'), ('$FRANK', '$RF', 'member');
commit;
SQL

ACT() { # $1 = user id
  echo "set role authenticated;"
  echo "set request.jwt.claims = '{\"sub\":\"$1\",\"role\":\"authenticated\",\"aal\":\"aal1\"}';"
}
DOC='{"schemaVersion":24,"savedAt":"2026-09-14T12:00:00.000Z","state":{"projectName":"Race Share House","priceModifier":1.3}}'

PROJECT="$( { ACT "$BOB"; echo "select project_id from public.create_project('$BI', 'current', '$DOC'::jsonb, null);"; } | Q )" \
  || fail "bob could not create the project"

# $1 = label, $2 = the share call (a select returning status and grant_id),
# $3 = SQL counting the grants that call can write
race() {
  local label="$1" call="$2" count_sql="$3"
  {
    ACT "$BOB"
    echo "begin;"
    echo "select status || ' ' || coalesce(grant_id::text, '-') from $call;"
    echo "do \$\$ begin perform pg_sleep(4); end \$\$;"
    echo "commit;"
  } | Q >"$TMP/a.out" 2>"$TMP/a.err" &
  local a_pid=$!

  sleep 1.5

  local b_start b_status b_waited a_status
  b_start=$(date +%s)
  {
    ACT "$ALICE"
    echo "select status || ' ' || coalesce(grant_id::text, '-') from $call;"
  } | Q >"$TMP/b.out" 2>"$TMP/b.err"
  b_status=$?
  b_waited=$(( $(date +%s) - b_start ))

  wait "$a_pid"
  a_status=$?

  local a_result b_result a_grant b_grant
  a_result="$(tr -d '\r' <"$TMP/a.out")"
  b_result="$(tr -d '\r' <"$TMP/b.out")"
  a_grant="${a_result##* }"
  b_grant="${b_result##* }"

  [ "$a_status" -eq 0 ] || fail "$label: session A's share failed: $(cat "$TMP/a.err")"
  [ "$b_status" -eq 0 ] || fail "$label: session B's concurrent share FAILED instead of answering already-shared: $(cat "$TMP/b.err")"
  [ "${a_result%% *}" = "shared" ] || fail "$label: session A should be 'shared'; got '$a_result'"
  [ "${b_result%% *}" = "already-shared" ] || fail "$label: session B should wait, then be 'already-shared'; got '$b_result'"
  [ "$a_grant" = "$b_grant" ] || fail "$label: B should name A's grant ($a_grant); got '$b_grant'"
  [ "$b_waited" -ge 2 ] || fail "$label: session B returned after ${b_waited}s; it should have waited for A's uncommitted grant"

  local rows
  rows="$(Q -c "$count_sql")"
  [ "$rows" = "1 $BOB" ] || fail "$label: expected exactly one grant, granted by bob (A); got '$rows'"
  echo "$label: B waited ${b_waited}s, answered already-shared with A's grant"
}

OUT1="$(race "person" \
  "public.share_project_with_person('$PROJECT', 'frank@race3.test')" \
  "select count(*) || ' ' || min(granted_by::text) from public.collaborators where project_id = '$PROJECT' and grantee_user_id = '$FRANK'")" || exit 1
OUT2="$(race "company" \
  "public.share_project_with_company('$PROJECT', '$RF')" \
  "select count(*) || ' ' || min(granted_by::text) from public.collaborators where project_id = '$PROJECT' and grantee_company_id = '$RF'")" || exit 1

cleanup
LEFT="$(Q -c "select (select count(*) from public.projects) + (select count(*) from public.memberships) + (select count(*) from public.collaborators) + (select count(*) from auth.users where id in ('$ALICE','$BOB','$FRANK'))")"
[ "$LEFT" = "0" ] || { echo "FAIL: cleanup left $LEFT rows behind" >&2; exit 1; }

echo "stage3_concurrency: ALL ASSERTIONS PASSED ($OUT1; $OUT2)"
