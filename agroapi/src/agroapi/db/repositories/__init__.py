# SPDX-License-Identifier: MIT
"""Data access.

Every function here takes a CONNECTION, never a pool and never a `Request`. That
is what lets a caller decide the transaction boundary, and it is what makes the
connection *type* — `UserConn` or `ServiceConn` — a checkable statement about
whether RLS is in force for the query being run.
"""
