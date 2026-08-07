# SPDX-License-Identifier: MIT
"""Dashboard reads.

Every function here takes a `UserConn` — never a pool, never a `Request` — and
**none of them writes a `where owner_id` clause**. That is not an omission. The
connection has already been scoped by `db/session.py:user_scope`, so the RLS
policies from 0001_init.sql do the enforcing, and a query that forgot its
ownership predicate returns zero rows rather than another tenant's data.

Hand-filtering would move that guarantee into forty individual `where` clauses,
any one of which could be dropped in a refactor without a test noticing. The
`UserConn`/`ServiceConn` type split exists so this cannot be bypassed by accident.

None of these statements select `sensor_readings.ph`. It is a generated column
0002 kept only so the pre-cutover frontend's reads survived; it merges soil and
water pH into one number and nothing new should consume it.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from agroapi.db.session import UserConn

#: The reading columns every query below returns, in one place so the row-to-DTO
#: mapper can rely on the shape. Aliased to nothing — these are the real names.
_READING_COLUMNS = """
    r.recorded_at, r.received_at, r.recorded_at_source,
    r.temperature, r.moisture, r.salinity,
    r.ph_soil, r.ph_water, r.water_temperature,
    r.sunlight, r.water_level,
    r.nitrogen, r.phosphorus, r.potassium,
    r.npk_estimated, r.stabilising, r.soil_dry
"""

#: One row per sensor, each with its newest reading.
#:
#: `left join lateral … limit 1` rather than fetching every reading and reducing
#: in the caller. The frontend's previous implementation loaded *all* readings for
#: *all* sensors and picked the newest in JavaScript; at one reading a minute per
#: node that is ~1,440 rows/node/day and degrades within days of real use.
#:
#: LEFT, not INNER: a sensor that has been registered but has never reported must
#: still appear, with no reading. It is the case the dashboard most needs to show.
#:
#: Ordered on `recorded_at desc` — measurement time, not arrival — because
#: "latest reading" means the most recent measurement. `sensor_readings_sensor_recorded_idx`
#: from 0001 serves exactly this.
_LATEST_PER_SENSOR = f"""
select
    s.id, s.sensor_code, s.sensor_tag, s.farm_id,
    s.last_seen_at, s.last_reading_at, s.last_rssi,
    s.last_uptime_seconds, s.firmware_version,
    {_READING_COLUMNS}
from public.sensors s
left join lateral (
    select * from public.sensor_readings r
    where r.sensor_id = s.id
    order by r.recorded_at desc
    limit 1
) r on true
order by s.sensor_code
"""

_ONE_SENSOR = f"""
select
    s.id, s.sensor_code, s.sensor_tag, s.farm_id,
    s.last_seen_at, s.last_reading_at, s.last_rssi,
    s.last_uptime_seconds, s.firmware_version,
    {_READING_COLUMNS}
from public.sensors s
left join lateral (
    select * from public.sensor_readings r
    where r.sensor_id = s.id
    order by r.recorded_at desc
    limit 1
) r on true
where upper(s.sensor_code) = upper($1)
"""


@dataclass(frozen=True, slots=True)
class SensorReadingRow:
    """A sensor joined with its latest reading, straight from the database.

    Deliberately not a Pydantic model: this is the shape the SQL returns, and the
    router maps it to `schemas/read.py`. Keeping the two separate means a column
    rename cannot silently change the wire format.
    """

    row: Any

    @property
    def has_reading(self) -> bool:
        return self.row["recorded_at"] is not None


async def latest_per_sensor(conn: UserConn) -> list[Any]:
    """Every sensor the caller owns, with its newest reading."""
    return list(await conn.fetch(_LATEST_PER_SENSOR))


async def sensor_by_code(conn: UserConn, code: str) -> Any | None:
    """One sensor by device code, case-insensitively.

    `upper(...) = upper(...)` matches `devices.py:find_sensor_by_code`, so a code
    typed in lowercase on the sensors page resolves the same way ingest resolves it.
    """
    return await conn.fetchrow(_ONE_SENSOR, code)


#: History for one sensor, newest first, keyset-paginated.
#:
#: The cursor is `(recorded_at, id)` rather than `recorded_at` alone because a
#: batch replay writes many rows sharing a transaction timestamp; on
#: `recorded_at` alone a page boundary landing inside such a group would skip or
#: repeat rows. `id` is the tiebreak that makes the order total.
_READINGS_FOR_SENSOR = f"""
select r.id, {_READING_COLUMNS}
from public.sensor_readings r
join public.sensors s on s.id = r.sensor_id
where upper(s.sensor_code) = upper($1)
  and ($2::timestamptz is null or r.recorded_at >= $2)
  and ($3::timestamptz is null or r.recorded_at <= $3)
  and ($4::timestamptz is null or (r.recorded_at, r.id) < ($4, $5))
order by r.recorded_at desc, r.id desc
limit $6
"""


async def readings_for_sensor(
    conn: UserConn,
    code: str,
    since: datetime | None,
    until: datetime | None,
    limit: int,
    cursor_time: datetime | None = None,
    cursor_id: int | None = None,
) -> list[Any]:
    """A bounded page of one sensor's history.

    `limit` is always applied by the caller's validated query parameter — there is
    no unbounded path, because an unbounded read of a table that grows by 1,440
    rows per node per day is a request that gets slower forever.
    """
    return list(
        await conn.fetch(
            _READINGS_FOR_SENSOR,
            code,
            since,
            until,
            cursor_time,
            cursor_id or 0,
            limit,
        )
    )


#: Readings across several sensors over a window, oldest first — the shape a
#: time-series chart consumes directly.
#:
#: Ascending here while the paged query above is descending, and both are right:
#: a chart draws left to right, a history table shows the newest first.
_READINGS_FOR_SENSORS = f"""
select r.sensor_id, s.sensor_code, {_READING_COLUMNS}
from public.sensor_readings r
join public.sensors s on s.id = r.sensor_id
where ($1::text[] is null or upper(s.sensor_code) = any($1))
  and r.recorded_at >= $2
order by r.recorded_at
limit $3
"""


async def readings_for_sensors(
    conn: UserConn,
    codes: list[str] | None,
    since: datetime,
    limit: int,
) -> list[Any]:
    """Series data. `codes` of None means every sensor the caller owns."""
    upper = [c.upper() for c in codes] if codes else None
    return list(await conn.fetch(_READINGS_FOR_SENSORS, upper, since, limit))


#: Every alert, every state, newest first.
#:
#: Unfiltered on purpose. Pinning `state = 'open'` in SQL is the bug this
#: codebase already had once: the dashboard grew a status filter that could never
#: show an accepted alert, because the row was gone before the filter ran.
#: Filtering is the caller's business.
_ALERTS = """
select a.id, a.title, a.description, a.severity, a.label, a.state, a.created_at,
       s.sensor_code
from public.alerts a
left join public.sensors s on s.id = a.sensor_id
order by a.created_at desc
"""


async def alerts(conn: UserConn) -> list[Any]:
    return list(await conn.fetch(_ALERTS))


async def alert_exists(conn: UserConn, alert_id: UUID) -> bool:
    """Whether the caller can see this alert.

    Under RLS "does not exist" and "belongs to someone else" are the same
    observation, which is the correct thing to leak: nothing.
    """
    row = await conn.fetchrow("select 1 from public.alerts where id = $1", alert_id)
    return row is not None


_PROFILE = """
select id, name, email, phone, address, avatar_url
from public.profiles
limit 1
"""

_FARM = """
select id, farm_name, farm_type, farm_size, farm_zones, country, state, city, address
from public.farms
order by created_at
limit 1
"""

_SETTINGS = """
select pair_by_id, pair_by_qr,
       reports_weekly, reports_monthly, reports_email,
       alerts_dashboard, alerts_popup, alerts_email, alerts_sms,
       alerts_delete_ignored_after_days
from public.user_settings
limit 1
"""


async def profile(conn: UserConn) -> Any | None:
    """The caller's profile. RLS restricts `profiles` to `auth.uid() = id`, so the
    bare `limit 1` can only ever return their own row."""
    return await conn.fetchrow(_PROFILE)


async def farm(conn: UserConn) -> Any | None:
    """The caller's first farm. Multi-farm is not modelled in the UI yet."""
    return await conn.fetchrow(_FARM)


async def settings(conn: UserConn) -> Any | None:
    """The caller's preferences, or None when they have never saved any."""
    return await conn.fetchrow(_SETTINGS)
