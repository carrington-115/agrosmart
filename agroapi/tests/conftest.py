# SPDX-License-Identifier: MIT
"""Test-wide setup.

`Settings` deliberately refuses to start without its required variables, which is
correct in production and inconvenient here. Rather than loosening the settings
model — the strictness is the feature — the pure suite supplies obviously fake
values so it can run on a machine with no configuration at all, which is what
lets CI gate on it before any secret is available.
"""

from __future__ import annotations

import os

#: Syntactically valid, semantically nowhere. Nothing in the pure suite opens a
#: connection or fetches a key; anything that would is marked `integration` and
#: gets real values from the environment.
_FAKE_ENV = {
    "AGRO_DATABASE_URL": "postgresql://agro_api:not-a-real-password@127.0.0.1:5432/nope",
    "AGRO_SUPABASE_URL": "https://example.supabase.co",
    "AGRO_TOKEN_PEPPER": "0" * 64,
}

# Set at MODULE level, not in a fixture. pytest imports conftest before it imports
# any test module, and `agroapi.main` builds its app at import time — so by the
# time a fixture could run, the import has already failed. `setdefault` means a
# real integration environment still wins.
for _key, _value in _FAKE_ENV.items():
    os.environ.setdefault(_key, _value)
