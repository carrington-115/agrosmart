"use client";

import {
  AlertsFilter,
  AlertsHeader,
  DashboardEmptyTemplate,
} from "@/components/web";
import AlertsCard from "@/components/web/AlertsCard";
import { alertsCardProps } from "@/lib/types";
import { AlertCircle } from "lucide-react";
import { useState } from "react";

// fake test data using <AlertsCard />
export const mockAlerts: alertsCardProps[] = [
  {
    title: "Low Soil Moisture Detected",
    description:
      "Soil moisture in Field A-3 is at 18% – below the recommended 30-35% for maize.",
    badgeType: "destructive",
    badgeInfo: "Urgent",
    alertId: "alert-001",
  },
  {
    title: "High Temperature Warning",
    description:
      "Temperature reached 38°C in Greenhouse B – risk of heat stress to tomatoes.",
    badgeType: "destructive",
    badgeInfo: "Critical",
    alertId: "alert-002",
  },
  {
    title: "Pest Activity Detected",
    description:
      "Early signs of fall armyworm detected in maize plot C-2 via camera trap.",
    badgeType: "destructive",
    badgeInfo: "Action Required",
    alertId: "alert-003",
  },
  {
    title: "Fertilizer Recommendation",
    description:
      "NPK levels low in Field D-1. Suggested: 20 kg/ha Urea + 15 kg/ha DAP.",
    badgeType: "secondary",
    badgeInfo: "Recommendation",
    alertId: "alert-004",
  },
  {
    title: "Irrigation Scheduled",
    description:
      "Automatic drip irrigation started in Orchard E at 06:30 AM for 45 minutes.",
    badgeType: "default",
    badgeInfo: "Info",
    alertId: "alert-005",
  },
  {
    title: "pH Level Out of Range",
    description:
      "Soil pH in Plot F-4 is 5.2 (too acidic). Consider lime application soon.",
    badgeType: "destructive",
    badgeInfo: "Warning",
    alertId: "alert-006",
  },
  {
    title: "Rainfall Incoming",
    description:
      "Heavy rain expected in next 4 hours – pause fertigation and close greenhouse vents.",
    badgeType: "secondary",
    badgeInfo: "Weather Alert",
    alertId: "alert-007",
  },
  {
    title: "Battery Low – Soil Sensor",
    description:
      "Sensor node #12 in Field B-1 has battery level at 14%. Replace soon.",
    badgeType: "outline",
    badgeInfo: "Maintenance",
    alertId: "alert-008",
  },
  {
    title: "Good Growth Progress",
    description:
      "Wheat crop in Field G-2 shows healthy NDVI increase of +0.18 since last week.",
    badgeType: "default",
    badgeInfo: "Positive",
    alertId: "alert-009",
  },
  {
    title: "Nutrient Imbalance Detected",
    description:
      "Potassium (K) levels low in tomato greenhouse C. Recommend foliar spray.",
    badgeType: "secondary",
    badgeInfo: "Recommendation",
    alertId: "alert-010",
  },
  {
    title: "Frost Risk Tonight",
    description:
      "Temperature expected to drop to 2°C tonight – activate frost protection in orchard.",
    badgeType: "destructive",
    badgeInfo: "Urgent",
    alertId: "alert-011",
  },
  {
    title: "All Systems Normal",
    description:
      "No critical alerts detected in the last 24 hours across all monitored fields.",
    badgeType: "default",
    badgeInfo: "All Good",
    alertId: "alert-012",
  },
];

export default function Alerts() {
  const [alerts, setAlerts] = useState<number>(0);
  return (
    <div>
      <AlertsHeader />
      {alerts > 0 ? (
        <section className="w-[100%] mx-auto flex flex-col items-center px-16">
          <AlertsFilter />
          <div className="w-[100%] my-5 grid grid-cols-4 items-center justify-between gap-x-3 gap-y-5">
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
