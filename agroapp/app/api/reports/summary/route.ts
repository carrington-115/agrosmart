import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSensors, toSensorView } from "@/lib/queries";

/** CSV export of the latest reading per sensor. Backs the "Download summary" button. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sensors = (await getSensors()).map(toSensorView);

  const header = [
    "sensor_id",
    "status",
    "temperature_c",
    "ph",
    "moisture_pct",
    "sunlight_lux",
    "salinity_ds_m",
    "nitrogen_mg_kg",
    "phosphorus_mg_kg",
    "potassium_mg_kg",
  ];

  const rows = sensors.map((s) => [
    s.sensorId,
    s.status,
    s.temperature,
    s.ph,
    s.moisture,
    s.sunlight,
    s.salinity,
    s.npk.nitrogen,
    s.npk.phosphorus,
    s.npk.potassium,
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => String(cell)).join(","))
    .join("\n");

  const filename = `agrosmart-summary-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
