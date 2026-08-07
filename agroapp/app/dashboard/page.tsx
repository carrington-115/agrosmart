import { BackendUnreachable, DashboardHeader } from "@/components/web";
import { load } from "@/lib/api";
import { getReadingSeries, getSensors, getThresholds } from "@/lib/queries";
import { buildFarmAnalytics } from "@/lib/analytics";
import { buildRecommendations } from "@/lib/recommendations";
import DashboardView from "./DashboardView";

export default async function Dashboard() {
  const result = await load(async () => {
    // Thresholds come from the backend so this app never holds a second copy of
    // them. Fetched alongside the sensors rather than after, since neither depends
    // on the other.
    const [sensors, bands] = await Promise.all([getSensors(), getThresholds()]);

    // Real readings for the chart. It previously rendered a hardcoded
    // CPU/memory/network fixture under the title "NPK Realtime Stream".
    const series = sensors.length
      ? await getReadingSeries(sensors.map((s) => s.sensorId))
      : { points: [], estimated: false };

    return {
      sensors,
      analytics: sensors.length ? buildFarmAnalytics(sensors, bands) : [],
      recommendations: sensors.length ? buildRecommendations(sensors) : [],
      series,
    };
  });

  return (
    <div className="max-w-[100%] overflow-x-hidden">
      <DashboardHeader />
      {result.ok ? (
        <DashboardView
          hasSensors={result.data.sensors.length > 0}
          analytics={result.data.analytics}
          recommendations={result.data.recommendations}
          series={result.data.series.points}
          npkEstimated={result.data.series.estimated}
        />
      ) : (
        <BackendUnreachable detail={result.detail} />
      )}
    </div>
  );
}
