# SPDX-License-Identifier: MIT
"""Settings parsing.

These exist because of a real outage-shaped failure: the first time the
Kubernetes manifests were applied to a cluster, every agroapi pod entered
CrashLoopBackOff before serving a request. The ConfigMap set

    AGRO_CORS_ORIGINS: "https://agrosmart.example"

and pydantic-settings tried to JSON-decode it, because the field is a list. A
ConfigMap value is a plain string, so the process died at import with
SettingsError.

Nothing caught it: the pure suite never constructed Settings from a realistic
environment, and `docker compose` happened to pass a single origin that was
equally invalid but never exercised. A config field that can only be set
correctly by someone who knows it wants JSON is a trap, so the parsing is now
part of the contract and is tested as such.
"""

from __future__ import annotations

import pytest

from agroapi.config import Settings

_REQUIRED = {
    "AGRO_DATABASE_URL": "postgresql://u:p@h:5432/d",
    "AGRO_SUPABASE_URL": "https://example.supabase.co",
    "AGRO_TOKEN_PEPPER": "0" * 64,
}


def build(monkeypatch: pytest.MonkeyPatch, **overrides: str) -> Settings:
    for key, value in {**_REQUIRED, **overrides}.items():
        monkeypatch.setenv(key, value)
    return Settings()  # type: ignore[call-arg]


def test_a_single_origin_is_accepted_as_a_plain_string(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The exact value the production ConfigMap carries."""
    settings = build(monkeypatch, AGRO_CORS_ORIGINS="https://agrosmart.example")

    assert settings.cors_origins == ["https://agrosmart.example"]


def test_multiple_origins_are_comma_separated(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = build(
        monkeypatch,
        AGRO_CORS_ORIGINS="https://a.example, https://b.example",
    )

    # Whitespace around a comma is what a human writes in a YAML value.
    assert settings.cors_origins == ["https://a.example", "https://b.example"]


def test_origins_fall_back_to_localhost_when_unset(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("AGRO_CORS_ORIGINS", raising=False)
    settings = build(monkeypatch)

    assert settings.cors_origins == ["http://localhost:3000"]


def test_a_missing_required_variable_fails_at_construction(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Loud at startup beats a 503 on every request with no explanation.

    This is the behaviour the Next.js ingest route got wrong — it returned 503
    forever because two environment variables were absent and nothing said so.
    """
    for key in _REQUIRED:
        monkeypatch.delenv(key, raising=False)

    with pytest.raises(Exception, match=r"token_pepper|database_url|supabase_url"):
        Settings()  # type: ignore[call-arg]
