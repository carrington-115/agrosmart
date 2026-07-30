"use client";

import AppHeader from "../AppHeader";
import { FilterOption, HeaderType } from "@/lib/types";
import { buttonVariants } from "@/components/ui/button";
import { Settings, BellElectric, SatelliteDish } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { twMerge } from "tailwind-merge";
import { usePathname } from "next/navigation";

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

const filterOptions: FilterOption[] = [
  {
    label: "Overview",
    value: "overview",
    link: "/dashboard/reports",
    onSelect: () => {},
  },
  {
    label: "Reports",
    value: "reports",
    link: "/dashboard/reports/detailed",
    onSelect: () => {},
  },
  {
    label: "Recommendations",
    value: "recommendations",
    link: "/dashboard/reports/recommendations",
    onSelect: () => {},
  },
];

const filterDropDownOptions = [
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

export default function ReportsHeader({ reports }: { reports: boolean }) {
  const pathname = usePathname();

  return (
    <>
      <AppHeader
        type={HeaderType.DASHBOARD}
        title="Reports"
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
      {reports && (
        <div className="flex flex-col w-full max-w-full gap-2 px-4">
          <div className="flex items-center gap-3">
            {filterOptions.map((filterOption) => (
              <Link
                href={filterOption.link ? filterOption.link : ""}
                className={twMerge(
                  buttonVariants({
                    size: "default",
                    variant: "outline",
                  }),
                  filterOption.link === pathname &&
                    "bg-primary text-primary-foreground"
                )}
                key={filterOption.label}
              >
                {filterOption.label}
              </Link>
            ))}
          </div>
          {pathname === "/dashboard/reports" && (
            <div className="flex items-center gap-3">
              <p>Filter by:</p>
              <Select>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  {filterDropDownOptions.map((filterOption) => (
                    <SelectItem
                      key={filterOption.value}
                      value={filterOption.value}
                    >
                      {filterOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </>
  );
}
