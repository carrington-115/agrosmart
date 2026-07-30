# SPDX-License-Identifier: MIT
"""Health endpoints, over a real ASGI transport.

Route registration is asserted by calling the endpoint rather than by inspecting
`app.routes` — FastAPI nests included routers behind a wrapper object, so
introspection is easy to read wrongly. A request either works or it does not.
"""

from __future__ import annotations

import httpx
import pytest

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
