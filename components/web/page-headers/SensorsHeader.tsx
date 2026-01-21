"use client";

import AppHeader from "../AppHeader";
import { FilterOption, HeaderType } from "@/lib/types";
import {
  Settings,
  BellElectric,
  SearchIcon,
  Table,
  Grid,
  Plus,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";

// input group
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import SensorDialog from "../AddSensor";

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
  const [open, setOpen] = useState(false);
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
                // onClick={iconButton.action}
              >
                <iconButton.Icon />
              </button>
            ))}
            <Button onClick={() => setOpen(true)}>
              <Plus /> Add sensor
            </Button>
            <SensorDialog open={open} onOpenChange={setOpen} />
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
        <div className="">
          <Tabs defaultValue="table">
            <TabsList className="!bg-primary-container !text-on-primary-container">
              <TabsTrigger
                value="table"
                className="data-[state=active]:!bg-on-primary-container data-[state=active]:!text-primary-container"
              >
                <Table />
              </TabsTrigger>
              <TabsTrigger
                value="grid"
                className="data-[state=active]:!bg-on-primary-container data-[state=active]:!text-primary-container"
              >
                <Grid />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
    </>
  );
}
