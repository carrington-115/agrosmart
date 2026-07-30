import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestReadingSchema } from "@/lib/schema";
import type { SensorStatus } from "@/lib/database.types";

/**
 * Sensor reading ingestion — the firmware -> database path.
 *
 * Sensor nodes have no Supabase session, so they authenticate with a shared
 * device key in `x-device-key` and the insert runs through the service-role
 * client. Set SENSOR_INGEST_KEY and SUPABASE_SERVICE_ROLE_KEY to enable it.
 *
 * POST /api/ingest
 *   { "sensorId": "SENSOR-LKO-001", "temperature": 24.8, "ph": 7.1,
 *     "sunlight": 780, "moisture": 42, "salinity": 0.38,
 *     "nitrogen": 95, "phosphorus": 52, "potassium": 210 }
 */

export const runtime = "nodejs";

function keyMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, so compare lengths first.
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Flags a sensor as `warning` when any reading sits outside its safe band. */
function deriveStatus(reading: {
  temperature?: number;
  ph?: number;
  moisture?: number;
  salinity?: number;
}): SensorStatus {
  const outOfRange =
    (reading.temperature !== undefined &&
      (reading.temperature < 15 || reading.temperature > 30)) ||
    (reading.ph !== undefined && (reading.ph < 6 || reading.ph > 7.5)) ||
    (reading.moisture !== undefined &&
      (reading.moisture < 30 || reading.moisture > 70)) ||
    (reading.salinity !== undefined && reading.salinity > 0.5);

  return outOfRange ? "warning" : "normal";
}

export async function POST(request: Request) {
  const expectedKey = process.env.SENSOR_INGEST_KEY;
  if (!expectedKey) {
    return NextResponse.json(
      { error: "Ingestion is not configured on this deployment." },
      { status: 503 },
    );
  }

  const providedKey = request.headers.get("x-device-key");
  if (!providedKey || !keyMatches(providedKey, expectedKey)) {
    return NextResponse.json({ error: "Invalid device key" }, { status: 401 });
  }

  const parsed = ingestReadingSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid reading payload", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const { sensorId, recordedAt, ...metrics } = parsed.data;

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    // Missing SUPABASE_SERVICE_ROLE_KEY is a deployment misconfiguration, not a
    // bad request — report it the same way as a missing ingest key.
    return NextResponse.json(
      { error: "Ingestion is not configured on this deployment." },
      { status: 503 },
    );
  }

  // Readings are keyed on the device code, so resolve it to the sensor row. The
  // code is unique per owner, so match the single registered device.
  const { data: sensors, error: lookupError } = await supabase
    .from("sensors")
    .select("id")
    .eq("sensor_code", sensorId.toUpperCase())
    .limit(2);

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }
  if (!sensors?.length) {
    return NextResponse.json(
      { error: `Sensor ${sensorId} is not registered.` },
      { status: 404 },
    );
  }
  if (sensors.length > 1) {
    return NextResponse.json(
      { error: `Sensor code ${sensorId} is registered to multiple owners.` },
      { status: 409 },
    );
  }

  const sensorRowId = sensors[0].id;

  const { data: reading, error: insertError } = await supabase
    .from("sensor_readings")
    .insert({
      sensor_id: sensorRowId,
      recorded_at: recordedAt ?? new Date().toISOString(),
      temperature: metrics.temperature ?? null,
      ph: metrics.ph ?? null,
      sunlight: metrics.sunlight ?? null,
      moisture: metrics.moisture ?? null,
      salinity: metrics.salinity ?? null,
      nitrogen: metrics.nitrogen ?? null,
      phosphorus: metrics.phosphorus ?? null,
      potassium: metrics.potassium ?? null,
    })
    .select("id, recorded_at")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // A device that just reported is by definition online.
  await supabase
    .from("sensors")
    .update({ status: deriveStatus(metrics) })
    .eq("id", sensorRowId);

  return NextResponse.json({ reading }, { status: 201 });
}
