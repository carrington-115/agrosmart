"use client";

import AppHeader from "../AppHeader";
import { HeaderType } from "@/lib/types";
import { buttonVariants } from "@/components/ui/button";
import { Settings, SatelliteDish, BellElectric, Save } from "lucide-react";

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

export default function () {
  return (
    <>
      <AppHeader
        type={HeaderType.DASHBOARD}
        title="Settings"
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
            <button
              className={buttonVariants({ variant: "default" })}
              type="button"
              onClick={() => {}}
            >
              <Save />
              Save
            </button>
          </>
        }
      />
    </>
  );
}
