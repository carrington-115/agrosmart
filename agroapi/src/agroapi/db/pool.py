# SPDX-License-Identifier: MIT
"""Connection pool lifecycle and the schema write-contract check."""

from __future__ import annotations

from dataclasses import dataclass

import asyncpg

from agroapi.config import Settings
from agroapi.db.types import AnyConn, DbPool


async def open_pool(settings: Settings) -> DbPool:
    return await asyncpg.create_pool(
        dsn=settings.database_url.get_secret_value(),
        min_size=settings.db_pool_min_size,
        max_size=settings.db_pool_max_size,
        # Only ever non-default when forced onto Supavisor transaction mode
        # (:6543), where prepared-statement names collide across pooled clients.
        statement_cache_size=settings.db_statement_cache_size,
    )


@dataclass(frozen=True, slots=True)
class SchemaViolation:
    table: str
    column: str
    problem: str


#: Exactly the columns the ingest writer writes. Deliberately NOT a mirror of the
#: whole schema: a full model-vs-database diff duplicates the migration files and
#: goes stale, which is cargo cult. This is a write-contract assertion, and it
#: catches the one realistic failure — the backend deployed against a database
#: where 0002 was never pushed.
_WRITE_CONTRACT: dict[str, frozenset[str]] = {
    "sensor_readings": frozenset(
        {
            "sensor_id",
            "recorded_at",
            "received_at",
            "recorded_at_source",
            "reading_uid",
            "payload_version",
            "raw",
            "temperature",
            "moisture",
            "salinity",
            "ph_soil",
            "ph_water",
            "water_temperature",
            "sunlight",
            "water_level",
            "nitrogen",
            "phosphorus",
            "potassium",
            "npk_estimated",
            "stabilising",
            "soil_dry",
        }
    ),
    "sensors": frozenset(
        {
            "id",
            "owner_id",
            "sensor_code",
            "sensor_tag",
            "status",
            "last_seen_at",
            "last_reading_at",
            "last_rssi",
            "last_uptime_seconds",
            "firmware_version",
        }
    ),
    "device_tokens": frozenset(
        {"id", "sensor_id", "token_id", "secret_hash", "revoked_at", "expires_at"}
    ),
}

#: The tables the dashboard read API selects from, beyond those above.
#:
#: Kept separate from `_WRITE_CONTRACT` because the two fail for different reasons
#: and are worth telling apart in a readiness body: a missing write column means a
#: device cannot deliver telemetry, while a missing read column means the dashboard
#: cannot render. The realistic failure this catches is 0003 never being pushed,
#: which would otherwise surface as a 500 the first time someone opens Settings.
#:
#: Only the columns actually selected are listed. A full mirror of the schema
#: would duplicate the migrations and go stale, which is the trap the write
#: contract's comment already names.
_READ_CONTRACT: dict[str, frozenset[str]] = {
    "profiles": frozenset({"id", "name", "email", "phone", "address", "avatar_url"}),
    "farms": frozenset(
        {
            "id",
            "owner_id",
            "farm_name",
            "farm_type",
            "farm_size",
            "farm_zones",
            "country",
            "state",
            "city",
            "address",
            "created_at",
        }
    ),
    "alerts": frozenset(
        {
            "id",
            "owner_id",
            "sensor_id",
            "title",
            "description",
            "severity",
            "label",
            "state",
            "created_at",
        }
    ),
    "user_settings": frozenset(
        {
            "owner_id",
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
        }
    ),
}

#: Everything the service touches. Merged rather than concatenated because
#: `sensors` appears in both — the writer's columns and the reader's overlap.
SCHEMA_CONTRACT: dict[str, frozenset[str]] = {
    table: _WRITE_CONTRACT.get(table, frozenset()) | _READ_CONTRACT.get(table, frozenset())
    for table in _WRITE_CONTRACT.keys() | _READ_CONTRACT.keys()
}


def check_schema(
    actual: dict[str, set[str]],
    expected: dict[str, frozenset[str]] | None = None,
) -> list[SchemaViolation]:
    """Compare observed columns against the schema contract.

    Pure and total: takes the query result, returns every violation at once
    rather than raising on the first. Unit-testable against fixtures with no
    database, per the module rule in domain/telemetry.py.
    """
    expected = expected if expected is not None else SCHEMA_CONTRACT
    violations: list[SchemaViolation] = []

    for table, columns in expected.items():
        observed = actual.get(table)
        if observed is None:
            violations.append(SchemaViolation(table, "*", "table is missing"))
            continue
        violations.extend(
            SchemaViolation(table, column, "column is missing")
            for column in sorted(columns - observed)
        )

    return violations


async def observed_columns(conn: AnyConn) -> dict[str, set[str]]:
    """Read the columns of the contract tables straight from the system catalog.

    `pg_catalog` and NOT `information_schema.columns`, which is the obvious
    choice and the wrong one. `information_schema` shows only relations the
    *current* role holds some privilege on, and the service connects as
    `agro_api` — `noinherit`, not the owner, holding no direct table grants at
    all until an explicit SET ROLE (see ../../../agroapp/supabase/setup_api_role.sql).
    The readiness probe deliberately does not SET ROLE, because it is asking
    "does this schema exist", not "may this request read it".

    Against `information_schema` that combination returns zero rows, so
    `check_schema` reports all seven tables as missing and readiness answers 503
    while pointing at a perfectly migrated database. It reads exactly like an
    unpushed migration and is not one. CI cannot catch it: CI connects as
    `postgres`, for whom the two queries agree.

    `pg_catalog` is not privilege-filtered, so what comes back is the schema that
    is actually there. Whether a role may then read it is RLS's job and
    `session.py`'s, and it fails loudly on its own.
    """
    rows = await conn.fetch(
        """
        select c.relname as table_name, a.attname as column_name
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        join pg_catalog.pg_attribute a on a.attrelid = c.oid
        where n.nspname = 'public'
          -- 'p' as well as 'r': partitioning sensor_readings by month is the
          -- obvious response to its growth, and this check should not start
          -- reporting the table missing on the day that happens.
          and c.relkind in ('r', 'p')
          -- Excludes the system columns (ctid, xmin, ...) at attnum <= 0, and
          -- columns dropped by an ALTER, whose entries linger in pg_attribute.
          and a.attnum > 0
          and not a.attisdropped
          and c.relname = any($1::text[])
        """,
        # Must cover every table `check_schema` will look for, or a missing read
        # table would be reported as missing simply because it was never queried.
        list(SCHEMA_CONTRACT),
    )
    result: dict[str, set[str]] = {}
    for row in rows:
        result.setdefault(row["table_name"], set()).add(row["column_name"])
    return result
