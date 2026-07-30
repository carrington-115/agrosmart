"""Liveness and readiness.

Split because they answer different questions and Kubernetes treats them
differently: failing liveness restarts the pod, failing readiness only removes it
from the load balancer. A database outage must not trigger a restart loop.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Response, status

from agroapi.auth.supabase_jwt import jwks_reachable
from agroapi.config import Settings
from agroapi.db.pool import check_schema, observed_columns
from agroapi.db.types import DbPool
from agroapi.deps import get_pool, get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    """Liveness. Deliberately touches nothing external.

    If this needed the database, a Supabase blip would restart every pod and turn
    a transient outage into an outage plus a thundering herd of reconnects.
    """
    return {"status": "ok"}


@router.get("/health/ready")
async def ready(
    response: Response,
    pool: Annotated[DbPool, Depends(get_pool)],
    config: Annotated[Settings, Depends(get_settings)],
) -> dict[str, Any]:
    """Readiness: can this instance actually serve a request?

    Includes the schema write-contract check. Migrations are applied by the
    Supabase CLI while this service is deployed separately, so "running against a
    database where the migration was never pushed" is a real and otherwise
    silent failure mode — it would surface as every ingest 500ing at 3am with a
    Postgres error in a log nobody is reading.

    Reported as *unready* rather than checked at startup, because crash-looping a
    container conveys less than a pod that stays up and says why.
    """
    checks: dict[str, Any] = {}

    try:
        async with pool.acquire() as conn:
            await conn.execute("select 1")
            violations = check_schema(await observed_columns(conn))
        checks["database"] = "ok"
        checks["schema"] = (
            "ok"
            if not violations
            else [f"{v.table}.{v.column}: {v.problem}" for v in violations]
        )
    # Broad by design. The pool connects lazily (see db_pool_min_size), so the
    # first real connection attempt happens HERE, and asyncpg surfaces a whole
    # family of failures — OSError, InvalidPasswordError, PostgresError,
    # InterfaceError. A readiness probe that itself 500s tells an operator far
    # less than one that reports which dependency is unhappy.
    except Exception as exc:
        checks["database"] = f"unavailable: {type(exc).__name__}: {exc}"
        checks["schema"] = "unknown"

    # A verifier that cannot fetch signing keys cannot authenticate anyone, so
    # this instance is not ready even though it is alive.
    checks["jwks"] = "ok" if await jwks_reachable(config) else "unreachable"

    ok = all(value == "ok" for value in checks.values())
    if not ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {"status": "ready" if ok else "not ready", "checks": checks}
