# SPDX-License-Identifier: MIT
"""The ingest endpoint, and the wire contract it is supposed to honour.

Two layers, deliberately separated:

* The pure tests need nothing at all and assert the thing most likely to be
  wrong and least likely to be noticed — that the bytes the firmware actually
  emits decode into the model this service believes in. `extra="forbid"` turns
  a firmware field this schema has never heard of into a loud 422 here rather
  than a silently dropped column in production.

* The integration tests assert the properties the contract calls load-bearing:
  absent is not zero, dry soil is data rather than a fault, an implausible clock
  is refused rather than papered over, and a token for one sensor cannot write to
  another.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any
from uuid import UUID

import httpx
import pytest

from agroapi.auth import device
from agroapi.auth.supabase_jwt import JwtVerifier
from agroapi.config import settings
from agroapi.db.session import service_scope
from agroapi.db.types import DbPool
from agroapi.main import create_app
from agroapi.schemas.ingest import TelemetryEnvelope

FIXTURES = Path(__file__).parent / "fixtures"


def fixture(name: str) -> dict[str, Any]:
    payload: dict[str, Any] = json.loads((FIXTURES / name).read_text(encoding="utf-8"))
    return payload


# --------------------------------------------------------------------- pure
#
# No database, no app, no network. These run in the CI gate that precedes
# everything else.

#: Copied byte for byte from the assertion in
#: agrosensor/test/test_payload.cpp:82-88, which is what `buildJson` is proven to
#: emit. Not re-typed from the docs and not pretty-printed: the point is that THIS
#: string — the one the firmware's own host tests pin — decodes here.
FIRMWARE_PAYLOAD = (
    '{"v":1,"sensorId":"AGS-001","ts":1753900000,'
    '"readings":{"temperature":24.8,"moisture":42.5,"salinity":0.380,'
    '"phSoil":6.80,"npk":{"nitrogen":95,"phosphorus":52,"potassium":210},'
    '"phWater":7.10,"waterTemperature":23.4,"sunlight":780,"waterLevel":63},'
    '"quality":{"npkEstimated":true,"stabilising":false,"soilDry":false},'
    '"diag":{"rssi":-62,"uptime":38211,"fw":"0.1.0"}}'
)

#: agrosensor/test/test_payload.cpp:126-129 — every sensor absent. The firmware
#: emits this when both boards fail, and it must insert an all-NULL row rather
#: than being rejected: "nothing reported" is a fact about the field worth
#: storing, and a gap in the series is how a dead board is noticed at all.
FIRMWARE_PAYLOAD_DEGENERATE = (
    '{"v":1,"sensorId":"AGS-001","readings":{},'
    '"quality":{"npkEstimated":true,"stabilising":false,"soilDry":false},'
    '"diag":{"uptime":0,"fw":"0.1.0"}}'
)


def test_firmware_json_decodes_into_the_wire_schema() -> None:
    envelope = TelemetryEnvelope.model_validate_json(FIRMWARE_PAYLOAD)

    assert envelope.v == 1
    assert envelope.sensor_id == "AGS-001"
    assert envelope.ts == 1753900000
    assert envelope.readings.ph_soil == 6.80
    assert envelope.readings.ph_water == 7.10
    assert envelope.readings.npk is not None
    assert envelope.readings.npk.potassium == 210
    assert envelope.diag.rssi == -62
    assert envelope.diag.fw == "0.1.0"


def test_firmware_json_with_every_sensor_absent_is_accepted() -> None:
    envelope = TelemetryEnvelope.model_validate_json(FIRMWARE_PAYLOAD_DEGENERATE)

    assert envelope.ts is None
    assert envelope.readings.temperature is None
    assert envelope.readings.npk is None
    # Present and complete even when nothing was measured. Its absence must never
    # be readable as three `false` values.
    assert envelope.quality.npk_estimated is True


def test_an_unmodelled_firmware_field_is_refused_rather_than_dropped() -> None:
    """The reason `extra="forbid"` is on every model in the envelope.

    If the firmware grows a field, the choice is to find out at the boundary or
    to store readings that quietly omit it. Silence here would be discovered
    weeks later, by which point the gap is unrecoverable history.
    """
    with pytest.raises(ValueError, match="battery"):
        TelemetryEnvelope.model_validate(
            {
                "v": 1,
                "sensorId": "AGS-001",
                "readings": {"battery": 3.7},
                "quality": {"npkEstimated": True, "stabilising": False, "soilDry": False},
            }
        )


def test_an_unplugged_board_yields_none_not_zero() -> None:
    """Contract rule 1, asserted on a real captured payload.

    pH 0.0 is a plausible-looking acid reading. Nothing downstream could tell it
    apart from a measurement, which is why the distinction has to survive at the
    boundary rather than being reconstructed later.
    """
    envelope = TelemetryEnvelope.model_validate(fixture("soil_only.json"))

    assert envelope.readings.ph_soil == 6.40
    assert envelope.readings.ph_water is None
    assert envelope.readings.water_temperature is None
    assert envelope.readings.sunlight is None
    assert envelope.readings.water_level is None


def test_quality_block_is_required() -> None:
    payload = fixture("full.json")
    del payload["quality"]

    with pytest.raises(ValueError, match="quality"):
        TelemetryEnvelope.model_validate(payload)


# -------------------------------------------------------------- integration

SENSOR_A = "AGS-001"
SENSOR_B = "AGS-002"


@pytest.fixture
async def clean_db(pool: DbPool) -> AsyncIterator[None]:
    """Truncate the per-test tables, leaving the sensors from setup_test_db.sh.

    Readings and tokens are what each test creates; sensors and owners are
    fixtures of the environment. Recreating those per test would make every test
    depend on the seed script's exact contents.
    """
    async with pool.acquire() as conn:
        await conn.execute("truncate public.sensor_readings restart identity cascade")
        await conn.execute("truncate public.device_tokens cascade")
        await conn.execute(
            "update public.sensors set last_seen_at = null, last_reading_at = null, "
            "last_rssi = null, last_uptime_seconds = null, firmware_version = null"
        )
    yield


async def mint_for(pool: DbPool, sensor_code: str) -> str:
    """Register a token the way the CLI does, and hand back the plaintext."""
    config = settings()
    minted = device.mint(config.token_pepper.get_secret_value())
    async with service_scope(pool) as conn:
        sensor_id: UUID = await conn.fetchval(
            "select id from public.sensors where sensor_code = $1", sensor_code
        )
        assert sensor_id is not None, f"{sensor_code} missing; run setup_test_db.sh"
        await conn.execute(
            "insert into public.device_tokens (sensor_id, token_id, secret_hash) "
            "values ($1, $2, $3)",
            sensor_id,
            minted.token_id,
            minted.secret_hash,
        )
    return minted.plaintext


@pytest.fixture
async def client(pool: DbPool) -> AsyncIterator[httpx.AsyncClient]:
    """The real app over an ASGI transport, with the pool wired in by hand.

    The lifespan is skipped so the suite does not depend on Supabase being
    reachable to fetch JWKS — device auth does not use it, and a device-facing
    endpoint that could not be tested without the identity provider would be
    coupled to something it has nothing to do with.
    """
    app = create_app()
    app.state.pool = pool
    app.state.verifier = JwtVerifier(settings())
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as created:
        yield created


async def post(
    client: httpx.AsyncClient,
    token: str,
    payload: dict[str, Any],
) -> httpx.Response:
    return await client.post(
        "/v1/ingest", json=payload, headers={"Authorization": f"Bearer {token}"}
    )


async def latest_reading(pool: DbPool) -> Any:
    async with pool.acquire() as conn:
        return await conn.fetchrow(
            "select * from public.sensor_readings order by id desc limit 1"
        )


async def sensor_state(pool: DbPool, sensor_code: str) -> Any:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "select * from public.sensors where sensor_code = $1", sensor_code
        )
    assert row is not None, f"{sensor_code} missing; run setup_test_db.sh"
    return row


@pytest.mark.integration
async def test_firmware_payload_is_accepted_and_stored(
    client: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    token = await mint_for(pool, SENSOR_A)

    response = await post(client, token, json.loads(FIRMWARE_PAYLOAD))

    assert response.status_code == 201
    assert response.json() == {"accepted": 1, "duplicates": 0, "rejected": []}

    row = await latest_reading(pool)
    assert row["ph_soil"] == Decimal("6.80")
    assert row["ph_water"] == Decimal("7.10")
    assert row["potassium"] == Decimal("210.00")
    assert row["payload_version"] == 1


@pytest.mark.integration
async def test_reading_without_ntp_is_stamped_by_the_server(
    client: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    """Contract rule 3. This is what today's firmware actually sends — main.cpp
    hardcodes epoch 0 until Phase F wires NTP up, so `ts` is always omitted."""
    token = await mint_for(pool, SENSOR_A)

    response = await post(client, token, fixture("no_ts.json"))

    assert response.status_code == 201
    row = await latest_reading(pool)
    assert row["recorded_at_source"] == "server"
    assert row["recorded_at"] is not None


@pytest.mark.integration
async def test_reading_with_a_synced_clock_is_believed(
    client: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    """The other half of rule 3, and the whole reason replaying a buffer is worth
    anything: a device that knows when it measured gets to say so."""
    token = await mint_for(pool, SENSOR_A)
    payload = fixture("full.json")
    payload["ts"] = int((datetime.now(UTC) - timedelta(hours=3)).timestamp())

    response = await post(client, token, payload)

    assert response.status_code == 201
    row = await latest_reading(pool)
    assert row["recorded_at_source"] == "device"
    assert row["recorded_at"] < row["received_at"]


@pytest.mark.integration
async def test_an_implausible_clock_is_rejected_not_restamped(
    client: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    """Substituting arrival time here would fabricate a plausible-looking value,
    which is contract rule 1 applied to time. Nothing is stored."""
    token = await mint_for(pool, SENSOR_A)
    payload = fixture("full.json")
    payload["ts"] = 1_000_000_000  # 2001, long before the hardware existed

    response = await post(client, token, payload)

    assert response.status_code == 422
    body = response.json()
    assert body["accepted"] == 0
    assert body["rejected"][0]["code"] == "TS_OUT_OF_RANGE"
    assert await latest_reading(pool) is None


@pytest.mark.integration
async def test_unplugged_water_board_stores_null_not_zero(
    client: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    """Contract rule 1, all the way to the column.

    This is the assertion the whole `Optional[float]` discipline exists for. A
    0.00 in ph_water is indistinguishable from a real acid reading once it is in
    the table, and no later migration can recover which one it was.
    """
    token = await mint_for(pool, SENSOR_A)

    response = await post(client, token, fixture("soil_only.json"))

    assert response.status_code == 201
    row = await latest_reading(pool)
    assert row["ph_soil"] == Decimal("6.40")
    assert row["ph_water"] is None
    assert row["water_temperature"] is None
    assert row["sunlight"] is None
    assert row["water_level"] is None


@pytest.mark.integration
async def test_dry_soil_zero_npk_is_data_not_a_fault(
    client: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    """soilDry means conductivity was zero, which zeroes the derived NPK. That is
    expected in dry soil and explicitly not a sensor failure — the zeros are real
    and must be stored as zeros, not as NULL and not as a rejection."""
    token = await mint_for(pool, SENSOR_A)

    response = await post(client, token, fixture("dry_soil.json"))

    assert response.status_code == 201
    row = await latest_reading(pool)
    assert row["soil_dry"] is True
    assert row["nitrogen"] == Decimal("0.00")
    assert row["salinity"] == Decimal("0.000")


@pytest.mark.integration
async def test_both_boards_failing_still_stores_a_row(
    client: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    """An empty `readings: {}` is valid. The gap in the series is how a dead
    board gets noticed; rejecting it would erase the evidence."""
    token = await mint_for(pool, SENSOR_A)

    response = await post(client, token, fixture("empty_readings.json"))

    assert response.status_code == 201
    row = await latest_reading(pool)
    assert row["temperature"] is None
    assert row["stabilising"] is True


@pytest.mark.integration
async def test_replaying_a_reading_is_acked_not_duplicated(
    client: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    """A node draining flash after an outage may deliver the same entry twice.

    The second delivery must succeed — otherwise the node retries forever and
    wedges its own queue — while storing nothing. `duplicates` is how it learns
    it can drop the entry.
    """
    token = await mint_for(pool, SENSOR_A)
    payload = fixture("full.json")

    first = await post(client, token, payload)
    second = await post(client, token, payload)

    assert first.json() == {"accepted": 1, "duplicates": 0, "rejected": []}
    assert second.status_code == 201
    assert second.json() == {"accepted": 0, "duplicates": 1, "rejected": []}

    async with pool.acquire() as conn:
        count = await conn.fetchval("select count(*) from public.sensor_readings")
    assert count == 1


@pytest.mark.integration
async def test_a_batch_reports_per_item_outcomes(
    client: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    """One bad entry in a drained buffer must not cost the good ones."""
    token = await mint_for(pool, SENSOR_A)
    good = fixture("full.json")
    bad = fixture("soil_only.json")
    bad["ts"] = 1_000_000_000

    response = await post(client, token, {"batch": [good, bad]})

    assert response.status_code == 201
    body = response.json()
    assert body["accepted"] == 1
    assert len(body["rejected"]) == 1
    assert body["rejected"][0]["index"] == 1
    assert body["rejected"][0]["uid"] == bad["uid"]


@pytest.mark.integration
async def test_a_batch_over_the_limit_is_refused(
    client: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    token = await mint_for(pool, SENSOR_A)
    config = settings()
    oversized = [fixture("full.json") for _ in range(config.max_batch_size + 1)]

    response = await post(client, token, {"batch": oversized})

    assert response.status_code == 413
    assert response.json()["detail"]["code"] == "BATCH_TOO_LARGE"


@pytest.mark.integration
async def test_arrival_marks_the_device_seen(
    client: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    """`status` could never express 'offline' because nothing recorded liveness.
    last_seen_at is that missing primitive, and it tracks ARRIVAL — a node
    replaying week-old data is online right now."""
    token = await mint_for(pool, SENSOR_A)

    await post(client, token, fixture("full.json"))

    row = await sensor_state(pool, SENSOR_A)
    assert row["last_seen_at"] is not None
    assert row["last_rssi"] == -62
    assert row["firmware_version"] == "0.1.0"


@pytest.mark.integration
async def test_a_replayed_stale_reading_does_not_clobber_current_state(
    client: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    """Device state answers "what is true now". A buffered entry from during the
    outage would otherwise rewind firmware_version and RSSI to what they were
    then, which is how a recovered node comes to look broken."""
    token = await mint_for(pool, SENSOR_A)

    current = fixture("full.json")
    current["ts"] = int(datetime.now(UTC).timestamp())
    current["diag"] = {"rssi": -50, "uptime": 100, "fw": "0.2.0"}
    await post(client, token, current)

    stale = fixture("soil_only.json")
    stale["ts"] = int((datetime.now(UTC) - timedelta(days=2)).timestamp())
    stale["diag"] = {"rssi": -90, "uptime": 5, "fw": "0.1.0"}
    response = await post(client, token, stale)

    assert response.status_code == 201
    row = await sensor_state(pool, SENSOR_A)
    assert row["last_rssi"] == -50
    assert row["firmware_version"] == "0.2.0"


# ------------------------------------------------------------------ auth
#
# Cross-tenant isolation is asserted here rather than once globally, because it is
# the entire justification for per-device credentials and it has to hold at every
# endpoint that accepts one.


@pytest.mark.integration
async def test_a_token_cannot_write_to_another_sensor(
    client: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    """The token chooses the sensor; the body only gets to agree with it.

    Trusting `sensorId` is exactly the weakness that per-device tokens replaced
    the single shared SENSOR_INGEST_KEY to remove — under the old scheme any
    holder of the one key could attribute a reading to any node.
    """
    token_b = await mint_for(pool, SENSOR_B)
    payload = fixture("full.json")  # claims AGS-001

    response = await post(client, token_b, payload)

    assert response.status_code == 422
    body = response.json()
    assert body["rejected"][0]["code"] == "SENSOR_ID_MISMATCH"
    assert await latest_reading(pool) is None


@pytest.mark.integration
async def test_every_bad_credential_returns_the_same_401(
    client: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    """Unknown, malformed, revoked and wrong-secret are indistinguishable.

    Any difference between them is a device-enumeration oracle: it would let an
    unauthenticated caller learn which token_ids are real.
    """
    valid = await mint_for(pool, SENSOR_A)
    token_id = valid.split("_")[2]

    async with pool.acquire() as conn:
        await conn.execute(
            "update public.device_tokens set revoked_at = now() where token_id = $1",
            token_id,
        )

    payload = fixture("full.json")
    candidates = [
        "not-a-token",
        "ags_v1_deadbeefdeadbeef_wrongsecret",
        valid.rsplit("_", 1)[0] + "_wrongsecret",
        valid,  # structurally perfect, but now revoked
    ]

    bodies = []
    for candidate in candidates:
        response = await post(client, candidate, payload)
        assert response.status_code == 401, candidate
        bodies.append(response.json())

    assert all(body == bodies[0] for body in bodies)
    assert bodies[0]["detail"]["code"] == "INVALID_TOKEN"


@pytest.mark.integration
async def test_an_expired_token_stops_working(
    client: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    token = await mint_for(pool, SENSOR_A)
    async with pool.acquire() as conn:
        await conn.execute(
            "update public.device_tokens set expires_at = now() - interval '1 hour'"
        )

    response = await post(client, token, fixture("full.json"))

    assert response.status_code == 401
    assert await latest_reading(pool) is None


@pytest.mark.integration
async def test_a_missing_authorization_header_is_refused(
    client: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    response = await client.post("/v1/ingest", json=fixture("full.json"))

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "INVALID_TOKEN"


@pytest.mark.integration
async def test_successful_use_is_recorded_on_the_token(
    client: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    """last_used_at means "last succeeded", not "last attempted". Stamping it on
    presentation would let an unauthenticated caller write to the table by
    guessing a token_id."""
    token = await mint_for(pool, SENSOR_A)
    token_id = token.split("_")[2]

    await post(client, token, fixture("full.json"))

    async with pool.acquire() as conn:
        used = await conn.fetchval(
            "select last_used_at from public.device_tokens where token_id = $1", token_id
        )
    assert used is not None


# ------------------------------------------------------------- device binding
#
# The firmware and this service disagree about where the token goes and which path
# to POST to. `agrosensor/include/config.h:119` aims at `:8080/api/ingest` — the
# right port, the old Next.js path — and `lib/Net/HttpUplink.h:37` sends the
# credential as `X-Device-Token` rather than a bearer header. That repository has
# its own history and hardware CI and cannot be corrected from here, so a node
# flashed today would get a 404 and then a 401.
#
# Both are accommodated on this side. These tests pin that, and they are the ones
# that will fail loudly if the tolerance is ever removed before `config.h` moves.


@pytest.mark.integration
async def test_the_firmwares_token_header_is_accepted(
    client: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    """`X-Device-Token`, which is what HttpUplink.cpp actually sends."""
    token = await mint_for(pool, SENSOR_A)

    response = await client.post(
        "/v1/ingest", json=fixture("full.json"), headers={"X-Device-Token": token}
    )

    assert response.status_code == 201
    assert response.json()["accepted"] == 1


@pytest.mark.integration
async def test_the_firmwares_legacy_path_is_served(
    client: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    """`/api/ingest`, which is what config.h points AGRO_INGEST_URL at."""
    token = await mint_for(pool, SENSOR_A)

    response = await client.post(
        "/api/ingest",
        json=fixture("full.json"),
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 201


@pytest.mark.integration
async def test_the_firmwares_path_and_header_together_bind(
    client: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    """Exactly what an unmodified node sends today. This is the combination that
    decides whether hardware works without a reflash."""
    token = await mint_for(pool, SENSOR_A)

    response = await client.post(
        "/api/ingest", json=fixture("full.json"), headers={"X-Device-Token": token}
    )

    assert response.status_code == 201
    row = await latest_reading(pool)
    assert row["ph_soil"] == Decimal("6.80")


@pytest.mark.integration
async def test_a_bad_token_in_the_alias_header_is_still_a_uniform_401(
    client: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    """The alias changes where the bytes come from and nothing else — not the
    parsing, not the constant-time comparison, not the uniform rejection."""
    response = await client.post(
        "/v1/ingest",
        json=fixture("full.json"),
        headers={"X-Device-Token": "ags_v1_deadbeef_notasecret"},
    )

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "INVALID_TOKEN"


@pytest.mark.integration
async def test_bearer_wins_when_both_headers_are_present(
    client: httpx.AsyncClient, pool: DbPool, clean_db: None
) -> None:
    """A caller sending two credentials is confused; preferring the documented one
    keeps the outcome predictable instead of order-dependent."""
    good = await mint_for(pool, SENSOR_A)

    response = await client.post(
        "/v1/ingest",
        json=fixture("full.json"),
        headers={
            "Authorization": f"Bearer {good}",
            "X-Device-Token": "ags_v1_deadbeef_notasecret",
        },
    )

    assert response.status_code == 201


@pytest.mark.integration
async def test_the_legacy_path_is_absent_from_the_openapi_document(
    client: httpx.AsyncClient,
) -> None:
    """One documented ingest endpoint, so nobody reads the alias as a second
    contract worth building against."""
    paths = (await client.get("/openapi.json")).json()["paths"]

    assert "/v1/ingest" in paths
    assert "/api/ingest" not in paths
