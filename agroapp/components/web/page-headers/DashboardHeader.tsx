"use client";

import AppHeader from "../AppHeader";
import { HeaderType } from "@/lib/types";
import { Settings, SatelliteDish, BellElectric } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const iconsButtons = [
  {
    Icon: Settings,
    label: "settings",
    action: () => {},
  },
  {
    Icon: SatelliteDish,
    label: "sensors",
    action: () => {},
  },
  {
    Icon: BellElectric,
    label: "alerts",
    action: () => {},
  },
];

export default function DashboardHeader() {
  return (
    <>
      <AppHeader
        type={HeaderType.DASHBOARD}
        title="Dashboard"
        greeting="Hi John. You farm has been doing great 3 days in a roll"
        getReport
        rightContent={
          <>
            {iconsButtons.map((iconButton) => (
              <button
                className={buttonVariants({ size: "icon", variant: "ghost" })}
                key={iconButton.label}
                type="button"
                onClick={iconButton.action}
              >
                <iconButton.Icon />
              </button>
            ))}
          </>
        }
      />
    </>
  );
}
