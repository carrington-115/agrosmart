/**
 * Hand-maintained mirror of supabase/migrations/0001_init.sql.
 *
 * Regenerate with the Supabase CLI once the project is linked:
 *   pnpm dlx supabase gen types typescript --linked > lib/database.types.ts
 */

export type SensorStatus = "normal" | "warning" | "offline";
export type AlertSeverity = "default" | "secondary" | "destructive" | "outline";
export type AlertState = "open" | "accepted" | "rejected";

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
  status: SensorStatus;
  created_at: string;
  updated_at: string;
}

export interface SensorReadingRow {
  id: number;
  sensor_id: string;
  recorded_at: string;
  temperature: number | null;
  ph: number | null;
  sunlight: number | null;
  moisture: number | null;
  salinity: number | null;
  nitrogen: number | null;
  phosphorus: number | null;
  potassium: number | null;
}

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
