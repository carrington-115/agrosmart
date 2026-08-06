# SPDX-License-Identifier: MIT
"""Composition root.

Owns wiring and lifecycle, nothing else — the same division `agrosensor`'s
main.cpp keeps. If a calculation appears here, it belongs in `domain/` where it
can be tested without a running app.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from agroapi.auth.supabase_jwt import JwtVerifier
from agroapi.config import settings
from agroapi.db.pool import open_pool
from agroapi.routers import health, ingest, manage, read

API_PREFIX = "/v1"

#: Deprecated alias for the ingest router.
#:
#: `agrosensor/include/config.h` points AGRO_INGEST_URL at `:8080/api/ingest` —
#: the port this service listens on, but the path the old Next.js route used. A
#: node flashed against that address gets a 404 from the versioned path, and the
#: firmware lives in a separate repository with its own hardware CI, so it cannot
#: be corrected from here.
#:
#: Serving both paths costs one line and removes an entire class of "it's
#: deployed and the device still can't reach it". `/v1/ingest` remains the
#: documented address; this exists so a node already in the field binds without a
#: reflash, and should be removed once `config.h` moves.
_LEGACY_INGEST_PREFIX = "/api"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    config = settings()
    app.state.pool = await open_pool(config)
    app.state.verifier = JwtVerifier(config)
    try:
        yield
    finally:
        await app.state.pool.close()


def create_app() -> FastAPI:
    config = settings()

    app = FastAPI(
        title="AgroSmart API",
        version="0.1.0",
        summary="Device telemetry ingest and the dashboard read API.",
        description=(
            "The device-facing wire contract is specified in "
            "agrosensor/docs/integration/dashboard-contract.md. Three rules bind "
            "any consumer: absent readings are omitted rather than zeroed, the "
            "`quality` block is always present and load-bearing, and `ts` is "
            "omitted until the device has synced NTP."
        ),
        lifespan=lifespan,
    )

    # The dashboard is served from a different origin, so it needs CORS. Devices
    # do not — they are not browsers and send no Origin header.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    app.include_router(health.router, prefix=API_PREFIX)
    app.include_router(ingest.router, prefix=API_PREFIX)
    app.include_router(read.router, prefix=API_PREFIX)
    app.include_router(manage.router, prefix=API_PREFIX)

    # The legacy device path. `include_in_schema=False` so the OpenAPI document
    # advertises one ingest endpoint rather than implying two contracts exist.
    app.include_router(ingest.router, prefix=_LEGACY_INGEST_PREFIX, include_in_schema=False)

    return app


app = create_app()
