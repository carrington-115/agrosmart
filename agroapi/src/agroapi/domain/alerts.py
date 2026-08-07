# SPDX-License-Identifier: MIT
"""Alert derivation. PURE.

Nothing in this system inserts an `alerts` row. The table exists, the dashboard
accepts and rejects them, and `seed.sql` supplies fixtures — but no code has ever
created one, so on a real deployment the alerts page is permanently empty.

Deriving them from the current readings is the honest answer: the conditions are
already computable from the latest reading and the bands, and a derived alert
**clears itself** when the reading returns to range, which is the behaviour a
threshold alert should have had all along. It also removes the reason the
frontend was carrying this logic in `lib/derived-alerts.ts` — a threshold
comparison in a React module, where `thresholds.py` cannot be its single source.

Derived alerts are marked so the UI can tell them apart. They have no row, so
they cannot be accepted or resolved, and offering those controls would be a
button that does nothing.

The quality flags are respected because everything routes through
`status.breaches()`: dry soil raises no salinity alert, a settling probe raises
nothing at all, and NPK is never alerted on while it is back-calculated from
conductivity.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta

from agroapi.domain.status import Breach, MetricSnapshot, SensorStatus, breaches

#: Human-readable metric names, for alert titles.
_LABELS = {
    "temperature": "Temperature",
    "moisture": "Soil moisture",
    "salinity": "Salinity",
    "sunlight": "Sunlight",
    "ph_soil": "Soil pH",
    "ph_water": "Water pH",
}

#: What to do about each condition, in plain language.
#:
#: The SRS asks for guidance a non-technical farmer can act on at roughly a
#: 10th-grade reading level, so these are sentences rather than parameter names.
_STEPS = {
    "moisture": [
        "Check the soil by hand near the sensor to confirm the reading.",
        "Irrigate early morning or evening so less is lost to evaporation.",
        "Re-check after a few hours — if unchanged, water may be running off "
        "rather than soaking in.",
    ],
    "temperature": [
        "Mulch the surface to buffer the root zone against swings.",
        "Water more often but less heavily during hot spells.",
        "Delay planting heat-sensitive varieties until it settles.",
    ],
    "ph_soil": [
        "Take soil samples from the affected area for lab verification.",
        "Apply lime to raise pH, or elemental sulfur to lower it, at a lab-advised rate.",
        "Re-test after three to four weeks; pH moves slowly.",
    ],
    "ph_water": [
        "Test the irrigation source directly.",
        "Check whether any injected fertiliser is shifting the pH.",
    ],
    "salinity": [
        "Irrigate deeply with clean, low-salt water to leach salts below the root zone.",
        "Confirm drainage is carrying the leachate away rather than pooling.",
        "Avoid further fertiliser applications until levels drop.",
    ],
    "sunlight": [
        "Check the sensor for dust, leaves or shading from nearby growth.",
        "Treat this as a trend — the sensor is uncalibrated and relative.",
    ],
}

_OFFLINE_STEPS = [
    "Confirm the sensor has power.",
    "Check it is within range of the network it was configured for.",
    "If it recently moved, it may need re-pairing.",
]


@dataclass(frozen=True, slots=True)
class DerivedAlert:
    """An alert computed from the present state rather than stored.

    `id` is deterministic — same sensor, same condition, same id — so a client
    can keep a dismissal or an expanded panel attached to it across refreshes
    without a database row to hang it on.
    """

    id: str
    title: str
    description: str
    severity: str
    label: str
    sensor_code: str
    at: datetime | None
    steps: list[str] = field(default_factory=list)


def describe(breach: Breach) -> str:
    """One sentence naming the value and the range it left."""
    label = _LABELS.get(breach.metric, breach.metric)
    band = breach.band
    if breach.value < band.low:
        return f"{label} is {breach.value}, below the {band.low}–{band.high} range."
    return f"{label} is {breach.value}, above the {band.low}–{band.high} range."


def for_sensor(
    sensor_code: str,
    status: SensorStatus,
    snapshot: MetricSnapshot | None,
    last_seen_at: datetime | None,
    recorded_at: datetime | None,
    offline_after: timedelta,
) -> list[DerivedAlert]:
    """Alerts for one sensor's current state.

    An offline node produces exactly **one** alert and no threshold alerts. That
    is deliberate: a sensor we cannot hear from is a more urgent and more
    actionable fact than whatever its last reading happened to say, and emitting
    six stale breaches alongside it buries the one thing worth acting on.
    """
    if status is SensorStatus.OFFLINE:
        minutes = max(1, int(offline_after.total_seconds() // 60))
        described = (
            f"No data has arrived from this sensor in over {minutes} minutes. Its "
            "last readings are still shown, but they are no longer current."
            if last_seen_at is not None
            else "This sensor has never reported. Check that it is powered on and "
            "connected to your network."
        )
        return [
            DerivedAlert(
                id=f"derived:offline:{sensor_code}",
                title=f"{sensor_code} has stopped reporting",
                description=described,
                severity="destructive",
                label="Offline",
                sensor_code=sensor_code,
                at=last_seen_at,
                steps=list(_OFFLINE_STEPS),
            )
        ]

    if snapshot is None:
        return []

    out: list[DerivedAlert] = []
    for breach in breaches(snapshot):
        label = _LABELS.get(breach.metric, breach.metric)
        out.append(
            DerivedAlert(
                id=f"derived:{breach.metric}:{sensor_code}",
                title=f"{label} out of range on {sensor_code}",
                description=describe(breach),
                # `secondary`, not `destructive`. A threshold breach deserves
                # attention but is not the same order of problem as a node going
                # dark, and colouring both alike trains the user to ignore both.
                severity="secondary",
                label=label,
                sensor_code=sensor_code,
                at=recorded_at,
                steps=list(_STEPS.get(breach.metric, [])),
            )
        )
    return out
