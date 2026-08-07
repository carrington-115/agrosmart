import { NextResponse } from "next/server";
import { probeBackend } from "@/lib/api";

/**
 * Machine-readable answer to "can this dashboard reach agroapi?".
 *
 * Lives under `/api` on purpose. `proxy.ts` excludes that prefix from the session
 * matcher, so this is curl-able with no cookie — unlike `/dev/backend`, which is
 * the same probe behind the auth redirect for a browser.
 *
 *   curl -s localhost:3000/api/dev/backend | jq
 *
 * The response is always 200 when the probe ran, even if the backend is down:
 * the status code answers "did the probe execute", and the body answers "what did
 * it find". Collapsing those two makes an unreachable backend indistinguishable
 * from a broken probe, which is the one distinction this endpoint exists to make.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  // This reports the backend's internal dependency state — which database and
  // JWKS endpoint it is failing to reach, and at what address. That is useful on
  // a laptop and nobody's business in production.
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.json(await probeBackend());
}
