import AppHeader from "../AppHeader";
import { HeaderType } from "@/lib/types";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Settings,
  SatelliteDish,
  BellElectric,
  Plus,
  FileClock,
} from "lucide-react";

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
    Icon: FileClock,
    label: "history",
    action: () => {},
  },
];

export default function ChatHeader() {
  return (
    <>
      <AppHeader
        type={HeaderType.DASHBOARD}
        title="Chatbot"
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
            <Button>
              <Plus />
              New chat
            </Button>
          </>
        }
      />
    </>
  );
}
