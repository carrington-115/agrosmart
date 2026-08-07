"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { SatelliteDish } from "lucide-react";
import { settingsCheckType } from "@/lib/types";
import type { UserSettings } from "@/lib/database.types";
import { useRouter } from "next/navigation";

/**
 * One group of preference checkboxes.
 *
 * The boxes previously had no `checked` and no `onCheckedChange`, so they were
 * uncontrolled, reset on every reload and changed nothing. Each `id` now names a
 * real column in `user_settings`, and toggling one persists through
 * `PUT /api/settings`.
 */
export default function SettingsCheck({
  checkContent,
  title,
  addSensor,
  settings,
  busy,
  onToggle,
}: settingsCheckType & {
  settings: UserSettings;
  busy: boolean;
  onToggle: (key: keyof UserSettings, value: boolean) => void;
}) {
  const router = useRouter();

  return (
    <div className="w-[80%] flex flex-col gap-5 p-5 bg-primary-container rounded-2xl">
      <div className="w-full flex justify-between items-center">
        <h2 className="text-xl font-semibold">{title}</h2>
        {addSensor && (
          <div>
            <Button onClick={() => router.push("/dashboard/sensors")}>
              <SatelliteDish /> Add Sensor
            </Button>
          </div>
        )}
      </div>
      {checkContent.map((item) => (
        <div className="flex items-center gap-2" key={item.id}>
          <Checkbox
            id={item.id}
            checked={settings[item.id] === true}
            disabled={busy}
            onCheckedChange={(value) => onToggle(item.id, value === true)}
          />
          <Label htmlFor={item.id}>{item.label}</Label>
        </div>
      ))}
    </div>
  );
}
