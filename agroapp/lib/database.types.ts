/**
 * Hand-maintained mirror of supabase/migrations/0001_init.sql and
 * 0002_telemetry_contract.sql.
 *
 * Regenerate with the Supabase CLI once the project is linked:
 *   pnpm dlx supabase gen types typescript --linked > lib/database.types.ts
 */

export type SensorStatus = "normal" | "warning" | "offline";
export type AlertSeverity = "default" | "secondary" | "destructive" | "outline";
export type AlertState = "open" | "accepted" | "rejected";

/**
 * Whether `recorded_at` came from the device's own clock or from arrival time.
 *
 * The device omits `ts` until NTP syncs, so a server-stamped row says "this is
 * when we heard about it", not "this is when the soil was measured". Telling the
 * two apart is what makes replaying a buffered outage worth doing.
 */
export type ReadingTimeSource = "device" | "server";

export interface ProfileRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface FarmRow {
  id: string;
  owner_id: string;
  farm_name: string;
  farm_type: string | null;
  farm_size: number | null;
  farm_zones: number | null;
  country: string | null;
  state: string | null;
  city: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export interface SensorRow {
  id: string;
  owner_id: string;
  farm_id: string | null;
  sensor_code: string;
  sensor_tag: string | null;
  /**
   * The stored status column. Nothing writes `offline` to it — a device that
   * stops reporting never calls ingest again — so treat it as a hint and derive
   * the real status from `last_seen_at` via lib/status.ts.
   */
  status: SensorStatus;
  created_at: string;
  updated_at: string;

  // --- device state, added by 0002 -----------------------------------------
  /** Arrival of the most recent payload. The liveness primitive: a device
   *  replaying week-old data is still online. */
  last_seen_at: string | null;
  /** Timestamp of the newest reading, which guards the fields below so a
   *  replayed stale payload cannot clobber current device state. */
  last_reading_at: string | null;
  last_rssi: number | null;
  last_uptime_seconds: number | null;
  firmware_version: string | null;
}

export interface SensorReadingRow {
  id: number;
  sensor_id: string;
  recorded_at: string;
  temperature: number | null;
  /**
   * Generated column: `coalesce(ph_soil, ph_water)`. Readable but never
   * writable — 0002 made it generated precisely so stale writers fail loudly.
   * Prefer `ph_soil` / `ph_water`; they are different quantities in different
   * media and merging them destroys information.
   */
  ph: number | null;
  sunlight: number | null;
  moisture: number | null;
  salinity: number | null;
  nitrogen: number | null;
  phosphorus: number | null;
  potassium: number | null;

  // --- telemetry contract, added by 0002 -----------------------------------
  ph_soil: number | null;
  ph_water: number | null;
  water_temperature: number | null;
  water_level: number | null;

  /**
   * The quality block. All three are present together or absent together — a
   * check constraint enforces it — so a half-populated block can never be
   * misread as three `false` values.
   */
  npk_estimated: boolean | null;
  stabilising: boolean | null;
  soil_dry: boolean | null;

  payload_version: number;
  received_at: string;
  recorded_at_source: ReadingTimeSource;
  /** Device-generated idempotency key, stable across a replay. */
  reading_uid: string | null;
  /** The validated envelope, verbatim. */
  raw: unknown | null;
}

/** Mirror of 0003_user_settings.sql. One row per user. */
export interface UserSettingsRow {
  owner_id: string;
  pair_by_id: boolean;
  pair_by_qr: boolean;
  reports_weekly: boolean;
  reports_monthly: boolean;
  reports_email: boolean;
  alerts_dashboard: boolean;
  alerts_popup: boolean;
  alerts_email: boolean;
  alerts_sms: boolean;
  alerts_delete_ignored_after_days: number;
  created_at: string;
  updated_at: string;
}

/** The settings a user can toggle — the row without its bookkeeping columns. */
export type UserSettings = Omit<
  UserSettingsRow,
  "owner_id" | "created_at" | "updated_at"
>;

/**
 * What a user gets before they have ever saved anything.
 *
 * Mirrors the column defaults in 0003 so a missing row and a default row behave
 * identically — the page must not look different just because nothing was
 * written yet.
 */
export const DEFAULT_USER_SETTINGS: UserSettings = {
  pair_by_id: true,
  pair_by_qr: true,
  reports_weekly: true,
  reports_monthly: true,
  reports_email: false,
  alerts_dashboard: true,
  alerts_popup: true,
  alerts_email: false,
  alerts_sms: false,
  alerts_delete_ignored_after_days: 14,
};

export interface AlertRow {
  id: string;
  owner_id: string;
  sensor_id: string | null;
  title: string;
  description: string | null;
  severity: AlertSeverity;
  label: string | null;
  state: AlertState;
  created_at: string;
}

/** A sensor joined with its most recent reading — what the tables and cards render. */
export interface SensorWithReading extends SensorRow {
  latest: SensorReadingRow | null;
}
