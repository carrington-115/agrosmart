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
import { analyticsProps, Sensor } from "@/lib/types";

/**
 * Client half of the sensors page. `sensors` comes from the server, so the empty
 * state is driven by real data instead of a hardcoded `useState(0)`.
 */
export default function SensorsView({
  sensors,
  analytics,
}: {
  sensors: Sensor[];
  analytics: analyticsProps[];
}) {
  const [open, setOpen] = useState<boolean>(false);
  const router = useRouter();
  const hasSensors = sensors.length > 0;

  return (
    <>
      <SensorsHeader showFilters={hasSensors} />
      {hasSensors ? (
        <>
          <Analytics items={analytics} />
          <div className="w-full px-4 mx-auto">
            <DataTableDemo data={sensors} />
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
          {/* The populated state relies on the header's own add button + dialog. */}
          <SensorDialog open={open} onOpenChange={setOpen} />
        </>
      )}
    </>
  );
}
