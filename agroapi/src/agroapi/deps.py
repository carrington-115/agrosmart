# SPDX-License-Identifier: MIT
"""FastAPI dependency wiring.

Deliberately thin. Everything here resolves a request into either a scoped
connection or verified claims, and nothing here makes a decision — decisions live
in `domain/`, which is testable without any of this.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWTError

from agroapi.auth import device
from agroapi.auth.supabase_jwt import Claims, JwtVerifier
from agroapi.config import Settings, settings
from agroapi.db.repositories import devices
from agroapi.db.session import ServiceConn, UserConn, service_scope, user_scope
from agroapi.db.types import DbPool
from agroapi.errors import invalid_token, not_authenticated

#: auto_error=False so a missing header produces our typed 401 rather than
#: FastAPI's untyped one — the shape of an error response is part of the API.
_bearer = HTTPBearer(auto_error=False)


def get_settings() -> Settings:
    return settings()


def get_pool(request: Request) -> DbPool:
    pool: DbPool = request.app.state.pool
    return pool


def get_verifier(request: Request) -> JwtVerifier:
    verifier: JwtVerifier = request.app.state.verifier
    return verifier


def current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    verifier: Annotated[JwtVerifier, Depends(get_verifier)],
) -> Claims:
    """Verify the Supabase access token the dashboard already holds.

    No second identity system: `sub` becomes the `auth.uid()` that the RLS
    policies from 0001_init.sql check against.
    """
    if credentials is None or not credentials.credentials:
        raise not_authenticated()
    try:
        return verifier.verify(credentials.credentials)
    except PyJWTError as exc:
        raise not_authenticated() from exc


async def user_conn(
    pool: Annotated[DbPool, Depends(get_pool)],
    claims: Annotated[Claims, Depends(current_user)],
) -> AsyncIterator[UserConn]:
    """An RLS-scoped connection. The default for anything user-facing."""
    async with user_scope(pool, claims.sub) as conn:
        yield conn


async def service_conn(
    pool: Annotated[DbPool, Depends(get_pool)],
) -> AsyncIterator[ServiceConn]:
    """A connection that BYPASSES RLS.

    Only for ingest (a device has no user session) and token administration
    (`device_tokens` is deny-all to `authenticated`). Every query through it must
    carry its own ownership predicate; there is no policy behind it to catch a
    mistake.
    """
    async with service_scope(pool) as conn:
        yield conn


async def current_device(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    conn: Annotated[ServiceConn, Depends(service_conn)],
    config: Annotated[Settings, Depends(get_settings)],
) -> devices.DeviceIdentity:
    """Resolve a per-device bearer token to the sensor it speaks for.

    Every failure — no header, malformed token, unknown `token_id`, revoked,
    expired, wrong secret — raises the SAME 401, so a caller cannot use the
    response to enumerate which devices exist.

    Two details carry that guarantee and both look redundant until you remove
    them:

    * The lookup is keyed on `token_id`, which is public. There is no iteration
      over candidate rows, so the database does not leak timing.
    * `dummy_verify` burns a comparable HMAC on the unknown-`token_id` path.
      Without it an unknown id returns measurably faster than a known id with a
      bad secret, and the uniform 401 above becomes decorative.

    Note that this depends on `service_conn`, so the whole request — auth lookup
    and the writes that follow — runs inside one transaction on one connection.
    """
    pepper = config.token_pepper.get_secret_value()

    if credentials is None or not credentials.credentials:
        raise invalid_token()

    parsed = device.parse(credentials.credentials)
    if parsed is None:
        # A structurally invalid token is rejected without a lookup, but still
        # pays the HMAC — otherwise "not even a token" is distinguishable from
        # "a real token with the wrong secret" by a stopwatch.
        device.dummy_verify(pepper)
        raise invalid_token()

    identity = await devices.find_active_token(conn, parsed.token_id)
    if identity is None:
        device.dummy_verify(pepper)
        raise invalid_token()

    if not device.verify(pepper, parsed, identity.secret_hash):
        raise invalid_token()

    await devices.touch_last_used(conn, identity.token_id)
    return identity
