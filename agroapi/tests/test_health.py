# SPDX-License-Identifier: MIT
"""Health endpoints, over a real ASGI transport.

Route registration is asserted by calling the endpoint rather than by inspecting
`app.routes` — FastAPI nests included routers behind a wrapper object, so
introspection is easy to read wrongly. A request either works or it does not.
"""

from __future__ import annotations

import httpx
import pytest

from agroapi.db.pool import SCHEMA_CONTRACT, check_schema, observed_columns
from agroapi.db.types import DbPool
from agroapi.main import create_app


@pytest.fixture
def client() -> httpx.AsyncClient:
    app = create_app()
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    )


async def test_liveness_is_reachable_without_a_database(
    client: httpx.AsyncClient,
) -> None:
    """No lifespan is run here, so there is no pool at all.

    That is the point: liveness must not depend on anything external, or a
    Supabase blip restarts every pod and adds a reconnect storm to an outage that
    was previously survivable.
    """
    async with client:
        response = await client.get("/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_liveness_is_mounted_under_the_version_prefix(
    client: httpx.AsyncClient,
) -> None:
    """Unversioned paths must not answer. The payload itself carries a version,
    and the URL should not disagree with it."""
    async with client:
        response = await client.get("/health")

    assert response.status_code == 404


async def test_openapi_documents_the_contract_rules(client: httpx.AsyncClient) -> None:
    """The firmware author reads this schema to implement Phase F, so the three
    contract rules belong in the served description, not only in the repo."""
    async with client:
        response = await client.get("/openapi.json")

    assert response.status_code == 200
    description = response.json()["info"]["description"]
    assert "quality" in description
    assert "NTP" in description


@pytest.mark.integration
async def test_schema_check_sees_the_tables_without_holding_privileges_on_them(
    pool: DbPool,
) -> None:
    """Readiness must describe the schema, not the caller's access to it.

    In production the service connects as `agro_api`, which is `noinherit`, does
    not own these tables and holds no direct grants — by design, so that a
    forgotten scope call fails closed rather than serving the wrong tenant. Every
    other test reaches the tables through `SET ROLE`, which is exactly what the
    readiness probe does not do, so this privilege state is otherwise unreachable
    here and unreachable in CI, where the connection is `postgres`.

    The second assertion is the whole reason this test exists: it pins the trap.
    `information_schema` genuinely cannot see these tables from this role, so a
    readiness probe built on it would report a fully migrated database as seven
    missing tables.

    Rolled back rather than cleaned up, so the throwaway role never outlives the
    test even if the assertions fail. `CREATE ROLE` is transactional in Postgres.
    """
    async with pool.acquire() as conn:
        transaction = conn.transaction()
        await transaction.start()
        try:
            await conn.execute("create role probe_without_privileges noinherit")
            await conn.execute("set local role probe_without_privileges")

            observed = await observed_columns(conn)
            through_information_schema = await conn.fetch(
                """
                select table_name
                from information_schema.columns
                where table_schema = 'public' and table_name = any($1::text[])
                """,
                list(SCHEMA_CONTRACT),
            )
        finally:
            await transaction.rollback()

    assert check_schema(observed) == []
    assert through_information_schema == []
