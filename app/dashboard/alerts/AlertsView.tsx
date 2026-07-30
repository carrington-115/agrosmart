"use client";

import { AlertsFilter, DashboardEmptyTemplate } from "@/components/web";
import AlertsCard from "@/components/web/AlertsCard";
import { alertsCardProps } from "@/lib/types";
import { AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

/**
 * Client half of the alerts page. Accept/reject now persist through
 * /api/alerts/[id] instead of being empty callbacks.
 */
export default function AlertsView({ alerts }: { alerts: alertsCardProps[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Alerts already actioned in this render, hidden optimistically.
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  const visible = alerts.filter((alert) => !resolved.has(alert.alertId));

  async function resolve(alertId: string, state: "accepted" | "rejected") {
    setResolved((prev) => new Set(prev).add(alertId));
    try {
      const response = await fetch(`/api/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
      });
      if (!response.ok) throw new Error(await response.text());
      toast.success(state === "accepted" ? "Alert accepted" : "Alert dismissed");
      startTransition(() => router.refresh());
    } catch {
      // Put it back so the user can retry.
      setResolved((prev) => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
      toast.error("Could not update the alert. Please try again.");
    }
  }

  if (!visible.length) {
    return (
      <section className="w-full mx-auto h-[80vh] flex justify-center items-center">
        <DashboardEmptyTemplate
          Icon={<AlertCircle size={64} />}
          title="No alerts"
          description="Nothing needs your attention right now. Alerts appear here when a sensor reading crosses a threshold."
          actionText="View sensors"
          action={() => router.push("/dashboard/sensors")}
          anotherButtonAction={() => router.push("/dashboard/settings")}
        />
      </section>
    );
  }

  return (
    <section className="w-full mx-auto flex flex-col items-center px-16">
      <AlertsFilter />
      <div
        className="w-full my-5 grid grid-cols-4 items-center justify-between gap-x-3 gap-y-5"
        aria-busy={pending}
      >
        {visible.map((alert) => (
          <AlertsCard
            key={alert.alertId}
            title={alert.title}
            description={alert.description}
            badgeInfo={alert.badgeInfo}
            badgeType={alert.badgeType}
            viewAction={() => router.push("/dashboard/alerts")}
            acceptAction={() => resolve(alert.alertId, "accepted")}
            rejectAction={() => resolve(alert.alertId, "rejected")}
            alertId={alert.alertId}
          />
        ))}
      </div>
    </section>
  );
}
