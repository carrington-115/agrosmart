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
import type { ApiBand, ApiThresholds } from "@/lib/api-types";
import { ABSENT, fmt } from "@/lib/format";

/**
 * Derives the dashboard/sensor analytics cards from real readings.
 *
 * Three rules shape everything below.
 *
 * **The bands come from the backend.** `ApiThresholds` is passed in, fetched from
 * `GET /v1/thresholds`, rather than imported from a local constant. There used to
 * be two copies of these numbers in this app and a third in the backend; this is
 * how they collapse to one. Nothing here may hardcode a threshold.
 *
 * **Absent is not zero.** Every metric can legitimately be missing, so the
 * averages skip nulls rather than counting them as 0. Counting them dragged every
 * farm-wide KPI toward zero the moment one board was unplugged, and then banded
 * the result "Low" — inventing a field-wide problem out of a wiring fault.
 *
 * **The quality flags gate the verdicts.** A settling probe is not banded at all,
 * dry soil does not make salinity a problem, and estimated NPK gets no verdict.
 * `agroapi/domain/status.py` owns those rules; this module owns their presentation.
 */

type ThresholdBand = ApiBand;

type Verdict = { status: string; color: string };

const NEUTRAL = "!bg-slate-400";

function band(
  value: number | null,
  b: ThresholdBand,
  labels: { low: string; ok: string; high: string },
): Verdict {
  if (value === null) return { status: "No data", color: NEUTRAL };
  if (value < b.low) return { status: labels.low, color: "!bg-orange-500" };
  if (value > b.high) return { status: labels.high, color: "!bg-red-500" };
  return { status: labels.ok, color: "!bg-green-500" };
}

/**
 * Mean of the readings that exist, or `null` when none do.
 *
 * The null filter is the point: an average over `[42, null, null]` is 42, not 14.
 */
function average(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (!present.length) return null;
  return present.reduce((sum, v) => sum + v, 0) / present.length;
}

function round(value: number | null, dp = 1): number | null {
  if (value === null) return null;
  const factor = 10 ** dp;
  return Math.round(value * factor) / factor;
}

/** True when any sensor's latest reading says its NPK was back-calculated. */
function anyNpkEstimated(sensors: Sensor[]): boolean {
  return sensors.some((s) => s.quality?.npkEstimated === true);
}

/**
 * Salinity readings that are meaningful to average.
 *
 * A dry-soil reading measures zero conductivity because the soil is dry, not
 * because the salinity is low. Averaging those in would pull the farm figure
 * down and report a nutrient problem that is really a moisture observation.
 */
function meaningfulSalinity(sensors: Sensor[]): (number | null)[] {
  return sensors
    .filter((s) => !s.quality?.soilDry)
    .map((s) => s.salinity);
}

/** Sensors whose readings are settled enough to judge. */
function settled(sensors: Sensor[]): Sensor[] {
  return sensors.filter((s) => !s.quality?.stabilising);
}

/** A card value, with the unit dropped when there is no reading behind it. */
function cardValue(value: number | null, unit: string, dp = 1): string {
  if (value === null) return ABSENT;
  return unit ? `${fmt(value, dp)} ${unit}` : fmt(value, dp);
}

/** Farm-wide averages across every sensor's latest reading. */
export function buildFarmAnalytics(
  sensors: Sensor[],
  bands: ApiThresholds,
): analyticsProps[] {
  const judgeable = settled(sensors);

  const moisture = round(average(judgeable.map((s) => s.moisture)));
  const sunlight = round(average(judgeable.map((s) => s.sunlight)));
  const salinity = round(average(meaningfulSalinity(judgeable)), 2);
  // Soil pH, explicitly. Water pH lives on a different band and is reported
  // separately on the sensor detail view; averaging the two together would mix
  // two different measurements into one meaningless number.
  const phSoil = round(average(judgeable.map((s) => s.phSoil)), 1);

  const moistureBand = band(moisture, bands.moisture, {
    low: "Low moisture",
    ok: "Good",
    high: "Waterlogged",
  });
  const sunlightBand = band(sunlight, bands.sunlight, {
    low: "Low sunlight",
    ok: "Good",
    high: "Excess sunlight",
  });
  const salinityBand = band(salinity, bands.salinity, {
    low: "Low salinity",
    ok: "Moderate salinity",
    high: "High salinity",
  });
  const phBand = band(phSoil, bands.phSoil, {
    low: "Acidic",
    ok: "Good",
    high: "Alkaline",
  });

  return [
    {
      title: "Soil moisture",
      value: cardValue(moisture, "%", 0),
      icon: <Droplet size={28} color="white" />,
      color: "outline-green-300",
      badgeStatus: moistureBand.status,
      badgeColor: moistureBand.color,
    },
    {
      // Not "lux". The LDR is uncalibrated and its output is relative, so a
      // number with a real photometric unit beside it would be a false claim.
      title: "Sunlight (relative)",
      value: cardValue(sunlight, "", 0),
      icon: <CloudSun size={28} color="white" />,
      color: "outline-yellow-300",
      badgeStatus: sunlightBand.status,
      badgeColor: sunlightBand.color,
    },
    {
      title: "Salinity",
      value: cardValue(salinity, "dS/m", 2),
      icon: <Wind size={28} color="white" />,
      color: "outline-blue-300",
      badgeStatus: salinityBand.status,
      badgeColor: salinityBand.color,
    },
    {
      title: "Soil pH",
      value: cardValue(phSoil, "", 1),
      icon: <Droplet size={28} color="white" />,
      color: "outline-orange-300",
      badgeStatus: phBand.status,
      badgeColor: phBand.color,
    },
  ];
}

type ReportBadge = { content: string; variant: reportsCardProps["badgeVariant"] };

function reportBadge(value: number | null, b: ThresholdBand): ReportBadge {
  if (value === null) return { content: "No data", variant: "outline" };
  if (value < b.low) return { content: "Low", variant: "destructive" };
  if (value > b.high) return { content: "High", variant: "secondary" };
  return { content: "Optimal", variant: "default" };
}

/**
 * The badge for a nutrient card.
 *
 * While `npkEstimated` is set, the value is shown but carries no verdict. The
 * probe derives N/P/K from conductivity rather than measuring them, so "Low
 * nitrogen" would be a judgement about the estimator, not the soil — and it is
 * exactly the judgement a farmer would act on by buying fertiliser.
 */
function nutrientBadge(
  value: number | null,
  b: ThresholdBand,
  estimated: boolean,
): ReportBadge {
  if (estimated) return { content: "Estimated", variant: "outline" };
  return reportBadge(value, b);
}

/**
 * Soil KPI cards computed from the averaged latest readings.
 *
 * Deliberately limited to what the sensors actually measure. The agronomic and
 * economic KPIs the design also mocked up (mandi prices, expected yield, carbon
 * sequestration, harvest window) need external data sources that are not wired
 * up, so they are omitted rather than filled with invented numbers.
 */
export function buildSoilReports(
  sensors: Sensor[],
  bands: ApiThresholds,
): reportsCardProps[] {
  const judgeable = settled(sensors);
  const estimated = anyNpkEstimated(sensors);

  const nitrogen = round(average(judgeable.map((s) => s.npk.nitrogen)), 0);
  const phosphorus = round(average(judgeable.map((s) => s.npk.phosphorus)), 0);
  const potassium = round(average(judgeable.map((s) => s.npk.potassium)), 0);
  const phSoil = round(average(judgeable.map((s) => s.phSoil)), 1);
  const phWater = round(average(judgeable.map((s) => s.phWater)), 1);
  const moisture = round(average(judgeable.map((s) => s.moisture)), 0);
  const temperature = round(average(judgeable.map((s) => s.temperature)), 1);
  const salinity = round(average(meaningfulSalinity(judgeable)), 2);
  const sunlight = round(average(judgeable.map((s) => s.sunlight)), 0);

  const nutrientNote = estimated
    ? "mg/kg — calculated from conductivity, not measured"
    : "mg/kg (farm average)";

  return [
    {
      title: "Soil Nitrogen (N)",
      data: nitrogen,
      description: nutrientNote,
      ...toBadge(nutrientBadge(nitrogen, bands.nitrogen, estimated)),
      reportsIcon: <Leaf />,
    },
    {
      title: "Soil Phosphorus (P)",
      data: phosphorus,
      description: nutrientNote,
      ...toBadge(nutrientBadge(phosphorus, bands.phosphorus, estimated)),
      reportsIcon: <Sprout />,
    },
    {
      title: "Soil Potassium (K)",
      data: potassium,
      description: nutrientNote,
      ...toBadge(nutrientBadge(potassium, bands.potassium, estimated)),
      reportsIcon: <Droplet />,
    },
    {
      title: "Soil pH",
      data: phSoil,
      description: "pH (farm average)",
      ...toBadge(reportBadge(phSoil, bands.phSoil)),
      reportsIcon: <Droplet />,
    },
    {
      // Reported separately from soil pH: different medium, different hardware,
      // different band. Merging them was contract mismatch #1.
      title: "Water pH",
      data: phWater,
      description: "pH (farm average)",
      ...toBadge(reportBadge(phWater, bands.phWater)),
      reportsIcon: <Droplet />,
    },
    {
      title: "Soil Moisture",
      data: moisture,
      description: "% (farm average)",
      ...toBadge(reportBadge(moisture, bands.moisture)),
      reportsIcon: <HandMetal />,
    },
    {
      title: "Soil Temperature",
      data: temperature,
      description: "°C (farm average)",
      ...toBadge(reportBadge(temperature, bands.temperature)),
      reportsIcon: <Thermometer />,
    },
    {
      title: "Soil Salinity",
      data: salinity,
      description: "dS/m (farm average)",
      ...toBadge(reportBadge(salinity, bands.salinity)),
      reportsIcon: <Wind />,
    },
    {
      title: "Sunlight Exposure",
      description: "relative, uncalibrated (farm average)",
      data: sunlight,
      ...toBadge(reportBadge(sunlight, bands.sunlight)),
      reportsIcon: <CloudSun />,
    },
  ];
}

function toBadge(badge: ReportBadge) {
  return { badgeContent: badge.content, badgeVariant: badge.variant };
}

/**
 * The cards on the per-sensor detail page.
 *
 * A settling probe gets no verdicts at all — its readings are shown, but banding
 * a converging number would report a problem that is about to resolve itself.
 * Dry soil suppresses the salinity verdict for the same reason it does farm-wide.
 */
export function buildSensorAnalytics(
  sensor: Sensor,
  bands: ApiThresholds,
): analyticsProps[] {
  const settling = sensor.quality?.stabilising === true;
  const dry = sensor.quality?.soilDry === true;

  const hold: Verdict = { status: "Settling", color: NEUTRAL };
  const verdict = (v: Verdict) => (settling ? hold : v);

  const temperatureBand = verdict(
    band(sensor.temperature, bands.temperature, {
      low: "Cold",
      ok: "Normal",
      high: "Heat stress",
    }),
  );
  const moistureBand = verdict(
    band(sensor.moisture, bands.moisture, {
      low: "Low",
      ok: "Normal",
      high: "Waterlogged",
    }),
  );
  const phSoilBand = verdict(
    band(sensor.phSoil, bands.phSoil, {
      low: "Acidic",
      ok: "Normal",
      high: "Alkaline",
    }),
  );
  const phWaterBand = verdict(
    band(sensor.phWater, bands.phWater, {
      low: "Acidic",
      ok: "Normal",
      high: "Alkaline",
    }),
  );
  const sunlightBand = verdict(
    band(sensor.sunlight, bands.sunlight, {
      low: "Low",
      ok: "Normal",
      high: "Excess",
    }),
  );
  const salinityBand = dry
    ? { status: "Dry soil", color: NEUTRAL }
    : verdict(
        band(sensor.salinity, bands.salinity, {
          low: "Low",
          ok: "Normal",
          high: "High",
        }),
      );

  return [
    {
      title: "Temperature",
      value: cardValue(sensor.temperature, "°C", 1),
      icon: <Thermometer className="h-6 w-6" />,
      color: "outline-red-300",
      badgeStatus: temperatureBand.status,
      badgeColor: `${temperatureBand.color} text-white`,
      sensorView: true,
    },
    {
      title: "Soil Moisture",
      value: cardValue(sensor.moisture, "%", 0),
      icon: <HandMetal className="h-6 w-6" />,
      color: "outline-blue-300",
      badgeStatus: moistureBand.status,
      badgeColor: `${moistureBand.color} text-white`,
      sensorView: true,
    },
    {
      title: "Soil pH",
      value: cardValue(sensor.phSoil, "", 1),
      icon: <Droplet className="h-6 w-6" />,
      color: "outline-green-300",
      badgeStatus: phSoilBand.status,
      badgeColor: `${phSoilBand.color} text-white`,
      sensorView: true,
    },
    {
      title: "Water pH",
      value: cardValue(sensor.phWater, "", 1),
      icon: <Droplet className="h-6 w-6" />,
      color: "outline-cyan-300",
      badgeStatus: phWaterBand.status,
      badgeColor: `${phWaterBand.color} text-white`,
      sensorView: true,
    },
    {
      title: "Sunlight (relative)",
      value: cardValue(sensor.sunlight, "", 0),
      icon: <CloudSun className="h-6 w-6" />,
      color: "outline-yellow-300",
      badgeStatus: sunlightBand.status,
      badgeColor: `${sunlightBand.color} text-white`,
      sensorView: true,
    },
    {
      title: "Salinity",
      value: cardValue(sensor.salinity, "dS/m", 2),
      icon: <Wind className="h-6 w-6" />,
      color: "outline-purple-300",
      badgeStatus: salinityBand.status,
      badgeColor: `${salinityBand.color} text-white`,
      sensorView: true,
    },
    {
      title: "Water level",
      value: cardValue(sensor.waterLevel, "", 0),
      icon: <Droplet className="h-6 w-6" />,
      color: "outline-blue-300",
      // Coarse and non-linear — a presence indicator, not a calibrated depth.
      badgeStatus: sensor.waterLevel === null ? "No data" : "Relative",
      badgeColor: `${NEUTRAL} text-white`,
      sensorView: true,
    },
  ];
}
