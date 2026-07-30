import { DashboardHeader } from "@/components/web";
import { getSensors, toSensorView } from "@/lib/queries";
import { buildFarmAnalytics } from "@/lib/analytics";
import DashboardView from "./DashboardView";

export default async function Dashboard() {
  const sensors = (await getSensors()).map(toSensorView);
  const analytics = sensors.length ? buildFarmAnalytics(sensors) : [];

  return (
    <div className="max-w-[100%] overflow-x-hidden">
      <DashboardHeader />
      <DashboardView hasSensors={sensors.length > 0} analytics={analytics} />
    </div>
  );
}
