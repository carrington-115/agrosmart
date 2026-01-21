"use client";

import { Button } from "@/components/ui/button";
import { DashboardEmptyTemplate, ReportsCard } from "@/components/web";
import { reportsCardProps } from "@/lib/types";
import {
  BarChart3,
  CloudDrizzle,
  CloudRain,
  Droplet,
  Droplets,
  IndianRupee,
  Leaf,
  LeafyGreen,
  Recycle,
  SprayCan,
  Sun,
  Thermometer,
  Bug,
  CalendarDays,
  Clock,
  Mountain,
  Radar,
  Sprout,
  Zap,
  HeartPulse,
  Download,
  FileText,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const sampleReports: reportsCardProps[] = [
  {
    title: "Current Soil Nitrogen (N)",
    data: 92,
    description: "mg/kg",
    badgeContent: "Low",
    badgeVariant: "destructive",
    reportsIcon: <Leaf />,
  },
  {
    title: "Soil Phosphorus (P)",
    data: 48,
    description: "mg/kg",
    badgeContent: "Optimal",
    badgeVariant: "default",
    reportsIcon: <Sprout />,
  },
  {
    title: "Soil Potassium",
    data: 285,
    description: "mg/kg",
    badgeContent: "Good",
    badgeVariant: "secondary",
    reportsIcon: <Droplet />,
  },
  {
    title: "Soil pH Level",
    data: 7.2,
    description: "pH",
    badgeContent: "Neutral",
    badgeVariant: "default",
    reportsIcon: <Thermometer />,
  },
  {
    title: "Soil Moisture",
    data: 48,
    description: "mg/kg",
    badgeContent: "Optimal",
    badgeVariant: "default",
    reportsIcon: <Sprout />,
  },
  {
    title: "Soil Potassium (K)",
    data: 285,
    description: "mg/kg",
    badgeContent: "Good",
    badgeVariant: "secondary",
    reportsIcon: <Droplet />,
  },
  {
    title: "Soil pH Level 1",
    data: 7.2,
    description: "pH",
    badgeContent: "Neutral",
    badgeVariant: "default",
    reportsIcon: <Thermometer />,
  },
  {
    title: "Soil Moisture 2",
    data: 34,
    description: "%",
    badgeContent: "Critical",
    badgeVariant: "destructive",
    reportsIcon: <CloudRain />,
  },
  {
    title: "Avg. Daily Temperature",
    data: 28.4,
    description: "°C",
    badgeContent: "High",
    badgeVariant: "destructive",
    reportsIcon: <Sun />,
  },
  {
    title: "Projected Yield (Wheat)",
    data: 4.8,
    description: "tons/ha",
    badgeContent: "+12%",
    badgeVariant: "default",
    reportsIcon: <BarChart3 />,
  },
  {
    title: "Water Usage Efficiency",
    data: 68,
    description: "%",
    badgeContent: "Moderate",
    badgeVariant: "secondary",
    reportsIcon: <Recycle />,
  },
  {
    title: "Days to Next Irrigation",
    data: 3,
    description: "days",
    badgeContent: "Soon",
    badgeVariant: "destructive",
    reportsIcon: <Clock />,
  },
  {
    title: "Pest Risk Index",
    data: 42,
    description: "/100",
    badgeContent: "Medium",
    badgeVariant: "secondary",
    reportsIcon: <Bug />,
  },
  {
    title: "Organic Carbon",
    data: 0.78,
    description: "%",
    badgeContent: "Low",
    badgeVariant: "destructive",
    reportsIcon: <Mountain />,
  },
  {
    title: "Current Crop Health Score",
    data: 78,
    description: "/100",
    badgeContent: "Good",
    badgeVariant: "default",
    reportsIcon: <HeartPulse />,
  },
  {
    title: "Fertilizer Cost Saved",
    data: 12450,
    description: "₹ this season",
    badgeContent: "+18%",
    badgeVariant: "default",
    reportsIcon: <IndianRupee />,
  },
  {
    title: "Rainfall This Week",
    data: 12,
    description: "mm",
    badgeContent: "Deficit",
    badgeVariant: "destructive",
    reportsIcon: <CloudDrizzle />,
  },
  {
    title: "NDVI (Vegetation Index)",
    data: 0.62,
    description: "(0-1)",
    badgeContent: "Healthy",
    badgeVariant: "default",
    reportsIcon: <Radar />,
  },
  {
    title: "Days Since Last Spray",
    data: 18,
    description: "days",
    badgeContent: "Due",
    badgeVariant: "destructive",
    reportsIcon: <SprayCan />,
  },
  {
    title: "Soil EC (Salinity)",
    data: 0.42,
    description: "dS/m",
    badgeContent: "Safe",
    badgeVariant: "default",
    reportsIcon: <Zap />,
  },
  {
    title: "Expected Harvest Window",
    data: 22,
    description: "days",
    badgeContent: "Optimal",
    badgeVariant: "default",
    reportsIcon: <CalendarDays />,
  },
  {
    title: "Carbon Sequestration",
    data: 1.8,
    description: "t/ha/year",
    badgeContent: "+9%",
    badgeVariant: "secondary",
    reportsIcon: <LeafyGreen />,
  },
  {
    title: "Irrigation Water Saved",
    data: 42000,
    description: "liters/ha",
    badgeContent: "Excellent",
    badgeVariant: "default",
    reportsIcon: <Droplets />,
  },
];

export default function Reports() {
  const [reports, setReports] = useState<boolean>(false);
  const router = useRouter();
  return (
    <div>
      {reports ? (
        <section className="flex flex-col px-4 gap-4 mt-5">
          <div className="w-full flex items-center justify-between">
            <h3 className="text-lg font-semibold">Download summary report</h3>
            <Button>
              Download summary{" "}
              <>
                <Download />
              </>
            </Button>
          </div>
          <div className="grid grid-cols-4 gap-4 mb-16">
            {sampleReports.map((report) => (
              <ReportsCard key={report.title} {...report} />
            ))}
          </div>
        </section>
      ) : (
        <div className="w-full h-[80vh] flex justify-center items-center">
          <DashboardEmptyTemplate
            Icon={<FileText />}
            title="No reports found"
            description="You have no reports to view."
            actionText="Get Started"
            action={() => router.push("/dashboard/sensors")}
            anotherButtonAction={() => router.push("/dashboard/settings")}
          />
        </div>
      )}
    </div>
  );
}
