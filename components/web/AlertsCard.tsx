import { alertsCardProps } from "@/lib/types";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Check, X } from "lucide-react";

export default function AlertsCard({
  title,
  description,
  badgeType,
  badgeInfo,
}: alertsCardProps) {
  return (
    <Card className="mx-auto w-full h-full text-on-primary-container bg-primary-container/20 shadow-none cursor-pointer hover:bg-primary-container/40">
      <CardHeader className="flex justify-between items-center">
        <CardTitle className="text-medium font-bold text-on-primary-container">
          {title}
        </CardTitle>
        <Badge variant={badgeType}>{badgeInfo}</Badge>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm font-medium">
          {description}
        </CardDescription>
      </CardContent>
      <CardFooter className="w-full flex justify-between items-center">
        <div className="flex gap-2 items-center">
          <Button
            size={"icon-lg"}
            className="rounded-full !bg-primary-container/70 !text-on-primary-container hover:!bg-primary-container"
          >
            <Check />
          </Button>
          <Button
            size={"icon-lg"}
            className="rounded-full !bg-primary-container !text-on-primary-container"
          >
            <X />
          </Button>
        </div>
        <CardAction>
          <Button className="bg-on-primary-container !text-primary-container hover:!bg-on-primary-container">
            View Details
          </Button>
        </CardAction>
      </CardFooter>
    </Card>
  );
}
