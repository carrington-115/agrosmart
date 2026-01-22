import { Button } from "@/components/ui/button";
import { SensorsHeader } from "@/components/web";
import AnalyticsCard from "@/components/web/AnalyticsCard";
import { sampleSensors } from "@/lib/table-data";
import { analyticsProps } from "@/lib/types";
import {
  CloudSun,
  Droplet,
  HandMetal,
  RefreshCcw,
  Thermometer,
  Wind,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type sensorTableprops = {
  temperature: number;
  ph: number;
  moisture: number;
  sunlight: number;
  salinity: number;
  npk: { nitrogen: number; phosphorus: number; potassium: number };
};

export default async function SensorPage({
  params,
}: {
  params: Promise<{ sensorID: string }>;
}) {
  const { sensorID } = await params;
  const sensor = sampleSensors.find((sensor) => sensor.sensorId === sensorID);
  const sensorAnalytics: analyticsProps[] = [
    {
      title: "Temperature",
      value: String(sensor?.temperature) + "°C",
      icon: <Thermometer className="h-6 w-6" />,
      color: "outline-red-300",
      badgeStatus: "Normal",
      badgeColor: "!bg-red-500 text-white",
      sensorView: true,
    },
    {
      title: "Soil Moisture",
      value: String(sensor?.moisture) + "%",
      icon: <HandMetal className="h-6 w-6" />,
      color: "outline-blue-300",
      badgeStatus: "Normal",
      badgeColor: "!bg-blue-500 text-white",
      sensorView: true,
    },
    {
      title: "pH Level",
      value: String(sensor?.ph),
      icon: <Droplet className="h-6 w-6" />,
      color: "outline-green-300",
      badgeStatus: "Normal",
      badgeColor: "!bg-green-500 text-white",
      sensorView: true,
    },
    {
      title: "Sunlight",
      value: String(sensor?.sunlight),
      icon: <CloudSun className="h-6 w-6" />,
      color: "outline-yellow-300",
      badgeStatus: "Normal",
      badgeColor: "!bg-yellow-500 text-white",
      sensorView: true,
    },
    {
      title: "Salinity",
      value: String(sensor?.salinity),
      icon: <Wind className="h-6 w-6" />, // Using Wind as placeholder if specific Salinity icon isn't clear, or maybe Activity
      color: "outline-purple-300",
      badgeStatus: "Normal",
      badgeColor: "!bg-purple-500 text-white",
      sensorView: true,
    },
  ];
  const sensorTable: sensorTableprops[] = [
    {
      temperature: Number(sensor?.temperature),
      ph: Number(sensor?.ph),
      moisture: Number(sensor?.moisture),
      sunlight: Number(sensor?.sunlight),
      salinity: Number(sensor?.salinity),
      npk: {
        nitrogen: Number(sensor?.npk.nitrogen),
        phosphorus: Number(sensor?.npk.phosphorus),
        potassium: Number(sensor?.npk.potassium),
      },
    },
    {
      temperature: Number(sensor?.temperature),
      ph: Number(sensor?.ph),
      moisture: Number(sensor?.moisture),
      sunlight: Number(sensor?.sunlight),
      salinity: Number(sensor?.salinity),
      npk: {
        nitrogen: Number(sensor?.npk.nitrogen),
        phosphorus: Number(sensor?.npk.phosphorus),
        potassium: Number(sensor?.npk.potassium),
      },
    },
    {
      temperature: Number(sensor?.temperature),
      ph: Number(sensor?.ph),
      moisture: Number(sensor?.moisture),
      sunlight: Number(sensor?.sunlight),
      salinity: Number(sensor?.salinity),
      npk: {
        nitrogen: Number(sensor?.npk.nitrogen),
        phosphorus: Number(sensor?.npk.phosphorus),
        potassium: Number(sensor?.npk.potassium),
      },
    },
    {
      temperature: Number(sensor?.temperature),
      ph: Number(sensor?.ph),
      moisture: Number(sensor?.moisture),
      sunlight: Number(sensor?.sunlight),
      salinity: Number(sensor?.salinity),
      npk: {
        nitrogen: Number(sensor?.npk.nitrogen),
        phosphorus: Number(sensor?.npk.phosphorus),
        potassium: Number(sensor?.npk.potassium),
      },
    },
    {
      temperature: Number(sensor?.temperature),
      ph: Number(sensor?.ph),
      moisture: Number(sensor?.moisture),
      sunlight: Number(sensor?.sunlight),
      salinity: Number(sensor?.salinity),
      npk: {
        nitrogen: Number(sensor?.npk.nitrogen),
        phosphorus: Number(sensor?.npk.phosphorus),
        potassium: Number(sensor?.npk.potassium),
      },
    },
  ];

  return (
    <div>
      <SensorsHeader showFilters={false} />
      <div className="w-full flex flex-col px-4">
        <div className="w-full flex items-center justify-between">
          <h3 className="text-xl font-bold">Sensor realtime stream</h3>
          <Button>AI summary</Button>
        </div>
        <div className="w-full px-4 mx-auto grid grid-cols-5 gap-5 mt-4">
          {sensorAnalytics.map((item, index) => (
            <AnalyticsCard
              key={index}
              title={item.title}
              value={item.value}
              icon={item.icon}
              color={item.color}
              badgeStatus={item.badgeStatus}
              badgeColor={item.badgeColor}
              sensorView={item.sensorView}
            />
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
        <SensorTable sensor={sensorTable} />
      </div>
    </div>
  );
}

function SensorTable({ sensor }: { sensor: sensorTableprops[] }) {
  return (
    <Table>
      <TableCaption>A list of your past 5 data points.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Temperature</TableHead>
          <TableHead>pH Level</TableHead>
          <TableHead>Moisture</TableHead>
          <TableHead>Sunlight</TableHead>
          <TableHead>Salinity</TableHead>
          <TableHead>NPK</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sensor.map((item, index) => (
          <TableRow key={index}>
            <TableCell>{item.temperature}</TableCell>
            <TableCell>{item.ph}</TableCell>
            <TableCell>{item.moisture}</TableCell>
            <TableCell>{item.sunlight}</TableCell>
            <TableCell>{item.salinity}</TableCell>
            <TableCell>
              N: {item.npk.nitrogen}, P: {item.npk.phosphorus}, K:{" "}
              {item.npk.potassium}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
