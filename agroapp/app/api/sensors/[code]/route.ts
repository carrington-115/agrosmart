import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Delete one sensor by its device code. RLS restricts this to the owner. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("sensors")
    .delete()
    .eq("sensor_code", decodeURIComponent(code))
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Sensor not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: data.id });
}
