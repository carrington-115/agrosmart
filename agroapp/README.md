# AgroSmart

AgroSmart helps farmers optimize their agricultural practices using precision
agriculture techniques, analysing data from soil sensors to surface insights and
recommendations for crop management.

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · Supabase

## Getting started

```bash
pnpm install
cp .env.example .env.local   # then fill in the values
pnpm dev
```

### Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Browser/SSR client key |
| `SUPABASE_SERVICE_ROLE_KEY` | ingest only | Server-only. Bypasses RLS — never expose to the browser |
| `SENSOR_INGEST_KEY` | ingest only | Shared secret sent by firmware as `x-device-key` |

### Database

Apply the schema, then optionally seed demo data:

```bash
# In the Supabase SQL editor, or via psql:
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
psql "$DATABASE_URL" -f supabase/seed.sql   # sign up through /auth first
```

`supabase/seed.sql` attaches a demo farm, 10 sensors with 6 hourly readings each,
and 11 alerts to the first user in `auth.users`.

Regenerate `lib/database.types.ts` after schema changes:

```bash
pnpm dlx supabase gen types typescript --linked > lib/database.types.ts
```

## Architecture

Auth and data both go through Supabase; there is no separate backend service.

- `proxy.ts` — root Next.js 16 proxy (formerly `middleware.ts`). Refreshes the
  Supabase session and redirects unauthenticated users to `/auth`. Excludes `/api`.
- `lib/supabase/{client,server,proxy}.ts` — browser, server-component, and
  session-refresh clients.
- `lib/supabase/admin.ts` — service-role client. Only for `/api/ingest`, where the
  caller is a device holding a shared key rather than a logged-in user.
- `lib/queries.ts` — server-side reads. Relies on RLS for scoping rather than
  filtering by `owner_id`, so a missing session yields empty results.
- `lib/analytics.tsx` — derives the analytics cards and soil KPIs from readings,
  centralising all threshold logic.

Pages are server components that fetch data and hand it to a `*View` client
component for interactivity.

### API

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/sensors` | GET, POST | List / register sensors |
| `/api/sensors/[code]` | DELETE | Remove a sensor by device code |
| `/api/alerts/[id]` | PATCH | Accept or reject an alert |
| `/api/profile` | PUT, POST | Persist user profile / farm profile |
| `/api/reports/summary` | GET | CSV export of the latest reading per sensor |
| `/api/ingest` | POST | Sensor reading ingestion (device key auth) |

Ingest example:

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H 'Content-Type: application/json' \
  -H "x-device-key: $SENSOR_INGEST_KEY" \
  -d '{"sensorId":"SENSOR-LKO-001","temperature":24.8,"ph":7.1,
       "sunlight":780,"moisture":42,"salinity":0.38,
       "nitrogen":95,"phosphorus":52,"potassium":210}'
```

Posting a reading also recomputes the sensor's `status` from its thresholds.

## Not yet implemented

- **Chatbot has no model wired up.** `/dashboard/chatbot` has the full UI — mode and
  model selectors, knowledge-base citations — but `ChatbotInput` only appends the
  user's message; no LLM is called.
- **No ML.** Yield prediction and disease detection are unimplemented.
- **Reports cover soil metrics only.** The agronomic and economic KPIs in the design
  (mandi prices, expected yield, carbon sequestration, harvest window) need external
  data sources that are not connected, so they are omitted rather than mocked.
- **`/dashboard/reports/recommendations` is a stub.**
- **Firmware.** `../../agrosensor` (ESP8266/PlatformIO) has no source yet, so
  `/api/ingest` currently has no real client.
- **No tests.** No test framework is configured.
