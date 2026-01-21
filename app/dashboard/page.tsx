"use client";

import {
  Analytics,
  DashboardEmptyTemplate,
  DashboardHeader,
  MonitoringLineChart,
  Recommendations,
} from "@/components/web";
import { analyticsProps } from "@/lib/types";
import { CloudSun, Droplet, File, TreeDeciduous } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export const dataAnalysisContent: analyticsProps[] = [
  {
    title: "Soil moisture",
    value: "30%",
    icon: <Droplet size={28} color="white" />,
    color: "outline-green-300",
    badgeStatus: "Good",
    badgeColor: "!bg-green-500",
  },
  {
    title: "Sunlight",
    value: "10%",
    icon: <CloudSun size={28} color="white" />,
    color: "outline-yellow-300",
    badgeStatus: "Moderate sunlight",
    badgeColor: "!bg-yellow-500",
  },
  {
    title: "Salinity",
    value: "20%",
    icon: <TreeDeciduous size={28} color="white" />,
    color: "outline-blue-300",
    badgeStatus: "moderate salinity",
    badgeColor: "!bg-blue-500",
  },
  {
    title: "pH Level",
    value: "3.5",
    icon: <Droplet size={28} color="white" />,
    color: "outline-orange-300",
    badgeStatus: "Low pH",
    badgeColor: "!bg-orange-500",
  },
];

export default function Dashboard() {
  const router = useRouter();
  const [sensors, setSensors] = useState<number>(0);

  return (
    <div className="max-w-[100%] overflow-x-hidden">
      <DashboardHeader />
      <>
        {sensors > 0 ? (
          <>
            <Analytics />
            <section className="max-w-[100%] overflow-x-auto w-[100%] px-4 mx-auto flex justify-center gap-6 mb-20">
              <MonitoringLineChart />
              <Recommendations />
            </section>
          </>
        ) : (
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
        )}
      </>
    </div>
  );
}
