"""Connection scoping. The security-critical module.

Dashboard queries run with the existing RLS policies from 0001_init.sql doing the
enforcing, rather than with hand-written `where owner_id = $1` clauses. The
frontend's lib/queries.ts already documents why:

    Every function relies on RLS for scoping rather than filtering by owner_id in
    the query, so a missing session yields empty results instead of another
    user's rows.

Two connection kinds exist and they are distinct TYPES rather than a boolean
argument, so a service connection cannot reach a user-scoped repository function
by accident.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import NewType

from asyncpg import Record
from asyncpg.pool import Pool, PoolConnectionProxy

#: What `pool.acquire()` actually hands back — a proxy, not a bare Connection.
#: NewType requires a subscriptable class, so the Record parameter is supplied by
#: the aliases below rather than here.
_Acquired = PoolConnectionProxy

#: A connection on which auth.uid() resolves and RLS is in force.
UserConn = NewType("UserConn", _Acquired)

#: A connection that BYPASSES RLS. Callers must pass explicit owner filters.
#: Used only by ingest (a device has no user session) and token administration
#: (device_tokens is deny-all to authenticated).
ServiceConn = NewType("ServiceConn", _Acquired)


# Why set_config(..., is_local => true) and not `SET LOCAL`:
#
#   * `SET` cannot take a bind parameter, so the alternative is interpolating a
#     value taken from a JWT into SQL text. set_config() binds it.
#   * All four settings revert at COMMIT *and* at ROLLBACK, which is what makes
#     this safe to run on a pooled connection.
#
# Why request.jwt.claim.sub is blanked rather than ignored:
#
#   Supabase defines auth.uid() as a coalesce that reads the LEGACY SINGULAR GUC
#   FIRST:
#
#       coalesce(
#         nullif(current_setting('request.jwt.claim.sub', true), ''),
#         (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
#       )::uuid
#
#   So a stale `request.jwt.claim.sub` left on a pooled backend silently wins
#   over the claims we set — while our correct value looks right in every log.
#   Blanking it forces the coalesce to fall through to ours.
_SCOPE_SQL = """
select
  set_config('request.jwt.claims',     $1, true),
  set_config('request.jwt.claim.sub',  '', true),
  set_config('request.jwt.claim.role', '', true),
  set_config('role',        'authenticated', true)
"""

_SERVICE_SQL = "select set_config('role', 'service_role', true)"


@asynccontextmanager
async def user_scope(pool: Pool[Record], user_id: str) -> AsyncIterator[UserConn]:
    """Yield a connection on which `auth.uid()` returns `user_id`.

    The enclosing transaction is REQUIRED, not stylistic. asyncpg autocommits
    each execute(), so outside an explicit transaction every
    `set_config(..., true)` is discarded before the query runs, and
    `set_config('role', ...)` degrades to a warning rather than an error. The
    combination fails silently.

    It fails *closed* rather than open because the service connects as the
    `agro_api` role, which is `noinherit`, is not the table owner and does not
    hold BYPASSRLS — so without the SET ROLE below there are no table privileges
    at all. See ../agroapp/supabase/setup_api_role.sql for why that inversion
    matters.
    """
    async with pool.acquire() as conn, conn.transaction():
        await conn.fetchrow(
            _SCOPE_SQL,
            json.dumps({"sub": user_id, "role": "authenticated"}),
        )
        yield UserConn(conn)


@asynccontextmanager
async def service_scope(pool: Pool[Record]) -> AsyncIterator[ServiceConn]:
    """Yield a connection that bypasses RLS.

    Every query made through this MUST carry its own ownership predicate. There
    is no policy behind it to catch a mistake.
    """
    async with pool.acquire() as conn, conn.transaction():
        await conn.fetchrow(_SERVICE_SQL)
        yield ServiceConn(conn)
