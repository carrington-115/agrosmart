# SPDX-License-Identifier: MIT
"""Device credential format.

Pure: no database, no app. The token format is the one thing here that is
simultaneously security-critical and easy to get subtly wrong, and every failure
mode below produces the same uninformative 401 in production — so if it is not
asserted here it will be diagnosed at 3am from a device that "just stopped
reporting".
"""

from __future__ import annotations

import pytest

from agroapi.auth import device

PEPPER = "0" * 64


def test_a_minted_token_verifies() -> None:
    minted = device.mint(PEPPER)

    parsed = device.parse(minted.plaintext)

    assert parsed is not None
    assert parsed.token_id == minted.token_id
    assert device.verify(PEPPER, parsed, minted.secret_hash)


def test_every_minted_token_parses() -> None:
    """The regression that motivated this file.

    `secrets.token_urlsafe` emits base64url, and that alphabet includes the
    underscore — the same character the token format uses as its delimiter. A
    43-character secret contains at least one roughly half the time, so a parser
    that split on every underscore rejected about every OTHER minted credential
    as malformed. Minting is random, so the bug presented as a device that
    worked or did not depending on which token it happened to be flashed with.

    100 iterations makes the probability of missing it about 2^-100.
    """
    for _ in range(100):
        minted = device.mint(PEPPER)
        parsed = device.parse(minted.plaintext)

        assert parsed is not None, f"failed to parse {minted.plaintext!r}"
        assert device.verify(PEPPER, parsed, minted.secret_hash)


def test_a_secret_containing_the_delimiter_survives_a_round_trip() -> None:
    """The property above, stated directly rather than left to chance."""
    parsed = device.parse("ags_v1_0123456789abcdef_aa_bb-cc_dd")

    assert parsed is not None
    assert parsed.token_id == "0123456789abcdef"
    assert parsed.secret == "aa_bb-cc_dd"


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "not-a-token",
        "ags_v1",
        "ags_v1_",
        "ags_v1_abc",  # no secret at all
        "ags_v1__secret",  # empty token_id
        "ags_v2_abc_secret",  # unknown version
        "gho_v1_abc_secret",  # someone else's prefix
    ],
)
def test_structurally_invalid_tokens_are_refused(raw: str) -> None:
    assert device.parse(raw) is None


def test_the_wrong_pepper_does_not_verify() -> None:
    """The pepper is what stops a leaked database dump from yielding usable
    credentials, so a hash must not verify under a different one."""
    minted = device.mint(PEPPER)
    parsed = device.parse(minted.plaintext)
    assert parsed is not None

    assert not device.verify("f" * 64, parsed, minted.secret_hash)


def test_a_hash_cannot_be_transplanted_between_rows() -> None:
    """`token_id` is bound into the HMAC input for this reason: an attacker who
    can write to device_tokens must not be able to copy one row's secret_hash
    onto another row and have the original secret authenticate as that device."""
    minted = device.mint(PEPPER)
    parsed = device.parse(minted.plaintext)
    assert parsed is not None

    transplanted = device.ParsedToken(token_id="deadbeefdeadbeef", secret=parsed.secret)

    assert not device.verify(PEPPER, transplanted, minted.secret_hash)
