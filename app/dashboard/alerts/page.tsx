"use client";

import { AlertsHeader, DashboardEmptyTemplate } from "@/components/web";
import { AlertCircle } from "lucide-react";
import { useState } from "react";

export default function Alerts() {
  const [alerts, setAlerts] = useState<number>(0);
  return (
    <div>
      <AlertsHeader />
      {alerts > 0 ? (
        <section></section>
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
