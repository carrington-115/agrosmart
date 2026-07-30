# SPDX-License-Identifier: MIT
"""The device wire contract, v1.

Mirrors agrosensor/lib/Telemetry/Payload.cpp exactly. Authoritative spec:
agrosensor/docs/integration/dashboard-contract.md.

    {"v":1,"sensorId":"AGS-001","ts":1753900000,
     "readings":{"temperature":24.8,"moisture":42.5,"salinity":0.380,
       "phSoil":6.80,"npk":{"nitrogen":95,"phosphorus":52,"potassium":210},
       "phWater":7.10,"waterTemperature":23.4,"sunlight":780,"waterLevel":63},
     "quality":{"npkEstimated":true,"stabilising":false,"soilDry":false},
     "diag":{"rssi":-62,"uptime":38211,"fw":"0.1.0"}}

Every optional reading is `float | None` and is NEVER given a numeric default.
This is contract rule 1, and it is the single most important property in this
file: a node whose 4-in-1 board is unplugged omits `phWater` entirely, and pH 0.0
is a perfectly plausible-looking acid reading that nothing downstream could
distinguish from a real one.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class Npk(BaseModel):
    """Nitrogen, phosphorus, potassium in mg/kg.

    Read the `npkEstimated` quality flag before trusting these. The probe has no
    chemistry that isolates N, P or K — it measures bulk conductivity and
    back-calculates all three from it.
    """

    model_config = ConfigDict(extra="forbid")

    nitrogen: float | None = None
    phosphorus: float | None = None
    potassium: float | None = None


class Readings(BaseModel):
    """Sensor values. Every field absent when its sensor did not report.

    An empty `readings: {}` is valid — the firmware emits it when both boards
    fail — and must insert an all-NULL row rather than being rejected.
    """

    model_config = ConfigDict(extra="forbid")

    #: Soil temperature, °C. Signed: the probe reports below freezing.
    temperature: float | None = Field(default=None, ge=-50, le=100)
    #: Volumetric water content, %.
    moisture: float | None = Field(default=None, ge=0, le=100)
    #: dS/m, derived from the probe's EC.
    salinity: float | None = Field(default=None, ge=0)
    #: Soil pH. The device only measures 3–9; the firmware omits it outside that
    #: window rather than publishing a number the consumer cannot evaluate.
    ph_soil: float | None = Field(default=None, alias="phSoil", ge=0, le=14)
    npk: Npk | None = None
    #: Water pH, calibrated and temperature-compensated.
    ph_water: float | None = Field(default=None, alias="phWater", ge=0, le=14)
    water_temperature: float | None = Field(
        default=None, alias="waterTemperature", ge=-50, le=100
    )
    #: LDR output. RELATIVE AND UNCALIBRATED — not lux, despite what the
    #: dashboard's column header currently claims.
    sunlight: float | None = Field(default=None, ge=0)
    #: Relative and non-linear. Useful for presence, not for depth.
    water_level: float | None = Field(default=None, alias="waterLevel", ge=0)


class Quality(BaseModel):
    """Load-bearing provenance flags. Required, never defaulted.

    The contract says these are always present specifically so their absence can
    never be misread as `false`. Making them required here rather than giving
    them defaults is what enforces that — a payload missing the block is a 422,
    not a silently optimistic insert.
    """

    model_config = ConfigDict(extra="forbid")

    #: N/P/K are back-calculated from conductivity, not measured. While true, do
    #: not build fertiliser recommendations on them.
    npk_estimated: bool = Field(alias="npkEstimated")
    #: Within the probe's 5-minute post-insertion settling window. Readings are
    #: real but still converging.
    stabilising: bool
    #: Conductivity was zero, which zeroes the derived NPK. EXPECTED in dry soil
    #: and explicitly NOT a fault — must never raise a sensor-failure alert.
    soil_dry: bool = Field(alias="soilDry")


class Diag(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rssi: int | None = None
    #: Seconds since boot. Monotonic within a boot session.
    uptime: int | None = None
    fw: str | None = None


class TelemetryEnvelope(BaseModel):
    """One transmission.

    `extra="forbid"` is deliberate: an unexpected key means the firmware and this
    schema have diverged, and finding that out at the boundary beats storing a
    field nobody reads.
    """

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    v: int
    sensor_id: str = Field(alias="sensorId")
    #: Unix epoch seconds. OMITTED until NTP syncs, in which case the server
    #: stamps arrival rather than trusting a clock known to be wrong. A replayed
    #: buffer entry carries its ORIGINAL ts, which is the whole point of sending
    #: it.
    ts: int | None = None
    #: Device-generated idempotency key, persisted alongside the reading in
    #: LittleFS so a replay presents the same value. Optional: firmware Phase F
    #: may not implement it in the first cut, in which case duplicate protection
    #: falls back to the device-timestamp index.
    uid: str | None = Field(default=None, max_length=64)
    readings: Readings = Field(default_factory=Readings)
    quality: Quality
    diag: Diag = Field(default_factory=Diag)


class TelemetryBatch(BaseModel):
    """A drained store-and-forward buffer.

    Batching matters more here than it normally would: BearSSL costs ~16–22 KB of
    heap per TLS handshake on the ESP8266, so replaying a buffer one request at a
    time is the difference between working and not.
    """

    model_config = ConfigDict(extra="forbid")

    batch: list[TelemetryEnvelope]
