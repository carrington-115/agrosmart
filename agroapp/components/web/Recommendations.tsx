import { RotateCw } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardTitle, CardHeader, CardContent } from "../ui/card";
import RecommendationCard from "./RecommendationCard";

export default function Recommendations() {
  return (
    <Card className="w-[95%] shadow-none">
      <CardHeader className="w-full flex justify-between items-center">
        <CardTitle className="text-xl">Recommendations</CardTitle>
        <Button size={"icon"} variant={"secondary"}>
          <RotateCw />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <RecommendationCard
          title="Increase nitrogen fertilizer in Zone C by 15% based on current NPK levels"
          content="Increase nitrogen fertilizer in Zone C by 15% based on current NPK levels. Do this now to improve yields, adapt to weather and get more. Click to chat with agent."
          color="green"
        />
        <RecommendationCard
          title="Increase nitrogen fertilizer in Zone C by 15% based on current NPK levels"
          content="Increase nitrogen fertilizer in Zone C by 15% based on current NPK levels. Do this now to improve yields, adapt to weather and get more. Click to chat with agent."
          color="orange"
        />
        <RecommendationCard
          title="Increase nitrogen fertilizer in Zone C by 15% based on current NPK levels"
          content="Increase nitrogen fertilizer in Zone C by 15% based on current NPK levels. Do this now to improve yields, adapt to weather and get more. Click to chat with agent."
          color="blue"
        />
      </CardContent>
    </Card>
  );
}
