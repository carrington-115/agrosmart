"""Envelope -> row mapping. No database, no network, no clock of its own.

These are the tests that matter most in this service. Protocol mapping is where
it is most likely to be wrong, and where being wrong is most dangerous: a
mis-mapped field still looks like a plausible number. Same reasoning as
agrosensor's 109 host-side tests, and several cases here are the mirror image of
assertions in agrosensor/test/test_payload/test_payload.cpp.

Test names state a requirement, not a mechanism.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from pydantic import ValidationError

from agroapi.domain.telemetry import ReadingInsert, Rejection, to_reading
from agroapi.errors import RejectionCode
from agroapi.schemas.ingest import TelemetryEnvelope

FIXTURES = Path(__file__).parent / "fixtures"
NOW = datetime(2026, 7, 30, 12, 0, 0, tzinfo=UTC)
V1 = frozenset({1})


def load(name: str) -> TelemetryEnvelope:
    return TelemetryEnvelope.model_validate_json((FIXTURES / name).read_text())


def mapped(name: str) -> ReadingInsert:
    result = to_reading(load(name), NOW, V1)
    assert isinstance(result, ReadingInsert), result
    return result


# --------------------------------------------------------------- the whole doc


def test_full_payload_maps_every_field() -> None:
    row = mapped("full.json")

    assert row.temperature == 24.8
    assert row.moisture == 42.5
    assert row.salinity == 0.380
    assert row.ph_soil == 6.80
    assert row.ph_water == 7.10
    assert row.water_temperature == 23.4
    assert row.sunlight == 780
    assert row.water_level == 63
    assert (row.nitrogen, row.phosphorus, row.potassium) == (95, 52, 210)
    assert (row.rssi, row.uptime_seconds, row.firmware_version) == (-62, 38211, "0.1.0")
    assert row.payload_version == 1


# ------------------------------------------------- absent is not zero (rule 1)


def test_unplugged_water_board_yields_none_not_zero() -> None:
    """The contract's stated worst case.

    A node whose 4-in-1 board is unplugged omits phWater entirely. Storing 0.0
    would be a perfectly plausible-looking acid reading that nothing downstream
    could distinguish from a real one.
    """
    row = mapped("soil_only.json")

    assert row.ph_water is None
    assert row.water_temperature is None
    assert row.sunlight is None
    assert row.water_level is None
    # Explicitly not-zero, because `is None` passing while the value is 0.0 is
    # the exact confusion this asserts against.
    assert row.ph_water != 0.0

    # The soil probe still reported, and those values survive intact.
    assert row.temperature == 22.1
    assert row.ph_soil == 6.4


def test_empty_readings_block_is_valid_and_all_null() -> None:
    """Both boards failed. The firmware emits `readings:{}` and this must insert
    a row, not 422 — the transmission itself is evidence the node is alive."""
    row = mapped("empty_readings.json")

    assert row.temperature is None
    assert row.moisture is None
    assert row.ph_soil is None
    assert row.nitrogen is None
    # Quality survives even with no readings at all — that is what makes the
    # row interpretable rather than merely empty.
    assert row.stabilising is True


def test_dry_soil_zero_npk_is_data_not_a_fault() -> None:
    """Zero conductivity zeroes derived NPK. EXPECTED in dry soil.

    The zeros must be preserved as real measurements, and soil_dry must be
    carried so nothing downstream reads them as a sensor failure.
    """
    row = mapped("dry_soil.json")

    assert row.soil_dry is True
    assert row.nitrogen == 0
    assert row.phosphorus == 0
    assert row.potassium == 0
    # Zero, not None: the probe answered, and the answer was zero.
    assert row.nitrogen is not None


# ------------------------------------------------------ quality block (rule 2)


def test_missing_quality_block_is_rejected() -> None:
    """Always present per the contract, precisely so its absence can never be
    misread as three `false` values."""
    with pytest.raises(ValidationError):
        TelemetryEnvelope.model_validate(
            {"v": 1, "sensorId": "AGS-001", "readings": {}, "diag": {}}
        )


def test_quality_flags_are_never_defaulted() -> None:
    """A partial quality block fails rather than filling the gap with `false`."""
    with pytest.raises(ValidationError):
        TelemetryEnvelope.model_validate(
            {
                "v": 1,
                "sensorId": "AGS-001",
                "readings": {},
                "quality": {"npkEstimated": True},
            }
        )


# ----------------------------------------------------------- timestamps (rule 3)


def test_absent_ts_is_server_stamped() -> None:
    row = mapped("no_ts.json")

    assert row.recorded_at == NOW
    assert row.recorded_at_source == "server"


def test_present_ts_is_trusted_and_marked_as_the_devices_own() -> None:
    """This is what makes replaying a buffered outage worth anything."""
    row = mapped("full.json")

    assert row.recorded_at == datetime.fromtimestamp(1753900000, tz=UTC)
    assert row.recorded_at_source == "device"


def test_implausible_past_ts_is_rejected_not_silently_restamped() -> None:
    """Substituting arrival time would fabricate a plausible-looking value —
    rule 1's sin applied to time."""
    envelope = load("full.json").model_copy(update={"ts": 1_000_000})
    result = to_reading(envelope, NOW, V1)

    assert isinstance(result, Rejection)
    assert result.code is RejectionCode.TS_OUT_OF_RANGE


def test_future_ts_beyond_skew_tolerance_is_rejected() -> None:
    ahead = int((NOW + timedelta(hours=1)).timestamp())
    result = to_reading(load("full.json").model_copy(update={"ts": ahead}), NOW, V1)

    assert isinstance(result, Rejection)
    assert result.code is RejectionCode.TS_OUT_OF_RANGE


def test_ts_within_skew_tolerance_is_accepted() -> None:
    """A device clock a minute fast is normal, not an error."""
    slightly_ahead = int((NOW + timedelta(seconds=60)).timestamp())
    result = to_reading(
        load("full.json").model_copy(update={"ts": slightly_ahead}), NOW, V1
    )

    assert isinstance(result, ReadingInsert)
    assert result.recorded_at_source == "device"


# ------------------------------------------------------------------ versioning


def test_unknown_payload_version_is_rejected_naming_what_is_understood() -> None:
    """A firmware rollout must not silently write misinterpreted numbers."""
    result = to_reading(load("full.json").model_copy(update={"v": 99}), NOW, V1)

    assert isinstance(result, Rejection)
    assert result.code is RejectionCode.UNSUPPORTED_VERSION
    assert "99" in result.message


def test_unexpected_field_is_rejected_rather_than_dropped() -> None:
    """An unknown key means firmware and schema have diverged. Better to find
    out at the boundary than to store a field nobody reads."""
    with pytest.raises(ValidationError):
        TelemetryEnvelope.model_validate(
            {
                "v": 1,
                "sensorId": "AGS-001",
                "readings": {"temperature": 20, "phLunar": 7},
                "quality": {"npkEstimated": True, "stabilising": False, "soilDry": False},
            }
        )


def test_uid_round_trips_for_idempotent_replay() -> None:
    row = mapped("full.json")
    assert row.reading_uid == "a3f1c09d4b2e7186"


def test_received_at_is_always_arrival_even_for_a_replay() -> None:
    """recorded_at may be days old; received_at is now. Both are needed to tell
    a replay from live data."""
    row = mapped("full.json")

    assert row.received_at == NOW
    assert row.recorded_at < row.received_at


def test_fixtures_are_valid_json_and_parse() -> None:
    """Guards against a fixture rotting into something the schema rejects."""
    for path in sorted(FIXTURES.glob("*.json")):
        payload = json.loads(path.read_text())
        assert "quality" in payload, f"{path.name} must carry a quality block"
        TelemetryEnvelope.model_validate(payload)
