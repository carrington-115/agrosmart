# SPDX-License-Identifier: MIT
"""Alert derivation.

Pure. These assert the two things a threshold alert gets wrong most easily:
telling a farmer to fix a problem on a node that is actually unplugged, and
raising a fault for a field condition that is entirely normal.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from agroapi.domain.alerts import DerivedAlert, for_sensor
from agroapi.domain.status import MetricSnapshot, SensorStatus

NOW = datetime(2026, 8, 6, 12, 0, 0, tzinfo=UTC)
OFFLINE_AFTER = timedelta(seconds=180)
CODE = "AGS-001"


def derive_for(
    status: SensorStatus,
    snapshot: MetricSnapshot | None,
    last_seen_at: datetime | None = NOW,
) -> list[DerivedAlert]:
    return for_sensor(
        sensor_code=CODE,
        status=status,
        snapshot=snapshot,
        last_seen_at=last_seen_at,
        recorded_at=NOW,
        offline_after=OFFLINE_AFTER,
    )


def test_dry_soil_does_not_raise_a_salinity_alert() -> None:
    """The contract's sharpest instruction: dry soil is data, not a fault."""
    snapshot = MetricSnapshot(salinity=0.0, moisture=4.0, soil_dry=True)
    labels = {a.label for a in derive_for(SensorStatus.WARNING, snapshot)}
    assert "Salinity" not in labels


def test_dry_soil_still_surfaces_the_low_moisture() -> None:
    """Suppression is scoped. The field really is dry, and that is worth saying —
    suppressing the whole sensor would hide the actionable half."""
    snapshot = MetricSnapshot(salinity=0.0, moisture=4.0, soil_dry=True)
    labels = {a.label for a in derive_for(SensorStatus.WARNING, snapshot)}
    assert "Soil moisture" in labels


def test_a_settling_probe_raises_nothing() -> None:
    snapshot = MetricSnapshot(moisture=1.0, salinity=9.0, stabilising=True)
    assert derive_for(SensorStatus.NORMAL, snapshot) == []


def test_an_offline_sensor_produces_exactly_one_alert() -> None:
    """And it is the offline one.

    A dead node's last reading may breach six bands. Listing all six beside
    "offline" buries the only thing that can be acted on, and invites someone to
    go water a field because a sensor lost power.
    """
    snapshot = MetricSnapshot(moisture=1.0, salinity=9.0, temperature=99.0)
    alerts = derive_for(SensorStatus.OFFLINE, snapshot)
    assert len(alerts) == 1
    assert alerts[0].label == "Offline"
    assert alerts[0].severity == "destructive"


def test_a_sensor_that_never_reported_says_so_differently() -> None:
    """ "Never reported" and "stopped reporting" need different advice — one is a
    setup problem, the other is a failure."""
    alerts = derive_for(SensorStatus.OFFLINE, None, last_seen_at=None)
    assert "never reported" in alerts[0].description


def test_a_healthy_sensor_produces_no_alerts() -> None:
    snapshot = MetricSnapshot(temperature=24.0, moisture=50.0, salinity=0.3)
    assert derive_for(SensorStatus.NORMAL, snapshot) == []


def test_threshold_alerts_are_not_as_severe_as_a_dead_node() -> None:
    """Colouring both alike trains the user to ignore both."""
    snapshot = MetricSnapshot(moisture=5.0)
    alerts = derive_for(SensorStatus.WARNING, snapshot)
    assert alerts[0].severity == "secondary"


def test_alert_ids_are_stable_for_the_same_condition() -> None:
    """So a client can keep an expanded panel or a local dismissal attached across
    refreshes, without a database row to hang it on."""
    snapshot = MetricSnapshot(moisture=5.0)
    first = derive_for(SensorStatus.WARNING, snapshot)
    second = derive_for(SensorStatus.WARNING, snapshot)
    assert [a.id for a in first] == [a.id for a in second]
    assert first[0].id == f"derived:moisture:{CODE}"


def test_alerts_name_the_sensor_and_carry_steps() -> None:
    snapshot = MetricSnapshot(moisture=5.0)
    alert = derive_for(SensorStatus.WARNING, snapshot)[0]
    assert CODE in alert.title
    assert alert.sensor_code == CODE
    assert alert.steps, "a threshold alert with no remedy is not actionable"


def test_the_description_names_the_value_and_the_range() -> None:
    snapshot = MetricSnapshot(moisture=5.0)
    description = derive_for(SensorStatus.WARNING, snapshot)[0].description
    assert "5.0" in description
    assert "30" in description and "70" in description
    assert "below" in description


def test_a_high_breach_says_above() -> None:
    snapshot = MetricSnapshot(moisture=95.0)
    assert "above" in derive_for(SensorStatus.WARNING, snapshot)[0].description


def test_no_snapshot_and_online_yields_nothing() -> None:
    """Defensive: a reachable sensor with no reading is already `offline` by
    `derive()`, so this branch should not normally be reached."""
    assert derive_for(SensorStatus.NORMAL, None) == []
