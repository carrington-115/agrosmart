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
import { useRouter } from "next/navigation";

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
    cell: ({ row }) => {
      const temp = row.getValue("temperature") as number;
      return <div className="text-center">{temp.toFixed(1)} °C</div>;
    },
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
      <div className="text-center">{row.getValue("moisture")}%</div>
    ),
  },

  {
    accessorKey: "ph",
    header: "pH",
    cell: ({ row }) => <div className="text-center">{row.getValue("ph")}</div>,
  },

  {
    accessorKey: "salinity",
    header: "Salinity (dS/m)",
    cell: ({ row }) => (
      <div className="text-center">{row.getValue("salinity")}</div>
    ),
  },

  {
    id: "npk",
    header: "NPK (mg/kg)",
    cell: ({ row }) => {
      const npk = row.original.npk;
      return (
        <div className="text-sm text-center whitespace-nowrap">
          N: {npk.nitrogen} | P: {npk.phosphorus} | K: {npk.potassium}
        </div>
      );
    },
  },

  {
    accessorKey: "sunlight",
    header: "Sunlight (lux)",
    cell: ({ row }) => (
      <div className="text-center">{row.getValue("sunlight")}</div>
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
    cell: ({ row }) => {
      const sensor = row.original;
      const router = useRouter();

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
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
              onClick={() =>
                router.push(`/dashboard/sensors/${sensor.sensorId}`)
              }
            >
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">
              Delete sensor
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">
              {sensor.actions.alert ? "Acknowledge Alert" : "Set Alert"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
