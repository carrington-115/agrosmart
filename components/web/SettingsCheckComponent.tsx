"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { SatelliteDish } from "lucide-react";
import { settingsCheckType } from "@/lib/types";
import SensorDialog from "./AddSensor";
import { useState } from "react";

export default function SettingsCheck({
  checkContent,
  title,
  addSensor,
}: settingsCheckType) {
  const [open, setOpen] = useState<boolean>(false);
  return (
    <div className="w-[80%] flex flex-col gap-5 p-5 bg-primary-container rounded-2xl">
      <div className="w-full flex justify-between items-center">
        <h2 className="text-xl font-semibold">{title}</h2>
        {addSensor && (
          <div>
            <Button onClick={() => setOpen(true)}>
              <SatelliteDish /> Add Sensor
            </Button>
            <SensorDialog open={open} onOpenChange={setOpen} />
          </div>
        )}
      </div>
      {checkContent.map((item) => (
        <div className="flex items-center gap-2" key={item.id}>
          <Checkbox id={item.id} />
          <Label htmlFor={item.id}>{item.label}</Label>
        </div>
      ))}
    </div>
  );
}
