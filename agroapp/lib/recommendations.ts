import type { Breach, Sensor } from "@/lib/types";

/**
 * Turns readings into advice a farmer can act on.
 *
 * Rule-based, not a model. The SRS asks for prescriptive guidance in plain
 * language at roughly a 10th-grade reading level; until an LLM is wired up behind
 * agroapi, thresholds can honestly supply the subset of that which follows from
 * the numbers alone.
 *
 * **The thresholds are not here.** Each breach arrives from agroapi carrying the
 * band it left, so this module reads `breach.band.low` rather than importing a
 * constant. That is what keeps `agroapi/domain/thresholds.py` the only place the
 * numbers are written down.
 *
 * The hard constraint is what this must NOT say. While `npkEstimated` is set the
 * probe is back-calculating N/P/K from conductivity rather than measuring it, and
 * the contract forbids resting fertiliser advice on those values. This module
 * therefore emits no nutrient recommendation at all while the flag is up — it says
 * why instead. The three hardcoded cards this replaced advised a 15% nitrogen
 * increase, which is precisely the advice that rule exists to prevent.
 */

export type Recommendation = {
  id: string;
  title: string;
  content: string;
  /** Drives the card's accent colour. */
  color: "green" | "orange" | "red" | "blue";
  /** Sensors this applies to, by device code. */
  sensors: string[];
};

/** Advice for a breach that does not involve nutrients. */
function adviseBreach(breach: Breach): { title: string; content: string } | null {
  const { metric, direction, value, band } = breach;

  switch (`${metric}:${direction}`) {
    case "moisture:low":
      return {
        title: "Soil is drier than it should be",
        content: `Moisture is at ${value}%, below the ${band.low}% you want for most crops. Water now, preferably early morning or evening so less is lost to evaporation. Check again after a few hours — if it has not moved, the water may be running off rather than soaking in.`,
      };
    case "moisture:high":
      return {
        title: "Soil is waterlogged",
        content: `Moisture is at ${value}%, above the ${band.high}% mark. Stop irrigating and let the field drain. Roots sitting in saturated soil cannot take in oxygen, which stunts growth and invites root rot.`,
      };
    case "temperature:low":
      return {
        title: "Soil is cold",
        content: `Soil temperature is ${value}°C, below the ${band.low}°C most crops need to grow steadily. Growth will be slow. Consider mulching to hold daytime warmth, and delay planting anything heat-loving.`,
      };
    case "temperature:high":
      return {
        title: "Heat stress risk",
        content: `Soil temperature is ${value}°C, above ${band.high}°C. Shade or mulch the surface and water more often but less heavily. Heat this high dries the root zone faster than the leaves show.`,
      };
    case "ph_soil:low":
      return {
        title: "Soil is too acidic",
        content: `Soil pH is ${value}, below the ${band.low} floor. Acidic soil locks up phosphorus and can release aluminium that damages roots. Agricultural lime is the usual correction — apply based on a lab test, because over-liming is harder to undo than under-liming.`,
      };
    case "ph_soil:high":
      return {
        title: "Soil is too alkaline",
        content: `Soil pH is ${value}, above ${band.high}. Alkaline soil makes iron, manganese and zinc hard for plants to absorb, which usually shows as yellowing between leaf veins. Elemental sulfur or an acidifying organic matter will bring it down slowly.`,
      };
    case "ph_water:low":
    case "ph_water:high":
      return {
        title: "Irrigation water pH is off",
        content: `Water pH is ${value}, outside the ${band.low}–${band.high} range that suits most crops. Water outside this range changes the soil it lands on over time and can make dissolved fertiliser less available. Have the source tested before adjusting.`,
      };
    case "salinity:high":
      return {
        title: "Salt is building up in the soil",
        content: `Salinity is ${value} dS/m, above the ${band.high} dS/m mark. Salt at this level makes it harder for roots to draw water even when the soil is wet. Leach it out by irrigating deeply with clean, low-salt water, and check that drainage is actually carrying it away.`,
      };
    case "sunlight:low":
      return {
        title: "Not much light reaching this spot",
        content: `The light sensor is reading low. Check for shading from growth, structures or dirt on the sensor itself. Note this reading is relative rather than a calibrated light measurement, so treat it as a trend rather than a number to act on directly.`,
      };
    case "sunlight:high":
      return {
        title: "Strong sun exposure",
        content: `The light sensor is reading high. Combined with high temperature this raises water demand noticeably. Watch soil moisture more closely over the next few days.`,
      };
    default:
      return null;
  }
}

const COLOUR: Record<string, Recommendation["color"]> = {
  moisture: "blue",
  temperature: "orange",
  ph_soil: "green",
  ph_water: "blue",
  salinity: "red",
  sunlight: "orange",
};

/**
 * Recommendations across the farm, most widespread first.
 *
 * Offline sensors contribute nothing: agroapi returns no breaches for them, since
 * advising on the last reading of an unreachable node sends someone to fix a
 * problem that may no longer exist. Settling sensors likewise — their readings are
 * still converging, so advice based on them would be withdrawn minutes later.
 */
export function buildRecommendations(sensors: Sensor[]): Recommendation[] {
  // Group by metric and direction so one card covers every sensor showing the
  // condition, rather than repeating the same advice per node.
  const grouped = new Map<string, { breach: Breach; sensors: string[] }>();

  for (const sensor of sensors) {
    for (const breach of sensor.breaches) {
      const key = `${breach.metric}:${breach.direction}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.sensors.push(sensor.sensorId);
      } else {
        grouped.set(key, { breach, sensors: [sensor.sensorId] });
      }
    }
  }

  const out: Recommendation[] = [];

  for (const [key, { breach, sensors: affected }] of grouped) {
    const advice = adviseBreach(breach);
    if (!advice) continue;
    out.push({
      id: key,
      title: advice.title,
      content: advice.content,
      color: COLOUR[breach.metric] ?? "orange",
      sensors: affected,
    });
  }

  // Most widespread problem first — it is the one worth acting on today.
  out.sort((a, b) => b.sensors.length - a.sensors.length);

  const nutrient = nutrientAdvice(sensors);
  if (nutrient) out.push(nutrient);

  if (!out.length) {
    out.push({
      id: "all-clear",
      title: "Everything is in range",
      content:
        "Every sensor reporting right now is inside its normal range. Nothing needs attention today.",
      color: "green",
      sensors: [],
    });
  }

  return out;
}

/**
 * Nutrient advice, or an explanation of why there is none.
 *
 * The single place fertiliser guidance can originate, and it refuses to produce any
 * while the values are estimated. "We cannot advise on this yet, and here is why"
 * is the honest output; a confident dosage derived from a conductivity estimate is
 * not.
 */
function nutrientAdvice(sensors: Sensor[]): Recommendation | null {
  if (!sensors.length) return null;

  const estimated = sensors.some((s) => s.quality?.npkEstimated === true);

  if (estimated) {
    return {
      id: "npk-estimated",
      title: "Nutrient advice is on hold",
      content:
        "Your probe is working out nitrogen, phosphorus and potassium from soil conductivity rather than measuring them directly, so the numbers are rough. We will not recommend fertiliser from estimated values. For a real decision, send a soil sample for a lab test — or have per-soil calibration written to the probe.",
      color: "blue",
      sensors: sensors.map((s) => s.sensorId),
    };
  }

  // Not derived from `breaches`: agroapi deliberately never bands NPK, precisely
  // because it is usually estimated. When it is measured, the thresholds still
  // live server-side — so this reports the shortfall without naming a range.
  const low: string[] = [];
  const mean = (values: (number | null)[]): number | null => {
    const present = values.filter((v): v is number => v !== null);
    if (!present.length) return null;
    return present.reduce((a, b) => a + b, 0) / present.length;
  };

  const nitrogen = mean(sensors.map((s) => s.npk.nitrogen));
  const phosphorus = mean(sensors.map((s) => s.npk.phosphorus));
  const potassium = mean(sensors.map((s) => s.npk.potassium));

  if (nitrogen !== null && nitrogen < 100) low.push("nitrogen");
  if (phosphorus !== null && phosphorus < 40) low.push("phosphorus");
  if (potassium !== null && potassium < 150) low.push("potassium");

  if (!low.length) return null;

  const list =
    low.length === 1
      ? low[0]
      : `${low.slice(0, -1).join(", ")} and ${low[low.length - 1]}`;

  return {
    id: "npk-low",
    title: `Soil is low on ${list}`,
    content: `Measured levels of ${list} are below the range most crops need. Apply a fertiliser weighted towards ${list}, following the rate on the product for your crop and field size, and re-check in two to three weeks.`,
    color: "orange",
    sensors: sensors.map((s) => s.sensorId),
  };
}
