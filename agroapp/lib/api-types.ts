/**
 * The shapes agroapi returns.
 *
 * A hand-maintained mirror of `agroapi/src/agroapi/schemas/read.py`. Kept separate
 * from `lib/types.ts`, which describes what the *components* consume: the two are
 * deliberately different, and `lib/queries.ts` is the seam between them. A change
 * to the wire format shows up there rather than rippling into every card and table.
 *
 * Every metric is `number | null | undefined`, and the `undefined` is the important
 * one. agroapi serialises with `exclude_none=True`, so a reading its sensor did not
 * report **has no key at all** — not `null`, and certainly not `0`. Anything that
 * consumes these must treat a missing key and an explicit null identically, which
 * is why `?? null` appears throughout the adapter rather than `?? 0`.
 */

/** A metric that may be absent because the hardware behind it did not report. */
export type ApiMetric = number | null | undefined;

export interface ApiQuality {
  /** N/P/K were back-calculated from conductivity, not measured. */
  npkEstimated: boolean;
  /** Inside the probe's 5-minute settling window. */
  stabilising: boolean;
  /** Conductivity was zero. Expected in dry soil; never a fault. */
  soilDry: boolean;
}

export interface ApiNpk {
  nitrogen?: ApiMetric;
  phosphorus?: ApiMetric;
  potassium?: ApiMetric;
}

export interface ApiReading {
  recordedAt: string;
  /** `server` means this is arrival time, not measurement time. */
  recordedAtSource: "device" | "server";
  receivedAt: string;
  temperature?: ApiMetric;
  moisture?: ApiMetric;
  salinity?: ApiMetric;
  phSoil?: ApiMetric;
  phWater?: ApiMetric;
  waterTemperature?: ApiMetric;
  /** Relative and uncalibrated — not lux. */
  sunlight?: ApiMetric;
  /** Relative and non-linear. Presence, not depth. */
  waterLevel?: ApiMetric;
  npk?: ApiNpk;
  /** Absent when the reading predates the contract — not the same as three falses. */
  quality?: ApiQuality;
}

export interface ApiBand {
  low: number;
  high: number;
}

export interface ApiBreach {
  metric: string;
  value: number;
  band: ApiBand;
  direction: "low" | "high";
}

export interface ApiSensor {
  id: string;
  /** The device code printed on the sensor, e.g. 'AGS-001'. */
  sensorId: string;
  tag?: string | null;
  farmId?: string | null;
  /** Derived server-side from `lastSeenAt` and the thresholds, not a stored column. */
  status: "normal" | "warning" | "offline";
  breaches?: ApiBreach[];
  lastSeenAt?: string | null;
  lastReadingAt?: string | null;
  rssi?: number | null;
  uptimeSeconds?: number | null;
  firmwareVersion?: string | null;
  latest?: ApiReading;
}

export interface ApiAlert {
  id: string;
  title: string;
  description?: string | null;
  severity: "default" | "secondary" | "destructive" | "outline";
  label?: string | null;
  state: "open" | "accepted" | "rejected";
  createdAt?: string | null;
  sensorId?: string | null;
  /** Computed from live readings; has no row, so it cannot be resolved by hand. */
  derived: boolean;
  steps?: string[];
}

export interface ApiProfile {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  avatarUrl?: string | null;
}

export interface ApiFarm {
  id: string;
  farmName: string;
  farmType?: string | null;
  farmSize?: ApiMetric;
  farmZones?: number | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  address?: string | null;
}

/** Preference columns, snake_case on the wire to match the checkbox ids. */
export interface ApiSettings {
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
}

export interface ApiMe {
  profile?: ApiProfile;
  farm?: ApiFarm;
  settings: ApiSettings;
}

export interface ApiPage<T> {
  items: T[];
  nextCursor?: string | null;
}

/**
 * The safe bands, keyed by metric.
 *
 * Fetched rather than declared. `agroapi/domain/thresholds.py` is the single
 * source, and a copy here would be the duplication that endpoint exists to end.
 */
export interface ApiThresholds {
  temperature: ApiBand;
  moisture: ApiBand;
  sunlight: ApiBand;
  salinity: ApiBand;
  phSoil: ApiBand;
  phWater: ApiBand;
  nitrogen: ApiBand;
  phosphorus: ApiBand;
  potassium: ApiBand;
}

export interface ApiDeviceToken {
  tokenId: string;
  /** The plaintext credential. Returned once and never retrievable again. */
  token: string;
  label?: string | null;
  expiresAt?: string | null;
}
