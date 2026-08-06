"use client";

import { DashboardEmptyTemplate } from "@/components/web";
import AlertsCard from "@/components/web/AlertsCard";
import AlertsFilter, {
  type AlertFilters,
} from "@/components/web/AlertsFilter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { alertsCardProps } from "@/lib/types";
import { fmtDateTime } from "@/lib/format";
import { AlertCircle, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

/**
 * Client half of the alerts page.
 *
 * Accept/reject persist through `/api/alerts/[id]`. That was already true, but
 * unreachable: `AlertsCard` never destructured the handlers this component
 * passes it, so none of the buttons had an `onClick`.
 */
export default function AlertsView({ alerts }: { alerts: alertsCardProps[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Alerts actioned in this render, so the card updates before the refetch lands.
  const [optimistic, setOptimistic] = useState<
    Map<string, "accepted" | "rejected">
  >(new Map());
  const [openId, setOpenId] = useState<string | null>(null);
  // Defaults to open rather than all. `getAlerts()` now returns every state so
  // the status filter can actually reach them, but the page's job on arrival is
  // to show what needs attention, not a history of everything already handled.
  const [filters, setFilters] = useState<AlertFilters>({
    status: "open",
    type: "all",
    date: undefined,
  });

  const withOptimistic = useMemo(
    () =>
      alerts.map((alert) => {
        const override = optimistic.get(alert.alertId);
        return override ? { ...alert, state: override } : alert;
      }),
    [alerts, optimistic],
  );

  const types = useMemo(
    () =>
      Array.from(new Set(withOptimistic.map((a) => a.badgeInfo).filter(Boolean))).sort(),
    [withOptimistic],
  );

  const visible = useMemo(
    () =>
      withOptimistic.filter((alert) => {
        if (filters.status !== "all" && (alert.state ?? "open") !== filters.status) {
          return false;
        }
        if (filters.type !== "all" && alert.badgeInfo !== filters.type) {
          return false;
        }
        if (filters.date) {
          if (!alert.createdAt) return false;
          const created = new Date(alert.createdAt);
          if (created.toDateString() !== filters.date.toDateString()) return false;
        }
        return true;
      }),
    [withOptimistic, filters],
  );

  const open = visible.find((a) => a.alertId === openId) ?? null;

  async function resolve(alertId: string, state: "accepted" | "rejected") {
    setOptimistic((prev) => new Map(prev).set(alertId, state));
    if (openId === alertId) setOpenId(null);

    try {
      const response = await fetch(`/api/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
      });
      if (!response.ok) throw new Error(await response.text());
      toast.success(state === "accepted" ? "Alert resolved" : "Alert ignored");
      startTransition(() => router.refresh());
    } catch {
      // Put it back so the user can retry.
      setOptimistic((prev) => {
        const next = new Map(prev);
        next.delete(alertId);
        return next;
      });
      toast.error("Could not update the alert. Please try again.");
    }
  }

  if (!alerts.length) {
    return (
      <section className="w-full mx-auto h-[80vh] flex justify-center items-center">
        <DashboardEmptyTemplate
          Icon={<AlertCircle size={64} />}
          title="No alerts"
          description="Nothing needs your attention right now. Alerts appear here when a sensor reading crosses a threshold or a sensor stops reporting."
          actionText="View sensors"
          action={() => router.push("/dashboard/sensors")}
          anotherButtonAction={() => router.push("/dashboard/settings")}
        />
      </section>
    );
  }

  return (
    <section className="w-full mx-auto flex flex-col items-center px-8">
      <AlertsFilter filters={filters} types={types} onChange={setFilters} />

      {visible.length === 0 ? (
        <p className="my-16 text-sm text-muted-foreground">
          No alerts match these filters.
        </p>
      ) : (
        <div className="w-full my-5 flex gap-6">
          <div
            className={`grid flex-1 items-start gap-x-3 gap-y-5 ${
              open ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
            }`}
            aria-busy={pending}
          >
            {visible.map((alert) => (
              <AlertsCard
                key={alert.alertId}
                {...alert}
                busy={pending}
                viewAction={() => setOpenId(alert.alertId)}
                acceptAction={() => resolve(alert.alertId, "accepted")}
                rejectAction={() => resolve(alert.alertId, "rejected")}
              />
            ))}
          </div>

          {open && (
            <AlertDetail
              alert={open}
              busy={pending}
              onClose={() => setOpenId(null)}
              onResolve={resolve}
            />
          )}
        </div>
      )}
    </section>
  );
}

/** The side panel from the design: full text, what to do about it, and actions. */
function AlertDetail({
  alert,
  busy,
  onClose,
  onResolve,
}: {
  alert: alertsCardProps;
  busy: boolean;
  onClose: () => void;
  onResolve: (id: string, state: "accepted" | "rejected") => void;
}) {
  const resolved = alert.state === "accepted" || alert.state === "rejected";

  return (
    <aside className="w-full max-w-sm shrink-0 self-start rounded-xl bg-primary-container/20 p-5 text-on-primary-container">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">{alert.title}</h3>
          <Badge variant={alert.badgeType} className="mt-1">
            {alert.badgeInfo}
          </Badge>
        </div>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Close details"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>

      <p className="mt-4 text-sm">{alert.description}</p>

      {alert.sensorId && (
        <p className="mt-3 text-xs text-on-primary-container/70">
          Sensor {alert.sensorId} · {fmtDateTime(alert.createdAt)}
        </p>
      )}

      {alert.steps && alert.steps.length > 0 && (
        <>
          <h4 className="mt-5 font-semibold">How can I resolve this?</h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {alert.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </>
      )}

      {alert.derived ? (
        <p className="mt-5 text-xs text-on-primary-container/70">
          This alert is derived from current readings and clears itself once the
          reading returns to range, so there is nothing to resolve by hand.
        </p>
      ) : (
        <>
          <div className="mt-5 flex items-center gap-2">
            <p className="text-xs text-on-primary-container/70">Rate this alert</p>
            <Button size="icon" variant="ghost" aria-label="Helpful">
              <ThumbsUp className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Not helpful">
              <ThumbsDown className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-on-primary-container/20 pt-4">
            <Button
              variant="secondary"
              disabled={busy || resolved}
              onClick={() => onResolve(alert.alertId, "rejected")}
            >
              Ignore alert
            </Button>
            <Button
              disabled={busy || resolved}
              onClick={() => onResolve(alert.alertId, "accepted")}
            >
              Mark as resolved
            </Button>
          </div>
        </>
      )}
    </aside>
  );
}
