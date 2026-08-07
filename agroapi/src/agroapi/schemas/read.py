# SPDX-License-Identifier: MIT
"""What the dashboard reads. The wire contract, outbound.

Mirrors `schemas/ingest.py` in shape and in discipline. Two properties carry over
and both are contract rules rather than style:

**Absent is not zero.** Every metric is `float | None` with no numeric default,
and these models are serialised with `exclude_none=True`, so a node whose 4-in-1
board is unplugged produces a payload with **no `phWater` key at all**. Not
`null`, and certainly not `0.0` — which is a perfectly plausible-looking acid
reading that nothing downstream could distinguish from a real one. Rule 1 applies
on the way out exactly as it does on the way in.

**The quality block travels with the numbers.** `QualityOut` is `None` only when
the reading predates the contract, which is a different statement from three
`false` values and must stay distinguishable.

There is deliberately **no `ph` field**. The database still has one — 0002 kept it
as `coalesce(ph_soil, ph_water)` so the old frontend's reads would not break
during the cutover — but it merges two different quantities measured in different
media by different hardware. A new API must not carry a name whose whole purpose
was backward compatibility with a mistake.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field

from agroapi.domain.status import SensorStatus


def _to_float(value: object) -> object:
    """Coerce asyncpg's `Decimal` to `float`.

    Postgres `numeric` comes back as `Decimal` — the ingest tests assert
    `Decimal("6.80")` — and a `Decimal` reaching JSON serialisation either raises
    or silently becomes a string, so a client sees `"6.80"` where it expected a
    number. Done here, once, rather than in every mapper.
    """
    if isinstance(value, Decimal):
        return float(value)
    return value


#: A numeric reading, or absent. Never defaulted to a number.
Metric = Annotated[float | None, BeforeValidator(_to_float)]


class _Out(BaseModel):
    """Base for every response model.

    `populate_by_name=True` so mappers can construct with snake_case field names
    while the wire stays camelCase, matching what the TypeScript side expects.
    """

    model_config = ConfigDict(populate_by_name=True)


class NpkOut(_Out):
    """Nitrogen, phosphorus and potassium in mg/kg.

    Check `quality.npkEstimated` before trusting these. The probe has no chemistry
    isolating N, P or K — it measures bulk conductivity and back-calculates all
    three, so while that flag is set these are one measurement wearing three
    scaling factors.
    """

    nitrogen: Metric = None
    phosphorus: Metric = None
    potassium: Metric = None


class QualityOut(_Out):
    """Provenance flags. Present together or the whole object is absent."""

    npk_estimated: bool = Field(serialization_alias="npkEstimated")
    stabilising: bool
    soil_dry: bool = Field(serialization_alias="soilDry")


class ReadingOut(_Out):
    """One reading, as measured.

    `recorded_at_source` is not decoration. `device` means the node's own clock
    stamped it and the value is when the soil was measured; `server` means the
    node had no NTP sync yet and this is when the payload arrived. Telling those
    apart is what makes replaying a buffered outage worth doing, and a UI that
    hides the difference presents an arrival time as a measurement.
    """

    recorded_at: datetime = Field(serialization_alias="recordedAt")
    recorded_at_source: Literal["device", "server"] = Field(
        serialization_alias="recordedAtSource"
    )
    received_at: datetime = Field(serialization_alias="receivedAt")

    temperature: Metric = None
    moisture: Metric = None
    salinity: Metric = None
    ph_soil: Metric = Field(default=None, serialization_alias="phSoil")
    ph_water: Metric = Field(default=None, serialization_alias="phWater")
    water_temperature: Metric = Field(default=None, serialization_alias="waterTemperature")
    #: LDR output. RELATIVE AND UNCALIBRATED — not lux.
    sunlight: Metric = None
    #: Relative and non-linear. Presence, not depth.
    water_level: Metric = Field(default=None, serialization_alias="waterLevel")

    npk: NpkOut | None = None
    quality: QualityOut | None = None


class BandOut(_Out):
    low: float
    high: float


class BreachOut(_Out):
    """A metric outside its band, with the band it left.

    The band travels with the breach so a client can say "42% is below 30–70"
    without holding its own copy of the thresholds. That is the point: shipping
    the numbers here is what lets `domain/thresholds.py` stay the only place they
    are written down.
    """

    metric: str
    value: float
    band: BandOut
    direction: Literal["low", "high"]


class SensorOut(_Out):
    """A sensor, its latest reading, and what that reading means.

    `status` is **derived per request** from `last_seen_at` and the thresholds. It
    is not the `sensors.status` column: nothing ever writes `offline` there,
    because a device that stops reporting never calls ingest again to say so. The
    column is a stale default and reading it would serve `normal` for a node that
    died last week — the worst available answer, since it is indistinguishable
    from a working one.
    """

    id: UUID
    #: The device code printed on the sensor, e.g. 'AGS-001'.
    sensor_id: str = Field(serialization_alias="sensorId")
    tag: str | None = None
    farm_id: UUID | None = Field(default=None, serialization_alias="farmId")

    status: SensorStatus
    breaches: list[BreachOut] = Field(default_factory=list)

    #: Arrival of the most recent payload — the liveness signal behind `status`.
    last_seen_at: datetime | None = Field(default=None, serialization_alias="lastSeenAt")
    #: Timestamp of the newest reading, which can be older than `lastSeenAt`
    #: when a node is replaying a buffer.
    last_reading_at: datetime | None = Field(default=None, serialization_alias="lastReadingAt")
    rssi: int | None = None
    uptime_seconds: int | None = Field(default=None, serialization_alias="uptimeSeconds")
    firmware_version: str | None = Field(default=None, serialization_alias="firmwareVersion")

    latest: ReadingOut | None = None


class AlertOut(_Out):
    """An alert, stored or derived.

    `derived` is load-bearing for the UI: a derived alert is computed from the
    current readings and has no row behind it, so it cannot be accepted or
    resolved and clears itself when the reading returns to range. Offering
    accept/reject controls for one would be a button that does nothing.
    """

    id: str
    title: str
    description: str | None = None
    severity: Literal["default", "secondary", "destructive", "outline"]
    label: str | None = None
    state: Literal["open", "accepted", "rejected"]
    created_at: datetime | None = Field(default=None, serialization_alias="createdAt")
    sensor_id: str | None = Field(default=None, serialization_alias="sensorId")
    derived: bool = False
    #: Plain-language remediation steps, for the detail panel.
    steps: list[str] = Field(default_factory=list)


class ProfileOut(_Out):
    id: UUID
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    avatar_url: str | None = Field(default=None, serialization_alias="avatarUrl")


class FarmOut(_Out):
    id: UUID
    farm_name: str = Field(serialization_alias="farmName")
    farm_type: str | None = Field(default=None, serialization_alias="farmType")
    farm_size: Metric = Field(default=None, serialization_alias="farmSize")
    farm_zones: int | None = Field(default=None, serialization_alias="farmZones")
    country: str | None = None
    state: str | None = None
    city: str | None = None
    address: str | None = None


class SettingsOut(_Out):
    """Notification and reporting preferences.

    Field names stay snake_case on the wire here, unlike everything else in this
    module. They are column names that the frontend already keys its checkboxes
    on, and renaming them would put a translation table between a checkbox and
    the thing it stores for no gain.
    """

    pair_by_id: bool
    pair_by_qr: bool
    reports_weekly: bool
    reports_monthly: bool
    reports_email: bool
    alerts_dashboard: bool
    alerts_popup: bool
    alerts_email: bool
    alerts_sms: bool
    alerts_delete_ignored_after_days: int


class MeOut(_Out):
    """Profile, farm and settings in one round trip.

    The dashboard shell needs all three on every page, so three endpoints would
    mean three sequential awaits before anything renders.
    """

    profile: ProfileOut | None = None
    farm: FarmOut | None = None
    settings: SettingsOut


class ThresholdsOut(_Out):
    """The bands, so the frontend never re-types them.

    Without this endpoint the dashboard has to hold its own copy to label a
    reading "Low" or "Optimal", which is exactly the duplication
    `domain/thresholds.py` exists to end.
    """

    temperature: BandOut
    moisture: BandOut
    sunlight: BandOut
    salinity: BandOut
    ph_soil: BandOut = Field(serialization_alias="phSoil")
    ph_water: BandOut = Field(serialization_alias="phWater")
    nitrogen: BandOut
    phosphorus: BandOut
    potassium: BandOut


class Page[T](_Out):
    """A bounded slice, with the cursor for the next one.

    Keyset pagination rather than offset: readings arrive continuously, so an
    offset walks backwards through a list that is growing at the front and can
    return the same row twice. `nextCursor` is opaque to the client on purpose.
    """

    items: list[T]
    next_cursor: str | None = Field(default=None, serialization_alias="nextCursor")


class DeviceTokenOut(_Out):
    """A freshly minted device credential.

    `token` is the only time the plaintext exists anywhere. It is not stored — the
    database keeps an HMAC — and `device_tokens` is RLS deny-all even to its
    owner, so there is no endpoint that could return it again. Losing it means
    minting a replacement, which is the intended failure mode.
    """

    token_id: str = Field(serialization_alias="tokenId")
    token: str
    label: str | None = None
    expires_at: datetime | None = Field(default=None, serialization_alias="expiresAt")
