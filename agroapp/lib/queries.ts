import { createClient } from "@/lib/supabase/server";
import { apiFetch, ApiError } from "@/lib/api";
import type {
  ApiAlert,
  ApiMe,
  ApiMetric,
  ApiPage,
  ApiReading,
  ApiSensor,
  ApiSettings,
  ApiThresholds,
} from "@/lib/api-types";
import type { alertsCardProps, ChartPoint, Quality, Sensor } from "@/lib/types";

/**
 * Server-side data access for the dashboard.
 *
 * Reads go to **agroapi**, not to Supabase. That is the whole point of this
 * module: the backend owns the thresholds, the status derivation and the alert
 * logic, so a dashboard that queried Postgres directly had to reimplement all
 * three in TypeScript and keep them in step by hand.
 *
 * Authentication still belongs to Supabase. `apiFetch` forwards the session's
 * access token, and agroapi uses its `sub` as the `auth.uid()` that the RLS
 * policies check — so scoping is enforced by the database, once, rather than by
 * this file remembering to filter.
 *
 * Every function keeps the signature it had when this read Supabase directly, so
 * no page or component changed. The adapters below exist because the wire shape
 * nests a reading under `latest` while the UI wants it flat; they translate, and
 * they never invent a value for something the sensor did not report.
 */

/**
 * `undefined` (key omitted by `exclude_none`) and `null` both mean "not reported".
 *
 * There is deliberately no numeric fallback. A `?? 0` here would put a
 * plausible-looking pH 0.0 in front of a farmer whose water board is unplugged,
 * which is the failure the whole contract is shaped against.
 */
function metric(value: ApiMetric): number | null {
  return value === undefined || value === null ? null : value;
}

function toQualityView(quality: ApiReading["quality"]): Quality | null {
  if (!quality) return null;
  return {
    npkEstimated: quality.npkEstimated,
    stabilising: quality.stabilising,
    soilDry: quality.soilDry,
  };
}

/** Adapts one API sensor to the flat `Sensor` the tables and cards consume. */
export function toSensorView(sensor: ApiSensor): Sensor {
  const r = sensor.latest;

  return {
    sensorId: sensor.sensorId,
    temperature: metric(r?.temperature),
    phSoil: metric(r?.phSoil),
    phWater: metric(r?.phWater),
    waterTemperature: metric(r?.waterTemperature),
    waterLevel: metric(r?.waterLevel),
    sunlight: metric(r?.sunlight),
    moisture: metric(r?.moisture),
    salinity: metric(r?.salinity),
    npk: {
      nitrogen: metric(r?.npk?.nitrogen),
      phosphorus: metric(r?.npk?.phosphorus),
      potassium: metric(r?.npk?.potassium),
    },
    quality: toQualityView(r?.quality),
    recordedAt: r?.recordedAt ?? null,
    recordedAtSource: r?.recordedAtSource ?? null,
    lastSeenAt: sensor.lastSeenAt ?? null,
    rssi: sensor.rssi ?? null,
    firmwareVersion: sensor.firmwareVersion ?? null,
    // Derived by the backend from `lastSeenAt` and the thresholds. Not recomputed
    // here: two derivations of the same fact are two chances to disagree.
    status: sensor.status,
    breaches: sensor.breaches ?? [],
    actions: { id: sensor.id, tag: sensor.tag ?? null },
  };
}

export function toAlertView(alert: ApiAlert): alertsCardProps {
  return {
    title: alert.title,
    description: alert.description ?? "",
    badgeType: alert.severity,
    badgeInfo: alert.label ?? "Info",
    alertId: alert.id,
    state: alert.state,
    createdAt: alert.createdAt ?? null,
    sensorId: alert.sensorId ?? null,
    steps: alert.steps ?? [],
    derived: alert.derived,
  };
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Every sensor with its latest reading and derived status.
 *
 * One request, and one query behind it — agroapi uses a lateral join. The previous
 * implementation fetched every reading for every sensor and reduced in JavaScript,
 * which at one reading a minute per node is ~1,440 rows/node/day.
 */
export async function getSensors(): Promise<Sensor[]> {
  const sensors = await apiFetch<ApiSensor[]>("/v1/sensors");
  return sensors.map(toSensorView);
}

export async function getSensorByCode(sensorCode: string): Promise<Sensor | null> {
  try {
    const sensor = await apiFetch<ApiSensor>(
      `/v1/sensors/${encodeURIComponent(sensorCode)}`,
    );
    return toSensorView(sensor);
  } catch (error) {
    // A sensor that does not exist, and one belonging to another tenant, are the
    // same 404 — RLS makes them indistinguishable, which is the correct amount to
    // leak. Either way the page should render "not found", not an error.
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** Most recent readings for one sensor, newest first. */
export async function getRecentReadings(
  sensorCode: string,
  limit = 5,
): Promise<ApiReading[]> {
  const page = await apiFetch<ApiPage<ApiReading>>(
    `/v1/sensors/${encodeURIComponent(sensorCode)}/readings?limit=${limit}`,
  );
  return page.items;
}

/** NPK over a window, oldest first, for the dashboard chart. */
export async function getReadingSeries(
  sensorCodes: string[],
  sinceHours = 24,
): Promise<{ points: ChartPoint[]; estimated: boolean }> {
  const params = new URLSearchParams({ hours: String(sinceHours) });
  for (const code of sensorCodes) params.append("sensorIds", code);

  const readings = await apiFetch<ApiReading[]>(`/v1/readings?${params}`);

  return {
    points: readings.map((r) => ({
      time: r.recordedAt,
      nitrogen: metric(r.npk?.nitrogen),
      phosphorus: metric(r.npk?.phosphorus),
      potassium: metric(r.npk?.potassium),
    })),
    // If any contributing reading was back-calculated, the whole series is
    // labelled estimated. Understating this is the failure that matters.
    estimated: readings.some((r) => r.quality?.npkEstimated === true),
  };
}

/**
 * Alerts: stored rows plus ones derived from the current readings.
 *
 * The derivation happens in `agroapi/domain/alerts.py` rather than here. Nothing
 * inserts an alert row, so without the derived half this page is permanently empty
 * on a real deployment — but a threshold comparison in a React module cannot use
 * `thresholds.py` as its source, which is why it moved.
 */
export async function getAlerts(): Promise<alertsCardProps[]> {
  const alerts = await apiFetch<ApiAlert[]>("/v1/alerts");
  return alerts.map(toAlertView);
}

/** Profile, farm and settings in one round trip. */
export async function getMe(): Promise<ApiMe> {
  return apiFetch<ApiMe>("/v1/me");
}

export async function getProfile() {
  return (await getMe()).profile ?? null;
}

export async function getFarm() {
  return (await getMe()).farm ?? null;
}

export async function getUserSettings(): Promise<ApiSettings> {
  return (await getMe()).settings;
}

/**
 * The safe bands.
 *
 * Fetched, never declared. This is what lets `agroapi/domain/thresholds.py` be the
 * only place the numbers are written down — the frontend needs them to label a
 * reading "Low" or "Optimal", and any local copy would drift.
 *
 * Unauthenticated on the backend, so this works before a session is established.
 */
export async function getThresholds(): Promise<ApiThresholds> {
  return apiFetch<ApiThresholds>("/v1/thresholds", { allowAnonymous: true });
}
