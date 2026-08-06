import { getSensors, getThresholds } from "@/lib/queries";
import { buildSoilReports } from "@/lib/analytics";
import ReportsView from "./ReportsView";

export default async function Reports() {
  const [sensors, bands] = await Promise.all([getSensors(), getThresholds()]);
  // Only sensors that have actually reported can contribute to a soil report.
  const reporting = sensors.filter((s) => s.status !== "offline");
  const reports = reporting.length ? buildSoilReports(reporting, bands) : [];

  return <ReportsView reports={reports} />;
}
