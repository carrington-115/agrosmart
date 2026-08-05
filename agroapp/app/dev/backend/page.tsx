import { notFound } from "next/navigation";
import { probeBackend, type ProbeCheck } from "@/lib/api";

/**
 * "Is the dashboard actually talking to agroapi?" — rendered.
 *
 * This page is the whole point of the development stack: the two services share a
 * database but, until the read API lands, nothing else. Everything shown here
 * travelled browser → Next server → agroapi → Postgres, so a green panel is proof
 * the HTTP path exists and a red one names where it broke.
 *
 * `/api/dev/backend` returns the same probe as JSON and needs no session; this
 * page sits behind the auth redirect in `proxy.ts` like every other non-API route.
 */
export const dynamic = "force-dynamic";

function ok(check: ProbeCheck): boolean {
  return check.status === check.expected;
}

function Check({ check }: { check: ProbeCheck }) {
  const passed = ok(check);

  return (
    <li className="rounded-md border p-4">
      <div className="flex items-center justify-between gap-4">
        <code className="text-sm font-medium">{check.path}</code>
        <span
          className={`rounded px-2 py-0.5 text-xs font-semibold ${
            passed
              ? "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200"
              : "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200"
          }`}
        >
          {check.status ?? "no response"} / expected {check.expected}
        </span>
      </div>

      {check.error ? (
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">{check.error}</p>
      ) : null}

      {check.body !== null && check.body !== undefined ? (
        <pre className="mt-2 overflow-x-auto rounded bg-muted p-3 text-xs">
          {typeof check.body === "string"
            ? check.body
            : JSON.stringify(check.body, null, 2)}
        </pre>
      ) : null}
    </li>
  );
}

export default async function BackendProbePage() {
  // Reports agroapi's internal dependency state and address. Fine on a laptop,
  // not something to serve to the internet.
  if (process.env.NODE_ENV === "production") notFound();

  const probe = await probeBackend();
  const allPassed = probe.checks.length > 0 && probe.checks.every(ok);

  return (
    <div className="container mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Backend connection</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Development only. Live probe of agroapi from this Next.js server.
      </p>

      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted-foreground">AGRO_API_URL</dt>
        <dd>
          <code>{probe.baseUrl || "(unset)"}</code>
        </dd>
        <dt className="text-muted-foreground">Reachable</dt>
        <dd>{probe.reachable ? "yes" : "no"}</dd>
        <dt className="text-muted-foreground">Elapsed</dt>
        <dd>{probe.elapsedMs} ms</dd>
      </dl>

      {probe.error ? (
        <p className="mt-6 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {probe.error}
        </p>
      ) : (
        <>
          <p className="mt-6 text-sm font-medium">
            {allPassed
              ? "Every check passed — the dashboard can reach the backend."
              : "At least one check did not return the status it expected."}
          </p>
          <ul className="mt-3 space-y-3">
            {probe.checks.map((check) => (
              <Check key={check.path} check={check} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
