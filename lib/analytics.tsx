import {
  CloudSun,
  Droplet,
  HandMetal,
  Leaf,
  Sprout,
  Thermometer,
  Wind,
} from "lucide-react";
import type { analyticsProps, reportsCardProps, Sensor } from "@/lib/types";

/**
 * Derives the dashboard/sensor analytics cards from real readings.
 *
 * Replaces the previously hardcoded `dataAnalysisContent` array, and centralises
 * the threshold logic so the dashboard and the per-sensor page agree on what
 * counts as "Good" vs "Low".
 */

type Band = { status: string; color: string };

function band(
  value: number,
  low: number,
  high: number,
  labels: { low: string; ok: string; high: string },
): Band {
  if (value < low) return { status: labels.low, color: "!bg-orange-500" };
  if (value > high) return { status: labels.high, color: "!bg-red-500" };
  return { status: labels.ok, color: "!bg-green-500" };
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function round(value: number, dp = 1): number {
  const factor = 10 ** dp;
  return Math.round(value * factor) / factor;
}

/** Farm-wide averages across every sensor's latest reading. */
export function buildFarmAnalytics(sensors: Sensor[]): analyticsProps[] {
  const moisture = round(average(sensors.map((s) => s.moisture)));
  const sunlight = round(average(sensors.map((s) => s.sunlight)));
  const salinity = round(average(sensors.map((s) => s.salinity)), 2);
  const ph = round(average(sensors.map((s) => s.ph)), 1);

  const moistureBand = band(moisture, 30, 70, {
    low: "Low moisture",
    ok: "Good",
    high: "Waterlogged",
  });
  const sunlightBand = band(sunlight, 400, 1000, {
    low: "Low sunlight",
    ok: "Good",
    high: "Excess sunlight",
  });
  const salinityBand = band(salinity, 0, 0.5, {
    low: "Low salinity",
    ok: "Moderate salinity",
    high: "High salinity",
  });
  const phBand = band(ph, 6.0, 7.5, {
    low: "Low pH",
    ok: "Good",
    high: "High pH",
  });

  return [
    {
      title: "Soil moisture",
      value: `${moisture}%`,
      icon: <Droplet size={28} color="white" />,
      color: "outline-green-300",
      badgeStatus: moistureBand.status,
      badgeColor: moistureBand.color,
    },
    {
      title: "Sunlight",
      value: `${sunlight} lux`,
      icon: <CloudSun size={28} color="white" />,
      color: "outline-yellow-300",
      badgeStatus: sunlightBand.status,
      badgeColor: sunlightBand.color,
    },
    {
      title: "Salinity",
      value: `${salinity} dS/m`,
      icon: <Wind size={28} color="white" />,
      color: "outline-blue-300",
      badgeStatus: salinityBand.status,
      badgeColor: salinityBand.color,
    },
    {
      title: "pH Level",
      value: String(ph),
      icon: <Droplet size={28} color="white" />,
      color: "outline-orange-300",
      badgeStatus: phBand.status,
      badgeColor: phBand.color,
    },
  ];
}

type ReportBadge = { content: string; variant: reportsCardProps["badgeVariant"] };

function reportBadge(value: number, low: number, high: number): ReportBadge {
  if (value < low) return { content: "Low", variant: "destructive" };
  if (value > high) return { content: "High", variant: "secondary" };
  return { content: "Optimal", variant: "default" };
}

/**
 * Soil KPI cards computed from the averaged latest readings.
 *
 * Deliberately limited to what the sensors actually measure. The agronomic and
 * economic KPIs the design also mocked up (mandi prices, expected yield, carbon
 * sequestration, harvest window) need external data sources that are not wired
 * up, so they are omitted rather than filled with invented numbers.
 */
export function buildSoilReports(sensors: Sensor[]): reportsCardProps[] {
  const nitrogen = round(average(sensors.map((s) => s.npk.nitrogen)), 0);
  const phosphorus = round(average(sensors.map((s) => s.npk.phosphorus)), 0);
  const potassium = round(average(sensors.map((s) => s.npk.potassium)), 0);
  const ph = round(average(sensors.map((s) => s.ph)), 1);
  const moisture = round(average(sensors.map((s) => s.moisture)));
  const temperature = round(average(sensors.map((s) => s.temperature)));
  const salinity = round(average(sensors.map((s) => s.salinity)), 2);
  const sunlight = round(average(sensors.map((s) => s.sunlight)));

  return [
    {
      title: "Soil Nitrogen (N)",
      data: nitrogen,
      description: "mg/kg (farm average)",
      ...toBadge(reportBadge(nitrogen, 100, 200)),
      reportsIcon: <Leaf />,
    },
    {
      title: "Soil Phosphorus (P)",
      data: phosphorus,
      description: "mg/kg (farm average)",
      ...toBadge(reportBadge(phosphorus, 40, 80)),
      reportsIcon: <Sprout />,
    },
    {
      title: "Soil Potassium (K)",
      data: potassium,
      description: "mg/kg (farm average)",
      ...toBadge(reportBadge(potassium, 150, 350)),
      reportsIcon: <Droplet />,
    },
    {
      title: "Soil pH Level",
      data: ph,
      description: "pH (farm average)",
      ...toBadge(reportBadge(ph, 6.0, 7.5)),
      reportsIcon: <Droplet />,
    },
    {
      title: "Soil Moisture",
      data: moisture,
      description: "% (farm average)",
      ...toBadge(reportBadge(moisture, 30, 70)),
      reportsIcon: <HandMetal />,
    },
    {
      title: "Soil Temperature",
      data: temperature,
      description: "°C (farm average)",
      ...toBadge(reportBadge(temperature, 15, 30)),
      reportsIcon: <Thermometer />,
    },
    {
      title: "Soil Salinity",
      data: salinity,
      description: "dS/m (farm average)",
      ...toBadge(reportBadge(salinity, 0, 0.5)),
      reportsIcon: <Wind />,
    },
    {
      title: "Sunlight Exposure",
      data: sunlight,
      description: "lux (farm average)",
      ...toBadge(reportBadge(sunlight, 400, 1000)),
      reportsIcon: <CloudSun />,
    },
  ];
}

function toBadge(badge: ReportBadge) {
  return { badgeContent: badge.content, badgeVariant: badge.variant };
}

/** The five cards on the per-sensor detail page. */
export function buildSensorAnalytics(sensor: Sensor): analyticsProps[] {
  const temperatureBand = band(sensor.temperature, 15, 30, {
    low: "Cold",
    ok: "Normal",
    high: "Heat stress",
  });
  const moistureBand = band(sensor.moisture, 30, 70, {
    low: "Low",
    ok: "Normal",
    high: "Waterlogged",
  });
  const phBand = band(sensor.ph, 6.0, 7.5, {
    low: "Acidic",
    ok: "Normal",
    high: "Alkaline",
  });
  const sunlightBand = band(sensor.sunlight, 400, 1000, {
    low: "Low",
    ok: "Normal",
    high: "Excess",
  });
  const salinityBand = band(sensor.salinity, 0, 0.5, {
    low: "Low",
    ok: "Normal",
    high: "High",
  });

  return [
    {
      title: "Temperature",
      value: `${sensor.temperature}°C`,
      icon: <Thermometer className="h-6 w-6" />,
      color: "outline-red-300",
      badgeStatus: temperatureBand.status,
      badgeColor: `${temperatureBand.color} text-white`,
      sensorView: true,
    },
    {
      title: "Soil Moisture",
      value: `${sensor.moisture}%`,
      icon: <HandMetal className="h-6 w-6" />,
      color: "outline-blue-300",
      badgeStatus: moistureBand.status,
      badgeColor: `${moistureBand.color} text-white`,
      sensorView: true,
    },
    {
      title: "pH Level",
      value: String(sensor.ph),
      icon: <Droplet className="h-6 w-6" />,
      color: "outline-green-300",
      badgeStatus: phBand.status,
      badgeColor: `${phBand.color} text-white`,
      sensorView: true,
    },
    {
      title: "Sunlight",
      value: `${sensor.sunlight} lux`,
      icon: <CloudSun className="h-6 w-6" />,
      color: "outline-yellow-300",
      badgeStatus: sunlightBand.status,
      badgeColor: `${sunlightBand.color} text-white`,
      sensorView: true,
    },
    {
      title: "Salinity",
      value: `${sensor.salinity} dS/m`,
      icon: <Wind className="h-6 w-6" />,
      color: "outline-purple-300",
      badgeStatus: salinityBand.status,
      badgeColor: `${salinityBand.color} text-white`,
      sensorView: true,
    },
  ];
}
