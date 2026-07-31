# SPDX-License-Identifier: MIT
"""Device telemetry ingest.

The one endpoint a sensor node talks to. It validates, wires and reports; it
contains no arithmetic and no thresholds. `now` is read here, once, and passed
into `domain.to_reading` — which is what keeps the mapping pure and every
interesting case (no NTP, replayed buffer, unplugged board, dry soil) a fixture
rather than a live device.

Wire contract: agrosensor/docs/integration/dashboard-contract.md.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from agroapi.config import Settings
from agroapi.db.repositories import devices, readings
from agroapi.db.session import ServiceConn
from agroapi.deps import current_device, get_settings, service_conn
from agroapi.domain.telemetry import ReadingInsert, Rejection, to_reading
from agroapi.errors import ErrorCode, RejectionCode, http_error
from agroapi.schemas.ingest import (
    IngestAck,
    RejectedItem,
    TelemetryBatch,
    TelemetryEnvelope,
)

router = APIRouter(tags=["ingest"])


@router.post(
    "/ingest",
    status_code=status.HTTP_201_CREATED,
    responses={
        401: {"description": "Missing, malformed, unknown, revoked or expired token."},
        413: {"description": "Batch exceeds AGRO_MAX_BATCH_SIZE."},
        422: {"description": "Body failed schema validation, or every item was rejected."},
    },
)
async def ingest(
    payload: TelemetryEnvelope | TelemetryBatch,
    response: Response,
    identity: Annotated[devices.DeviceIdentity, Depends(current_device)],
    conn: Annotated[ServiceConn, Depends(service_conn)],
    config: Annotated[Settings, Depends(get_settings)],
) -> IngestAck:
    """Accept one reading or a drained store-and-forward buffer.

    Partial success is the normal case for a replay, so per-item rejections are
    reported in the body rather than failing the request: one implausible
    timestamp in a batch of 300 must not cost the other 299.

    The whole request runs in a single transaction on the connection
    `current_device` already authenticated on, so a batch lands completely or
    not at all.
    """
    now = datetime.now(UTC)
    envelopes = payload.batch if isinstance(payload, TelemetryBatch) else [payload]

    # Checked after parsing rather than before, because reading the length means
    # parsing the body anyway. The bound exists to cap the work one request can
    # ask for, not to defend against a malicious device — a device holding a
    # valid token is not the threat this endpoint is shaped against.
    if len(envelopes) > config.max_batch_size:
        raise http_error(
            ErrorCode.BATCH_TOO_LARGE,
            status.HTTP_413_CONTENT_TOO_LARGE,
            f"Batch of {len(envelopes)} exceeds the limit of {config.max_batch_size}.",
            limit=config.max_batch_size,
        )

    accepted = 0
    duplicates = 0
    rejected: list[RejectedItem] = []
    #: Device state is folded in once, after the loop, from the newest reading in
    #: the request — not per item. A 300-entry replay describes one node at one
    #: moment, and 300 UPDATEs would write the same firmware string 300 times to
    #: answer a question about right now.
    newest: ReadingInsert | None = None

    for index, envelope in enumerate(envelopes):
        # The TOKEN chooses the sensor; the body only gets to agree with it.
        # Trusting `sensorId` here is precisely the weakness that per-device
        # credentials replaced the single shared SENSOR_INGEST_KEY to remove.
        if envelope.sensor_id.upper() != identity.sensor_code.upper():
            rejected.append(
                RejectedItem(
                    index=index,
                    uid=envelope.uid,
                    code=RejectionCode.SENSOR_ID_MISMATCH,
                    message=(
                        f"Token is registered to {identity.sensor_code}, "
                        f"but the payload claims {envelope.sensor_id}. "
                        "Check config.h and secrets.h agree."
                    ),
                )
            )
            continue

        outcome = to_reading(envelope, now, config.supported_payload_versions)
        if isinstance(outcome, Rejection):
            rejected.append(
                RejectedItem(
                    index=index,
                    uid=outcome.uid,
                    code=outcome.code,
                    message=outcome.message,
                )
            )
            continue

        # `exclude_none=True` so `raw` preserves what the device actually sent.
        # Serialising the Nones would write `"phWater": null` for a board that
        # omitted the key, turning "did not report" into a recorded claim.
        raw = envelope.model_dump(by_alias=True, exclude_none=True)
        reading_id = await readings.insert_reading(conn, identity.sensor_id, outcome, raw)

        if reading_id is None:
            duplicates += 1
        else:
            accepted += 1

        # Duplicates count here too. A node replaying a week-old buffer is
        # online right now, and `last_seen_at` tracks arrival, not measurement.
        if newest is None or outcome.recorded_at > newest.recorded_at:
            newest = outcome

    if newest is not None:
        await readings.update_device_state(conn, identity.sensor_id, newest)

    # Nothing landed and nothing was a replay: the request was well-formed but
    # entirely unusable, which is the same thing a schema failure means.
    if accepted == 0 and duplicates == 0:
        response.status_code = status.HTTP_422_UNPROCESSABLE_CONTENT

    return IngestAck(accepted=accepted, duplicates=duplicates, rejected=rejected)
