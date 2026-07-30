# AgroSmart

Precision agriculture: field sensor nodes report soil and water telemetry, a
backend ingests and serves it, a dashboard turns it into decisions.

## The three components

| Path | What | Repo |
|---|---|---|
| `agroapp/` | Next.js 16 · React 19 · Tailwind v4 · shadcn/ui dashboard | this one |
| `agroapi/` | FastAPI backend — device ingest and the dashboard read API | this one |
| `../agrosensor/` | ESP8266 firmware (PlatformIO) | **separate repo, separate licence** |

`../agrosensor` is deliberately not part of this repository. Read it, never edit
it from here — changes to the firmware belong in its own history and its own
hardware CI.

## The authoritative document

**`../agrosensor/docs/integration/dashboard-contract.md`** is the wire contract
between device and backend. When this repo and that document disagree about a
payload, the document wins unless a migration has deliberately superseded it.

Its "Backend status: does not exist yet" section is **stale** — it predates
`app/api/` and `supabase/migrations/`. Do not plan against that section.

## The one rule everything else follows

The firmware's own rule is *"parsers take a byte buffer, never a serial port."*
Here that reads:

> **Mapping and derivation take data, never a connection.**

`agroapi/src/agroapi/domain/` is pure. It imports neither `asyncpg` nor
`fastapi`, and it never reads the clock — `now` is passed in. Everything that
can be *wrong* lives there: envelope decoding, status derivation, threshold
evaluation.

This is not taste. The contract's rules fail silently and produce plausible
wrong numbers. Purity means every case is a fixture and a millisecond-long test.

**Corollaries**
- Failure is a typed error, never a magic value. No `-1`, no `0.0` for "missing".
- Routers validate and wire. They contain no arithmetic.
- Repository functions take a connection, never a pool and never a `Request`.
- Thresholds live in exactly one module and are imported, never re-typed.

## The three contract rules — memorise these

**1. Absent is not zero.** A node whose 4-in-1 board is unplugged omits
`phWater` entirely. Storing `0.0` is unacceptable: it is a perfectly
plausible-looking acid reading that nothing downstream could distinguish from a
real one. `Optional[float]` all the way through; `exclude_none=True` on the way
out.

> Known violation, do not copy it: `num()` in `agroapp/lib/queries.ts` coerces
> `null → 0`. It is also the only thing stopping the unguarded `temp.toFixed(1)`
> in `lib/table-columns.tsx` from throwing. Both are scheduled for the frontend
> cutover.

**2. The `quality` block is load-bearing and always present.**

| Flag | Meaning |
|---|---|
| `npkEstimated` | N/P/K are back-calculated from conductivity, **not measured**. While true, never build fertiliser recommendations on them. |
| `stabilising` | Inside the probe's 5-minute settling window. Readings are real but converging. |
| `soilDry` | Conductivity was zero, which zeroes derived NPK. **Expected in dry soil, not a fault.** Never raise a sensor-failure alert on it. |

Never defaulted. Their absence must never be readable as three `false` values.

**3. `ts` is omitted until NTP syncs.** Absent ⇒ the server stamps arrival.
Present ⇒ trust it, which is what makes replaying a buffered outage worthwhile.
Implausible ⇒ **reject**; substituting arrival time fabricates a
plausible-looking value, which is rule 1 applied to time.

## Security rules

- **The device never writes to Supabase directly.** Not with the anon key, not
  ever. The shape is `device --(per-device token)--> agroapi --> Postgres`.
- **The service-role key never reaches the browser** and never gets a
  `NEXT_PUBLIC_` prefix.
- **Dashboard queries are RLS-scoped, not filtered by hand.** Use
  `db/session.py:user_scope`. A forgotten `WHERE owner_id` must not be able to
  leak another tenant's rows.
- **`set_config(..., true)` inside an explicit transaction — always.** Outside
  one it is a silent no-op, and a non-local `SET` persists on a pooled
  connection and serves the next user the previous user's data. This is the one
  genuinely dangerous mistake available in this codebase.
- **Connect as `agro_api`, never `postgres`.** `postgres` owns these tables and
  holds `BYPASSRLS`, so every policy would be inert. See
  `agroapp/supabase/setup_api_role.sql`.
- **Never commit secrets.** `.env.example` files are committed; `.env*` are not.

## Commands

```bash
# Backend (agroapi/)
uv run uvicorn agroapi.main:app --reload --port 8080   # 8080 matches AGRO_INGEST_URL
uv run pytest                      # full suite
uv run pytest -m "not integration" # pure only, no database needed
uv run ruff check && uv run mypy   # lint + types, both must be clean

# Frontend (agroapp/)
pnpm dev
pnpm build
npx tsc --noEmit                   # there is no `typecheck` script yet
pnpm lint

# Migrations — Supabase CLI is the ONLY applier. Never add Alembic.
pnpm dlx supabase db push
pnpm dlx supabase gen types typescript --linked > lib/database.types.ts
```

## Migrations

Plain numbered SQL in `agroapp/supabase/migrations/`, applied by the Supabase
CLI. The backend **authors** the schema and mirrors it in Python; it does not
apply it.

Two tools managing one `public` schema is the hazard being avoided — Alembic
cannot model RLS policies, triggers or generated columns, so every interesting
statement would end up in `op.execute("""...""")` anyway, with a second ledger
bolted on. `agroapi/src/agroapi/db/pool.py:check_schema` asserts only the
columns the ingest writer writes, which catches "deployed against a database
where the migration was never pushed" without duplicating the schema.

## Testing

Mirror the firmware's discipline, which is the reason it has 109 host-side tests
and this repo is catching up: **interface first, then fixtures, then failing
tests, then implementation.**

- Test names state a requirement, not a mechanism.
  `test_dry_soil_zero_npk_is_data_not_a_fault`, not `test_decode_2`.
- Fixtures in `agroapi/tests/fixtures/` are real captured payloads. Always
  include the ugly cases: unplugged board, empty `readings:{}`, no `ts`, dry
  soil, unknown version.
- Pure tests need no database. Anything that does is marked `@integration`.
- Cross-tenant isolation is asserted **per endpoint**, not once. It is the whole
  justification for the RLS approach.

The frontend has no test framework yet. Do not add one as a side effect of an
unrelated change.

## Conventions

- **Commits: do not add a Claude co-author trailer.** Write what changed and
  *why* — the reasoning, not a file list.
- Every change lands as a pull request. Never push to `master`.
- Prose in comments explains reasoning. If a field needs a paragraph, write the
  paragraph; that paragraph is the spec.
- TypeScript is `strict`. Python is `mypy --strict`. Neither gets loosened to
  make something compile.

## MCP servers

Configured in `.mcp.json`:

- **supabase** — schema inspection, migrations, logs. Read-only by default;
  drop `--read-only` only deliberately. Needs `SUPABASE_ACCESS_TOKEN`.
- **figma** — the design source of truth. Mockups also live as PNGs in
  `../resources/`, but Figma has the real tokens and spacing.
- **vercel** — deployment, build logs, environment variables for the dashboard.

## Known state, so you do not rediscover it

- Nothing **creates** alerts. The UI accepts and rejects them; `seed.sql`
  provides fixtures; no code inserts one.
- `getSensors()` loads *every* reading for *every* sensor and reduces in JS. At
  1 reading/min/node that is 1,440 rows/node/day and degrades within days.
- `components/web/LineChart.tsx` still renders `{cpu, memory, network}`
  placeholder data labelled "CPU Usage (%)", and `lib/types.ts` imports that
  mock into the type layer while the component imports types back out — a
  circular dependency that must break before any real chart.
- Thresholds are duplicated between `deriveStatus()` in `app/api/ingest/route.ts`
  and `lib/analytics.tsx`. `agroapi/domain/thresholds.py` is the intended single
  source.
- `sunlight` is labelled "lux" in the table. The LDR is uncalibrated and
  relative — it is not lux.
- `app/auth/page.tsx` writes `display_name` to user metadata, but
  `handle_new_user()` reads `name`/`full_name`, so new profile names are `NULL`.
- Google sign-in and password reset are non-functional buttons.
