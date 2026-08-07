# SPDX-License-Identifier: MIT
"""Status derivation, and the contract rules it is supposed to enforce.

Pure: no database, no app, no clock. Every case here is the kind that produces a
*confidently wrong* answer rather than an error — a dead node reported healthy, an
ordinary acid soil flagged as a fault, a dry probe treated as broken hardware — so
they are exactly the cases worth pinning.

Until now `domain/status.py` had no test and no importer outside `domain/`, which
means its quality-flag suppressions had never once been executed.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from agroapi.domain import thresholds
from agroapi.domain.status import (
    MetricSnapshot,
    SensorStatus,
    breaches,
    derive,
)

NOW = datetime(2026, 8, 6, 12, 0, 0, tzinfo=UTC)
OFFLINE_AFTER = timedelta(seconds=180)


def healthy() -> MetricSnapshot:
    """Every metric comfortably inside its band."""
    return MetricSnapshot(
        temperature=24.0,
        moisture=50.0,
        salinity=0.3,
        sunlight=700.0,
        ph_soil=6.8,
        ph_water=7.1,
    )


# ------------------------------------------------------------------ suppression


def test_dry_soil_suppresses_the_salinity_check() -> None:
    """Contract rule: zero conductivity in dry soil is EXPECTED, not a fault.

    Salinity is derived from the same conductivity the dryness zeroed, so a dry
    probe reports 0 dS/m — which would otherwise look like a real out-of-band
    reading and raise a sensor-failure alert the contract explicitly forbids.
    """
    snapshot = MetricSnapshot(salinity=9.0, soil_dry=True)
    assert breaches(snapshot) == []


def test_salinity_is_checked_when_the_soil_is_not_dry() -> None:
    """The counterpart: suppression must be the flag's doing, not an omission."""
    snapshot = MetricSnapshot(salinity=9.0, soil_dry=False)
    found = breaches(snapshot)
    assert [b.metric for b in found] == ["salinity"]


def test_dry_soil_does_not_suppress_anything_else() -> None:
    """`soilDry` explains conductivity. It says nothing about moisture or heat, and
    a dry field with a genuine heat problem still has a heat problem."""
    snapshot = MetricSnapshot(temperature=45.0, moisture=2.0, salinity=0.0, soil_dry=True)
    found = {b.metric for b in breaches(snapshot)}
    assert found == {"temperature", "moisture"}


def test_stabilising_suppresses_every_check() -> None:
    """Inside the 5-minute settling window the numbers are real but converging, so
    alerting on them means every sensor screams the moment it is planted."""
    snapshot = MetricSnapshot(
        temperature=99.0, moisture=1.0, salinity=9.0, ph_soil=1.0, stabilising=True
    )
    assert breaches(snapshot) == []


def test_npk_is_never_checked() -> None:
    """N, P and K are back-calculated from bulk conductivity, so a verdict on them
    is a verdict on the estimator. `MetricSnapshot` deliberately has no field for
    them — this test pins that absence so nobody 'helpfully' adds one."""
    assert not hasattr(MetricSnapshot(), "nitrogen")


# ------------------------------------------------------------------ absence vs zero


def test_absent_metrics_are_not_breaches() -> None:
    """An unplugged board reports nothing, which is not the same as reporting a
    value outside the band."""
    assert breaches(MetricSnapshot()) == []


def test_zero_is_a_real_reading_and_can_breach() -> None:
    """The mirror image, and the reason the check is `is not None` rather than a
    falsiness test: 0% moisture is a measurement, and a bone-dry field is exactly
    what the dashboard exists to warn about."""
    found = breaches(MetricSnapshot(moisture=0.0))
    assert [b.metric for b in found] == ["moisture"]


def test_zero_sunlight_at_night_is_a_reading_not_absence() -> None:
    found = breaches(MetricSnapshot(sunlight=0.0))
    assert [b.metric for b in found] == ["sunlight"]


# ------------------------------------------------------------------ the two pH bands


def test_ordinary_acid_soil_is_not_a_breach() -> None:
    """pH 5.8 soil is a real acid soil, well inside the probe's 3–9 range.

    The frontend applied the *water* band (6.0–7.5) to soil readings, so this
    value was reported as a problem on perfectly ordinary ground. That is the
    regression this separation exists to prevent.
    """
    assert breaches(MetricSnapshot(ph_soil=5.8)) == []


def test_the_same_value_in_water_is_a_breach() -> None:
    """Same number, different medium, different hardware, different verdict — which
    is why merging the two into one `ph` field destroyed information."""
    found = breaches(MetricSnapshot(ph_water=5.8))
    assert [b.metric for b in found] == ["ph_water"]


def test_the_soil_and_water_bands_differ_as_documented() -> None:
    assert (thresholds.PH_SOIL.low, thresholds.PH_SOIL.high) == (5.5, 8.0)
    assert (thresholds.PH_WATER.low, thresholds.PH_WATER.high) == (6.0, 7.5)


# ------------------------------------------------------------------ breach shape


def test_a_breach_reports_which_side_of_the_band_it_left() -> None:
    low = breaches(MetricSnapshot(moisture=5.0))[0]
    high = breaches(MetricSnapshot(moisture=95.0))[0]
    assert low.direction == "low"
    assert high.direction == "high"


def test_a_breach_carries_the_band_it_left() -> None:
    """The band travels with the breach so a consumer can render "below 30–70"
    without keeping its own copy of the thresholds."""
    breach = breaches(MetricSnapshot(moisture=5.0))[0]
    assert breach.band is thresholds.MOISTURE
    assert breach.value == 5.0


def test_band_boundaries_are_inclusive() -> None:
    assert breaches(MetricSnapshot(moisture=thresholds.MOISTURE.low)) == []
    assert breaches(MetricSnapshot(moisture=thresholds.MOISTURE.high)) == []


# ------------------------------------------------------------------ staleness


def test_a_sensor_that_never_reported_is_offline() -> None:
    assert derive(None, healthy(), NOW, OFFLINE_AFTER) is SensorStatus.OFFLINE


def test_a_stale_sensor_is_offline_however_healthy_its_last_reading() -> None:
    """Staleness beats thresholds, and the order is the whole point.

    Reporting `normal` for a node that died three days ago is the worst available
    answer, because it is indistinguishable from a working one.
    """
    last_seen = NOW - timedelta(days=3)
    assert derive(last_seen, healthy(), NOW, OFFLINE_AFTER) is SensorStatus.OFFLINE


def test_a_recent_healthy_sensor_is_normal() -> None:
    last_seen = NOW - timedelta(seconds=30)
    assert derive(last_seen, healthy(), NOW, OFFLINE_AFTER) is SensorStatus.NORMAL


def test_a_recent_breaching_sensor_is_warning() -> None:
    last_seen = NOW - timedelta(seconds=30)
    snapshot = MetricSnapshot(moisture=5.0)
    assert derive(last_seen, snapshot, NOW, OFFLINE_AFTER) is SensorStatus.WARNING


def test_a_sensor_seen_recently_with_no_reading_at_all_is_offline() -> None:
    """A registered node that has never sent a payload. `normal` would claim a
    healthy measurement exists; there is none."""
    last_seen = NOW - timedelta(seconds=30)
    assert derive(last_seen, None, NOW, OFFLINE_AFTER) is SensorStatus.OFFLINE


def test_the_offline_boundary_is_exclusive() -> None:
    """Exactly at the threshold is still online — `>` not `>=`, so a node
    reporting precisely on the interval does not flap."""
    assert derive(NOW - OFFLINE_AFTER, healthy(), NOW, OFFLINE_AFTER) is SensorStatus.NORMAL
    assert (
        derive(NOW - OFFLINE_AFTER - timedelta(seconds=1), healthy(), NOW, OFFLINE_AFTER)
        is SensorStatus.OFFLINE
    )


def test_a_stabilising_sensor_is_normal_rather_than_warning() -> None:
    """Suppressed checks mean no breaches, which means `normal`. A freshly planted
    probe is working correctly; it is just not settled."""
    last_seen = NOW - timedelta(seconds=30)
    snapshot = MetricSnapshot(moisture=1.0, stabilising=True)
    assert derive(last_seen, snapshot, NOW, OFFLINE_AFTER) is SensorStatus.NORMAL


def test_status_values_match_the_database_enum() -> None:
    """`public.sensor_status` from 0001, and the dashboard's Badge variants."""
    assert {s.value for s in SensorStatus} == {"normal", "warning", "offline"}
