import { analyticsProps } from "@/lib/types";
import { Badge } from "../ui/badge";
import { twMerge } from "tailwind-merge";

export default function AnalyticsCard({
  title,
  value,
  icon,
  color,
  badgeStatus,
  badgeColor,
}: analyticsProps) {
  return (
    <div
      className={twMerge(
        `p-6 flex justify-between items-center w-[24%] outline-1 rounded-md ${color}`
      )}
    >
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-base font-medium">{title}</p>
          <h2 className="text-3xl font-bold">{value}</h2>
        </div>
        <Badge variant="default" className={`${badgeColor}`}>
          {badgeStatus}
        </Badge>
      </div>
      <div>
        <div className={`p-1 rounded-md ${badgeColor}`}>{icon}</div>
      </div>
    </div>
  );
}
