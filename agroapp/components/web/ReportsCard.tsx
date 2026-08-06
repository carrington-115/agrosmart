import { Card, CardContent } from "@/components/ui/card";
import { reportsCardProps } from "@/lib/types";
import { ABSENT } from "@/lib/format";
import { Badge } from "../ui/badge";

export default function Reports({
  title,
  data,
  description,
  badgeContent,
  badgeVariant,
  reportsIcon,
}: reportsCardProps) {
  return (
    <Card className="shadow-none border-primary/30">
      <CardContent className="flex items-start justify-between">
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            {/* `—` when no sensor reported this metric. Rendering 0 here would
                claim a measurement we do not have. */}
            <h3 className="text-4xl font-bold">{data ?? ABSENT}</h3>
            {description && (
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <Badge variant={badgeVariant}>{badgeContent}</Badge>
        </div>
        <div className="p-2 flex items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
          {reportsIcon}
        </div>
      </CardContent>
    </Card>
  );
}
