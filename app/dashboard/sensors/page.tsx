"use client";

import {
  Analytics,
  DashboardEmptyTemplate,
  SensorsHeader,
} from "@/components/web";
import { useState } from "react";
import { SatelliteDish } from "lucide-react";

export default function Sensors() {
  const [sensors, setSensors] = useState<number>(0);
  return (
    <div className="max-w-[100%] mx-auto overflow-x-hidden">
      <SensorsHeader />
      <>
        {sensors > 0 ? (
          <>
            <Analytics />
          </>
        ) : (
          <section className="max-w-[100%] mx-auto h-[80vh] flex justify-center items-center">
            <DashboardEmptyTemplate
              Icon={<SatelliteDish size={64} />}
              title="Get Started"
              description="It's a bit quiet in here. Let's get the ball rolling. Add sensors, get realtime visualization, and get AI powered features through chats, alerts, and recommendations."
              actionText="Add sensors"
              action={() => setSensors(1)}
            />
          </section>
        )}
      </>
    </div>
  );
}
