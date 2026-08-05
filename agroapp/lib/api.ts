/**
 * The one module that knows where agroapi lives.
 *
 * Server-only. Import it from Server Components and route handlers, never from a
 * `"use client"` file — `AGRO_API_URL` is a plain runtime variable and is not
 * inlined into the browser bundle, so a client import would read `undefined`.
 *
 * That is deliberate, and `agroapp/Dockerfile` argues it at length: the backend's
 * address differs between compose (`http://agroapi:8080`), a host dev server
 * (`http://localhost:8080`) and production, while `NEXT_PUBLIC_*` are baked into
 * the image at build time. Prefixing this one would force an image per
 * environment to communicate a hostname.
 *
 * Today the only consumer is the development probe under `app/dev/backend`. When
 * `lib/queries.ts` moves off Supabase and onto the backend's read API, it calls
 * `apiBaseUrl()` from here rather than reading the environment a second time.
 */

/** How long a probe waits before calling the backend unreachable. */
const PROBE_TIMEOUT_MS = 5_000;

/**
 * The backend's base URL, without a trailing slash.
 *
 * Throws — naming the variable — rather than defaulting to localhost. A default
 * turns "you forgot to configure this" into "it silently talked to the wrong
 * backend, or to nothing", which is the failure `docker-compose.yml` uses
 * `${VAR:?message}` to avoid and `agroapi/config.py` refuses to start over.
 */
export function apiBaseUrl(): string {
  const url = process.env.AGRO_API_URL;
  if (!url) {
    throw new Error(
      "AGRO_API_URL is not set. It is the agroapi base URL and has no default: " +
        "http://agroapi:8080 under docker compose, http://localhost:8080 from a " +
        "host dev server. See agroapp/.env.example.",
    );
  }
  return url.replace(/\/+$/, "");
}

/** One HTTP check against the backend. `status` is null when nothing answered. */
export type ProbeCheck = {
  /** The path called, relative to the base URL. */
  path: string;
  /** The status the backend returned, or null if the request never completed. */
  status: number | null;
  /** The status this check is asserting. A mismatch is a finding, not a crash. */
  expected: number;
  /** Parsed JSON body when there was one, else the raw text, else null. */
  body: unknown;
  /** Transport-level failure — refused connection, DNS, timeout. */
  error: string | null;
};

export type BackendProbe = {
  baseUrl: string;
  /** True when at least one check got an HTTP response back, whatever its status. */
  reachable: boolean;
  checks: ProbeCheck[];
  /** Set when the probe could not even be attempted, e.g. AGRO_API_URL is unset. */
  error: string | null;
  elapsedMs: number;
};

/**
 * Flatten an error into one line, following `cause`.
 *
 * Node's fetch reports every transport failure as the same `TypeError: fetch
 * failed` and puts the useful part — `connect ECONNREFUSED 127.0.0.1:8080`,
 * `getaddrinfo ENOTFOUND agroapi` — in `cause`. Distinguishing "nothing is
 * listening" from "that hostname does not resolve" is most of this probe's value,
 * so the chain is unwrapped rather than reported as its uninformative head.
 */
function describeError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;

  // Bounded: a cause chain can in principle be cyclic, and this runs in a request.
  for (let depth = 0; current !== undefined && current !== null && depth < 5; depth++) {
    if (current instanceof Error) {
      parts.push(`${current.name}: ${current.message}`);
      current = current.cause;
    } else {
      parts.push(String(current));
      break;
    }
  }

  // ASCII on purpose. This string is read out of JSON in a terminal as often as
  // in a browser, and a Windows console decoding a UTF-8 dash as cp1252 turns a
  // diagnostic into a puzzle about encodings.
  return parts.join(" caused by ");
}

async function check(
  baseUrl: string,
  path: string,
  expected: number,
  init: RequestInit,
): Promise<ProbeCheck> {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      // A cached probe answers a question about the past. Next caches server
      // fetches aggressively by default, and a stale "reachable" here would be
      // worse than no probe at all.
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });

    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // Not JSON. Keep the text — an HTML error page from something that is not
      // agroapi is exactly the sort of thing worth seeing verbatim.
    }

    return { path, status: response.status, expected, body, error: null };
  } catch (cause) {
    // Connection refused, DNS failure and timeout all land here, and every one of
    // them is a *result* this probe exists to report. Throwing would turn the
    // most informative outcome into a 500 with a stack trace.
    return { path, status: null, expected, body: null, error: describeError(cause) };
  }
}

/**
 * Ask the backend two questions over HTTP. Never throws.
 *
 * **Readiness** (`/v1/health/ready`) reports the backend's own view of its
 * database, schema contract and JWKS reachability. A 503 here still proves the
 * wire between the two services works — it names which of agroapi's dependencies
 * is unhappy, which is a different problem from "the dashboard cannot reach the
 * backend".
 *
 * **Ingest auth** (`POST /v1/ingest` with no credentials) proves rather more than
 * readiness does: that a real route is reachable and that device authentication
 * is live. A 401 is the pass, and nothing is written — agroapi rejects a missing
 * bearer token before it reads the request body.
 *
 * Note it does not reject before touching the database: `current_device` depends
 * on a service-scoped connection, which FastAPI resolves first. So an agroapi
 * that cannot reach Postgres answers this check with a 500 rather than a 401.
 * That is still a reachability pass, and readiness above will already have said
 * which dependency is broken.
 */
export async function probeBackend(): Promise<BackendProbe> {
  const started = Date.now();

  let baseUrl: string;
  try {
    baseUrl = apiBaseUrl();
  } catch (cause) {
    return {
      baseUrl: "",
      reachable: false,
      checks: [],
      error: describeError(cause),
      elapsedMs: Date.now() - started,
    };
  }

  const checks = await Promise.all([
    check(baseUrl, "/v1/health/ready", 200, { method: "GET" }),
    check(baseUrl, "/v1/ingest", 401, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }),
  ]);

  return {
    baseUrl,
    reachable: checks.some((c) => c.status !== null),
    checks,
    error: null,
    elapsedMs: Date.now() - started,
  };
}
