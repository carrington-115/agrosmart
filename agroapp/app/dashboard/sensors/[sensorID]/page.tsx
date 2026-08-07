import { Button } from "@/components/ui/button";
import { SensorsHeader } from "@/components/web";
import AnalyticsCard from "@/components/web/AnalyticsCard";
import { getRecentReadings, getSensorByCode, getThresholds } from "@/lib/queries";
import { buildSensorAnalytics } from "@/lib/analytics";
import { fmt, fmtDateTime, fmtRelative } from "@/lib/format";
import QualityBadges from "@/components/web/QualityBadges";
import type { ApiReading } from "@/lib/api-types";
import type { Quality } from "@/lib/types";
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
  const code = decodeURIComponent(sensorID);

  const [sensor, bands] = await Promise.all([
    getSensorByCode(code),
    getThresholds(),
  ]);

  if (!sensor) notFound();

  const sensorAnalytics = buildSensorAnalytics(sensor, bands);
  const readings = await getRecentReadings(sensor.sensorId, 5);

  return (
    <div>
      <SensorsHeader showFilters={false} />
      <div className="w-full flex flex-col px-4">
        <div className="w-full flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-bold">
              {sensor.sensorId}
              {sensor.actions.tag ? ` · ${sensor.actions.tag}` : ""}
            </h3>
            {/* Device state, not readings. `lastSeenAt` is the only thing that can
                tell a quiet node from a healthy one, so it belongs where the
                status badge is read. */}
            <p className="text-sm text-muted-foreground">
              Last seen {fmtRelative(sensor.lastSeenAt)}
              {sensor.firmwareVersion ? ` · firmware ${sensor.firmwareVersion}` : ""}
              {sensor.rssi !== null ? ` · ${sensor.rssi} dBm` : ""}
            </p>
            <QualityBadges quality={sensor.quality} className="mt-1" />
          </div>
          <Button>AI summary</Button>
        </div>
        <div className="w-full px-4 mx-auto grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-5 mt-4">
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

/** The quality block as the badges component wants it, or null when absent. */
function qualityOf(reading: ApiReading): Quality | null {
  const q = reading.quality;
  if (!q) return null;
  return {
    npkEstimated: q.npkEstimated,
    stabilising: q.stabilising,
    soilDry: q.soilDry,
  };
}

function SensorTable({ readings }: { readings: ApiReading[] }) {
  if (!readings.length) {
    return (
      <p className="text-muted-foreground text-sm">
        No readings recorded for this sensor yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableCaption>A list of your past 5 data points.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Recorded</TableHead>
            <TableHead>Temperature</TableHead>
            <TableHead>pH (soil)</TableHead>
            <TableHead>pH (water)</TableHead>
            <TableHead>Moisture</TableHead>
            <TableHead>Sunlight (rel.)</TableHead>
            <TableHead>Salinity</TableHead>
            <TableHead>Water level</TableHead>
            <TableHead>NPK</TableHead>
            <TableHead>Quality</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {readings.map((reading) => (
            <TableRow key={`${reading.recordedAt}-${reading.receivedAt}`}>
              <TableCell className="whitespace-nowrap">
                {fmtDateTime(reading.recordedAt)}
                {/* A server-stamped row says when we heard about the reading, not
                    when the soil was measured. The device omits `ts` until NTP
                    syncs, so this is routine rather than exceptional — and it is
                    what tells a replayed batch from live data. */}
                {reading.recordedAtSource === "server" && (
                  <span
                    className="ml-1 text-xs text-muted-foreground"
                    title="The device had no synced clock, so this is arrival time rather than measurement time."
                  >
                    (arrival)
                  </span>
                )}
              </TableCell>
              <TableCell>{fmt(reading.temperature)}</TableCell>
              <TableCell>{fmt(reading.phSoil)}</TableCell>
              <TableCell>{fmt(reading.phWater)}</TableCell>
              <TableCell>{fmt(reading.moisture)}</TableCell>
              <TableCell>{fmt(reading.sunlight, 0)}</TableCell>
              <TableCell>{fmt(reading.salinity, 2)}</TableCell>
              <TableCell>{fmt(reading.waterLevel, 0)}</TableCell>
              <TableCell className="whitespace-nowrap">
                N: {fmt(reading.npk?.nitrogen, 0)}, P: {fmt(reading.npk?.phosphorus, 0)},
                K: {fmt(reading.npk?.potassium, 0)}
              </TableCell>
              <TableCell>
                <QualityBadges quality={qualityOf(reading)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
