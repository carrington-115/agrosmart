import { getSensors, toSensorView } from "@/lib/queries";
import { buildSoilReports } from "@/lib/analytics";
import ReportsView from "./ReportsView";

export default async function Reports() {
  const sensors = (await getSensors()).map(toSensorView);
  // Only sensors that have actually reported can contribute to a soil report.
  const reporting = sensors.filter((s) => s.status !== "offline");
  const reports = reporting.length ? buildSoilReports(reporting) : [];

  return <ReportsView reports={reports} />;
}
