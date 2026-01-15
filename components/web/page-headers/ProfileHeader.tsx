"use client";
import { HeaderType } from "@/lib/types";
import AppHeader from "../AppHeader";
import { buttonVariants } from "@/components/ui/button";
import { Settings, SatelliteDish, BellElectric } from "lucide-react";

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

export default function ProfileHeader() {
  return (
    <div className="w-full">
      <AppHeader
        type={HeaderType.DASHBOARD}
        title="Profile"
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
    </div>
  );
}
