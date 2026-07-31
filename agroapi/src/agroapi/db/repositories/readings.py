# SPDX-License-Identifier: MIT
"""Telemetry writes.

Takes a `ReadingInsert` that `domain/telemetry.py` has already fully resolved.
Nothing here decides anything: no defaulting, no coercion, no clock. If a value
arrives as `None` it is stored as NULL, because `None` means the sensor did not
report and there is no number that says that.
"""

from __future__ import annotations

import json
from uuid import UUID

from agroapi.db.session import ServiceConn
from agroapi.domain.telemetry import ReadingInsert

#: Every column here appears in `db/pool.py:_WRITE_CONTRACT`, and that is the
#: point of the contract: readiness fails loudly when this statement is aimed at
#: a database where 0002 was never pushed, instead of the insert failing on the
#: first device transmission.
#:
#: `ph` is deliberately absent and must stay absent. 0002 made it a STORED
#: generated column over coalesce(ph_soil, ph_water) so that reads keep working
#: while writes fail hard — naming it here would resurrect exactly the bug that
#: migration was shaped to kill.
#:
#: ON CONFLICT DO NOTHING covers both partial unique indexes:
#:
#:   * sensor_readings_uid_uniq       (sensor_id, reading_uid) where uid not null
#:   * sensor_readings_device_ts_uniq (sensor_id, recorded_at) where source='device'
#:
#: A conflict means the device is replaying a buffer it already delivered. That
#: is a SUCCESS — it must ack so the node drops the entry — so the caller
#: distinguishes it by the NULL id rather than by an exception.
_INSERT = """
insert into public.sensor_readings (
    sensor_id, recorded_at, received_at, recorded_at_source, reading_uid,
    payload_version, raw,
    temperature, moisture, salinity, ph_soil, ph_water, water_temperature,
    sunlight, water_level, nitrogen, phosphorus, potassium,
    npk_estimated, stabilising, soil_dry
)
values (
    $1, $2, $3, $4::public.reading_time_source, $5,
    $6, $7::jsonb,
    $8, $9, $10, $11, $12, $13,
    $14, $15, $16, $17, $18,
    $19, $20, $21
)
on conflict do nothing
returning id
"""


async def insert_reading(
    conn: ServiceConn,
    sensor_id: UUID,
    row: ReadingInsert,
    raw: dict[str, object],
) -> int | None:
    """Store one reading. Returns its id, or None if it was already stored.

    `raw` is the validated envelope kept verbatim. At ~400 B against 1440
    rows/day/node it is the difference between "add a column and backfill" and
    "that data is gone" the next time the schema moves.
    """
    reading_id: int | None = await conn.fetchval(
        _INSERT,
        sensor_id,
        row.recorded_at,
        row.received_at,
        row.recorded_at_source,
        row.reading_uid,
        row.payload_version,
        json.dumps(raw),
        row.temperature,
        row.moisture,
        row.salinity,
        row.ph_soil,
        row.ph_water,
        row.water_temperature,
        row.sunlight,
        row.water_level,
        row.nitrogen,
        row.phosphorus,
        row.potassium,
        row.npk_estimated,
        row.stabilising,
        row.soil_dry,
    )
    return reading_id


#: `last_seen_at` tracks ARRIVAL and is set unconditionally: a device draining a
#: week-old buffer is online right now, and liveness is the question this column
#: exists to answer.
#:
#: Everything else is device STATE — the answer to "what is true of this node
#: now" — so it is guarded on the reading being newer than the last one we have.
#: Without that guard, replaying a buffered outage would rewind `firmware_version`
#: to the build that was running during the outage and clobber a currently-normal
#: sensor's RSSI with a stale one. The guard is `is null or <` rather than
#: `coalesce(...)` so the first reading for a sensor takes the branch too.
_TOUCH = """
update public.sensors
set last_seen_at        = $2,
    last_reading_at     = greatest(last_reading_at, $3),
    last_rssi           = case
                            when last_reading_at is null or last_reading_at < $3
                            then $4 else last_rssi end,
    last_uptime_seconds = case
                            when last_reading_at is null or last_reading_at < $3
                            then $5 else last_uptime_seconds end,
    firmware_version    = case
                            when last_reading_at is null or last_reading_at < $3
                            then coalesce($6, firmware_version) else firmware_version end,
    updated_at          = now()
where id = $1
"""


async def update_device_state(
    conn: ServiceConn,
    sensor_id: UUID,
    row: ReadingInsert,
) -> None:
    """Fold one reading into the sensor's current-state columns.

    Diagnostics live on `sensors` rather than on every reading because they are
    only ever read as "current" — writing fw:"0.1.0" 1440 times a day stores the
    same string 1440 times to answer a question about right now.

    Note what this does NOT do: it does not touch `status`. Nothing in this
    codebase creates alerts yet, and deriving a status here would put a threshold
    comparison in a repository, where `domain/thresholds.py` cannot be the single
    source of it.
    """
    await conn.execute(
        _TOUCH,
        sensor_id,
        row.received_at,
        row.recorded_at,
        row.rssi,
        row.uptime_seconds,
        row.firmware_version,
    )
