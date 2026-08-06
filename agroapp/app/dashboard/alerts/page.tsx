import { AlertsHeader, BackendUnreachable } from "@/components/web";
import { load } from "@/lib/api";
import { getAlerts } from "@/lib/queries";
import AlertsView from "./AlertsView";

/**
 * Alerts.
 *
 * Stored rows and threshold-derived ones both arrive from `GET /v1/alerts`. The
 * derivation used to live in `lib/derived-alerts.ts` here; it moved to
 * `agroapi/domain/alerts.py` so it can use `thresholds.py` as its source and be
 * covered by fixtures instead of being a threshold comparison inside a React tree.
 */
export default async function Alerts() {
  const result = await load(getAlerts);

  return (
    <div className="container w-[100%] max-w-full mx-auto">
      <AlertsHeader />
      {/* "No alerts" is reassuring and "cannot load alerts" is not. Rendering the
          first when the second is true is how a farmer misses something urgent. */}
      {result.ok ? (
        <AlertsView alerts={result.data} />
      ) : (
        <BackendUnreachable detail={result.detail} />
      )}
    </div>
  );
}
