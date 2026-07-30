"use client";

import AppHeader from "../AppHeader";
import { HeaderType } from "@/lib/types";
import { Settings, SatelliteDish } from "lucide-react";
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
];

export default function AlertsHeader() {
  return (
    <>
      <AppHeader
        type={HeaderType.DASHBOARD}
        title="Alerts"
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
