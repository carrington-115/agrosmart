"use client";

import { RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "../ui/button";
import { Card, CardTitle, CardHeader, CardContent } from "../ui/card";
import RecommendationCard from "./RecommendationCard";
import type { Recommendation } from "@/lib/recommendations";

/**
 * Threshold-derived advice for the current readings.
 *
 * These cards used to be three identical hardcoded strings recommending a 15%
 * nitrogen increase — advice the telemetry contract specifically forbids while
 * the probe is estimating N/P/K rather than measuring it. `lib/recommendations`
 * now derives them, and enforces that rule at the source.
 */
export default function Recommendations({
  items = [],
}: {
  items?: Recommendation[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Card className="w-[95%] shadow-none">
      <CardHeader className="w-full flex justify-between items-center">
        <CardTitle className="text-xl">Recommendations</CardTitle>
        <Button
          size="icon"
          variant="secondary"
          aria-label="Refresh recommendations"
          disabled={pending}
          onClick={() => startTransition(() => router.refresh())}
        >
          <RotateCw className={pending ? "animate-spin" : undefined} />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-5" aria-busy={pending}>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No recommendations yet. They appear once your sensors have reported.
          </p>
        ) : (
          items.map((item) => (
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
          ))
        )}
      </CardContent>
    </Card>
  );
}
