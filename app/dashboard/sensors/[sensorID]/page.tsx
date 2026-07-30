import { Button } from "@/components/ui/button";
import { SensorsHeader } from "@/components/web";
import AnalyticsCard from "@/components/web/AnalyticsCard";
import { getRecentReadings, getSensorByCode, toSensorView } from "@/lib/queries";
import { buildSensorAnalytics } from "@/lib/analytics";
import type { SensorReadingRow } from "@/lib/database.types";
import { RefreshCcw } from "lucide-react";
import { notFound } from "next/navigation";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function SensorPage({
  params,
}: {
  params: Promise<{ sensorID: string }>;
}) {
  const { sensorID } = await params;
  const row = await getSensorByCode(decodeURIComponent(sensorID));

  if (!row) notFound();

  const sensor = toSensorView(row);
  const sensorAnalytics = buildSensorAnalytics(sensor);
  const readings = await getRecentReadings(row.id, 5);

  return (
    <div>
      <SensorsHeader showFilters={false} />
      <div className="w-full flex flex-col px-4">
        <div className="w-full flex items-center justify-between">
          <h3 className="text-xl font-bold">
            {row.sensor_code}
            {row.sensor_tag ? ` · ${row.sensor_tag}` : ""}
          </h3>
          <Button>AI summary</Button>
        </div>
        <div className="w-full px-4 mx-auto grid grid-cols-5 gap-5 mt-4">
          {sensorAnalytics.map((item) => (
            <AnalyticsCard key={item.title} {...item} />
          ))}
        </div>
      </div>
      <div className="w-full flex flex-col px-4 mt-10 gap-5 ">
        <div className="w-full flex items-center justify-between">
          <h3 className="text-xl font-bold">Last 5 data points</h3>
          <Button variant={"secondary"}>
            <RefreshCcw /> Refresh
          </Button>
        </div>
        <SensorTable readings={readings} />
      </div>
    </div>
  );
}

function fmt(value: number | null, dp = 1): string {
  return value === null ? "—" : Number(value).toFixed(dp);
}

function SensorTable({ readings }: { readings: SensorReadingRow[] }) {
  if (!readings.length) {
    return (
      <p className="text-muted-foreground text-sm">
        No readings recorded for this sensor yet.
      </p>
    );
  }

  return (
    <Table>
      <TableCaption>A list of your past 5 data points.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Recorded</TableHead>
          <TableHead>Temperature</TableHead>
          <TableHead>pH Level</TableHead>
          <TableHead>Moisture</TableHead>
          <TableHead>Sunlight</TableHead>
          <TableHead>Salinity</TableHead>
          <TableHead>NPK</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {readings.map((reading) => (
          <TableRow key={reading.id}>
            <TableCell className="whitespace-nowrap">
              {new Date(reading.recorded_at).toLocaleString()}
            </TableCell>
            <TableCell>{fmt(reading.temperature)}</TableCell>
            <TableCell>{fmt(reading.ph)}</TableCell>
            <TableCell>{fmt(reading.moisture)}</TableCell>
            <TableCell>{fmt(reading.sunlight)}</TableCell>
            <TableCell>{fmt(reading.salinity, 2)}</TableCell>
            <TableCell className="whitespace-nowrap">
              N: {fmt(reading.nitrogen, 0)}, P: {fmt(reading.phosphorus, 0)}, K:{" "}
              {fmt(reading.potassium, 0)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
