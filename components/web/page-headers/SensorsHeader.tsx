"use client";

import AppHeader from "../AppHeader";
import { HeaderType } from "@/lib/types";
import { Settings, BellElectric, Plus, SearchIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";

// input group
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group";

const iconsButtons = [
  {
    Icon: Settings,
    label: "settings",
    action: () => {},
  },
  {
    Icon: BellElectric,
    label: "alerts",
    action: () => {},
  },
];

interface FilterOption {
  label: string;
  value: string;
  onSelect: () => void;
}

const filterOptions: FilterOption[] = [
  {
    label: "All",
    value: "all",
    onSelect: () => {},
  },
  {
    label: "Active",
    value: "active",
    onSelect: () => {},
  },
  {
    label: "Offline",
    value: "offline",
    onSelect: () => {},
  },
  {
    label: "Warning",
    value: "warning",
    onSelect: () => {},
  },
];

export default function SensorsHeader() {
  return (
    <>
      <AppHeader
        type={HeaderType.DASHBOARD}
        title="Sensors"
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
            <Button variant="default">
              <>
                <Plus />
              </>
              Add Sensor
            </Button>
          </>
        }
      />
      <div className="w-full px-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <p className="text-sm font-medium whitespace-nowrap">Filter by:</p>
          {filterOptions.map((filterOption) => (
            <button
              className={buttonVariants({
                size: "default",
                variant: "outline",
              })}
              key={filterOption.label}
              type="button"
              onClick={() => {}}
            >
              {filterOption.label}
            </button>
          ))}
          <InputGroup>
            <InputGroupInput placeholder="Search..." />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupAddon align="inline-end">
              <InputGroupButton>Search</InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </div>
        <div className=""></div>
      </div>
    </>
  );
}
