import {
  AnalyticsCard,
  DashboardHeader,
  MonitoringLineChart,
  Recommendations,
} from "@/components/web";
import { analyticsProps } from "@/lib/types";
import { CloudSun, Droplet, TreeDeciduous } from "lucide-react";

const dataAnalysisContent: analyticsProps[] = [
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
  return (
    <div className="max-w-[100%] overflow-x-hidden">
      <DashboardHeader />
      <section className="max-w-[100%] mx-0 px-4 py-5 overflow-x-hidden">
        <div className="w-full flex flex-col gap-4">
          <h2 className="text-2xl font-semibold">SSSP Data Readings</h2>
          <div className="w-full flex justify-between">
            {dataAnalysisContent.map((item) => (
              <AnalyticsCard key={item.title} {...item} />
            ))}
          </div>
        </div>
      </section>
      <section className="max-w-[100%] overflow-x-auto w-[100%] px-4 mx-auto flex justify-center gap-6 mb-20">
        <MonitoringLineChart />
        <Recommendations />
      </section>
    </div>
  );
}
