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

from agroapi.auth.supabase_jwt import Claims, JwtVerifier
from agroapi.config import Settings, settings
from agroapi.db.session import ServiceConn, UserConn, service_scope, user_scope
from agroapi.db.types import DbPool
from agroapi.errors import not_authenticated

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
