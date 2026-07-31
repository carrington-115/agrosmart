# SPDX-License-Identifier: MIT
"""Device credential lookup.

`device_tokens` has RLS enabled with zero policies, which is deny-all to `anon`
and `authenticated` — credentials are not readable through a user-scoped
connection, not even by their owner. So every function here takes a `ServiceConn`
and that is not an oversight: it is the one place in this codebase where
bypassing RLS is the correct answer rather than a shortcut.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from agroapi.db.session import ServiceConn


@dataclass(frozen=True, slots=True)
class DeviceIdentity:
    """The sensor a presented token speaks for.

    `sensor_code` is carried alongside `sensor_id` so the router can check the
    envelope's `sensorId` against the credential without a second query. The
    device does not get to nominate which sensor it writes to — the token does.
    """

    sensor_id: UUID
    sensor_code: str
    owner_id: UUID
    token_id: str
    secret_hash: bytes


#: Filters on `revoked_at` and `expires_at` in SQL rather than in Python so a
#: revoked token is indistinguishable from an unknown one all the way up: both
#: return None, and `deps.current_device` turns both into the same 401.
#:
#: The join to `sensors` is inner, so a token whose sensor was deleted stops
#: working. `device_tokens.sensor_id` cascades on delete, making that unreachable
#: today, but relying on the cascade to enforce it would be relying on a detail
#: of another table's DDL.
_FIND_ACTIVE = """
select t.token_id, t.secret_hash, s.id as sensor_id, s.sensor_code, s.owner_id
from public.device_tokens t
join public.sensors s on s.id = t.sensor_id
where t.token_id = $1
  and t.revoked_at is null
  and (t.expires_at is null or t.expires_at > now())
"""


async def find_active_token(conn: ServiceConn, token_id: str) -> DeviceIdentity | None:
    """Look a credential up by its PUBLIC half.

    `token_id` is not a secret, which is the whole reason the token format splits
    it out: identifying the device is an O(1) unique-index lookup with no
    candidate iteration, so response time cannot leak which devices exist. Only
    the secret comparison that the caller performs afterwards needs to be
    constant-time.
    """
    row = await conn.fetchrow(_FIND_ACTIVE, token_id)
    if row is None:
        return None
    return DeviceIdentity(
        sensor_id=row["sensor_id"],
        sensor_code=row["sensor_code"],
        owner_id=row["owner_id"],
        token_id=row["token_id"],
        secret_hash=bytes(row["secret_hash"]),
    )


async def touch_last_used(conn: ServiceConn, token_id: str) -> None:
    """Record that a credential was successfully used.

    Called only after `verify` succeeds. Stamping it on presentation instead
    would let an unauthenticated caller write to the table by guessing a
    `token_id`, and would make `last_used_at` mean "last attempted", which is not
    what anyone reading it to find a dead node wants it to mean.
    """
    await conn.execute(
        "update public.device_tokens set last_used_at = now() where token_id = $1",
        token_id,
    )


async def register_token(
    conn: ServiceConn,
    sensor_id: UUID,
    token_id: str,
    secret_hash: bytes,
    label: str | None = None,
    expires_at: datetime | None = None,
) -> None:
    """Store a freshly minted credential.

    Only the hash is persisted; the plaintext is the caller's single copy. A
    separate table rather than a column on `sensors` because rotation needs two
    valid tokens at once — mint the new one, flash the device, revoke the old.
    """
    await conn.execute(
        """
        insert into public.device_tokens
            (sensor_id, token_id, secret_hash, label, expires_at)
        values ($1, $2, $3, $4, $5)
        """,
        sensor_id,
        token_id,
        secret_hash,
        label,
        expires_at,
    )


async def find_sensor_by_code(conn: ServiceConn, sensor_code: str) -> list[UUID]:
    """Resolve a device-printed code to sensor rows.

    Returns a list because `sensor_code` is unique per OWNER, not globally
    (`sensors_owner_code_unique`), so two tenants may legitimately both own an
    'AGS-001'. Callers must refuse to act on an ambiguous result rather than
    taking the first row — picking one would silently bind a credential to
    whichever tenant happened to sort first.
    """
    rows = await conn.fetch(
        "select id from public.sensors where upper(sensor_code) = upper($1)",
        sensor_code,
    )
    return [row["id"] for row in rows]
