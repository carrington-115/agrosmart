"use client";

import {
  Analytics,
  DashboardEmptyTemplate,
  MonitoringLineChart,
  Recommendations,
} from "@/components/web";
import { analyticsProps, ChartPoint } from "@/lib/types";
import type { Recommendation } from "@/lib/recommendations";
import { File } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * Client half of the dashboard. The empty/populated decision now comes from the
 * server via `hasSensors` rather than a hardcoded `useState(0)` whose setter was
 * never called.
 */
export default function DashboardView({
  hasSensors,
  analytics,
  recommendations,
  series,
  npkEstimated,
}: {
  hasSensors: boolean;
  analytics: analyticsProps[];
  recommendations: Recommendation[];
  series: ChartPoint[];
  npkEstimated: boolean;
}) {
  const router = useRouter();

  if (!hasSensors) {
    return (
      <div className="w-full h-[80vh] flex justify-center items-center">
        <DashboardEmptyTemplate
          Icon={<File size={64} />}
          title="Get Started"
          description="It's a bit quiet in here. Let's get the ball rolling. Add sensors, get realtime visualization, and get AI powered features through chats, alerts, and recommendations."
          actionText="Add sensors"
          action={() => router.push("/dashboard/sensors")}
          anotherButtonAction={() => router.push("/dashboard/settings")}
        />
      </div>
    );
  }

  return (
    <>
      <Analytics items={analytics} />
      <section className="max-w-[100%] overflow-x-auto w-[100%] px-4 mx-auto flex justify-center gap-6 mb-20">
        <MonitoringLineChart data={series} estimated={npkEstimated} />
        <Recommendations items={recommendations} />
      </section>
    </>
  );
}
