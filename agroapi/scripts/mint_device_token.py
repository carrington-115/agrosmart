# SPDX-License-Identifier: MIT
"""Mint a per-device credential and register it against a sensor.

    uv run python scripts/mint_device_token.py --sensor-code AGS-001

Prints the plaintext token ONCE. Only its HMAC is stored, so there is no way to
recover it afterwards — losing it means minting a replacement and revoking this
one, which is the intended shape rather than an inconvenience.

Rotation is deliberately non-destructive: minting a second token for a sensor
leaves the first working, so the order is mint -> flash the device -> revoke the
old one, with no window where the node cannot report.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from agroapi.auth import device
from agroapi.config import settings
from agroapi.db.pool import open_pool
from agroapi.db.repositories import devices
from agroapi.db.session import service_scope


class MintError(Exception):
    """A reason not to mint, phrased for whoever is at the terminal."""


@dataclass(frozen=True, slots=True)
class Minted:
    sensor_code: str
    token_id: str
    plaintext: str
    expires_at: datetime | None


async def mint_for_sensor(
    sensor_code: str,
    label: str | None,
    expires_days: int | None,
) -> Minted:
    config = settings()
    pool = await open_pool(config)
    try:
        async with service_scope(pool) as conn:
            sensor_ids = await devices.find_sensor_by_code(conn, sensor_code)

            if not sensor_ids:
                raise MintError(f"no sensor registered with code {sensor_code!r}")
            # `sensor_code` is unique per owner, not globally, so this is a real
            # possibility rather than defensive padding. Refuse rather than pick:
            # guessing would bind a device credential to whichever tenant sorted
            # first, and the node would silently write into a stranger's farm.
            if len(sensor_ids) > 1:
                raise MintError(
                    f"{sensor_code!r} is registered to {len(sensor_ids)} owners; "
                    "disambiguate before minting"
                )

            minted = device.mint(config.token_pepper.get_secret_value())
            expires_at = (
                datetime.now(UTC) + timedelta(days=expires_days)
                if expires_days is not None
                else None
            )
            await devices.register_token(
                conn,
                sensor_id=sensor_ids[0],
                token_id=minted.token_id,
                secret_hash=minted.secret_hash,
                label=label,
                expires_at=expires_at,
            )
            return Minted(
                sensor_code=sensor_code,
                token_id=minted.token_id,
                plaintext=minted.plaintext,
                expires_at=expires_at,
            )
    finally:
        await pool.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--sensor-code",
        required=True,
        help="The code printed on the device, e.g. AGS-001. Matched case-insensitively.",
    )
    parser.add_argument("--label", help="Human note, e.g. 'bench node, Aug 2026'.")
    parser.add_argument(
        "--expires-days",
        type=int,
        help="Optional lifetime. Omit for a token that never expires on its own.",
    )
    args = parser.parse_args()

    try:
        result = asyncio.run(mint_for_sensor(args.sensor_code, args.label, args.expires_days))
    except MintError as exc:
        print(f"error: {exc}.", file=sys.stderr)
        return 1

    print(f"sensor    {result.sensor_code}")
    print(f"token_id  {result.token_id}")
    if result.expires_at is not None:
        print(f"expires   {result.expires_at.isoformat()}")
    print()
    print("Shown once, stored only as an HMAC. Put it in agrosensor/include/secrets.h")
    print("as AGRO_DEVICE_TOKEN, or pass it to scripts/simulate_device.py:")
    print()
    print(f"  {result.plaintext}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
