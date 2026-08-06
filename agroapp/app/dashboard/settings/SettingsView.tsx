"use client";

import { SettingsCheck } from "@/components/web";
import type { UserSettings } from "@/lib/database.types";
import { settingsCheckType } from "@/lib/types";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * The preference groups.
 *
 * Every `id` is a `user_settings` column, typed as such, so the mapping between
 * a checkbox and the thing it stores cannot drift.
 */
const GROUPS: settingsCheckType[] = [
  {
    title: "Sensor pairing",
    checkContent: [
      { id: "pair_by_id", label: "Add sensor by ID input" },
      { id: "pair_by_qr", label: "Add sensor by scanning QR code" },
    ],
    addSensor: true,
  },
  {
    title: "Reports",
    checkContent: [
      { id: "reports_weekly", label: "Receive reports weekly" },
      { id: "reports_monthly", label: "Receive reports monthly" },
      { id: "reports_email", label: "Send report notifications to email" },
    ],
    addSensor: false,
  },
  {
    title: "Alerts and notifications",
    checkContent: [
      { id: "alerts_dashboard", label: "Receive alerts on dashboard" },
      { id: "alerts_popup", label: "Receive alerts on popup" },
      { id: "alerts_email", label: "Send alerts to email" },
      { id: "alerts_sms", label: "Send alerts to SMS" },
    ],
    addSensor: false,
  },
];

export default function SettingsView({
  initial,
}: {
  initial: UserSettings;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();

  async function toggle(key: keyof UserSettings, value: boolean) {
    const previous = settings;
    // Optimistic: a checkbox that lags a round-trip feels broken.
    setSettings({ ...settings, [key]: value });
    setSaving(true);

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!response.ok) throw new Error(await response.text());
      startTransition(() => router.refresh());
    } catch {
      setSettings(previous);
      toast.error("Could not save that setting. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || pending;

  return (
    <div className="flex flex-col items-center gap-5 my-5">
      {GROUPS.map((group) => (
        <SettingsCheck
          key={group.title}
          {...group}
          settings={settings}
          busy={busy}
          onToggle={toggle}
        />
      ))}
      <p className="text-xs text-muted-foreground">
        Email and SMS delivery are stored but not yet sent — no delivery service
        is connected.
      </p>
    </div>
  );
}
