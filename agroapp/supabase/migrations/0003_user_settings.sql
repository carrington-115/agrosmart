-- SPDX-License-Identifier: MIT
-- AgroSmart 0003 — persist the notification and reporting preferences.
--
-- The settings page renders three groups of checkboxes (sensor pairing methods,
-- report cadence, alert delivery) from a hardcoded array in
-- `app/dashboard/settings/page.tsx`. Nothing stored them, so every box reset on
-- reload and none of them affected behaviour. The SRS lists report cadence and
-- alert delivery as requirements, and neither is expressible without somewhere
-- to keep them.
--
-- Design notes, not just the what:
--
--   * One row per user, keyed on the auth user like `profiles`, rather than a
--     row per preference. These are a fixed, small set read together on every
--     settings render; a key/value table would turn one lookup into a join and
--     invite typo'd keys that no constraint could catch.
--
--   * Real boolean columns rather than jsonb, for the same reason 0002 gave the
--     quality flags real columns: they gate behaviour and will be queried by
--     whatever eventually sends the emails and SMS. `where alert_email` is a
--     query; `where prefs->>'alert_email' = 'true'` is a spelunk.
--
--   * Defaults match the checked state the design shows, so an existing user who
--     never opens the page behaves as the mockup implies rather than silently
--     having everything switched off.
--
-- This adds a table and touches no existing one, so
-- `agroapi/src/agroapi/db/pool.py:check_schema` — which asserts only the columns
-- the ingest writer writes — is unaffected.

create table public.user_settings (
  owner_id uuid primary key references auth.users (id) on delete cascade,

  -- Sensor pairing methods offered in the "Add sensor" dialog.
  pair_by_id       boolean not null default true,
  pair_by_qr       boolean not null default true,

  -- Reporting cadence.
  reports_weekly   boolean not null default true,
  reports_monthly  boolean not null default true,
  reports_email    boolean not null default false,

  -- Alert delivery.
  alerts_dashboard boolean not null default true,
  alerts_popup     boolean not null default true,
  alerts_email     boolean not null default false,
  alerts_sms       boolean not null default false,
  -- Housekeeping for alerts the user chose to ignore.
  alerts_delete_ignored_after_days smallint not null default 14
    constraint user_settings_ignored_days_sane check (
      alerts_delete_ignored_after_days between 0 and 365
    ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- RLS

alter table public.user_settings enable row level security;

-- Owner-scoped on every verb, matching the shape 0001 uses for farms, sensors
-- and alerts. A user's preferences are readable and writable only by that user.
create policy "user settings are owner-scoped"
  on public.user_settings for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
