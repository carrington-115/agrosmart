# SPDX-License-Identifier: MIT
"""Per-device credentials.

Replaces the single global SENSOR_INGEST_KEY the Next.js route used. One shared
key means a single compromised node burns every node, and a reading can only be
attributed to a device by trusting the `sensorId` in its own body.

Token format::

    ags_v1_<token_id>_<secret>

`token_id` is public and uniquely indexed, so identifying the device is an O(1)
lookup on a NON-secret. That is what removes the timing question: there is no
candidate iteration, so response time cannot leak which devices exist. Only the
secret comparison needs to be constant-time. Same shape as GitHub and Stripe
keys.
"""

from __future__ import annotations

import hmac
import secrets
from dataclasses import dataclass
from hashlib import sha256

_PREFIX = "ags_v1"
_TOKEN_ID_BYTES = 8
_SECRET_BYTES = 32  # 256 bits of CSPRNG output


@dataclass(frozen=True, slots=True)
class ParsedToken:
    token_id: str
    secret: str


@dataclass(frozen=True, slots=True)
class MintedToken:
    """A freshly minted credential.

    `plaintext` is returned to the caller exactly once and is never recoverable
    afterwards — only `secret_hash` is stored.
    """

    token_id: str
    plaintext: str
    secret_hash: bytes


def parse(raw: str) -> ParsedToken | None:
    """Split a presented token. Returns None on any structural problem.

    Structural rejection is intentionally indistinguishable from a wrong secret
    at the HTTP layer; see `errors.invalid_token`.
    """
    parts = raw.strip().split("_")
    if len(parts) != 4:
        return None
    prefix, version, token_id, secret = parts
    if f"{prefix}_{version}" != _PREFIX or not token_id or not secret:
        return None
    return ParsedToken(token_id=token_id, secret=secret)


def hash_secret(pepper: str, token_id: str, secret: str) -> bytes:
    """HMAC-SHA256 over `token_id:secret`, keyed by the environment pepper.

    Not argon2, and the reason is worth stating because the instinct to reach for
    a slow KDF here is strong and wrong: slow hashing exists to protect
    LOW-ENTROPY, human-chosen secrets. This secret is 256 bits of CSPRNG output
    and is not brute-forceable at any hash speed, so argon2 would buy zero
    security while costing ~50 ms and ~64 MB per verify — on a path hit once every
    60 s per device by an as-yet-unauthenticated caller. That is a
    memory-amplification DoS with extra steps.

    The pepper means a leaked database dump alone does not yield usable tokens.
    Binding `token_id` into the input stops a hash being transplanted between
    rows.
    """
    return hmac.new(
        pepper.encode(),
        f"{token_id}:{secret}".encode(),
        sha256,
    ).digest()


def mint(pepper: str) -> MintedToken:
    token_id = secrets.token_hex(_TOKEN_ID_BYTES)
    secret = secrets.token_urlsafe(_SECRET_BYTES)
    return MintedToken(
        token_id=token_id,
        plaintext=f"{_PREFIX}_{token_id}_{secret}",
        secret_hash=hash_secret(pepper, token_id, secret),
    )


def verify(pepper: str, parsed: ParsedToken, stored_hash: bytes) -> bool:
    expected = hash_secret(pepper, parsed.token_id, parsed.secret)
    return hmac.compare_digest(expected, stored_hash)


def dummy_verify(pepper: str) -> None:
    """Burn a comparable amount of time on the unknown-token_id path.

    Without this, an unknown `token_id` returns measurably faster than a known one
    with a bad secret, which turns a uniform 401 into a device-enumeration oracle.
    """
    hash_secret(pepper, "0" * (_TOKEN_ID_BYTES * 2), "x" * _SECRET_BYTES)
