-- SPDX-License-Identifier: MIT
-- Development seed: realistic telemetry, shaped exactly as a real node produces it.
--
--   psql "$DATABASE_URL" -f supabase/seed.sql
--
-- Sign up through /auth first — everything attaches to the FIRST user in
-- auth.users. Safe to re-run: sensors upsert on (owner_id, sensor_code), and
-- readings and alerts are cleared for the seeded sensors before reinserting.
--
-- ---------------------------------------------------------------------------
-- Why this file is shaped the way it is
--
-- The previous version seeded ten near-identical healthy sensors and eleven
-- alerts about camera traps, NDVI and battery level — none of which this system
-- measures. It was useful for looking at a populated page and useless for
-- knowing whether the page was correct.
--
-- Two changes matter most:
--
--   1. `sensors.last_seen_at` is now SET. Status is derived at read time from
--      that column (agroapi/domain/status.py:derive), because nothing writes
--      `offline` to `sensors.status` — a device that stops reporting never calls
--      ingest again to say so. A seed that leaves `last_seen_at` null makes every
--      sensor render `offline`, which looks like a broken dashboard rather than a
--      missing column.
--
--   2. Each sensor demonstrates ONE of the cases the contract calls out, because
--      those are what break consumers. A wall of healthy sensors proves the happy
--      path and nothing else:
--
--        AGS-001  full payload, everything healthy
--        AGS-002  soil probe only — no phWater/waterLevel/waterTemperature
--        AGS-003  dry soil: zero conductivity, zeroed NPK, NOT a fault
--        AGS-004  stabilising: inside the 5-minute settling window
--        AGS-005  no device clock — server-stamped arrival times
--        AGS-006  genuinely offline: last_seen_at hours ago
--        AGS-007  a real threshold breach (low moisture, high salinity)
--        AGS-008  registered but has never reported at all
--
-- `AGS-xxx` rather than `SENSOR-LKO-xxx`: agrosensor/include/config.h bakes in
-- `AGS-001`, so a real node posting to this database finds its own row.
--
-- `npk_estimated` is true throughout, because it is always true: the probe has no
-- chemistry isolating N, P or K and back-calculates all three from bulk
-- conductivity. Seeding it false would assert something untrue about this hardware
-- and would license fertiliser advice built on an estimate.
-- ---------------------------------------------------------------------------

do $$
declare
  v_owner   uuid;
  v_farm    uuid;
  v_sensor  uuid;
  v_row     record;
  v_i       int;
  v_at      timestamptz;
  v_seen    timestamptz;
  v_uid     text;
begin
  select id into v_owner from auth.users order by created_at limit 1;

  if v_owner is null then
    raise exception 'No users found. Sign up through /auth first, then re-run this seed.';
  end if;

  -- ---------------------------------------------------------------- farm
  select id into v_farm from public.farms where owner_id = v_owner order by created_at limit 1;

  if v_farm is null then
    insert into public.farms (owner_id, farm_name, farm_type, farm_size, farm_zones,
                              country, state, city, address)
    values (v_owner, 'Lucknow Demo Farm', 'Mixed cropping', 12.5, 4,
            'India', 'Uttar Pradesh', 'Lucknow', 'Plot 14, Sitapur Road')
    returning id into v_farm;
  end if;

  -- ---------------------------------------------------------------- settings
  -- A row so the settings page exercises stored values rather than the defaults
  -- path. 0003 gives every column a default, so naming a subset is enough.
  insert into public.user_settings (owner_id, alerts_email, reports_monthly)
  values (v_owner, true, false)
  on conflict (owner_id) do update
    set alerts_email = excluded.alerts_email,
        reports_monthly = excluded.reports_monthly;

  -- ---------------------------------------------------------------- sensors
  --
  -- `stale_minutes` drives last_seen_at. 0 means "reporting now"; a large value
  -- is what makes AGS-006 derive as offline without any special-casing.
  --
  -- `null` readings are the point of AGS-002: the column stays NULL, the API omits
  -- the key, and the dashboard shows an em dash. Storing 0.0 instead would be a
  -- plausible-looking acid reading indistinguishable from a real one.
  for v_row in
    select * from (values
      -- code,      tag,          temp,  ph_soil, ph_water, w_temp, sun,  moist, salin, n,   p,   k,   dry,   stab,  src,      stale_min, rssi, fw
      ('AGS-001', 'north-field',  24.8,  6.80,    7.10,     23.4,   780,  42.5,  0.380, 95,  52,  210, false, false, 'device',  1,        -62,  '0.1.0'),
      ('AGS-002', 'east-terrace', 22.1,  6.40,    null,     null,   640,  38.0,  0.295, 74,  41,  168, false, false, 'device',  2,        -71,  '0.1.0'),
      -- Temperature deliberately inside its band. A hot dry plot is realistic, but
      -- it would derive `warning` from the heat and obscure the point this row
      -- exists to make: dry soil ALONE leaves a sensor `normal`.
      ('AGS-003', 'dry-plot',     28.4,  7.10,    7.00,     26.1,   980,  38.2,  0.000, 0,   0,   0,   true,  false, 'device',  1,        -68,  '0.1.0'),
      ('AGS-004', 'newly-planted',23.7,  6.90,    7.05,     22.8,   700,  46.0,  0.410, 88,  47,  190, false, true,  'device',  1,        -59,  '0.1.0'),
      ('AGS-005', 'no-clock',     25.1,  7.00,    7.20,     24.0,   810,  48.0,  0.415, 110, 55,  265, false, false, 'server',  2,        -66,  '0.1.0'),
      ('AGS-006', 'south-gate',   26.2,  6.85,    7.15,     24.6,   720,  44.0,  0.400, 92,  50,  205, false, false, 'device',  240,      -84,  '0.1.0'),
      ('AGS-007', 'river-edge',   27.9,  6.60,    7.30,     25.8,   890,  18.0,  0.620, 65,  38,  145, false, false, 'device',  1,        -74,  '0.1.0')
    ) as t(code, tag, temperature, ph_soil, ph_water, water_temperature, sunlight,
           moisture, salinity, n, p, k, soil_dry, stabilising, src, stale_min, rssi, fw)
  loop
    insert into public.sensors (owner_id, farm_id, sensor_code, sensor_tag, status)
    values (v_owner, v_farm, v_row.code, v_row.tag, 'offline')
    on conflict (owner_id, sensor_code)
      do update set sensor_tag = excluded.sensor_tag,
                    farm_id    = excluded.farm_id
    returning id into v_sensor;

    delete from public.sensor_readings where sensor_id = v_sensor;

    v_seen := now() - (v_row.stale_min || ' minutes')::interval;

    -- Six readings at ten-minute spacing, drifting slightly, so the history table
    -- and the 24-hour chart both have something real to draw.
    for v_i in 0..5 loop
      v_at  := v_seen - (v_i * 10 || ' minutes')::interval;
      -- Deterministic per (sensor, index) so re-running the seed does not create
      -- duplicate rows: the partial unique index on (sensor_id, reading_uid)
      -- rejects them. This is the same idempotency a replaying device relies on.
      v_uid := v_row.code || '-seed-' || v_i;

      insert into public.sensor_readings (
        sensor_id, recorded_at, received_at, recorded_at_source, reading_uid,
        payload_version,
        temperature, moisture, salinity, ph_soil, ph_water, water_temperature,
        sunlight, water_level, nitrogen, phosphorus, potassium,
        npk_estimated, stabilising, soil_dry, raw
      )
      values (
        v_sensor,
        v_at,
        v_seen,
        v_row.src::public.reading_time_source,
        v_uid,
        1,
        v_row.temperature + (v_i * 0.3) - 0.6,
        greatest(v_row.moisture - (v_i * 0.8), 0),
        -- Dry soil stays at exactly zero. Drifting it would turn "no conductivity"
        -- into "a little conductivity" and defeat the case being demonstrated.
        case when v_row.soil_dry then 0 else v_row.salinity + (v_i * 0.008) end,
        v_row.ph_soil + (v_i * 0.05) - 0.1,
        -- NULL for AGS-002, whose 4-in-1 board is unplugged. The whole point.
        case when v_row.ph_water is null then null else v_row.ph_water + (v_i * 0.02) - 0.05 end,
        v_row.water_temperature,
        greatest(v_row.sunlight - (v_i * 35), 0),
        case when v_row.ph_water is null then null else 63 - v_i end,
        case when v_row.soil_dry then 0 else greatest(v_row.n - (v_i * 1.5), 0) end,
        case when v_row.soil_dry then 0 else greatest(v_row.p - (v_i * 0.8), 0) end,
        case when v_row.soil_dry then 0 else greatest(v_row.k - (v_i * 2.0), 0) end,
        true, v_row.stabilising, v_row.soil_dry,
        -- The envelope as the device would have sent it. `raw` is what makes a
        -- future schema move a backfill rather than a loss.
        jsonb_strip_nulls(jsonb_build_object(
          'v', 1,
          'sensorId', v_row.code,
          'uid', v_uid,
          'readings', jsonb_strip_nulls(jsonb_build_object(
            'temperature', v_row.temperature,
            'moisture', v_row.moisture,
            'salinity', case when v_row.soil_dry then 0 else v_row.salinity end,
            'phSoil', v_row.ph_soil,
            'phWater', v_row.ph_water,
            'waterTemperature', v_row.water_temperature,
            'sunlight', v_row.sunlight,
            'waterLevel', case when v_row.ph_water is null then null else 63 end
          )),
          'quality', jsonb_build_object(
            'npkEstimated', true,
            'stabilising', v_row.stabilising,
            'soilDry', v_row.soil_dry
          ),
          'diag', jsonb_build_object('rssi', v_row.rssi, 'fw', v_row.fw)
        ))
      )
      on conflict do nothing;
    end loop;

    -- Device state. Without last_seen_at every sensor derives `offline`.
    --
    -- last_seen_at tracks ARRIVAL and last_reading_at the newest measurement. They
    -- are equal here because none of these nodes is replaying a buffer; keeping
    -- them as separate columns is what allows one that is.
    update public.sensors
    set last_seen_at        = v_seen,
        last_reading_at     = v_seen,
        last_rssi           = v_row.rssi,
        last_uptime_seconds = 38211 + v_row.stale_min * 60,
        firmware_version    = v_row.fw
    where id = v_sensor;
  end loop;

  -- AGS-008: registered and never heard from. `last_seen_at` stays null, so the
  -- read API derives `offline` and the UI shows no reading rather than zeroes.
  -- This is what a sensor looks like between being added and being switched on.
  insert into public.sensors (owner_id, farm_id, sensor_code, sensor_tag, status)
  values (v_owner, v_farm, 'AGS-008', 'awaiting-install', 'offline')
  on conflict (owner_id, sensor_code) do update set sensor_tag = excluded.sensor_tag;

  -- ---------------------------------------------------------------- alerts
  --
  -- Only alerts these sensors could actually justify. The previous set cited a
  -- camera trap, an NDVI trend and a battery percentage — none of which any part
  -- of AgroSmart measures, so they read as real output for data that does not
  -- exist.
  --
  -- Threshold and offline conditions are deliberately NOT seeded: agroapi derives
  -- those live from the readings above (AGS-007's low moisture, AGS-006 being
  -- silent), and a stored copy would sit next to the derived one saying the same
  -- thing without clearing when the reading recovers.
  --
  -- What remains is the class of alert that genuinely needs a stored row: things a
  -- human actioned, or events with no current-state equivalent.
  delete from public.alerts where owner_id = v_owner;

  insert into public.alerts (owner_id, sensor_id, title, description, severity, label, state)
  select
    v_owner,
    (select id from public.sensors where owner_id = v_owner and sensor_code = t.code),
    t.title, t.description, t.severity::public.alert_severity, t.label,
    t.state::public.alert_state
  from (values
    ('AGS-007',
     'Irrigation completed',
     'Drip irrigation ran for 45 minutes on the river edge plot. Moisture was 18% before the cycle; check that it has recovered above 30%.',
     'default', 'Info', 'open'),
    ('AGS-003',
     'Soil moisture recovered',
     'The dry plot was below 10% moisture for six hours yesterday and has since recovered. No action needed — recorded so the dry spell is not lost from the history.',
     'default', 'Positive', 'accepted'),
    ('AGS-006',
     'Sensor stopped reporting overnight',
     'The south gate node went silent and has not returned. Raised before the current outage so the two can be told apart.',
     'destructive', 'Maintenance', 'open'),
    ('AGS-002',
     'Water board not detected',
     'The 4-in-1 board on the east terrace has not reported water pH, water temperature or water level since installation. Soil readings are unaffected. Check the connector.',
     'secondary', 'Maintenance', 'open'),
    ('AGS-001',
     'Nutrient values are estimated',
     'This probe calculates nitrogen, phosphorus and potassium from soil conductivity rather than measuring them. Send a soil sample for a lab test before making a fertiliser decision.',
     'outline', 'Recommendation', 'open'),
    (null,
     'Firmware 0.1.0 across all nodes',
     'Every reporting sensor is on firmware 0.1.0. Recorded for the audit trail; no action needed.',
     'default', 'Info', 'rejected')
  ) as t(code, title, description, severity, label, state);

  raise notice 'Seeded farm %, 8 sensors (7 reporting + 1 never-reported), 6 readings each, and 6 alerts for user %',
    v_farm, v_owner;
end $$;
