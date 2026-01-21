"use client";

import {
  AlertsFilter,
  AlertsHeader,
  DashboardEmptyTemplate,
} from "@/components/web";
import AlertsCard from "@/components/web/AlertsCard";
import { mockAlerts } from "@/lib/table-data";
import { AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Alerts() {
  const [alerts, setAlerts] = useState<number>(0);
  const router = useRouter();
  return (
    <div className="container w-[100%] max-w-full mx-auto">
      <AlertsHeader />
      {alerts > 0 ? (
        <section className="w-full mx-auto flex flex-col items-center px-16">
          <AlertsFilter />
          <div className="w-full my-5 grid grid-cols-4 items-center justify-between gap-x-3 gap-y-5">
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
        <section className="w-full mx-auto h-[80vh] flex justify-center items-center">
          <DashboardEmptyTemplate
            Icon={<AlertCircle size={64} />}
            title="Get Started"
            description="It's a bit quiet in here. Let's get the ball rolling. Add sensors, get realtime visualization, and get AI powered features through chats, alerts, and recommendations."
            actionText="Add sensors"
            action={() => router.push("/dashboard/sensors")}
            anotherButtonAction={() => router.push("/dashboard/settings")}
          />
        </section>
      )}
    </div>
  );
}
