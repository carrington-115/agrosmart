import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSensors, toSensorView } from "@/lib/queries";
import { sensorSchema } from "@/lib/schema";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sensors = (await getSensors()).map(toSensorView);
  return NextResponse.json({ sensors });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = sensorSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid sensor payload", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  // Attach to the user's first farm when one exists; farm_id is nullable.
  const { data: farm } = await supabase
    .from("farms")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("sensors")
    .insert({
      owner_id: user.id,
      farm_id: farm?.id ?? null,
      sensor_code: parsed.data.sensorId,
      sensor_tag: parsed.data.sensorTag,
      status: "offline",
    })
    .select("*")
    .single();

  if (error) {
    // 23505 = unique_violation on (owner_id, sensor_code)
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A sensor with that ID is already registered." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sensor: data }, { status: 201 });
}
