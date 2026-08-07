# SPDX-License-Identifier: MIT
"""Request bodies for the dashboard's writes.

`extra="forbid"` on every model, matching `schemas/ingest.py`. A key this service
has never heard of means the client and the server disagree about the shape, and a
setting that appears to save but silently does not is worse than a 422 — the user
has no way to tell the difference until it matters.

Update models are all-optional so a partial update is a partial update. The
repository layer coalesces, so an unsent field keeps its stored value rather than
being blanked.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SensorCreate(BaseModel):
    """Register a sensor by the code printed on it.

    The pattern matches `agroapp/lib/schema.ts:sensorSchema`, deliberately: a code
    the form accepts must be a code this endpoint accepts. It also has to stay
    URL-safe, because it routes `/dashboard/sensors/[sensorID]`.
    """

    model_config = ConfigDict(extra="forbid")

    sensor_id: str = Field(
        alias="sensorId",
        min_length=4,
        max_length=32,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]*$",
    )
    sensor_tag: str | None = Field(default=None, alias="sensorTag", max_length=64)


class AlertStateUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    #: `accepted` means resolved, `rejected` means ignored. `open` is allowed so a
    #: mistaken dismissal can be undone.
    state: Literal["open", "accepted", "rejected"]


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, max_length=120)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=32)
    address: str | None = Field(default=None, max_length=500)


class FarmUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    farm_name: str | None = Field(default=None, alias="farmName", max_length=120)
    farm_type: str | None = Field(default=None, alias="farmType", max_length=120)
    farm_size: float | None = Field(default=None, alias="farmSize", ge=0)
    farm_zones: int | None = Field(default=None, alias="farmZones", ge=0)
    country: str | None = Field(default=None, max_length=120)
    state: str | None = Field(default=None, max_length=120)
    city: str | None = Field(default=None, max_length=120)
    address: str | None = Field(default=None, max_length=500)


class SettingsUpdate(BaseModel):
    """Notification and reporting preferences.

    snake_case field names, matching `SettingsOut` and the column names the
    dashboard already keys its checkboxes on. Consistency with the read shape
    matters more here than consistency with the camelCase used elsewhere.
    """

    model_config = ConfigDict(extra="forbid")

    pair_by_id: bool | None = None
    pair_by_qr: bool | None = None
    reports_weekly: bool | None = None
    reports_monthly: bool | None = None
    reports_email: bool | None = None
    alerts_dashboard: bool | None = None
    alerts_popup: bool | None = None
    alerts_email: bool | None = None
    alerts_sms: bool | None = None
    alerts_delete_ignored_after_days: int | None = Field(default=None, ge=0, le=365)


class MeUpdate(BaseModel):
    """Profile and farm in one request, mirroring `GET /v1/me`.

    Settings have their own endpoint because they are toggled one checkbox at a
    time, while profile and farm are saved as forms.
    """

    model_config = ConfigDict(extra="forbid")

    profile: ProfileUpdate | None = None
    farm: FarmUpdate | None = None


class DeviceTokenCreate(BaseModel):
    """Mint a credential for a sensor."""

    model_config = ConfigDict(extra="forbid")

    #: Free text to identify this credential later, e.g. "field unit, Aug 2026".
    label: str | None = Field(default=None, max_length=120)
    #: Days until it stops being accepted. Omit for a non-expiring token, which is
    #: the sane default for a device that may sit in a field for a season.
    expires_in_days: int | None = Field(default=None, alias="expiresInDays", ge=1, le=3650)
