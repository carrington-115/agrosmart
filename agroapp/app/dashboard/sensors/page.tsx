import { BackendUnreachable } from "@/components/web";
import { load } from "@/lib/api";
import { getSensors, getThresholds } from "@/lib/queries";
import { buildFarmAnalytics } from "@/lib/analytics";
import SensorsView from "./SensorsView";

export default async function Sensors() {
  const result = await load(async () => {
    const [sensors, bands] = await Promise.all([getSensors(), getThresholds()]);
    return {
      sensors,
      analytics: sensors.length ? buildFarmAnalytics(sensors, bands) : [],
    };
  });

  // An empty sensors table and an unreachable backend must not look alike: one
  // invites you to add a sensor, the other means the ones you have are hidden.
  if (!result.ok) return <BackendUnreachable detail={result.detail} />;

  return (
    <div className="max-w-[100%] mx-auto overflow-x-hidden">
      <SensorsView
        sensors={result.data.sensors}
        analytics={result.data.analytics}
      />
    </div>
  );
}
