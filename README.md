# AgroSmart

Precision agriculture for smallholder farms. Field sensor nodes measure soil and
water, a backend ingests and serves the telemetry, and a dashboard turns it into
decisions a farmer can act on.

Sensors report moisture, temperature, conductivity, soil and water pH, sunlight,
water level and NPK once a minute. The system stores that history, derives
thresholds and staleness, and surfaces alerts.

## Repository layout

```
app/                     ← this repository
├── agroapp/             Next.js 16 dashboard
├── agroapi/             FastAPI backend: device ingest + read API
├── deploy/k8s/          Kubernetes manifests
├── docker-compose.yml   local stack
├── CLAUDE.md            engineering rules and known state
└── .github/workflows/   CI, automated review, image publishing

../agrosensor/           ESP8266 firmware — SEPARATE repository
```

`../agrosensor` is deliberately a separate repository. It has its own history,
its own hardware CI, and its own licence split. Read it; don't edit it from here.

## Architecture

```
                          ┌────────────────────────────┐
  ESP8266 node ──POST────▶│  agroapi   (FastAPI)       │
  Bearer <device token>   │                            │──▶ Supabase Postgres
                          │  /v1/ingest                │    (RLS enforced)
  Browser ──────GET──────▶│  /v1/sensors, /v1/alerts…  │
  Bearer <Supabase JWT>   └────────────────────────────┘
        │
        └──▶ agroapp (Next.js) ── Supabase Auth for sign-in
```

Two audiences, two credentials. Devices hold a per-device token and have no user
session; browsers hold a Supabase JWT, and the backend scopes every query with it
so the database's own row-level security does the enforcing.

**The device never writes to Postgres directly.** Not with the anon key, not
ever — no RLS policy can protect a table from a key that ships to every browser.

## Component status

| Component | State |
|---|---|
| `agroapp` dashboard | Reads and writes through `agroapi` over HTTP. Light and dark themes. Chatbot and ML are not implemented; recommendations are rule-based rather than generated. |
| `agroapi` backend | Ingest, the dashboard read API, sensor and alert management, device-token minting, health. 153 tests. |
| Database | `0001` base schema, `0002` telemetry contract, `0003` user settings. RLS on every table. |
| `../agrosensor` firmware | Phases A–F complete, 109 host tests. Publishing over HTTP. |

The two services no longer merely share a database. Every dashboard read is an
HTTP call to `agroapi`, authenticated with the browser's own Supabase JWT, and the
thresholds, status derivation and alert logic live there once rather than in both.

**A device flashed today binds without a reflash.** `agrosensor/include/config.h`
points at `:8080/api/ingest` and sends its credential as `X-Device-Token`, while
the documented address is `/v1/ingest` with a bearer token. Rather than requiring
a firmware change in a separate repository, `agroapi` accepts both — see
`deps.py:current_device` and the alias in `main.py`. The firmware should still move
to the documented form; it is no longer urgent.

## Quick start

```bash
# 1. Database — the Supabase CLI is the only migration applier.
cd agroapp && pnpm dlx supabase db push

# 2. Backend
cd agroapi
cp .env.example .env          # fill in AGRO_DATABASE_URL, AGRO_SUPABASE_URL, AGRO_TOKEN_PEPPER
uv sync
uv run uvicorn agroapi.main:app --reload --port 8080

# 3. Dashboard
cd agroapp
cp .env.example .env.local    # fill in the NEXT_PUBLIC_* values
pnpm install && pnpm dev
```

Or bring the whole stack up at once — see [`deploy/README.md`](deploy/README.md):

```bash
docker compose up --build
```

**Port 8080 is not arbitrary.** `agrosensor/include/config.h` points
`AGRO_INGEST_URL` at `:8080`, so a node flashed against a local instance needs no
firmware change.

## The telemetry contract

[`../agrosensor/docs/integration/dashboard-contract.md`](../agrosensor/docs/integration/dashboard-contract.md)
is authoritative for what a device sends. Three rules bind every consumer, and
each has bitten this codebase:

**1. Absent is not zero.** A node whose water board is unplugged omits `phWater`
entirely. Storing `0.0` is unacceptable — it is a plausible-looking acid reading
that nothing downstream could distinguish from a real one.

**2. The `quality` block is always present and load-bearing.** `npkEstimated`
means N/P/K were back-calculated from conductivity rather than measured, so no
fertiliser advice may rest on them. `soilDry` means conductivity was zero, which
is *expected in dry soil and not a fault*.

**3. `ts` is omitted until the device syncs NTP.** Absent means the server stamps
arrival. An implausible timestamp is rejected rather than quietly replaced.

## Development

Rules, conventions and a catalogue of known bugs and mocks live in
[`CLAUDE.md`](CLAUDE.md). The one that shapes the backend most:

> **Mapping and derivation take data, never a connection.**

`agroapi/src/agroapi/domain/` imports neither `asyncpg` nor `fastapi` and never
reads the clock. Everything that can be *wrong* lives there, so every contract
case is a fixture and a millisecond-long test. It is the same rule the firmware
states as *"parsers take a byte buffer, never a serial port."*

```bash
cd agroapi && uv run ruff check && uv run mypy && uv run pytest
cd agroapp && npx tsc --noEmit && pnpm lint
```

CI is path-filtered per project. The backend image job builds the container *and
runs it*, asserting liveness, readiness-without-a-database, and a non-root uid — a
green build proves less than you would hope.

## Deployment

[`deploy/README.md`](deploy/README.md) covers the Kubernetes manifests and the
five decisions that look wrong without their reasons — including why the backend
starts successfully when the database is down, and why `NEXT_PUBLIC_*` are build
arguments rather than runtime configuration.

## Licence

Code is [MIT](LICENSE). Documentation is [CC BY 4.0](LICENSE-docs). The split
matches `../agrosensor`, whose contract and hardware notes are worth citing
independently of any implementation.
