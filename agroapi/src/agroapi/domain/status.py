# SPDX-License-Identifier: MIT
"""Sensor status derivation. PURE.

This closes mismatch #7 from the telemetry contract: status must be
server-derived, not device-reported.

The current implementation cannot express `offline` at all. `deriveStatus()` runs
inside the ingest route, and a device that has stopped reporting by definition
never calls the endpoint again — so `offline` is only ever the value a row is
inserted with. Staleness has to be evaluated at *read* time, against a clock,
which is why this function takes `now` and a last-seen timestamp.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum

from agroapi.domain import thresholds
from agroapi.domain.thresholds import Band


class SensorStatus(StrEnum):
    """Matches the `public.sensor_status` enum and the dashboard's Badge logic."""

    NORMAL = "normal"
    WARNING = "warning"
    OFFLINE = "offline"


@dataclass(frozen=True, slots=True)
class Breach:
    metric: str
    value: float
    band: Band


@dataclass(frozen=True, slots=True)
class MetricSnapshot:
    """The subset of a reading that status depends on."""

    temperature: float | None = None
    moisture: float | None = None
    salinity: float | None = None
    sunlight: float | None = None
    ph_soil: float | None = None
    ph_water: float | None = None
    #: Conductivity was zero, which zeroes the derived NPK. See `breaches`.
    soil_dry: bool = False
    #: Within the probe's settling window; readings are converging, not wrong.
    stabilising: bool = False


def breaches(snapshot: MetricSnapshot) -> list[Breach]:
    """Every metric outside its band.

    Two contract rules are enforced here rather than at the call site, because
    forgetting either produces a confidently wrong alert:

    1. `soil_dry` suppresses the salinity check. Zero conductivity in dry soil is
       EXPECTED, not a fault — the contract says so explicitly and warns against
       raising a sensor-failure alert on it. Salinity is derived from that same
       conductivity, so a dry probe reports 0 dS/m and would otherwise look like
       a perfect reading while actually being no reading at all.

    2. `stabilising` suppresses everything. Inside the probe's 5-minute
       post-insertion window the numbers are real but still converging, so
       alerting on them just means every sensor screams when it is planted.

    NPK is deliberately absent: while `npkEstimated` is true those values are one
    conductivity measurement wearing three scaling factors, and the contract
    forbids building recommendations on them.
    """
    if snapshot.stabilising:
        return []

    found: list[Breach] = []

    def check(metric: str, value: float | None, band: Band) -> None:
        # `is None` rather than falsiness: 0.0 is a legitimate reading for
        # sunlight at night and for salinity in dry soil.
        if value is not None and not band.contains(value):
            found.append(Breach(metric, value, band))

    check("temperature", snapshot.temperature, thresholds.TEMPERATURE)
    check("moisture", snapshot.moisture, thresholds.MOISTURE)
    check("sunlight", snapshot.sunlight, thresholds.SUNLIGHT)
    check("ph_soil", snapshot.ph_soil, thresholds.PH_SOIL)
    check("ph_water", snapshot.ph_water, thresholds.PH_WATER)

    if not snapshot.soil_dry:
        check("salinity", snapshot.salinity, thresholds.SALINITY)

    return found


def derive(
    last_seen_at: datetime | None,
    snapshot: MetricSnapshot | None,
    now: datetime,
    offline_after: timedelta,
) -> SensorStatus:
    """Staleness first, then thresholds.

    Order matters: a sensor that stopped reporting three days ago is `offline`
    regardless of how healthy its final reading looked. Reporting `normal` for a
    dead node is the worst available answer, because it is indistinguishable from
    a working one.
    """
    if last_seen_at is None or now - last_seen_at > offline_after:
        return SensorStatus.OFFLINE

    if snapshot is None:
        return SensorStatus.OFFLINE

    return SensorStatus.WARNING if breaches(snapshot) else SensorStatus.NORMAL
