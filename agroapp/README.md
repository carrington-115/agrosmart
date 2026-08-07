# AgroSmart dashboard

The web dashboard: analyses soil sensor data and surfaces insights and
recommendations for crop management.

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · Supabase

This is one component of the project. See the [root README](../README.md) for the
system as a whole, and [`../CLAUDE.md`](../CLAUDE.md) for the engineering rules.

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
| `SUPABASE_SERVICE_ROLE_KEY` | ingest, QR pairing | Server-only. Bypasses RLS — never expose to the browser |
| `SENSOR_INGEST_KEY` | ingest, QR pairing | Shared secret sent by firmware as `x-device-key`. Also signs QR pairing links, under a separate HMAC label |
| `AGRO_API_URL` | dev probe only | agroapi base URL. Deliberately not `NEXT_PUBLIC_` — see `lib/api.ts` |

### Database

Apply the schema, then optionally seed demo data:

```bash
# The Supabase CLI is the only migration applier — never add Alembic.
pnpm dlx supabase db push
psql "$DATABASE_URL" -f supabase/seed.sql   # sign up through /auth first
```

Three migrations: `0001_init` (base schema), `0002_telemetry_contract` (the
firmware wire contract), `0003_user_settings` (notification preferences). The app
reads columns from all three, so a database still on `0001` will show empty
readings rather than errors — the degradation is graceful but the data is missing.

`supabase/seed.sql` attaches a demo farm, 10 sensors with 6 hourly readings each,
and 11 alerts to the first user in `auth.users`.

Regenerate `lib/database.types.ts` after schema changes:

```bash
pnpm dlx supabase gen types typescript --linked > lib/database.types.ts
```

## Architecture

**Data goes through `agroapi` over HTTP. Auth stays with Supabase.**

```
Server Component ─► lib/queries.ts ─► lib/api.ts:apiFetch ─► agroapi ─► Postgres (RLS)
                                            │
Browser ─► /api/… (thin forwarder) ─────────┘
```

`apiFetch` reads the Supabase session server-side and sends its access token as
`Authorization: Bearer`. agroapi verifies it against Supabase's JWKS and uses its
`sub` as the `auth.uid()` the RLS policies check — the same identity the database
already understands, so scoping is enforced once, by Postgres.

The browser never calls `agroapi` directly. The handlers under `app/api/` forward
instead, which keeps the access token out of the client bundle and means agroapi's
deliberately narrow CORS `allow_headers` never has to grow.

- `proxy.ts` — root Next.js 16 proxy (formerly `middleware.ts`). Refreshes the
  Supabase session and redirects unauthenticated users to `/auth`. Excludes `/api`
  and `/pair` — the phone that scans a pairing QR has no cookie and cannot get one.
- `lib/api.ts` — `apiFetch` (authenticated), `load` (turns "backend unreachable"
  into a value), `probeBackend` (the `/dev/backend` diagnostic), `ApiError`.
- `lib/api-types.ts` — hand-maintained mirror of `agroapi/schemas/read.py`.
- `lib/queries.ts` — every dashboard read. The seam between the wire shape and the
  shape components consume.
- `lib/supabase/{client,server,proxy}.ts` — auth only.
- `lib/supabase/admin.ts` — service-role client. **The last consumer is QR
  pairing's claim step**, where the phone has no session; it stays until that flow
  moves to agroapi.
- `lib/analytics.tsx` — the analytics cards and soil KPIs. Takes the bands as a
  parameter; it does not own them.

Pages are server components that fetch data and hand it to a `*View` client
component for interactivity.

### Where the thresholds live

`agroapi/src/agroapi/domain/thresholds.py`, and nowhere else. The dashboard fetches
them from `GET /v1/thresholds` to label a reading "Low" or "Optimal", and each
breach arrives carrying the band it left. There is no band literal anywhere in
`lib/` — there were previously three copies of these numbers, and they had already
drifted on soil pH.

### Themes

`next-themes` with `attribute="class"`, because `globals.css` declares
`@custom-variant dark (&:is(.dark *))` — every `dark:` utility compiles against a
`.dark` class, so the default `data-theme` attribute would set something nothing
reads. Light, dark and system cycle from the sidebar toggle. `<html>` carries
`suppressHydrationWarning`: next-themes writes the resolved theme in a blocking
script before hydration, which is the mechanism that prevents a flash of the wrong
theme and also a genuine server/client mismatch.

### API

Every route below is a **thin forwarder** to `agroapi`, kept so that browser code
did not have to change and so the access token stays server-side.

| Route | Method | Forwards to |
| --- | --- | --- |
| `/api/sensors` | GET, POST | `GET/POST /v1/sensors` |
| `/api/sensors/[code]` | DELETE | `DELETE /v1/sensors/{code}` |
| `/api/alerts/[id]` | PATCH | `PATCH /v1/alerts/{id}` |
| `/api/profile` | PUT, POST | `PUT /v1/me` (profile / farm) |
| `/api/settings` | GET, PUT | `GET /v1/me` · `PUT /v1/me/settings` |
| `/api/reports/summary` | GET | CSV built from `GET /v1/sensors` |
| `/api/sensors/pair` | POST | — mints a QR pairing link locally |
| `/api/sensors/pair/claim` | POST | — registers from the phone, no session |

An unreachable backend forwards as **502**, not 500: the dashboard is working and
its dependency is not, which is a different thing to report.

**`/api/ingest` is gone.** `agroapi` owns ingest, with a per-device token rather
than one shared key — keeping a second implementation meant keeping a third
convention for devices to disagree with. Point sensors at `agroapi` on port 8080;
it serves both `/v1/ingest` and, for firmware already in the field, `/api/ingest`.

Mint a device credential from the dashboard's own API:

```bash
# Returns the plaintext ONCE. Only an HMAC is stored, and device_tokens is
# RLS deny-all, so there is no endpoint that can produce it again.
curl -X POST http://localhost:8080/v1/sensors/AGS-001/tokens   -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"   -H 'Content-Type: application/json' -d '{"label":"field unit"}'
```

Accepting a QR pairing link is the one route without a session: the phone that
scanned it has no cookie, so `/api/sensors/pair/claim` takes the owner from the
signed token and writes with an explicit `owner_id`. `/pair/[token]` is excluded
from the auth redirect in `lib/supabase/proxy.ts` for the same reason.

## How the contract shows up in the UI

The three rules in
[`dashboard-contract.md`](../../agrosensor/docs/integration/dashboard-contract.md)
are not advisory, and each one is visible on screen:

- **Absent is not zero.** Every metric on `Sensor` is `number | null` and renders
  as `—`. There is no `null → 0` coercion anywhere; a sensor with an unplugged
  4-in-1 board shows no water pH rather than a plausible-looking 0.0. Farm
  averages skip absent values instead of counting them as zero.
- **The `quality` block is load-bearing.** `components/web/QualityBadges.tsx`
  surfaces it on the table, the detail page and every reading row. `soilDry` is
  styled neutrally and never raises a fault; `stabilising` suppresses all
  threshold verdicts; `npkEstimated` suppresses the N/P/K verdicts **and** blocks
  every fertiliser recommendation in `lib/recommendations.ts`. An absent block
  reads "Quality unknown", never as three silent `false`s.
- **`ts` is trusted or rejected, never substituted.** Absent means the server
  stamps arrival and records `recorded_at_source = 'server'`, which the detail
  page marks as *(arrival)*. An implausible timestamp is rejected.

Thresholds live in `agroapi/src/agroapi/domain/thresholds.py` alone, and are
fetched from `GET /v1/thresholds`. Soil pH is 5.5–8.0 and water pH 6.0–7.5; they
are different bands because they are different measurements, and applying the
water band to soil — which this app used to do — flags perfectly ordinary acid
soil as a problem.

## Not yet implemented

- **Chatbot has no model wired up.** `/dashboard/chatbot` has the full UI — mode and
  model selectors, knowledge-base citations — but `ChatbotInput` only appends the
  user's message; no LLM is called.
- **No ML.** Yield prediction and disease detection are unimplemented.
- **AI summaries are disabled, not silent.** The buttons that would call a model
  are disabled and say why, rather than being present and doing nothing.
- **Reports cover soil metrics only.** The agronomic and economic KPIs in the design
  (mandi prices, expected yield, carbon sequestration, harvest window) need external
  data sources that are not connected, so they are omitted rather than mocked.
- **Recommendations are rule-based, not generated.** `lib/recommendations.ts`
  derives them from thresholds in plain language. That covers what follows from
  the readings; it is not the LLM the SRS describes.
- **Nothing inserts an alert.** `agroapi/domain/alerts.py` derives them from the
  current readings so the page is not permanently empty, and marks them *Live* —
  they clear themselves and cannot be accepted or rejected, because there is no
  row to update.
- **Alert email and SMS delivery** are stored as preferences but never sent; no
  delivery service is connected.
- **No tests in this app.** No test framework is configured here, and `CLAUDE.md`
  says not to add one as a side effect. The logic that used to live in `lib/` —
  thresholds, status derivation, alert derivation — now sits in `agroapi/domain/`,
  where it is covered by 153 tests including per-endpoint cross-tenant isolation.
