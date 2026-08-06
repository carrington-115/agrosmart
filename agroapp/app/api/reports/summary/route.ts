import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSensors } from "@/lib/queries";

/** CSV export of the latest reading per sensor. Backs the "Download summary" button. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sensors = await getSensors();

  const header = [
    "sensor_id",
    "status",
    "recorded_at",
    "recorded_at_source",
    "temperature_c",
    "ph_soil",
    "ph_water",
    "moisture_pct",
    // Deliberately not "lux": the LDR is uncalibrated, and a column header is
    // exactly where a false unit gets carried into a spreadsheet and cited.
    "sunlight_relative",
    "salinity_ds_m",
    "water_level_relative",
    "nitrogen_mg_kg",
    "phosphorus_mg_kg",
    "potassium_mg_kg",
    // The quality block travels with the numbers. A CSV of nutrient values with
    // no indication they were estimated is precisely the artefact someone would
    // base a fertiliser order on.
    "npk_estimated",
    "stabilising",
    "soil_dry",
  ];

  const rows = sensors.map((s) => [
    s.sensorId,
    s.status,
    s.recordedAt,
    s.recordedAtSource,
    s.temperature,
    s.phSoil,
    s.phWater,
    s.moisture,
    s.sunlight,
    s.salinity,
    s.waterLevel,
    s.npk.nitrogen,
    s.npk.phosphorus,
    s.npk.potassium,
    s.quality?.npkEstimated,
    s.quality?.stabilising,
    s.quality?.soilDry,
  ]);

  /** Absent stays empty, never "null" and never 0. */
  function cell(value: unknown): string {
    if (value === null || value === undefined) return "";
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  const csv = [header, ...rows]
    .map((row) => row.map(cell).join(","))
    .join("\n");

  const filename = `agrosmart-summary-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
