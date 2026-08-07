import { getSensors } from "@/lib/queries";
import { buildRecommendations } from "@/lib/recommendations";
import RecommendationCard from "@/components/web/RecommendationCard";

/**
 * Recommendations, derived from thresholds.
 *
 * This page was a placeholder `<h1>Recommendations element</h1>`. The advice is
 * rule-based rather than model-generated: the SRS asks for prescriptive guidance
 * in plain language, and thresholds can honestly supply the part of that which
 * follows from the readings. Anything needing an LLM — the conversational and
 * image-diagnosis features — is still unimplemented rather than faked.
 *
 * `lib/recommendations` enforces the one hard rule: no fertiliser advice while
 * the probe is estimating N/P/K from conductivity instead of measuring it.
 */
export default async function Recommendations() {
  const sensors = await getSensors();
  const recommendations = buildRecommendations(sensors);

  if (!sensors.length) {
    return (
      <div className="px-8 py-6">
        <p className="text-sm text-muted-foreground">
          Add a sensor to start receiving recommendations.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-8 py-6">
      <div>
        <h2 className="text-xl font-bold">Recommendations</h2>
        <p className="text-sm text-muted-foreground">
          Based on the most recent reading from each of your {sensors.length}{" "}
          sensor{sensors.length === 1 ? "" : "s"}.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {recommendations.map((item) => (
          <RecommendationCard
            key={item.id}
            title={item.title}
            content={
              item.sensors.length
                ? `${item.content} Affects: ${item.sensors.join(", ")}.`
                : item.content
            }
            color={item.color}
          />
        ))}
      </div>
    </div>
  );
}
