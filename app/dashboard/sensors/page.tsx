"use client";

import {
  Analytics,
  DashboardEmptyTemplate,
  SensorsHeader,
} from "@/components/web";
import { SatelliteDish } from "lucide-react";
import { DataTableDemo } from "@/components/web/DataTable";
import SensorDialog from "@/components/web/AddSensor";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Sensors() {
  const [sensors, setSensors] = useState<number>(0);
  const [open, setOpen] = useState<boolean>(false);

  const router = useRouter();

  return (
    <div className="max-w-[100%] mx-auto overflow-x-hidden">
      <SensorsHeader showFilters={sensors > 0} />
      <>
        {sensors > 0 ? (
          <>
            <Analytics />
            <div className="w-full px-4 mx-auto">
              <DataTableDemo />
            </div>
          </>
        ) : (
          <>
            <section className="max-w-[100%] mx-auto h-[80vh] flex justify-center items-center">
              <DashboardEmptyTemplate
                Icon={<SatelliteDish size={64} />}
                title="Get Started"
                description="It's a bit quiet in here. Let's get the ball rolling. Add sensors, get realtime visualization, and get AI powered features through chats, alerts, and recommendations."
                actionText="Add sensors"
                action={() => setOpen(true)}
                anotherButtonAction={() => router.push("/dashboard/settings")}
              />
            </section>
            <SensorDialog open={open} onOpenChange={setOpen} />
          </>
        )}
      </>
    </div>
  );
}
