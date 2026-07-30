import { createClient } from "@/lib/supabase/server";
import type {
  AlertRow,
  FarmRow,
  ProfileRow,
  SensorReadingRow,
  SensorRow,
  SensorWithReading,
} from "@/lib/database.types";
import type { alertsCardProps, Sensor } from "@/lib/types";

/**
 * Server-side data access for the dashboard. Every function relies on RLS for
 * scoping rather than filtering by owner_id in the query, so a missing session
 * yields empty results instead of another user's rows.
 */

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** numeric columns arrive as numbers, but coerce defensively so the UI never renders NaN. */
function num(value: number | null): number {
  return value === null ? 0 : Number(value);
}

/** Adapts a joined DB row to the `Sensor` shape the table and cards already consume. */
export function toSensorView(row: SensorWithReading): Sensor {
  const r = row.latest;
  return {
    sensorId: row.sensor_code,
    temperature: num(r?.temperature ?? null),
    ph: num(r?.ph ?? null),
    sunlight: num(r?.sunlight ?? null),
    moisture: num(r?.moisture ?? null),
    salinity: num(r?.salinity ?? null),
    npk: {
      nitrogen: num(r?.nitrogen ?? null),
      phosphorus: num(r?.phosphorus ?? null),
      potassium: num(r?.potassium ?? null),
    },
    status: row.status,
    actions: { id: row.id, tag: row.sensor_tag },
  };
}

export function toAlertView(row: AlertRow): alertsCardProps {
  return {
    title: row.title,
    description: row.description ?? "",
    badgeType: row.severity,
    badgeInfo: row.label ?? "Info",
    alertId: row.id,
  };
}

/**
 * All sensors plus their most recent reading.
 *
 * Readings are fetched in one batched query and reduced client-side rather than
 * issuing N queries or relying on a database view, so this stays a plain
 * two-round-trip read.
 */
export async function getSensors(): Promise<SensorWithReading[]> {
  const supabase = await createClient();

  const { data: sensors, error } = await supabase
    .from("sensors")
    .select("*")
    .order("sensor_code", { ascending: true });

  if (error || !sensors?.length) return [];

  const { data: readings } = await supabase
    .from("sensor_readings")
    .select("*")
    .in(
      "sensor_id",
      sensors.map((s) => s.id),
    )
    .order("recorded_at", { ascending: false });

  const latestBySensor = new Map<string, SensorReadingRow>();
  for (const reading of readings ?? []) {
    // Rows arrive newest-first, so the first hit per sensor is the latest.
    if (!latestBySensor.has(reading.sensor_id)) {
      latestBySensor.set(reading.sensor_id, reading);
    }
  }

  return (sensors as SensorRow[]).map((s) => ({
    ...s,
    latest: latestBySensor.get(s.id) ?? null,
  }));
}

export async function getSensorByCode(
  sensorCode: string,
): Promise<SensorWithReading | null> {
  const supabase = await createClient();

  const { data: sensor } = await supabase
    .from("sensors")
    .select("*")
    .eq("sensor_code", sensorCode)
    .maybeSingle();

  if (!sensor) return null;

  const { data: latest } = await supabase
    .from("sensor_readings")
    .select("*")
    .eq("sensor_id", sensor.id)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { ...(sensor as SensorRow), latest: (latest as SensorReadingRow) ?? null };
}

/** Most recent readings for one sensor, newest first. Powers the "Last N data points" table. */
export async function getRecentReadings(
  sensorId: string,
  limit = 5,
): Promise<SensorReadingRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("sensor_readings")
    .select("*")
    .eq("sensor_id", sensorId)
    .order("recorded_at", { ascending: false })
    .limit(limit);

  return (data as SensorReadingRow[]) ?? [];
}

export async function getAlerts(): Promise<AlertRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("alerts")
    .select("*")
    .eq("state", "open")
    .order("created_at", { ascending: false });

  return (data as AlertRow[]) ?? [];
}

export async function getProfile(): Promise<ProfileRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").maybeSingle();
  return (data as ProfileRow) ?? null;
}

export async function getFarm(): Promise<FarmRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("farms")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as FarmRow) ?? null;
}
