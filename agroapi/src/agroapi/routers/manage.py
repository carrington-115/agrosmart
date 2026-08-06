# SPDX-License-Identifier: MIT
"""Dashboard writes: sensors, alerts, profile, farm, settings, device tokens.

Same discipline as `read.py`: `user_conn` everywhere, so RLS enforces ownership
through the `with check` half of the policies in 0001_init.sql rather than through
a predicate a handler has to remember.

The one exception is token minting, which needs a service connection because
`device_tokens` has RLS enabled with **zero policies** — deny-all even to the row's
owner. That is deliberate: a credential should not be readable through the same
session that a stolen cookie would give an attacker. Ownership is therefore proven
on the user connection *first*, and only the resolved sensor UUID crosses to the
service connection.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, Response, status

from agroapi.auth import device
from agroapi.config import Settings
from agroapi.db.repositories import devices, mutations, queries
from agroapi.db.session import ServiceConn, UserConn
from agroapi.deps import get_settings, service_conn, user_conn
from agroapi.errors import ErrorCode, http_error
from agroapi.schemas import mappers
from agroapi.schemas.manage import (
    AlertStateUpdate,
    DeviceTokenCreate,
    MeUpdate,
    SensorCreate,
    SettingsUpdate,
)
from agroapi.schemas.read import (
    AlertOut,
    DeviceTokenOut,
    MeOut,
    SensorOut,
    SettingsOut,
)

router = APIRouter(tags=["dashboard"])


def _sensor_not_found(code: str) -> Exception:
    return http_error(
        ErrorCode.SENSOR_NOT_FOUND,
        status.HTTP_404_NOT_FOUND,
        f"No sensor with code {code} is registered to you.",
        sensorCode=code,
    )


@router.post(
    "/sensors",
    status_code=status.HTTP_201_CREATED,
    response_model_exclude_none=True,
    responses={409: {"description": "That code is already registered to you."}},
)
async def register_sensor(
    payload: SensorCreate,
    conn: Annotated[UserConn, Depends(user_conn)],
    config: Annotated[Settings, Depends(get_settings)],
) -> SensorOut:
    """Register a sensor to the caller.

    It lands with a null `last_seen_at`, so the read API derives `offline` until
    the device actually reports. That is the honest state — the row exists, the
    hardware has not spoken — and needs no separate "pending" value.
    """
    try:
        row = await mutations.register_sensor(conn, payload.sensor_id, payload.sensor_tag)
    except asyncpg.UniqueViolationError as exc:
        # `sensors_owner_code_unique` is per owner, so this means *this* user
        # already registered it, not that someone else holds the code.
        raise http_error(
            ErrorCode.SENSOR_ALREADY_REGISTERED,
            status.HTTP_409_CONFLICT,
            f"You have already registered a sensor with code {payload.sensor_id}.",
            sensorCode=payload.sensor_id,
        ) from exc

    # Re-read through the same path a GET uses, so a freshly created sensor is
    # byte-identical to one fetched a moment later.
    created = await queries.sensor_by_code(conn, row["sensor_code"])
    if created is None:
        # Unreachable: the row was inserted on this same connection, inside this
        # transaction. Handled rather than asserted so a future change to the
        # scoping cannot turn a logic error into a crash on the happy path.
        raise _sensor_not_found(payload.sensor_id)

    return mappers.sensor_out(
        created, datetime.now(UTC), timedelta(seconds=config.offline_after_seconds)
    )


@router.delete("/sensors/{code}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sensor(
    code: str,
    conn: Annotated[UserConn, Depends(user_conn)],
) -> Response:
    """Remove a sensor and, by cascade, its readings."""
    if not await mutations.delete_sensor_by_code(conn, code):
        raise _sensor_not_found(code)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/sensors/{code}/tokens",
    status_code=status.HTTP_201_CREATED,
    response_model_exclude_none=True,
)
async def mint_device_token(
    code: str,
    payload: DeviceTokenCreate,
    conn: Annotated[UserConn, Depends(user_conn)],
    service: Annotated[ServiceConn, Depends(service_conn)],
    config: Annotated[Settings, Depends(get_settings)],
) -> DeviceTokenOut:
    """Mint a per-device credential for a sensor the caller owns.

    Until now this existed only as `scripts/mint_device_token.py`, so there was no
    path from "I have registered a node" to "the node can post readings" without
    shell access to the server. That gap is why a working deployment could still
    have no data in it.

    **The plaintext is returned exactly once.** Only an HMAC is stored, and
    `device_tokens` is deny-all under RLS, so no endpoint can produce it again.
    Losing it means minting a replacement — which is safe, because rotation is
    non-destructive by design: mint the new one, flash the device, then revoke the
    old.

    Ownership is proven on the user-scoped connection before anything touches the
    service connection. The only value that crosses is a sensor UUID that RLS has
    already confirmed belongs to the caller.
    """
    owned = await queries.sensor_by_code(conn, code)
    if owned is None:
        raise _sensor_not_found(code)

    minted = device.mint(config.token_pepper.get_secret_value())
    expires_at = (
        datetime.now(UTC) + timedelta(days=payload.expires_in_days)
        if payload.expires_in_days is not None
        else None
    )

    await devices.register_token(
        service,
        sensor_id=owned["id"],
        token_id=minted.token_id,
        secret_hash=minted.secret_hash,
        label=payload.label,
        expires_at=expires_at,
    )

    return DeviceTokenOut(
        token_id=minted.token_id,
        token=minted.plaintext,
        label=payload.label,
        expires_at=expires_at,
    )


@router.patch("/alerts/{alert_id}", response_model_exclude_none=True)
async def update_alert(
    alert_id: UUID,
    payload: AlertStateUpdate,
    conn: Annotated[UserConn, Depends(user_conn)],
) -> AlertOut:
    """Accept or reject a stored alert.

    Derived alerts cannot reach here: their ids are strings like
    `derived:offline:AGS-001`, which fail UUID parsing with a 422 before any query
    runs. That is the right answer — there is no row to update, and the alert
    clears itself when the reading recovers.
    """
    row = await mutations.set_alert_state(conn, alert_id, payload.state)
    if row is None:
        raise http_error(
            ErrorCode.ALERT_NOT_FOUND,
            status.HTTP_404_NOT_FOUND,
            "No such alert.",
        )

    # `set_alert_state` does not join `sensors`, so `sensor_code` is absent from
    # the returned row. Build the DTO from what the update gave back.
    return AlertOut(
        id=str(row["id"]),
        title=row["title"],
        description=row["description"],
        severity=row["severity"],
        label=row["label"],
        state=row["state"],
        created_at=row["created_at"],
        derived=False,
    )


@router.put("/me", response_model_exclude_none=True)
async def update_me(
    payload: MeUpdate,
    conn: Annotated[UserConn, Depends(user_conn)],
) -> MeOut:
    """Update profile and/or farm, then return the whole `me` document.

    Returning the full document rather than just the changed part means the client
    has one shape for both `GET` and `PUT` and never has to merge a partial
    response into cached state.
    """
    if payload.profile is not None:
        p = payload.profile
        await mutations.upsert_profile(conn, p.name, p.email, p.phone, p.address)

    if payload.farm is not None:
        f = payload.farm
        await mutations.upsert_farm(
            conn,
            f.farm_name,
            f.farm_type,
            f.farm_size,
            f.farm_zones,
            f.country,
            f.state,
            f.city,
            f.address,
        )

    return MeOut(
        profile=mappers.profile_out(await queries.profile(conn)),
        farm=mappers.farm_out(await queries.farm(conn)),
        settings=mappers.settings_out(await queries.settings(conn)),
    )


@router.put("/me/settings")
async def update_settings(
    payload: SettingsUpdate,
    conn: Annotated[UserConn, Depends(user_conn)],
) -> SettingsOut:
    """Persist the preferences present in the body, leaving the rest alone.

    `exclude_unset` rather than `exclude_none`: the difference matters, because
    every one of these is a boolean and `false` is a value the user chose. Dropping
    Nones would make "turn email alerts off" indistinguishable from "do not mention
    email alerts".
    """
    changes = payload.model_dump(exclude_unset=True)
    row = await mutations.upsert_settings(conn, changes)
    return mappers.settings_out(row)
