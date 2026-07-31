# SPDX-License-Identifier: MIT
"""Runtime configuration.

Settings are validated at import time and the process refuses to start on a
missing required value, rather than failing at first request.

That choice is a direct lesson from the code this service replaces: the Next.js
ingest route returns 503 on *every* call because `.env.local` lacks
SUPABASE_SERVICE_ROLE_KEY and SENSOR_INGEST_KEY, and nothing anywhere announces
it. A misconfigured deployment should be loud and immediate.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="AGRO_",
        extra="ignore",
    )

    # --- database -----------------------------------------------------------
    #
    # Connect as the least-privileged `agro_api` role (see
    # ../agroapp/supabase/setup_api_role.sql), NOT as `postgres`. Prefer the
    # direct connection on :5432 over the Supavisor pooler — this is a
    # long-lived process holding its own pool, so the pooler buys nothing and
    # imports transaction-mode hazards.
    database_url: SecretStr = Field(
        description="postgresql://agro_api:...@db.<ref>.supabase.co:5432/postgres"
    )
    #: Zero on purpose. `create_pool()` eagerly opens `min_size` connections while
    #: the app is starting, so any non-zero value makes an unreachable database a
    #: STARTUP failure — and in Kubernetes that is a crash-loop during a
    #: transient Supabase blip, precisely the behaviour the split between
    #: /health and /health/ready exists to avoid.
    #:
    #: With 0, the process always starts, connects on first use, and reports
    #: itself *unready* while the database is down. Traffic is withheld by the
    #: readiness probe instead of by the pod dying. The cost is a cold first
    #: connection, which the readiness probe pays before any user does.
    db_pool_min_size: int = 0
    db_pool_max_size: int = 10

    # Set to 0 only when forced onto Supavisor transaction mode (:6543), where
    # asyncpg's prepared-statement names collide. Costs plan caching, so the
    # default keeps it on.
    db_statement_cache_size: int = 100

    # --- auth ---------------------------------------------------------------

    supabase_url: str = Field(description="https://<ref>.supabase.co")

    #: Origins allowed to call the read API. The dashboard runs on a different
    #: origin, so it needs CORS; devices do not, being no kind of browser.
    #:
    #: Comma-separated in the environment: AGRO_CORS_ORIGINS=https://a,https://b
    #:
    #: `NoDecode` is load-bearing. pydantic-settings decodes complex types from
    #: the environment as JSON *inside the settings source*, before any validator
    #: runs — so a plain `https://example` raised SettingsError at import and the
    #: process crash-looped before serving a single request. That is exactly what
    #: happened the first time these manifests were applied to a cluster, because
    #: a ConfigMap value is a plain string and demanding JSON there is a trap.
    #: NoDecode suppresses that decoding and hands the raw string to the
    #: validator below.
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000"]
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_comma_separated(cls, value: object) -> object:
        """Accept `a,b` from the environment and `["a","b"]` from Python."""
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    # Pepper for device-token HMACs. Keeps a leaked database dump from yielding
    # usable tokens. Generate with: openssl rand -hex 32
    token_pepper: SecretStr = Field(description="HMAC pepper for device tokens")

    # --- ingest -------------------------------------------------------------

    #: Payload envelope versions this build understands. An unknown version is
    #: rejected rather than best-effort decoded, so a firmware rollout cannot
    #: silently write misinterpreted numbers.
    supported_payload_versions: frozenset[int] = frozenset({1})

    #: Largest accepted batch. A six-hour outage at the firmware's 60 s cadence
    #: is ~360 readings, so this bounds a replay to four requests.
    max_batch_size: int = 100

    #: A sensor with no arrival newer than this is reported `offline`. Three
    #: times the firmware's SAMPLE_INTERVAL_MS, so a single missed transmission
    #: is not treated as a dead node.
    offline_after_seconds: int = 180

    @property
    def jwks_url(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"


@lru_cache(maxsize=1)
def settings() -> Settings:
    """Cached accessor. Raises ValidationError on a missing required variable."""
    return Settings()  # type: ignore[call-arg]  # values come from the environment
