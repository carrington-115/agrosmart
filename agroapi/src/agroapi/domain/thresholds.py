# SPDX-License-Identifier: MIT
"""The safe bands. Single source of truth.

These currently exist TWICE in the frontend — in `deriveStatus()` in
app/api/ingest/route.ts and in `lib/analytics.tsx`. They agree today and will
drift. This module is the one place they live once the backend owns them.

Values are ported verbatim from lib/analytics.tsx, with one deliberate
correction noted on `PH_SOIL` below.

CAVEAT, and it needs an agronomist rather than a programmer: these bands are
generic. Real thresholds depend on crop, growth stage and soil type. They are
recorded here as the existing behaviour, not as agronomic truth.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Band:
    """Inclusive range considered healthy."""

    low: float
    high: float

    def contains(self, value: float) -> bool:
        return self.low <= value <= self.high


TEMPERATURE = Band(15, 30)
MOISTURE = Band(30, 70)
SUNLIGHT = Band(400, 1000)
SALINITY = Band(0, 0.5)

#: Soil pH, NOT the 6.0–7.5 the frontend applies to its single `ph` field.
#:
#: The probe's own measuring range is 3–9 and its accuracy is ±0.3, so a soil pH
#: of 5.5 is a real acid soil rather than an anomaly worth alerting on. Applying
#: a water-pH band to a soil reading — which is what the current code does, since
#: it has only one `ph` field — produces warnings on perfectly ordinary soil.
PH_SOIL = Band(5.5, 8.0)

#: Water pH. This is where the tighter band actually belongs.
PH_WATER = Band(6.0, 7.5)

NITROGEN = Band(100, 200)
PHOSPHORUS = Band(40, 80)
POTASSIUM = Band(150, 350)
