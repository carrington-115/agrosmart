import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api";
import { getUserSettings } from "@/lib/queries";
import { forwardError, readJson } from "@/lib/forward";
import type { ApiSettings } from "@/lib/api-types";

/**
 * Notification and reporting preferences.
 *
 * A forwarder to `/v1/me/settings`. The upsert, the column allow-list and the
 * "unsent means unchanged" semantics all live there — which matters for booleans,
 * because `false` is a value the user chose and must not be treated as absent.
 */

export async function GET() {
  try {
    return NextResponse.json({ settings: await getUserSettings() });
  } catch (error) {
    return forwardError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const settings = await apiFetch<ApiSettings>("/v1/me/settings", {
      method: "PUT",
      body: JSON.stringify(await readJson(request)),
    });
    return NextResponse.json({ settings });
  } catch (error) {
    return forwardError(error);
  }
}
