# SPDX-License-Identifier: MIT
"""Database rows to response models.

Kept out of the routers, which validate and wire and contain no arithmetic, and
out of the repositories, which return what the SQL returned. This is the one seam
where a column name becomes a wire field, so a rename shows up here rather than
in six endpoints.

The important behaviour is negative: nothing here defaults a missing metric to a
number. A NULL column becomes `None`, `exclude_none=True` drops it on the way out,
and the client sees an absent key. Every intermediate step preserving that is what
stops an unplugged board from reporting pH 0.0.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from agroapi.domain import alerts as domain_alerts
from agroapi.domain import thresholds
from agroapi.domain.status import Breach, MetricSnapshot, SensorStatus, breaches, derive
from agroapi.schemas.read import (
    AlertOut,
    BandOut,
    BreachOut,
    FarmOut,
    NpkOut,
    ProfileOut,
    QualityOut,
    ReadingOut,
    SensorOut,
    SettingsOut,
    ThresholdsOut,
)

#: Column defaults matching 0003's, so a user who has never saved a preference
#: sees the same thing a fresh row would give them. A missing row and a default
#: row must be indistinguishable, or the page looks different for no reason the
#: user could explain.
_DEFAULT_SETTINGS = SettingsOut(
    pair_by_id=True,
    pair_by_qr=True,
    reports_weekly=True,
    reports_monthly=True,
    reports_email=False,
    alerts_dashboard=True,
    alerts_popup=True,
    alerts_email=False,
    alerts_sms=False,
    alerts_delete_ignored_after_days=14,
)


def quality_of(row: Any) -> QualityOut | None:
    """The quality block, or None when the reading carries none.

    A check constraint stores all three together or none, so a partial block is
    not representable. `None` therefore means "this reading predates the
    contract" — a different claim from three `false` values, and one the UI shows
    differently.
    """
    if row["npk_estimated"] is None or row["stabilising"] is None or row["soil_dry"] is None:
        return None
    return QualityOut(
        npk_estimated=row["npk_estimated"],
        stabilising=row["stabilising"],
        soil_dry=row["soil_dry"],
    )


def snapshot_of(row: Any) -> MetricSnapshot:
    """The subset of a reading that status derivation looks at.

    `soil_dry` and `stabilising` fall back to False when the block is absent. That
    is the safe direction: a legacy row gets evaluated normally rather than having
    every check silently suppressed, which would report `normal` for a sensor
    nobody had looked at.
    """
    return MetricSnapshot(
        temperature=row["temperature"],
        moisture=row["moisture"],
        salinity=row["salinity"],
        sunlight=row["sunlight"],
        ph_soil=row["ph_soil"],
        ph_water=row["ph_water"],
        soil_dry=bool(row["soil_dry"]),
        stabilising=bool(row["stabilising"]),
    )


def reading_out(row: Any) -> ReadingOut:
    npk = NpkOut(
        nitrogen=row["nitrogen"],
        phosphorus=row["phosphorus"],
        potassium=row["potassium"],
    )
    # An all-absent NPK object is dropped entirely rather than sent as three
    # nulls. `{}` would suggest the probe reported something.
    has_npk = any(row[column] is not None for column in ("nitrogen", "phosphorus", "potassium"))

    return ReadingOut(
        recorded_at=row["recorded_at"],
        recorded_at_source=row["recorded_at_source"],
        received_at=row["received_at"],
        temperature=row["temperature"],
        moisture=row["moisture"],
        salinity=row["salinity"],
        ph_soil=row["ph_soil"],
        ph_water=row["ph_water"],
        water_temperature=row["water_temperature"],
        sunlight=row["sunlight"],
        water_level=row["water_level"],
        npk=npk if has_npk else None,
        quality=quality_of(row),
    )


def breach_out(breach: Breach) -> BreachOut:
    return BreachOut(
        metric=breach.metric,
        value=breach.value,
        band=BandOut(low=breach.band.low, high=breach.band.high),
        direction=breach.direction,
    )


def sensor_out(row: Any, now: datetime, offline_after: timedelta) -> SensorOut:
    """A sensor with its status derived, not read.

    `now` is passed in rather than read here, the same discipline
    `domain/telemetry.py` follows: a function that reads the clock cannot be
    tested against a fixture, and staleness is entirely a statement about the
    clock.
    """
    has_reading = row["recorded_at"] is not None
    snapshot = snapshot_of(row) if has_reading else None

    status = derive(row["last_seen_at"], snapshot, now, offline_after)

    # Breaches are reported only when the sensor is actually reachable. Listing
    # the stale complaints of a dead node beside its `offline` status invites
    # someone to go fix a moisture problem on a sensor that is unplugged.
    found = (
        [breach_out(b) for b in breaches(snapshot)]
        if snapshot is not None and status is not SensorStatus.OFFLINE
        else []
    )

    return SensorOut(
        id=row["id"],
        sensor_id=row["sensor_code"],
        tag=row["sensor_tag"],
        farm_id=row["farm_id"],
        status=status,
        breaches=found,
        last_seen_at=row["last_seen_at"],
        last_reading_at=row["last_reading_at"],
        rssi=row["last_rssi"],
        uptime_seconds=row["last_uptime_seconds"],
        firmware_version=row["firmware_version"],
        latest=reading_out(row) if has_reading else None,
    )


def stored_alert_out(row: Any) -> AlertOut:
    return AlertOut(
        id=str(row["id"]),
        title=row["title"],
        description=row["description"],
        severity=row["severity"],
        label=row["label"],
        state=row["state"],
        created_at=row["created_at"],
        sensor_id=row["sensor_code"],
        derived=False,
    )


def derived_alert_out(alert: domain_alerts.DerivedAlert) -> AlertOut:
    return AlertOut(
        id=alert.id,
        title=alert.title,
        description=alert.description,
        severity=alert.severity,  # type: ignore[arg-type]
        label=alert.label,
        # Always `open`: a derived alert has no row to move to another state, and
        # it disappears on its own once the reading recovers.
        state="open",
        created_at=alert.at,
        sensor_id=alert.sensor_code,
        derived=True,
        steps=alert.steps,
    )


def profile_out(row: Any | None) -> ProfileOut | None:
    if row is None:
        return None
    return ProfileOut(
        id=row["id"],
        name=row["name"],
        email=row["email"],
        phone=row["phone"],
        address=row["address"],
        avatar_url=row["avatar_url"],
    )


def farm_out(row: Any | None) -> FarmOut | None:
    if row is None:
        return None
    return FarmOut(
        id=row["id"],
        farm_name=row["farm_name"],
        farm_type=row["farm_type"],
        farm_size=row["farm_size"],
        farm_zones=row["farm_zones"],
        country=row["country"],
        state=row["state"],
        city=row["city"],
        address=row["address"],
    )


def settings_out(row: Any | None) -> SettingsOut:
    if row is None:
        return _DEFAULT_SETTINGS.model_copy()
    return SettingsOut(
        pair_by_id=row["pair_by_id"],
        pair_by_qr=row["pair_by_qr"],
        reports_weekly=row["reports_weekly"],
        reports_monthly=row["reports_monthly"],
        reports_email=row["reports_email"],
        alerts_dashboard=row["alerts_dashboard"],
        alerts_popup=row["alerts_popup"],
        alerts_email=row["alerts_email"],
        alerts_sms=row["alerts_sms"],
        alerts_delete_ignored_after_days=row["alerts_delete_ignored_after_days"],
    )


def thresholds_out() -> ThresholdsOut:
    """The bands as the frontend receives them.

    Built from `domain/thresholds.py` rather than re-typed, which is the whole
    reason this endpoint exists: the dashboard needs the numbers to label a
    reading, and any copy it kept would drift.
    """

    def band(source: thresholds.Band) -> BandOut:
        return BandOut(low=source.low, high=source.high)

    return ThresholdsOut(
        temperature=band(thresholds.TEMPERATURE),
        moisture=band(thresholds.MOISTURE),
        sunlight=band(thresholds.SUNLIGHT),
        salinity=band(thresholds.SALINITY),
        ph_soil=band(thresholds.PH_SOIL),
        ph_water=band(thresholds.PH_WATER),
        nitrogen=band(thresholds.NITROGEN),
        phosphorus=band(thresholds.PHOSPHORUS),
        potassium=band(thresholds.POTASSIUM),
    )
