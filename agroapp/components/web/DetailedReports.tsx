"use client";

import { detailedReportProps } from "@/lib/types";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { BotMessageSquare, Download } from "lucide-react";

export default function DetailedReport({
  title,
  description,
  exportFunction,
  AISummary,
}: detailedReportProps) {
  return (
    <Card className="w-full flex items-center justify-center bg-primary-container text-on-primary-container shadow-none">
      <CardContent className="flex items-center justify-between">
        <div className="flex flex-col max-w-[80%]">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm">{description}</p>
        </div>
        <div className="flex items-center gap-5">
          <Button variant={"outline"} onClick={exportFunction}>
            <Download />
            Export
          </Button>
          <Button onClick={AISummary}>
            <BotMessageSquare />
            AI Summary
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
