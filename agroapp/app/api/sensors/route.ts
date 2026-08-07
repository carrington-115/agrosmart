import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api";
import { getSensors } from "@/lib/queries";
import { forwardError, readJson } from "@/lib/forward";
import type { ApiSensor } from "@/lib/api-types";

/**
 * List and register sensors.
 *
 * A forwarder now: agroapi owns the write, including the uniqueness conflict and
 * the farm attachment that used to be a second query here. Authentication is not
 * checked twice — `apiFetch` throws `NOT_AUTHENTICATED` when there is no session,
 * and agroapi rejects a bad token itself.
 */

export async function GET() {
  try {
    return NextResponse.json({ sensors: await getSensors() });
  } catch (error) {
    return forwardError(error);
  }
}

export async function POST(request: Request) {
  try {
    const sensor = await apiFetch<ApiSensor>("/v1/sensors", {
      method: "POST",
      body: JSON.stringify(await readJson(request)),
    });
    return NextResponse.json({ sensor }, { status: 201 });
  } catch (error) {
    return forwardError(error);
  }
}
