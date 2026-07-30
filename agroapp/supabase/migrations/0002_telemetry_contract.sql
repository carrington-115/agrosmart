-- SPDX-License-Identifier: MIT
-- AgroSmart 0002 — bring the schema up to firmware wire contract v1.
--
-- 0001 was designed against lib/types.ts, which predates the firmware. The
-- device actually sends a nested, versioned envelope (see
-- agrosensor/lib/Telemetry/Payload.cpp and
-- agrosensor/docs/integration/dashboard-contract.md) that this schema has
-- nowhere to put: two distinct pH readings, a mandatory quality block, and
-- diagnostics.
--
-- The reasoning, not just the what:
--
--   * phSoil and phWater are different physical quantities in different media
--     (soil probe, 3-9 device range, +/-0.3 -- vs calibrated, temperature-
--     compensated water board). Merging them destroys information that cannot
--     be recovered, so they get separate columns.
--
--   * quality.* become three real booleans rather than jsonb, because they gate
--     logic: soilDry must NOT raise a fault, and npkEstimated must suppress
--     fertiliser advice. They are queried and constrained, not spelunked.
--
--   * diag.* is device STATE, not a time series -- only ever read as "current".
--     It lands on `sensors` instead of writing fw:"0.1.0" 1440 times a day.
--
--   * `raw` keeps the validated envelope verbatim. At ~400 B compressed against
--     1440 rows/day/node this is the difference between "add a column and
--     backfill" and "that data is gone" the next time the schema moves.
--
-- NOTE: adding a STORED generated column rewrites sensor_readings under
-- ACCESS EXCLUSIVE. Irrelevant at current volume; relevant if this is ever
-- replayed against a large table.

-- ---------------------------------------------------------------- enums

-- Distinguishes a trustworthy device clock from an arrival stamp. Without this,
-- a buffered replay is indistinguishable from live data.
create type public.reading_time_source as enum ('device', 'server');

-- ---------------------------------------------------------------- readings

alter table public.sensor_readings
  add column ph_soil            numeric(4, 2),
  add column ph_water           numeric(4, 2),
  add column water_temperature  numeric(6, 2),
  add column water_level        numeric(6, 2),

  -- Always present per the contract, but nullable here so the check constraint
  -- below is the single guarantee. Backfilling a default onto legacy rows would
  -- assert something about them that is not known.
  add column npk_estimated      boolean,
  add column stabilising        boolean,
  add column soil_dry           boolean,

  add column payload_version    smallint    not null default 1,

  -- Two timestamps, and they are not redundant. `recorded_at` is when the soil
  -- was measured; `received_at` is when it reached us. Both are needed to tell
  -- a replay from live data, and to compute liveness at all.
  add column received_at        timestamptz not null default now(),
  add column recorded_at_source public.reading_time_source not null default 'server',

  -- Device-generated idempotency key, persisted in the device's LittleFS record
  -- so a replayed reading carries the same value. Deliberately NOT derived from
  -- a timestamp: `ts` is omitted until NTP syncs, so any time-based key fails
  -- in exactly the retry case it exists for.
  add column reading_uid        text,

  add column raw                jsonb;

-- Legacy rows came from the flat Next.js ingest route, whose `ph` was the soil
-- probe reading.
update public.sensor_readings set ph_soil = ph where ph is not null;

-- `ph` returns as a STORED generated column rather than being dropped, and the
-- asymmetry is the entire point:
--
--   * READS keep working. lib/queries.ts, toSensorView and table-columns.tsx
--     all read `ph`, so the dashboard stays up and the frontend port becomes an
--     unhurried follow-up rather than a lockstep deploy across two repos.
--
--   * WRITES fail hard. `insert into sensor_readings (ph) ...` now errors with
--     "cannot insert a non-DEFAULT value into column", so the OLD ingest route
--     -- which always sends `ph: metrics.ph ?? null` -- dies loudly and
--     immediately rather than silently writing to a column nobody reads.
--
-- That is the retirement order we want. `ph` is dropped for real in a later
-- migration, once Sensor.ph is gone from lib/types.ts.
alter table public.sensor_readings drop column ph;
alter table public.sensor_readings
  add column ph numeric(4, 2)
  generated always as (coalesce(ph_soil, ph_water)) stored;

-- The contract calls the quality block load-bearing and always present. Enforce
-- all-three-or-none so a half-populated block can never be read as `false` --
-- the same "absence must not look like a value" rule the readings follow.
alter table public.sensor_readings
  add constraint sensor_readings_quality_complete check (
    (npk_estimated is null     and stabilising is null     and soil_dry is null) or
    (npk_estimated is not null and stabilising is not null and soil_dry is not null)
  );

-- Idempotency. Partial so pre-existing rows, which have no uid, are unaffected.
create unique index sensor_readings_uid_uniq
  on public.sensor_readings (sensor_id, reading_uid)
  where reading_uid is not null;

-- Secondary net: dedupe replays that DO carry a trustworthy device clock.
-- Scoped to 'device' so server-stamped rows -- which share a transaction
-- timestamp within a batch -- are not falsely rejected.
create unique index sensor_readings_device_ts_uniq
  on public.sensor_readings (sensor_id, recorded_at)
  where recorded_at_source = 'device';

create index sensor_readings_sensor_received_idx
  on public.sensor_readings (sensor_id, received_at desc);

-- ---------------------------------------------------------------- device state

-- `status` could never express 'offline' because nothing recorded liveness: a
-- device that stops reporting never calls the endpoint again. last_seen_at is
-- the missing primitive.
--
-- last_seen_at tracks ARRIVAL -- a device replaying week-old data is online.
-- last_reading_at tracks the newest reading, and guards status/rssi so a
-- replayed stale warning cannot clobber a currently-normal sensor.
alter table public.sensors
  add column last_seen_at        timestamptz,
  add column last_reading_at     timestamptz,
  add column last_rssi           smallint,
  add column last_uptime_seconds bigint,
  add column firmware_version    text;

-- ---------------------------------------------------------------- device tokens

-- Per-device credentials, replacing the single global SENSOR_INGEST_KEY. One
-- shared key means a single compromised node burns every node, and a reading
-- can only be attributed to a device by trusting the sensorId in its own body.
--
-- A separate table rather than a column on `sensors` because rotation needs two
-- valid tokens at once: mint the new one, flash the device, then revoke the old.
--
-- Token format: ags_v1_<token_id>_<secret>
--   token_id is public and indexed, so identifying the device is an O(1) unique
--   lookup on a non-secret -- no candidate iteration, hence no timing channel
--   that could leak which devices exist. Only the secret comparison needs to be
--   constant-time.
create table public.device_tokens (
  id           uuid primary key default gen_random_uuid(),
  sensor_id    uuid not null references public.sensors (id) on delete cascade,

  token_id     text not null unique,

  -- hmac_sha256(pepper, token_id || ':' || secret). Not argon2: this is a
  -- 256-bit CSPRNG machine credential presented every 60 s per device, not a
  -- human-chosen password. A slow KDF buys nothing against an unguessable
  -- secret, burns CPU on the hot path, and hands an unauthenticated caller a
  -- memory-amplification DoS. The pepper lives in the environment, so a leaked
  -- database dump alone does not yield usable tokens. Binding token_id into the
  -- input prevents transplanting a hash between rows.
  secret_hash  bytea not null,

  label        text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at   timestamptz,
  -- Soft delete: preserves the audit trail of what was revoked and when.
  revoked_at   timestamptz
);

create index device_tokens_sensor_idx
  on public.device_tokens (sensor_id)
  where revoked_at is null;

-- RLS enabled with ZERO policies is deny-all for anon and authenticated.
-- Credentials are never readable through a user-scoped connection, not even by
-- their owner. Token administration runs on the service connection with an
-- explicit owner filter -- the one place where bypassing RLS is correct rather
-- than a shortcut.
alter table public.device_tokens enable row level security;
