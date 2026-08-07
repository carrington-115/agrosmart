# SPDX-License-Identifier: MIT
"""Test-wide setup.

`Settings` deliberately refuses to start without its required variables, which is
correct in production and inconvenient here. Rather than loosening the settings
model — the strictness is the feature — the pure suite supplies obviously fake
values so it can run on a machine with no configuration at all, which is what
lets CI gate on it before any secret is available.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from pathlib import Path
from urllib.parse import urlsplit

import asyncpg
import pytest

#: Syntactically valid, semantically nowhere. Nothing in the pure suite opens a
#: connection or fetches a key; anything that would is marked `integration` and
#: gets real values from the environment.
_FAKE_ENV = {
    "AGRO_DATABASE_URL": "postgresql://agro_api:not-a-real-password@127.0.0.1:5432/nope",
    "AGRO_SUPABASE_URL": "https://example.supabase.co",
    "AGRO_TOKEN_PEPPER": "0" * 64,
}

#: The `.env` that `Settings.model_config` names, resolved from this file so it
#: does not depend on pytest's working directory.
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


def _load_env_file() -> None:
    """Apply `agroapi/.env` before the fakes below, if it exists.

    Not redundant with `model_config`'s `env_file`, and the reason is a precedence
    inversion that costs a whole test suite. pydantic-settings ranks the real
    environment ABOVE `.env`, and the `setdefault` loop below writes the fake DSN
    into the real environment — so a developer who follows the README's
    `cp .env.example .env` would find every integration test silently skipped,
    with the fake value winning over the file they had just configured. Skipped,
    not failed: the suite would report green while asserting nothing.

    Reading the file here restores pydantic's own order — shell over `.env` over
    fakes — for the values the fixtures actually branch on.
    """
    if not _ENV_FILE.is_file():
        return
    for line in _ENV_FILE.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, _, value = stripped.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


# Set at MODULE level, not in a fixture. pytest imports conftest before it imports
# any test module, and `agroapi.main` builds its app at import time — so by the
# time a fixture could run, the import has already failed. `setdefault` means a
# real integration environment still wins.
_load_env_file()
for _key, _value in _FAKE_ENV.items():
    os.environ.setdefault(_key, _value)

# Imported below the loop, not with the block above: `settings()` validates at
# first call and is cached for the process, so anything that reaches it before the
# environment is populated poisons every later test with a ValidationError.
from agroapi.config import settings  # noqa: E402
from agroapi.db.pool import check_schema, observed_columns, open_pool  # noqa: E402
from agroapi.db.types import DbPool  # noqa: E402


def _unavailable(reason: str) -> None:
    """Skip locally, fail in CI.

    A skip is right on a laptop: an integration suite that errors for anyone
    without Postgres running teaches contributors to ignore red, which costs more
    than the coverage is worth.

    A skip is exactly wrong in CI, where the database is provisioned as a service
    and its absence means the pipeline is broken. Without this, a container that
    failed to come up would turn every isolation and contract assertion into a
    silent `s` and report green — the failure mode where the tests that matter
    most stop running and nobody is told.
    """
    if os.environ.get("AGRO_REQUIRE_INTEGRATION_DB"):
        pytest.fail(f"AGRO_REQUIRE_INTEGRATION_DB is set but {reason}")
    pytest.skip(reason)


#: Hosts this suite is allowed to destroy. `db` is the compose service name, so a
#: run from inside a container resolves it; the rest are the loopback spellings.
_DISPOSABLE_HOSTS = frozenset({"localhost", "127.0.0.1", "::1", "db"})


def _refuse_remote_db(dsn: str) -> None:
    """Abort rather than let the integration suite run against a real database.

    The fixtures below `truncate public.sensor_readings`, `truncate
    public.device_tokens`, `truncate public.alerts`, `truncate public.user_settings`
    and `delete from public.sensors`. That is correct against the throwaway
    container and catastrophic anywhere else: it is a silent, unrecoverable wipe of
    exactly the telemetry the system exists to collect.

    The path there is short and entirely plausible. `_load_env_file` above reads
    `agroapi/.env` into the environment on purpose, so that a configured developer
    does not get silently-skipped tests. The moment that same `.env` holds the
    Supabase DSN — which is what you need to run the backend against the real
    project — `uv run pytest` points every truncate at production. Nothing else in
    the suite would object, and the damage is done before the first assertion.

    So the allowlist is on the *host*, and it fails rather than skips: a skip here
    would read as "no database configured" on the one run where the opposite is
    true. `AGRO_ALLOW_REMOTE_TEST_DB=1` exists for the case where the target really
    is a disposable remote (an ephemeral branch database, say) — it has to be typed
    deliberately, per invocation, which is the point.
    """
    if os.environ.get("AGRO_ALLOW_REMOTE_TEST_DB"):
        return
    host = urlsplit(dsn).hostname
    if host in _DISPOSABLE_HOSTS:
        return
    pytest.fail(
        f"refusing to run destructive integration tests against non-local host "
        f"{host!r}. These fixtures truncate sensor_readings, device_tokens, alerts "
        f"and user_settings. Point AGRO_DATABASE_URL at the throwaway database "
        f"(agroapi/scripts/setup_test_db.sh), or set AGRO_ALLOW_REMOTE_TEST_DB=1 "
        f"if this target really is disposable.",
        pytrace=False,
    )


@pytest.fixture
async def pool() -> AsyncIterator[DbPool]:
    """A pool against the migrated integration database.

    Bring one up with:
        docker compose -f docker-compose.test.yml up -d db
        bash agroapi/scripts/setup_test_db.sh

    Function-scoped, not session-scoped, and that is not a missed optimisation:
    pytest-asyncio runs each test in its own event loop, and a pool built in a
    session-scoped fixture belongs to a loop that is closed by the time the second
    test runs ("attached to a different loop"). `db_pool_min_size` is 0, so
    building one costs nothing until a connection is actually taken.
    """
    config = settings()
    if config.database_url.get_secret_value() == _FAKE_ENV["AGRO_DATABASE_URL"]:
        _unavailable("no AGRO_DATABASE_URL; see agroapi/scripts/setup_test_db.sh")

    # Before the pool, not after: connecting is itself the first irreversible step
    # once the DSN names production.
    _refuse_remote_db(config.database_url.get_secret_value())

    try:
        created = await open_pool(config)
    except (OSError, asyncpg.PostgresError) as exc:
        _unavailable(f"database unreachable: {type(exc).__name__}: {exc}")

    try:
        async with created.acquire() as conn:
            violations = check_schema(await observed_columns(conn))
    except (OSError, asyncpg.PostgresError) as exc:
        await created.close()
        _unavailable(f"database unreachable: {type(exc).__name__}: {exc}")

    if violations:
        await created.close()
        # A migration that was never pushed would otherwise surface as a dozen
        # confusing insert failures rather than one sentence naming the column.
        detail = ", ".join(f"{v.table}.{v.column} {v.problem}" for v in violations)
        _unavailable(f"schema out of date, run setup_test_db.sh: {detail}")

    try:
        yield created
    finally:
        await created.close()
