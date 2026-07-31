#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
#
# Bring the throwaway integration database up to the current schema.
#
#   docker compose --profile test up -d db
#   bash agroapi/scripts/setup_test_db.sh
#
# The migrations live in the frontend workspace because the Supabase CLI is the
# only applier (see CLAUDE.md). They are applied here with psql because this
# database is disposable and the CLI would want a linked project.
#
# 0001 references auth.users and auth.uid(), which exist only on a real Supabase
# instance, so the schema, the function and the two roles are stubbed first. If
# this stub drifts from what Supabase actually provides, the integration suite is
# testing a fiction — worth remembering when a test passes here and fails against
# staging. CI runs the same statements inline in .github/workflows/agroapi.yml;
# that duplication is deliberate, since the workflow cannot depend on a file in
# the tree it is testing being executable.
#
# Uses a local psql when there is one and otherwise runs psql inside the compose
# container. That fallback is not a nicety: the Postgres client is not installed
# by default on Windows or macOS, and requiring it would mean the integration
# suite is only runnable by contributors who happened to have it already.
#
# Re-runnable: drops and recreates the public schema, so a half-applied migration
# from an interrupted run cannot leave the database in a state where the next run
# fails for the wrong reason.

set -euo pipefail

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-55432}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-agrosmart_test}"
PGPASSWORD="${PGPASSWORD:-postgres}"
export PGPASSWORD

# Compose names it <project>-<service>-<index>; the project is pinned to
# `agrosmart` at the top of docker-compose.yml.
DB_CONTAINER="${AGRO_TEST_DB_CONTAINER:-agrosmart-db-1}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS="$HERE/../../agroapp/supabase/migrations"

# Every invocation feeds SQL on stdin rather than with -f, so the same function
# works whether psql can see the host filesystem or is running in a container.
if command -v psql >/dev/null 2>&1; then
  echo "==> using local psql against $PGHOST:$PGPORT/$PGDATABASE"
  psql_run() {
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 -q
  }
else
  if ! docker inspect "$DB_CONTAINER" >/dev/null 2>&1; then
    echo "error: no local psql and no container named '$DB_CONTAINER'." >&2
    echo "       Start it with: docker compose --profile test up -d db" >&2
    echo "       Or set AGRO_TEST_DB_CONTAINER to the right name." >&2
    exit 1
  fi
  echo "==> no local psql; using psql inside $DB_CONTAINER"
  psql_run() {
    docker exec -i -e PGPASSWORD="$PGPASSWORD" "$DB_CONTAINER" \
      psql -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 -q
  }
fi

echo "==> resetting public schema"
psql_run <<'SQL'
drop schema if exists public cascade;
create schema public;
drop schema if exists auth cascade;
SQL

echo "==> stubbing auth.users, auth.uid() and the Supabase roles"
psql_run <<'SQL'
create extension if not exists pgcrypto;

create schema auth;

create table auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- Reproduced from Supabase verbatim, INCLUDING the legacy singular GUC read
-- first. db/session.py blanks request.jwt.claim.sub precisely because that
-- coalesce order lets a stale value on a pooled backend win over the claims we
-- set; a stub that checked only request.jwt.claims would test a fiction and let
-- that bug through.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

-- `service_role` must hold BYPASSRLS and `authenticated` must not. That
-- asymmetry is the whole security model, not a detail of the stub:
--
--   * db/session.py:service_scope SET ROLEs to service_role for ingest and token
--     administration. Without BYPASSRLS the policies stay in force, auth.uid()
--     is null, and every query silently returns zero rows — which looks exactly
--     like "the sensor is not registered".
--   * authenticated deliberately stays subject to RLS. Granting it BYPASSRLS
--     here would make every cross-tenant isolation test pass for the wrong
--     reason, which is worse than not having the tests.
--
-- Supabase provisions both roles this way; a stub that got it backwards would be
-- testing a fiction.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role bypassrls;
  else
    alter role service_role bypassrls;
  end if;
end $$;
SQL

for f in "$MIGRATIONS"/*.sql; do
  echo "==> applying $(basename "$f")"
  psql_run < "$f"
done

# Two owners, not one. Cross-tenant isolation is asserted per endpoint, and that
# assertion needs a second tenant to try to reach — a single-owner fixture makes
# the test vacuous.
#
# AGS-001 is the identity the firmware actually ships with
# (agrosensor/include/config.h:23), so the simulator can post the fixtures
# unmodified.
echo "==> registering test owners and sensors"
psql_run <<'SQL'
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'owner-a@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'owner-b@example.test');

insert into public.farms (id, owner_id, farm_name) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001', 'Test Farm A'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000002', 'Test Farm B');

insert into public.sensors (owner_id, farm_id, sensor_code, sensor_tag) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'AGS-001', 'field-a1'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', 'AGS-002', 'field-b1');
SQL

# db/session.py reaches the tables by SET ROLE-ing to authenticated or
# service_role. Grant those two what the migrations grant them on Supabase but
# that a bare Postgres has not.
echo "==> granting table privileges to the stubbed roles"
psql_run <<'SQL'
grant usage on schema public to authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;
SQL

echo
echo "Ready. Point the backend at it with:"
echo "  AGRO_DATABASE_URL=postgresql://$PGUSER:$PGPASSWORD@$PGHOST:$PGPORT/$PGDATABASE"
