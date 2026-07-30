# SPDX-License-Identifier: MIT
"""Typed failures.

Borrowed from the firmware's rule that "failure is a typed enum, never a magic
value" (agrosensor/docs/modules/README.md). A caller — and especially a device
draining a flash buffer — needs to distinguish *permanently* bad input, which it
should discard, from a transient error it should retry. A bare 400 with a prose
message cannot express that difference.
"""

from __future__ import annotations

from enum import StrEnum

from fastapi import HTTPException, status


class RejectionCode(StrEnum):
    """Why a single reading was refused.

    Every code here is PERMANENT: retrying cannot fix a malformed record. The
    device must drop the corresponding buffer entry rather than retrying it
    forever, which would wedge the queue and eventually wear out the flash.
    """

    SCHEMA_INVALID = "SCHEMA_INVALID"
    QUALITY_BLOCK_MISSING = "QUALITY_BLOCK_MISSING"
    UNSUPPORTED_VERSION = "UNSUPPORTED_VERSION"
    #: Device clock is implausible. Deliberately a rejection rather than a
    #: silent substitution of arrival time: fabricating a plausible-looking
    #: timestamp is the same sin the contract forbids for readings.
    TS_OUT_OF_RANGE = "TS_OUT_OF_RANGE"
    VALUE_OUT_OF_RANGE = "VALUE_OUT_OF_RANGE"
    #: Body's sensorId disagrees with the sensor the token belongs to — a device
    #: flashed with mismatched config.h / secrets.h.
    SENSOR_ID_MISMATCH = "SENSOR_ID_MISMATCH"


class ErrorCode(StrEnum):
    """Request-level failures."""

    INVALID_TOKEN = "INVALID_TOKEN"
    NOT_AUTHENTICATED = "NOT_AUTHENTICATED"
    SENSOR_NOT_FOUND = "SENSOR_NOT_FOUND"
    ALERT_NOT_FOUND = "ALERT_NOT_FOUND"
    SENSOR_ALREADY_REGISTERED = "SENSOR_ALREADY_REGISTERED"
    SENSOR_ID_MISMATCH = "SENSOR_ID_MISMATCH"
    BATCH_TOO_LARGE = "BATCH_TOO_LARGE"
    SCHEMA_OUT_OF_DATE = "SCHEMA_OUT_OF_DATE"


def http_error(
    code: ErrorCode,
    http_status: int,
    detail: str,
    **extra: object,
) -> HTTPException:
    return HTTPException(
        status_code=http_status,
        detail={"code": str(code), "message": detail, **extra},
    )


def invalid_token() -> HTTPException:
    """Uniform 401 for every device-auth failure.

    Unknown token_id, revoked, expired and wrong-secret all return exactly this,
    so a caller cannot enumerate which devices exist.
    """
    return http_error(
        ErrorCode.INVALID_TOKEN,
        status.HTTP_401_UNAUTHORIZED,
        "Invalid or revoked device token.",
    )


def not_authenticated() -> HTTPException:
    return http_error(
        ErrorCode.NOT_AUTHENTICATED,
        status.HTTP_401_UNAUTHORIZED,
        "A valid Supabase access token is required.",
    )
