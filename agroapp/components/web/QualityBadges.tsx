"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Quality } from "@/lib/types";

/**
 * The device's data-quality block, rendered.
 *
 * These three flags change what the numbers beside them mean, so they are shown
 * wherever readings are shown. Two points of styling are contract requirements
 * rather than taste:
 *
 *   * `soilDry` is NEUTRAL, not destructive. Conductivity of zero is what dry
 *     soil measures. Colouring it as a fault would train the user to treat an
 *     ordinary field condition as broken hardware.
 *
 *   * An absent block renders as "Quality unknown", never as three quiet
 *     "false" chips. The flags are always sent by a conforming device, so their
 *     absence says the reading predates the contract — a different fact, and one
 *     the user should be able to see.
 */
export default function QualityBadges({
  quality,
  className = "",
}: {
  quality: Quality | null;
  className?: string;
}) {
  if (!quality) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`text-muted-foreground ${className}`}>
            Quality unknown
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          This reading arrived without a quality block, so we cannot say whether
          its nutrient values were measured or estimated.
        </TooltipContent>
      </Tooltip>
    );
  }

  const flags: { key: string; label: string; help: string }[] = [];

  if (quality.npkEstimated) {
    flags.push({
      key: "npkEstimated",
      label: "NPK estimated",
      help: "Nitrogen, phosphorus and potassium were calculated from conductivity rather than measured directly. Do not base fertiliser decisions on them.",
    });
  }
  if (quality.stabilising) {
    flags.push({
      key: "stabilising",
      label: "Settling",
      help: "The probe is within five minutes of being inserted. These readings are real but still converging.",
    });
  }
  if (quality.soilDry) {
    flags.push({
      key: "soilDry",
      label: "Dry soil",
      help: "Conductivity measured zero, which also zeroes the derived nutrient values. This is expected in dry soil and is not a sensor fault.",
    });
  }

  if (!flags.length) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {flags.map((flag) => (
        <Tooltip key={flag.key}>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="font-normal">
              {flag.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{flag.help}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
