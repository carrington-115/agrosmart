"use client";

import {
  AlertsFilter,
  AlertsHeader,
  DashboardEmptyTemplate,
} from "@/components/web";
import AlertsCard from "@/components/web/AlertsCard";
import { mockAlerts } from "@/lib/table-data";
import { AlertCircle } from "lucide-react";
import { useState } from "react";

export default function Alerts() {
  const [alerts, setAlerts] = useState<number>(0);
  return (
    <div>
      <AlertsHeader />
      {alerts > 0 ? (
        <section className="w-[100%] mx-auto flex flex-col items-center px-16">
          <AlertsFilter />
          <div className="w-[100%] my-5 grid grid-cols-4 items-center justify-between gap-x-3 gap-y-5">
            {mockAlerts.map((alert) => (
              <AlertsCard
                key={alert.alertId}
                title={alert.title}
                description={alert.description}
                badgeInfo={alert.badgeInfo}
                badgeType={alert.badgeType}
                viewAction={() => {}}
                acceptAction={() => {}}
                rejectAction={() => {}}
                alertId={alert.alertId}
              />
            ))}
          </div>
        </section>
      ) : (
        <section className="max-w-[100%] mx-auto h-[80vh] flex justify-center items-center">
          <DashboardEmptyTemplate
            Icon={<AlertCircle size={64} />}
            title="Get Started"
            description="It's a bit quiet in here. Let's get the ball rolling. Add sensors, get realtime visualization, and get AI powered features through chats, alerts, and recommendations."
            actionText="Add sensors"
            action={() => setAlerts(1)}
          />
        </section>
      )}
    </div>
  );
}
