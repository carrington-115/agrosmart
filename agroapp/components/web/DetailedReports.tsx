"use client";

import { detailedReportProps } from "@/lib/types";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BotMessageSquare, Download } from "lucide-react";

export default function DetailedReport({
  title,
  description,
  exportHref,
  aiUnavailableReason,
}: detailedReportProps) {
  return (
    <Card className="w-full flex items-center justify-center bg-primary-container text-on-primary-container shadow-none">
      <CardContent className="flex w-full items-center justify-between gap-6">
        <div className="flex flex-col max-w-[75%]">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm">{description}</p>
        </div>
        <div className="flex items-center gap-5">
          {/* A real download, not an empty callback. `<a download>` rather than
              a fetch so the browser handles the file, and the button is absent
              rather than dead when a report has no export. */}
          {exportHref ? (
            <Button variant="outline" asChild>
              <a href={exportHref} download>
                <Download />
                Export
              </a>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              <Download />
              Export
            </Button>
          )}

          {aiUnavailableReason ? (
            <Tooltip>
              <TooltipTrigger asChild>
                {/* A disabled button swallows pointer events, so the tooltip
                    needs a wrapper that still receives them. */}
                <span tabIndex={0}>
                  <Button disabled>
                    <BotMessageSquare />
                    AI Summary
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {aiUnavailableReason}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button>
              <BotMessageSquare />
              AI Summary
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
