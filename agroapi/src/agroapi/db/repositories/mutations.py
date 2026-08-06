# SPDX-License-Identifier: MIT
"""Dashboard writes.

`UserConn` throughout, like `queries.py`, so RLS enforces ownership on the way in
as well as on the way out. The `with check` half of each policy from 0001_init.sql
is what makes `owner_id = auth.uid()` true by construction rather than by a
predicate someone has to remember to write.

`owner_id` is still named explicitly on inserts, and that is not a contradiction:
Postgres needs a value for a NOT NULL column, and RLS then verifies the value
matches `auth.uid()`. A forged id is rejected by the database, not trusted from
the request. `auth.uid()` is used as the default rather than a value passed down
from the router, so there is no path by which a caller's claim about who they are
reaches the column.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from agroapi.db.session import UserConn

#: Attach to the caller's first farm when they have one; `farm_id` is nullable.
#: A scalar subquery rather than a second round trip — and RLS scopes it, so it
#: cannot pick up another tenant's farm.
_REGISTER_SENSOR = """
insert into public.sensors (owner_id, farm_id, sensor_code, sensor_tag, status)
values (
    auth.uid(),
    (select id from public.farms order by created_at limit 1),
    $1, $2, 'offline'
)
returning id, sensor_code, sensor_tag, farm_id
"""


async def register_sensor(conn: UserConn, code: str, tag: str | None) -> Any:
    """Register a sensor to the caller.

    Inserted as `offline` with a null `last_seen_at`, which is honest: it has
    never reported. The read API derives `offline` from that until it does, so no
    separate "pending" state is needed.

    A unique violation on `(owner_id, sensor_code)` propagates as
    `asyncpg.UniqueViolationError` for the router to turn into a typed 409.
    """
    return await conn.fetchrow(_REGISTER_SENSOR, code.upper(), tag)


async def delete_sensor_by_code(conn: UserConn, code: str) -> bool:
    """Remove a sensor. True when a row went; False when there was none to remove.

    Readings cascade with it (0001 declares the FK `on delete cascade`), which is
    the intended behaviour: a sensor's history is meaningless once the sensor it
    describes is gone from the account.
    """
    result = await conn.execute(
        "delete from public.sensors where upper(sensor_code) = upper($1)", code
    )
    # asyncpg returns the command tag, e.g. "DELETE 1".
    return result.rsplit(" ", 1)[-1] != "0"


async def set_alert_state(conn: UserConn, alert_id: UUID, state: str) -> Any | None:
    """Accept or reject an alert. None when the caller cannot see it."""
    return await conn.fetchrow(
        """
        update public.alerts
        set state = $2::public.alert_state
        where id = $1
        returning id, title, description, severity, label, state, created_at
        """,
        alert_id,
        state,
    )


#: `profiles.id` is the auth user id, so this upserts on the caller's own row.
_UPSERT_PROFILE = """
insert into public.profiles (id, name, email, phone, address)
values (auth.uid(), $1, $2, $3, $4)
on conflict (id) do update set
    name    = coalesce(excluded.name,    public.profiles.name),
    email   = coalesce(excluded.email,   public.profiles.email),
    phone   = coalesce(excluded.phone,   public.profiles.phone),
    address = coalesce(excluded.address, public.profiles.address)
returning id, name, email, phone, address, avatar_url
"""


async def upsert_profile(
    conn: UserConn,
    name: str | None,
    email: str | None,
    phone: str | None,
    address: str | None,
) -> Any:
    """Update the caller's profile, leaving unsent fields alone.

    `coalesce(excluded.x, existing.x)` so a partial update is a partial update. A
    plain `set x = excluded.x` would blank every field the client did not send,
    which turns "change my phone number" into "erase my address".
    """
    return await conn.fetchrow(_UPSERT_PROFILE, name, email, phone, address)


#: Farms have no natural unique key per owner, so this updates the caller's first
#: farm and inserts only when they have none. `farm_name` is NOT NULL, hence the
#: fallback on insert.
_UPDATE_FARM = """
update public.farms set
    farm_name = coalesce($1, farm_name),
    farm_type = coalesce($2, farm_type),
    farm_size = coalesce($3, farm_size),
    farm_zones= coalesce($4, farm_zones),
    country   = coalesce($5, country),
    state     = coalesce($6, state),
    city      = coalesce($7, city),
    address   = coalesce($8, address)
where id = (select id from public.farms order by created_at limit 1)
returning id, farm_name, farm_type, farm_size, farm_zones, country, state, city, address
"""

_INSERT_FARM = """
insert into public.farms (owner_id, farm_name, farm_type, farm_size, farm_zones,
                          country, state, city, address)
values (auth.uid(), coalesce($1, 'My farm'), $2, $3, $4, $5, $6, $7, $8)
returning id, farm_name, farm_type, farm_size, farm_zones, country, state, city, address
"""


async def upsert_farm(
    conn: UserConn,
    farm_name: str | None,
    farm_type: str | None,
    farm_size: float | None,
    farm_zones: int | None,
    country: str | None,
    state: str | None,
    city: str | None,
    address: str | None,
) -> Any:
    args = (farm_name, farm_type, farm_size, farm_zones, country, state, city, address)
    updated = await conn.fetchrow(_UPDATE_FARM, *args)
    if updated is not None:
        return updated
    return await conn.fetchrow(_INSERT_FARM, *args)


#: One row per user, keyed on the auth id. Every column has a default in 0003, so
#: an insert naming only the changed ones lands the rest at their documented
#: defaults rather than at false.
_SETTINGS_COLUMNS = (
    "pair_by_id",
    "pair_by_qr",
    "reports_weekly",
    "reports_monthly",
    "reports_email",
    "alerts_dashboard",
    "alerts_popup",
    "alerts_email",
    "alerts_sms",
    "alerts_delete_ignored_after_days",
)


async def upsert_settings(conn: UserConn, changes: dict[str, object]) -> Any:
    """Persist the preferences named in `changes`, leaving the rest untouched.

    The column list is filtered against `_SETTINGS_COLUMNS` rather than
    interpolated from the caller's keys. The router validates with a strict Pydantic
    model too, so this is the second of two gates — but a function that builds SQL
    from dictionary keys should not rely on its caller having done that.
    """
    columns = [c for c in _SETTINGS_COLUMNS if c in changes]
    if not columns:
        return await conn.fetchrow(
            f"select {', '.join(_SETTINGS_COLUMNS)} from public.user_settings limit 1"
        )

    placeholders = ", ".join(f"${i + 1}" for i in range(len(columns)))
    assignments = ", ".join(f"{c} = excluded.{c}" for c in columns)
    returning = ", ".join(_SETTINGS_COLUMNS)

    sql = f"""
    insert into public.user_settings (owner_id, {", ".join(columns)})
    values (auth.uid(), {placeholders})
    on conflict (owner_id) do update set {assignments}
    returning {returning}
    """
    return await conn.fetchrow(sql, *[changes[c] for c in columns])
