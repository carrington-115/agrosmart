"""Firmware envelope -> database row.

PURE. No connection, no FastAPI, no clock of its own — `now` is passed in. This
is the module the rest of the design exists to protect, and it follows the
firmware's own rule verbatim (agrosensor/docs/modules/README.md):

    Parsers take a byte buffer, never a serial port.

Here that reads: mapping takes data, never a connection. Protocol decoding is
where this service is most likely to be wrong, and where being wrong is most
dangerous — a mis-mapped field still looks like a plausible number. Keeping it
pure means every interesting case (unplugged water board, dry soil, no NTP,
replayed buffer, implausible clock) is a fixture and a millisecond-long test.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

from agroapi.errors import RejectionCode
from agroapi.schemas.ingest import TelemetryEnvelope

#: Lower bound for a believable device clock. The firmware ships `ts` as 0 until
#: NTP syncs and omits the key entirely in that case, so anything this old is a
#: bug rather than a very patient sensor.
_MIN_PLAUSIBLE_TS = datetime(2020, 1, 1, tzinfo=UTC)

#: Tolerance for a device clock running ahead of ours.
_MAX_CLOCK_SKEW_SECONDS = 300


@dataclass(frozen=True, slots=True)
class ReadingInsert:
    """One row destined for `sensor_readings`, fully resolved.

    `None` means the sensor did not report. It never means zero, and nothing in
    this module may substitute one for the other.
    """

    reading_uid: str | None
    recorded_at: datetime
    recorded_at_source: Literal["device", "server"]
    received_at: datetime
    payload_version: int

    temperature: float | None
    moisture: float | None
    salinity: float | None
    ph_soil: float | None
    ph_water: float | None
    water_temperature: float | None
    sunlight: float | None
    water_level: float | None
    nitrogen: float | None
    phosphorus: float | None
    potassium: float | None

    npk_estimated: bool
    stabilising: bool
    soil_dry: bool

    rssi: int | None
    uptime_seconds: int | None
    firmware_version: str | None


@dataclass(frozen=True, slots=True)
class Rejection:
    """A permanently unusable item. The device should drop it, not retry."""

    code: RejectionCode
    message: str
    uid: str | None = None
    index: int | None = None


def resolve_timestamp(
    ts: int | None,
    now: datetime,
) -> tuple[datetime, Literal["device", "server"]] | Rejection:
    """Decide which clock to believe.

    Three cases, and collapsing any two of them loses information:

    * absent  -> stamp arrival, marked 'server'. Contract rule 3: when the
      device has not synced NTP, trust our clock rather than one known wrong.
    * sane    -> believe the device, marked 'device'. This is what makes
      replaying a buffered outage worth anything.
    * insane  -> reject. Substituting arrival time would fabricate a
      plausible-looking value, which is contract rule 1 applied to time.
    """
    if ts is None:
        return now, "server"

    try:
        recorded = datetime.fromtimestamp(ts, tz=UTC)
    except (OverflowError, OSError, ValueError):
        return Rejection(
            RejectionCode.TS_OUT_OF_RANGE,
            f"ts={ts} is not a representable Unix timestamp.",
        )

    if recorded < _MIN_PLAUSIBLE_TS:
        return Rejection(
            RejectionCode.TS_OUT_OF_RANGE,
            f"ts={ts} predates {_MIN_PLAUSIBLE_TS.date()}; device clock is wrong.",
        )

    skew = (recorded - now).total_seconds()
    if skew > _MAX_CLOCK_SKEW_SECONDS:
        return Rejection(
            RejectionCode.TS_OUT_OF_RANGE,
            f"ts={ts} is {skew:.0f}s in the future; device clock is wrong.",
        )

    return recorded, "device"


def to_reading(
    envelope: TelemetryEnvelope,
    now: datetime,
    supported_versions: frozenset[int],
) -> ReadingInsert | Rejection:
    """Map one validated envelope onto a row, or explain why it cannot be.

    Deliberately explicit rather than a dict comprehension over field names:
    this is where hardware semantics meet the storage schema, and it is the thing
    most likely to need changing when the firmware moves. `main.cpp` keeps the
    mirror-image mapping visible for exactly the same reason.
    """
    if envelope.v not in supported_versions:
        return Rejection(
            RejectionCode.UNSUPPORTED_VERSION,
            f"payload version {envelope.v} is not supported "
            f"(understood: {sorted(supported_versions)})",
            uid=envelope.uid,
        )

    resolved = resolve_timestamp(envelope.ts, now)
    if isinstance(resolved, Rejection):
        return Rejection(resolved.code, resolved.message, uid=envelope.uid)
    recorded_at, source = resolved

    r = envelope.readings
    # `npk` absent and `npk` present-but-empty are the same thing downstream, but
    # neither may become 0 — a dry soil legitimately reports zero nitrogen, and
    # that is distinct from "the probe did not answer".
    npk = r.npk

    return ReadingInsert(
        reading_uid=envelope.uid,
        recorded_at=recorded_at,
        recorded_at_source=source,
        received_at=now,
        payload_version=envelope.v,
        temperature=r.temperature,
        moisture=r.moisture,
        salinity=r.salinity,
        ph_soil=r.ph_soil,
        ph_water=r.ph_water,
        water_temperature=r.water_temperature,
        sunlight=r.sunlight,
        water_level=r.water_level,
        nitrogen=npk.nitrogen if npk else None,
        phosphorus=npk.phosphorus if npk else None,
        potassium=npk.potassium if npk else None,
        npk_estimated=envelope.quality.npk_estimated,
        stabilising=envelope.quality.stabilising,
        soil_dry=envelope.quality.soil_dry,
        rssi=envelope.diag.rssi,
        uptime_seconds=envelope.diag.uptime,
        firmware_version=envelope.diag.fw,
    )
