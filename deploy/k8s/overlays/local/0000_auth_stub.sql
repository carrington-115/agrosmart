-- SPDX-License-Identifier: MIT
--
-- Stand-in for the parts of Supabase that a plain Postgres does not have.
--
-- The filename must sort BEFORE 0001_init.sql under C collation, which is what
-- the alpine container's sort uses. It was `00_auth_stub.sql` and that was a
-- bug: byte-wise `_` (0x5F) is greater than any digit, so 0001 ran first and
-- died on the missing auth.users. It looked correct on a dev machine, where
-- locale-aware sort ignores the underscore and orders it first — the two
-- disagreed, and only the container's opinion counted.
--
-- 0001_init.sql references auth.users and auth.uid(), which only exist on a real
-- Supabase instance. Without them the migrations cannot be applied to a throwaway
-- database and the deploy layer could not be tested at all.
--
-- This is BYTE-FOR-BYTE the same stub inlined in .github/workflows/agroapi.yml.
-- Keeping them identical is deliberate: if this fiction drifts from what Supabase
-- actually provides, local and CI are wrong together rather than differently,
-- which is far easier to notice and fix than two divergent fictions.
--
-- The auth.uid() body in particular must keep matching Supabase's, because the
-- coalesce order — legacy singular GUC first — is what db/session.py blanks
-- request.jwt.claim.sub to defend against.

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create or replace function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
-- service_role must hold BYPASSRLS and authenticated must not. That asymmetry is
-- the security model: db/session.py:service_scope SET ROLEs to service_role for
-- ingest, and without BYPASSRLS the policies stay in force, auth.uid() is null,
-- and every query silently returns zero rows. Granting authenticated the same
-- would make the cross-tenant isolation tests pass for the wrong reason.
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

-- BYPASSRLS skips POLICIES; it does not grant table PRIVILEGES. Both are needed,
-- and Supabase gives both — without the grants below, SET ROLE service_role then
-- touching any table fails with "permission denied for table sensors", which
-- reads like an RLS problem and is not one.
--
-- ALTER DEFAULT PRIVILEGES rather than GRANT ON ALL TABLES because this stub runs
-- BEFORE the migrations: there are no tables yet, so a plain grant would silently
-- apply to nothing.
grant usage on schema public to authenticated, service_role;
alter default privileges in schema public
  grant all on tables to authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to authenticated, service_role;
