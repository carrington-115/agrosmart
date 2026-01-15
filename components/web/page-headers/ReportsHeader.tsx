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
    onSelect: () => {},
  },
  {
    label: "Reports",
    value: "reports",
    onSelect: () => {},
  },
  {
    label: "Recommendations",
    value: "recommendations",
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

export default function ReportsHeader() {
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
      <div className="flex flex-col w-full max-w-full gap-2 px-4">
        <div className="flex items-center gap-3">
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
        </div>
        <div className="flex items-center gap-3">
          <p>Filter by:</p>
          <Select>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              {filterDropDownOptions.map((filterOption) => (
                <SelectItem key={filterOption.value} value={filterOption.value}>
                  {filterOption.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </>
  );
}
