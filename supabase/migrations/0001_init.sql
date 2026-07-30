-- AgroSmart initial schema
--
-- Mirrors the shapes already used by the frontend:
--   lib/types.ts  -> Sensor { sensorId, temperature, ph, sunlight, moisture,
--                             salinity, npk{nitrogen,phosphorus,potassium}, status }
--   lib/types.ts  -> alertsCardProps { title, description, badgeInfo, badgeType }
--   lib/schema.ts -> userProfileSchema, farmProfileSchema, sensorSchema
--
-- Every table is owner-scoped and protected by RLS against auth.uid().

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums

create type public.sensor_status as enum ('normal', 'warning', 'offline');

-- Maps to the shadcn Badge variants the alert cards already expect.
create type public.alert_severity as enum ('default', 'secondary', 'destructive', 'outline');

create type public.alert_state as enum ('open', 'accepted', 'rejected');

-- ---------------------------------------------------------------- profiles

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text,
  email      text,
  phone      text,
  address    text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- farms

create table public.farms (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  farm_name  text not null,
  farm_type  text,
  farm_size  numeric(10, 2),
  farm_zones integer,
  country    text,
  state      text,
  city       text,
  address    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index farms_owner_id_idx on public.farms (owner_id);

-- ---------------------------------------------------------------- sensors

create table public.sensors (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  farm_id     uuid references public.farms (id) on delete set null,
  -- Human-facing identifier printed on the device, e.g. 'SENSOR-LKO-001'.
  sensor_code text not null,
  sensor_tag  text,
  status      public.sensor_status not null default 'offline',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint sensors_owner_code_unique unique (owner_id, sensor_code)
);

create index sensors_owner_id_idx on public.sensors (owner_id);
create index sensors_farm_id_idx on public.sensors (farm_id);

-- ---------------------------------------------------------------- readings

-- Append-only time series. One row per device transmission.
create table public.sensor_readings (
  id          bigint generated always as identity primary key,
  sensor_id   uuid not null references public.sensors (id) on delete cascade,
  recorded_at timestamptz not null default now(),
  temperature numeric(6, 2),
  ph          numeric(4, 2),
  sunlight    numeric(8, 2),
  moisture    numeric(5, 2),
  salinity    numeric(6, 3),
  nitrogen    numeric(8, 2),
  phosphorus  numeric(8, 2),
  potassium   numeric(8, 2)
);

-- Serves both "latest reading per sensor" and "last N points" queries.
create index sensor_readings_sensor_recorded_idx
  on public.sensor_readings (sensor_id, recorded_at desc);

-- ---------------------------------------------------------------- alerts

create table public.alerts (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  sensor_id   uuid references public.sensors (id) on delete set null,
  title       text not null,
  description text,
  severity    public.alert_severity not null default 'default',
  -- Short badge text, e.g. 'Urgent', 'Recommendation', 'Weather Alert'.
  label       text,
  state       public.alert_state not null default 'open',
  created_at  timestamptz not null default now()
);

create index alerts_owner_state_created_idx
  on public.alerts (owner_id, state, created_at desc);

-- ---------------------------------------------------------------- triggers

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger farms_set_updated_at
  before update on public.farms
  for each row execute function public.set_updated_at();

create trigger sensors_set_updated_at
  before update on public.sensors
  for each row execute function public.set_updated_at();

-- Create a profile row automatically for every new auth user. `name` comes from
-- the signup metadata that app/auth/page.tsx already sends.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- RLS

alter table public.profiles        enable row level security;
alter table public.farms           enable row level security;
alter table public.sensors         enable row level security;
alter table public.sensor_readings enable row level security;
alter table public.alerts          enable row level security;

-- profiles: a user sees and edits only their own row.
create policy "profiles are self-readable"
  on public.profiles for select using (auth.uid() = id);
create policy "profiles are self-insertable"
  on public.profiles for insert with check (auth.uid() = id);
create policy "profiles are self-updatable"
  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- farms / sensors / alerts: owner-scoped on every verb.
create policy "farms are owner-scoped"
  on public.farms for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "sensors are owner-scoped"
  on public.sensors for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "alerts are owner-scoped"
  on public.alerts for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- readings: reachable only through a sensor the caller owns. Device writes go
-- through the ingest route handler using the service-role key, which bypasses RLS.
create policy "readings are readable via owned sensors"
  on public.sensor_readings for select using (
    exists (
      select 1 from public.sensors s
      where s.id = sensor_readings.sensor_id and s.owner_id = auth.uid()
    )
  );

create policy "readings are insertable via owned sensors"
  on public.sensor_readings for insert with check (
    exists (
      select 1 from public.sensors s
      where s.id = sensor_readings.sensor_id and s.owner_id = auth.uid()
    )
  );
