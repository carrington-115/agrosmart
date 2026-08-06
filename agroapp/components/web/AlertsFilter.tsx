"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "../ui/button";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";

/**
 * Filter controls for the alerts page.
 *
 * These were previously three unconnected inputs whose options were "Light",
 * "Dark" and "System" — leftovers from a theme switcher. State now lives in
 * `AlertsView`, which owns the list being filtered.
 */

export type AlertStatusFilter = "all" | "open" | "accepted" | "rejected";

export type AlertFilters = {
  status: AlertStatusFilter;
  /** Matches `badgeInfo`, the alert's label. */
  type: string;
  date: Date | undefined;
};

export default function AlertsFilter({
  filters,
  types,
  onChange,
}: {
  filters: AlertFilters;
  /** Labels present in the current alert set, so the list offers only real options. */
  types: string[];
  onChange: (next: AlertFilters) => void;
}) {
  const cleared: AlertFilters = { status: "open", type: "all", date: undefined };
  const dirty =
    filters.status !== "open" || filters.type !== "all" || filters.date !== undefined;

  return (
    <div className="w-full max-w-[100%] mx-auto flex items-center justify-center mt-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium whitespace-nowrap">
            Filter by status:
          </p>
          <Select
            value={filters.status}
            onValueChange={(value) =>
              onChange({ ...filters, status: value as AlertStatusFilter })
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="accepted">Resolved</SelectItem>
              <SelectItem value="rejected">Ignored</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          <p className="text-sm font-medium whitespace-nowrap">Filter by type:</p>
          <Select
            value={filters.type}
            onValueChange={(value) => onChange({ ...filters, type: value })}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {types.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          <p className="text-sm font-medium whitespace-nowrap">Filter by date:</p>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                data-empty={!filters.date}
                className="data-[empty=true]:text-muted-foreground w-[240px] justify-start text-left font-normal"
              >
                <CalendarIcon />
                {filters.date ? (
                  format(filters.date, "PPP")
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={filters.date}
                onSelect={(date) => onChange({ ...filters, date })}
              />
            </PopoverContent>
          </Popover>
        </div>

        {dirty && (
          <Button variant="ghost" size="sm" onClick={() => onChange(cleared)}>
            <X className="mr-1 h-4 w-4" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
