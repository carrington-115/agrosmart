# SPDX-License-Identifier: MIT
"""The dashboard read API.

Every route depends on `user_conn`, so the request runs on a connection where
`auth.uid()` resolves and the RLS policies from 0001_init.sql do the enforcing. No
handler here writes an ownership predicate — that is the point of `user_scope`,
and a forgotten `where owner_id` cannot leak another tenant's rows because there
is no `where owner_id` to forget.

These routers validate and wire. `now` is read once per request and passed down;
the thresholds, the status derivation and the alert text all live in `domain/`,
where every case is a fixture rather than a live sensor.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from agroapi.config import Settings
from agroapi.db.repositories import queries
from agroapi.db.session import UserConn
from agroapi.deps import get_settings, user_conn
from agroapi.domain import alerts as domain_alerts
from agroapi.errors import ErrorCode, http_error
from agroapi.schemas import mappers
from agroapi.schemas.read import (
    AlertOut,
    MeOut,
    Page,
    ReadingOut,
    SensorOut,
    ThresholdsOut,
)

router = APIRouter(tags=["dashboard"])

#: Hard ceiling on a single page of readings, whatever the caller asks for. The
#: table grows by ~1,440 rows per node per day, so an unbounded read is a request
#: that gets slower forever.
_MAX_LIMIT = 500


def _not_found(code: str) -> Exception:
    return http_error(
        ErrorCode.SENSOR_NOT_FOUND,
        status.HTTP_404_NOT_FOUND,
        f"No sensor with code {code} is registered to you.",
        sensorCode=code,
    )


@router.get("/sensors", response_model_exclude_none=True)
async def list_sensors(
    conn: Annotated[UserConn, Depends(user_conn)],
    config: Annotated[Settings, Depends(get_settings)],
) -> list[SensorOut]:
    """Every sensor the caller owns, each with its newest reading.

    One query, not one per sensor: the repository uses a lateral join so a farm
    with fifty nodes costs fifty rows rather than every reading ever taken.
    """
    now = datetime.now(UTC)
    offline_after = timedelta(seconds=config.offline_after_seconds)
    rows = await queries.latest_per_sensor(conn)
    return [mappers.sensor_out(row, now, offline_after) for row in rows]


@router.get("/sensors/{code}", response_model_exclude_none=True)
async def get_sensor(
    code: str,
    conn: Annotated[UserConn, Depends(user_conn)],
    config: Annotated[Settings, Depends(get_settings)],
) -> SensorOut:
    row = await queries.sensor_by_code(conn, code)
    if row is None:
        # Under RLS "no such sensor" and "someone else's sensor" are the same
        # observation. That is correct: the 404 leaks nothing about what exists.
        raise _not_found(code)

    now = datetime.now(UTC)
    return mappers.sensor_out(row, now, timedelta(seconds=config.offline_after_seconds))


@router.get("/sensors/{code}/readings", response_model_exclude_none=True)
async def get_sensor_readings(
    code: str,
    conn: Annotated[UserConn, Depends(user_conn)],
    limit: Annotated[int, Query(ge=1, le=_MAX_LIMIT)] = 50,
    since: Annotated[datetime | None, Query(alias="from")] = None,
    until: Annotated[datetime | None, Query(alias="to")] = None,
    cursor: Annotated[str | None, Query()] = None,
) -> Page[ReadingOut]:
    """One sensor's history, newest first.

    Keyset-paginated on `(recorded_at, id)` rather than by offset. Readings arrive
    continuously, so an offset walks backwards through a list growing at the front
    and can return the same row on two consecutive pages.
    """
    row = await queries.sensor_by_code(conn, code)
    if row is None:
        raise _not_found(code)

    cursor_time, cursor_id = _decode_cursor(cursor)

    rows = await queries.readings_for_sensor(
        conn, code, since, until, limit, cursor_time, cursor_id
    )

    # A full page implies there may be more; a short one is definitive. Asking for
    # limit+1 to know for certain would cost a row on every request to save a
    # single empty response on the last one.
    next_cursor = (
        _encode_cursor(rows[-1]["recorded_at"], rows[-1]["id"]) if len(rows) == limit else None
    )

    return Page(items=[mappers.reading_out(r) for r in rows], next_cursor=next_cursor)


@router.get("/readings", response_model_exclude_none=True)
async def list_readings(
    conn: Annotated[UserConn, Depends(user_conn)],
    sensor_ids: Annotated[list[str] | None, Query(alias="sensorIds")] = None,
    hours: Annotated[int, Query(ge=1, le=24 * 30)] = 24,
    limit: Annotated[int, Query(ge=1, le=_MAX_LIMIT)] = 500,
) -> list[ReadingOut]:
    """Readings across sensors over a window, oldest first — chart shape.

    Ascending, unlike the paged history above, because a chart draws left to
    right. Omitting `sensorIds` means every sensor the caller owns.
    """
    since = datetime.now(UTC) - timedelta(hours=hours)
    rows = await queries.readings_for_sensors(conn, sensor_ids, since, limit)
    return [mappers.reading_out(r) for r in rows]


@router.get("/alerts", response_model_exclude_none=True)
async def list_alerts(
    conn: Annotated[UserConn, Depends(user_conn)],
    config: Annotated[Settings, Depends(get_settings)],
) -> list[AlertOut]:
    """Stored alerts plus alerts derived from the current readings.

    Nothing in this system inserts an alert row, so stored-only would mean a
    permanently empty page on any real deployment. Derived ones are marked
    `derived: true`; they carry no row, cannot be accepted or rejected, and clear
    themselves when the reading recovers.

    Derived come first: they describe right now, which is what the page is for.
    """
    now = datetime.now(UTC)
    offline_after = timedelta(seconds=config.offline_after_seconds)

    sensor_rows = await queries.latest_per_sensor(conn)
    derived: list[AlertOut] = []

    for row in sensor_rows:
        sensor = mappers.sensor_out(row, now, offline_after)
        snapshot = mappers.snapshot_of(row) if row["recorded_at"] is not None else None
        for alert in domain_alerts.for_sensor(
            sensor_code=row["sensor_code"],
            status=sensor.status,
            snapshot=snapshot,
            last_seen_at=row["last_seen_at"],
            recorded_at=row["recorded_at"],
            offline_after=offline_after,
        ):
            derived.append(mappers.derived_alert_out(alert))

    stored = [mappers.stored_alert_out(r) for r in await queries.alerts(conn)]
    return derived + stored


@router.get("/me", response_model_exclude_none=True)
async def get_me(conn: Annotated[UserConn, Depends(user_conn)]) -> MeOut:
    """Profile, farm and settings together.

    The dashboard shell needs all three before it can render, so three endpoints
    would be three sequential round trips to show one page.
    """
    return MeOut(
        profile=mappers.profile_out(await queries.profile(conn)),
        farm=mappers.farm_out(await queries.farm(conn)),
        settings=mappers.settings_out(await queries.settings(conn)),
    )


@router.get("/thresholds")
async def get_thresholds() -> ThresholdsOut:
    """The safe bands.

    Unauthenticated on purpose: these are constants compiled into the service, not
    anybody's data, and the dashboard needs them to label a reading "Low" before
    it has necessarily loaded a session. Serving them is what lets
    `domain/thresholds.py` be the only place the numbers are written down —
    without it the frontend must keep a copy, which is the duplication this
    endpoint exists to end.
    """
    return mappers.thresholds_out()


# --------------------------------------------------------------------- cursor
#
# `<epoch_micros>.<row_id>`. Opaque to the client by contract, but deliberately
# not encrypted or signed: it encodes a position in the caller's own data, which
# RLS already restricts, so there is nothing here they could not read anyway.


def _encode_cursor(recorded_at: datetime, row_id: int) -> str:
    return f"{int(recorded_at.timestamp() * 1_000_000)}.{row_id}"


def _decode_cursor(cursor: str | None) -> tuple[datetime | None, int | None]:
    """Parse a cursor, treating anything malformed as no cursor.

    A bad cursor returns the first page rather than a 422. It is a value the
    client got from us and is expected to pass back verbatim, so a malformed one
    means a truncated URL, and starting over is more useful than an error.
    """
    if not cursor:
        return None, None
    try:
        micros, _, row_id = cursor.partition(".")
        return datetime.fromtimestamp(int(micros) / 1_000_000, tz=UTC), int(row_id)
    except (ValueError, OverflowError, OSError):
        return None, None
