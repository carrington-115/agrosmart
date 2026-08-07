# SPDX-License-Identifier: MIT
"""The dashboard read API, and the guarantees it is supposed to carry.

Two things are asserted here that nothing in this codebase has ever asserted
before:

* **Cross-tenant isolation, per endpoint.** Not once, per endpoint — that is the
  entire justification for routing dashboard reads through `user_scope` and RLS
  rather than hand-written `where owner_id` clauses. A single global test would
  pass while one endpoint quietly forgot.

* **Absent stays absent on the way out.** A node whose 4-in-1 board is unplugged
  must produce a payload with no `phWater` key at all. `null` would be tolerable;
  `0.0` would be a plausible-looking acid reading indistinguishable from a real one.

`current_user` is overridden rather than exercised, because verifying a real
Supabase JWT needs JWKS over the network and this suite must run without an
identity provider. Everything below the override is the real thing: `user_conn`,
`user_scope`, the `set_config` calls and the policies themselves.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import UUID

import httpx
import pytest

from agroapi.auth.supabase_jwt import Claims, JwtVerifier
from agroapi.config import settings
from agroapi.db.session import service_scope
from agroapi.db.types import DbPool
from agroapi.deps import current_user
from agroapi.main import create_app

FIXTURES = Path(__file__).parent / "fixtures"

#: The two owners `scripts/setup_test_db.sh` registers, each with one sensor.
OWNER_A = UUID("00000000-0000-0000-0000-000000000001")
OWNER_B = UUID("00000000-0000-0000-0000-000000000002")
SENSOR_A = "AGS-001"
SENSOR_B = "AGS-002"


def fixture(name: str) -> dict[str, Any]:
    payload: dict[str, Any] = json.loads((FIXTURES / name).read_text(encoding="utf-8"))
    return payload


@pytest.fixture
async def clean_db(pool: DbPool) -> AsyncIterator[None]:
    async with pool.acquire() as conn:
        await conn.execute("truncate public.sensor_readings restart identity cascade")
        await conn.execute("truncate public.alerts cascade")
        await conn.execute("truncate public.user_settings cascade")
        await _reset_sensors(conn)
        await conn.execute(
            "update public.sensors set last_seen_at = null, last_reading_at = null, "
            "last_rssi = null, last_uptime_seconds = null, firmware_version = null"
        )
        await _reset_farm_names(conn)
    yield


async def _reset_sensors(conn: Any) -> None:
    """Leave exactly the two sensors `setup_test_db.sh` registers.

    Scoped to (owner, code) PAIRS, not codes. `sensors_owner_code_unique` is per
    owner, so an `AGS-002` owned by A and an `AGS-002` owned by B are both valid
    rows — and `supabase/seed.sql`, which can legitimately have been applied to
    this same database, gives owner A the whole AGS-001..008 range. Deleting by
    code alone would leave A holding a second AGS-002 and quietly break every
    "one sensor per owner" assertion below.
    """
    await conn.execute(
        """
        delete from public.sensors
        where not (
            (owner_id = $1 and sensor_code = $2)
            or (owner_id = $3 and sensor_code = $4)
        )
        """,
        OWNER_A,
        SENSOR_A,
        OWNER_B,
        SENSOR_B,
    )


async def _reset_farm_names(conn: Any) -> None:
    """Restore the farm names `setup_test_db.sh` seeds.

    `test_manage.py` renames them, and pytest does not guarantee file order, so
    without this a rename in one module makes an assertion in another fail
    depending on collection order — the worst kind of flake, because it looks like
    a real regression in whichever test happens to run second.
    """
    await conn.execute(
        "update public.farms set farm_name = 'Test Farm A', farm_type = null, "
        "farm_size = null, farm_zones = null, country = null, state = null, "
        "city = null, address = null where owner_id = $1",
        OWNER_A,
    )
    await conn.execute(
        "update public.farms set farm_name = 'Test Farm B' where owner_id = $1",
        OWNER_B,
    )
    await conn.execute("update public.profiles set name = null, phone = null, address = null")


def client_for(pool: DbPool, owner: UUID) -> httpx.AsyncClient:
    """An app scoped to one owner.

    The override replaces only token verification. `user_conn` still builds a real
    RLS-scoped connection from the returned `sub`, so the policies are what decide
    what these requests can see.
    """
    app = create_app()
    app.state.pool = pool
    app.state.verifier = JwtVerifier(settings())
    app.dependency_overrides[current_user] = lambda: Claims(
        sub=str(owner), email="owner@example.test", role="authenticated"
    )
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


@pytest.fixture
async def as_a(pool: DbPool) -> AsyncIterator[httpx.AsyncClient]:
    async with client_for(pool, OWNER_A) as created:
        yield created


@pytest.fixture
async def as_b(pool: DbPool) -> AsyncIterator[httpx.AsyncClient]:
    async with client_for(pool, OWNER_B) as created:
        yield created


async def insert_reading(
    pool: DbPool,
    sensor_code: str,
    *,
    recorded_at: datetime | None = None,
    ph_water: float | None = 7.1,
    water_level: float | None = 63,
    salinity: float | None = 0.38,
    moisture: float | None = 42.5,
    soil_dry: bool = False,
    stabilising: bool = False,
    source: str = "device",
    seen: datetime | None = None,
) -> None:
    """Write one reading and set the device state that liveness derives from.

    `last_seen_at` is set here because status is derived from it. Without it every
    sensor reads `offline` and every assertion about `normal` or `warning` would be
    testing the offline branch by accident.
    """
    at = recorded_at or datetime.now(UTC)
    async with service_scope(pool) as conn:
        sensor_id = await conn.fetchval(
            "select id from public.sensors where sensor_code = $1", sensor_code
        )
        await conn.execute(
            """
            insert into public.sensor_readings (
                sensor_id, recorded_at, received_at, recorded_at_source,
                temperature, moisture, salinity, ph_soil, ph_water,
                water_temperature, sunlight, water_level,
                nitrogen, phosphorus, potassium,
                npk_estimated, stabilising, soil_dry
            ) values (
                $1, $2, now(), $3::public.reading_time_source,
                24.8, $4, $5, 6.80, $6,
                23.4, 780, $7,
                95, 52, 210,
                true, $8, $9
            )
            """,
            sensor_id,
            at,
            source,
            moisture,
            salinity,
            ph_water,
            water_level,
            stabilising,
            soil_dry,
        )
        await conn.execute(
            "update public.sensors set last_seen_at = $2, last_reading_at = $2, "
            "last_rssi = -62, firmware_version = '0.1.0' where id = $1",
            sensor_id,
            seen or datetime.now(UTC),
        )


async def insert_alert(pool: DbPool, owner: UUID, title: str) -> UUID:
    async with service_scope(pool) as conn:
        row = await conn.fetchrow(
            "insert into public.alerts (owner_id, title, severity, label, state) "
            "values ($1, $2, 'destructive', 'Urgent', 'open') returning id",
            owner,
            title,
        )
    assert row is not None
    return UUID(str(row["id"]))


# --------------------------------------------------------------------- thresholds


@pytest.mark.integration
async def test_thresholds_are_served_so_the_frontend_need_not_retype_them(
    as_a: httpx.AsyncClient,
) -> None:
    """The endpoint that lets `domain/thresholds.py` be the only home for these."""
    response = await as_a.get("/v1/thresholds")
    assert response.status_code == 200
    body = response.json()
    assert body["phSoil"] == {"low": 5.5, "high": 8.0}
    assert body["phWater"] == {"low": 6.0, "high": 7.5}
    assert body["moisture"] == {"low": 30.0, "high": 70.0}


# --------------------------------------------------------------------- sensors


@pytest.mark.integration
async def test_a_registered_sensor_appears_even_with_no_readings(
    as_a: httpx.AsyncClient, clean_db: None
) -> None:
    """LEFT join, not INNER. A node that has been added but never reported is the
    case the dashboard most needs to show."""
    response = await as_a.get("/v1/sensors")
    assert response.status_code == 200
    body = response.json()
    assert [s["sensorId"] for s in body] == [SENSOR_A]
    assert body[0]["status"] == "offline"
    assert "latest" not in body[0]


@pytest.mark.integration
async def test_a_recently_reporting_sensor_is_normal(
    as_a: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    await insert_reading(pool, SENSOR_A)
    body = (await as_a.get("/v1/sensors")).json()
    assert body[0]["status"] == "normal"
    assert body[0]["latest"]["phSoil"] == 6.8
    assert body[0]["firmwareVersion"] == "0.1.0"


@pytest.mark.integration
async def test_a_stale_sensor_is_offline(
    as_a: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    """Derived from `last_seen_at` at read time.

    This state was previously impossible to represent at all: nothing writes
    `offline` to `sensors.status`, because a device that stops reporting never
    calls ingest again to say so.
    """
    stale = datetime.now(UTC) - timedelta(hours=2)
    await insert_reading(pool, SENSOR_A, seen=stale)
    body = (await as_a.get("/v1/sensors")).json()
    assert body[0]["status"] == "offline"


@pytest.mark.integration
async def test_an_out_of_band_reading_is_a_warning_and_names_the_breach(
    as_a: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    await insert_reading(pool, SENSOR_A, moisture=5.0)
    body = (await as_a.get("/v1/sensors")).json()
    assert body[0]["status"] == "warning"
    breach = next(b for b in body[0]["breaches"] if b["metric"] == "moisture")
    assert breach["direction"] == "low"
    assert breach["band"] == {"low": 30.0, "high": 70.0}


@pytest.mark.integration
async def test_an_absent_reading_is_an_absent_key_not_zero(
    as_a: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    """Contract rule 1, on the way out.

    An unplugged 4-in-1 board reports no water pH and no water level. Serialising
    those as 0.0 would publish a plausible acid reading; serialising them as null
    would still invite `?? 0` downstream. They are omitted.
    """
    await insert_reading(pool, SENSOR_A, ph_water=None, water_level=None)
    latest = (await as_a.get("/v1/sensors")).json()[0]["latest"]

    assert "phWater" not in latest
    assert "waterLevel" not in latest
    # The soil probe was fine, so its reading is present — proving the omission is
    # about that board and not a blanket drop.
    assert latest["phSoil"] == 6.8


@pytest.mark.integration
async def test_there_is_no_merged_ph_field(
    as_a: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    """The database still has a generated `ph` column for the pre-cutover frontend.
    The API must not carry it: it merges two different measurements taken in
    different media by different hardware."""
    await insert_reading(pool, SENSOR_A)
    latest = (await as_a.get("/v1/sensors")).json()[0]["latest"]
    assert "ph" not in latest


@pytest.mark.integration
async def test_dry_soil_is_reported_without_becoming_a_fault(
    as_a: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    await insert_reading(pool, SENSOR_A, salinity=0.0, soil_dry=True, moisture=50.0)
    sensor = (await as_a.get("/v1/sensors")).json()[0]

    assert sensor["latest"]["quality"]["soilDry"] is True
    assert sensor["status"] == "normal"
    assert [b["metric"] for b in sensor["breaches"]] == []


@pytest.mark.integration
async def test_the_quality_block_is_reported_in_full(
    as_a: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    await insert_reading(pool, SENSOR_A)
    quality = (await as_a.get("/v1/sensors")).json()[0]["latest"]["quality"]
    assert quality == {"npkEstimated": True, "stabilising": False, "soilDry": False}


@pytest.mark.integration
async def test_a_server_stamped_reading_says_so(
    as_a: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    """So a UI can avoid presenting an arrival time as a measurement time."""
    await insert_reading(pool, SENSOR_A, source="server")
    latest = (await as_a.get("/v1/sensors")).json()[0]["latest"]
    assert latest["recordedAtSource"] == "server"


@pytest.mark.integration
async def test_one_sensor_by_code_is_case_insensitive(
    as_a: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    await insert_reading(pool, SENSOR_A)
    response = await as_a.get(f"/v1/sensors/{SENSOR_A.lower()}")
    assert response.status_code == 200
    assert response.json()["sensorId"] == SENSOR_A


@pytest.mark.integration
async def test_an_unknown_code_is_a_typed_404(as_a: httpx.AsyncClient) -> None:
    response = await as_a.get("/v1/sensors/NOPE-999")
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "SENSOR_NOT_FOUND"


# --------------------------------------------------------------------- readings


@pytest.mark.integration
async def test_readings_come_back_newest_first_and_bounded(
    as_a: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    base = datetime.now(UTC)
    for minutes in range(5):
        await insert_reading(pool, SENSOR_A, recorded_at=base - timedelta(minutes=minutes))

    body = (await as_a.get(f"/v1/sensors/{SENSOR_A}/readings?limit=3")).json()
    assert len(body["items"]) == 3
    times = [item["recordedAt"] for item in body["items"]]
    assert times == sorted(times, reverse=True)


@pytest.mark.integration
async def test_the_cursor_walks_the_history_without_repeating(
    as_a: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    """Keyset pagination. An offset would repeat rows as new readings arrive at the
    front of a list that is being walked backwards."""
    base = datetime.now(UTC)
    for minutes in range(6):
        await insert_reading(pool, SENSOR_A, recorded_at=base - timedelta(minutes=minutes))

    first = (await as_a.get(f"/v1/sensors/{SENSOR_A}/readings?limit=3")).json()
    assert first["nextCursor"]

    second = (
        await as_a.get(f"/v1/sensors/{SENSOR_A}/readings?limit=3&cursor={first['nextCursor']}")
    ).json()

    seen = [i["recordedAt"] for i in first["items"]] + [
        i["recordedAt"] for i in second["items"]
    ]
    assert len(seen) == len(set(seen)) == 6


@pytest.mark.integration
async def test_a_malformed_cursor_returns_the_first_page_rather_than_an_error(
    as_a: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    await insert_reading(pool, SENSOR_A)
    response = await as_a.get(f"/v1/sensors/{SENSOR_A}/readings?cursor=garbage")
    assert response.status_code == 200
    assert len(response.json()["items"]) == 1


@pytest.mark.integration
async def test_the_series_endpoint_returns_oldest_first_for_charting(
    as_a: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    base = datetime.now(UTC)
    for minutes in range(4):
        await insert_reading(pool, SENSOR_A, recorded_at=base - timedelta(minutes=minutes))

    body = (await as_a.get("/v1/readings?hours=1")).json()
    times = [item["recordedAt"] for item in body]
    assert times == sorted(times)


@pytest.mark.integration
async def test_the_series_window_excludes_older_readings(
    as_a: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    await insert_reading(pool, SENSOR_A, recorded_at=datetime.now(UTC) - timedelta(days=3))
    assert (await as_a.get("/v1/readings?hours=1")).json() == []


# --------------------------------------------------------------------- alerts


@pytest.mark.integration
async def test_stored_and_derived_alerts_are_returned_together(
    as_a: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    """Nothing in this system inserts an alert, so derived ones are the only reason
    the page is not permanently empty on a real deployment."""
    await insert_alert(pool, OWNER_A, "Stored alert")
    await insert_reading(pool, SENSOR_A, moisture=5.0)

    body = (await as_a.get("/v1/alerts")).json()
    derived = [a for a in body if a["derived"]]
    stored = [a for a in body if not a["derived"]]

    assert any(a["label"] == "Soil moisture" for a in derived)
    assert [a["title"] for a in stored] == ["Stored alert"]


@pytest.mark.integration
async def test_a_derived_alert_carries_steps_and_cannot_be_resolved(
    as_a: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    await insert_reading(pool, SENSOR_A, moisture=5.0)
    derived = next(a for a in (await as_a.get("/v1/alerts")).json() if a["derived"])

    assert derived["steps"]
    assert derived["state"] == "open"
    # Its id is not a UUID, so PATCH cannot reach it — there is no row to update.
    response = await as_a.patch(f"/v1/alerts/{derived['id']}", json={"state": "accepted"})
    assert response.status_code == 422


@pytest.mark.integration
async def test_alerts_of_every_state_are_returned(
    as_a: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    """Unfiltered by design: pinning `state = 'open'` in SQL is what made the
    dashboard's own status filter unable to show a resolved alert."""
    alert_id = await insert_alert(pool, OWNER_A, "Resolved alert")
    await as_a.patch(f"/v1/alerts/{alert_id}", json={"state": "accepted"})

    states = {a["state"] for a in (await as_a.get("/v1/alerts")).json() if not a["derived"]}
    assert "accepted" in states


# --------------------------------------------------------------------- me


@pytest.mark.integration
async def test_me_returns_settings_defaults_when_none_were_ever_saved(
    as_a: httpx.AsyncClient, clean_db: None
) -> None:
    """A missing row and a default row must be indistinguishable, or the settings
    page looks different for a reason the user cannot explain."""
    body = (await as_a.get("/v1/me")).json()
    assert body["settings"]["reports_weekly"] is True
    assert body["settings"]["alerts_email"] is False
    assert body["settings"]["alerts_delete_ignored_after_days"] == 14


@pytest.mark.integration
async def test_me_returns_the_owners_farm(as_a: httpx.AsyncClient, clean_db: None) -> None:
    body = (await as_a.get("/v1/me")).json()
    assert body["farm"]["farmName"] == "Test Farm A"


# --------------------------------------------------------------------- isolation
#
# Per endpoint, not once. This is the whole reason dashboard reads go through
# `user_scope` and RLS instead of hand-written ownership predicates, and it is the
# first time that claim is actually tested.


@pytest.mark.integration
async def test_sensors_are_not_visible_across_tenants(
    as_a: httpx.AsyncClient, as_b: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    await insert_reading(pool, SENSOR_B)

    a_codes = {s["sensorId"] for s in (await as_a.get("/v1/sensors")).json()}
    b_codes = {s["sensorId"] for s in (await as_b.get("/v1/sensors")).json()}

    assert a_codes == {SENSOR_A}
    assert b_codes == {SENSOR_B}


@pytest.mark.integration
async def test_one_tenants_sensor_is_a_404_for_another(as_a: httpx.AsyncClient) -> None:
    """Not a 403. Under RLS "does not exist" and "is not yours" are the same
    observation, which leaks nothing about what other tenants own."""
    response = await as_a.get(f"/v1/sensors/{SENSOR_B}")
    assert response.status_code == 404


@pytest.mark.integration
async def test_readings_are_not_visible_across_tenants(
    as_a: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    await insert_reading(pool, SENSOR_B)
    assert (await as_a.get(f"/v1/sensors/{SENSOR_B}/readings")).status_code == 404
    assert (await as_a.get("/v1/readings?hours=24")).json() == []


@pytest.mark.integration
async def test_alerts_are_not_visible_across_tenants(
    as_a: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    await insert_alert(pool, OWNER_B, "Owner B alert")
    titles = {a["title"] for a in (await as_a.get("/v1/alerts")).json()}
    assert "Owner B alert" not in titles


@pytest.mark.integration
async def test_me_is_not_visible_across_tenants(
    as_a: httpx.AsyncClient, as_b: httpx.AsyncClient, clean_db: None
) -> None:
    a_farm = (await as_a.get("/v1/me")).json()["farm"]["farmName"]
    b_farm = (await as_b.get("/v1/me")).json()["farm"]["farmName"]
    assert a_farm == "Test Farm A"
    assert b_farm == "Test Farm B"


@pytest.mark.integration
async def test_an_unauthenticated_read_is_rejected(pool: DbPool) -> None:
    """No override here — the real `current_user` runs and finds no bearer token."""
    app = create_app()
    app.state.pool = pool
    app.state.verifier = JwtVerifier(settings())
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as anon:
        response = await anon.get("/v1/sensors")
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "NOT_AUTHENTICATED"
