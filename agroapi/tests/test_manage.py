# SPDX-License-Identifier: MIT
"""The dashboard's writes, and the isolation they must not break.

The read tests prove a tenant cannot *see* another's rows. These prove they cannot
*change* them either — a separate guarantee, carried by the `with check` half of
the RLS policies rather than the `using` half, and worth its own assertions.

Also covers device-token minting, which until now existed only as a CLI script.
That gap is why a working deployment could have no data in it: there was no path
from "I registered a node" to "the node can post readings" without shell access.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from uuid import UUID, uuid4

import httpx
import pytest

from agroapi.auth import device
from agroapi.config import settings
from agroapi.db.session import service_scope
from agroapi.db.types import DbPool
from agroapi.main import create_app
from tests.test_read import (
    OWNER_A,
    OWNER_B,
    SENSOR_A,
    SENSOR_B,
    _reset_farm_names,
    _reset_sensors,
    client_for,
    insert_alert,
)


@pytest.fixture
async def clean_db(pool: DbPool) -> AsyncIterator[None]:
    async with pool.acquire() as conn:
        await conn.execute("truncate public.sensor_readings restart identity cascade")
        await conn.execute("truncate public.device_tokens cascade")
        await conn.execute("truncate public.alerts cascade")
        await conn.execute("truncate public.user_settings cascade")
        # Sensors beyond the two the setup script registers are created by tests
        # here, so remove them rather than leaking into the next test.
        await _reset_sensors(conn)
        # These tests rename farms and edit profiles, which other modules assert
        # on. Restoring here rather than in a teardown means a test that fails
        # part-way still leaves the next one a clean slate.
        await _reset_farm_names(conn)
    yield


@pytest.fixture
async def as_a(pool: DbPool) -> AsyncIterator[httpx.AsyncClient]:
    async with client_for(pool, OWNER_A) as created:
        yield created


@pytest.fixture
async def as_b(pool: DbPool) -> AsyncIterator[httpx.AsyncClient]:
    async with client_for(pool, OWNER_B) as created:
        yield created


# --------------------------------------------------------------------- sensors


@pytest.mark.integration
async def test_a_registered_sensor_starts_offline_because_it_has_never_reported(
    as_a: httpx.AsyncClient, clean_db: None
) -> None:
    """Not a separate "pending" state. A null `last_seen_at` already means exactly
    this, and the read API derives `offline` from it."""
    response = await as_a.post("/v1/sensors", json={"sensorId": "AGS-900", "sensorTag": "new"})

    assert response.status_code == 201
    body = response.json()
    assert body["sensorId"] == "AGS-900"
    assert body["status"] == "offline"
    assert "latest" not in body


@pytest.mark.integration
async def test_a_registered_code_is_uppercased(as_a: httpx.AsyncClient, clean_db: None) -> None:
    """The firmware bakes in an uppercase code and ingest resolves case-insensitively,
    so storing one canonical form keeps the sensors page from showing two rows that
    look identical."""
    response = await as_a.post("/v1/sensors", json={"sensorId": "ags-901", "sensorTag": "x"})
    assert response.json()["sensorId"] == "AGS-901"


@pytest.mark.integration
async def test_registering_the_same_code_twice_is_a_typed_conflict(
    as_a: httpx.AsyncClient, clean_db: None
) -> None:
    payload = {"sensorId": "AGS-902", "sensorTag": "dup"}
    assert (await as_a.post("/v1/sensors", json=payload)).status_code == 201

    second = await as_a.post("/v1/sensors", json=payload)
    assert second.status_code == 409
    assert second.json()["detail"]["code"] == "SENSOR_ALREADY_REGISTERED"


@pytest.mark.integration
async def test_two_tenants_may_both_register_the_same_code(
    as_a: httpx.AsyncClient, as_b: httpx.AsyncClient, clean_db: None
) -> None:
    """`sensors_owner_code_unique` is per owner, not global. Two farms can both own
    an 'AGS-903', and the uniqueness constraint must not make one of them fail."""
    payload = {"sensorId": "AGS-903", "sensorTag": "shared-code"}
    assert (await as_a.post("/v1/sensors", json=payload)).status_code == 201
    assert (await as_b.post("/v1/sensors", json=payload)).status_code == 201


@pytest.mark.integration
async def test_a_malformed_code_is_rejected(as_a: httpx.AsyncClient, clean_db: None) -> None:
    """The code routes `/dashboard/sensors/[sensorID]`, so it has to stay URL-safe."""
    response = await as_a.post("/v1/sensors", json={"sensorId": "no spaces", "sensorTag": "x"})
    assert response.status_code == 422


@pytest.mark.integration
async def test_an_unknown_key_in_the_body_is_rejected(
    as_a: httpx.AsyncClient, clean_db: None
) -> None:
    """`extra="forbid"`. A field this service has never heard of means the client
    and server disagree, and silently dropping it loses data."""
    response = await as_a.post(
        "/v1/sensors", json={"sensorId": "AGS-904", "sensorTag": "x", "surprise": 1}
    )
    assert response.status_code == 422


@pytest.mark.integration
async def test_a_sensor_can_be_deleted(as_a: httpx.AsyncClient, clean_db: None) -> None:
    await as_a.post("/v1/sensors", json={"sensorId": "AGS-905", "sensorTag": "gone"})
    assert (await as_a.delete("/v1/sensors/AGS-905")).status_code == 204
    assert (await as_a.get("/v1/sensors/AGS-905")).status_code == 404


@pytest.mark.integration
async def test_deleting_an_unknown_sensor_is_a_404(
    as_a: httpx.AsyncClient, clean_db: None
) -> None:
    response = await as_a.delete("/v1/sensors/NOPE-999")
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "SENSOR_NOT_FOUND"


# --------------------------------------------------------------------- tokens


@pytest.mark.integration
async def test_minting_a_token_returns_a_usable_credential_once(
    as_a: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    """The plaintext exists only in this response. Only an HMAC is stored, and
    `device_tokens` is deny-all under RLS, so no endpoint can produce it again."""
    response = await as_a.post(f"/v1/sensors/{SENSOR_A}/tokens", json={"label": "bench"})

    assert response.status_code == 201
    body = response.json()
    parsed = device.parse(body["token"])
    assert parsed is not None, "the minted token must parse as ags_v1_<id>_<secret>"
    assert parsed.token_id == body["tokenId"]

    # The secret is not recoverable from the database.
    async with service_scope(pool) as conn:
        stored = await conn.fetchrow(
            "select secret_hash from public.device_tokens where token_id = $1",
            body["tokenId"],
        )
    assert stored is not None
    assert body["token"].encode() not in bytes(stored["secret_hash"])


@pytest.mark.integration
async def test_a_minted_token_actually_authenticates_ingest(
    as_a: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    """The point of the endpoint: dashboard-minted credentials must work on the
    device path, or "bind the sensor" is still a shell operation."""
    token = (await as_a.post(f"/v1/sensors/{SENSOR_A}/tokens", json={})).json()["token"]

    app = create_app()
    app.state.pool = pool
    from agroapi.auth.supabase_jwt import JwtVerifier

    app.state.verifier = JwtVerifier(settings())
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as device_client:
        response = await device_client.post(
            "/v1/ingest",
            json={
                "v": 1,
                "sensorId": SENSOR_A,
                "readings": {"temperature": 24.8},
                "quality": {"npkEstimated": True, "stabilising": False, "soilDry": False},
            },
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 201
    assert response.json()["accepted"] == 1


@pytest.mark.integration
async def test_a_token_cannot_be_minted_for_another_tenants_sensor(
    as_a: httpx.AsyncClient, clean_db: None
) -> None:
    """Ownership is proven on the user-scoped connection before the service
    connection — which bypasses RLS — is touched at all."""
    response = await as_a.post(f"/v1/sensors/{SENSOR_B}/tokens", json={})
    assert response.status_code == 404


# --------------------------------------------------------------------- alerts


@pytest.mark.integration
async def test_an_alert_can_be_resolved(
    as_a: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    alert_id = await insert_alert(pool, OWNER_A, "Needs attention")
    response = await as_a.patch(f"/v1/alerts/{alert_id}", json={"state": "accepted"})
    assert response.status_code == 200
    assert response.json()["state"] == "accepted"


@pytest.mark.integration
async def test_resolving_an_unknown_alert_is_a_typed_404(
    as_a: httpx.AsyncClient, clean_db: None
) -> None:
    response = await as_a.patch(f"/v1/alerts/{uuid4()}", json={"state": "accepted"})
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "ALERT_NOT_FOUND"


@pytest.mark.integration
async def test_another_tenants_alert_cannot_be_resolved(
    as_a: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    """The `using` clause hides it from the UPDATE, so this is a 404 rather than a
    silent no-op that would have reported success."""
    alert_id = await insert_alert(pool, OWNER_B, "Owner B alert")
    assert (
        await as_a.patch(f"/v1/alerts/{alert_id}", json={"state": "accepted"})
    ).status_code == 404


@pytest.mark.integration
async def test_an_invalid_alert_state_is_rejected(
    as_a: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    alert_id = await insert_alert(pool, OWNER_A, "Needs attention")
    response = await as_a.patch(f"/v1/alerts/{alert_id}", json={"state": "banana"})
    assert response.status_code == 422


# --------------------------------------------------------------------- me


@pytest.mark.integration
async def test_a_partial_profile_update_leaves_other_fields_alone(
    as_a: httpx.AsyncClient, clean_db: None
) -> None:
    """`coalesce`, not `set x = excluded.x`. Otherwise "change my phone number"
    becomes "erase my address"."""
    await as_a.put("/v1/me", json={"profile": {"name": "Asha", "address": "Plot 14"}})
    await as_a.put("/v1/me", json={"profile": {"phone": "+910000000000"}})

    profile = (await as_a.get("/v1/me")).json()["profile"]
    assert profile["name"] == "Asha"
    assert profile["address"] == "Plot 14"
    assert profile["phone"] == "+910000000000"


@pytest.mark.integration
async def test_a_farm_update_persists(as_a: httpx.AsyncClient, clean_db: None) -> None:
    response = await as_a.put(
        "/v1/me", json={"farm": {"farmName": "Renamed Farm", "farmSize": 12.5}}
    )
    assert response.status_code == 200
    farm = response.json()["farm"]
    assert farm["farmName"] == "Renamed Farm"
    assert farm["farmSize"] == 12.5


@pytest.mark.integration
async def test_a_farm_update_does_not_touch_another_tenants_farm(
    as_a: httpx.AsyncClient, as_b: httpx.AsyncClient, clean_db: None
) -> None:
    await as_a.put("/v1/me", json={"farm": {"farmName": "A renamed"}})
    assert (await as_b.get("/v1/me")).json()["farm"]["farmName"] == "Test Farm B"


# --------------------------------------------------------------------- settings


@pytest.mark.integration
async def test_a_single_setting_can_be_toggled(as_a: httpx.AsyncClient, clean_db: None) -> None:
    response = await as_a.put("/v1/me/settings", json={"alerts_email": True})
    assert response.status_code == 200
    body = response.json()
    assert body["alerts_email"] is True
    # The others keep their documented defaults rather than collapsing to false.
    assert body["reports_weekly"] is True
    assert body["alerts_delete_ignored_after_days"] == 14


@pytest.mark.integration
async def test_turning_a_setting_off_is_distinguishable_from_not_mentioning_it(
    as_a: httpx.AsyncClient, clean_db: None
) -> None:
    """`exclude_unset`, not `exclude_none`. Every one of these is a boolean, so
    `false` is a value the user chose and must not be dropped."""
    await as_a.put("/v1/me/settings", json={"reports_weekly": False})
    assert (await as_a.get("/v1/me")).json()["settings"]["reports_weekly"] is False


@pytest.mark.integration
async def test_settings_survive_a_second_partial_update(
    as_a: httpx.AsyncClient, clean_db: None
) -> None:
    await as_a.put("/v1/me/settings", json={"alerts_sms": True})
    await as_a.put("/v1/me/settings", json={"reports_monthly": False})

    settings_body = (await as_a.get("/v1/me")).json()["settings"]
    assert settings_body["alerts_sms"] is True
    assert settings_body["reports_monthly"] is False


@pytest.mark.integration
async def test_settings_are_not_shared_across_tenants(
    as_a: httpx.AsyncClient, as_b: httpx.AsyncClient, clean_db: None
) -> None:
    await as_a.put("/v1/me/settings", json={"alerts_sms": True})
    assert (await as_b.get("/v1/me")).json()["settings"]["alerts_sms"] is False


@pytest.mark.integration
async def test_an_out_of_range_retention_is_rejected(
    as_a: httpx.AsyncClient, clean_db: None
) -> None:
    response = await as_a.put(
        "/v1/me/settings", json={"alerts_delete_ignored_after_days": 9999}
    )
    assert response.status_code == 422


@pytest.mark.integration
async def test_an_unknown_setting_key_is_rejected(
    as_a: httpx.AsyncClient, clean_db: None
) -> None:
    """A preference that appears to save and does not is worse than an error."""
    response = await as_a.put("/v1/me/settings", json={"make_it_rain": True})
    assert response.status_code == 422


@pytest.mark.integration
async def test_writes_require_authentication(pool: DbPool) -> None:
    from agroapi.auth.supabase_jwt import JwtVerifier

    app = create_app()
    app.state.pool = pool
    app.state.verifier = JwtVerifier(settings())
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as anon:
        response = await anon.post(
            "/v1/sensors", json={"sensorId": "AGS-999", "sensorTag": "x"}
        )
    assert response.status_code == 401


def test_owner_ids_are_the_ones_the_setup_script_registers() -> None:
    """Pure guard: if setup_test_db.sh changes these, every isolation test above
    silently starts asserting nothing."""
    assert UUID("00000000-0000-0000-0000-000000000001") == OWNER_A
    assert UUID("00000000-0000-0000-0000-000000000002") == OWNER_B
