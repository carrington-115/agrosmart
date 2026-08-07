import { DetailedReport } from "@/components/web";
import { getSensors } from "@/lib/queries";
import { buildRecommendations } from "@/lib/recommendations";
import { detailedReportProps } from "@/lib/types";
import { fmt } from "@/lib/format";
import { twMerge } from "tailwind-merge";

const NO_MODEL =
  "AI summaries need a language model, and none is connected to this deployment yet.";

/**
 * Reports built from data this system actually holds.
 *
 * The five reports here were previously hardcoded prose citing mandi prices,
 * carbon credits, leaf-camera imagery, pest risk scores and irrigation volumes —
 * none of which any part of AgroSmart measures or receives. They read as real
 * output, which is the problem: a farmer would have acted on a projected wheat
 * price this system invented.
 *
 * `agroapp/README.md` states the position these follow: agronomic and economic
 * KPIs "need external data sources that are not connected, so they are omitted
 * rather than mocked". What remains is derived from readings, and each report
 * says what it is counted from.
 */
export default async function Detailed() {
  const sensors = await getSensors();

  if (!sensors.length) {
    return (
      <div className="w-full max-w-full px-4 mt-5">
        <p className="text-sm text-muted-foreground">
          Reports appear once you have added a sensor and it has reported.
        </p>
      </div>
    );
  }

  const reporting = sensors.filter((s) => s.recordedAt !== null);
  const offline = sensors.filter((s) => s.status === "offline");
  const warning = sensors.filter((s) => s.status === "warning");
  const estimated = sensors.some((s) => s.quality?.npkEstimated);
  const dry = sensors.filter((s) => s.quality?.soilDry);
  const settling = sensors.filter((s) => s.quality?.stabilising);

  const present = (values: (number | null)[]) =>
    values.filter((v): v is number => v !== null);

  const mean = (values: (number | null)[]) => {
    const p = present(values);
    return p.length ? p.reduce((a, b) => a + b, 0) / p.length : null;
  };

  const recommendations = buildRecommendations(sensors);

  const reports: detailedReportProps[] = [
    {
      title: "Latest reading per sensor",
      description: `A row for each of your ${sensors.length} sensor${
        sensors.length === 1 ? "" : "s"
      }, with every metric it reported, both pH readings, water level, and the quality flags that say whether its nutrient values were measured or estimated. Exports as CSV.`,
      exportHref: "/api/reports/summary",
      aiUnavailableReason: NO_MODEL,
    },
    {
      title: "Soil nutrient summary",
      description: estimated
        ? `Nitrogen averages ${fmt(mean(sensors.map((s) => s.npk.nitrogen)), 0)} mg/kg, phosphorus ${fmt(
            mean(sensors.map((s) => s.npk.phosphorus)),
            0,
          )} mg/kg and potassium ${fmt(
            mean(sensors.map((s) => s.npk.potassium)),
            0,
          )} mg/kg across ${reporting.length} reporting sensor${
            reporting.length === 1 ? "" : "s"
          }. These are calculated from soil conductivity rather than measured, so they are shown without a verdict and no fertiliser recommendation is made from them.`
        : `Nitrogen averages ${fmt(mean(sensors.map((s) => s.npk.nitrogen)), 0)} mg/kg, phosphorus ${fmt(
            mean(sensors.map((s) => s.npk.phosphorus)),
            0,
          )} mg/kg and potassium ${fmt(
            mean(sensors.map((s) => s.npk.potassium)),
            0,
          )} mg/kg across ${reporting.length} reporting sensor${
            reporting.length === 1 ? "" : "s"
          }, measured directly.`,
      exportHref: "/api/reports/summary",
      aiUnavailableReason: NO_MODEL,
    },
    {
      title: "Soil condition summary",
      description: `Soil pH averages ${fmt(mean(sensors.map((s) => s.phSoil)), 1)}, moisture ${fmt(
        mean(sensors.map((s) => s.moisture)),
        0,
      )}%, and temperature ${fmt(mean(sensors.map((s) => s.temperature)), 1)}°C. ${
        dry.length
          ? `${dry.length} sensor${dry.length === 1 ? " reports" : "s report"} dry soil, which zeroes its conductivity-derived nutrient values — expected, not a fault.`
          : "No sensor is reporting dry soil."
      }`,
      exportHref: "/api/reports/summary",
      aiUnavailableReason: NO_MODEL,
    },
    {
      title: "Sensor health and coverage",
      description: `${sensors.length - offline.length} of ${sensors.length} sensor${
        sensors.length === 1 ? "" : "s"
      } reported within the last few minutes. ${
        offline.length
          ? `${offline.length} ${offline.length === 1 ? "has" : "have"} stopped reporting and ${offline.length === 1 ? "its readings are" : "their readings are"} no longer current. `
          : ""
      }${warning.length ? `${warning.length} ${warning.length === 1 ? "is" : "are"} outside a threshold. ` : ""}${
        settling.length
          ? `${settling.length} ${settling.length === 1 ? "is" : "are"} still settling after insertion, so ${settling.length === 1 ? "it is" : "they are"} not being judged against thresholds yet.`
          : ""
      }`,
      exportHref: "/api/reports/summary",
      aiUnavailableReason: NO_MODEL,
    },
    {
      title: "Current recommendations",
      description: `${recommendations.length} recommendation${
        recommendations.length === 1 ? "" : "s"
      } from the present readings, in plain language, each naming the sensors it applies to. Derived from thresholds rather than a model, so it covers what follows from the numbers and nothing beyond them.`,
      aiUnavailableReason: NO_MODEL,
    },
  ];

  return (
    <div className="w-full max-w-full">
      <div className={twMerge("flex flex-col px-4 gap-4 mt-5")}>
        {reports.map((report) => (
          <DetailedReport key={report.title} {...report} />
        ))}
      </div>
      <p className="px-4 mt-6 text-xs text-muted-foreground">
        Yield projections, market prices and carbon figures are not shown: they
        need data sources this system is not connected to, and estimating them
        from soil readings alone would be guesswork presented as a report.
      </p>
    </div>
  );
}
