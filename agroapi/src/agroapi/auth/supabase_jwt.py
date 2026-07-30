# SPDX-License-Identifier: MIT
"""Supabase access-token verification.

No second identity system: the dashboard keeps its existing Supabase
email/password login, and this service verifies the token that login already
issues. `sub` becomes the `auth.uid()` the RLS policies in 0001_init.sql check
against.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx
import jwt
from jwt import PyJWKClient

from agroapi.config import Settings

#: Supabase's asymmetric signing keys. HS256 is the legacy shared-secret mode and
#: is deliberately not accepted — allowing both would mean a leaked anon key could
#: mint tokens this service trusts.
_ALGORITHMS = ["ES256", "RS256"]


@dataclass(frozen=True, slots=True)
class Claims:
    sub: str
    email: str | None
    role: str | None


class JwtVerifier:
    """Caches the JWKS, because fetching it per request would put an outbound
    HTTP call on the critical path of every dashboard read."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        # PyJWKClient handles kid lookup and refetches when it sees an unknown
        # kid, which is what makes key rotation transparent here.
        self._jwks = PyJWKClient(settings.jwks_url, cache_keys=True, lifespan=3600)

    def verify(self, token: str) -> Claims:
        """Raises jwt.PyJWTError on any failure."""
        signing_key = self._jwks.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=_ALGORITHMS,
            audience="authenticated",
            options={"require": ["exp", "sub"]},
        )
        return Claims(
            sub=str(payload["sub"]),
            email=payload.get("email"),
            role=payload.get("role"),
        )


async def jwks_reachable(settings: Settings) -> bool:
    """Readiness check. A verifier that cannot fetch keys cannot serve anyone."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(settings.jwks_url)
        return response.status_code == 200
    except httpx.HTTPError:
        return False
