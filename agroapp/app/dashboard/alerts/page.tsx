import { AlertsHeader } from "@/components/web";
import { getAlerts, toAlertView } from "@/lib/queries";
import AlertsView from "./AlertsView";

export default async function Alerts() {
  const alerts = (await getAlerts()).map(toAlertView);

  return (
    <div className="container w-[100%] max-w-full mx-auto">
      <AlertsHeader />
      <AlertsView alerts={alerts} />
    </div>
  );
}
