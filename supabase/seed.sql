-- Development seed: ports the former lib/table-data.ts fixtures into the database
-- so the dashboard can be exercised with realistic data.
--
-- Attaches everything to the FIRST user in auth.users. Sign up through /auth
-- before running this, then:
--   psql "$DATABASE_URL" -f supabase/seed.sql
-- or paste into the Supabase SQL editor.
--
-- Safe to re-run: sensors upsert on (owner_id, sensor_code) and readings/alerts
-- are cleared for the seeded sensors first.

do $$
declare
  v_owner uuid;
  v_farm  uuid;
  v_sensor uuid;
  v_row record;
  v_i int;
begin
  select id into v_owner from auth.users order by created_at limit 1;

  if v_owner is null then
    raise exception 'No users found. Sign up through /auth first, then re-run this seed.';
  end if;

  -- ---------------------------------------------------------------- farm
  insert into public.farms (owner_id, farm_name, farm_type, farm_size, farm_zones,
                            country, state, city, address)
  values (v_owner, 'Lucknow Demo Farm', 'Mixed cropping', 12.5, 4,
          'India', 'Uttar Pradesh', 'Lucknow', 'Plot 14, Sitapur Road')
  returning id into v_farm;

  -- ---------------------------------------------------------------- sensors
  for v_row in
    select * from (values
      ('SENSOR-LKO-001', 'field-a1', 'normal'::public.sensor_status, 24.8, 7.1,  780,  42, 0.38,  95, 52, 210),
      ('SENSOR-LKO-002', 'field-a2', 'warning'::public.sensor_status, 26.2, 6.8,  920,  28, 0.45,  78, 38, 180),
      ('SENSOR-LKO-003', 'field-b1', 'normal'::public.sensor_status, 22.5, 7.4,  650,  55, 0.32, 142, 68, 320),
      ('SENSOR-LKO-004', 'field-b2', 'warning'::public.sensor_status, 27.9, 8.1, 1050,  19, 0.62,  65, 22, 145),
      ('SENSOR-LKO-005', 'field-c1', 'normal'::public.sensor_status, 25.1, 7.0,  810,  48, 0.41, 110, 55, 265),
      ('SENSOR-LKO-006', 'field-c2', 'warning'::public.sensor_status, 28.4, 6.5,  450,  35, 0.55,  88, 45, 198),
      ('SENSOR-LKO-007', 'field-d1', 'normal'::public.sensor_status, 23.7, 7.6,  890,  62, 0.29, 165, 72, 380),
      ('SENSOR-LKO-008', 'field-d2', 'offline'::public.sensor_status, 29.2, 8.3, 1120,  15, 0.78,  52, 18, 120),
      ('SENSOR-LKO-009', 'field-e1', 'normal'::public.sensor_status, 24.9, 7.2,  760,  51, 0.36, 102, 60, 240),
      ('SENSOR-LKO-010', 'field-e2', 'warning'::public.sensor_status, 26.8, 6.9,  980,  31, 0.48,  84, 41, 175)
    ) as t(code, tag, status, temperature, ph, sunlight, moisture, salinity, n, p, k)
  loop
    insert into public.sensors (owner_id, farm_id, sensor_code, sensor_tag, status)
    values (v_owner, v_farm, v_row.code, v_row.tag, v_row.status)
    on conflict (owner_id, sensor_code)
      do update set sensor_tag = excluded.sensor_tag,
                    status     = excluded.status,
                    farm_id    = excluded.farm_id
    returning id into v_sensor;

    delete from public.sensor_readings where sensor_id = v_sensor;

    -- Six hourly readings so the "last 5 data points" table and any trend view
    -- have real history. Values drift slightly around the base reading.
    for v_i in 0..5 loop
      insert into public.sensor_readings (
        sensor_id, recorded_at, temperature, ph, sunlight,
        moisture, salinity, nitrogen, phosphorus, potassium
      )
      values (
        v_sensor,
        now() - (v_i || ' hours')::interval,
        v_row.temperature + (v_i * 0.3) - 0.6,
        v_row.ph          + (v_i * 0.05) - 0.1,
        greatest(v_row.sunlight - (v_i * 35), 0),
        greatest(v_row.moisture - (v_i * 0.8), 0),
        v_row.salinity    + (v_i * 0.01),
        greatest(v_row.n  - (v_i * 1.5), 0),
        greatest(v_row.p  - (v_i * 0.8), 0),
        greatest(v_row.k  - (v_i * 2.0), 0)
      );
    end loop;
  end loop;

  -- ---------------------------------------------------------------- alerts
  delete from public.alerts where owner_id = v_owner;

  insert into public.alerts (owner_id, title, description, severity, label)
  values
    (v_owner, 'Low Soil Moisture Detected',
     'Soil moisture in Field A-3 is at 18% – below the recommended 30-35% for maize.',
     'destructive', 'Urgent'),
    (v_owner, 'High Temperature Warning',
     'Temperature reached 38°C in Greenhouse B – risk of heat stress to tomatoes.',
     'destructive', 'Critical'),
    (v_owner, 'Pest Activity Detected',
     'Early signs of fall armyworm detected in maize plot C-2 via camera trap.',
     'destructive', 'Action Required'),
    (v_owner, 'Fertilizer Recommendation',
     'NPK levels low in Field D-1. Suggested: 20 kg/ha Urea + 15 kg/ha DAP.',
     'secondary', 'Recommendation'),
    (v_owner, 'Irrigation Scheduled',
     'Automatic drip irrigation started in Orchard E at 06:30 AM for 45 minutes.',
     'default', 'Info'),
    (v_owner, 'pH Level Out of Range',
     'Soil pH in Plot F-4 is 5.2 (too acidic). Consider lime application soon.',
     'destructive', 'Warning'),
    (v_owner, 'Rainfall Incoming',
     'Heavy rain expected in next 4 hours – pause fertigation and close greenhouse vents.',
     'secondary', 'Weather Alert'),
    (v_owner, 'Battery Low – Soil Sensor',
     'Sensor node #12 in Field B-1 has battery level at 14%. Replace soon.',
     'outline', 'Maintenance'),
    (v_owner, 'Good Growth Progress',
     'Wheat crop in Field G-2 shows healthy NDVI increase of +0.18 since last week.',
     'default', 'Positive'),
    (v_owner, 'Nutrient Imbalance Detected',
     'Potassium (K) levels low in tomato greenhouse C. Recommend foliar spray.',
     'secondary', 'Recommendation'),
    (v_owner, 'Frost Risk Tonight',
     'Temperature expected to drop to 2°C tonight – activate frost protection in orchard.',
     'destructive', 'Urgent');

  raise notice 'Seeded farm %, 10 sensors with 6 readings each, and 11 alerts for user %', v_farm, v_owner;
end $$;
