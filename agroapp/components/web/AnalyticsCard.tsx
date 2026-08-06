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
  sensorView,
}: analyticsProps) {
  return (
    <div
      className={twMerge(
        `p-6 flex justify-between items-center w-full outline-1 rounded-md ${color}`,
      )}
    >
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-base font-medium">{title}</p>
          <h2 className="text-3xl font-bold">{value}</h2>
        </div>
        {!sensorView && (
          // `text-white` is a deliberate literal, not an oversight. `badgeColor` is
          // always a saturated fill (green/orange/red/slate), so the text sits on
          // the same colour in both themes — whereas the variant's default
          // `text-primary-foreground` inverts to near-black in dark mode and would
          // put dark text on a mid-green chip.
          <Badge variant="default" className={`${badgeColor} text-white`}>
            {badgeStatus}
          </Badge>
        )}
      </div>
      <div>
        <div className={`p-1 rounded-md ${badgeColor}`}>{icon}</div>
      </div>
    </div>
  );
}
