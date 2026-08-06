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
 * `lib/queries.ts` reads through `apiFetch` below; the development probe under
 * `app/dev/backend` uses `probeBackend`. Both go through `apiBaseUrl()` rather
 * than reading the environment a second time.
 */

import { createClient } from "@/lib/supabase/server";

/** How long a probe waits before calling the backend unreachable. */
const PROBE_TIMEOUT_MS = 5_000;

/** How long a dashboard read waits before giving up on the backend. */
const REQUEST_TIMEOUT_MS = 10_000;

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

/**
 * A typed failure from agroapi, or from the attempt to reach it.
 *
 * `code` is agroapi's own `ErrorCode` when it answered — `SENSOR_NOT_FOUND`,
 * `NOT_AUTHENTICATED` and so on — and `UNREACHABLE` when nothing did. Callers need
 * to tell those apart: one is a fact about the data, the other is a fact about the
 * deployment, and rendering "no sensors" for the second would tell a farmer their
 * equipment had vanished.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number | null;

  constructor(code: string, message: string, status: number | null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }

  /** True when the backend could not be reached at all. */
  get unreachable(): boolean {
    return this.status === null;
  }
}

/**
 * A read against agroapi, carrying the caller's Supabase session.
 *
 * **Server-only.** It reads `AGRO_API_URL`, which is not inlined into the client
 * bundle, and it forwards an access token that must never be handed to the
 * browser. Import it from Server Components and route handlers only.
 *
 * agroapi verifies the token against Supabase's JWKS and uses its `sub` as the
 * `auth.uid()` that the RLS policies check, so this is the same identity the
 * database already understands — no second identity system, and no way for this
 * app to ask for rows it does not own.
 *
 * Only `Authorization` and `Content-Type` are sent, which is exactly what
 * agroapi's CORS configuration allows. That does not actually matter here — a
 * server-to-server request sends no `Origin` and triggers no preflight — but
 * keeping to those two means the same call would work unchanged from a browser.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit & { allowAnonymous?: boolean } = {},
): Promise<T> {
  const { allowAnonymous = false, ...rest } = init;

  let baseUrl: string;
  try {
    baseUrl = apiBaseUrl();
  } catch (cause) {
    throw new ApiError(
      "NOT_CONFIGURED",
      cause instanceof Error ? cause.message : String(cause),
      null,
    );
  }

  const headers = new Headers(rest.headers);
  headers.set("Content-Type", "application/json");

  if (!allowAnonymous) {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      // Distinguished from a 401 the backend would return: there was no session
      // to send, so the request is not worth making.
      throw new ApiError("NOT_AUTHENTICATED", "No active session.", 401);
    }
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...rest,
      headers,
      // A dashboard showing cached telemetry is showing the past while claiming
      // to show the present. Next caches server fetches aggressively by default.
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    // Connection refused, DNS failure and timeout all land here. `status: null`
    // is what marks this as "the backend is not there" rather than "the backend
    // said no".
    throw new ApiError(
      "UNREACHABLE",
      cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause),
      null,
    );
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    // agroapi wraps typed errors as {detail: {code, message}}; FastAPI's own
    // validation errors use {detail: [...]}. Unwrap the former, describe the latter.
    const detail = (body as { detail?: unknown } | null)?.detail;
    const typed =
      detail && typeof detail === "object" && !Array.isArray(detail)
        ? (detail as { code?: string; message?: string })
        : null;

    throw new ApiError(
      typed?.code ?? `HTTP_${response.status}`,
      typed?.message ?? `${response.status} from ${path}`,
      response.status,
    );
  }

  return body as T;
}

/** The outcome of a page load: the data, or the reason the backend was unreachable. */
export type Loaded<T> = { ok: true; data: T } | { ok: false; detail: string };

/**
 * Runs a page's data fetching and turns "backend unreachable" into a value.
 *
 * A helper rather than a `try`/`catch` in each page because the JSX must stay
 * outside the `try`. React does not render a component at the moment its element
 * is constructed, so an error thrown during render escapes any enclosing
 * `try`/`catch` entirely — the block catches nothing and reads as though it does.
 * (`react-hooks/error-boundaries` flags exactly this.)
 *
 * Only a transport failure is converted. A 401 or a 404 is a fact about the
 * request and should surface as itself rather than as "the backend is down".
 */
export async function load<T>(fn: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof ApiError && error.unreachable) {
      return { ok: false, detail: error.message };
    }
    throw error;
  }
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
