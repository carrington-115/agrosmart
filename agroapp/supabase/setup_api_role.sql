-- SPDX-License-Identifier: MIT
-- Creates the least-privilege login role the FastAPI backend connects as.
--
-- NOT a numbered migration, for two reasons: it contains a password, and it is
-- an environment/infrastructure concern rather than a schema change. Run it once
-- per Supabase project, by hand:
--
--   1. Generate a password:  openssl rand -base64 32
--   2. Replace CHANGE_ME below.
--   3. Paste into the Supabase SQL editor, or:
--        psql "$DATABASE_URL" -f supabase/setup_api_role.sql
--   4. Put the resulting connection string in the backend's AGRO_DATABASE_URL.
--
-- Do NOT commit a real password. This file is committed with the placeholder so
-- a fresh project knows what it needs.
--
--
-- Why not just connect as `postgres`?
--
-- `postgres` bypasses RLS by two independent mechanisms: it holds the BYPASSRLS
-- attribute, and it OWNS these tables (a table owner bypasses RLS unless FORCE
-- ROW LEVEL SECURITY is set). That would make one line of application code --
-- `set_config('role', 'authenticated', true)` -- the only thing standing between
-- a dashboard request and every tenant's rows. Worse, that call is a silent
-- no-op with a warning when it happens outside a transaction, rather than an
-- error.
--
-- `noinherit` is the load-bearing word below. Without an explicit SET ROLE,
-- agro_api holds no table privileges at all, so a forgotten scope call fails
-- with "permission denied for table sensors" on the first request in
-- development -- instead of quietly serving the wrong tenant in production.
-- Fail-closed, in the same spirit as the firmware's typed error enums.

-- Guarded so a re-run resets the password rather than failing on the role
-- already existing. Plain `create role` aborts the whole script at its first
-- statement, which on a project that has been half set up leaves the grants
-- below unapplied while the error names only the role -- and the grants are the
-- part that actually matters.
--
-- Matches the equivalent guards in agroapi/scripts/setup_test_db.sh and
-- deploy/k8s/overlays/local/0000_auth_stub.sql, which are re-runnable for the
-- same reason.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'agro_api') then
    alter role agro_api with login password 'CHANGE_ME' noinherit;
  else
    create role agro_api with login password 'CHANGE_ME' noinherit;
  end if;
end $$;

grant usage on schema public to agro_api;

-- Permits `set_config('role', 'authenticated', true)` for dashboard requests,
-- where the existing RLS policies in 0001_init.sql do the scoping.
grant authenticated to agro_api;

-- Permits the ingest and token-administration paths, which have no user session
-- and must therefore pass explicit owner filters of their own.
grant service_role to agro_api;
