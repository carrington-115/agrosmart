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
            "sensor_id", "recorded_at", "received_at", "recorded_at_source",
            "reading_uid", "payload_version", "raw",
            "temperature", "moisture", "salinity", "ph_soil", "ph_water",
            "water_temperature", "sunlight", "water_level",
            "nitrogen", "phosphorus", "potassium",
            "npk_estimated", "stabilising", "soil_dry",
        }
    ),
    "sensors": frozenset(
        {
            "id", "owner_id", "sensor_code", "sensor_tag", "status",
            "last_seen_at", "last_reading_at", "last_rssi",
            "last_uptime_seconds", "firmware_version",
        }
    ),
    "device_tokens": frozenset(
        {"id", "sensor_id", "token_id", "secret_hash", "revoked_at", "expires_at"}
    ),
}


def check_schema(
    actual: dict[str, set[str]],
    expected: dict[str, frozenset[str]] | None = None,
) -> list[SchemaViolation]:
    """Compare observed columns against the write contract.

    Pure and total: takes the query result, returns every violation at once
    rather than raising on the first. Unit-testable against fixtures with no
    database, per the module rule in domain/telemetry.py.
    """
    expected = expected if expected is not None else _WRITE_CONTRACT
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
    rows = await conn.fetch(
        """
        select table_name, column_name
        from information_schema.columns
        where table_schema = 'public' and table_name = any($1::text[])
        """,
        list(_WRITE_CONTRACT),
    )
    result: dict[str, set[str]] = {}
    for row in rows:
        result.setdefault(row["table_name"], set()).add(row["column_name"])
    return result
