"use client";

import { Button } from "@/components/ui/button";
import {
  Analytics,
  DashboardHeader,
  MonitoringLineChart,
  Recommendations,
} from "@/components/web";
import { analyticsProps } from "@/lib/types";
import { CloudSun, Droplet, TreeDeciduous } from "lucide-react";
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
  const [sensors, setSensors] = useState<number>(1);
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
          <div className="w-full h-screen flex justify-center items-center">
            <div className="flex flex-col gap-3 items-center">
              <h1 className="text-2xl font-bold">Get Started</h1>
              <p>It's a bit quiet in here. Let's get the ball rolling.</p>
              <Button>Get Started</Button>
            </div>
          </div>
        )}
      </>
    </div>
  );
}
