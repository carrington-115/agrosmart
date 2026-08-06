import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api";
import { forwardError, readJson } from "@/lib/forward";
import type { ApiAlert } from "@/lib/api-types";

/**
 * Accept or reject an alert. Backs the alert card's accept/reject buttons.
 *
 * Derived alerts cannot reach agroapi's handler: their ids look like
 * `derived:offline:AGS-001` and fail UUID parsing with a 422. That is the right
 * answer — they have no row to update and clear themselves when the reading
 * recovers — and the card hides the controls for them anyway.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const alert = await apiFetch<ApiAlert>(
      `/v1/alerts/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(await readJson(request)) },
    );
    return NextResponse.json({ alert });
  } catch (error) {
    return forwardError(error);
  }
}
