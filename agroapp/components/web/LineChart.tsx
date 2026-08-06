"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";

import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Bot } from "lucide-react";
import { MonitoringChartProps } from "@/lib/types";

/**
 * Nitrogen, phosphorus and potassium over time.
 *
 * This component used to export a `chartData` fixture of CPU, memory and
 * network samples and plot it under the title "NPK Realtime Stream" — and
 * `lib/types.ts` imported that fixture to derive its own props type, so the
 * type layer depended on a mock in the UI layer. Both are gone: the series
 * arrives as a prop and `ChartPoint` is declared in `lib/types.ts`.
 */
const chartConfig = {
  nitrogen: {
    label: "Nitrogen (mg/kg)",
    color: "var(--chart-1)",
  },
  phosphorus: {
    label: "Phosphorus (mg/kg)",
    color: "var(--chart-2)",
  },
  potassium: {
    label: "Potassium (mg/kg)",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

export default function MonitoringLineChart({
  data = [],
  estimated = false,
}: MonitoringChartProps) {
  const points = data.map((point) => ({
    ...point,
    // Axis label only; the tooltip shows the full timestamp.
    label: new Date(point.time).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));
  return (
    <Card className="w-[100%] overflow-x-hidden shadow-none bg-primary-container/20 border border-primary">
      <CardHeader>
        <CardTitle className="text-3xl text-on-primary-container">
          NPK Realtime Stream
        </CardTitle>
        <CardDescription className="text-sm text-on-primary-container/70">
          Nutrient levels across your sensors over the last 24 hours, so you can
          spot deficiencies, over-fertilisation, or sudden changes after
          irrigation or rainfall.
          {estimated && (
            // Not a footnote. Every number on this chart is derived from
            // conductivity rather than measured, and the contract forbids
            // building fertiliser decisions on them while that is true.
            <span className="mt-2 block font-medium text-on-primary-container">
              These values are calculated from soil conductivity, not measured
              directly. Use them to watch trends, not to decide fertiliser.
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <p className="py-12 text-center text-sm text-on-primary-container/70">
            No readings in the last 24 hours.
          </p>
        ) : (
        <div className="overflow-x-auto">
          <ChartContainer
            config={chartConfig}
            className={`h-[250px] w-full min-w-0 relative overflow-x-hidden`}
          >
            <ResponsiveContainer width={"99%"} height={"100%"}>
              <LineChart
                accessibilityLayer
                data={points}
                margin={{
                  left: 12,
                  right: 12,
                  top: 20,
                  bottom: 20,
                }}
              >
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  opacity={0.4}
                />

                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => value}
                />

                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickCount={5}
                />

                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      indicator="dot"
                      labelFormatter={(value) => `Time: ${value}`}
                    />
                  }
                />

                <ChartLegend content={<ChartLegendContent />} />
                {/* `connectNulls` is off on purpose: a gap in the line is a gap
                    in the data, and bridging it would draw a measurement that
                    was never taken. */}
                <Line
                  dataKey="nitrogen"
                  type="monotone"
                  stroke="var(--color-nitrogen)"
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                />

                <Line
                  dataKey="phosphorus"
                  type="monotone"
                  stroke="var(--color-phosphorus)"
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                />

                <Line
                  dataKey="potassium"
                  type="monotone"
                  stroke="var(--color-potassium)"
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
        )}
      </CardContent>
      <CardFooter>
        <div className="w-full flex justify-end">
          <Button className="bg-primary-container text-on-primary-container hover:bg-primary-container/70">
            <Bot size={24} />
            Enhanced readings
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
