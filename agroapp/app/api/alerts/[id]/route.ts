import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { alertStateSchema } from "@/lib/schema";

/** Accept or reject an alert. Backs the alert card's accept/reject buttons. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = alertStateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid state", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const { data, error } = await supabase
    .from("alerts")
    .update({ state: parsed.data.state })
    .eq("id", id)
    .select("id, state")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  return NextResponse.json({ alert: data });
}
