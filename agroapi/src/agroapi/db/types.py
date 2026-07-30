"""Runtime-safe aliases for asyncpg's generic types.

`asyncpg.pool.Pool` and `asyncpg.Connection` are NOT subscriptable at runtime —
the type parameters exist only in asyncpg-stubs, for type checkers. FastAPI
evaluates dependency annotations at import time with `eval_str=True`, so a
`Pool[Record]` annotation on any dependency callable fails with::

    TypeError: type 'Pool' is not subscriptable

`from __future__ import annotations` does not save you: it defers evaluation, and
FastAPI is precisely the thing that later forces it.

So the parameters are supplied to type checkers and erased at runtime. Annotate
with these aliases anywhere FastAPI can see the signature.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from asyncpg import Connection, Record
    from asyncpg.pool import Pool, PoolConnectionProxy

    DbPool = Pool[Record]
    DbConn = Connection[Record]
    #: What `pool.acquire()` hands back. Distinct from Connection, and the
    #: distinction is load-bearing: annotating a helper as Connection when its
    #: only callers hold a proxy is a type error, not a formality.
    DbAcquired = PoolConnectionProxy[Record]
    #: Anything you can run a query on, for helpers that genuinely do not care.
    AnyConn = Connection[Record] | PoolConnectionProxy[Record]
else:
    from asyncpg import Connection
    from asyncpg.pool import Pool, PoolConnectionProxy

    DbPool = Pool
    DbConn = Connection
    DbAcquired = PoolConnectionProxy
    AnyConn = object

__all__ = ["AnyConn", "DbAcquired", "DbConn", "DbPool"]
