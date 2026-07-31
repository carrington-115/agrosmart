# SPDX-License-Identifier: MIT
"""Stand in for a sensor node until firmware Phase F exists.

    uv run python scripts/simulate_device.py \
        --url http://localhost:8080/v1/ingest --token ags_v1_... --once

The firmware has no networking yet: agrosensor/src/main.cpp:242-250 builds the
telemetry JSON and prints it to serial, with the comment "Phase F: POST this."
So this posts the payload the firmware *does* produce, byte for byte, from the
fixtures in tests/fixtures/ — which are captures of that serial output.

What this proves and what it does not: it exercises the entire server side of the
contract — token auth, envelope decoding, timestamp resolution, absent-vs-zero,
idempotency, the ack — against a real database. It proves nothing about WiFi,
TLS, BearSSL heap pressure, or the LittleFS replay queue, all of which are the
firmware's half and remain unwritten.

Default fixture is `no_ts.json`, and that choice is not cosmetic. main.cpp:143
hardcodes `snap.epoch = 0` and `hasRssi` is never set anywhere, so a node flashed
with today's firmware emits no `ts` and no `rssi`. Defaulting to the prettiest
fixture would test a payload no device currently sends.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any

import httpx

FIXTURES = Path(__file__).resolve().parent.parent / "tests" / "fixtures"


def load_fixture(name: str) -> dict[str, Any]:
    path = FIXTURES / name
    if not path.exists():
        available = ", ".join(sorted(p.name for p in FIXTURES.glob("*.json")))
        raise SystemExit(f"error: no fixture {name!r}. Available: {available}")
    payload: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    return payload


def post_once(
    client: httpx.Client,
    url: str,
    token: str,
    payload: dict[str, Any],
) -> int:
    response = client.post(
        url,
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    try:
        body = json.dumps(response.json(), separators=(",", ":"))
    except ValueError:
        body = response.text
    print(f"{time.strftime('%H:%M:%S')}  {response.status_code}  {body}")
    return response.status_code


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--url",
        default="http://localhost:8080/v1/ingest",
        help="Ingest endpoint. Note agrosensor/include/config.h still points at "
        "/api/ingest; that is a one-line firmware change for Phase F.",
    )
    parser.add_argument("--token", required=True, help="ags_v1_<token_id>_<secret>")
    parser.add_argument(
        "--fixture",
        default="no_ts.json",
        help="Payload from tests/fixtures/. Default matches what today's firmware emits.",
    )
    parser.add_argument(
        "--sensor-id",
        help="Override the payload's sensorId, to check that the token — not the "
        "body — decides which sensor is written.",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=60.0,
        help="Seconds between transmissions. Default matches SAMPLE_INTERVAL_MS.",
    )
    parser.add_argument("--once", action="store_true", help="Send a single reading and exit.")
    args = parser.parse_args()

    payload = load_fixture(args.fixture)
    if args.sensor_id:
        payload["sensorId"] = args.sensor_id

    print(f"POST {args.url}")
    print(f"     fixture={args.fixture} sensorId={payload.get('sensorId')}")
    if not args.once:
        print(f"     every {args.interval:g}s, Ctrl-C to stop")
    print()

    with httpx.Client(timeout=10.0) as client:
        if args.once:
            code = post_once(client, args.url, args.token, payload)
            # Exit non-zero on failure so this is usable as a smoke check in a
            # script, not just something to read.
            return 0 if code < 400 else 1

        try:
            while True:
                post_once(client, args.url, args.token, payload)
                time.sleep(args.interval)
        except KeyboardInterrupt:
            print("\nstopped", file=sys.stderr)
            return 0


if __name__ == "__main__":
    raise SystemExit(main())
