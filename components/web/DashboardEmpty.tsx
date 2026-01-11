import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { SatelliteDish } from "lucide-react";

export function DashboardEmptyTemplate() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="default">
          <SatelliteDish size={64} />
        </EmptyMedia>
        <EmptyTitle>Get Started</EmptyTitle>
        <EmptyDescription>
          It's a bit quiet in here. Let's get the ball rolling. Add sensors, get
          realtime visualization, and get AI powered features through chats,
          alerts, and recommendations.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex gap-2">
          <Button>Add sensors</Button>
          <Button variant="outline">Go to Settings</Button>
        </div>
      </EmptyContent>
    </Empty>
  );
}
