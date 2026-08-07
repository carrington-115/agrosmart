import { CloudOff } from "lucide-react";

/**
 * Shown when agroapi cannot be reached.
 *
 * This exists because of a specific hazard the cutover introduced. Reads used to
 * go straight to Supabase and a failure yielded `[]`, so an error and an empty
 * farm rendered identically — tolerable when the only failure mode was a query
 * bug. With a network hop between the dashboard and its data, "the backend is
 * down" became a routine occurrence, and the empty state says *"It's a bit quiet
 * in here. Let's get the ball rolling. Add sensors"*.
 *
 * Telling a farmer their sensors are gone when the truth is that a service
 * restarted is the kind of wrong answer that costs trust in everything else on the
 * page. So this is deliberately unambiguous: nothing is missing, we simply cannot
 * see it right now.
 */
export default function BackendUnreachable({ detail }: { detail?: string }) {
  return (
    <section className="w-full h-[70vh] flex flex-col items-center justify-center gap-4 px-8 text-center">
      <CloudOff className="h-16 w-16 text-muted-foreground" />
      <h2 className="text-xl font-bold">Cannot reach the AgroSmart backend</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Your sensors and their readings are safe — this dashboard just cannot load
        them at the moment. It will recover on its own once the connection is back.
      </p>
      {detail && (
        // The cause verbatim. A misconfigured AGRO_API_URL and a stopped service
        // look identical from the outside, and whoever is debugging needs the
        // difference more than the page needs to look tidy.
        <p className="max-w-lg rounded-md bg-muted p-3 font-mono text-xs text-muted-foreground">
          {detail}
        </p>
      )}
    </section>
  );
}
