import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPairingToken } from "@/lib/pairing";
import { sensorSchema } from "@/lib/schema";
import z from "zod";

/**
 * Registers a sensor from the phone, authenticated by a pairing token.
 *
 * The phone that scans the sensor has no Supabase session — it followed a link,
 * not a login — so it cannot use `POST /api/sensors`, which relies on one. The
 * pairing token carries the issuing user's id instead.
 *
 * Because there is no session there is no RLS context either, so this writes
 * through the service-role client with an **explicit** `owner_id` taken from the
 * verified token. That is the one thing making this safe: the owner comes from a
 * signed claim, never from the request body, so a caller cannot register a sensor
 * into someone else's account by naming them.
 */

export const runtime = "nodejs";

const claimSchema = z
  .object({
    token: z.string().min(1),
  })
  .and(sensorSchema);

export async function POST(request: Request) {
  const parsed = claimSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid pairing payload", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const claims = verifyPairingToken(parsed.data.token);
  if (!claims) {
    return NextResponse.json(
      {
        error:
          "This pairing link is no longer valid. Start again from the dashboard to get a new one.",
      },
      { status: 401 },
    );
  }

  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "QR pairing is not configured on this deployment." },
      { status: 503 },
    );
  }

  // Attach to the owner's first farm when they have one; farm_id is nullable.
  // Filtered by owner explicitly — this connection bypasses RLS, so the scoping
  // that a user-session query would get for free has to be written out.
  const { data: farm } = await supabase
    .from("farms")
    .select("id")
    .eq("owner_id", claims.userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("sensors")
    .insert({
      owner_id: claims.userId,
      farm_id: farm?.id ?? null,
      sensor_code: parsed.data.sensorId,
      sensor_tag: parsed.data.sensorTag,
      // A newly registered sensor has never reported, so `last_seen_at` is null
      // and the dashboard will derive `offline` until it does.
      status: "offline",
    })
    .select("sensor_code, sensor_tag")
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
