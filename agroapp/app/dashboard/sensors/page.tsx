import { getSensors, toSensorView } from "@/lib/queries";
import { buildFarmAnalytics } from "@/lib/analytics";
import SensorsView from "./SensorsView";

export default async function Sensors() {
  const sensors = (await getSensors()).map(toSensorView);
  const analytics = sensors.length ? buildFarmAnalytics(sensors) : [];

  return (
    <div className="max-w-[100%] mx-auto overflow-x-hidden">
      <SensorsView sensors={sensors} analytics={analytics} />
    </div>
  );
}
