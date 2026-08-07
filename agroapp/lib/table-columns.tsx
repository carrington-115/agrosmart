"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Sensor } from "./types";
import { fmt, fmtRelative, fmtUnit } from "./format";
import QualityBadges from "@/components/web/QualityBadges";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export const columns: ColumnDef<Sensor>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },

  {
    accessorKey: "sensorId",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Sensor ID
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("sensorId")}</div>
    ),
  },
  {
    accessorKey: "temperature",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Temp (°C)
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    // Guarded. This used to be a bare `temp.toFixed(1)`, which only survived
    // because queries.ts coerced every null to 0 on the way in. With absence
    // preserved, an unguarded call here throws on the first unplugged board.
    cell: ({ row }) => (
      <div className="text-center">
        {fmtUnit(row.original.temperature, " °C", 1)}
      </div>
    ),
  },

  {
    accessorKey: "moisture",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Moisture (%)
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="text-center">{fmtUnit(row.original.moisture, "%", 0)}</div>
    ),
  },

  // Two pH columns, not one. The soil probe (range 3–9, ±0.3) and the calibrated
  // water board measure different things in different media; a single column
  // could only show one of them while implying it covered both.
  {
    accessorKey: "phSoil",
    header: "pH (soil)",
    cell: ({ row }) => (
      <div className="text-center">{fmt(row.original.phSoil, 1)}</div>
    ),
  },
  {
    accessorKey: "phWater",
    header: "pH (water)",
    cell: ({ row }) => (
      <div className="text-center">{fmt(row.original.phWater, 1)}</div>
    ),
  },

  {
    accessorKey: "salinity",
    header: "Salinity (dS/m)",
    cell: ({ row }) => (
      <div className="text-center">{fmt(row.original.salinity, 2)}</div>
    ),
  },

  {
    id: "npk",
    header: "NPK (mg/kg)",
    cell: ({ row }) => {
      const npk = row.original.npk;
      return (
        <div className="text-sm text-center whitespace-nowrap">
          N: {fmt(npk.nitrogen, 0)} | P: {fmt(npk.phosphorus, 0)} | K:{" "}
          {fmt(npk.potassium, 0)}
        </div>
      );
    },
  },

  {
    // Not "lux". The LDR is uncalibrated and relative; labelling its output with
    // a photometric unit asserts a calibration that does not exist.
    accessorKey: "sunlight",
    header: "Sunlight (rel.)",
    cell: ({ row }) => (
      <div className="text-center">{fmt(row.original.sunlight, 0)}</div>
    ),
  },
  {
    accessorKey: "waterLevel",
    header: "Water level",
    cell: ({ row }) => (
      <div className="text-center">{fmt(row.original.waterLevel, 0)}</div>
    ),
  },
  {
    id: "quality",
    header: "Quality",
    cell: ({ row }) => <QualityBadges quality={row.original.quality} />,
  },
  {
    accessorKey: "lastSeenAt",
    header: "Last seen",
    cell: ({ row }) => (
      <div className="text-center whitespace-nowrap text-sm text-muted-foreground">
        {fmtRelative(row.original.lastSeenAt)}
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as Sensor["status"];
      return (
        <Badge
          variant={
            status === "normal"
              ? "default"
              : status === "offline"
                ? "destructive"
                : "secondary"
          }
        >
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      );
    },
  },

  {
    id: "actions",
    enableHiding: false,
    // Rendered via a component so `useRouter` runs inside a real component
    // body rather than directly in this cell callback.
    cell: ({ row }) => <SensorRowActions sensor={row.original} />,
  },
];

function SensorRowActions({ sensor }: { sensor: Sensor }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    setPending(true);
    try {
      const response = await fetch(
        `/api/sensors/${encodeURIComponent(sensor.sensorId)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error(await response.text());
      toast.success(`${sensor.sensorId} deleted`);
      router.refresh();
    } catch {
      toast.error("Could not delete the sensor. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0" disabled={pending}>
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => navigator.clipboard.writeText(sensor.sensorId)}
        >
          Copy Sensor ID
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push(`/dashboard/sensors/${sensor.sensorId}`)}
        >
          View Details
        </DropdownMenuItem>
        <DropdownMenuItem className="text-destructive" onClick={handleDelete}>
          Delete sensor
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
