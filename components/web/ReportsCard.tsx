import { Card, CardContent } from "@/components/ui/card";
import { reportsCardProps } from "@/lib/types";
import { Badge } from "../ui/badge";

export default function Reports({
  title,
  data,
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
            <h3 className="text-4xl font-bold">{data}</h3>
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
