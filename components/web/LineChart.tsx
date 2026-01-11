"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
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

// Sample data - replace with your real monitoring data
export const chartData = [
  { time: "00:00", cpu: 12, memory: 45, network: 320 },
  { time: "04:00", cpu: 28, memory: 52, network: 480 },
  { time: "08:00", cpu: 65, memory: 78, network: 1250 },
  { time: "12:00", cpu: 92, memory: 88, network: 2100 },
  { time: "16:00", cpu: 78, memory: 82, network: 1850 },
  { time: "20:00", cpu: 41, memory: 64, network: 980 },
  { time: "24:00", cpu: 18, memory: 48, network: 410 },
];

const chartConfig = {
  cpu: {
    label: "CPU Usage (%)",
    color: "var(--chart-1)",
  },
  memory: {
    label: "Memory Usage (%)",
    color: "var(--chart-2)",
  },
  network: {
    label: "Network (Mbps)",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

export default function MonitoringLineChart({
  data = chartData,
  className,
}: MonitoringChartProps) {
  return (
    <Card className="w-[95%] shadow-none bg-primary-container/20 border border-primary">
      <CardHeader>
        <CardTitle className="text-3xl">NPK Realtime Stream</CardTitle>
        <CardDescription className="text-base">
          This chart style provides excellent at-a-glance insight for farmers,
          agronomists, or automated fertigation systems — helping detect
          deficiencies, over-fertilization, or sudden changes due to
          irrigation/rainfall.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className={`h-[320px] w-full ${className}`}
        >
          <LineChart
            accessibilityLayer
            data={data}
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
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              visibility="hidden"
              tickFormatter={(value) => value}
            />

            <YAxis
              tickLine={false}
              visibility="hidden"
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
            <Line
              dataKey="cpu"
              type="monotone"
              stroke="var(--color-cpu)"
              strokeWidth={2.5}
              dot={{ r: 4, strokeWidth: 2 }}
              activeDot={{ r: 7 }}
            />

            <Line
              dataKey="memory"
              type="monotone"
              stroke="var(--color-memory)"
              strokeWidth={2.5}
              dot={{ r: 4, strokeWidth: 2 }}
              activeDot={{ r: 7 }}
            />

            <Line
              dataKey="network"
              type="monotone"
              stroke="var(--color-network)"
              strokeWidth={2.5}
              dot={{ r: 4, strokeWidth: 2 }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div className="w-full flex justify-end">
          <Button className="bg-primary-container text-on-primary-container hover:text-white">
            <Bot size={24} />
            Enhanced readings
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
