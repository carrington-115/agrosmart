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

# Set at MODULE level, not in a fixture. pytest imports conftest before it imports
# any test module, and `agroapi.main` builds its app at import time — so by the
# time a fixture could run, the import has already failed. `setdefault` means a
# real integration environment still wins.
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


@pytest.fixture
async def pool() -> AsyncIterator[DbPool]:
    """A pool against the migrated integration database.

    Bring one up with:
        docker compose --profile test up -d db
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
