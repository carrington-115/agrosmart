import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all page requests except static assets and image files, so the
     * Supabase session cookie is refreshed on every navigation.
     *
     * `api` is deliberately excluded. Route handlers authenticate themselves and
     * return JSON 401s; redirecting them here would hand API clients an HTML
     * redirect instead. It would also make /api/ingest unreachable, since sensor
     * nodes authenticate with a device key and have no session cookie at all.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
