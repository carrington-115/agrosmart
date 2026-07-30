import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { farmProfileSchema, userProfileSchema } from "@/lib/schema";

/** Persists the user profile form (previously a console.log). */
export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = userProfileSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid profile payload", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    name: parsed.data.name,
    email: parsed.data.email,
    address: parsed.data.address,
    phone: parsed.data.phone,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** Persists the farm profile form (previously a console.log). */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = farmProfileSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid farm payload", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const payload = {
    owner_id: user.id,
    farm_name: parsed.data.farmName,
    farm_type: parsed.data.farmType,
    farm_size: parsed.data.farmSize,
    farm_zones: parsed.data.farmZones,
    country: parsed.data.country,
    state: parsed.data.state,
    city: parsed.data.city,
    address: parsed.data.address,
  };

  // One farm per user for now: update the existing row when present.
  const { data: existing } = await supabase
    .from("farms")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { error } = existing
    ? await supabase.from("farms").update(payload).eq("id", existing.id)
    : await supabase.from("farms").insert(payload);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
