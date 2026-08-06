import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api";

/**
 * Forwarding browser requests to agroapi.
 *
 * The route handlers under `app/api/` used to talk to Supabase. They now forward
 * to agroapi, and they stay in place rather than being deleted so that the browser
 * never has to. Three reasons that matters:
 *
 *  * **The token stays server-side.** `apiFetch` reads the Supabase session from
 *    the request's cookies. A `fetch` from a client component would need the access
 *    token in the bundle to do the same.
 *  * **CORS stays irrelevant.** A server-to-server call sends no `Origin`, so
 *    agroapi's deliberately narrow `allow_headers` never has to grow.
 *  * **No call site changed.** Every component still posts to `/api/…`, so the
 *    cutover touched the data layer and nothing above it.
 */

/**
 * Turns an `ApiError` into the JSON response the client components expect.
 *
 * They all read `body.error` for a message, which predates this change and is
 * worth keeping — but `code` is passed through too, because a caller that wants to
 * distinguish `SENSOR_ALREADY_REGISTERED` from a generic 409 now can.
 *
 * An unreachable backend becomes a **502**, not a 500. The distinction is real: the
 * dashboard is working and its dependency is not, which is a different thing to
 * report and a different thing to page someone about.
 */
export function forwardError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    if (error.unreachable) {
      return NextResponse.json(
        {
          error:
            "The AgroSmart backend is not reachable right now. Please try again shortly.",
          code: error.code,
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status ?? 500 },
    );
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unexpected error" },
    { status: 500 },
  );
}

/** Parses a JSON body, returning `null` rather than throwing on malformed input. */
export async function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}
